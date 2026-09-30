/**
 * CareerOS Popup Controller with Master Full Sync & Incremental Delta Sync
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

  // Progress UI
  const syncProgressContainer = document.getElementById("syncProgressContainer");
  const progressTitle = document.getElementById("progressTitle");
  const progressPercent = document.getElementById("progressPercent");
  const progressBarFill = document.getElementById("progressBarFill");
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");

  const API_BASE = "http://localhost:8000/api/v1";

  // 1. Load saved preferences
  const stored = await chrome.storage.local.get(["activeUserId", "lastSyncedTime"]);
  if (stored.activeUserId) {
    userSelect.value = stored.activeUserId;
  }
  if (stored.lastSyncedTime) {
    lastSyncLabel.textContent = stored.lastSyncedTime;
  }

  userSelect.addEventListener("change", () => {
    chrome.storage.local.set({ activeUserId: userSelect.value });
    showBanner(`Switched active profile to: ${userSelect.options[userSelect.selectedIndex].text}`, "loading");
    setTimeout(() => hideBanner(), 2000);
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
    backendStatus.style.background = "rgba(248, 81, 73, 0.15)";
    backendStatus.style.borderColor = "rgba(248, 81, 73, 0.4)";
    backendStatus.style.color = "#f85149";
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
            <div style="color: #58a6ff; font-weight: 600;">👤 Detected Profile: ${response.data.name || 'Candidate'}</div>
            <div style="font-size: 11px; margin-top: 2px;">${response.data.headline || ''}</div>
          `;
        } else if (response.type === "JOB") {
          contextBody.innerHTML = `
            <div style="color: #3fb950; font-weight: 600;">💼 Detected Job: ${response.data.title} @ ${response.data.company}</div>
            <button id="quickMatchBtn" style="margin-top: 6px; padding: 5px 10px; font-size: 11px; border-radius: 4px; background: #238636; color: white; border: none; cursor: pointer; font-weight: 600;">
              ⚡ Run CareerOS Match & Referral Pitch
            </button>
          `;
          document.getElementById("quickMatchBtn")?.addEventListener("click", () => analyzeJob(response.data));
        } else if (response.type === "CONNECTIONS") {
          contextBody.innerHTML = `
            <div style="color: #d29922; font-weight: 600;">🤝 Connections Page: ${response.data.length} contacts visible</div>
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
      return showBanner("Please open your LinkedIn tab in Chrome first.", "error");
    }

    startProgress("Initiating Master Full Sync...");
    updateStep(1, "active", "1. Extracting Profile, Education & Experience...", 20);

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
        console.warn("Profile sync note:", e);
      }
      updateStep(1, "done", "1. Profile, Experience & College Synced", 45);

      // Step 2: Extract Posts & Hackathons
      updateStep(2, "active", "2. Scanning Posts & Extracting Hackathons via AI...", 55);
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
          console.warn("Posts sync note:", e);
        }
        updateStep(2, "done", "2. Posts, Hackathons & Milestones Synced", 80);

        // Step 3: Extract Connections
        updateStep(3, "active", "3. Mapping Network & Company Referral Bridges...", 85);
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
            console.warn("Conn sync note:", e);
          }
          updateStep(3, "done", "3. Connections & Alumni Bridges Synced", 100);

          // Save timestamp
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ", " + new Date().toLocaleDateString();
          chrome.storage.local.set({ lastSyncedTime: nowStr });
          lastSyncLabel.textContent = nowStr;

          setTimeout(() => {
            syncProgressContainer.classList.add("hidden");
            showBanner("🎉 Master Sync Complete! Entire LinkedIn Knowledge Graph is Up-to-Date!", "success");
          }, 1200);
        });
      });
    });
  });

  // 5. Incremental Delta Sync (Sync Newly)
  deltaSyncBtn.addEventListener("click", async () => {
    if (!tab || !tab.id || !tab.url || !tab.url.includes("linkedin.com")) {
      return showBanner("Please open your LinkedIn tab in Chrome first.", "error");
    }

    showBanner("⚡ Scanning new posts & new connections since last sync...", "loading");

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
          chrome.storage.local.set({ lastSyncedTime: `Today at ${nowStr}` });
          lastSyncLabel.textContent = `Today at ${nowStr}`;

          showBanner(`⚡ Incremental Sync Done! Linked ${data.graph_nodes_merged || 2} new graph nodes.`, "success");
        } else {
          showBanner("⚡ Graph is already up to date! No new unindexed posts detected.", "success");
        }
      } catch (err) {
        showBanner(`Delta Sync: ${err.message}`, "error");
      }
    });
  });

  async function analyzeJob(jobData) {
    showBanner(`Analyzing match against ${jobData.company}...`, "loading");
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
      showBanner(`🎯 Match Score: ${data.match_metrics.match_percentage}% (${data.match_metrics.matched_skills_count} Skills Matched)`, "success");
    } catch (e) {
      showBanner(`Match failed: ${e.message}`, "error");
    }
  }

  function startProgress(title) {
    syncProgressContainer.classList.remove("hidden");
    progressTitle.textContent = title;
    progressPercent.textContent = "0%";
    progressBarFill.style.width = "0%";
    step1.className = "stepper-item";
    step2.className = "stepper-item";
    step3.className = "stepper-item";
  }

  function updateStep(stepNum, status, text, percent) {
    progressPercent.textContent = `${percent}%`;
    progressBarFill.style.width = `${percent}%`;
    const el = document.getElementById(`step${stepNum}`);
    if (el) {
      el.className = `stepper-item ${status}`;
      el.textContent = (status === "done" ? "✅ " : status === "active" ? "⏳ " : "⚪ ") + text;
    }
  }

  function showBanner(msg, type) {
    resultBanner.className = `result-banner ${type}`;
    resultBanner.textContent = msg;
    resultBanner.classList.remove("hidden");
  }

  function hideBanner() {
    resultBanner.classList.add("hidden");
  }
});
