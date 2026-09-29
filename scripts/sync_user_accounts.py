import asyncio
import json
from app.core.database import neo4j_client
from app.services.github_service import github_service
from app.services.gemini_extractor import gemini_extractor
from app.services.neo4j_service import neo4j_service

async def sync_user_github(user_id: str, email: str, username: str):
    print(f"Syncing GitHub for {username} (User ID: {user_id})...")
    # First detach any mismatched repos for this user
    cleanup_query = """
    MATCH (u:User {id: $user_id})-[r:BUILT]->(p:Project)
    WHERE NOT p.id CONTAINS ('github:' + $username + ':')
    DELETE r;
    """
    await neo4j_client.execute_query(cleanup_query, {"user_id": user_id, "username": username})

    # Fetch and ingest real repos
    raw_projects = await github_service.fetch_user_repositories(username=username, max_repos=15)
    processed = []
    for proj in raw_projects:
        skills = await gemini_extractor.extract_project_skills(proj)
        proj["skills"] = skills
        processed.append(proj)

    merged = await neo4j_service.upsert_user_github_projects(
        user_id=user_id,
        user_email=email,
        github_username=username,
        projects=processed
    )
    print(f"✅ Successfully linked {len(processed)} repos ({merged} graph nodes) for {username}")

async def main():
    await neo4j_client.connect()
    # 1. Sync Mohit's Account
    mohit_id = "dev-user-0000-0000-0000-000000000001"
    await sync_user_github(mohit_id, "mohitupraity123@gmail.com", "mohitUpraity")

    # 2. Create Krati's separate user account
    krati_id = "user-krati-0000-0000-0000-000000000002"
    await sync_user_github(krati_id, "krati@example.com", "Krati-orbit")

    await neo4j_client.close()

if __name__ == "__main__":
    asyncio.run(main())
