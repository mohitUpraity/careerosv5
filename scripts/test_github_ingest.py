import asyncio
import sys
import os

# Add backend directory to python path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.services.github_service import github_service
from app.services.gemini_extractor import gemini_extractor
from app.services.neo4j_service import neo4j_service
from app.core.database import neo4j_client

async def run_test_ingestion():
    username = "mohitUpraity"
    print(f"🚀 Starting GitHub Ingestion Test for user: {username}")
    print("-" * 60)

    # 1. Fetch repositories
    print("📡 Step 1: Fetching repositories from GitHub API...")
    repos = await github_service.fetch_user_repositories(username=username, max_repos=5)
    print(f"✅ Found {len(repos)} repositories:\n")

    for idx, r in enumerate(repos, 1):
        print(f"  {idx}. {r['name']} ({r['primary_language']}) - ⭐ {r['stars']}")
        print(f"     URL: {r['url']}")
        if r['description']:
            print(f"     Desc: {r['description']}")
    
    print("\n" + "-" * 60)
    print("🧠 Step 2: Extracting Skills & Tech Stack using Gemini 1.5 Flash...")
    
    all_skills = set()
    for r in repos:
        skills = await gemini_extractor.extract_project_skills(r)
        r['skills'] = skills
        skill_names = [f"{s['name']} ({s['category']})" for s in skills]
        print(f"  📦 {r['name']} -> {', '.join(skill_names) if skill_names else 'No specific libraries detected'}")
        for s in skills:
            all_skills.add(s['name'])

    print(f"\n✨ Extracted {len(all_skills)} unique technical competencies: {', '.join(sorted(all_skills))}")

    print("\n" + "-" * 60)
    print("🕸️ Step 3: Verifying Neo4j AuraDB Connection...")
    await neo4j_client.connect()
    if neo4j_client.driver:
        print("🔗 Upserting nodes into Neo4j Graph...")
        nodes = await neo4j_service.upsert_user_github_projects(
            user_id="test-user-001",
            user_email="mohitupraity123@gmail.com",
            github_username=username,
            projects=repos
        )
        print(f"✅ Graph updated! Merged/Created {nodes} nodes & edges in Neo4j.")
        await neo4j_client.close()
    else:
        print("ℹ️ Neo4j is offline or waiting for credentials in .env. Dry-run ingestion test completed successfully!")

    print("=" * 60)
    print("🎉 Phase 1 GitHub Ingestion Test Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(run_test_ingestion())
