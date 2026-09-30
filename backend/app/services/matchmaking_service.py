import json
import logging
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from app.core.config import settings
from app.core.database import neo4j_client

logger = logging.getLogger(__name__)

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

JOB_SKILL_EXTRACT_PROMPT = """
You are an expert ATS and Job Analysis AI.
Extract the core required technical skills, role title, company name, and experience level from the following job description.

Output ONLY valid JSON with this exact structure:
{
  "company_name": "string",
  "job_title": "string",
  "experience_level": "Entry|Mid|Senior",
  "required_skills": ["Skill1", "Skill2", "Skill3"],
  "preferred_skills": ["Skill4", "Skill5"]
}

Job Description:
\"\"\"{job_text}\"\"\"
"""

REFERRAL_PITCH_PROMPT = """
You are an elite career strategist and executive outreach copywriter.
Generate a concise, ultra-personalized, high-conversion referral outreach message to a target connection on LinkedIn or email.

Candidate Profile:
- Name: {candidate_name}
- Alma Mater / College: {candidate_college}
- Top Code-Backed Projects: {candidate_projects}
- Key Skills: {candidate_skills}
- Hackathons & Milestones: {candidate_milestones}

Target Opportunity:
- Company: {target_company}
- Role: {job_title}
- Required Tech Stack: {required_skills}

Target Connection:
- Connection Name: {contact_name}
- Connection Title: {contact_title}
- Relationship Bridge: {relationship_bridge}

Guidelines:
1. Keep it concise (under 120 words). No generic fluff.
2. Directly reference the relationship bridge (e.g. shared college alumni, shared tech stack, or 1st-degree connection).
3. Mention 1 specific relevant project built by the candidate with real impact as proof of work.
4. Clear, respectful call to action (asking for brief advice or referral).
5. Provide two versions: (A) LinkedIn 300-character Connection Note, and (B) InMail / Email format.

Output JSON:
{
  "linkedin_note": "string (under 300 chars)",
  "full_message": "string (subject line + body + CTA)",
  "key_talking_points": ["point 1", "point 2"]
}
"""

