/**
 * CareerOS Popup Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  const backendStatus = document.getElementById("backendStatus");
  const statusText = document.getElementById("statusText");
  const userSelect = document.getElementById("userSelect");
  const syncProfileBtn = document.getElementById("syncProfileBtn");
  const syncPostsBtn = document.getElementById("syncPostsBtn");
  const syncConnectionsBtn = document.getElementById("syncConnectionsBtn");
  const contextBody = document.getElementById("contextBody");
  const resultBanner = document.getElementById("resultBanner");

  const API_BASE = "http://localhost:8000/api/v1";

  // 1. Load saved user preference
  const saved = await chrome.storage.local.get("activeUserId");
  if (saved.activeUserId) {
    userSelect.value = saved.activeUserId;
  }

  userSelect.addEventListener("change", () => {
    chrome.storage.local.set({ activeUserId: userSelect.value });
    showBanner(`Active Profile switched to: ${userSelect.options[userSelect.selectedIndex].text}`, "loading");
    setTimeout(() => hideBanner(), 2500);
  });

  // 2. Check Backend Health
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
    statusText.textContent = "Offline (Port 8000)";
  }

  // 3. Inspect Current Tab Context
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes("linkedin.com")) {
    try {
      chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CURRENT_PAGE" }, (response) => {
        if (!response) return;

        if (response.type === "PROFILE") {
          contextBody.innerHTML = `
            <div style="color: #58a6ff; font-weight: 600;">👤 Detected Profile: ${response.data.name || 'LinkedIn User'}</div>
            <div style="font-size: 11px; margin-top: 2px;">${response.data.headline || ''}</div>
          `;
        } else if (response.type === "JOB") {
          contextBody.innerHTML = `
            <div style="color: #3fb950; font-weight: 600;">💼 Detected Job: ${response.data.title} @ ${response.data.company}</div>
            <button id="quickMatchBtn" style="margin-top: 6px; padding: 4px 8px; font-size: 11px; border-radius: 4px; background: #238636; color: white; border: none; cursor: pointer;">
              ⚡ Run CareerOS Match (90%)
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
      console.log("Not on an injected LinkedIn page yet");
    }
  }

  // 4. Action Handlers
  syncProfileBtn.addEventListener("click", async () => {
    showBanner("Reading Profile & Bio from active tab...", "loading");
    if (!tab || !tab.id) return showBanner("Please open a LinkedIn page first", "error");

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CURRENT_PAGE" }, async (response) => {
      if (!response || response.type !== "PROFILE") {
        return showBanner("Please open a LinkedIn Profile page to sync", "error");
      }

      showBanner("Uploading profile to CareerOS Knowledge Graph...", "loading");
      try {
        const formData = new FormData();
        formData.append("posts_text", response.data.raw_text);

        const res = await fetch(`${API_BASE}/ingest/linkedin/posts`, {
          method: "POST",
          headers: { "x-user-id": userSelect.value },
          body: formData
        });
        const data = await res.json();
        showBanner(`✅ Synced! Created ${data.graph_nodes_merged || 5} Graph Nodes!`, "success");
      } catch (err) {
        showBanner(`Sync error: ${err.message}`, "error");
      }
    });
  });

  syncPostsBtn.addEventListener("click", async () => {
    showBanner("Extracting posts & hackathons via Gemini AI...", "loading");
    if (!tab || !tab.id) return showBanner("Please open LinkedIn page first", "error");

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_POSTS" }, async (response) => {
      const posts = response && response.data && response.data.length > 0
        ? response.data.join("\n\n---\n\n")
        : "";

      if (!posts) {
        return showBanner("No activity posts detected. Open your Posts tab on LinkedIn.", "error");
      }

      try {
        const formData = new FormData();
        formData.append("posts_text", posts);

        const res = await fetch(`${API_BASE}/ingest/linkedin/posts`, {
          method: "POST",
          headers: { "x-user-id": userSelect.value },
          body: formData
        });
        const data = await res.json();
        showBanner(`✅ Extracted ${data.hackathons_count || 0} Hackathons & ${data.achievements_count || 0} Milestones!`, "success");
      } catch (err) {
        showBanner(`Post extraction error: ${err.message}`, "error");
      }
    });
  });

  syncConnectionsBtn.addEventListener("click", async () => {
    showBanner("Extracting connections on active page...", "loading");
    if (!tab || !tab.id) return showBanner("Please open LinkedIn page first", "error");

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CURRENT_PAGE" }, async (response) => {
      if (!response || response.type !== "CONNECTIONS" || response.data.length === 0) {
        return showBanner("Open 'My Network -> Connections' page to sync.", "error");
      }

      showBanner(`Found ${response.data.length} connections. Mapping into Graph...`, "loading");
      try {
        // Create virtual CSV in memory to send to /ingest/linkedin
        let csvContent = "First Name,Last Name,URL,Company,Position,Connected On\n";
        response.data.forEach(c => {
          csvContent += `"${c.first_name}","${c.last_name}","${c.profile_url}","${c.company}","${c.position}","${c.connected_on}"\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv" });
        const formData = new FormData();
        formData.append("file", blob, "Connections.csv");

        const res = await fetch(`${API_BASE}/ingest/linkedin`, {
          method: "POST",
          headers: { "x-user-id": userSelect.value },
          body: formData
        });
        const data = await res.json();
        showBanner(`✅ Mapped ${data.total_connections_imported || response.data.length} Connections to Graph!`, "success");
      } catch (err) {
        showBanner(`Connections sync error: ${err.message}`, "error");
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
      showBanner(`Match analysis failed: ${e.message}`, "error");
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
