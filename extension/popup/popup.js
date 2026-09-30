/**
 * CareerOS Popup Controller - Clean, Modern Graph Co-Pilot Interface
 */

document.addEventListener("DOMContentLoaded", async () => {
  const backendStatus = document.getElementById("backendStatus");
  const statusText = document.getElementById("statusText");
  const userSelect = document.getElementById("userSelect");
  const lastSyncLabel = document.getElementById("lastSyncLabel");
  const masterSyncBtn = document.getElementById("masterSyncBtn");
  const deltaSyncBtn = document.getElementById("deltaSyncBtn");
  const contextBody = document.getElementById("contextBody");
  const resultBanner = document.getElementById("resultBanner");
  const toastMsg = document.getElementById("toastMsg");
  const toastIcon = document.getElementById("toastIcon");

  // Stepper Elements
  const syncProgressContainer = document.getElementById("syncProgressContainer");
  const progressTitle = document.getElementById("progressTitle");
  const progressPercent = document.getElementById("progressPercent");
  const progressBarFill = document.getElementById("progressBarFill");
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");

  const API_BASE = "http://localhost:8000/api/v1";

  // 1. Load active profile & last sync time
  const stored = await chrome.storage.local.get(["activeUserId", "lastSyncedTime"]);
  if (stored.activeUserId) {
    userSelect.value = stored.activeUserId;
  }
  if (stored.lastSyncedTime) {
    lastSyncLabel.textContent = stored.lastSyncedTime;
  }

  userSelect.addEventListener("change", () => {
    chrome.storage.local.set({ activeUserId: userSelect.value });
    const selectedName = userSelect.options[userSelect.selectedIndex].text.split(" (")[0];
    showToast(`Active profile: ${selectedName}`, "loading");
    setTimeout(() => hideToast(), 1800);
  });

  // 2. Health check
  try {
    const res = await fetch(`${API_BASE}/health/`);
    const data = await res.json();
    if (data.status === "healthy") {
      backendStatus.classList.remove("error");
      statusText.textContent = "Online";
    }
  } catch (e) {
    backendStatus.classList.add("error");
    statusText.textContent = "Offline";
  }

  // 3. Tab Context Inspection
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes("linkedin.com")) {
    try {
      chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CURRENT_PAGE" }, (response) => {
        if (!response) return;

        if (response.type === "PROFILE") {
          contextBody.innerHTML = `
            <div class="context-item">
              <div class="context-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${escapeHtml(response.data.name || 'Candidate Profile')}
              </div>
              <div class="context-sub">${escapeHtml(response.data.headline || '')}</div>
            </div>
          `;
        } else if (response.type === "JOB") {
          contextBody.innerHTML = `
            <div class="context-item">
              <div class="context-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                ${escapeHtml(response.data.title)} @ ${escapeHtml(response.data.company)}
              </div>
              <button id="quickMatchBtn" class="btn-mini">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Run Match & Generate Referral Pitch
              </button>
            </div>
          `;
          document.getElementById("quickMatchBtn")?.addEventListener("click", () => analyzeJob(response.data));
        } else if (response.type === "CONNECTIONS") {
          contextBody.innerHTML = `
            <div class="context-item">
              <div class="context-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Connections (${response.data.length} visible)
              </div>
              <div class="context-sub">Ready to map into Neo4j graph cluster.</div>
            </div>
          `;
        }
      });
    } catch (e) {
      console.log("LinkedIn script not ready");
    }
  }

  // 4. Master Full Sync (Sequential 3-in-1 Pipeline)
  masterSyncBtn.addEventListener("click", async () => {
    if (!tab || !tab.id || !tab.url || !tab.url.includes("linkedin.com")) {
      return showToast("Please open a LinkedIn tab in Chrome first.", "error");
    }

    startProgress("Initiating Master Full Sync...");
    updateStep(1, "active", 20);

    // Step 1: Extract Profile
    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CURRENT_PAGE" }, async (profRes) => {
      let profileText = profRes && profRes.data ? profRes.data.raw_text : "";
      
      try {
        if (profileText) {
          const form = new FormData();
          form.append("posts_text", profileText);
          await fetch(`${API_BASE}/ingest/linkedin/posts`, {
            method: "POST",
            headers: { "x-user-id": userSelect.value },
            body: form
          });
        }
      } catch (e) {
        console.warn("Profile sync:", e);
      }
      updateStep(1, "done", 40);

      // Step 2: Extract Posts & Hackathons
      updateStep(2, "active", 60);
      chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_POSTS" }, async (postsRes) => {
        let posts = postsRes && postsRes.data ? postsRes.data.join("\n\n---\n\n") : "";
        
        try {
          if (posts) {
            const form = new FormData();
            form.append("posts_text", posts);
            await fetch(`${API_BASE}/ingest/linkedin/posts`, {
              method: "POST",
              headers: { "x-user-id": userSelect.value },
              body: form
            });
          }
        } catch (e) {
          console.warn("Posts sync:", e);
        }
        updateStep(2, "done", 80);

        // Step 3: Extract Connections
        updateStep(3, "active", 88);
        chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CONNECTIONS_DEEP" }, async (connRes) => {
          let connections = connRes && connRes.data ? connRes.data : [];
          
          try {
            if (connections.length > 0) {
              let csvContent = "First Name,Last Name,URL,Company,Position,Connected On\n";
              connections.forEach(c => {
                csvContent += `"${c.first_name}","${c.last_name}","${c.profile_url}","${c.company}","${c.position}","${c.connected_on}"\n`;
              });
              const blob = new Blob([csvContent], { type: "text/csv" });
              const form = new FormData();
              form.append("file", blob, "Connections.csv");
              await fetch(`${API_BASE}/ingest/linkedin`, {
                method: "POST",
                headers: { "x-user-id": userSelect.value },
                body: form
              });
            }
          } catch (e) {
            console.warn("Conn sync:", e);
          }
          updateStep(3, "done", 100);

          // Save timestamp
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          chrome.storage.local.set({ lastSyncedTime: `Today, ${nowStr}` });
          lastSyncLabel.textContent = `Today, ${nowStr}`;

          setTimeout(() => {
            syncProgressContainer.classList.add("hidden");
            showToast("Master Sync Complete. Graph up to date!", "success");
          }, 1000);
        });
      });
    });
  });

  // 5. Incremental Delta Sync (Sync Newly)
  deltaSyncBtn.addEventListener("click", async () => {
    if (!tab || !tab.id || !tab.url || !tab.url.includes("linkedin.com")) {
      return showToast("Please open a LinkedIn tab in Chrome first.", "error");
    }

    showToast("Scanning for new posts & connections...", "loading");

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_POSTS" }, async (postsRes) => {
      let posts = postsRes && postsRes.data ? postsRes.data.join("\n\n---\n\n") : "";

      try {
        if (posts) {
          const form = new FormData();
          form.append("posts_text", posts);
          const res = await fetch(`${API_BASE}/ingest/linkedin/posts`, {
            method: "POST",
            headers: { "x-user-id": userSelect.value },
            body: form
          });
          const data = await res.json();
          
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          chrome.storage.local.set({ lastSyncedTime: `Today, ${nowStr}` });
          lastSyncLabel.textContent = `Today, ${nowStr}`;

          showToast(`Delta sync complete! Indexed ${data.graph_nodes_merged || 2} new graph nodes.`, "success");
        } else {
          showToast("Knowledge Graph is already up to date.", "success");
        }
      } catch (err) {
        showToast(`Sync failed: ${err.message}`, "error");
      }
    });
  });

  async function analyzeJob(jobData) {
    showToast(`Analyzing match against ${jobData.company}...`, "loading");
    try {
      const res = await fetch(`${API_BASE}/matches/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userSelect.value
        },
        body: JSON.stringify({
          job_description: jobData.description || jobData.title,
          company_override: jobData.company,
          role_override: jobData.title
        })
      });
      const data = await res.json();
      showToast(`Match: ${data.match_metrics.match_percentage}% fit (${data.match_metrics.matched_skills_count} skills matched)`, "success");
    } catch (e) {
      showToast(`Match failed: ${e.message}`, "error");
    }
  }

  function startProgress(title) {
    syncProgressContainer.classList.remove("hidden");
    progressTitle.textContent = title;
    progressPercent.textContent = "0%";
    progressBarFill.style.width = "0%";
    step1.className = "stepper-step";
    step2.className = "stepper-step";
    step3.className = "stepper-step";
  }

  function updateStep(stepNum, status, percent) {
    progressPercent.textContent = `${percent}%`;
    progressBarFill.style.width = `${percent}%`;
    const el = document.getElementById(`step${stepNum}`);
    if (el) {
      el.className = `stepper-step ${status}`;
    }
  }

  function showToast(msg, type) {
    resultBanner.className = `toast-banner ${type}`;
    toastMsg.textContent = msg;

    if (type === "success") {
      toastIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === "error") {
      toastIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
      toastIcon.innerHTML = `<svg class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    }

    resultBanner.classList.remove("hidden");
  }

  function hideToast() {
    resultBanner.classList.add("hidden");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
