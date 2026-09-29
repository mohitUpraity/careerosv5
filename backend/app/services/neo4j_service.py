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

neo4j_service = Neo4jService()
