import asyncio
import io
import sys
import os
from pypdf import PdfWriter, PageObject

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.resume_service import resume_service
from app.services.neo4j_service import neo4j_service
from app.core.database import neo4j_client

# Generate a mock PDF in memory using ReportLab/WeasyPrint or pure text extraction test
MOCK_RESUME_TEXT = """
Mohit Upraity
Email: mohitupraity123@gmail.com | Phone: +91 9876543210
GitHub: github.com/mohitUpraity | LinkedIn: linkedin.com/in/mohitupraity
Location: Bangalore, India

PROFESSIONAL SUMMARY
Full Stack AI Engineer specializing in GraphRAG systems, distributed backend services, and scalable web platforms.

WORK EXPERIENCE
Software Engineer | Stealth AI Startup
06/2023 - Present | Bangalore, India
• Architected high-throughput GraphRAG backend with FastAPI, Neo4j AuraDB, and Gemini 1.5 Flash reducing query latency by 45%.
• Engineered multi-tenant JWT security layer and automated CI/CD deployment pipelines on Docker & Render.
• Built interactive React dashboard with TailwindCSS and Vite for real-time data visualization.

Backend Developer Intern | Tech Innovations Labs
01/2023 - 05/2023 | Remote
• Developed REST APIs in Python using PostgreSQL and Redis caching for 50,000+ daily active users.
• Implemented async worker queues and automated unit tests achieving 92% code coverage.

EDUCATION
Bachelor of Technology in Computer Science & Engineering
National Institute of Technology (NIT) | 2020 - 2024
GPA: 8.8 / 10.0

FEATURED PROJECTS
CareerOS v5 - GraphRAG Career Navigation Engine
• Built end-to-end knowledge graph pipeline mapping GitHub repos, resumes, and live job vacancies into Neo4j.
• Tech Stack: Python, FastAPI, Neo4j, Supabase, React, Gemini AI.

TECHNICAL SKILLS
• Languages: Python, TypeScript, JavaScript, SQL, Shell
• Frameworks: FastAPI, React, Node.js, Next.js, TailwindCSS
• Databases: Neo4j, PostgreSQL, Supabase, Redis
• Cloud & Tools: Docker, Git, Linux, WeasyPrint, Postman
"""

async def run_resume_test():
    print("🚀 Starting Resume Ingestion & Blueprint Extraction Test...")
    print("-" * 60)

    # 1. Parse text into Blueprint
    print("🧠 Step 1: Parsing Resume Text into Structured Layout Blueprint via Gemini 1.5 Flash...")
    blueprint = await resume_service.parse_resume_to_blueprint(MOCK_RESUME_TEXT)

    print(f"\n✅ Extracted Contact:")
    print(f"   Name: {blueprint.contact.full_name}")
    print(f"   Email: {blueprint.contact.email}")
    print(f"   LinkedIn: {blueprint.contact.linkedin_url}")

    print(f"\n✅ Extracted Education ({len(blueprint.education)} entries):")
    for edu in blueprint.education:
        print(f"   🎓 {edu.university} - {edu.degree} ({edu.end_date})")

    print(f"\n✅ Extracted Work Experience ({len(blueprint.experience)} entries):")
    for exp in blueprint.experience:
        print(f"   💼 {exp.role} at {exp.company} ({exp.start_date} - {exp.end_date})")
        for b in exp.bullets:
            print(f"      • {b}")

    print(f"\n✅ Extracted Technical Skills:")
    for cat in blueprint.skills:
        print(f"   🛠️ {cat.category}: {', '.join(cat.skills)}")

    # 2. Upsert into Neo4j Aura Cloud
    print("\n" + "-" * 60)
    print("🕸️ Step 2: Merging Education, Experience & Skills into Neo4j Aura Cloud Graph...")
    await neo4j_client.connect()
    if neo4j_client.is_connected:
        nodes_merged = await neo4j_service.upsert_user_resume_blueprint(
            user_id="test-user-001",
            blueprint=blueprint
        )
        print(f"🎉 Live Cloud Graph Updated! Merged/Created {nodes_merged} nodes & relationships.")
        
        # Verify in database
        print("\n📊 Querying Live Neo4j Graph to verify University & Experience edges:")
        univ_res = await neo4j_client.execute_query(
            "MATCH (u:User)-[r:ATTENDED]->(univ:University) RETURN u.full_name AS name, univ.name AS university, r.degree AS degree"
        )
        for row in univ_res:
            print(f"   🎓 Alumni Edge: {row['name']} -> ATTENDED -> {row['university']} ({row['degree']})")

        comp_res = await neo4j_client.execute_query(
            "MATCH (u:User)-[r:WORKED_AT]->(c:Company) RETURN u.full_name AS name, c.name AS company, r.role AS role"
        )
        for row in comp_res:
            print(f"   💼 Experience Edge: {row['name']} -> WORKED_AT -> {row['company']} ({row['role']})")

        await neo4j_client.close()
    else:
        print("⚠️ Neo4j offline. Dry run completed.")

    print("=" * 60)
    print("🎉 Phase 1 Pillar 2 (Resume Ingestion) Test Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(run_resume_test())
