import logging
from typing import Dict, Any, List
from app.core.database import neo4j_client

logger = logging.getLogger(__name__)

class ProfileService:
    @classmethod
    async def get_comprehensive_profile_analysis(cls, user_id: str) -> Dict[str, Any]:
        """
        Executes deep Graph traversal queries to analyze user's career footprint:
        1. Unified Skills Breakdown (GitHub-verified vs Resume-extracted)
        2. Impact Projects & Tech Stack Matrix
        3. Work Experience & Career Timeline
        4. College & Alumni Referral Reach Matrix (Companies where user has connections/alumni)
        5. Profile Strength & Readiness Insights
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            return {"status": "error", "message": "Graph database disconnected"}

        # 1. Fetch User Identity and Education
        user_query = """
        MATCH (u:User {id: $user_id})
        OPTIONAL MATCH (u)-[r_edu:ATTENDED]->(univ:University)
        RETURN u.full_name AS full_name,
               u.email AS email,
               u.github_username AS github_username,
               u.linkedin_url AS linkedin_url,
               collect(DISTINCT {
                   university: univ.name,
                   degree: r_edu.degree,
                   field_of_study: r_edu.field_of_study,
                   end_date: r_edu.end_date
               }) AS education
        """
        user_res = await neo4j_client.execute_query(user_query, {"user_id": user_id})
        user_info = user_res[0] if user_res else {}

        # 2. Fetch Verified Skills & Evidence Source
        skills_query = """
        MATCH (u:User {id: $user_id})-[r:HAS_SKILL]->(s:Skill)
        OPTIONAL MATCH (u)-[:BUILT]->(p:Project)-[:USES_TECH]->(s)
        RETURN s.name AS skill,
               s.category AS category,
               collect(DISTINCT r.source) AS sources,
               collect(DISTINCT p.name) AS backed_by_projects,
               count(DISTINCT p) AS project_count
        ORDER BY project_count DESC, s.name ASC
        """
        skills_res = await neo4j_client.execute_query(skills_query, {"user_id": user_id})

        # Categorize skills
        verified_skills = []
        resume_only_skills = []
        for s in skills_res:
            item = {
                "name": s["skill"],
                "category": s.get("category") or "Technical",
                "verified_by_code": len(s["backed_by_projects"]) > 0,
                "evidence_projects": s["backed_by_projects"],
                "sources": s["sources"]
            }
            if item["verified_by_code"]:
                verified_skills.append(item)
            else:
                resume_only_skills.append(item)

        # 3. Fetch Projects Matrix
        projects_query = """
        MATCH (u:User {id: $user_id})-[:BUILT]->(p:Project)
        OPTIONAL MATCH (p)-[:USES_TECH]->(s:Skill)
        RETURN p.id AS id,
               p.name AS name,
               p.description AS description,
               p.repo_url AS repo_url,
               p.stars_count AS stars,
               p.primary_language AS primary_language,
               collect(DISTINCT s.name) AS tech_stack
        ORDER BY p.stars_count DESC, p.name ASC
        """
        projects = await neo4j_client.execute_query(projects_query, {"user_id": user_id})

        # 4. Fetch Work Experience
        exp_query = """
        MATCH (u:User {id: $user_id})-[r:WORKED_AT]->(c:Company)
        RETURN c.name AS company,
               r.role AS role,
               r.start_date AS start_date,
               r.end_date AS end_date,
               r.is_current AS is_current
        ORDER BY r.start_date DESC
        """
        experience = await neo4j_client.execute_query(exp_query, {"user_id": user_id})

        # 5. Fetch Hackathons & Competitions
        hack_query = """
        MATCH (u:User {id: $user_id})-[r:PARTICIPATED_IN]->(h:Hackathon)
        RETURN h.name AS name,
               h.organizer AS organizer,
               h.location AS location,
               r.project_built AS project_built,
               r.highlights AS highlights,
               r.date AS date
        """
        hackathons = await neo4j_client.execute_query(hack_query, {"user_id": user_id})

        # 6. Fetch Achievements
        ach_query = """
        MATCH (u:User {id: $user_id})-[:ACHIEVED]->(a:Achievement)
        RETURN a.title AS title,
               a.organization AS organization,
               a.description AS description,
               a.date AS date
        """
        achievements = await neo4j_client.execute_query(ach_query, {"user_id": user_id})

        # 7. Fetch Certifications
        cert_query = """
        MATCH (u:User {id: $user_id})-[:EARNED]->(c:Certification)
        RETURN c.name AS name,
               c.issuer AS issuer,
               c.date AS date
        """
        certifications = await neo4j_client.execute_query(cert_query, {"user_id": user_id})

        # 8. Network & Alumni Reach Analysis
        network_reach_query = """
        MATCH (u:User {id: $user_id})
        OPTIONAL MATCH (u)-[:CONNECTED_TO]->(p:Person)-[:WORKS_AT]->(c:Company)
        OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)<-[:ATTENDED]-(alumni:Person)-[:WORKS_AT]->(alumni_comp:Company)
        RETURN count(DISTINCT p) AS total_connections,
               collect(DISTINCT c.name) AS connection_companies,
               count(DISTINCT alumni) AS total_alumni,
               collect(DISTINCT alumni_comp.name) AS alumni_companies
        """
        network_res = await neo4j_client.execute_query(network_reach_query, {"user_id": user_id})
        network_stats = network_res[0] if network_res else {
            "total_connections": 0,
            "connection_companies": [],
            "total_alumni": 0,
            "alumni_companies": []
        }

        # 9. Calculate Career Readiness & Profile Strength Score
        total_skills_count = len(skills_res)
        verified_count = len(verified_skills)
        proj_count = len(projects)
        exp_count = len(experience)
        hack_count = len(hackathons)
        network_count = network_stats.get("total_connections", 0)

        # Strength calculation (out of 100)
        strength_score = min(100, int(
            (min(verified_count, 10) * 3.0) +  # Max 30 pts from code-backed skills
            (min(proj_count, 5) * 4) +          # Max 20 pts from GitHub projects
            (min(exp_count, 3) * 5.0) +         # Max 15 pts from work experience
            (min(hack_count, 3) * 5.0) +        # Max 15 pts from hackathons/events
            (min(network_count, 20) * 1.0)      # Max 20 pts from network connections
        ))

        # Strategic recommendations
        recommendations = []
        if verified_count < 5:
            recommendations.append("Connect more GitHub repositories to verify your claimed resume skills with real code.")
        if hack_count == 0:
            recommendations.append("Import your LinkedIn posts/shares to index hackathons like Microsoft Noida Hackathon into the graph.")
        if network_count < 10:
            recommendations.append("Import your LinkedIn connections CSV to unlock hidden alumni referral bridges.")
        if strength_score >= 70:
            recommendations.append("High profile completeness! Ready for automated Job Matchmaking and AI Referral Pitch Generation.")

        return {
            "status": "success",
            "user_id": user_id,
            "profile": {
                "full_name": user_info.get("full_name") or "Mohit Upraity",
                "email": user_info.get("email"),
                "github_username": user_info.get("github_username"),
                "linkedin_url": user_info.get("linkedin_url"),
                "education": user_info.get("education", [])
            },
            "metrics": {
                "profile_strength_score": strength_score,
                "total_skills": total_skills_count,
                "code_verified_skills_count": verified_count,
                "resume_skills_count": len(resume_only_skills),
                "total_projects": proj_count,
                "total_work_experiences": exp_count,
                "total_hackathons": hack_count,
                "network_reach_connections": network_count
            },
            "skills_analysis": {
                "code_verified_skills": verified_skills,
                "resume_only_skills": resume_only_skills
            },
            "projects": projects,
            "experience": experience,
            "hackathons": hackathons,
            "achievements": achievements,
            "certifications": certifications,
            "network_intelligence": {
                "total_connections": network_stats.get("total_connections", 0),
                "target_companies_accessible": list(set(
                    [c for c in network_stats.get("connection_companies", []) if c] +
                    [c for c in network_stats.get("alumni_companies", []) if c]
                ))
            },
            "recommendations": recommendations
        }

profile_service = ProfileService()

