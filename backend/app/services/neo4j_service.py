import logging
from typing import List, Dict, Any
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
                         p.stars_count = $stars
            MERGE (u)-[:BUILT]->(p)
            WITH p, u
            UNWIND $skills AS skill_data
            MERGE (s:Skill {name: skill_data.name})
            ON CREATE SET s.category = skill_data.category
            MERGE (p)-[:USES_TECH]->(s)
            MERGE (u)-[:HAS_SKILL {source: 'github'}]->(s)
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

neo4j_service = Neo4jService()
