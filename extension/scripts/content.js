/**
 * CareerOS Content Script
 * Extracts clean structured information from active LinkedIn pages
 * (Profile, Posts, Connections, Jobs) and communicates with popup / background.
 */

(() => {
  // Listen for extraction requests from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_CURRENT_PAGE") {
      const url = window.location.href;
      
      if (url.includes("/in/")) {
        const profileData = extractProfileData();
        sendResponse({ type: "PROFILE", data: profileData });
      } else if (url.includes("/jobs/view") || url.includes("/jobs/collections")) {
        const jobData = extractJobData();
        sendResponse({ type: "JOB", data: jobData });
      } else if (url.includes("/mynetwork/invite-connect/connections")) {
        const connData = extractConnectionsData();
        sendResponse({ type: "CONNECTIONS", data: connData });
      } else {
        sendResponse({ type: "UNKNOWN", message: "Navigate to a profile, post, connections, or job page." });
      }
    } else if (request.action === "EXTRACT_POSTS") {
      const posts = extractRecentPosts();
      sendResponse({ type: "POSTS", data: posts });
    }
    return true; // Keep message channel open for async response
  });

  function extractProfileData() {
    // 1. Basic Info
    const nameElem = document.querySelector("h1.text-heading-xlarge, h1.top-card-layout__title");
    const name = nameElem ? nameElem.innerText.trim() : "";

    const headlineElem = document.querySelector("div.text-body-medium.break-words, h2.top-card-layout__headline");
    const headline = headlineElem ? headlineElem.innerText.trim() : "";

    const locationElem = document.querySelector("span.text-body-small.inline.t-black--light.break-words");
    const location = locationElem ? locationElem.innerText.trim() : "";

    // 2. About section
    let about = "";
    const aboutSection = document.querySelector("#about ~ div.display-flex, section[data-section='summary']");
    if (aboutSection) {
      about = aboutSection.innerText.trim();
    }

    // 3. Experience section
    const experiences = [];
    const expItems = document.querySelectorAll("#experience ~ div.pvs-list__outer-container > ul > li");
    expItems.forEach(item => {
      const text = item.innerText.trim();
      if (text) {
        experiences.push(text);
      }
    });

    // 4. Education section
    const education = [];
    const eduItems = document.querySelectorAll("#education ~ div.pvs-list__outer-container > ul > li");
    eduItems.forEach(item => {
      const text = item.innerText.trim();
      if (text) {
        education.push(text);
      }
    });

    return {
      name,
      headline,
      location,
      about,
      experiences,
      education,
      raw_text: document.body.innerText.slice(0, 15000)
    };
  }

  function extractRecentPosts() {
    const posts = [];
    // Collect text from feed posts or activity updates
    const postElements = document.querySelectorAll("div.feed-shared-update-v2, div.feed-shared-text, div.update-components-text");
    postElements.forEach(el => {
      const text = el.innerText.trim();
      if (text && text.length > 25) {
        posts.push(text);
      }
    });
    return posts.slice(0, 15);
  }

  function extractConnectionsData() {
    const connections = [];
    const cards = document.querySelectorAll("li.mn-connection-card, div.mn-connection-card");
    cards.forEach((card, index) => {
      const name = card.querySelector(".mn-connection-card__name")?.innerText?.trim() || "";
      const occupation = card.querySelector(".mn-connection-card__occupation")?.innerText?.trim() || "";
      const link = card.querySelector("a.mn-connection-card__link")?.href || "";
      
      if (name) {
        // Attempt to split occupation into Title and Company
        let company = "";
        let position = occupation;
        if (occupation.includes(" at ")) {
          const parts = occupation.split(" at ");
          position = parts[0].trim();
          company = parts[1].trim();
        } else if (occupation.includes(" @ ")) {
          const parts = occupation.split(" @ ");
          position = parts[0].trim();
          company = parts[1].trim();
        }

        connections.push({
          id: `conn_${index}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: name,
          first_name: name.split(" ")[0] || name,
          last_name: name.split(" ").slice(1).join(" ") || "",
          position: position,
          company: company,
          profile_url: link,
          connected_on: "Recent"
        });
      }
    });
    return connections;
  }

  function extractJobData() {
    const title = document.querySelector("h1.job-details-jobs-unified-top-card__job-title, h1.top-card-layout__title")?.innerText?.trim() || "";
    const company = document.querySelector("a.job-details-jobs-unified-top-card__primary-description-container-item, a.topcard__org-name-link")?.innerText?.trim() || "";
    const description = document.querySelector("div.jobs-description-content__text, div.description__text")?.innerText?.trim() || "";

    return {
      title,
      company,
      description
    };
  }
})();
