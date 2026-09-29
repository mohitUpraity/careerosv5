import asyncio
import json
from app.core.database import neo4j_client
from app.services.linkedin_posts_service import linkedin_posts_service
from app.services.profile_service import profile_service

SAMPLE_POSTS = """
Post 1:
Thrilled to participate in the Microsoft Noida Hackathon! 🚀
Our team worked 36 hours straight building an AI-powered automated workflow platform using Python, FastAPI, and Azure services. Huge learning experience collaborating with mentors and testing scalable architectures. #Microsoft #Hackathon #Python #FastAPI #AI

Post 2:
Proud to complete my research internship at DRDO ADRDE working on parachute deployment algorithms and aerial sensor analytics using Python and scientific computing libraries.

Post 3:
Excited to share that our team won 2nd Runner Up in the National Smart India Hackathon internal round for developing AgriFarm AI!
"""

async def main():
    await neo4j_client.connect()
    user_id = "dev-user-0000-0000-0000-000000000001"

    print("1. Extracting knowledge from LinkedIn posts via Gemini 1.5 Flash...")
    knowledge = await linkedin_posts_service.extract_knowledge_from_posts(SAMPLE_POSTS)
    print("Extracted Knowledge:\n", json.dumps(knowledge, indent=2))

    print("\n2. Merging into Neo4j AuraDB Knowledge Graph...")
    nodes_merged = await linkedin_posts_service.merge_posts_knowledge_to_graph(user_id, knowledge)
    print(f"Nodes merged: {nodes_merged}")

    print("\n3. Verifying updated Unified Profile Analysis...")
    analysis = await profile_service.get_comprehensive_profile_analysis(user_id)
    print("Updated Profile Summary:")
    print("Score:", analysis["metrics"]["profile_strength_score"])
    print("Hackathons:", json.dumps(analysis.get("hackathons", []), indent=2))
    print("Achievements:", json.dumps(analysis.get("achievements", []), indent=2))
    await neo4j_client.close()

if __name__ == "__main__":
    asyncio.run(main())
