const PROD_API_URL = "https://careerosv5.onrender.com/api/v1";
const LOCAL_API_URL = "http://localhost:8000/api/v1";

async function getApiBase() {
  try {
    const stored = await chrome.storage.local.get(["apiUrl"]);
    if (stored.apiUrl) return stored.apiUrl;
    
    // Auto-probe localhost with 800ms timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${LOCAL_API_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return LOCAL_API_URL;
  } catch (e) {
    // Fall back to production
  }
  return PROD_API_URL;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("CareerOS Extension Installed & Ready.");
  chrome.storage.local.set({
    apiUrl: PROD_API_URL
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    const apiBase = await getApiBase();
    if (request.action === "HEALTH_CHECK") {
      fetch(`${apiBase}/health/`)
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data, apiBase }))
        .catch(err => sendResponse({ success: false, error: err.message, apiBase }));
    }
  })();
  return true;
});

  if (request.action === "INGEST_POSTS_TEXT") {
    const formData = new FormData();
    formData.append("posts_text", request.postsText);

    fetch(`${API_BASE_URL}/ingest/linkedin/posts`, {
      method: "POST",
      headers: {
        "x-user-id": request.userId || "dev-user-0000-0000-0000-000000000001"
      },
      body: formData
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "ANALYZE_JOB") {
    fetch(`${API_BASE_URL}/matches/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": request.userId || "dev-user-0000-0000-0000-000000000001"
      },
      body: JSON.stringify({
        job_description: request.jobDescription,
        company_override: request.company,
        role_override: request.title
      })
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
