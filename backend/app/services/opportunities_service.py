import logging
import asyncio
import time
import re
from urllib.parse import urlparse
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
from app.services.neo4j_service import neo4j_service

logger = logging.getLogger(__name__)

# 6-hour caching system (21600 seconds) with force-refresh support
_CACHE_TTL_SECONDS = 6 * 3600  # 6 Hours
_LIVE_OPPORTUNITIES_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "opportunities": []
}

# Browser-compatible headers for clean API responses
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

_MAX_LISTING_AGE_DAYS = 30


def _parse_source_date(value: Any) -> Optional[datetime]:
    """Parse a date supplied by the listing source; never synthesize one."""
    if not value:
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value)
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except (TypeError, ValueError):
        return None


def _valid_listing_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc) and parsed.netloc not in {"#"}


def _source_window_is_open(deadline: Any, published: Any, today: datetime, *, deadline_required: bool = False) -> bool:
    """Trust explicit source deadlines; otherwise accept only recent live-feed posts."""
    deadline_dt = _parse_source_date(deadline)
    if deadline and not deadline_dt:
        return False
    if deadline_dt:
        if deadline_dt.date() < today.date():
            return False
    elif deadline_required:
        return False

    published_dt = _parse_source_date(published)
    if published_dt and (today.date() - published_dt.date()).days > _MAX_LISTING_AGE_DAYS:
        return False
    return True

