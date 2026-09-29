import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.linkedin_service import linkedin_service
from app.services.neo4j_service import neo4j_service
from app.core.database import neo4j_client

# Realistic LinkedIn Connections.csv string format
MOCK_CONNECTIONS_CSV = b"""Notes:
"This CSV contains your 1st-degree connections export from LinkedIn"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Aarav,Sharma,https://www.linkedin.com/in/aarav-sharma,,Google,Staff Software Engineer,12 Jan 2025
Priya,Verma,https://www.linkedin.com/in/priya-verma,,Stripe,Engineering Manager,20 Mar 2024
Rohan,Gupta,https://www.linkedin.com/in/rohan-gupta,,Microsoft,Senior Backend Developer,05 Feb 2025
Ananya,Mishra,https://www.linkedin.com/in/ananya-mishra,,Uber,Infrastructure Tech Lead,18 Aug 2024
Vikram,Singh,https://www.linkedin.com/in/vikram-singh,,DRDO,Scientist / Senior AI Researcher,10 Nov 2023
Sneha,Patel,https://www.linkedin.com/in/sneha-patel,,Novonixsoft,Co-Founder & CTO,15 Jan 2026
"""

SAMPLE_HIRING_POST = """
Excited to announce our team at Google Cloud is hiring 2 Senior Software Engineers (Backend / Distributed Systems)!
Looking for strong hands-on experience with Python, FastAPI, Kubernetes, and Graph Databases.
If you or someone in your network is a great fit, drop your resume or reach out to me directly!
"""

async def run_linkedin_test():
    print("🚀 Starting LinkedIn Network & Hidden Referral Ingestion Test...")
    print("-" * 60)

    # 1. Parse CSV
    print("📥 Step 1: Parsing LinkedIn Connections.csv...")
    connections = linkedin_service.parse_connections_csv(MOCK_CONNECTIONS_CSV)
    print(f"✅ Successfully parsed {len(connections)} connections:")
    for c in connections:
        print(f"   👤 {c['name']} -> 💼 {c['position']} at {c['company']}")

    # 2. Ingest into Neo4j Aura Cloud
    print("\n" + "-" * 60)
    print("🕸️ Step 2: Ingesting Network into Neo4j Aura Cloud Graph...")
    await neo4j_client.connect()
    if neo4j_client.is_connected:
        nodes = await neo4j_service.upsert_user_linkedin_connections(
            user_id="user-mohit-001",
            connections=connections,
            shared_college="Anand Engineering College"
        )
        print(f"🎉 Network mapped! Created/Merged {nodes} nodes & referral edges.")

        # 3. Test 1-Click Hiring Lead Ingest & Referral Discovery
        print("\n" + "-" * 60)
        print("🎯 Step 3: Ingesting Live Hiring Post & Running Multi-Hop Referral Discovery...")
        lead_data = await linkedin_service.parse_hiring_lead_post(SAMPLE_HIRING_POST)
        print(f"   🏢 Extracted Lead: {lead_data['job_title']} at {lead_data['company_name']}")

        result = await neo4j_service.upsert_hiring_lead_job(
            user_id="user-mohit-001",
            lead_data=lead_data
        )

        print("\n🔥 HIDDEN REFERRAL PATHS DISCOVERED IN YOUR NETWORK:")
        for bridge in result["referral_bridges"]:
            print(f"   🤝 [WARM PATH] {bridge['name']} ({bridge['position']} at {bridge['company']})")
            print(f"      Bridge Type: {bridge['connection_type']} (via {bridge.get('shared_school', 'Direct Contact')})")

        await neo4j_client.close()
    else:
        print("⚠️ Neo4j offline. Dry run completed.")

    print("=" * 60)
    print("🎉 Phase 1 Pillar 3 (LinkedIn Network Ingestion) Test Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(run_linkedin_test())