class MatchmakingService:
    @classmethod
    async def extract_job_requirements(cls, job_text: str) -> Dict[str, Any]:
        """
        Parses raw job description into structured requirements using Gemini AI.
        """
        if not settings.GEMINI_API_KEY:
            return {
                "company_name": "Target Company",
                "job_title": "Software Engineer",
                "experience_level": "Mid",
                "required_skills": ["Python", "FastAPI", "PostgreSQL"],
                "preferred_skills": ["React", "Docker"]
            }

        try:
            import asyncio
            model = genai.GenerativeModel("gemini-3.5-flash-lite")
            prompt = JOB_SKILL_EXTRACT_PROMPT.replace("{job_text}", job_text[:15000])
            response = await asyncio.to_thread(model.generate_content, prompt)
            clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except Exception as e:
            logger.error(f"Failed to parse job description with Gemini: {e}")
            return {
                "company_name": "Target Company",
                "job_title": "Software Engineer",
                "experience_level": "Mid",
                "required_skills": ["Python", "JavaScript", "React"],
                "preferred_skills": []
            }

    @classmethod
    async def analyze_match_against_graph(
        cls,
        user_id: str,
        job_req: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Traverses candidate's Neo4j Knowledge Graph to calculate:
        1. Skill match percentage (Code-verified vs claimed vs missing)
        2. Best matching portfolio projects
        3. Real-world hackathons & experience alignment
        4. Target company referral bridges (Alumni & direct connections)
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            return {"status": "error", "message": "Graph disconnected"}

        required_skills = [s.strip().lower() for s in job_req.get("required_skills", []) if s.strip()]
        preferred_skills = [s.strip().lower() for s in job_req.get("preferred_skills", []) if s.strip()]
        all_target_skills = list(set(required_skills + preferred_skills))

        # 1. Query User's Skills & Project Evidence
        skill_query = """
        MATCH (u:User {id: $user_id})-[r:HAS_SKILL]->(s:Skill)
        OPTIONAL MATCH (u)-[:BUILT]->(p:Project)-[:USES_TECH]->(s)
        RETURN s.name AS skill,
               s.category AS category,
               collect(DISTINCT p.name) AS projects,
               count(DISTINCT p) > 0 AS is_verified
        """
        skills_data = await neo4j_client.execute_query(skill_query, {"user_id": user_id})

        user_skills_map = {}
        for row in skills_data:
            user_skills_map[row["skill"].lower()] = {
                "name": row["skill"],
                "category": row.get("category"),
                "is_verified": row["is_verified"],
                "projects": row["projects"]
            }

        matched_skills = []
        missing_skills = []
        code_verified_matches = []

        for target_s in all_target_skills:
            # Fuzzy substring or exact match
            found_key = None
            for u_skill_lower in user_skills_map.keys():
                if target_s in u_skill_lower or u_skill_lower in target_s:
                    found_key = u_skill_lower
                    break
            
            if found_key:
                info = user_skills_map[found_key]
                matched_skills.append(info["name"])
                if info["is_verified"]:
                    code_verified_matches.append({
                        "skill": info["name"],
                        "evidence_projects": info["projects"]
                    })
            else:
                missing_skills.append(target_s.title())

        # Match Score Calculation
        total_target = max(len(all_target_skills), 1)
        match_score = min(100, int((len(matched_skills) / total_target) * 100))

        # 2. Query Best Matching Projects
        proj_query = """
        MATCH (u:User {id: $user_id})-[:BUILT]->(p:Project)-[:USES_TECH]->(s:Skill)
        WHERE toLower(s.name) IN $target_skills
        RETURN p.name AS name,
               p.description AS description,
               p.repo_url AS repo_url,
               p.primary_language AS primary_language,
               coalesce(p.stars_count, 0) AS stars,
               collect(DISTINCT s.name) AS matched_tech,
               count(DISTINCT s) AS match_count
        ORDER BY match_count DESC, stars DESC
        LIMIT 3
        """
        top_projects = await neo4j_client.execute_query(proj_query, {
            "user_id": user_id,
            "target_skills": all_target_skills
        })

        # 3. Query Universal Multi-Source Referral Bridges
        target_company = job_req.get("company_name", "").strip()
        referral_query = """
        MATCH (u:User {id: $user_id})
        
        // 1. User Context
        OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)
        OPTIONAL MATCH (univ)-[:AFFILIATED_WITH]->(grp:EducationGroup)
        OPTIONAL MATCH (u)-[:WORKED_AT]->(past_comp:Company)
        OPTIONAL MATCH (u)-[:PARTICIPATED_IN]->(hack:Hackathon)

        // 2. Target Company Employees
        OPTIONAL MATCH (p:Person)-[:WORKS_AT]->(c:Company)
        WHERE toLower(c.name) CONTAINS toLower($company)
           OR toLower($company) CONTAINS toLower(c.name)

        // 3. Person Context
        OPTIONAL MATCH (p)-[:ATTENDED]->(p_univ:University)
        OPTIONAL MATCH (p_univ)-[:AFFILIATED_WITH]->(p_grp:EducationGroup)
        OPTIONAL MATCH (p)-[:WORKED_AT]->(p_past_comp:Company)

        RETURN DISTINCT p.name AS name,
               p.position AS position,
               coalesce(c.name, $company) AS company,
               coalesce(p_univ.name, univ.name, 'Alumni Network') AS college,
               CASE 
                 WHEN (u)-[:CONNECTED_TO]->(p) THEN '1st Degree Direct Connection'
                 WHEN univ IS NOT NULL AND p_univ IS NOT NULL AND univ = p_univ THEN 'Direct University Alumni Bridge'
                 WHEN grp IS NOT NULL AND p_grp IS NOT NULL AND grp = p_grp THEN grp.name + ' Alumni Bridge'
                 WHEN past_comp IS NOT NULL AND p_past_comp IS NOT NULL AND past_comp = p_past_comp THEN 'Ex-Colleague (' + past_comp.name + ') Bridge'
                 WHEN hack IS NOT NULL AND toLower(hack.organizer) CONTAINS toLower($company) THEN 'Hackathon Sponsor (' + hack.name + ') Bridge'
                 ELSE 'Company Employee Network'
               END AS connection_bridge
        LIMIT 6
        """
        referral_bridges = []
        if target_company and target_company.lower() not in ["target company", "confidential", ""]:
            referral_bridges = await neo4j_client.execute_query(referral_query, {
                "user_id": user_id,
                "company": target_company
            })

        return {
            "status": "success",
            "job_summary": {
                "company": target_company,
                "title": job_req.get("job_title", "Software Engineer"),
                "experience_level": job_req.get("experience_level", "Mid"),
                "total_required_skills": len(all_target_skills)
            },
            "match_metrics": {
                "match_percentage": match_score,
                "matched_skills_count": len(matched_skills),
                "code_verified_matches_count": len(code_verified_matches),
                "missing_skills_count": len(missing_skills),
                "referral_bridges_found": len(referral_bridges)
            },
            "skills_breakdown": {
                "matched_skills": matched_skills,
                "code_verified_proofs": code_verified_matches,
                "missing_skills": missing_skills
            },
            "top_relevant_projects": top_projects,
            "referral_bridges": referral_bridges
        }

    @classmethod
    async def generate_personalized_pitch(
        cls,
        user_id: str,
        job_summary: Dict[str, Any],
        target_contact: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Uses Gemini / Groq to write a tailored, high-converting outreach message.
        """
        # Fetch candidate profile details
        user_query = """
        MATCH (u:User {id: $user_id})
        OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)
        OPTIONAL MATCH (u)-[:BUILT]->(p:Project)
        OPTIONAL MATCH (u)-[:PARTICIPATED_IN]->(h:Hackathon)
        RETURN u.full_name AS full_name,
               univ.name AS college,
               collect(DISTINCT p.name)[0..3] AS top_projects,
               collect(DISTINCT h.name)[0..2] AS milestones
        """
        user_res = await neo4j_client.execute_query(user_query, {"user_id": user_id})
        user_info = user_res[0] if user_res else {}

        candidate_name = user_info.get("full_name") or "Mohit Upraity"
        candidate_college = user_info.get("college") or "Anand Engineering College"
        projects_str = ", ".join(user_info.get("top_projects", ["RecoverIQ", "FestFlow", "SmartAI-invoice"]))
        milestones_str = ", ".join(user_info.get("milestones", ["Microsoft Noida Hackathon", "Smart India Hackathon Runner Up"]))

        try:
            import asyncio
            model = genai.GenerativeModel("gemini-3.5-flash-lite")
            prompt = (
                REFERRAL_PITCH_PROMPT
                .replace("{candidate_name}", candidate_name)
                .replace("{candidate_college}", candidate_college)
                .replace("{candidate_projects}", projects_str)
                .replace("{candidate_skills}", str(job_summary.get("matched_skills", "Python, FastAPI, React, PostgreSQL")))
                .replace("{candidate_milestones}", milestones_str)
                .replace("{target_company}", str(job_summary.get("company", "the company")))
                .replace("{job_title}", str(job_summary.get("title", "Software Engineer")))
                .replace("{required_skills}", str(job_summary.get("matched_skills", "Python, Distributed Systems")))
                .replace("{contact_name}", str(target_contact.get("name", "Connection")))
                .replace("{contact_title}", str(target_contact.get("position", "Engineer")))
                .replace("{relationship_bridge}", str(target_contact.get("connection_bridge", "Alumni / Shared Network")))
            )
            response = await asyncio.to_thread(model.generate_content, prompt)
            clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except Exception as e:
            logger.error(f"Referral pitch generation failed: {e}")
            return {
                "linkedin_note": f"Hi {target_contact.get('name', '')}, noticed we share {candidate_college}! Built {projects_str.split(',')[0]} (FastAPI/React). Saw an opening on your team at {job_summary.get('company', '')} — would love to connect!",
                "full_message": f"Hi {target_contact.get('name', '')},\n\nI hope you're doing well! I saw your work at {job_summary.get('company', '')} and noticed our shared connection through {candidate_college}.\n\nI recently built {projects_str} and participated in {milestones_str}. I saw the {job_summary.get('title', 'Software Engineer')} role open on your team and would be grateful for your brief advice or a referral if you feel my background aligns.\n\nBest regards,\n{candidate_name}",
                "key_talking_points": ["Shared Alma Mater", "Proof of code: " + projects_str]
            }

matchmaking_service = MatchmakingService()