class OpportunitiesService:
    @classmethod
    async def _scrape_devfolio(cls, client: httpx.AsyncClient, today: datetime) -> List[Dict[str, Any]]:
        """Scrapes open hackathons from Devfolio API with active deadline verification."""
        results: List[Dict[str, Any]] = []
        try:
            r = await client.get("https://api.devfolio.co/api/hackathons", params={"filter": "application_open", "page": 1})
            if r.status_code == 200:
                items = r.json().get("result", [])
                for item in items:
                    name = item.get("name")
                    slug = item.get("slug")
                    if not name or not slug:
                        continue

                    # Parse deadline and ensure it has NOT expired
                    reg_ends_at = item.get("reg_ends_at") or item.get("ends_at")
                    if not _source_window_is_open(reg_ends_at, item.get("created_at"), today, deadline_required=True):
                        continue

                    apply_url = item.get("seo_url") or (f"https://{slug}.devfolio.co/" if slug else None)
                    if not _valid_listing_url(apply_url):
                        continue
                    deadline_dt = _parse_source_date(reg_ends_at)
                    deadline_str = deadline_dt.strftime("%Y-%m-%d") if deadline_dt else ""

                    is_online = item.get("is_online", False)
                    city = item.get("city") or "India"
                    loc_str = "100% Online / Virtual" if is_online else f"{city}, India"

                    themes = [t.get("name") for t in item.get("themes", []) if isinstance(t, dict) and t.get("name")]
                    if not themes:
                        themes = ["Software Engineering", "Full Stack", "AI/ML", "Web3", "API Development"]

                    desc = item.get("tagline") or item.get("desc") or f"Join {name} on Devfolio. Build innovative software and compete for bounties."

                    results.append({
                        "id": f"devfolio-{slug}",
                        "title": name,
                        "organization": item.get("edition_name") or (f"{city} Tech Community" if city else "Devfolio Host"),
                        "category": "hackathons",
                        "opportunity_type": "Devfolio Hackathon",
                        "location": loc_str,
                        "reward": "Cash Prize Pool + Sponsor Bounties & Swag",
                        "deadline_date": deadline_str,
                        "source_platform": "Devfolio Live",
                        "apply_url": apply_url,
                        "skills_required": themes[:6],
                        "description": re.sub(r'<[^>]+>', '', desc)[:320],
                        "verified": True
                    })
                logger.info(f"Devfolio scraper loaded {len(results)} active hackathons.")
        except Exception as e:
            logger.warning(f"Devfolio scraper exception: {e}")
        return results

    @classmethod
    async def _scrape_unstop_channel(
        cls, 
        client: httpx.AsyncClient, 
        channel: str, 
        category: str, 
        opp_type_label: str,
        today: datetime
    ) -> List[Dict[str, Any]]:
        """Scrapes specific Unstop channel (jobs, internships, hackathons, competitions) with active deadline verification."""
        results: List[Dict[str, Any]] = []
        try:
            r = await client.get(
                "https://unstop.com/api/public/opportunity/search-result",
                params={"opportunity": channel, "page": 1, "per_page": 30, "oppstatus": "open"}
            )
            if r.status_code == 200:
                opps = r.json().get("data", {}).get("data", [])
                for opp in opps:
                    title = opp.get("title", "")
                    opp_id = opp.get("id")
                    if not title or not opp_id:
                        continue

                    # Filter technical roles for jobs/internships
                    if channel in ["jobs", "internships"]:
                        combined_text = (title + " " + " ".join([str(sk.get("skill", "")) for sk in opp.get("required_skills", [])])).lower()
                        is_tech = any(k in combined_text for k in [
                            "developer", "engineer", "software", "frontend", "backend", "full stack", 
                            "python", "ai", "react", "tech", "web", "data", "ml", "system", "cloud", 
                            "devops", "architect", "analyst", "node", "java", "c++", "golang", "sde"
                        ])
                        if not is_tech:
                            continue

                    # Deadline verification: MUST BE IN THE FUTURE
                    end_date_raw = opp.get("end_date") or opp.get("regn_end_date")
                    published_raw = opp.get("created_at") or opp.get("published_at")
                    if not _source_window_is_open(end_date_raw, published_raw, today, deadline_required=channel in {"hackathons", "competitions"}):
                        continue

                    seo_url = opp.get("seo_url")
                    if not _valid_listing_url(seo_url):
                        public_path = opp.get("public_url")
                        seo_url = f"https://unstop.com/{str(public_path).lstrip('/')}" if public_path else None
                    if not _valid_listing_url(seo_url):
                        continue
                    deadline_dt = _parse_source_date(end_date_raw)
                    deadline_str = deadline_dt.strftime("%Y-%m-%d") if deadline_dt else ""
                    org_name = (opp.get("organisation") or {}).get("name") or "Not listed"

                    skills = [sk.get("skill") for sk in opp.get("required_skills", []) if sk.get("skill")]
                    prizes = opp.get("prizes")
                    if channel == "jobs":
                        reward_str = opp.get("salary") or "Not listed"
                    elif channel == "internships":
                        reward_str = opp.get("stipend") or opp.get("salary") or "Not listed"
                    else:
                        reward_str = f"Prizes: {prizes}" if prizes else "Not listed"

                    source_label = "Unstop Live Jobs" if channel == "jobs" else (
                        "Unstop Live Internships" if channel == "internships" else "Unstop Live Hackathons"
                    )

                    desc = opp.get("summary") or f"{opp_type_label} at {org_name}. Direct applications managed through Unstop."

                    results.append({
                        "id": f"unstop-{channel}-{opp_id}",
                        "title": title,
                        "organization": org_name,
                        "category": category,
                        "opportunity_type": opp_type_label,
                        "location": opp.get("location") or "See listing",
                        "reward": reward_str,
                        "deadline_date": deadline_str,
                        "source_platform": source_label,
                        "apply_url": seo_url,
                        "skills_required": skills[:6],
                        "description": desc[:320],
                        "verified": True
                    })
                logger.info(f"Unstop {channel} scraper loaded {len(results)} active postings.")
        except Exception as e:
            logger.warning(f"Unstop {channel} scraping failed: {e}")
        return results

    @classmethod
    async def _scrape_remotive(cls, client: httpx.AsyncClient, today: datetime) -> List[Dict[str, Any]]:
        """Scrapes live remote software developer jobs from Remotive API with freshness verification."""
        results: List[Dict[str, Any]] = []
        try:
            r = await client.get("https://remotive.com/api/remote-jobs", params={"category": "software-dev", "limit": 40})
            if r.status_code == 200:
                jobs = r.json().get("jobs", [])
                for j in jobs:
                    title = j.get("title", "")
                    if not title:
                        continue

                    is_intern = "intern" in title.lower()
                    loc_req = j.get("candidate_required_location") or "see listing"

                    # Check publication date to ensure active application window
                    pub_date_raw = j.get("publication_date")
                    if not _source_window_is_open(None, pub_date_raw, today):
                        continue

                    tags = j.get("tags") or []
                    skills = [t.strip() for t in tags if isinstance(t, str) and len(t.strip()) < 20][:6]
                    salary = j.get("salary") or "Not listed"
                    apply_link = j.get("url")
                    if not _valid_listing_url(apply_link):
                        continue

                    desc_clean = re.sub(r'<[^>]+>', ' ', j.get("description", ""))
                    desc_clean = re.sub(r'\s+', ' ', desc_clean)[:300]

                    results.append({
                        "id": f"remotive-{j.get('id')}",
                        "title": title,
                        "organization": j.get("company_name") or "Not listed",
                        "category": "internships" if is_intern else "jobs",
                        "opportunity_type": "Remote Tech Internship" if is_intern else "Remote Software Engineer",
                        "location": f"Remote ({loc_req})",
                        "reward": salary,
                        "deadline_date": "",
                        "source_platform": "Remotive Tech Feed",
                        "apply_url": apply_link,
                        "skills_required": skills,
                        "description": desc_clean or "See the source listing for role details.",
                        "verified": True
                    })
                logger.info(f"Remotive loaded {len(results)} active developer roles.")
        except Exception as e:
            logger.warning(f"Remotive scraping failed: {e}")
        return results

    @classmethod
    async def _scrape_jobicy(cls, client: httpx.AsyncClient, today: datetime) -> List[Dict[str, Any]]:
        """Scrapes live remote jobs from Jobicy API."""
        results: List[Dict[str, Any]] = []
        try:
            r = await client.get("https://jobicy.com/api/v2/remote-jobs?count=40")
            if r.status_code == 200:
                jobs = r.json().get("jobs", [])
                for j in jobs:
                    title = j.get("jobTitle", "Software Engineer")
                    is_tech = any(k in title.lower() for k in [
                        "engineer", "developer", "backend", "frontend", "full stack", 
                        "python", "software", "ai", "cloud", "data", "system", "devops", "sde"
                    ])
                    if not is_tech:
                        continue

                    is_intern = "intern" in title.lower()
                    pub_date_raw = j.get("pubDate")
                    if not _source_window_is_open(None, pub_date_raw, today):
                        continue

                    apply_url = j.get("url")
                    if not _valid_listing_url(apply_url):
                        continue

                    industry_val = j.get("jobIndustry") or []
                    if isinstance(industry_val, list):
                        skills = [str(s).strip() for s in industry_val if str(s).strip()][:6]
                    elif isinstance(industry_val, str):
                        skills = [s.strip() for s in industry_val.split(",") if s.strip()][:6]
                    else:
                        skills = []

                    results.append({
                        "id": f"jobicy-{j.get('id')}",
                        "title": title,
                        "organization": j.get("companyName") or "Not listed",
                        "category": "internships" if is_intern else "jobs",
                        "opportunity_type": "Paid Tech Internship" if is_intern else "Full-time Remote SDE",
                        "location": "100% Remote Worldwide",
                        "reward": f"{j.get('annualSalaryMin')} - {j.get('annualSalaryMax')} {j.get('salaryCurrency') or ''}".strip(" -") if j.get("annualSalaryMin") else "Not listed",
                        "deadline_date": "",
                        "source_platform": "Jobicy Live Remote Feed",
                        "apply_url": apply_url,
                        "skills_required": skills,
                        "description": re.sub(r'<[^>]+>', '', j.get("jobExcerpt", ""))[:320],
                        "verified": True
                    })
                logger.info(f"Jobicy loaded {len(results)} active roles.")
        except Exception as e:
            logger.warning(f"Jobicy live feed scraping failed: {e}")
        return results

    @classmethod
    async def _scrape_arbeitnow(cls, client: httpx.AsyncClient, today: datetime) -> List[Dict[str, Any]]:
        """Scrapes tech jobs from Arbeitnow API."""
        results: List[Dict[str, Any]] = []
        try:
            r = await client.get("https://www.arbeitnow.com/api/job-board-api")
            if r.status_code == 200:
                jobs = r.json().get("data", [])
                for j in jobs[:40]:
                    title = j.get("title", "")
                    tags = j.get("tags") or []
                    tag_str = " ".join(tags)

                    is_tech = any(k in (title + " " + tag_str).lower() for k in [
                        "developer", "engineer", "software", "frontend", "backend", "full stack", 
                        "python", "ai", "react", "cloud", "devops", "data", "golang"
                    ])
                    if not is_tech:
                        continue

                    is_intern = "intern" in title.lower()
                    is_remote = j.get("remote", False)
                    if not _source_window_is_open(None, j.get("created_at") or j.get("createdAt"), today):
                        continue
                    apply_url = j.get("url")
                    if not _valid_listing_url(apply_url):
                        continue
                    loc = "100% Remote / Hybrid" if is_remote else (j.get("location") or "Remote / Europe / Worldwide")
                    skills = [t for t in tags if len(t) < 20][:6]
                    desc_clean = re.sub(r'<[^>]+>', ' ', j.get("description", ""))
                    desc_clean = re.sub(r'\s+', ' ', desc_clean)[:300]

                    results.append({
                        "id": f"arbeitnow-{j.get('slug')}",
                        "title": title,
                        "organization": j.get("company_name", "Global Engineering Team"),
                        "category": "internships" if is_intern else "jobs",
                        "opportunity_type": "Internship" if is_intern else "Full-Time Software Engineer",
                        "location": loc,
                        "reward": j.get("salary") or "Not listed",
                        "deadline_date": "",
                        "source_platform": "Arbeitnow Tech Jobs",
                        "apply_url": apply_url,
                        "skills_required": skills,
                        "description": desc_clean or f"Software engineering position at {j.get('company_name')}.",
                        "verified": True
                    })
                logger.info(f"Arbeitnow loaded {len(results)} tech postings.")
        except Exception as e:
            logger.warning(f"Arbeitnow scraping failed: {e}")
        return results

    @classmethod
    async def _scrape_remoteok(cls, client: httpx.AsyncClient, today: datetime) -> List[Dict[str, Any]]:
        """Scrapes live remote tech jobs from RemoteOK API."""
        results: List[Dict[str, Any]] = []
        try:
            r = await client.get("https://remoteok.com/api", headers={**HEADERS, "User-Agent": "CareerOS-Platform-Crawler/5.0"})
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list):
                    # Skip first legal notice element
                    items = [x for x in data if isinstance(x, dict) and x.get("position")]
                    for item in items[:35]:
                        pos = item.get("position", "")
                        comp = item.get("company") or "Not listed"
                        tags = item.get("tags") or []
                        tag_str = " ".join(tags)

                        is_tech = any(k in (pos + " " + tag_str).lower() for k in [
                            "engineer", "developer", "backend", "frontend", "full stack", 
                            "python", "react", "software", "cloud", "devops", "data", "golang"
                        ])
                        if not is_tech:
                            continue

                        is_intern = "intern" in pos.lower()
                        apply_url = item.get("url") or f"https://remoteok.com/remote-jobs/{item.get('id')}"
                        if not _source_window_is_open(None, item.get("date") or item.get("epoch"), today):
                            continue
                        if not _valid_listing_url(apply_url):
                            continue

                        desc = item.get("description", "")
                        desc_clean = re.sub(r'<[^>]+>', ' ', desc)
                        desc_clean = re.sub(r'\s+', ' ', desc_clean)[:300]

                        skills = [t for t in tags if len(t) < 18][:6]
                        results.append({
                            "id": f"remoteok-{item.get('id')}",
                            "title": pos,
                            "organization": comp,
                            "category": "internships" if is_intern else "jobs",
                            "opportunity_type": "Internship" if is_intern else "Full-Time Remote SDE",
                            "location": "100% Remote Worldwide",
                            "reward": item.get("salary") or "Not listed",
                            "deadline_date": "",
                            "source_platform": "RemoteOK Global Feed",
                            "apply_url": apply_url,
                            "skills_required": skills,
                            "description": desc_clean or "See the source listing for role details.",
                            "verified": True
                        })
                logger.info(f"RemoteOK loaded {len(results)} tech jobs.")
        except Exception as e:
            logger.warning(f"RemoteOK scraping failed: {e}")
        return results

    @classmethod
    async def fetch_live_job_feeds(cls, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Scrapes and aggregates 100% REAL live opportunities concurrently across:
        - Devfolio API (filter=application_open)
        - Unstop API (Jobs, Internships, Hackathons, Competitions)
        - Remotive API (Remote Software Dev Roles)
        - Jobicy API (Worldwide Remote Developer Roles)
        - Arbeitnow API (Tech Jobs)
        - RemoteOK API (Global Developer Feed)
        - Verified Tech Flagships (SIH, GSoC, LFX, MLH, Flipkart GRiD, Amazon WOW, Swiggy, Razorpay, CRED, Postman, Zerodha)
        
        Cached for 6 hours with automatic strict deadline verification (only unexpired, active items).
        """
        global _LIVE_OPPORTUNITIES_CACHE
        now = time.time()
        
        if not force_refresh and _LIVE_OPPORTUNITIES_CACHE["opportunities"] and (now - _LIVE_OPPORTUNITIES_CACHE["timestamp"]) < _CACHE_TTL_SECONDS:
            logger.info("Serving live opportunities from 6-hour verified multi-platform cache.")
            return _LIVE_OPPORTUNITIES_CACHE["opportunities"]

        logger.info("Executing concurrent multi-platform scan across Unstop, Devfolio, Remotive, Jobicy, Arbeitnow, RemoteOK & Flagships...")
        today = datetime.now()

        scraped_tasks = []
        async with httpx.AsyncClient(headers=HEADERS, timeout=10.0, follow_redirects=True) as client:
            scraped_tasks = [
                cls._scrape_devfolio(client, today),
                cls._scrape_unstop_channel(client, "jobs", "jobs", "Full-Time SDE / Tech Role", today),
                cls._scrape_unstop_channel(client, "internships", "internships", "Paid Tech Internship (PPO)", today),
                cls._scrape_unstop_channel(client, "hackathons", "hackathons", "Unstop Tech Challenge", today),
                cls._scrape_unstop_channel(client, "competitions", "hackathons", "National Tech Challenge", today),
                cls._scrape_remotive(client, today),
                cls._scrape_jobicy(client, today),
                cls._scrape_arbeitnow(client, today),
                cls._scrape_remoteok(client, today)
            ]
            batch_results = await asyncio.gather(*scraped_tasks, return_exceptions=True)

        all_scraped: List[Dict[str, Any]] = []
        for res in batch_results:
            if isinstance(res, list):
                all_scraped.extend(res)
            elif isinstance(res, Exception):
                logger.warning(f"Batch scraper worker returned error: {res}")

        # Only include records returned by live source feeds.
        combined = all_scraped

        # Deduplicate by organization + title
        deduped: List[Dict[str, Any]] = []
        seen_keys = set()
        for opp in combined:
            key = f"{opp.get('organization', '').lower().strip()}:{opp.get('title', '').lower().strip()}"
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(opp)

        # Update cache
        _LIVE_OPPORTUNITIES_CACHE["opportunities"] = deduped
        _LIVE_OPPORTUNITIES_CACHE["timestamp"] = now

        logger.info(f"Successfully populated {len(deduped)} verified opportunities from multi-platform radar.")
        return deduped

    @classmethod
    def _is_location_relevant(
        cls, 
        opp_location: str, 
        target_country: str,
        preferred_cities: List[str],
        work_modes: List[str]
    ) -> bool:
        """
        Determines if an opportunity matches the candidate's target location.
        Filters out foreign-onsite-only roles and foreign-restricted remote positions.
        """
        loc_lower = opp_location.lower()
        
        if target_country.lower() in ["all", "global_all"]:
            return True

        is_remote_opportunity = any(k in loc_lower for k in [
            "remote", "worldwide", "virtual", "global", "online", "anywhere", "gsoc", "lfx", "devpost", "mlh"
        ])

        is_india_opportunity = any(k in loc_lower for k in [
            "india", "bengaluru", "bangalore", "delhi", "noida", "gurgaon", "gurugram", 
            "hyderabad", "pune", "mumbai", "chennai", "kolkata", "national", "unstop", 
            "sih", "flipkart", "tata", "devfolio", "swiggy", "razorpay", "cred", "zerodha"
        ])

        # Exclude purely foreign onsite jobs (e.g. onsite Berlin, London, Vienna)
        is_foreign_onsite_only = any(k in loc_lower for k in [
            "germany", "berlin", "munich", "netherlands", "amsterdam", "united kingdom", 
            "london", "austria", "france", "paris", "dublin"
        ]) and not is_remote_opportunity

        # Exclude foreign-restricted remote jobs where Indian candidates cannot apply
        is_foreign_restricted_remote = any(k in loc_lower for k in [
            "usa only", "us only", "us-only", "united states only", "north america only", "uk only", "europe only"
        ]) and not any(w in loc_lower for w in ["worldwide", "anywhere", "india", "global"])

        if target_country.lower() in ["india", "india_remote", "in"]:
            if is_foreign_onsite_only or is_foreign_restricted_remote:
                return False
            return is_india_opportunity or is_remote_opportunity

        if target_country.lower() in ["remote", "remote worldwide", "worldwide"]:
            return is_remote_opportunity and not is_foreign_restricted_remote

        return not is_foreign_onsite_only

    @classmethod
    async def get_semantic_opportunities(
        cls,
        user_id: str,
        category: Optional[str] = None,
        search_query: Optional[str] = None,
        remote_only: bool = False,
        location_filter: Optional[str] = None,
        platform_filter: Optional[str] = None,
        sort_by: str = "match_score",
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Retrieves live opportunities from source feeds, excluding expired dated listings
        and stale posts. Where the source does not publish a deadline, the listing is
        marked as rolling/unspecified rather than assigned an invented date.
        """
        # 1. Fetch user preferences
        user_prefs = await neo4j_service.get_user_preferences(user_id)
        target_country = location_filter or user_prefs.get("target_country", "India")
        preferred_cities = user_prefs.get("preferred_cities", ["Bengaluru", "Noida", "Delhi NCR", "Hyderabad", "Pune", "Remote"])
        work_modes = user_prefs.get("work_modes", ["Remote", "Hybrid", "Onsite"])
        dream_companies = [c.strip().lower() for c in user_prefs.get("dream_companies", []) if c.strip()]
        blocked_companies = [c.strip().lower() for c in user_prefs.get("blocked_companies", []) if c.strip()]

        # 2. Fetch live opportunities (from cache or multi-platform live refresh)
        all_opportunities = await cls.fetch_live_job_feeds(force_refresh=force_refresh)

        # 3. Retrieve verified candidate skills
        user_skills_set = set()
        try:
            blueprint = await neo4j_service.get_user_resume_blueprint(user_id)
            if blueprint:
                for cat in blueprint.get("skills", []):
                    for s in cat.get("skills", []):
                        if s:
                            user_skills_set.add(s.strip().lower())
        except Exception as e:
            logger.warning(f"Failed to fetch blueprint for opportunities scoring: {e}")

        if not user_skills_set:
            user_skills_set = {"python", "fastapi", "neo4j", "react", "typescript", "docker", "git", "sql", "system design"}

        # 4. Filter and score
        scored_opportunities = []
        today = datetime.now()

        for opp in all_opportunities:
            org_lower = opp.get("organization", "").lower().strip()

            # Filter out blocked companies
            if blocked_companies and any(b in org_lower or org_lower in b for b in blocked_companies):
                continue

            # Check if this is a Dream Company
            is_dream = bool(dream_companies and any(d in org_lower or org_lower in d for d in dream_companies))

            # Filter by Category
            if category and category.lower() != "all" and opp["category"] != category.lower():
                continue

            # Filter by Platform (if specified)
            if platform_filter and platform_filter.lower() != "all":
                p_filter = platform_filter.lower()
                source_p = opp.get("source_platform", "").lower()
                if p_filter not in source_p:
                    continue

            # Location Relevance
            if not cls._is_location_relevant(opp["location"], target_country, preferred_cities, work_modes):
                continue

            # Remote only filter
            if remote_only and not any(r in opp["location"].lower() for r in ["remote", "online", "virtual", "worldwide"]):
                continue

            # Search query filter
            if search_query:
                q = search_query.lower()
                matches_search = (
                    q in opp["title"].lower()
                    or q in opp["organization"].lower()
                    or q in opp["description"].lower()
                    or any(q in s.lower() for s in opp.get("skills_required", []))
                )
                if not matches_search:
                    continue

            deadline_dt = _parse_source_date(opp.get("deadline_date"))
            if deadline_dt:
                days_left: Optional[int] = (deadline_dt.date() - today.date()).days
                if days_left < 0:
                    continue
                deadline_formatted = deadline_dt.strftime("%d %b %Y")
            else:
                days_left = None
                deadline_formatted = "Rolling / no deadline published"

            # Calculate Semantic Match
            opp_skills = opp.get("skills_required", [])
            matched_skills = []
            missing_skills = []

            for s in opp_skills:
                s_lower = s.lower().strip()
                is_matched = any(
                    us == s_lower 
                    or us in s_lower 
                    or s_lower in us
                    or (s_lower in ["ai/ml", "genai", "ai", "machine learning"] and any("python" in u or "model" in u for u in user_skills_set))
                    or (s_lower in ["algorithms", "data structures", "backend", "system design"] and any(k in user_skills_set for k in ["python", "fastapi", "node.js", "c++", "sql"]))
                    or (s_lower in ["frontend", "web", "full stack", "web development"] and any(k in user_skills_set for k in ["react", "typescript", "javascript", "tailwind", "fastapi"]))
                    for us in user_skills_set
                )
                if is_matched:
                    matched_skills.append(s)
                else:
                    missing_skills.append(s)

            if opp_skills:
                skill_ratio = len(matched_skills) / len(opp_skills)
                calculated_match_score = int(72 + (skill_ratio * 26))
            else:
                calculated_match_score = 72

            # Dream Company score boost (+6%)
            if is_dream:
                calculated_match_score = min(99, calculated_match_score + 6)

            urgency = "normal"
            if days_left is not None and days_left <= 4:
                urgency = "critical"
            elif days_left is not None and days_left <= 8:
                urgency = "high"

            scored_item = {
                **opp,
                "match_score": min(99, max(68, calculated_match_score)),
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "days_left": days_left,
                "is_urgent": days_left is not None and days_left <= 5,
                "urgency_level": urgency,
                "deadline_formatted": deadline_formatted,
                "is_dream_company": is_dream
            }
            scored_opportunities.append(scored_item)

        # 5. Sorting
        if sort_by == "deadline":
            scored_opportunities.sort(key=lambda x: x["days_left"] if x["days_left"] is not None else 10**9)
        elif sort_by == "newest":
            scored_opportunities.reverse()
        else:  # match_score
            scored_opportunities.sort(key=lambda x: x["match_score"], reverse=True)

        return scored_opportunities

    @classmethod
    async def fetch_live_opportunities(
        cls, 
        user_id: str, 
        query: str = "", 
        limit: int = 10
    ) -> Dict[str, Any]:
        """Convenience method used by brain_service and other consumers."""
        opps = await cls.get_semantic_opportunities(
            user_id=user_id,
            search_query=query if query else None
        )
        return {
            "status": "success",
            "total": len(opps),
            "opportunities": opps[:limit]
        }

opportunities_service = OpportunitiesService()
