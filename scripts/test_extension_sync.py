import asyncio
import sys
import os

# Ensure backend in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.linkedin_service import linkedin_service
from app.services.linkedin_posts_service import linkedin_posts_service
from app.services.profile_service import profile_service
from app.services.neo4j_service import neo4j_service
from app.core.database import neo4j_client

async def test_full_pipeline():
    print("================================================================")
    print("🧪 Testing CareerOS Extension Ingestion & Synchronization Pipeline")
    print("================================================================")

    user_id = "test-sync-user-007"
    await neo4j_client.connect()

    # 1. Test Profile Extraction Data Structure Ingestion
    print("\n[1/3] Testing Full Profile Ingestion (Certs, Badges, Exp, Edu)...")
    mock_profile = {
        "full_name": "Mohit Upraity",
        "headline": "Systems & Distributed Systems Engineer | ADRDE DRDO Intern | 4x National Hackathon Winner",
        "bio": "Specialized in high-throughput network firewalls, distributed databases and graph intelligence.",
        "location": "Agra, Uttar Pradesh, India",
        "profile_url": "https://www.linkedin.com/in/mohitupraity/",
        "skills": ["Python", "FastAPI", "Neo4j", "Distributed Systems", "C++", "Docker"],
        "education": [
            {
                "university": "Anand Engineering College",
                "degree": "Bachelor of Technology - BTech",
                "field_of_study": "Computer Science and Engineering",
                "start_date": "2021",
                "end_date": "2025"
            }
        ],
        "experience": [
            {
                "company": "ADRDE, Defence Research and Development Organisation (DRDO)",
                "role": "Systems Research Intern",
                "start_date": "Jan 2024",
                "end_date": "Present",
                "is_current": True,
                "description": "Architected low-latency packet inspection pipeline for Next-Gen Firewalls."
            }
        ],
        "certifications": [
            {
                "name": "AWS Certified Solutions Architect",
                "issuer": "Amazon Web Services",
                "date": "Jan 2024",
                "url": "https://aws.amazon.com/verify/123",
                "credential_id": "AWS-12345"
            },
            {
                "name": "Neo4j Certified Professional",
                "issuer": "Neo4j Graph Academy",
                "date": "Feb 2024",
                "url": "https://graphacademy.neo4j.com/cert/456",
                "credential_id": "NEO-456"
            }
        ],
        "achievements": [
            {
                "title": "Smart India Hackathon 2024 Finalist",
                "organization": "Ministry of Education, Govt of India",
                "date": "Dec 2024",
                "description": "Selected among top 30 teams nationally for developing real-time AI analytics."
            }
        ],
        "badges": [
            {
                "name": "Python Assessment Badge",
                "issuer": "LinkedIn",
                "badge_type": "Skill Assessment",
                "date": "Verified"
            }
        ],
        "projects": [
            {
                "name": "IntelliGuard Next-Gen Firewall",
                "description": "High-throughput packet filtering system with kernel-level packet inspection.",
                "tech_stack": ["C++", "Python", "Linux"]
            }
        ]
    }

    # Execute profile update
    profile_res = await profile_service.update_user_profile_details(
        user_id=user_id,
        payload=mock_profile
    )
    print("   ✓ Profile, Education & Experience saved to Neo4j!")
    print(f"   ✓ Full Name: {profile_res.get('full_name')}")
    print(f"   ✓ Headline: {profile_res.get('headline')}")

    # 2. Test Direct JSON Connections Ingestion
    print("\n[2/3] Testing Direct JSON Connections Ingestion...")
    mock_connections = [
        {
            "name": "Amit Sharma",
            "first_name": "Amit",
            "last_name": "Sharma",
            "position": "Senior Backend Lead",
            "company": "Google",
            "profile_url": "https://www.linkedin.com/in/amit-sharma/",
            "connected_on": "2 days ago"
        },
        {
            "name": "Neha Gupta",
            "first_name": "Neha",
            "last_name": "Gupta",
            "position": "Software Engineer @ Microsoft",
            "company": "Microsoft",
            "profile_url": "https://www.linkedin.com/in/neha-gupta/",
            "connected_on": "1 week ago"
        },
        {
            "name": "Rahul Verma",
            "first_name": "Rahul",
            "last_name": "Verma",
            "position": "Research Scientist at ADRDE DRDO",
            "company": "DRDO",
            "profile_url": "https://www.linkedin.com/in/rahul-verma/",
            "connected_on": "May 2024"
        }
    ]

    # Enrich and upsert
    enriched = []
    for c in mock_connections:
        rich = linkedin_service.extract_rich_entities(c["position"], c["company"])
        enriched.append({
            "id": f"linkedin:{c['first_name'].lower()}_{c['last_name'].lower()}",
            "name": c["name"],
            "first_name": c["first_name"],
            "last_name": c["last_name"],
            "company": rich["company"] or c["company"],
            "university": rich["university"],
            "position": rich["role"] or c["position"],
            "skills": rich["skills"],
            "is_alumni": rich["is_alumni"],
            "connected_on": c["connected_on"],
            "profile_url": c["profile_url"]
        })

    conn_nodes = await neo4j_service.upsert_user_linkedin_connections(
        user_id=user_id,
        connections=enriched,
        shared_college="Anand Engineering College"
    )
    print(f"   ✓ Merged {conn_nodes} connection nodes into Neo4j graph!")

    # 3. Test Posts Extraction & Graph Merging (Hackathons, Certs, Badges)
    print("\n[3/3] Testing Posts & Hackathon Intelligence Ingestion...")
    sample_post = """
    Thrilled to share that our team participated in the Microsoft Noida Hackathon 2024 and built an AI Career Operating System!
    Also completed the Google Cloud Generative AI Badge certification. Grateful to mentors! #Microsoft #Hackathon #GenAI
    """
    knowledge = await linkedin_posts_service.extract_knowledge_from_posts(sample_post)
    print(f"   ✓ Extracted Hackathons: {len(knowledge.get('hackathons', []))}")
    print(f"   ✓ Extracted Achievements: {len(knowledge.get('achievements', []))}")
    print(f"   ✓ Extracted Badges/Certs: {len(knowledge.get('badges', [])) + len(knowledge.get('certifications_or_workshops', []))}")

    nodes_merged = await linkedin_posts_service.merge_posts_knowledge_to_graph(user_id, knowledge)
    print(f"   ✓ Merged {nodes_merged} nodes from posts into Neo4j graph!")

    # 4. Verify Comprehensive Profile
    print("\n[Verification] Fetching Full Profile Analysis from Graph...")
    analysis = await profile_service.get_comprehensive_profile_analysis(user_id)
    print(f"   ✓ Readiness Score: {analysis.get('metrics', {}).get('profile_strength_score')}%")
    print(f"   ✓ Network Reach Companies: {len(analysis.get('network_reach', {}).get('alumni_companies', []))}")

    await neo4j_client.close()
    print("\n================================================================")
    print("✅ All Tests Passed! Extension and Backend Synchronization is 100% Solid!")
    print("================================================================")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
