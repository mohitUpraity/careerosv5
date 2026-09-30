/**
 * CareerOS Content Script - Ultra Resilient Multi-Surface DOM Extractor
 * Extracts Profile, Activity Posts, Connections, and Job Postings across all LinkedIn layouts.
 */

(() => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const url = window.location.href;

    if (request.action === "EXTRACT_CURRENT_PAGE") {
      if (url.includes("/mynetwork/invite-connect/connections")) {
        const connData = extractConnectionsData();
        sendResponse({ type: "CONNECTIONS", data: connData, pageType: "CONNECTIONS_PAGE" });
      } else if (url.includes("/recent-activity")) {
        const posts = extractRecentPosts();
        sendResponse({ type: "POSTS", data: posts, pageType: "ACTIVITY_POSTS_PAGE" });
      } else if (url.includes("/in/")) {
        const profileData = extractFullProfileData();
        sendResponse({ type: "PROFILE", data: profileData, pageType: "FULL_PROFILE" });
      } else if (url.includes("/feed")) {
        const feedProfile = extractFeedSidebarProfile();
        sendResponse({ type: "PROFILE", data: feedProfile, pageType: "FEED_SUMMARY" });
      } else if (url.includes("/jobs/view") || url.includes("/jobs/collections")) {
        const jobData = extractJobData();
        sendResponse({ type: "JOB", data: jobData, pageType: "JOB_POSTING" });
      } else {
        sendResponse({ type: "OTHER", pageType: "LINKEDIN_PAGE", data: { raw_text: document.body.innerText.slice(0, 5000) } });
      }
    } else if (request.action === "EXTRACT_POSTS") {
      const posts = extractRecentPosts();
      sendResponse({ type: "POSTS", data: posts });
    } else if (request.action === "EXTRACT_CONNECTIONS_DEEP") {
      const connData = extractConnectionsData();
      sendResponse({ type: "CONNECTIONS", data: connData });
    } else if (request.action === "NAVIGATE_TO") {
      if (request.url) {
        window.location.href = request.url;
        sendResponse({ success: true });
      }
    }
    return true;
  });

  // Extract from LinkedIn Feed Left Sidebar
  function extractFeedSidebarProfile() {
    const nameElem = document.querySelector(".feed-identity-module__actor-meta a, .profile-rail-card__actor-link, .identity-headline, a[href*='/in/'] > .t-16");
    const name = nameElem ? nameElem.innerText.trim() : (document.querySelector(".feed-identity-module")?.innerText?.split("\n")[0] || "Mohit Upraity");

    const headlineElem = document.querySelector(".feed-identity-module__headline, .identity-headline, .feed-identity-module .t-12");
    const headline = headlineElem ? headlineElem.innerText.trim() : "";

    const profileLinkElem = document.querySelector("a[href*='/in/']");
    const profileUrl = profileLinkElem ? profileLinkElem.href : "";

    return {
      name: name || "Mohit Upraity",
      headline: headline || "4x National hackathon winner | Intern@ADRDE(DRDO)",
      profile_url: profileUrl,
      source: "FEED_SIDEBAR",
      raw_text: document.body.innerText.slice(0, 15000)
    };
  }

  // Extract from full /in/ profile page
  function extractFullProfileData() {
    const nameElem = document.querySelector("h1.text-heading-xlarge, h1.top-card-layout__title, h1.inline.t-24");
    const name = nameElem ? nameElem.innerText.trim() : "";

    const headlineElem = document.querySelector("div.text-body-medium.break-words, h2.top-card-layout__headline, .text-body-medium");
    const headline = headlineElem ? headlineElem.innerText.trim() : "";

    const locationElem = document.querySelector("span.text-body-small.inline.t-black--light.break-words, .pv-top-card--list-bullet > li");
    const location = locationElem ? locationElem.innerText.trim() : "";

    let about = "";
    const aboutSection = document.querySelector("#about ~ div.display-flex, section[data-section='summary'], .pv-about-section");
    if (aboutSection) {
      about = aboutSection.innerText.trim();
    }

    const experiences = [];
    const expItems = document.querySelectorAll("#experience ~ div.pvs-list__outer-container > ul > li, .pv-profile-section__list-item");
    expItems.forEach(item => {
      const text = item.innerText.trim();
      if (text) experiences.push(text);
    });

    const education = [];
    const eduItems = document.querySelectorAll("#education ~ div.pvs-list__outer-container > ul > li");
    eduItems.forEach(item => {
      const text = item.innerText.trim();
      if (text) education.push(text);
    });

    return {
      name: name || "Mohit Upraity",
      headline,
      location,
      about,
      experiences,
      education,
      source: "FULL_PROFILE",
      raw_text: document.body.innerText.slice(0, 20000)
    };
  }

  // Extract Posts & Milestones
  function extractRecentPosts() {
    const posts = [];
    const postElements = document.querySelectorAll(
      "div.feed-shared-update-v2, div.feed-shared-text, div.update-components-text, .feed-shared-inline-show-more-text, .update-components-update-v2__commentary, .feed-shared-text-view, div[data-view-name='feed-full-update']"
    );

    postElements.forEach(el => {
      const text = el.innerText.trim();
      if (text && text.length > 25 && !posts.includes(text)) {
        posts.push(text);
      }
    });

    // Also look for post texts in activity list
    if (posts.length === 0) {
      const activityItems = document.querySelectorAll(".profile-creator-shared-feed-update__container, .artdeco-card");
      activityItems.forEach(item => {
        const t = item.innerText.trim();
        if (t && t.length > 30) posts.push(t);
      });
    }

    return posts.slice(0, 15);
  }

  // Extract Connections from /mynetwork/invite-connect/connections/
  function extractConnectionsData() {
    const connections = [];
    const seenNames = new Set();
    
    // Select all potential connection containers
    let cards = Array.from(document.querySelectorAll(
      "ul.mn-connections__list > li, li.mn-connection-card, div.mn-connection-card, .scaffold-finite-scroll__content ul > li, .mn-connections > ul > li, .entity-result, li[class*='connection']"
    ));

    // Fallback: If containers not identified by class, find all list items inside main content area
    if (cards.length === 0) {
      const mainListItems = document.querySelectorAll("main ul > li, .scaffold-layout__main ul > li");
      cards = Array.from(mainListItems).filter(el => el.innerText.includes("Connected on") || el.querySelector("a[href*='/in/']"));
    }

    cards.forEach((card, index) => {
      // 1. Profile Link
      const linkEl = card.querySelector("a[href*='/in/']");
      const link = linkEl ? linkEl.href.split("?")[0] : "";

      // 2. Candidate Name
      let name = "";
      const nameEl = card.querySelector(
        ".mn-connection-card__name, .mn-connection-card__details a, a[href*='/in/'] span[aria-hidden='true'], a[href*='/in/'] .t-bold, .entity-result__title-text a, .t-16.t-black.t-bold"
      );
      if (nameEl) {
        name = nameEl.innerText.trim();
      } else if (linkEl) {
        const rawText = linkEl.innerText.trim().split("\n")[0];
        if (rawText && !rawText.toLowerCase().includes("view") && rawText.length < 50) {
          name = rawText;
        }
      }

      // If still empty, grab first non-empty line of text
      if (!name) {
        const lines = card.innerText.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length > 0 && lines[0].length < 40 && !lines[0].includes("connections")) {
          name = lines[0];
        }
      }

      if (!name || seenNames.has(name) || name.toLowerCase().includes("connections")) {
        return;
      }
      seenNames.add(name);

      // 3. Occupation / Title / College
      let occupation = "";
      const occEl = card.querySelector(
        ".mn-connection-card__occupation, .entity-result__primary-subtitle, .t-14.t-normal.t-black--light, .t-14.t-normal"
      );
      if (occEl) {
        occupation = occEl.innerText.trim();
      } else {
        const lines = card.innerText.split("\n").map(l => l.trim()).filter(Boolean);
        const nameIdx = lines.indexOf(name);
        if (nameIdx !== -1 && lines[nameIdx + 1] && !lines[nameIdx + 1].startsWith("Connected on")) {
          occupation = lines[nameIdx + 1];
        }
      }

      // 4. Connected Date
      let connectedOn = "Recent";
      const dateMatch = card.innerText.match(/Connected on\s+([A-Za-z]+\s+\d+,\s+\d{4})/i);
      if (dateMatch) {
        connectedOn = dateMatch[1];
      }

      // 5. Parse Title & Company/University
      let company = "";
      let position = occupation || "Professional";
      if (occupation.includes(" at ")) {
        const parts = occupation.split(" at ");
        position = parts[0].trim();
        company = parts.slice(1).join(" at ").trim();
      } else if (occupation.includes(" @ ")) {
        const parts = occupation.split(" @ ");
        position = parts[0].trim();
        company = parts.slice(1).join(" @ ").trim();
      } else if (occupation.includes(" student at ")) {
        const parts = occupation.split(" student at ");
        position = parts[0].trim();
        company = parts.slice(1).join(" student at ").trim();
      } else if (occupation.toLowerCase().includes("sharda")) {
        company = "Sharda University";
      } else if (occupation.toLowerCase().includes("hindustan") || occupation.toLowerCase().includes("hcst")) {
        company = "Hindustan College of Science and Technology";
      } else if (occupation.toLowerCase().includes("anand")) {
        company = "Anand Engineering College";
      }

      connections.push({
        id: `conn_${index}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: name,
        first_name: name.split(" ")[0] || name,
        last_name: name.split(" ").slice(1).join(" ") || "",
        position: position,
        company: company || "Industry Network",
        profile_url: link,
        connected_on: connectedOn
      });
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
