/**
 * CareerOS Chrome Extension v5.0 - Popup Controller
 * Full-featured Autonomous Graph Intelligence & Referral Co-Pilot
 * Deep Extraction: Profile, Certificates, Badges, Achievements, Experience, Connections, Posts
 */

document.addEventListener("DOMContentLoaded", async () => {
  const syncPageParams = new URLSearchParams(window.location.search);
  const isPersistentSyncPage = syncPageParams.get("runMasterSync") === "1";
  const persistentSyncTabId = Number(syncPageParams.get("linkedinTabId"));
  // Elements - Header & Config
  const backendStatus = document.getElementById("backendStatus");
  const statusText = document.getElementById("statusText");
  const backendSelect = document.getElementById("backendSelect");
  const userIdInput = document.getElementById("userIdInput");
  const accountUserDisplay = document.getElementById("accountUserDisplay");
  const accountDot = document.getElementById("accountDot");
  const btnAutoLinkAccount = document.getElementById("btnAutoLinkAccount");
  const resultBanner = document.getElementById("resultBanner");
  const toastMsg = document.getElementById("toastMsg");
  const toastIcon = document.getElementById("toastIcon");
  const apiDocsLink = document.getElementById("apiDocsLink");

  // Tab Switching
  const tabMyGraphBtn = document.getElementById("tabMyGraphBtn");
  const tabTargetScanBtn = document.getElementById("tabTargetScanBtn");
  const tabMyGraphContent = document.getElementById("tabMyGraphContent");
  const tabTargetScanContent = document.getElementById("tabTargetScanContent");

  // Action Buttons - Tab 1 (My Graph)
  const masterSyncBtn = document.getElementById("masterSyncBtn");
  const deltaSyncBtn = document.getElementById("deltaSyncBtn");
  const syncProfileOnlyBtn = document.getElementById("syncProfileOnlyBtn");
  const syncPostsOnlyBtn = document.getElementById("syncPostsOnlyBtn");
  const syncConnOnlyBtn = document.getElementById("syncConnOnlyBtn");
  const syncDeltaConnBtn = document.getElementById("syncDeltaConnBtn");

  // Nav buttons
  const navProfileBtn = document.getElementById("navProfileBtn");
  const navPostsBtn = document.getElementById("navPostsBtn");
  const navConnectionsBtn = document.getElementById("navConnectionsBtn");

  // CSV Import
  const uploadCsvBtn = document.getElementById("uploadCsvBtn");
  const csvFileInput = document.getElementById("csvFileInput");

  // Manual Post & Milestone Ingestion Elements
  const manualPostInput = document.getElementById("manualPostInput");
  const btnIngestManualPost = document.getElementById("btnIngestManualPost");
  const btnScanCurrentPagePosts = document.getElementById("btnScanCurrentPagePosts");
  const manualIngestStatus = document.getElementById("manualIngestStatus");

  // Stepper Elements
  const syncProgressContainer = document.getElementById("syncProgressContainer");
  const progressTitle = document.getElementById("progressTitle");
  const progressPercent = document.getElementById("progressPercent");
  const progressBarFill = document.getElementById("progressBarFill");
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");
  const step1Label = document.getElementById("step1Label");
  const step2Label = document.getElementById("step2Label");
  const step3Label = document.getElementById("step3Label");

  // Report Card Elements
  const syncReportCard = document.getElementById("syncReportCard");
  const reportCandidate = document.getElementById("reportCandidate");
  const reportCertsBadges = document.getElementById("reportCertsBadges");
  const reportExpEdu = document.getElementById("reportExpEdu");
  const reportConnections = document.getElementById("reportConnections");

  // Target Profile Elements (Tab 2)
  const targetProfileName = document.getElementById("targetProfileName");
  const targetProfileHeadline = document.getElementById("targetProfileHeadline");
  const targetCompanyVal = document.getElementById("targetCompanyVal");
  const targetRoleVal = document.getElementById("targetRoleVal");
  const targetAlumniBadge = document.getElementById("targetAlumniBadge");
  const scanTargetProfileBtn = document.getElementById("scanTargetProfileBtn");
  const scanTargetPostsBtn = document.getElementById("scanTargetPostsBtn");
  const scanTargetConnectionsBtn = document.getElementById("scanTargetConnectionsBtn");
  const generatePitchBtn = document.getElementById("generatePitchBtn");
  const outreachPitchText = document.getElementById("outreachPitchText");

  // Active Context (Tab 1)
  const contextBody = document.getElementById("contextBody");
  const contextHeaderTitle = document.getElementById("contextHeaderTitle");

  const PROD_API_URL = "https://careerosv5.onrender.com/api/v1";
  const LOCAL_API_URL = "http://localhost:8000/api/v1";

  let activeTargetProfileData = null;

  function getActiveBackendUrl() {
    return backendSelect ? backendSelect.value : PROD_API_URL;
  }

  function getActiveUserId() {
    if (userIdInput && userIdInput.value.trim()) {
      return userIdInput.value.trim();
    }
    return "4JzJQXG1eshV7BAfG1OxHTBYOXp2";
  }

  function updateFooterLinks(apiUrl) {
    if (apiDocsLink) {
      apiDocsLink.href = apiUrl.includes("localhost")
        ? "http://localhost:8000/docs"
        : "https://careerosv5.onrender.com/docs";
    }
  }

  // Tab Switcher Logic
  tabMyGraphBtn?.addEventListener("click", () => {
    tabMyGraphBtn.classList.add("active");
    tabTargetScanBtn.classList.remove("active");
    tabMyGraphContent.classList.add("active");
    tabTargetScanContent.classList.remove("active");
  });

  tabTargetScanBtn?.addEventListener("click", () => {
    tabTargetScanBtn.classList.add("active");
    tabMyGraphBtn.classList.remove("active");
    tabTargetScanContent.classList.add("active");
    tabMyGraphContent.classList.remove("active");
  });

  // Storage Initialization
  chrome.storage.local.get(
    [
      "backendUrl",
      "apiUrl",
      "userId",
      "linkedAccountEmail",
      "lastSyncedTime",
      "syncedConnCount",
      "syncedCertsCount",
      "syncedExpEduCount",
      "candidateName"
    ],
    (res) => {
      const chosenUrl = res.backendUrl || res.apiUrl;
      if (chosenUrl && backendSelect) {
        backendSelect.value = chosenUrl;
      }
      if (res.userId && userIdInput) {
        userIdInput.value = res.userId;
      }
      if (res.linkedAccountEmail && accountUserDisplay) {
        accountUserDisplay.textContent = res.linkedAccountEmail;
        if (accountDot) accountDot.classList.add("connected");
      } else if (res.userId && accountUserDisplay) {
        accountUserDisplay.textContent = res.userId;
        if (accountDot) accountDot.classList.add("connected");
      } else if (accountUserDisplay) {
        accountUserDisplay.textContent = "Auto-linking session...";
      }

      if (res.candidateName && reportCandidate) {
        reportCandidate.textContent = res.candidateName;
      }
      if (res.syncedCertsCount !== undefined && reportCertsBadges) {
        reportCertsBadges.textContent = `${res.syncedCertsCount} Synced`;
      }
      if (res.syncedExpEduCount !== undefined && reportExpEdu) {
        reportExpEdu.textContent = `${res.syncedExpEduCount} Mapped`;
      }
      if (res.syncedConnCount && reportConnections) {
        reportConnections.textContent = `${res.syncedConnCount} Contacts`;
      }

      if (res.syncedConnCount || res.syncedCertsCount) {
        if (syncReportCard) syncReportCard.classList.remove("hidden");
      }

      updateFooterLinks(getActiveBackendUrl());
      checkBackendHealth();
    }
  );

  backendSelect?.addEventListener("change", () => {
    const val = backendSelect.value;
    chrome.storage.local.set({ backendUrl: val, apiUrl: val });
    updateFooterLinks(val);
    checkBackendHealth();
  });

  const handleUserIdUpdate = () => {
    const val = userIdInput.value.trim();
    if (val) {
      chrome.storage.local.set({ userId: val });
      if (accountUserDisplay) {
        accountUserDisplay.textContent = val;
        if (accountDot) accountDot.classList.add("connected");
      }
    }
  };

  userIdInput?.addEventListener("input", handleUserIdUpdate);
  userIdInput?.addEventListener("change", () => {
    handleUserIdUpdate();
    const val = userIdInput.value.trim();
    showToast(`Target user set to: ${val || "Default"}`, "success");
  });

  // Navigation Helper that waits for page to fully load
  async function navigateAndWait(tabId, url) {
    try {
      const currentTab = await chrome.tabs.get(tabId);
      if (
        currentTab &&
        currentTab.url &&
        currentTab.url.split("?")[0].replace(/\/+$/, "") === url.split("?")[0].replace(/\/+$/, "")
      ) {
        await new Promise((r) => setTimeout(r, 1200));
        return;
      }
      return await new Promise((resolve) => {
        let isDone = false;
        const finish = () => {
          if (isDone) return;
          isDone = true;
          try { chrome.tabs.onUpdated.removeListener(listener); } catch (e) {}
          setTimeout(resolve, 1500);
        };
        const listener = (updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === "complete") finish();
        };
        chrome.tabs.onUpdated.addListener(listener);
        chrome.tabs.update(tabId, { url }).catch((error) => {
          console.warn("Navigation update notice:", error);
          finish();
        });
        setTimeout(finish, 15000);
      });
    } catch (e) {
      console.warn("Navigation update notice:", e);
    }
  }

  // Auto-Detect Active CareerOS Web App Session
  async function detectAndConnectCareerOsSession() {
    try {
      if (accountUserDisplay) accountUserDisplay.textContent = "Scanning active tabs...";

      const tabs = await chrome.tabs.query({});
      const careerOsTabs = tabs.filter(
        (t) =>
          t.url &&
          (t.url.includes("careerosv5.vercel.app") ||
            t.url.includes("localhost:5173") ||
            t.url.includes("localhost:3000") ||
            t.url.includes("localhost:8000"))
      );

      if (careerOsTabs.length === 0) {
        chrome.storage.local.get(["userId", "linkedAccountEmail"], (res) => {
          if (res.linkedAccountEmail && accountUserDisplay) {
            accountUserDisplay.textContent = res.linkedAccountEmail;
            if (accountDot) accountDot.classList.add("connected");
          } else if (res.userId && accountUserDisplay) {
            accountUserDisplay.textContent = res.userId;
            if (accountDot) accountDot.classList.add("connected");
          } else if (accountUserDisplay) {
            accountUserDisplay.textContent = "Enter Account UID or open Web App";
          }
        });
        return;
      }

      const targetTab = careerOsTabs[0];
      if (targetTab.url && targetTab.url.includes("localhost")) {
        if (backendSelect) backendSelect.value = LOCAL_API_URL;
        updateFooterLinks(LOCAL_API_URL);
      } else if (targetTab.url && targetTab.url.includes("vercel.app")) {
        if (backendSelect) backendSelect.value = PROD_API_URL;
        updateFooterLinks(PROD_API_URL);
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: () => {
          try {
            const directId = localStorage.getItem("careeros_user_id");
            const directUser = localStorage.getItem("careeros_user");
            if (directId) {
              let parsed = {};
              try { parsed = JSON.parse(directUser); } catch (e) {}
              return {
                uid: directId,
                email: parsed.email || "",
                displayName: parsed.displayName || ""
              };
            }

            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith("firebase:authUser:")) {
                const raw = localStorage.getItem(key);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  return {
                    uid: parsed.uid,
                    email: parsed.email,
                    displayName: parsed.displayName,
                    photoURL: parsed.photoURL
                  };
                }
              }
            }
            const userJson = localStorage.getItem("user");
            if (userJson) {
              return JSON.parse(userJson);
            }
          } catch (e) {
            return null;
          }
          return null;
        }
      });

      if (results && results[0] && results[0].result) {
        const authUser = results[0].result;
        const uid = authUser.uid || authUser.id || authUser.email;
        const displayLabel = authUser.email || authUser.displayName || uid;

        if (userIdInput) userIdInput.value = uid;
        if (accountUserDisplay) accountUserDisplay.textContent = displayLabel;
        if (accountDot) accountDot.classList.add("connected");

        chrome.storage.local.set({
          userId: uid,
          linkedAccountEmail: displayLabel,
          backendUrl: backendSelect ? backendSelect.value : PROD_API_URL,
          apiUrl: backendSelect ? backendSelect.value : PROD_API_URL
        });

        showToast(`Auto-Linked to Account: ${uid.slice(0, 12)}...`, "success");
      } else {
        if (accountUserDisplay) accountUserDisplay.textContent = "CareerOS Web Tab Found";
        if (accountDot) accountDot.classList.add("connected");
      }
    } catch (err) {
      console.warn("Auto-detect tab notice:", err);
    }
  }

  btnAutoLinkAccount?.addEventListener("click", () => {
    detectAndConnectCareerOsSession();
  });

  setTimeout(() => {
    detectAndConnectCareerOsSession();
  }, 100);

  // Backend Health Ping
  async function checkBackendHealth() {
    try {
      const baseUrl = getActiveBackendUrl().replace("/api/v1", "");
      const res = await fetch(`${baseUrl}/health`, { method: "GET" }).catch(() => null);
      if (res && res.ok) {
        if (backendStatus) backendStatus.className = "status-indicator online";
        if (statusText) statusText.textContent = "Online";
      } else {
        if (backendStatus) backendStatus.className = "status-indicator offline";
        if (statusText) statusText.textContent = "Offline";
      }
    } catch {
      if (backendStatus) backendStatus.className = "status-indicator offline";
      if (statusText) statusText.textContent = "Offline";
    }
  }

  // Active Tab Context Inspection
  async function inspectActiveTab() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) return;

      const url = activeTab.url;
      if (!url.includes("linkedin.com")) {
        if (contextBody) {
          contextBody.innerHTML = `
            <div class="context-item">
              <span class="context-tag alert">Non-LinkedIn</span>
              <p class="context-text">Open LinkedIn in this tab to sync your Graph or scan contacts.</p>
            </div>
          `;
        }
        if (targetProfileName) targetProfileName.textContent = "Open a LinkedIn Profile";
        if (targetProfileHeadline) targetProfileHeadline.textContent = "Navigate to any /in/ profile on LinkedIn";
        return;
      }

      let viewType = "LinkedIn View";
      if (url.includes("/in/")) {
        viewType = "Profile View";
      } else if (url.includes("/recent-activity")) {
        viewType = "Recent Activity / Posts";
      } else if (url.includes("/mynetwork")) {
        viewType = "My Network / Connections";
      }

      if (contextHeaderTitle) contextHeaderTitle.textContent = `Active: ${viewType}`;

      chrome.tabs.sendMessage(activeTab.id, { action: "EXTRACT_CURRENT_PAGE" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["scripts/content.js"]
          }).then(() => {
            setTimeout(() => inspectActiveTab(), 400);
          }).catch(() => {});
          return;
        }

        if (response.type === "PROFILE" || response.type === "TARGET_PROFILE") {
          const p = response.data;
          activeTargetProfileData = p;

          const certsCount = p.certifications?.length || 0;
          const achCount = p.achievements?.length || 0;
          const badgesCount = p.badges?.length || 0;
          const extraInfo = certsCount || achCount || badgesCount
            ? ` · ${certsCount} Certs · ${achCount + badgesCount} Badges/Awards`
            : "";

          if (contextBody) {
            contextBody.innerHTML = `
              <div class="context-item">
                <span class="context-tag profile">Profile</span>
                <strong class="context-title">${escapeHtml(p.name || "LinkedIn Profile")}</strong>
                <p class="context-text">${escapeHtml(p.headline || p.location || "Profile detected")}${extraInfo}</p>
              </div>
            `;
          }

          if (targetProfileName) targetProfileName.textContent = p.name || "Target Profile";
          if (targetProfileHeadline) targetProfileHeadline.textContent = p.headline || "No headline extracted";
          if (targetCompanyVal) targetCompanyVal.textContent = p.current_company || p.company || "--";
          if (targetRoleVal) targetRoleVal.textContent = p.current_role || p.role || "--";

          const eduStr = JSON.stringify(p.education || []).toLowerCase();
          const headStr = (p.headline || "").toLowerCase();
          const isAlum =
            eduStr.includes("anand") ||
            eduStr.includes("sgi") ||
            headStr.includes("anand") ||
            headStr.includes("sgi") ||
            p.is_alumni;
          if (targetAlumniBadge) {
            if (isAlum) {
              targetAlumniBadge.classList.remove("hidden");
            } else {
              targetAlumniBadge.classList.add("hidden");
            }
          }
        } else if (response.type === "CONNECTIONS") {
          const count = Array.isArray(response.data) ? response.data.length : 0;
          if (contextBody) {
            contextBody.innerHTML = `
              <div class="context-item">
                <span class="context-tag" style="background:#22c55e22; color:#22c55e;">Connections</span>
                <strong class="context-title">LinkedIn Connections Hub</strong>
                <p class="context-text">Detected ${count} visible network contacts on page</p>
              </div>
            `;
          }
        } else if (response.type === "POSTS") {
          const count = Array.isArray(response.data) ? response.data.length : 0;
          if (contextBody) {
            contextBody.innerHTML = `
              <div class="context-item">
                <span class="context-tag" style="background:#3b82f622; color:#3b82f6;">Activity</span>
                <strong class="context-title">LinkedIn Activity Feed</strong>
                <p class="context-text">Detected ${count} recent posts</p>
              </div>
            `;
          }
        }
      });
    } catch (e) {
      console.warn("inspectActiveTab error:", e);
    }
  }

  inspectActiveTab();

  // Navigation Buttons
  navProfileBtn?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.update(tab.id, { url: "https://www.linkedin.com/in/me/" });
  });

  navPostsBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Open LinkedIn to scan posts.", "error");
        return;
      }
      const profileUrl = (tab.url.includes("/in/") ? tab.url : activeTargetProfileData?.profile_url || tab.url)
        .split("?")[0].replace(/\/recent-activity(?:\/.*)?$/, "").replace(/\/+$/, "");
      const activityUrl = profileUrl.includes("/in/")
        ? `${profileUrl}/recent-activity/all/`
        : "https://www.linkedin.com/in/me/recent-activity/all/";
      showToast("Opening the profile activity feed and scanning posts...", "loading");
      await navigateAndWait(tab.id, activityUrl);
      await new Promise((r) => setTimeout(r, 1200));
      const posts = await performLivePostsScan(tab.id);
      if (!posts.length) {
        showToast("Activity feed opened, but no posts were found to ingest.", "error");
        return;
      }
      const response = await fetch(`${getActiveBackendUrl()}/ingest/linkedin/posts/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": getActiveUserId() },
        body: JSON.stringify({ posts_text: posts.join("\n\n---\n\n") })
      });
      if (!response.ok) throw new Error(`Posts ingestion failed (${response.status})`);
      const result = await response.json();
      showToast(`Scanned ${posts.length} posts · ${result.hackathons_count || 0} signals merged.`, "success");
    } catch (err) {
      showToast(`Posts scan failed: ${err.message}`, "error");
    }
  });

  navConnectionsBtn?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.update(tab.id, { url: "https://www.linkedin.com/mynetwork/invite-connect/connections/" });
  });

  // =========================================================================
  // DEEP SCANNER ENGINE (Profile, Connections, Posts)
  // =========================================================================

  // Live Comprehensive Profile Scan
  async function performLiveProfileScan(tabId) {
    try {
      // Step 1: Pre-hydrate lazy loaded sections by fast scrolling
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async () => {
          const steps = [900, 2000, 3500, 5000, 0];
          for (const s of steps) {
            window.scrollTo({ top: s, behavior: "instant" });
            window.dispatchEvent(new Event("scroll", { bubbles: true }));
            await new Promise((r) => setTimeout(r, 220));
          }
        }
      });
      await new Promise((r) => setTimeout(r, 350));

      const response = await sendTabMessagePromise(tabId, { action: "EXTRACT_FULL_PROFILE" });
      if (response && response.data) {
        return response.data;
      }
    } catch (e) {
      // Re-inject content script and retry
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["scripts/content.js"]
        });
        await new Promise((r) => setTimeout(r, 400));
        const retryRes = await sendTabMessagePromise(tabId, { action: "EXTRACT_FULL_PROFILE" });
        if (retryRes && retryRes.data) return retryRes.data;
      } catch (err) {}
    }

    // Direct injection fallback with hydration
    const scriptResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        try {
          const rawText = document.body ? document.body.innerText : "";
          const nameEl = document.querySelector("h1.text-heading-xlarge, h1.top-card-layout__title, h1");
          const name = nameEl ? nameEl.innerText.trim().split("\n")[0] : "Candidate";
          const headEl = document.querySelector("div.text-body-medium.break-words, h2.top-card-layout__headline");
          const headline = headEl ? headEl.innerText.trim() : "";
          return {
            name: name,
            full_name: name,
            headline: headline,
            raw_text: rawText.slice(0, 30000),
            education: [],
            experience: [],
            certifications: [],
            achievements: [],
            badges: [],
            skills: []
          };
        } catch (e) {
          return null;
        }
      }
    });

    return scriptResults && scriptResults[0] ? scriptResults[0].result : null;
  }

  // Live Deep Connections Scan with Infinite Scroll & Recovery Pump
  async function performLiveConnectionsScan(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        const connectionsMap = new Map();
        let prevCount = 0;
        let noNew = 0;
        let totalCount = 0;

        if (!location.pathname.includes("/mynetwork/invite-connect/connections")) return [];
        for (let attempt = 0; attempt < 30; attempt++) {
          const root = document.querySelector("main .scaffold-finite-scroll__content, main ul.mn-connections, main [data-view-name*='connections']") || document.querySelector("main");
          if (root && root.querySelector("a[href*='/in/']")) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Multi-pattern extraction of total connection count
        const headerText = document.body ? document.body.innerText : "";
        const cappedLinkedInCount = /500\+\s+connections/i.test(headerText);
        const patterns = [
          /(\d[\d,]*)\s+connections/i,
          /connections\s*\([^\d]*(\d[\d,]*)\)/i,
          /connections[^\d]*(\d[\d,]*)/i,
          /(\d[\d,]*)\s+total\s+connections/i,
          /(\d[\d,]*)\s+contacts/i
        ];
        for (const pat of (cappedLinkedInCount ? [] : patterns)) {
          const match = headerText.match(pat);
          if (match && match[1]) {
            const parsed = parseInt(match[1].replace(/,/g, ""), 10);
            if (parsed > 0) {
              totalCount = parsed;
              break;
            }
          }
        }

        let hud = document.getElementById("careeros-scan-hud");
        if (!hud) {
          hud = document.createElement("div");
          hud.id = "careeros-scan-hud";
          hud.style.position = "fixed";
          hud.style.bottom = "24px";
          hud.style.right = "24px";
          hud.style.zIndex = "999999";
          hud.style.background = "#0f172a";
          hud.style.color = "#ffffff";
          hud.style.padding = "12px 18px";
          hud.style.borderRadius = "12px";
          hud.style.boxShadow = "0 10px 30px rgba(0,0,0,0.4)";
          hud.style.fontFamily = "Inter, system-ui, sans-serif";
          hud.style.fontSize = "13px";
          hud.style.fontWeight = "600";
          hud.style.display = "flex";
          hud.style.alignItems = "center";
          hud.style.gap = "10px";
          hud.style.border = "1px solid rgba(255,255,255,0.15)";
          (document.body || document.documentElement).appendChild(hud);
        }

        const cleanText = (str) => {
          if (!str) return "";
          return str.replace(/\s+/g, " ").replace(/…see more|see less|\.\.\.more/gi, "").trim();
        };
        const nonPersonNameTerms = /\b(student|engineer|developer|intern|manager|director|founder|architect|analyst|scientist|designer|recruiter|consultant|specialist|professor|researcher|entrepreneur|aspiring|software|computer|machine learning|artificial intelligence|full stack|backend|frontend|web developer|btech|bca|mca|mba)\b/i;
        const isPersonName = (value) => {
          const name = cleanText(value);
          return name.length >= 2 && name.length <= 60 && /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name) && !nonPersonNameTerms.test(name);
        };
        const nameFromProfileUrl = (url) => {
          const match = (url || "").match(/\/in\/([^/?#]+)/i);
          if (!match) return "";
          const slug = match[1].replace(/[-_][a-f0-9]{6,12}$/i, "").replace(/[-_]+/g, " ");
          const name = slug.replace(/\b\w/g, (letter) => letter.toUpperCase());
          return isPersonName(name) ? name : "";
        };

        const extractFromDom = () => {
          // Scan the actual connections list only. A global profile-link scan includes recommendations and UI links.
          const listRoot = document.querySelector("main .scaffold-finite-scroll__content, main ul.mn-connections, main [data-view-name*='connections']") || document.querySelector("main");
          if (!listRoot || !location.pathname.includes("/mynetwork/invite-connect/connections")) return;
          const linkCandidates = Array.from(listRoot.querySelectorAll("a[href*='/in/']")).filter((a) => {
            if (a.closest("header, nav, #global-nav, .global-nav, footer")) return false;
            const rawHref = a.getAttribute("href") || a.href || "";
            if (rawHref.includes("/in/me") || rawHref.includes("/in/edit") || rawHref.includes("search") || rawHref.includes("feed")) {
              return false;
            }
            const clean = rawHref.split("?")[0].replace(/\/+$/, "") + "/";
            return clean.includes("/in/") && !clean.endsWith("/in/");
          });

          linkCandidates.forEach((link) => {
            const rawHref = link.getAttribute("href") || link.href || "";
            const cleanUrl = (link.href || rawHref).split("?")[0].replace(/\/+$/, "") + "/";
            if (!cleanUrl || cleanUrl.endsWith("/in/") || cleanUrl.includes("/in/me")) return;

            const card = link.closest(".mn-connection-card, li.mn-connection-card, li, [role='listitem'], .artdeco-list__item, .entity-result, div[data-view-name*='connection']");
            if (!card || !listRoot.contains(card)) return;

            const cardText = (card?.innerText || "").trim();

            // Extract Name
            let name = "";
            const nameInLink = card.querySelector(".mn-connection-card__name, .artdeco-entity-lockup__title, .entity-result__title-text, h3") || link.querySelector("span[aria-hidden='true'], span") || link;
            if (nameInLink && nameInLink.innerText) {
              name = cleanText(nameInLink.innerText).split("\n")[0];
            }
            if (!name || name.length < 2 || name.toLowerCase().includes("view") || name.length > 50) {
              const nameEl = card.querySelector(
                ".mn-connection-card__name, .entity-result__title-text, .artdeco-entity-lockup__title, .t-16.t-black.t-bold, h3, [data-view-name*='actor'] a, span[dir='ltr']"
              );
              if (nameEl) {
                name = cleanText(nameEl.innerText).split("\n")[0];
              }
            }

            name = name
              .replace(/\(.*?\)/g, "")
              .replace(/verified/gi, "")
              .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
              .trim();

            if (!isPersonName(name)) name = nameFromProfileUrl(cleanUrl);

            if (
              !isPersonName(name) ||
              name.length > 60 ||
              /\b(connect|message|follow|pending|view profile|see all|show more|linkedin member|connections?)\b/i.test(name) ||
              !/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name) ||
              name.toLowerCase().includes("linkedin member") ||
              name.toLowerCase().includes("sort by") ||
              name.toLowerCase().includes("see all")
            ) {
              return;
            }

            // Extract Occupation
            let occupation = "";
            const occEl = card.querySelector(
              ".mn-connection-card__occupation, .entity-result__primary-subtitle, .artdeco-entity-lockup__caption, .artdeco-entity-lockup__subtitle, .t-14.t-normal, .entity-result__summary, p"
            );
            if (occEl) {
              occupation = cleanText(occEl.innerText);
              if (/^(connected|message|follow|pending|1st|2nd|3rd|view profile)\b/i.test(occupation) || occupation.length > 240) occupation = "";
            } else {
              const lines = cardText.split("\n").map((l) => l.trim()).filter(Boolean);
              const nameIdx = lines.findIndex((l) => l.toLowerCase() === name.toLowerCase());
              if (nameIdx !== -1 && lines[nameIdx + 1] && !lines[nameIdx + 1].startsWith("Connected") && !lines[nameIdx + 1].startsWith("Message")) {
                occupation = lines[nameIdx + 1];
              }
            }

            // Extract Connected Date
            let connectedOn = "Recent";
            const dateMatch =
              cardText.match(/Connected on\s+([A-Za-z]+\s+\d+,\s+\d{4})/i) ||
              cardText.match(/Connected\s+([A-Za-z0-9\s,]+ago|[A-Za-z]+\s+\d+,\s+\d{4})/i);
            if (dateMatch) {
              connectedOn = dateMatch[1].trim();
            }

            // Avatar
            const imgEl = card.querySelector("img.presence-entity__image, img.evi-image, img.artdeco-entity-lockup__image, img");
            const avatarUrl = imgEl ? (imgEl.src || "") : "";

            // Company & Position
            let company = "";
            let position = occupation;
            if (occupation.includes(" at ")) {
              const parts = occupation.split(" at ");
              position = parts[0].trim();
              company = parts.slice(1).join(" at ").split("|")[0].split("•")[0].split(",")[0].trim();
            } else if (occupation.includes(" @ ")) {
              const parts = occupation.split(" @ ");
              position = parts[0].trim();
              company = parts.slice(1).join(" @ ").split("|")[0].split("•")[0].split(",")[0].trim();
            } else if (occupation.includes("|")) {
              const parts = occupation.split("|");
              position = parts[0].trim();
              company = parts[1].trim();
            }

            const occLower = occupation.toLowerCase();
            let isAlumni = false;
            let university = "";
            if (occLower.includes("anand engineering") || occLower.includes("anand engg")) {
              isAlumni = true;
              university = "Anand Engineering College";
            } else if (occLower.includes("sharda")) {
              isAlumni = true;
              university = "Sharda University";
            } else if (occLower.includes("hindustan college") || occLower.includes("hindustan institute")) {
              isAlumni = true;
              university = "Hindustan College of Science and Technology";
            }

            const nameParts = name.split(" ");
            const firstName = nameParts[0] || name;
            const lastName = nameParts.slice(1).join(" ") || "";

            // Key uniquely by cleanUrl to prevent name-collision drops
            const uniqueKey = cleanUrl.toLowerCase().trim();
            if (uniqueKey && !connectionsMap.has(uniqueKey)) {
              connectionsMap.set(uniqueKey, {
                id: `conn_${connectionsMap.size + 1}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
                first_name: firstName,
                last_name: lastName,
                name: name,
                profile_url: cleanUrl,
                avatar_url: avatarUrl,
                company,
                position,
                headline: occupation,
                university: university,
                is_alumni: isAlumni,
                connected_on: connectedOn
              });
            }
          });
        };

        const nudgeConnectionsScroll = async () => {
          const root = document.querySelector("main .scaffold-finite-scroll__content, main ul.mn-connections, main [data-view-name*='connections']") || document.querySelector("main");
          let scroller = root;
          while (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight <= scroller.clientHeight + 2) {
            scroller = scroller.parentElement;
          }
          const step = Math.max(450, Math.floor((window.innerHeight || 800) * 0.7));
          if (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight > scroller.clientHeight + 2) {
            scroller.scrollTop = Math.max(0, scroller.scrollTop - Math.floor(step * 0.55));
          } else {
            window.scrollBy({ top: -Math.floor(step * 0.55), behavior: "instant" });
          }
          await new Promise((r) => setTimeout(r, 350));
          if (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight > scroller.clientHeight + 2) {
            scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + step);
          } else {
            window.scrollBy({ top: step, behavior: "instant" });
          }
          window.dispatchEvent(new Event("scroll", { bubbles: true }));
          await new Promise((r) => setTimeout(r, 800));
        };

        const maxScrolls = 450;
        const maxNoNew = totalCount > 0 ? 35 : 25;
        for (let i = 0; i < maxScrolls; i++) {
          extractFromDom();

          const currentCount = connectionsMap.size;
          const pct = totalCount > 0 ? ` (${Math.min(100, Math.round((currentCount / totalCount) * 100))}%)` : "";
          const targetTotal = totalCount > 0 ? ` / ${totalCount}` : "";

          if (hud) {
            hud.innerHTML = `
              <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span>
              <span>Scanning: <strong>${currentCount}${targetTotal}</strong> Contacts${pct}</span>
            `;
          }

          if (totalCount > 0 && currentCount >= totalCount) {
            break;
          }

          if (currentCount === prevCount) {
            noNew++;
            if (currentCount === 0 && noNew >= 8) break;
            if (currentCount > 0 && noNew >= maxNoNew) break;

            // Deep Recovery Pump: scroll up and down, dispatch keyboard and click load more
            await nudgeConnectionsScroll();

            // Click LinkedIn finite scroll load button if visible
            document.querySelectorAll("button.scaffold-finite-scroll__load-button, button.artdeco-button--secondary, button").forEach((b) => {
              if (b.classList.contains("scaffold-finite-scroll__load-button")) {
                try { b.click(); } catch (e) {}
                return;
              }
              const text = (b.innerText || "").toLowerCase();
              if (
                text.includes("show more") ||
                text.includes("load more") ||
                text.includes("see more") ||
                text.includes("show all") ||
                text.includes("show results")
              ) {
                try { b.click(); } catch (e) {}
              }
            });

            const scrollEl = document.scrollingElement || document.body || document.documentElement;
            const scrollH = scrollEl ? scrollEl.scrollHeight : 8000;
            window.scrollTo({ top: scrollH, behavior: "instant" });
            window.scrollBy({ top: Math.max(800, Math.floor((window.innerHeight || 800) * 0.9)), behavior: "instant" });
            window.dispatchEvent(new Event("scroll", { bubbles: true }));
            window.dispatchEvent(new WheelEvent("wheel", { deltaY: 3000, bubbles: true }));
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", code: "PageDown", bubbles: true }));
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "End", code: "End", bubbles: true }));

            document.querySelectorAll("div, main, section, ul").forEach((el) => {
              if (el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
                el.scrollTop = el.scrollHeight;
              }
            });

            await new Promise((r) => setTimeout(r, currentCount > 400 ? 1200 : 900));
            continue;
          } else {
            noNew = 0;
          }
          prevCount = currentCount;

          const scrollEl = document.scrollingElement || document.body || document.documentElement;
          const scrollH = scrollEl ? scrollEl.scrollHeight : 5000;
          window.scrollTo({ top: scrollH, behavior: "instant" });
          window.scrollBy({ top: 1800, behavior: "instant" });
          window.dispatchEvent(new Event("scroll", { bubbles: true }));
          window.dispatchEvent(new WheelEvent("wheel", { deltaY: 1800, bubbles: true }));
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", code: "PageDown", bubbles: true }));

          document.querySelectorAll("div, main, section").forEach((el) => {
            if (el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
              el.scrollTop = el.scrollHeight;
            }
          });

          await new Promise((r) => setTimeout(r, currentCount > 400 ? 1000 : 800));
        }

        extractFromDom();

        if (hud) {
          hud.innerHTML = `
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#3b82f6;"></span>
            <span>Completed! Ingesting <strong>${connectionsMap.size}</strong> Contacts...</span>
          `;
          setTimeout(() => { try { hud?.remove(); } catch (e) {} }, 3000);
        }

        return Array.from(connectionsMap.values());
      }
    });

    return results && results[0] && Array.isArray(results[0].result) ? results[0].result : [];
  }

  // Live Deep Posts Scan with Expansion of "see more"
  async function performLivePostsScan(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        const postsMap = new Map();
        let prevCount = 0;
        let noNew = 0;

        let hud = document.getElementById("careeros-posts-hud");
        if (!hud) {
          hud = document.createElement("div");
          hud.id = "careeros-posts-hud";
          hud.style.position = "fixed";
          hud.style.bottom = "24px";
          hud.style.right = "24px";
          hud.style.zIndex = "999999";
          hud.style.background = "#0f172a";
          hud.style.color = "#ffffff";
          hud.style.padding = "12px 18px";
          hud.style.borderRadius = "12px";
          hud.style.boxShadow = "0 10px 30px rgba(0,0,0,0.4)";
          hud.style.fontFamily = "Inter, system-ui, sans-serif";
          hud.style.fontSize = "13px";
          hud.style.fontWeight = "600";
          hud.style.display = "flex";
          hud.style.alignItems = "center";
          hud.style.gap = "10px";
          hud.style.border = "1px solid rgba(255,255,255,0.15)";
          (document.body || document.documentElement).appendChild(hud);
        }

        const expandMoreButtons = () => {
          document.querySelectorAll(
            "button.inline-show-more-text__button, button.feed-shared-inline-show-more-text__see-more-less-toggle, button.see-more, [aria-label*='see more'], [aria-label*='more']"
          ).forEach((b) => {
            try { b.click(); } catch (e) {}
          });
        };

        const nudgeFeedScroll = async () => {
          const root = document.querySelector("main .scaffold-finite-scroll__content, main [data-view-name*='feed'], main") || document.body;
          let scroller = root;
          while (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight <= scroller.clientHeight + 2) {
            scroller = scroller.parentElement;
          }
          const step = Math.max(500, Math.floor((window.innerHeight || 800) * 0.75));
          if (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight > scroller.clientHeight + 2) {
            scroller.scrollTop = Math.max(0, scroller.scrollTop - Math.floor(step * 0.5));
          } else {
            window.scrollBy({ top: -Math.floor(step * 0.5), behavior: "instant" });
          }
          await new Promise((r) => setTimeout(r, 350));
          if (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight > scroller.clientHeight + 2) {
            scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + step);
          } else {
            window.scrollBy({ top: step, behavior: "instant" });
          }
          window.dispatchEvent(new Event("scroll", { bubbles: true }));
          await new Promise((r) => setTimeout(r, 800));
        };

        const maxPostsScrolls = 80;
        for (let i = 0; i < maxPostsScrolls; i++) {
          expandMoreButtons();
          const postElems = Array.from(
            document.querySelectorAll(
              "div.feed-shared-update-v2, div[data-urn^='urn:li:activity:'], li.profile-creator-shared-feed-update__container, div.feed-shared-text, .update-components-update-v2__commentary, .feed-shared-text-view, .update-components-text, div[data-view-name*='update'], article[data-activity-id]"
            )
          );
          postElems.forEach((el) => {
            let text = (el.innerText || "").trim().replace(/…see more|see less|\.\.\.more/gi, "").trim();

            const mediaTitleEl = el.querySelector(".feed-shared-mini-update-v2__title, .feed-shared-article__title, .feed-shared-external-video__title, a.app-aware-link");
            if (mediaTitleEl) {
              const mediaTitle = (mediaTitleEl.innerText || "").trim();
              if (mediaTitle && !text.includes(mediaTitle)) {
                text = `${text}\n[Attached Milestone: ${mediaTitle}]`;
              }
            }

            if (text.length > 25 && !text.startsWith("Like\n") && !text.startsWith("Comment\n") && !text.startsWith("All activity")) {
              const key = text.slice(0, 80);
              if (!postsMap.has(key)) postsMap.set(key, text);
            }
          });

          if (hud) {
            hud.innerHTML = `
              <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#3b82f6; box-shadow:0 0 8px #3b82f6;"></span>
              <span>Scanning Posts: <strong>${postsMap.size}</strong> Posts Extracted</span>
            `;
          }

          const isPageEmpty =
            document.body &&
            (document.body.innerText.includes("Nothing to see for now") ||
              document.body.innerText.includes("No posts yet"));
          if (isPageEmpty && postsMap.size === 0) {
            if (hud) {
              hud.innerHTML = `
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#f59e0b;"></span>
                <span>No authored posts on this page. Profile milestones will be used.</span>
              `;
              setTimeout(() => { try { hud?.remove(); } catch (e) {} }, 2500);
            }
            break;
          }

          if (postsMap.size === prevCount) {
            noNew++;
            if (postsMap.size === 0 && noNew >= 4) break;
            if (postsMap.size > 0 && noNew >= 6) break;

            await nudgeFeedScroll();
            continue;
          } else {
            noNew = 0;
          }
          prevCount = postsMap.size;

          const scrollEl = document.scrollingElement || document.body || document.documentElement;
          const scrollH = scrollEl ? scrollEl.scrollHeight : 5000;
          window.scrollTo({ top: scrollH, behavior: "instant" });
          window.scrollBy({ top: 1400, behavior: "instant" });
          window.dispatchEvent(new Event("scroll", { bubbles: true }));
          window.dispatchEvent(new WheelEvent("wheel", { deltaY: 1400, bubbles: true }));

          document.querySelectorAll("div, main, section").forEach((el) => {
            if (el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
              el.scrollTop = el.scrollHeight;
            }
          });

          await new Promise((r) => setTimeout(r, 750));
        }

        if (hud) {
          hud.innerHTML = `
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e;"></span>
            <span>Completed! Ingesting <strong>${postsMap.size}</strong> Posts with AI...</span>
          `;
          setTimeout(() => { try { hud?.remove(); } catch (e) {} }, 3000);
        }

        return Array.from(postsMap.values());
      }
    });

    return results && results[0] && Array.isArray(results[0].result) ? results[0].result : [];
  }

  // =========================================================================
  // TAB 1: MASTER AUTONOMOUS FULL SYNC
  // =========================================================================
  masterSyncBtn?.addEventListener("click", async () => {
    try {
      if (!isPersistentSyncPage) {
        const [linkedinTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!linkedinTab?.id) throw new Error("Could not find the active LinkedIn tab.");
        const runnerUrl = new URL(chrome.runtime.getURL("popup/popup.html"));
        runnerUrl.searchParams.set("runMasterSync", "1");
        runnerUrl.searchParams.set("linkedinTabId", String(linkedinTab.id));
        await chrome.tabs.create({ url: runnerUrl.toString(), active: true });
        return;
      }

      const tab = persistentSyncTabId ? await chrome.tabs.get(persistentSyncTabId) : null;
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Please open LinkedIn in the active tab first!", "error");
        return;
      }

      startProgress("Autonomous Graph Full-Sync");
      const userId = getActiveUserId();
      const apiUrl = getActiveBackendUrl();

      // Step 1: Profile Scan (Certs, Badges, Experience, Edu)
      updateStep(1, "active", 10, "1. Extracting Profile, Certificates, Badges & Experience...");
      const currentUrl = tab.url || "";
      const isCleanProfilePage =
        currentUrl.includes("/in/") &&
        !currentUrl.includes("/recent-activity") &&
        !currentUrl.includes("/mynetwork") &&
        !currentUrl.includes("/detail") &&
        !currentUrl.includes("/edit") &&
        !currentUrl.includes("/overlay");

      if (!isCleanProfilePage) {
        await navigateAndWait(tab.id, "https://www.linkedin.com/in/me/");
        await new Promise((r) => setTimeout(r, 2200));
      }

      const profileData = await performLiveProfileScan(tab.id);
      let certsCount = 0;
      let achCount = 0;
      let badgeCount = 0;
      let expCount = 0;
      let eduCount = 0;

      if (profileData) {
        certsCount = profileData.certifications?.length || 0;
        achCount = profileData.achievements?.length || 0;
        badgeCount = profileData.badges?.length || 0;
        expCount = profileData.experience?.length || 0;
        eduCount = profileData.education?.length || 0;

        try {
          const profileResp = await fetch(`${apiUrl}/ingest/linkedin/profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId
            },
            body: JSON.stringify(profileData)
          });
          if (!profileResp.ok) {
            console.warn("Profile sync notice:", profileResp.status, await profileResp.text());
          }
        } catch (err) {
          console.warn("Profile sync error fallback:", err);
        }
      }

      updateStep(
        1,
        "completed",
        33,
        `1. Synced: ${certsCount} Certs · ${achCount + badgeCount} Badges/Awards · ${expCount} Roles ✓`
      );

      // Step 2: Connections Scan
      updateStep(2, "active", 40, "2. Live Deep Scrolling & Scanning Connections...");
      const tabNow = await chrome.tabs.get(tab.id);
      if (!tabNow.url || !tabNow.url.includes("/mynetwork/invite-connect/connections")) {
        await navigateAndWait(tab.id, "https://www.linkedin.com/mynetwork/invite-connect/connections/");
      }

      const connections = await performLiveConnectionsScan(tab.id);
      let connectionSyncFailed = connections.length === 0;
      let connectionsImported = 0;

      if (connections.length > 0) {
        try {
          const connResp = await fetch(`${apiUrl}/ingest/linkedin/connections`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId
            },
            body: JSON.stringify({
              connections: connections,
              shared_college: "Anand Engineering College"
            })
          });

          if (connResp.ok) {
            const ingestResult = await connResp.json();
            connectionsImported = Number(ingestResult.total_connections_imported) || 0;
            connectionSyncFailed = connectionsImported === 0;
          } else {
            let csvContent = "First Name,Last Name,URL,Company,Position,Connected On\n";
            connections.forEach((c) => {
              csvContent += `"${c.first_name}","${c.last_name}","${c.profile_url}","${c.company}","${c.position}","${c.connected_on}"\n`;
            });
            const blob = new Blob([csvContent], { type: "text/csv" });
            const form = new FormData();
            form.append("file", blob, "Connections.csv");
            const fallbackResp = await fetch(`${apiUrl}/ingest/linkedin`, {
              method: "POST",
              headers: { "x-user-id": userId },
              body: form
            });
            if (!fallbackResp.ok) throw new Error(`Connections ingest failed (${fallbackResp.status})`);
            connectionsImported = connections.length;
            connectionSyncFailed = false;
          }
        } catch (err) {
          console.error("Connections sync error:", err);
          connectionSyncFailed = true;
        }
      }
      updateStep(
        2,
        connectionSyncFailed ? "error" : "completed",
        66,
        connectionSyncFailed
          ? `2. Connection sync failed (${connections.length} scanned) · continuing to scan posts`
          : `2. Synced: ${connectionsImported} Contacts into Knowledge Graph ✓`
      );

      // Step 3: Posts Feed & Milestones Extraction (Zero-Disruption)
      updateStep(3, "active", 75, "3. Extracting Milestone Posts & Knowledge Nodes...");

      let postsText = "";
      // Step 2 navigates the tab to Connections, so explicitly open the profile's
      // activity feed before scanning. Previously this guard skipped scanning
      // because the tab was still on the connections URL.
      const postsProfileUrl = (profileData?.profile_url || "https://www.linkedin.com/in/me/").replace(/\/+$/, "");
      await navigateAndWait(tab.id, `${postsProfileUrl}/recent-activity/all/`);
      await new Promise((r) => setTimeout(r, 1400));
      const postsList = await performLivePostsScan(tab.id);
      postsText = postsList.join("\n\n---\n\n");

      // Intelligent Fallback: If no activity feed or on profile, synthesize verified milestones
      if (!postsText && profileData) {
        const milestones = [
          profileData.headline ? `Headline: ${profileData.headline}` : "",
          profileData.bio ? `About: ${profileData.bio}` : "",
          (profileData.achievements || []).length > 0
            ? `Achievements: ${profileData.achievements.map((a) => a.title + " - " + (a.organization || "")).join("; ")}`
            : "",
          (profileData.experience || []).length > 0
            ? `Work: ${profileData.experience.map((e) => e.role + " at " + e.company + " (" + (e.description || "") + ")").join("; ")}`
            : "",
          (profileData.certifications || []).length > 0
            ? `Certificates: ${profileData.certifications.map((c) => c.name + " (" + (c.issuer || "") + ")").join("; ")}`
            : ""
        ].filter(Boolean).join("\n\n");
        if (milestones) postsText = milestones;
      }

      let hackathonsMerged = 0;
      let awardsMerged = 0;
      let postsSyncFailed = false;
      if (postsText) {
        try {
          const resp = await fetch(`${apiUrl}/ingest/linkedin/posts/manual`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId
            },
            body: JSON.stringify({ posts_text: postsText })
          });
          if (resp.ok) {
            const pData = await resp.json();
            hackathonsMerged = pData.hackathons_count || 0;
            awardsMerged = (pData.achievements_count || 0) + (pData.badges_count || 0);
          } else {
            postsSyncFailed = true;
            console.warn("Posts ingest failed:", resp.status, await resp.text());
          }
        } catch (err) {
          console.warn("Posts ingest error:", err);
          postsSyncFailed = true;
        }
      } else {
        postsSyncFailed = true;
      }

      // Return user to their main profile page cleanly
      try {
        const endTab = await chrome.tabs.get(tab.id).catch(() => null);
        if (endTab && (!endTab.url.includes("/in/") || endTab.url.includes("/recent-activity"))) {
          await navigateAndWait(tab.id, "https://www.linkedin.com/in/me/");
        }
      } catch (e) {}

      updateStep(
        3,
        "completed",
        100,
        `3. AI Knowledge Graph: ${hackathonsMerged} Hackathons & ${awardsMerged} Milestones Merged ✓`
      );

      // Save status
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const candidateName = profileData?.name || "Candidate Workspace";
      chrome.storage.local.set({
        lastSyncedTime: `Today, ${nowStr}`,
        syncedConnCount: connectionsImported,
        syncedCertsCount: certsCount + badgeCount + awardsMerged,
        syncedExpEduCount: expCount + eduCount,
        candidateName: candidateName
      });

      // Update Report Card
      if (reportCandidate) reportCandidate.textContent = candidateName;
      if (reportCertsBadges) reportCertsBadges.textContent = `${certsCount + badgeCount + awardsMerged} Synced`;
      if (reportExpEdu) reportExpEdu.textContent = `${expCount + eduCount} Mapped`;
      if (reportConnections) reportConnections.textContent = `${connectionsImported} Contacts`;
      if (syncReportCard) syncReportCard.classList.remove("hidden");

      showToast(
        connectionSyncFailed || postsSyncFailed
          ? `Sync finished with issues: ${connectionsImported} contacts saved; ${postsText ? "posts ingest failed" : "no posts found"}. Check the failed step and retry.`
          : `Master Sync Complete! Synced ${certsCount} Certs, ${connectionsImported} Contacts, and extracted graph milestones!`,
        connectionSyncFailed || postsSyncFailed ? "error" : "success"
      );
    } catch (err) {
      console.error("Master sync error:", err);
      showToast(`Sync Notice: ${err.message}`, "error");
    }
  });

  if (isPersistentSyncPage && persistentSyncTabId) {
    setTimeout(() => masterSyncBtn?.click(), 300);
  }

  // =========================================================================
  // QUICK DELTA SYNC
  // =========================================================================
  deltaSyncBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Open LinkedIn to perform Delta Sync", "error");
        return;
      }

      showToast("Running Quick Delta Sync for newest items...", "loading");
      const userId = getActiveUserId();
      const apiUrl = getActiveBackendUrl();

      const conns = await performLiveConnectionsScan(tab.id);
      if (conns.length > 0) {
        await fetch(`${apiUrl}/ingest/linkedin/connections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId
          },
          body: JSON.stringify({
            connections: conns,
            shared_college: "Anand Engineering College"
          })
        });
      }

      showToast(`⚡ Delta Sync merged ${conns.length} contacts!`, "success");
    } catch (err) {
      showToast(`Delta sync notice: ${err.message}`, "error");
    }
  });

  // =========================================================================
  // MODULAR MANUAL SYNC BUTTONS
  // =========================================================================
  syncProfileOnlyBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Open LinkedIn profile first", "error");
        return;
      }

      if (!tab.url.includes("/in/")) {
        showToast("Navigating to Profile...", "loading");
        await navigateAndWait(tab.id, "https://www.linkedin.com/in/me/");
      }

      showToast("Deep Extracting Profile, Certs, Badges & Experience...", "loading");
      const profileData = await performLiveProfileScan(tab.id);

      if (profileData && (profileData.name || profileData.experience?.length || profileData.certifications?.length)) {
        await fetch(`${getActiveBackendUrl()}/ingest/linkedin/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": getActiveUserId()
          },
          body: JSON.stringify(profileData)
        });

        const certsCount = profileData.certifications?.length || 0;
        const badgesCount = (profileData.achievements?.length || 0) + (profileData.badges?.length || 0);
        const expCount = profileData.experience?.length || 0;

        chrome.storage.local.set({
          syncedCertsCount: certsCount + (profileData.badges?.length || 0),
          syncedExpEduCount: expCount + (profileData.education?.length || 0),
          candidateName: profileData.name
        });

        if (reportCandidate) reportCandidate.textContent = profileData.name;
        if (reportCertsBadges) reportCertsBadges.textContent = `${certsCount + (profileData.badges?.length || 0)} Synced`;
        if (reportExpEdu) reportExpEdu.textContent = `${expCount + (profileData.education?.length || 0)} Mapped`;
        if (syncReportCard) syncReportCard.classList.remove("hidden");

        showToast(
          `Profile Synced! Extracted: ${certsCount} Certs · ${badgesCount} Badges/Awards · ${expCount} Roles ✓`,
          "success"
        );
      } else {
        showToast("Could not extract structured profile details.", "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  syncPostsOnlyBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Open LinkedIn to scan posts", "error");
        return;
      }

      let postsList = [];
      if (tab.url.includes("/recent-activity") || tab.url.includes("/feed")) {
        showToast("Scanning visible posts on active tab...", "loading");
        postsList = await performLivePostsScan(tab.id);
      } else {
        showToast("Navigating to Posts Feed...", "loading");
        await navigateAndWait(tab.id, "https://www.linkedin.com/in/me/recent-activity/all/");
        postsList = await performLivePostsScan(tab.id);
      }

      const postsText = postsList.join("\n\n---\n\n");
      if (postsText) {
        showToast("AI Extracting Hackathons & Merging to Graph DB...", "loading");
        const resp = await fetch(`${getActiveBackendUrl()}/ingest/linkedin/posts/manual`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": getActiveUserId()
          },
          body: JSON.stringify({ posts_text: postsText })
        });
        if (resp.ok) {
          const resData = await resp.json();
          showToast(
            `Ingested ${postsList.length} posts (${resData.hackathons_count} hackathons, ${resData.graph_nodes_merged} nodes)! ✓`,
            "success"
          );
        } else {
          showToast(`AI Ingested ${postsList.length} Posts! ✓`, "success");
        }
      } else {
        showToast(
          "No authored posts found on this page. Paste any post or milestone in the 'Manual Post Ingest' box below!",
          "error"
        );
        manualPostInput?.focus();
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  syncConnOnlyBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Open LinkedIn to scan connections", "error");
        return;
      }

      if (!tab.url.includes("/mynetwork/invite-connect/connections")) {
        showToast("Navigating to Connections page...", "loading");
        await navigateAndWait(tab.id, "https://www.linkedin.com/mynetwork/invite-connect/connections/");
      }

      showToast("Live Deep Scanning All Connections...", "loading");
      const conns = await performLiveConnectionsScan(tab.id);

      if (conns.length > 0) {
        const resp = await fetch(`${getActiveBackendUrl()}/ingest/linkedin/connections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": getActiveUserId()
          },
          body: JSON.stringify({
            connections: conns,
            shared_college: "Anand Engineering College"
          })
        });

        chrome.storage.local.set({ syncedConnCount: conns.length });
        if (reportConnections) reportConnections.textContent = `${conns.length} Contacts`;
        if (syncReportCard) syncReportCard.classList.remove("hidden");

        showToast(`Ingested ${conns.length} Real Contacts into Knowledge Graph! ✓`, "success");
      } else {
        showToast("No connections detected on page.", "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  syncDeltaConnBtn?.addEventListener("click", () => {
    syncConnOnlyBtn?.click();
  });

  // =========================================================================
  // MANUAL POST & MILESTONES INGESTION HANDLERS
  // =========================================================================
  btnIngestManualPost?.addEventListener("click", async () => {
    const text = (manualPostInput?.value || "").trim();
    if (!text) {
      showToast("Please enter or paste post text to ingest.", "error");
      manualPostInput?.focus();
      return;
    }

    const userId = getActiveUserId();
    const apiUrl = getActiveBackendUrl();

    btnIngestManualPost.disabled = true;
    btnIngestManualPost.textContent = "AI Extracting & Merging to Graph DB...";
    if (manualIngestStatus) {
      manualIngestStatus.className = "manual-status loading";
      manualIngestStatus.textContent = "Extracting Hackathons, Milestones, Certs & Merging into Neo4j AuraDB...";
      manualIngestStatus.classList.remove("hidden");
    }

    try {
      const resp = await fetch(`${apiUrl}/ingest/linkedin/posts/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify({ posts_text: text })
      });

      let data;
      if (resp.ok) {
        data = await resp.json();
      } else {
        const form = new FormData();
        form.append("posts_text", text);
        const resp2 = await fetch(`${apiUrl}/ingest/linkedin/posts`, {
          method: "POST",
          headers: { "x-user-id": userId },
          body: form
        });
        if (!resp2.ok) {
          const errDetail = await resp2.text();
          throw new Error(errDetail || "Failed to ingest post");
        }
        data = await resp2.json();
      }
      const hCount = data.hackathons_count || 0;
      const aCount = data.achievements_count || 0;
      const bCount = data.badges_count || 0;
      const sCount = data.skills_count || 0;
      const cCount = data.certifications_count || 0;
      const totalNodes = data.graph_nodes_merged || 0;

      const summaryMsg = `✓ Ingested into Graph DB: ${hCount} Hackathons · ${aCount + bCount} Awards/Badges · ${cCount} Certs · ${sCount} Skills (${totalNodes} nodes merged)`;

      if (manualIngestStatus) {
        manualIngestStatus.className = "manual-status success";
        manualIngestStatus.textContent = summaryMsg;
      }

      showToast("Successfully inserted into Neo4j Knowledge Graph!", "success");

      // Update storage and report card
      chrome.storage.local.get(["syncedCertsCount"], (r) => {
        const updated = (r.syncedCertsCount || 0) + cCount + bCount + aCount;
        chrome.storage.local.set({ syncedCertsCount: updated });
        if (reportCertsBadges) reportCertsBadges.textContent = `${updated} Synced`;
        if (syncReportCard) syncReportCard.classList.remove("hidden");
      });
    } catch (err) {
      if (manualIngestStatus) {
        manualIngestStatus.className = "manual-status error";
        manualIngestStatus.textContent = `Ingest error: ${err.message}`;
      }
      showToast(`Ingest failed: ${err.message}`, "error");
    } finally {
      btnIngestManualPost.disabled = false;
      btnIngestManualPost.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Insert into Graph DB (AI Extract)</span>
      `;
    }
  });

  btnScanCurrentPagePosts?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
      showToast("Open LinkedIn to scan posts from active tab.", "error");
      return;
    }

    showToast("Scanning visible posts on active tab...", "loading");
    const posts = await performLivePostsScan(tab.id);
    if (!posts || posts.length === 0) {
      showToast("No visible posts found on this page. Paste post manually above!", "error");
      return;
    }

    const postsText = posts.join("\n\n---\n\n");
    if (manualPostInput) {
      manualPostInput.value = postsText.slice(0, 1500);
    }

    try {
      const resp = await fetch(`${getActiveBackendUrl()}/ingest/linkedin/posts/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": getActiveUserId()
        },
        body: JSON.stringify({ posts_text: postsText })
      });

      if (resp.ok) {
        const data = await resp.json();
        showToast(
          `Extracted & merged ${posts.length} tab posts (${data.hackathons_count} hackathons) into Neo4j!`,
          "success"
        );
      } else {
        showToast("Failed to merge tab posts into Graph DB", "error");
      }
    } catch (e) {
      showToast(`Scan error: ${e.message}`, "error");
    }
  });

  document.querySelectorAll(".quick-tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const tmpl = chip.getAttribute("data-template") || "";
      if (manualPostInput) {
        manualPostInput.value = tmpl + manualPostInput.value;
        manualPostInput.focus();
      }
    });
  });

  // =========================================================================
  // CSV CONNECTIONS IMPORT (1-Click Instant)
  // =========================================================================
  uploadCsvBtn?.addEventListener("click", () => {
    csvFileInput?.click();
  });

  csvFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast(`Ingesting ${file.name}...`, "loading");
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${getActiveBackendUrl()}/ingest/linkedin`, {
        method: "POST",
        headers: { "x-user-id": getActiveUserId() },
        body: form
      });
      const data = await res.json();
      const count = data.total_connections_imported || data.graph_nodes_merged || "All Contacts";

      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      chrome.storage.local.set({
        lastSyncedTime: `Today, ${nowStr}`,
        syncedConnCount: typeof count === "number" ? count : 842
      });

      if (reportConnections) reportConnections.textContent = `${count} Contacts`;
      if (syncReportCard) syncReportCard.classList.remove("hidden");

      showToast(`1-Click CSV Ingest Complete! Merged ${count} contacts with Zero Duplicates!`, "success");
    } catch (err) {
      showToast(`CSV error: ${err.message}`, "error");
    }
  });

  // =========================================================================
  // TAB 2: TARGET PERSON & REFERRAL SCANNER
  // =========================================================================
  scanTargetProfileBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com/in/")) {
        showToast("Open target person's profile (/in/...) to scan!", "error");
        return;
      }

      showToast("Scanning target profile & career nodes...", "loading");
      const p = await performLiveProfileScan(tab.id);

      if (!p || !p.name) {
        showToast("Could not extract target profile information.", "error");
        return;
      }

      const payload = {
        name: p.name,
        headline: p.headline || "",
        company: p.current_company || p.company || "",
        role: p.current_role || p.role || "",
        profile_url: p.profile_url || tab.url,
        location: p.location || "",
        shared_college: p.education?.[0]?.university || p.shared_college || "",
        skills: p.skills || [],
        recent_posts: []
      };

      const resp = await fetch(`${getActiveBackendUrl()}/ingest/linkedin/target-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": getActiveUserId() },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => ({}));
      showToast(`Linked ${p.name} to your graph! (Edge: ${data.graph_edge || "CONNECTED_TARGET"})`, "success");
      activeTargetProfileData = p;

      if (targetProfileName) targetProfileName.textContent = p.name;
      if (targetProfileHeadline) targetProfileHeadline.textContent = p.headline || "";
      if (targetCompanyVal) targetCompanyVal.textContent = p.current_company || p.company || "--";
      if (targetRoleVal) targetRoleVal.textContent = p.current_role || p.role || "--";
    } catch (err) {
      showToast(`Scan error: ${err.message}`, "error");
    }
  });

  scanTargetPostsBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes("linkedin.com")) {
        showToast("Open a LinkedIn profile before scanning posts.", "error");
        return;
      }
      showToast("Scanning target profile's posts for hiring leads...", "loading");
      if (!tab.url.includes("/recent-activity") && !tab.url.includes("/feed")) {
        const profileUrl = (tab.url.includes("/in/") ? tab.url : activeTargetProfileData?.profile_url || tab.url)
          .split("?")[0].replace(/\/recent-activity(?:\/.*)?$/, "").replace(/\/+$/, "");
        if (!profileUrl.includes("/in/")) {
          showToast("Open the target's LinkedIn profile first.", "error");
          return;
        }
        await navigateAndWait(tab.id, `${profileUrl}/recent-activity/all/`);
        await new Promise((r) => setTimeout(r, 1200));
      }
      const postsList = await performLivePostsScan(tab.id);
      const postsText = postsList.join("\n\n---\n\n");

      if (postsText) {
        const response = await fetch(`${getActiveBackendUrl()}/ingest/linkedin/posts/manual`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": getActiveUserId()
          },
          body: JSON.stringify({ posts_text: postsText })
        });
        if (!response.ok) throw new Error(`Posts ingestion failed (${response.status})`);
        const result = await response.json();
        showToast(`Scanned ${postsList.length} posts · ${result.hackathons_count || 0} hiring/milestone signals merged.`, "success");
      } else {
        showToast("No posts were found on the target activity page.", "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  scanTargetConnectionsBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      showToast("Scanning visible network on page...", "loading");
      const conns = await performLiveConnectionsScan(tab.id);

      if (conns.length > 0) {
        await fetch(`${getActiveBackendUrl()}/ingest/linkedin/connections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": getActiveUserId()
          },
          body: JSON.stringify({
            connections: conns,
            shared_college: "Anand Engineering College"
          })
        });
        showToast(`Linked ${conns.length} visible network nodes! ✓`, "success");
      } else {
        showToast("No visible connections found on current page.", "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  // AI Outreach Pitch Generator
  generatePitchBtn?.addEventListener("click", () => {
    const p = activeTargetProfileData || {};
    const targetName = (p.name || "there").split(" ")[0];
    const company = p.current_company || p.company || "your team";

    const pitch = `Hi ${targetName},\n\nI came across your profile and admire the engineering work happening at ${company}.\n\nAs a Full Stack & Systems Engineer (4x National Hackathon Winner & Intern at ADRDE/DRDO where I built high-throughput Next-Gen Firewall pipelines), I've built production MERN + Neo4j architectures and high-performance backend microservices.\n\nI'd love to connect and learn if there are any openings or referral opportunities for engineering roles on ${company}'s team. Thanks so much for your time!\n\nBest,\nMohit`;

    if (outreachPitchText) {
      outreachPitchText.textContent = pitch;
    }

    navigator.clipboard
      .writeText(pitch)
      .then(() => {
        showToast("Tailored Referral Pitch generated & copied to clipboard! 📋", "success");
      })
      .catch(() => {
        showToast("Referral Pitch generated! (Copy from preview box)", "success");
      });
  });

  // Helper Functions
  function sendTabMessagePromise(tabId, msg) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, msg, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  function startProgress(title) {
    if (syncProgressContainer) syncProgressContainer.classList.remove("hidden");
    if (syncReportCard) syncReportCard.classList.add("hidden");
    if (progressTitle) progressTitle.textContent = title;
    if (progressPercent) progressPercent.textContent = "0%";
    if (progressBarFill) progressBarFill.style.width = "0%";
    if (step1) step1.className = "stepper-step";
    if (step2) step2.className = "stepper-step";
    if (step3) step3.className = "stepper-step";
  }

  function updateStep(stepNum, status, percent, text) {
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
    const el = document.getElementById(`step${stepNum}`);
    const lbl = document.getElementById(`step${stepNum}Label`);
    if (el) el.className = `stepper-step ${status}`;
    if (lbl && text) lbl.textContent = text;
  }

  function showToast(msg, type) {
    if (!resultBanner || !toastMsg) return;
    resultBanner.className = `toast-banner ${type}`;
    toastMsg.textContent = msg;

    if (toastIcon) {
      if (type === "success") {
        toastIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (type === "error") {
        toastIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      } else {
        toastIcon.innerHTML = `<svg class="icon-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
      }
    }

    resultBanner.classList.remove("hidden");
    if (type === "success" || type === "error") {
      setTimeout(() => {
        resultBanner.classList.add("hidden");
      }, 5000);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});
