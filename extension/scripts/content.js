/**
 * CareerOS Content Script - High Accuracy LinkedIn DOM Extractor
 */

(() => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_CURRENT_PAGE") {
      const url = window.location.href;
      
      if (url.includes("/in/")) {
        const profileData = extractFullProfileData();
        sendResponse({ type: "PROFILE", data: profileData, pageType: "FULL_PROFILE" });
      } else if (url.includes("/feed")) {
        const feedProfile = extractFeedSidebarProfile();
        sendResponse({ type: "PROFILE", data: feedProfile, pageType: "FEED_SUMMARY" });
      } else if (url.includes("/jobs/view") || url.includes("/jobs/collections")) {
        const jobData = extractJobData();
        sendResponse({ type: "JOB", data: jobData, pageType: "JOB_POSTING" });
      } else if (url.includes("/mynetwork/invite-connect/connections")) {
        const connData = extractConnectionsData();
        sendResponse({ type: "CONNECTIONS", data: connData, pageType: "CONNECTIONS_PAGE" });
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

  function extractRecentPosts() {
    const posts = [];
    const postElements = document.querySelectorAll("div.feed-shared-update-v2, div.feed-shared-text, div.update-components-text, .feed-shared-inline-show-more-text");
    postElements.forEach(el => {
      const text = el.innerText.trim();
      if (text && text.length > 25 && !posts.includes(text)) {
        posts.push(text);
      }
    });
    return posts.slice(0, 15);
  }

  function extractConnectionsData() {
    const connections = [];
    const cards = document.querySelectorAll("li.mn-connection-card, div.mn-connection-card, .mn-connections__list-item");
    cards.forEach((card, index) => {
      const name = card.querySelector(".mn-connection-card__name, .mn-connection-card__details a")?.innerText?.trim() || "";
      const occupation = card.querySelector(".mn-connection-card__occupation, .mn-connection-card__occupation")?.innerText?.trim() || "";
      const link = card.querySelector("a.mn-connection-card__link, a[href*='/in/']")?.href || "";
      
      if (name) {
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
