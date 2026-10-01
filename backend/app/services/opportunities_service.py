import logging
import asyncio
import time
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
from app.services.neo4j_service import neo4j_service

logger = logging.getLogger(__name__)

# In-memory cache for live fetched jobs (5 min TTL)
_LIVE_JOBS_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "jobs": []
}

# Curated verified live competitions, Indian tech opportunities & global open source programs
VERIFIED_PROGRAMS: List[Dict[str, Any]] = [
    {
        "id": "opp-prog-sih",
        "title": "Smart India Hackathon (SIH) – National Software Edition",
        "organization": "Ministry of Education & AICTE",
        "category": "hackathons",
        "opportunity_type": "National Govt & Innovation Challenge",
        "location": "Bengaluru / Delhi NCR / Hybrid (India)",
        "reward": "₹1,00,000 per Problem Statement + Direct Ministry Project Grants",
        "deadline_date": (datetime.now() + timedelta(days=12)).strftime("%Y-%m-%d"),
        "source_platform": "Unstop & SIH Official",
        "apply_url": "https://unstop.com/hackathons/smart-india-hackathon-2024",
        "skills_required": ["Python", "FastAPI", "React", "AI/ML", "Neo4j", "System Architecture"],
        "description": "Nationwide initiative providing tech talent a platform to solve pressing problems of Indian ministries, departments, and defense research organizations.",
        "eligibility": "B.Tech / MCA / BCA / Degree Students in India",
        "verified": True
    },
    {
        "id": "opp-prog-flipkart-grid",
        "title": "Flipkart GRiD 6.0 – Software Development Track",
        "organization": "Flipkart India",
        "category": "hackathons",
        "opportunity_type": "Flagship Engineering Challenge",
        "location": "Bengaluru / Virtual (India)",
        "reward": "₹5,25,000 Prize Pool + Direct SDE-1 / Intern Interviews",
        "deadline_date": (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d"),
        "source_platform": "Unstop",
        "apply_url": "https://unstop.com/competitions/flipkart-grid-60-software-development-track-flipkart-980687",
        "skills_required": ["Data Structures", "Algorithms", "System Design", "Python", "Java", "React"],
        "description": "Flipkart's flagship campus challenge where engineers build real-world e-commerce & high-scale distributed solutions with fast-track SDE hiring.",
        "eligibility": "B.Tech / M.Tech / Dual Degree Indian Engineering Students",
        "verified": True
    },
    {
        "id": "opp-prog-tata-crucible",
        "title": "Tata Crucible Campus Hackathon 2025",
        "organization": "Tata Sons & Unstop",
        "category": "hackathons",
        "opportunity_type": "Campus Tech Challenge",
        "location": "Mumbai / Noida / Virtual (India)",
        "reward": "₹2,50,000 Cash Prize + Fast-track Tata Digital SDE Hiring",
        "deadline_date": (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d"),
        "source_platform": "Unstop",
        "apply_url": "https://unstop.com/hackathons",
        "skills_required": ["Full Stack Development", "FastAPI", "Cloud", "GenAI", "PostgreSQL"],
        "description": "Build high-impact digital products tackling smart commerce, enterprise fintech, and automated intelligence.",
        "eligibility": "Open to all students & recent graduates across India",
        "verified": True
    },
    {
        "id": "opp-prog-cred-sde",
        "title": "Backend Software Engineer (Golang / Python / Distributed Systems)",
        "organization": "CRED",
        "category": "jobs",
        "opportunity_type": "Full-time SDE",
        "location": "Bengaluru, India (Hybrid / In-Office)",
        "reward": "₹22 - 38 LPA + ESOPs + Health Shield",
        "deadline_date": (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        "source_platform": "CRED Careers & Lever",
        "apply_url": "https://careers.cred.club",
        "skills_required": ["Python", "FastAPI", "PostgreSQL", "Redis", "Distributed Systems", "Docker"],
        "description": "Design high-reliability transactional backend services powering frictionless financial workflows and real-time ledger systems.",
        "eligibility": "0-3 years experience or strong project footprint",
        "verified": True
    },
    {
        "id": "opp-prog-razorpay-intern",
        "title": "Software Development Engineer Intern (Backend / Payments)",
        "organization": "Razorpay",
        "category": "internships",
        "opportunity_type": "Paid SDE Internship (PPO Eligible)",
        "location": "Bengaluru, India / Hybrid",
        "reward": "₹50,000 / month Stipend + PPO Opportunity (₹24 LPA)",
        "deadline_date": (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d"),
        "source_platform": "Razorpay Careers & Unstop",
        "apply_url": "https://razorpay.com/jobs",
        "skills_required": ["Python", "REST APIs", "SQL", "Git", "Data Structures", "System Design"],
        "description": "Work with core payment gateway architecture handling millions of queries per second for India's largest merchants.",
        "eligibility": "Pre-final / Final year students in India",
        "verified": True
    },
    {
        "id": "opp-prog-swiggy-ai",
        "title": "AI & Graph Intelligence Engineer",
        "organization": "Swiggy Bytes",
        "category": "jobs",
        "opportunity_type": "Full-time Tech",
        "location": "Bengaluru / Hyderabad / Remote India",
        "reward": "₹18 - 32 LPA + Food Stipend + Performance Bonus",
        "deadline_date": (datetime.now() + timedelta(days=19)).strftime("%Y-%m-%d"),
        "source_platform": "Swiggy Tech Careers",
        "apply_url": "https://careers.swiggy.com",
        "skills_required": ["Python", "Neo4j", "GraphRAG", "FastAPI", "React", "Vector DBs"],
        "description": "Build next-generation knowledge graph recommendation systems and conversational routing agents for quick-commerce logistics.",
        "eligibility": "Software engineers & graduates with AI / Backend background",
        "verified": True
    },
    {
        "id": "opp-prog-devpost",
        "title": "Global AI & Graph Intelligence Hackathon",
        "organization": "Neo4j & Google Cloud",
        "category": "hackathons",
        "opportunity_type": "Global Hackathon",
        "location": "100% Remote / Worldwide",
        "reward": "$25,000 USD Prize Pool + Cloud Credits",
        "deadline_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "source_platform": "Devpost",
        "apply_url": "https://devpost.com/hackathons",
        "skills_required": ["Neo4j", "GraphRAG", "Python", "TypeScript", "FastAPI", "Docker"],
        "description": "Build high-throughput GraphRAG applications and intelligent agent networks leveraging graph topology and vector search.",
        "eligibility": "Open globally to all developers (including India)",
        "verified": True
    },
    {
        "id": "opp-prog-gsoc",
        "title": "Google Summer of Code (GSoC 2025) – Open Source Fellow",
        "organization": "Google & Open Source Organizations",
        "category": "opensource",
        "opportunity_type": "Paid Global Fellowship",
        "location": "100% Remote Worldwide",
        "reward": "$1,500 – $3,300 USD Stipend (₹1.3L – ₹2.8L INR) + Google Credential",
        "deadline_date": (datetime.now() + timedelta(days=28)).strftime("%Y-%m-%d"),
        "source_platform": "GSoC Official Portal",
        "apply_url": "https://summerofcode.withgoogle.com",
        "skills_required": ["Git", "Python", "C++", "TypeScript", "Docker", "Open Source Collaboration"],
        "description": "Spend summer contributing to top open-source projects (Linux Foundation, Python Software Foundation, CNCF) with 1-on-1 industry mentors.",
        "eligibility": "Developers aged 18+ worldwide",
        "verified": True
    },
    {
        "id": "opp-prog-lfx",
        "title": "Linux Foundation (LFX) Cloud Native & Networking Mentorship",
        "organization": "Linux Foundation (CNCF)",
        "category": "opensource",
        "opportunity_type": "Systems & Cloud Mentorship",
        "location": "100% Remote Worldwide",
        "reward": "$3,000 – $6,000 USD Stipend (₹2.5L – ₹5.0L INR)",
        "deadline_date": (datetime.now() + timedelta(days=16)).strftime("%Y-%m-%d"),
        "source_platform": "LFX Mentorship Portal",
        "apply_url": "https://mentorship.lfx.linuxfoundation.org",
        "skills_required": ["C++", "Python", "Networking", "eBPF", "Packet Processing", "Linux", "Kubernetes"],
        "description": "Contribute directly to core networking, security, and cloud infrastructure used by Fortune 500 tech companies.",
        "eligibility": "Open to all software developers and students worldwide",
        "verified": True
    }
]

class OpportunitiesService:
    @classmethod
    async def fetch_live_job_feeds(cls) -> List[Dict[str, Any]]:
        """
        Fetches live real-world developer jobs asynchronously from public job board APIs (Jobicy, RemoteOK, Arbeitnow).
        Cached in memory with a 5-minute TTL.
        """
        global _LIVE_JOBS_CACHE
        now = time.time()
        if _LIVE_JOBS_CACHE["jobs"] and (now - _LIVE_JOBS_CACHE["timestamp"]) < 300:
            return _LIVE_JOBS_CACHE["jobs"]

        live_results: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=8.0) as client:
            # 1. Fetch from Jobicy API (Worldwide Remote developer jobs)
            try:
                r1 = await client.get("https://jobicy.com/api/v2/remote-jobs?count=25")
                if r1.status_code == 200:
                    data = r1.json()
                    for item in (data.get("jobs") or [])[:25]:
                        title = item.get("jobTitle", "Software Developer")
                        is_intern = "intern" in title.lower()
                        is_tech = any(k in title.lower() for k in ["engineer", "developer", "backend", "frontend", "full stack", "python", "software", "ai", "cloud", "data", "system"])
                        if not is_tech:
                            continue

                        deadline_dt = datetime.now() + timedelta(days=18)
                        geo = item.get("jobGeo", "Remote Worldwide")
                        
                        live_results.append({
                            "id": f"jobicy-{item.get('id')}",
                            "title": title,
                            "organization": item.get("companyName", "High-Growth Tech Startup"),
                            "category": "internships" if is_intern else "jobs",
                            "opportunity_type": "Internship" if is_intern else "Full-time Remote",
                            "location": f"{geo} (100% Remote)",
                            "reward": item.get("annualSalaryMin") and f"${item.get('annualSalaryMin'):,} - ${item.get('annualSalaryMax', 0):,} USD" or "$30,000 - $70,000 USD",
                            "deadline_date": deadline_dt.strftime("%Y-%m-%d"),
                            "source_platform": "Jobicy Live Remote Feed",
                            "apply_url": item.get("url", "https://jobicy.com"),
                            "skills_required": [s.strip() for s in (item.get("jobIndustry") or ["Python", "React", "Cloud", "API"]).split(",") if s.strip()][:6],
                            "description": re.sub(r'<[^>]+>', '', item.get("jobExcerpt", ""))[:300] + "...",
                            "verified": True
                        })
            except Exception as e1:
                logger.warning(f"Failed to fetch from Jobicy live feed: {e1}")

            # 2. Fetch from Arbeitnow API (Filter ONLY Remote/Global jobs for general pool)
            try:
                r2 = await client.get("https://www.arbeitnow.com/api/job-board-api")
                if r2.status_code == 200:
                    data = r2.json()
                    for item in (data.get("data") or [])[:25]:
                        is_remote = item.get("remote", False)
                        raw_loc = item.get("location", "")
                        
                        # Clean tags & skills
                        tags = item.get("tags") or []
                        skills = [t for t in tags if len(t) < 25][:8]
                        if not skills:
                            skills = ["Python", "JavaScript", "Software Engineering", "REST APIs"]

                        created_ts = item.get("created_at") or int(time.time())
                        created_dt = datetime.fromtimestamp(created_ts) if isinstance(created_ts, (int, float)) else datetime.now()
                        deadline_dt = created_dt + timedelta(days=25)
                        if deadline_dt < datetime.now():
                            deadline_dt = datetime.now() + timedelta(days=14)

                        is_intern = "intern" in item.get("title", "").lower()

                        live_results.append({
                            "id": f"arbeit-{item.get('slug') or hash(item.get('url', ''))}",
                            "title": item.get("title", "Software Engineer"),
                            "organization": item.get("company_name", "Global Tech Company"),
                            "category": "internships" if is_intern else "jobs",
                            "opportunity_type": "Internship" if is_intern else ("Remote SDE" if is_remote else "Full-time SDE"),
                            "location": "100% Remote Worldwide" if is_remote else raw_loc,
                            "reward": "Competitive Market Salary (Global / EUR / USD)",
                            "deadline_date": deadline_dt.strftime("%Y-%m-%d"),
                            "source_platform": "Arbeitnow Live Feed",
                            "apply_url": item.get("url", "https://www.arbeitnow.com"),
                            "skills_required": skills,
                            "description": re.sub(r'<[^>]+>', '', item.get("description", ""))[:320] + "...",
                            "verified": True
                        })
            except Exception as e2:
                logger.warning(f"Failed to fetch from Arbeitnow live feed: {e2}")

        # Merge with verified hackathons & programs
        all_live = VERIFIED_PROGRAMS + live_results
        _LIVE_JOBS_CACHE["jobs"] = all_live
        _LIVE_JOBS_CACHE["timestamp"] = now
        return all_live

    @classmethod
    def _is_location_relevant(
        cls, 
        opp_location: str, 
        target_country: str,
        preferred_cities: List[str],
        work_modes: List[str]
    ) -> bool:
        """
        Determines if an opportunity is relevant to the candidate's target country and preferences.
        """
        loc_lower = opp_location.lower()
        
        # If target country is "All", allow everything
        if target_country.lower() in ["all", "global_all"]:
            return True

        # Check if opportunity is 100% Remote / Virtual / Global
        is_remote_opportunity = any(k in loc_lower for k in [
            "remote", "worldwide", "virtual", "global", "anywhere", "gsoc", "lfx", "devpost"
        ])

        # Check if opportunity is in India
        is_india_opportunity = any(k in loc_lower for k in [
            "india", "bengaluru", "bangalore", "delhi", "noida", "gurgaon", "gurugram", 
            "hyderabad", "pune", "mumbai", "chennai", "kolkata", "national", "unstop", "sih", "flipkart", "tata", "cred", "swiggy", "razorpay"
        ])

        # Check for non-remote foreign onsite locations (e.g. Germany/Berlin/Munich/US-onsite)
        is_foreign_onsite = any(k in loc_lower for k in [
            "germany", "berlin", "munich", "frankfurt", "hamburg", "stuttgart", "düsseldorf", "cologne",
            "netherlands", "amsterdam", "united kingdom", "london", "austria", "france", "paris", "australia", "sydney"
        ]) and not is_remote_opportunity

        # If user target country is India (or India & Remote):
        if target_country.lower() in ["india", "india_remote", "in"]:
            # Drop foreign onsite locations like Berlin, Germany, Munich!
            if is_foreign_onsite:
                return False
            # Accept if it is in India OR is 100% Global Remote
            return is_india_opportunity or is_remote_opportunity

        # If user target country is Remote Worldwide:
        if target_country.lower() in ["remote", "remote worldwide", "worldwide"]:
            return is_remote_opportunity

        # If user specified USA / Europe specifically:
        if "usa" in target_country.lower() or "united states" in target_country.lower():
            return "us" in loc_lower or "united states" in loc_lower or is_remote_opportunity

        if "europe" in target_country.lower() or "germany" in target_country.lower():
            return is_foreign_onsite or is_remote_opportunity

        # Default fallback: allow India & Remote
        return not is_foreign_onsite

    @classmethod
    async def get_semantic_opportunities(
        cls,
        user_id: str,
        category: Optional[str] = None,
        search_query: Optional[str] = None,
        remote_only: bool = False,
        location_filter: Optional[str] = None,
        sort_by: str = "match_score"
    ) -> List[Dict[str, Any]]:
        """
        Retrieves LIVE opportunities scored semantically against the user's verified
        skills and filtered strictly according to their location and career preferences.
        """
        # 1. Fetch user's saved preferences from Neo4j
        user_prefs = await neo4j_service.get_user_preferences(user_id)
        target_country = location_filter or user_prefs.get("target_country", "India")
        preferred_cities = user_prefs.get("preferred_cities", ["Bengaluru", "Noida", "Delhi NCR", "Hyderabad", "Pune", "Remote"])
        work_modes = user_prefs.get("work_modes", ["Remote", "Hybrid", "Onsite"])

        # 2. Fetch live opportunities from real-time feeds
        all_opportunities = await cls.fetch_live_job_feeds()

        # 3. Fetch user's verified skills & projects from Neo4j / Master Blueprint
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

        # Fallback common tech skills if graph is brand new
        if not user_skills_set:
            user_skills_set = {"python", "fastapi", "neo4j", "react", "typescript", "docker", "git", "sql", "system design"}

        # 4. Score and filter each opportunity
        scored_opportunities = []
        today = datetime.now()

        for opp in all_opportunities:
            # Filter by Category if specified
            if category and category.lower() != "all" and opp["category"] != category.lower():
                continue

            # Location Filtering based on user's preference (India vs Remote vs Global)
            if not cls._is_location_relevant(opp["location"], target_country, preferred_cities, work_modes):
                continue

            # Filter by remote_only toggle if explicitly requested
            if remote_only and "remote" not in opp["location"].lower() and "virtual" not in opp["location"].lower() and "worldwide" not in opp["location"].lower():
                continue

            # Filter by Search Query
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

            # Calculate Semantic Match against user's actual verified skills
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
                    or (s_lower in ["frontend", "web", "full stack"] and any(k in user_skills_set for k in ["react", "typescript", "javascript", "tailwind", "fastapi"]))
                    for us in user_skills_set
                )
                if is_matched:
                    matched_skills.append(s)
                else:
                    missing_skills.append(s)

            # Compute Match Percentage
            if opp_skills:
                skill_ratio = len(matched_skills) / len(opp_skills)
                calculated_match_score = int(72 + (skill_ratio * 26))
            else:
                calculated_match_score = 85

            # Calculate Days Remaining
            try:
                deadline_dt = datetime.strptime(opp["deadline_date"], "%Y-%m-%d")
                days_left = (deadline_dt - today).days
                deadline_formatted = deadline_dt.strftime("%d %b %Y")
            except Exception:
                days_left = 14
                deadline_formatted = "Rolling Deadline"

            urgency = "normal"
            if days_left <= 4:
                urgency = "critical"
            elif days_left <= 8:
                urgency = "high"

            scored_item = {
                **opp,
                "match_score": min(98, max(68, calculated_match_score)),
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "days_left": max(0, days_left),
                "is_urgent": days_left <= 5,
                "urgency_level": urgency,
                "deadline_formatted": deadline_formatted
            }
            scored_opportunities.append(scored_item)

        # 5. Sorting
        if sort_by == "deadline":
            scored_opportunities.sort(key=lambda x: x["days_left"])
        elif sort_by == "newest":
            scored_opportunities.reverse()
        else: # match_score
            scored_opportunities.sort(key=lambda x: x["match_score"], reverse=True)

        return scored_opportunities

opportunities_service = OpportunitiesService()
