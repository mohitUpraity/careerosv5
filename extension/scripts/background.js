/**
 * CareerOS Background Service Worker
 * Handles network requests to CareerOS Local Engine (http://localhost:8000).
 */

const API_BASE_URL = "http://localhost:8000/api/v1";

chrome.runtime.onInstalled.addListener(() => {
  console.log("CareerOS Extension Installed & Ready.");
  chrome.storage.local.set({
    activeUserId: "dev-user-0000-0000-0000-000000000001",
    apiUrl: API_BASE_URL
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "HEALTH_CHECK") {
    fetch(`${API_BASE_URL}/health/`)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

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
