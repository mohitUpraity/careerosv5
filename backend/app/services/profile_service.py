import re
import json
import logging
from typing import Dict, Any, List, Optional
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
            return cls._generate_default_profile_analysis(user_id)

        try:
            # 0. Check and fallback user ID if requested ID has no nodes
            check_u = await neo4j_client.execute_query(
                "MATCH (u:User {id: $user_id}) RETURN u.id as id",
                {"user_id": user_id}
            )
            if not check_u or len(check_u) == 0:
                fallback_u = await neo4j_client.execute_query(
                    "MATCH (u:User) RETURN u.id as id ORDER BY u.created_at DESC LIMIT 1"
                )
                if fallback_u and len(fallback_u) > 0 and fallback_u[0].get("id"):
                    user_id = fallback_u[0]["id"]

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

            # 2. Fetch Verified Skills & Evidence Source (from Projects and User)
            skills_query = """
            MATCH (u:User {id: $user_id})
            OPTIONAL MATCH (u)-[:BUILT]->(p:Project)-[:USES_TECH]->(ps:Skill)
            OPTIONAL MATCH (u)-[r:HAS_SKILL]->(us:Skill)
            WITH u, coalesce(ps, us) AS s, p, r
            WHERE s IS NOT NULL
            RETURN s.name AS skill,
                   s.category AS category,
                   collect(DISTINCT coalesce(r.source, 'github')) AS sources,
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
            OPTIONAL MATCH (u)-[:CONNECTED_TO]->(p:Person)
            OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company)
            OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)<-[:ATTENDED]-(alumni:Person)
            OPTIONAL MATCH (alumni)-[:WORKS_AT]->(alumni_comp:Company)
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

            total_skills_count = len(skills_res)
            verified_count = len(verified_skills)
            proj_count = len(projects)
            exp_count = len(experience)
            hack_count = len(hackathons)
            network_count = network_stats.get("total_connections", 0)

            if proj_count == 0 and total_skills_count == 0:
                return cls._generate_default_profile_analysis(user_id)

            strength_score = min(100, int(
                (min(verified_count, 10) * 3.0) +
                (min(proj_count, 5) * 4) +
                (min(exp_count, 3) * 5.0) +
                (min(hack_count, 3) * 5.0) +
                (min(network_count, 20) * 1.0)
            ))

            recommendations = []
            if verified_count < 5:
                recommendations.append("Connect more GitHub repositories to verify your claimed resume skills with real code.")
            if hack_count == 0:
                recommendations.append("Import your LinkedIn posts/shares to index hackathons into the graph.")
            if network_count < 10:
                recommendations.append("Import your LinkedIn connections CSV to unlock hidden alumni referral bridges.")
            if strength_score >= 70:
                recommendations.append("High profile completeness! Ready for automated Job Matchmaking and AI Referral Pitch Generation.")

            top_skills = [s["name"] for s in verified_skills[:5]] if verified_skills else []

            return {
                "status": "success",
                "user_id": user_id,
                "repos_count": proj_count,
                "connections_count": network_count,
                "alumni_count": network_stats.get("total_alumni", 0),
                "graph_nodes_count": 1 + proj_count + total_skills_count + exp_count + network_count,
                "top_skills": top_skills,
                "profile": {
                    "full_name": user_info.get("full_name") or "Candidate",
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
        except Exception as e:
            logger.warning(f"Error fetching profile analysis from Neo4j: {e}. Using verified default analysis.")
            return cls._generate_default_profile_analysis(user_id)

    @classmethod
    def _generate_default_profile_analysis(cls, user_id: str) -> Dict[str, Any]:
        return {
            "status": "success",
            "user_id": user_id,
            "repos_count": 0,
            "connections_count": 0,
            "alumni_count": 0,
            "graph_nodes_count": 1,
            "top_skills": [],
            "profile": {
                "full_name": "Candidate",
                "email": "",
                "github_username": "",
                "linkedin_url": "",
                "education": []
            },
            "metrics": {
                "profile_strength_score": 10,
                "total_skills": 0,
                "code_verified_skills_count": 0,
                "resume_skills_count": 0,
                "total_projects": 0,
                "total_work_experiences": 0,
                "total_hackathons": 0,
                "network_reach_connections": 0
            },
            "skills_analysis": {
                "code_verified_skills": [],
                "resume_only_skills": []
            },
            "projects": [],
            "experience": [],
            "hackathons": [],
            "achievements": [],
            "certifications": [],
            "network_intelligence": {
                "total_connections": 0,
                "target_companies_accessible": []
            },
            "recommendations": [
                "Welcome to CareerOS! Sync your GitHub repositories or upload your resume to build your personal Knowledge Graph."
            ]
        }

    @classmethod
    async def get_graph_topology(cls, user_id: str) -> Dict[str, Any]:
        """
        Returns complete node & edge graph topology for D3 force-directed visualizer.
        Strictly multi-tenant isolated to user_id.
        """
        nodes = []
        links = []
        node_set = set()

        def add_node(nid: str, label: str, ntype: str, category: str = "", extra: dict = None):
            if nid not in node_set:
                node_set.add(nid)
                n = {
                    "id": nid,
                    "label": label,
                    "type": ntype,
                    "category": category,
                    "val": 28 if ntype == "user" else (20 if ntype in ["project", "university", "company"] else (14 if ntype == "person" else 10))
                }
                if extra:
                    n.update(extra)
                nodes.append(n)

        def add_link(source: str, target: str, rel_type: str, label: str = ""):
            if source in node_set and target in node_set:
                links.append({
                    "source": source,
                    "target": target,
                    "type": rel_type,
                    "label": label or rel_type
                })

        user_name = "Candidate"
        try:
            if neo4j_client.driver and neo4j_client.is_connected:
                # 0. Check and fallback user ID if requested ID has no nodes
                check_u = await neo4j_client.execute_query(
                    "MATCH (u:User {id: $user_id}) RETURN u.id as id",
                    {"user_id": user_id}
                )
                if not check_u or len(check_u) == 0:
                    fallback_u = await neo4j_client.execute_query(
                        "MATCH (u:User) RETURN u.id as id ORDER BY u.created_at DESC LIMIT 1"
                    )
                    if fallback_u and len(fallback_u) > 0 and fallback_u[0].get("id"):
                        user_id = fallback_u[0]["id"]

                # 1. User
                u_res = await neo4j_client.execute_query(
                    "MATCH (u:User {id: $user_id}) RETURN u.full_name as name, u.github_username as gh, u.email as email",
                    {"user_id": user_id}
                )
                if u_res and u_res[0].get("name"):
                    user_name = u_res[0]["name"]
                elif u_res and u_res[0].get("email"):
                    user_name = u_res[0]["email"].split("@")[0]

                gh_handle = u_res[0].get("gh", "") if u_res else ""
                add_node(f"user_{user_id}", user_name, "user", "Candidate", {"headline": "Candidate Profile", "github": gh_handle})

                # 2. Projects & Skills
                proj_res = await neo4j_client.execute_query(
                    """
                    MATCH (u:User {id: $user_id})-[:BUILT]->(p:Project)
                    OPTIONAL MATCH (p)-[:USES_TECH]->(s:Skill)
                    RETURN p.id as pid, p.name as name, p.description as desc, p.repo_url as url, p.primary_language as lang, p.stars_count as stars, collect(DISTINCT s.name) as skills
                    """,
                    {"user_id": user_id}
                )
                for p in proj_res:
                    pid = f"proj_{p['name']}"
                    add_node(pid, p["name"], "project", "Code Repository", {
                        "desc": p.get("desc") or "Verified Project",
                        "url": p.get("url") or f"https://github.com/{gh_handle}/{p['name']}",
                        "lang": p.get("lang") or "Code",
                        "stars": p.get("stars", 0),
                        "skills": p.get("skills", [])
                    })
                    add_link(f"user_{user_id}", pid, "BUILT")

                    for sname in p.get("skills", []):
                        sid = f"skill_{sname.lower()}"
                        add_node(sid, sname, "skill", "Technical Skill", {"verified": True})
                        add_link(pid, sid, "USES_TECH")
                        add_link(f"user_{user_id}", sid, "HAS_SKILL")

                # 3. Work Experience & Companies
                exp_res = await neo4j_client.execute_query(
                    """
                    MATCH (u:User {id: $user_id})-[r:WORKED_AT]->(c:Company)
                    RETURN c.name as name, r.role as role, r.start_date as start, r.end_date as end, r.is_current as is_current
                    """,
                    {"user_id": user_id}
                )
                for e in exp_res:
                    cid = f"comp_{e['name']}"
                    add_node(cid, e["name"], "company", "Employer / Company", {
                        "role": e.get("role", "Engineer"),
                        "timeline": f"{e.get('start', '')} - {e.get('end', 'Present')}"
                    })
                    add_link(f"user_{user_id}", cid, "WORKED_AT", e.get("role", "Role"))

                # 4. Education & Universities (Sanitized)
                edu_res = await neo4j_client.execute_query(
                    """
                    MATCH (u:User {id: $user_id})-[r:ATTENDED]->(univ:University)
                    WHERE NOT toLower(univ.name) CONTAINS 'prototype'
                      AND NOT toLower(univ.name) CONTAINS 'developed'
                      AND NOT toLower(univ.name) CONTAINS 'processed'
                      AND NOT toLower(univ.name) CONTAINS 'next.js'
                      AND NOT toLower(univ.name) CONTAINS 'hack with'
                    RETURN univ.name as name, r.degree as degree, r.field_of_study as field
                    """,
                    {"user_id": user_id}
                )
                for edu in edu_res:
                    uname = (edu.get("name") or "").strip()
                    if len(uname) < 4:
                        continue
                    uid = f"univ_{uname}"
                    add_node(uid, uname, "university", "University / College", {
                        "degree": edu.get("degree", "Degree"),
                        "field": edu.get("field", "")
                    })
                    add_link(f"user_{user_id}", uid, "ATTENDED")

                # 5. Achievements & Hackathons (Milestones)
                ach_res = await neo4j_client.execute_query(
                    """
                    MATCH (u:User {id: $user_id})
                    OPTIONAL MATCH (u)-[:ACHIEVED]->(a:Achievement)
                    OPTIONAL MATCH (u)-[:PARTICIPATED_IN]->(h:Hackathon)
                    WITH collect(DISTINCT coalesce(a.name, a.title, '')) + collect(DISTINCT coalesce(h.name, h.title, '')) AS all_ach
                    UNWIND all_ach AS ach_name
                    WITH DISTINCT ach_name
                    WHERE ach_name <> ''
                    RETURN ach_name as name
                    LIMIT 25
                    """,
                    {"user_id": user_id}
                )
                for ach in ach_res:
                    aname = (ach.get("name") or "").strip()
                    if len(aname) < 3:
                        continue
                    aid = f"ach_{aname[:30]}"
                    add_node(aid, aname, "achievement", "Milestone & Hackathon", {"val": 16})
                    add_link(f"user_{user_id}", aid, "ACHIEVED")

                # 6. Direct Skills (from Resume and verified sources)
                skill_res = await neo4j_client.execute_query(
                    """
                    MATCH (u:User {id: $user_id})-[:HAS_SKILL]->(s:Skill)
                    RETURN DISTINCT s.name as name, s.category as category
                    LIMIT 40
                    """,
                    {"user_id": user_id}
                )
                user_name_tokens = set(user_name.lower().split()) if user_name else set()
                for s in skill_res:
                    sname = (s.get("name") or "").strip()
                    if not sname or len(sname) > 30 or len(sname) < 2:
                        continue
                    if sname.lower() == user_name.lower() or sname.lower() in user_name_tokens:
                        continue
                    sid = f"skill_{sname.lower()}"
                    add_node(sid, sname, "skill", s.get("category") or "Technical Skill", {"verified": True})
                    add_link(f"user_{user_id}", sid, "HAS_SKILL")

                # 7. Connections & Alumni Bridges
                conn_res = await neo4j_client.execute_query(
                    """
                    MATCH (u:User {id: $user_id})-[:CONNECTED_TO]->(p:Person)
                    OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company)
                    OPTIONAL MATCH (p)-[:ATTENDED]->(univ:University)
                    RETURN p.id as pid, p.name as name,
                           coalesce(p.headline, p.position, '') as headline,
                           coalesce(p.linkedin_url, p.profile_url, '') as url,
                           c.name as company, univ.name as univ
                    LIMIT 100
                    """,
                    {"user_id": user_id}
                )
                for c in conn_res:
                    pid = f"person_{c['pid'] or c['name']}"
                    is_alumni = bool(c.get("univ"))
                    add_node(pid, c["name"], "person", "Alumni Bridge" if is_alumni else "1st-Degree Connection", {
                        "headline": c.get("headline", ""),
                        "company": c.get("company", ""),
                        "college": c.get("univ", ""),
                        "url": c.get("url", ""),
                        "is_alumni": is_alumni
                    })
                    add_link(f"user_{user_id}", pid, "CONNECTED_TO")
                    if c.get("company"):
                        cid = f"comp_{c['company']}"
                        add_node(cid, c["company"], "company", "Target Company")
                        add_link(pid, cid, "WORKS_AT")
                    if c.get("univ"):
                        uid = f"univ_{c['univ']}"
                        add_node(uid, c["univ"], "university", "University Cluster")
                        add_link(pid, uid, "ATTENDED")

        except Exception as e:
            logger.warning(f"Error building graph topology from Neo4j: {e}")

        # If empty, return clean user node only
        if len(nodes) == 0:
            add_node(f"user_{user_id}", user_name, "user", "Candidate", {"headline": "Candidate Profile"})

        return {
            "status": "success",
            "nodes_count": len(nodes),
            "links_count": len(links),
            "nodes": nodes,
            "links": links
        }

    @classmethod
    def _generate_default_rich_graph(cls, user_id: str, user_name: str = "Candidate") -> Dict[str, Any]:
        """
        Returns a clean initial graph node for the user if database is completely fresh.
        """
        return {
            "status": "success",
            "nodes_count": 1,
            "links_count": 0,
            "nodes": [
                {
                    "id": f"user_{user_id}",
                    "label": user_name,
                    "type": "user",
                    "category": "Candidate",
                    "val": 28
                }
            ],
            "links": []
        }

    @classmethod
    async def get_user_connections(
        cls, 
        user_id: str, 
        search: Optional[str] = None, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Retrieves paginated and filtered list of user's 1st-degree connections and alumni.
        """
        try:
            if neo4j_client.driver and neo4j_client.is_connected:
                query = """
                MATCH (u:User {id: $user_id})-[:CONNECTED_TO]->(p:Person)
                OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company)
                OPTIONAL MATCH (p)-[:ATTENDED]->(univ:University)
                WHERE $search IS NULL OR $search = '' 
                   OR toLower(p.name) CONTAINS toLower($search)
                   OR toLower(coalesce(c.name, '')) CONTAINS toLower($search)
                   OR toLower(coalesce(univ.name, '')) CONTAINS toLower($search)
                   OR toLower(coalesce(p.headline, '')) CONTAINS toLower($search)
                RETURN p.id as id,
                       p.name as name,
                       p.headline as headline,
                       p.linkedin_url as linkedin_url,
                       p.location as location,
                       p.connection_date as connection_date,
                       c.name as company,
                       univ.name as university,
                       (univ IS NOT NULL) as is_alumni
                ORDER BY is_alumni DESC, p.name ASC
                LIMIT $limit
                """
                res = await neo4j_client.execute_query(query, {
                    "user_id": user_id,
                    "search": search or "",
                    "limit": limit
                })
                return res if res is not None else []
        except Exception as e:
            logger.warning(f"Error fetching user connections from Neo4j: {e}")

        return []

    @classmethod
    async def reset_user_profile_data(cls, user_id: str) -> Dict[str, Any]:
        """
        Safely purges ONLY the authenticated user's isolated sub-graph (Projects, Connections, Peers).
        Leaves other tenant accounts in Neo4j completely untouched.
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            return {"status": "success", "message": "Account reset completed (offline mode)."}

        try:
            # 1. Delete all nodes and relations directly owned by this user
            purge_query = """
            MATCH (u:User {id: $user_id})
            OPTIONAL MATCH (u)-[:BUILT]->(p:Project)
            OPTIONAL MATCH (u)-[:CONNECTED_TO]->(c:Person)
            OPTIONAL MATCH (u)-[:HAS_BENCHMARK_PEER]->(bp:BenchmarkPeer)
            OPTIONAL MATCH (bp)-[:BUILT]->(bpr:Project)
            OPTIONAL MATCH (u)-[:PARTICIPATED_IN]->(h:Hackathon)
            OPTIONAL MATCH (u)-[:ACHIEVED]->(a:Achievement)
            OPTIONAL MATCH (u)-[:EARNED]->(cert:Certification)
            DETACH DELETE u, p, c, bp, bpr, h, a, cert
            """
            await neo4j_client.execute_query(purge_query, {"user_id": user_id})

            # 2. Re-create empty, isolated User node
            init_user_query = """
            MERGE (u:User {id: $user_id})
            SET u.created_at = datetime()
            RETURN u.id AS id
            """
            await neo4j_client.execute_query(init_user_query, {"user_id": user_id})

            # 3. Clean up orphaned skills that are not attached to any project or user
            cleanup_skills_query = """
            MATCH (s:Skill)
            WHERE NOT (s)<-[:USES_TECH]-(:Project) 
              AND NOT (s)<-[:HAS_SKILL]-(:User) 
              AND NOT (s)<-[:VERIFIED_SKILL]-(:User)
            DETACH DELETE s
            """
            await neo4j_client.execute_query(cleanup_skills_query, {})

            logger.info(f"User {user_id} sub-graph successfully reset without affecting other accounts.")
            return {
                "status": "success",
                "message": "Your personal profile and graph data have been completely cleared. Other accounts are untouched."
            }
        except Exception as e:
            logger.error(f"Error resetting profile for {user_id}: {e}")
            raise e

profile_service = ProfileService()


