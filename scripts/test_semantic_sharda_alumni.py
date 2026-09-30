import asyncio
import json
from app.core.database import neo4j_client
from app.services.matchmaking_service import matchmaking_service

async def main():
    await neo4j_client.connect()
    user_id = "dev-user-0000-0000-0000-000000000001"

    print("1. Seeding Sharda Group Semantic Hierarchy & Test Alumni...")
    seed_query = """
    MERGE (g:EducationGroup {name: 'Sharda Group of Institutions (SGI)'})
    
    MERGE (u1:University {name: 'Anand Engineering College'})
    MERGE (u1)-[:AFFILIATED_WITH]->(g)

    MERGE (u2:University {name: 'Sharda University Agra'})
    MERGE (u2)-[:AFFILIATED_WITH]->(g)

    MERGE (u3:University {name: 'Hindustan College of Science and Technology'})
    MERGE (u3)-[:AFFILIATED_WITH]->(g)

    // Match User and ensure linked to Anand Engineering College
    MATCH (u:User {id: $user_id})
    MERGE (u)-[:ATTENDED]->(u1)

    // Senior 1: Sharda University Agra Alum working at Google
    MERGE (c_goog:Company {name: 'Google'})
    MERGE (s1:Person {id: 'sharda_alum_goog'})
    ON CREATE SET s1.name = 'Priya Sharma', s1.position = 'Senior Software Engineer'
    MERGE (s1)-[:WORKS_AT]->(c_goog)
    MERGE (s1)-[:ATTENDED]->(u2)

    // Senior 2: Hindustan College HCST Alum working at Google
    MERGE (s2:Person {id: 'hcst_alum_goog'})
    ON CREATE SET s2.name = 'Rohan Gupta', s2.position = 'Tech Lead'
    MERGE (s2)-[:WORKS_AT]->(c_goog)
    MERGE (s2)-[:ATTENDED]->(u3)

    RETURN g.name;
    """
    await neo4j_client.execute_query(seed_query, {"user_id": user_id})

    print("2. Testing Semantic Referral Bridges for Google...")
    job_req = {
        "company_name": "Google",
        "job_title": "Backend Software Engineer",
        "required_skills": ["Python", "FastAPI", "PostgreSQL"]
    }
    match = await matchmaking_service.analyze_match_against_graph(user_id, job_req)
    print("Found Semantic Referral Bridges:\n", json.dumps(match["referral_bridges"], indent=2))
    await neo4j_client.close()

if __name__ == "__main__":
    asyncio.run(main())
