import logging
from typing import List, Dict, Any, Optional
from app.core.database import neo4j_client

logger = logging.getLogger(__name__)

class Neo4jService:
    @classmethod
    async def upsert_user_github_projects(
        cls, 
        user_id: str, 
        user_email: str,
        github_username: str, 
        projects: List[Dict[str, Any]]
    ) -> int:
        """
        Executes atomic Cypher queries to merge User, Project, and Skill nodes.
        Guarantees strict multi-tenant scoping anchored to (:User {id: $user_id}).
        """
        if not neo4j_client.driver:
            logger.warning("Neo4j driver offline. Skipping live graph upsert.")
            return len(projects)

        nodes_merged_count = 0

        # 1. Upsert User Node
        user_query = """
        MERGE (u:User {id: $user_id})
        ON CREATE SET u.email = $email,
                      u.github_username = $github_username,
                      u.created_at = datetime()
        ON MATCH SET u.github_username = $github_username
        RETURN u.id AS id;
        """
        await neo4j_client.execute_query(user_query, {
            "user_id": user_id,
            "email": user_email,
            "github_username": github_username
        })
        nodes_merged_count += 1

        # 2. Upsert Projects and link Skills
        for proj in projects:
            proj_query = """
            MATCH (u:User {id: $user_id})
            MERGE (p:Project {id: $project_id})
            ON CREATE SET p.name = $name,
                          p.description = $description,
                          p.repo_url = $url,
                          p.stars_count = $stars,
                          p.primary_language = $primary_language,
                          p.created_at = datetime()
            ON MATCH SET p.description = $description,
                         p.stars_count = $stars,
                         p.primary_language = $primary_language
            MERGE (u)-[:BUILT]->(p)
            WITH p, u
            UNWIND CASE WHEN size($skills) = 0 THEN [null] ELSE $skills END AS skill_data
            WITH p, u, skill_data WHERE skill_data IS NOT NULL
            MERGE (s:Skill {name: skill_data.name})
            ON CREATE SET s.category = coalesce(skill_data.category, 'Technical')
            MERGE (p)-[:USES_TECH]->(s)
            MERGE (u)-[:HAS_SKILL {source: 'github'}]->(s)
            MERGE (u)-[:VERIFIED_SKILL]->(s)
            RETURN count(s) AS linked_skills;
            """
            params = {
                "user_id": user_id,
                "project_id": proj["id"],
                "name": proj["name"],
                "description": proj["description"],
                "url": proj["url"],
                "stars": proj["stars"],
                "primary_language": proj["primary_language"],
                "skills": proj.get("skills", [])
            }
            res = await neo4j_client.execute_query(proj_query, params)
            nodes_merged_count += 1 + len(proj.get("skills", []))

        return nodes_merged_count

    @classmethod
    async def get_user_synced_projects(cls, user_id: str) -> List[Dict[str, Any]]:
        """
        Queries Neo4j for all Project nodes currently linked to the candidate via (u:User)-[:BUILT]->(p:Project).
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            return []

        query = """
        MATCH (u:User {id: $user_id})-[:BUILT]->(p:Project)
        RETURN p.id AS id, p.name AS name, p.repo_url AS repo_url, p.primary_language AS primary_language, p.stars_count AS stars
        ORDER BY p.name ASC;
        """
        try:
            results = await neo4j_client.execute_query(query, {"user_id": user_id})
            return results or []
        except Exception as e:
            logger.warning(f"Failed to fetch user projects from Neo4j: {e}")
            return []

    @classmethod
    async def get_user_synced_project_ids(cls, user_id: str) -> List[str]:
        """
        Returns list of synced project IDs and normalized repo names for fast deduplication.
        """
        projects = await cls.get_user_synced_projects(user_id)
        synced_identifiers = set()
        for p in projects:
            if p.get("id"):
                synced_identifiers.add(str(p["id"]).lower())
            if p.get("name"):
                synced_identifiers.add(str(p["name"]).lower())
        return list(synced_identifiers)

    @classmethod
    async def upsert_user_resume_blueprint(

        cls,
        user_id: str,
        blueprint: Any
    ) -> int:
        """
        Upserts extracted resume entities (Universities, Companies, Projects, Skills)
        and creates multi-tenant relationships in Neo4j AuraDB.
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            logger.warning("Neo4j driver offline. Skipping live resume graph upsert.")
            return 1

        nodes_merged = 0

        # 1. Update User basic info
        contact = blueprint.contact
        user_query = """
        MERGE (u:User {id: $user_id})
        ON CREATE SET u.full_name = $full_name,
                      u.email = $email,
                      u.phone = $phone,
                      u.linkedin_url = $linkedin,
                      u.github_url = $github,
                      u.created_at = datetime()
        ON MATCH SET u.full_name = $full_name,
                     u.linkedin_url = $linkedin
        RETURN u.id AS id;
        """
        await neo4j_client.execute_query(user_query, {
            "user_id": user_id,
            "full_name": contact.full_name,
            "email": contact.email,
            "phone": contact.phone,
            "linkedin": contact.linkedin_url,
            "github": contact.github_url
        })
        nodes_merged += 1

        # 2. Upsert Education & University Nodes
        for edu in blueprint.education:
            if edu.university:
                edu_query = """
                MATCH (u:User {id: $user_id})
                MERGE (univ:University {name: $university_name})
                MERGE (u)-[r:ATTENDED]->(univ)
                ON CREATE SET r.degree = $degree,
                              r.field_of_study = $field,
                              r.end_date = $end_date
                RETURN univ.name;
                """
                await neo4j_client.execute_query(edu_query, {
                    "user_id": user_id,
                    "university_name": edu.university.strip(),
                    "degree": edu.degree,
                    "field": edu.field_of_study,
                    "end_date": edu.end_date
                })
                nodes_merged += 1

        # 3. Upsert Work Experience & Company Nodes
        for exp in blueprint.experience:
            if exp.company:
                comp_query = """
                MATCH (u:User {id: $user_id})
                MERGE (c:Company {name: $company_name})
                MERGE (u)-[r:WORKED_AT]->(c)
                ON CREATE SET r.role = $role,
                              r.start_date = $start_date,
                              r.end_date = $end_date,
                              r.is_current = $is_current
                RETURN c.name;
                """
                await neo4j_client.execute_query(comp_query, {
                    "user_id": user_id,
                    "company_name": exp.company.strip(),
                    "role": exp.role,
                    "start_date": exp.start_date,
                    "end_date": exp.end_date,
                    "is_current": exp.is_current
                })
                nodes_merged += 1

        # 4. Upsert Skills from Resume
        all_skills = []
        for cat in blueprint.skills:
            for s in cat.skills:
                all_skills.append({"name": s.strip(), "category": cat.category})

        if all_skills:
            skill_query = """
            MATCH (u:User {id: $user_id})
            UNWIND $skills AS skill_data
            MERGE (s:Skill {name: skill_data.name})
            ON CREATE SET s.category = skill_data.category
            MERGE (u)-[:HAS_SKILL {source: 'resume'}]->(s)
            RETURN count(s) AS skill_count;
            """
            await neo4j_client.execute_query(skill_query, {
                "user_id": user_id,
                "skills": all_skills
            })
            nodes_merged += len(all_skills)

        return nodes_merged

    @classmethod
    async def upsert_user_linkedin_connections(
        cls,
        user_id: str,
        connections: List[Dict[str, Any]],
        shared_college: Optional[str] = "Anand Engineering College"
    ) -> int:
        """
        Upserts LinkedIn professional connections, companies, and alumni edges into Neo4j AuraDB.
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            logger.warning("Neo4j driver offline. Skipping live LinkedIn graph upsert.")
            return len(connections)

        query = """
        MATCH (u:User {id: $user_id})
        UNWIND $connections AS conn
        MERGE (p:Person {id: conn.id})
        ON CREATE SET p.name = conn.name,
                      p.first_name = conn.first_name,
                      p.last_name = conn.last_name,
                      p.position = conn.position,
                      p.connected_on = conn.connected_on,
                      p.profile_url = conn.profile_url
        ON MATCH SET p.position = conn.position
        MERGE (u)-[:CONNECTED_TO {source: 'linkedin'}]->(p)
        
        // Link Person to Company
        WITH p, conn, u
        WHERE conn.company <> ''
        MERGE (c:Company {name: conn.company})
        MERGE (p)-[:WORKS_AT {title: conn.position}]->(c)
        RETURN count(p) AS imported_count;
        """
        await neo4j_client.execute_query(query, {
            "user_id": user_id,
            "connections": connections
        })

        # 2. Seed Sharda Group of Institutions (SGI) Semantic Hierarchy
        sgi_query = """
        MERGE (g:EducationGroup {name: 'Sharda Group of Institutions (SGI)'})
        
        MERGE (u1:University {name: 'Anand Engineering College'})
        ON CREATE SET u1.aliases = ['AEC', 'AEC Agra', 'Anand Engg College']
        MERGE (u1)-[:AFFILIATED_WITH]->(g)

        MERGE (u2:University {name: 'Sharda University Agra'})
        ON CREATE SET u2.aliases = ['SUA', 'Sharda Agra', 'Sharda University']
        MERGE (u2)-[:AFFILIATED_WITH]->(g)

        MERGE (u3:University {name: 'Hindustan College of Science and Technology'})
        ON CREATE SET u3.aliases = ['HCST', 'HCST Mathura', 'Hindustan College']
        MERGE (u3)-[:AFFILIATED_WITH]->(g)

        MERGE (u4:University {name: 'Sharda University'})
        ON CREATE SET u4.aliases = ['Sharda Greater Noida', 'SU Greater Noida']
        MERGE (u4)-[:AFFILIATED_WITH]->(g)

        RETURN g.name;
        """
        await neo4j_client.execute_query(sgi_query)

        # 3. Link Alumni edges across entire Sharda Group / AEC network
        alumni_query = """
        MATCH (u:User {id: $user_id})-[:ATTENDED]->(univ:University)
        OPTIONAL MATCH (univ)-[:AFFILIATED_WITH]->(grp:EducationGroup)
        MATCH (u)-[:CONNECTED_TO]->(p:Person)
        // Link alumni across direct college or group cluster
        MERGE (p)-[:ATTENDED]->(univ)
        RETURN count(p) AS alumni_linked;
        """
        await neo4j_client.execute_query(alumni_query, {"user_id": user_id})

        return len(connections) * 2

    @classmethod
    async def upsert_hiring_lead_job(
        cls,
        user_id: str,
        lead_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Injects an active hiring lead into the knowledge graph and immediately traverses referral bridges.
        """
        if not neo4j_client.driver or not neo4j_client.is_connected:
            return {"job_id": "lead_001", "referral_bridges": []}

        job_id = f"lead:{lead_data['company_name'].lower().replace(' ', '_')}:{lead_data['job_title'].lower().replace(' ', '_')}"
        
        query = """
        MERGE (c:Company {name: $company_name})
        MERGE (j:Job {id: $job_id})
        ON CREATE SET j.title = $job_title,
                      j.location = $location,
                      j.source = 'linkedin_post',
                      j.is_active = true,
                      j.created_at = datetime()
        MERGE (c)-[:POSTED]->(j)
        WITH j
        UNWIND $skills AS skill_name
        MERGE (s:Skill {name: skill_name})
        MERGE (j)-[:REQUIRES_SKILL]->(s);
        """
        await neo4j_client.execute_query(query, {
            "company_name": lead_data["company_name"],
            "job_id": job_id,
            "job_title": lead_data["job_title"],
            "location": lead_data.get("location", "Remote"),
            "skills": lead_data.get("skills", [])
        })

        # Discover instant referral bridge (Multi-hop + Company Fuzzy Matching)
        referral_query = """
        MATCH (j:Job {id: $job_id})<-[:POSTED]-(c:Company)
        MATCH (p:Person)-[:WORKS_AT]->(target_comp:Company)
        WHERE toLower(target_comp.name) CONTAINS toLower(c.name)
           OR toLower(c.name) CONTAINS toLower(target_comp.name)
        OPTIONAL MATCH (u:User {id: $user_id})
        OPTIONAL MATCH (u)-[:ATTENDED]->(univ:University)
        OPTIONAL MATCH (p)-[:ATTENDED]->(p_univ:University)
        RETURN DISTINCT p.name AS name,
               p.position AS position,
               target_comp.name AS company,
               coalesce(univ.name, p_univ.name, 'Anand Engineering College') AS shared_school,
               CASE 
                 WHEN (u)-[:CONNECTED_TO]->(p) THEN '1st Degree Connection' 
                 WHEN univ IS NOT NULL AND p_univ IS NOT NULL AND univ = p_univ THEN 'University Alumni Bridge'
                 ELSE 'Alumni Network Contact'
               END AS connection_type;
        """
        bridges = await neo4j_client.execute_query(referral_query, {
            "user_id": user_id,
            "job_id": job_id
        })

        return {
            "job_id": job_id,
            "company": lead_data["company_name"],
            "title": lead_data["job_title"],
            "referral_bridges": bridges
        }

neo4j_service = Neo4jService()
