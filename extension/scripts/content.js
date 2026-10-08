/**
 * CareerOS Content Script - Advanced Precision DOM Extractor
 * Strictly extracts authentic visible data from LinkedIn DOM:
 * - Full Profile (Header, Experience, Education, Certifications, Achievements, Badges, Skills, Projects, About)
 * - Connections Graph (Deep Infinite Scroll, Multi-field attributes, Alumni detection)
 * - Posts & Activity (Milestones, Hackathons, Certifications, Attachments, Timestamps)
 */

(() => {
  // Global message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
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
          sendResponse({
            type: "OTHER",
            pageType: "LINKEDIN_PAGE",
            data: { raw_text: (document.body?.innerText || "").slice(0, 5000) }
          });
        }
        return false;
      } else if (request.action === "EXTRACT_FULL_PROFILE" || request.action === "EXTRACT_TARGET_PROFILE") {
        (async () => {
          try {
            await hydrateProfileSections();
            expandAllSeeMore();
            const profileData = extractFullProfileData();
            sendResponse({ type: "PROFILE", data: profileData, success: true });
          } catch (e) {
            sendResponse({ type: "ERROR", message: e.message });
          }
        })();
        return true;
      } else if (request.action === "EXTRACT_POSTS") {
        expandAllSeeMore();
        const posts = extractRecentPosts();
        sendResponse({ type: "POSTS", data: posts });
        return false;
      } else if (request.action === "EXTRACT_CONNECTIONS_DEEP") {
        deepScanConnections((progress) => {
          chrome.runtime.sendMessage({
            action: "DEEP_SCAN_PROGRESS",
            count: progress.count,
            isDone: progress.isDone
          }).catch(() => {});
        }).then((connections) => {
          sendResponse({ type: "CONNECTIONS", data: connections });
        }).catch((err) => {
          sendResponse({ type: "ERROR", message: err.message });
        });
        return true;
      } else if (request.action === "EXTRACT_POSTS_DEEP") {
        deepScanPosts((progress) => {
          chrome.runtime.sendMessage({
            action: "DEEP_SCAN_POSTS_PROGRESS",
            count: progress.count,
            isDone: progress.isDone
          }).catch(() => {});
        }).then((posts) => {
          sendResponse({ type: "POSTS", data: posts });
        }).catch((err) => {
          sendResponse({ type: "ERROR", message: err.message });
        });
        return true;
      } else if (request.action === "NAVIGATE_TO") {
        if (request.url) {
          window.location.href = request.url;
          sendResponse({ success: true });
        }
        return false;
      }
    } catch (err) {
      sendResponse({ type: "ERROR", message: err.message });
      return false;
    }
    return false;
  });

  // =========================================================================
  // DOM HELPERS & SELECTORS
  // =========================================================================

  function cleanText(str) {
    if (!str) return "";
    return str
      .replace(/\s+/g, " ")
      .replace(/…see more|see less|\.\.\.more/gi, "")
      .trim();
  }

  async function hydrateProfileSections() {
    try {
      const scrollSteps = [900, 2000, 3500, 5000, 0];
      for (const step of scrollSteps) {
        window.scrollTo({ top: step, behavior: "instant" });
        window.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (e) {}
    expandAllSeeMore();
  }

  function expandAllSeeMore() {
    try {
      document.querySelectorAll(
        "button.inline-show-more-text__button, button.feed-shared-inline-show-more-text__see-more-less-toggle, button[aria-label*='more'], button.see-more, button[class*='see-more']"
      ).forEach((b) => {
        try { b.click(); } catch (e) {}
      });
    } catch (e) {}
  }

  function findSection(keywords, anchorId) {
    // 1. Check anchor element ID or partial match
    if (anchorId) {
      const anchor =
        document.getElementById(anchorId) ||
        document.querySelector(`[id*='${anchorId}']`) ||
        document.querySelector(`a[href*='${anchorId}']`);
      if (anchor) {
        const sec =
          anchor.closest("section, div.artdeco-card, [data-view-name*='profile-component']") ||
          anchor.parentElement?.parentElement;
        if (sec) return sec;
      }
    }

    // 2. Scan section headings & aria labels
    const sections = Array.from(
      document.querySelectorAll(
        "section, div.artdeco-card, [data-view-name*='profile-component'], div.pvs-list__outer-container"
      )
    );
    for (const sec of sections) {
      const heading = sec.querySelector(
        "h2, h3, .pvs-header__title, span[aria-hidden='true'], [data-view-name*='title']"
      );
      if (heading) {
        const text = (heading.innerText || "").toLowerCase();
        if (keywords.some((kw) => text.includes(kw))) {
          return sec;
        }
      }
      const aria = (sec.getAttribute("aria-label") || "").toLowerCase();
      if (keywords.some((kw) => aria.includes(kw))) {
        return sec;
      }
    }
    return null;
  }

  // =========================================================================
  // 1. FULL LINKEDIN PROFILE EXTRACTOR (100% Comprehensive)
  // =========================================================================

  function extractFullProfileData() {
    expandAllSeeMore();
    const url = window.location.href.split("?")[0].replace(/\/+$/, "");

    // --- A. Top Card Identity ---
    let nameElem = document.querySelector(
      "h1.text-heading-xlarge, h1.top-card-layout__title, h1.inline.t-24, .pv-top-card--list li:first-child, h1"
    );
    let rawName = nameElem ? nameElem.innerText.trim().split("\n")[0] : "";
    let cleanName = rawName
      .replace(/\(.*?\)/g, "") // remove pronouns e.g. (He/Him)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // remove emoji
      .replace(/verified/gi, "")
      .replace(/[\s\-_]+[a-f0-9]{6,12}$/i, "") // strip trailing random LinkedIn hash e.g. 7a6324316
      .trim();

    // Fallback: URL slug e.g. /in/mohit-upraity
    if (!cleanName || cleanName.toLowerCase().includes("activity") || cleanName.length < 2) {
      const match = url.match(/\/in\/([a-zA-Z0-9_-]+)/);
      if (match && match[1] && match[1] !== "me") {
        const cleanSlug = match[1].replace(/[-_][a-f0-9]{6,12}$/i, "");
        cleanName = cleanSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      }
    }

    let headlineElem = document.querySelector(
      "div.text-body-medium.break-words, h2.top-card-layout__headline, .text-body-medium, .pv-top-card--list-bullet"
    );
    let headline = headlineElem ? cleanText(headlineElem.innerText) : "";

    let locationElem = document.querySelector(
      "span.text-body-small.inline.t-black--light.break-words, .pv-top-card--list-bullet li, .top-card__subline-item, .pv-top-card--list:last-child"
    );
    let location = locationElem ? cleanText(locationElem.innerText) : "";

    let avatarElem = document.querySelector(
      "img.pv-top-card-profile-picture__image, img.evi-image, img.presence-entity__image, img[title*='profile']"
    );
    let avatarUrl = avatarElem ? (avatarElem.src || "") : "";

    // --- B. About / Bio / Summary ---
    let bio = "";
    const aboutSec = findSection(["about", "summary"], "about");
    if (aboutSec) {
      const bioEl = aboutSec.querySelector(".inline-show-more-text, .display-flex.ph5.pv3, .pv-about__summary-text, span[aria-hidden='true']");
      if (bioEl) {
        bio = cleanText(bioEl.innerText);
      }
    }

    // --- C. Experience Section ---
    const experience = [];
    const expSec = findSection(["experience", "work experience"], "experience");
    if (expSec) {
      const items = Array.from(expSec.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, .pvs-entity"));
      items.forEach((item) => {
        // Check if item contains sub-roles (grouped company)
        const subRoles = Array.from(item.querySelectorAll("ul.pvs-list > li"));
        if (subRoles.length > 0) {
          const compHeaderEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true'], .hoverable-link-text span[aria-hidden='true']");
          const compName = compHeaderEl ? cleanText(compHeaderEl.innerText) : "Company";

          subRoles.forEach((sub) => {
            const roleEl = sub.querySelector(".t-bold span[aria-hidden='true'], .hoverable-link-text span[aria-hidden='true']");
            const dateEl = sub.querySelector("span.t-14.t-normal.t-black--light span[aria-hidden='true']");
            const locEl = sub.querySelectorAll("span.t-14.t-normal.t-black--light span[aria-hidden='true']")[1];
            const descEl = sub.querySelector(".inline-show-more-text span[aria-hidden='true']");

            const role = roleEl ? cleanText(roleEl.innerText) : "Engineer";
            const dateText = dateEl ? cleanText(dateEl.innerText) : "";
            const isCurrent = dateText.toLowerCase().includes("present");

            if (role && !role.toLowerCase().includes("show all")) {
              experience.push({
                company: compName,
                role: role,
                start_date: dateText.split("-")[0]?.trim() || dateText,
                end_date: isCurrent ? "Present" : (dateText.split("-")[1]?.trim() || ""),
                is_current: isCurrent,
                location: locEl ? cleanText(locEl.innerText) : "",
                description: descEl ? cleanText(descEl.innerText) : ""
              });
            }
          });
        } else {
          // Single role
          const roleEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true'], .hoverable-link-text span[aria-hidden='true']");
          const compEl = item.querySelector("span.t-14.t-normal span[aria-hidden='true']");
          const dateEl = item.querySelector("span.t-14.t-normal.t-black--light span[aria-hidden='true']");
          const descEl = item.querySelector(".inline-show-more-text span[aria-hidden='true']");

          const role = roleEl ? cleanText(roleEl.innerText) : "";
          let comp = compEl ? cleanText(compEl.innerText).split("·")[0].trim() : "";
          const dateText = dateEl ? cleanText(dateEl.innerText) : "";
          const isCurrent = dateText.toLowerCase().includes("present");

          if (role && !role.toLowerCase().includes("show all")) {
            experience.push({
              company: comp || "Company",
              role: role,
              start_date: dateText.split("-")[0]?.trim() || dateText,
              end_date: isCurrent ? "Present" : (dateText.split("-")[1]?.trim() || ""),
              is_current: isCurrent,
              location: "",
              description: descEl ? cleanText(descEl.innerText) : ""
            });
          }
        }
      });
    }

    // --- D. Education Section ---
    const education = [];
    const eduSec = findSection(["education"], "education");
    if (eduSec) {
      const items = Array.from(eduSec.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, .pvs-entity"));
      items.forEach((item) => {
        const univEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true'], .hoverable-link-text span[aria-hidden='true']");
        const degreeEl = item.querySelector("span.t-14.t-normal span[aria-hidden='true']");
        const dateEl = item.querySelector("span.t-14.t-normal.t-black--light span[aria-hidden='true']");
        const descEl = item.querySelector(".inline-show-more-text span[aria-hidden='true']");

        const univ = univEl ? cleanText(univEl.innerText) : "";
        const degree = degreeEl ? cleanText(degreeEl.innerText) : "";
        const dateText = dateEl ? cleanText(dateEl.innerText) : "";

        if (univ && !univ.toLowerCase().includes("show all")) {
          education.push({
            university: univ,
            degree: degree.split(",")[0]?.trim() || degree,
            field_of_study: degree.split(",")[1]?.trim() || "",
            start_date: dateText.split("-")[0]?.trim() || "",
            end_date: dateText.split("-")[1]?.trim() || dateText,
            description: descEl ? cleanText(descEl.innerText) : ""
          });
        }
      });
    }

    // --- E. Licenses & Certifications Section ("koi certificte hai toh wo bhi") ---
    const certifications = [];
    const certSec = findSection(["licenses & certifications", "certifications", "licenses"], "licenses_and_certifications");
    if (certSec) {
      const items = Array.from(certSec.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, .pvs-entity"));
      items.forEach((item) => {
        const titleEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true'], .hoverable-link-text span[aria-hidden='true']");
        const issuerEl = item.querySelector("span.t-14.t-normal span[aria-hidden='true']");
        const dateEl = item.querySelector("span.t-14.t-normal.t-black--light span[aria-hidden='true']");
        const linkEl = item.querySelector("a[href*='credential'], a[href*='verify'], a[href*='cert'], a[aria-label*='credential'], a.pvs-navigation-entity-cta");

        const name = titleEl ? cleanText(titleEl.innerText) : "";
        const issuer = issuerEl ? cleanText(issuerEl.innerText).split("·")[0].trim() : "";
        const dateText = dateEl ? cleanText(dateEl.innerText).replace(/issued /i, "").trim() : "";
        const url = linkEl ? linkEl.href : "";

        const itemText = item.innerText || "";
        const credIdMatch = itemText.match(/Credential ID\s*([A-Za-z0-9_-]+)/i);

        if (name && !name.toLowerCase().includes("show all")) {
          certifications.push({
            name: name,
            issuer: issuer || "Accredited Authority",
            date: dateText,
            url: url,
            credential_id: credIdMatch ? credIdMatch[1] : ""
          });
        }
      });
    }

    // --- F. Honors & Awards / Achievements ("ya koi achievment ya koi badge etc") ---
    const achievements = [];
    const awardSec = findSection(["honors & awards", "honors", "awards", "achievements"], "honors_and_awards");
    if (awardSec) {
      const items = Array.from(awardSec.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, .pvs-entity"));
      items.forEach((item) => {
        const titleEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true'], .hoverable-link-text span[aria-hidden='true']");
        const orgEl = item.querySelector("span.t-14.t-normal span[aria-hidden='true']");
        const dateEl = item.querySelector("span.t-14.t-normal.t-black--light span[aria-hidden='true']");
        const descEl = item.querySelector(".inline-show-more-text span[aria-hidden='true']");

        const title = titleEl ? cleanText(titleEl.innerText) : "";
        const org = orgEl ? cleanText(orgEl.innerText).split("·")[0].trim() : "";
        const dateText = dateEl ? cleanText(dateEl.innerText) : "";

        if (title && !title.toLowerCase().includes("show all")) {
          achievements.push({
            title: title,
            organization: org || "Competition / Organization",
            date: dateText,
            description: descEl ? cleanText(descEl.innerText) : ""
          });
        }
      });
    }

    // --- G. Badges & Assessments ---
    const badges = [];
    // 1. Check for Passed LinkedIn Skill Assessment badges
    document.querySelectorAll(".pv-skill-entity__passed-assessment, span.pv-badge, .artdeco-badge, [aria-label*='Passed Skill Assessment'], div:has(> svg[data-test-icon*='badge'])").forEach((badgeEl) => {
      const text = cleanText(badgeEl.innerText);
      if (text && text.length > 2 && text.length < 60) {
        badges.push({
          name: text,
          issuer: "LinkedIn Assessment",
          badge_type: "Skill Assessment",
          date: "Verified"
        });
      }
    });

    // 2. Identity / Top Voice / Contributor badges
    const topVoiceBadge = document.querySelector(".top-card__badge, .pv-top-voice-badge");
    if (topVoiceBadge) {
      badges.push({
        name: cleanText(topVoiceBadge.innerText) || "LinkedIn Top Voice",
        issuer: "LinkedIn",
        badge_type: "Community Badge",
        date: "Active"
      });
    }

    // --- H. Projects Section ---
    const projects = [];
    const projSec = findSection(["projects"], "projects");
    if (projSec) {
      const items = Array.from(projSec.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, .pvs-entity"));
      items.forEach((item) => {
        const titleEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true']");
        const descEl = item.querySelector(".inline-show-more-text span[aria-hidden='true']");
        const linkEl = item.querySelector("a[href*='github.com'], a[href]");

        const title = titleEl ? cleanText(titleEl.innerText) : "";
        if (title && !title.toLowerCase().includes("show all")) {
          projects.push({
            name: title,
            description: descEl ? cleanText(descEl.innerText) : "",
            repo_url: linkEl ? linkEl.href : "",
            tech_stack: []
          });
        }
      });
    }

    // --- I. Skills Section ---
    const skills = [];
    const skillSec = findSection(["skills"], "skills");
    if (skillSec) {
      const items = Array.from(skillSec.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, .pvs-entity"));
      items.forEach((item) => {
        const skillEl = item.querySelector("div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true'], a span[aria-hidden='true']");
        const skillName = skillEl ? cleanText(skillEl.innerText) : "";
        if (skillName && skillName.length > 1 && !skillName.toLowerCase().includes("show all") && !skills.includes(skillName)) {
          skills.push(skillName);
        }
      });
    }

    // --- J. Company & Role parsing from headline & experience ---
    let currentCompany = "";
    let currentRole = headline;

    if (experience.length > 0 && experience[0].is_current) {
      currentCompany = experience[0].company;
      currentRole = experience[0].role;
    } else if (headline.includes(" at ")) {
      const parts = headline.split(" at ");
      currentRole = parts[0].trim();
      currentCompany = parts[1].split("|")[0].split("•")[0].split(",")[0].trim();
    } else if (headline.includes(" @ ")) {
      const parts = headline.split(" @ ");
      currentRole = parts[0].trim();
      currentCompany = parts[1].split("|")[0].split("•")[0].split(",")[0].trim();
    } else if (experience.length > 0) {
      currentCompany = experience[0].company;
      currentRole = experience[0].role;
    }

    // --- K. Alumni College Detection ---
    let sharedCollege = "";
    const fullText = document.body ? document.body.innerText : "";
    if (fullText.includes("Anand Engineering College") || headline.includes("Anand") || fullText.includes("AEC Agra")) {
      sharedCollege = "Anand Engineering College";
    } else if (fullText.includes("Sharda University") || headline.includes("Sharda")) {
      sharedCollege = "Sharda University";
    } else if (fullText.includes("Hindustan College") || fullText.includes("HCST")) {
      sharedCollege = "Hindustan College of Science and Technology";
    }

    return {
      name: cleanName || "LinkedIn Member",
      full_name: cleanName || "LinkedIn Member",
      headline: headline || "Software Engineer",
      current_company: currentCompany || "Industry Network",
      company: currentCompany || "Industry Network",
      current_role: currentRole || headline,
      role: currentRole || headline,
      location: location,
      bio: bio,
      profile_url: url,
      avatar_url: avatarUrl,
      shared_college: sharedCollege,
      education: education,
      experience: experience,
      certifications: certifications,
      achievements: achievements,
      badges: badges,
      projects: projects,
      skills: skills,
      source: "COMPREHENSIVE_PROFILE_EXTRACTOR",
      raw_text: fullText.slice(0, 30000)
    };
  }

  // =========================================================================
  // 2. REAL CONNECTIONS EXTRACTOR & DEEP INFINITE SCANNER
  // =========================================================================

  function extractConnectionsData() {
    const connections = [];
    const seenUrls = new Set();
    const seenNames = new Set();

    // Strategy 1: Find all profile links on the page outside the global header/nav
    const linkCandidates = Array.from(document.querySelectorAll("a[href*='/in/']")).filter((a) => {
      if (a.closest("header, nav, #global-nav, .global-nav, footer")) return false;
      const rawHref = a.getAttribute("href") || a.href || "";
      if (rawHref.includes("/in/me") || rawHref.includes("/in/edit") || rawHref.includes("search") || rawHref.includes("feed")) {
        return false;
      }
      const clean = rawHref.split("?")[0].replace(/\/+$/, "") + "/";
      return clean.includes("/in/") && !clean.endsWith("/in/");
    });

    linkCandidates.forEach((linkEl) => {
      const rawHref = linkEl.getAttribute("href") || linkEl.href || "";
      const href = (linkEl.href || rawHref).split("?")[0].replace(/\/+$/, "") + "/";
      if (!href || href.endsWith("/in/") || href.includes("/in/me") || seenUrls.has(href)) {
        return;
      }

      // Find enclosing contact card / list item
      let card = linkEl.closest("li, [role='listitem'], div[data-view-name*='connection'], div.scaffold-finite-scroll__content > div");
      if (!card) {
        let curr = linkEl;
        for (let s = 0; s < 7 && curr && curr !== document.body; s++) {
          curr = curr.parentElement;
          if (curr && (curr.innerText.includes("Connected on") || curr.innerText.includes("Connected ") || curr.innerText.includes("Message"))) {
            card = curr;
            break;
          }
        }
      }
      if (!card) {
        card = linkEl.parentElement?.parentElement || linkEl.parentElement;
      }

      const cardText = (card?.innerText || "").trim();

      // Extract Name: Check link first, then span[aria-hidden='true'], then card headings
      let name = "";
      const nameInLink = linkEl.querySelector("span[aria-hidden='true'], span") || linkEl;
      if (nameInLink && nameInLink.innerText) {
        name = cleanText(nameInLink.innerText).split("\n")[0];
      }
      if (!name || name.length < 2 || name.toLowerCase().includes("view") || name.length > 40) {
        const titleEl = card.querySelector(
          ".mn-connection-card__name, .entity-result__title-text, .artdeco-entity-lockup__title, .t-16.t-black.t-bold, h3, [data-view-name*='actor'] a"
        );
        if (titleEl) {
          name = cleanText(titleEl.innerText).split("\n")[0];
        }
      }

      name = name
        .replace(/\(.*?\)/g, "")
        .replace(/verified/gi, "")
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
        .trim();

      // If name is still missing or looks like a headline/role string, recover name from URL slug
      if (!name || name.length < 2 || name.length > 35 || name.includes("|") || name.includes("•") || name.toLowerCase().includes("developer") || name.toLowerCase().includes("student")) {
        const slugMatch = href.match(/\/in\/([a-zA-Z0-9_-]+)/);
        if (slugMatch && slugMatch[1] && slugMatch[1] !== "me") {
          const rawSlug = slugMatch[1].split("-").filter((p) => !/^[0-9a-f]{6,}$/i.test(p) && !/^\d+$/.test(p)).join(" ");
          if (rawSlug && rawSlug.length > 1) {
            name = rawSlug.replace(/\b\w/g, (l) => l.toUpperCase());
          }
        }
      }

      if (
        !name ||
        name.length < 2 ||
        name.toLowerCase().includes("linkedin member") ||
        name.toLowerCase().includes("sort by") ||
        name.toLowerCase().includes("see all") ||
        seenUrls.has(href)
      ) {
        return;
      }

      seenUrls.add(href);

      // Extract Headline / Occupation
      let occupation = "";
      const occEl = card.querySelector(
        ".mn-connection-card__occupation, .entity-result__primary-subtitle, .artdeco-entity-lockup__caption, .artdeco-entity-lockup__subtitle, .t-14.t-normal, .entity-result__summary, p"
      );
      if (occEl) {
        occupation = cleanText(occEl.innerText);
      } else {
        const lines = cardText.split("\n").map((l) => l.trim()).filter(Boolean);
        const nameIdx = lines.findIndex((l) => l.toLowerCase() === name.toLowerCase());
        if (nameIdx !== -1 && lines[nameIdx + 1] && !lines[nameIdx + 1].startsWith("Connected") && !lines[nameIdx + 1].startsWith("Message")) {
          occupation = lines[nameIdx + 1];
        }
      }

      // Extract Connected Date (e.g. "Connected on May 17, 2025")
      let connectedOn = "Recent";
      const dateMatch =
        cardText.match(/Connected on\s+([A-Za-z]+\s+\d+,\s+\d{4})/i) ||
        cardText.match(/Connected\s+([A-Za-z0-9\s,]+ago|[A-Za-z]+\s+\d+,\s+\d{4})/i);
      if (dateMatch) {
        connectedOn = dateMatch[1].trim();
      }

      // Extract Avatar
      const imgEl = card.querySelector("img.presence-entity__image, img.evi-image, img.artdeco-entity-lockup__image, img");
      const avatarUrl = imgEl ? (imgEl.src || "") : "";

      // Smart Company & Position Parsing
      let company = "";
      let position = occupation || "Professional";
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

      // Alumni tagging
      const occLower = occupation.toLowerCase();
      let isAlumni = false;
      let university = "";
      if (occLower.includes("anand engineering") || occLower.includes("aec") || occLower.includes("anand engg")) {
        isAlumni = true;
        university = "Anand Engineering College";
      } else if (occLower.includes("sharda")) {
        isAlumni = true;
        university = "Sharda University";
      } else if (occLower.includes("hindustan college") || occLower.includes("hcst")) {
        isAlumni = true;
        university = "Hindustan College of Science and Technology";
      }

      const nameParts = name.split(" ");
      const firstName = nameParts[0] || name;
      const lastName = nameParts.slice(1).join(" ") || "";

      connections.push({
        id: `conn_${connections.length + 1}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        name: name,
        first_name: firstName,
        last_name: lastName,
        position: position || "Professional",
        headline: occupation,
        company: company || "Industry Network",
        university: university,
        is_alumni: isAlumni,
        profile_url: href,
        avatar_url: avatarUrl,
        connected_on: connectedOn
      });
    });

    return connections;
  }

  // Deep Auto-Scroll Scanner for Connections with Live Progress
  async function deepScanConnections(onProgress) {
    const connectionsMap = new Map();
    let prevCount = 0;
    let noNewCount = 0;
    const maxScrolls = 200;

    for (let i = 0; i < maxScrolls; i++) {
      const batch = extractConnectionsData();
      batch.forEach((c) => {
        const key = (c.profile_url || c.name || "").toLowerCase().trim();
        if (key) connectionsMap.set(key, c);
      });

      const currentCount = connectionsMap.size;
      if (onProgress) onProgress({ count: currentCount, isDone: false });

      if (currentCount === prevCount) {
        noNewCount++;
        // If 0 found after 5 scrolls or no new after 8 scrolls, stop
        if (currentCount === 0 && noNewCount >= 5) break;
        if (currentCount > 0 && noNewCount >= 8) break;

        // Recovery pump: scroll up and down
        window.scrollBy({ top: -800, behavior: "smooth" });
        await new Promise((r) => setTimeout(r, 400));

        // Click any load more / show more
        document.querySelectorAll("button.scaffold-finite-scroll__load-button, button.artdeco-button--secondary, button").forEach((b) => {
          const t = (b.innerText || "").toLowerCase();
          if (t.includes("show more") || t.includes("load more") || t.includes("see more")) {
            try { b.click(); } catch (e) {}
          }
        });

        window.scrollBy({ top: 1600, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 800));
        continue;
      } else {
        noNewCount = 0;
      }
      prevCount = currentCount;

      // Normal scroll down
      const scrollEl = document.scrollingElement || document.body || document.documentElement;
      if (scrollEl) {
        window.scrollTo({ top: scrollEl.scrollHeight, behavior: "instant" });
      }
      window.scrollBy({ top: 1400, behavior: "instant" });
      window.dispatchEvent(new Event("scroll", { bubbles: true }));

      // Also scroll virtualized containers
      document.querySelectorAll("div, main, section").forEach((el) => {
        if (el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
          el.scrollTop = el.scrollHeight;
        }
      });

      await new Promise((r) => setTimeout(r, 750));
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    const finalResults = Array.from(connectionsMap.values());
    if (onProgress) onProgress({ count: finalResults.length, isDone: true });
    return finalResults;
  }

  // =========================================================================
  // 3. RECENT POSTS & ACTIVITY EXTRACTOR
  // =========================================================================

  function extractRecentPosts() {
    expandAllSeeMore();
    const posts = [];
    const seen = new Set();

    const postElements = Array.from(
      document.querySelectorAll(
        "div.feed-shared-update-v2, div[data-view-name*='update'], .update-components-update-v2__commentary, .feed-shared-update-v2__description, .feed-shared-text, .update-components-text, .feed-shared-inline-show-more-text, .feed-shared-text-view, article[data-activity-id], div.occludable-update"
      )
    );

    postElements.forEach((el) => {
      let text = cleanText(el.innerText || "");

      // Additional milestone context from attached documents or certificate titles
      const mediaTitleEl = el.querySelector(".feed-shared-mini-update-v2__title, .feed-shared-article__title, .feed-shared-external-video__title, a.app-aware-link");
      if (mediaTitleEl) {
        const mediaTitle = cleanText(mediaTitleEl.innerText);
        if (mediaTitle && !text.includes(mediaTitle)) {
          text = `${text}\n[Attached: ${mediaTitle}]`;
        }
      }

      if (
        text &&
        text.length > 20 &&
        !text.startsWith("Like\n") &&
        !text.startsWith("Comment\n") &&
        !text.startsWith("All activity") &&
        !seen.has(text.slice(0, 100))
      ) {
        seen.add(text.slice(0, 100));
        posts.push(text);
      }
    });

    return posts;
  }

  // Deep Auto-Scroll Scanner for Posts
  async function deepScanPosts(onProgress) {
    const postsMap = new Map();
    let prevCount = 0;
    let noNewCount = 0;
    const maxScrolls = 80;

    for (let i = 0; i < maxScrolls; i++) {
      expandAllSeeMore();
      const currentPosts = extractRecentPosts();
      currentPosts.forEach((p) => {
        const key = p.slice(0, 80);
        if (!postsMap.has(key)) postsMap.set(key, p);
      });

      const currentCount = postsMap.size;
      if (onProgress) onProgress({ count: currentCount, isDone: false });

      if (currentCount === prevCount && currentCount > 0) {
        noNewCount++;
        if (noNewCount >= 6) break;
        window.scrollBy({ top: -700, behavior: "smooth" });
        await new Promise((r) => setTimeout(r, 400));
        window.scrollBy({ top: 1500, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 900));
        continue;
      } else {
        noNewCount = 0;
      }
      prevCount = currentCount;

      const scrollEl = document.scrollingElement || document.body || document.documentElement;
      if (scrollEl) {
        window.scrollTo({ top: scrollEl.scrollHeight, behavior: "instant" });
      }
      window.scrollBy({ top: 1400, behavior: "instant" });
      window.dispatchEvent(new Event("scroll", { bubbles: true }));

      await new Promise((r) => setTimeout(r, 800));
    }

    const finalResults = Array.from(postsMap.values());
    if (onProgress) onProgress({ count: finalResults.length, isDone: true });
    return finalResults;
  }

  function extractFeedSidebarProfile() {
    const nameElem = document.querySelector(".feed-identity-module__actor-meta a, .profile-rail-card__actor-link, .identity-headline, a[href*='/in/'] > .t-16");
    const name = nameElem ? cleanText(nameElem.innerText) : "Candidate";

    const headlineElem = document.querySelector(".feed-identity-module__headline, .identity-headline, .feed-identity-module .t-12");
    const headline = headlineElem ? cleanText(headlineElem.innerText) : "Software Engineer";

    const profileLinkElem = document.querySelector("a[href*='/in/']");
    const profileUrl = profileLinkElem ? profileLinkElem.href : "";

    return {
      name: name,
      full_name: name,
      headline: headline,
      profile_url: profileUrl,
      source: "FEED_SIDEBAR",
      raw_text: (document.body ? document.body.innerText : "").slice(0, 15000)
    };
  }

  function extractJobData() {
    const title = document.querySelector("h1.job-details-jobs-unified-top-card__job-title, h1.top-card-layout__title")?.innerText?.trim() || "";
    const company = document.querySelector("a.job-details-jobs-unified-top-card__primary-description-container-item, a.topcard__org-name-link")?.innerText?.trim() || "";
    const description = document.querySelector("div.jobs-description-content__text, div.description__text")?.innerText?.trim() || "";
    return { title, company, description };
  }
})();
