import asyncio
import json
from app.core.database import neo4j_client
from app.services.matchmaking_service import matchmaking_service

SAMPLE_JOB = """
Company: Google
Job Title: Software Engineer II, Backend & AI
Location: Bangalore / Noida, India

About the Role:
We are looking for a Software Engineer to join our Core Services team. You will build high-throughput backend APIs, integrate machine learning services, and design scalable databases.

Requirements:
- 1-3 years of experience in Python, FastAPI, or Node.js.
- Strong knowledge of PostgreSQL or distributed graph/relational databases.
- Hands-on experience building full-stack web applications with React or TypeScript.
- Familiarity with cloud platforms (GCP, Azure, or AWS) and Docker containerization.
- Experience with AI/LLM integration is a plus.
"""

async def main():
    await neo4j_client.connect()
    user_id = "dev-user-0000-0000-0000-000000000001"

    print("1. Extracting requirements and analyzing match against Mohit's Knowledge Graph...")
    job_req = await matchmaking_service.extract_job_requirements(SAMPLE_JOB)
    print("Parsed Job Req:\n", json.dumps(job_req, indent=2))

    analysis = await matchmaking_service.analyze_match_against_graph(user_id, job_req)
    print("\n2. Match Analysis Result:\n", json.dumps(analysis, indent=2))

    if analysis.get("referral_bridges"):
        target_contact = analysis["referral_bridges"][0]
    else:
        target_contact = {
            "name": "Aarav Sharma",
            "position": "Staff Software Engineer",
            "connection_bridge": "Anand Engineering College Alumni Bridge"
        }

    print("\n3. Generating 1-Click Tailored Outreach Pitch...")
    pitch = await matchmaking_service.generate_personalized_pitch(
        user_id=user_id,
        job_summary={
            "company": "Google",
            "title": "Software Engineer II, Backend & AI",
            "matched_skills": ", ".join(analysis["skills_breakdown"]["matched_skills"])
        },
        target_contact=target_contact
    )
    print("Generated Referral Pitch:\n", json.dumps(pitch, indent=2))
    await neo4j_client.close()

if __name__ == "__main__":
    asyncio.run(main())
