"""Read-only referral bridge smoke check against an existing user graph.

Provide CAREEROS_TEST_USER_ID, CAREEROS_TEST_COMPANY, CAREEROS_TEST_ROLE, and
CAREEROS_TEST_SKILLS. This script does not create sample users or graph records.
"""
import asyncio
import json
import os

from app.core.database import neo4j_client
from app.services.matchmaking_service import matchmaking_service


async def main():
    user_id = os.environ.get("CAREEROS_TEST_USER_ID")
    company = os.environ.get("CAREEROS_TEST_COMPANY")
    job_title = os.environ.get("CAREEROS_TEST_ROLE")
    required_skills = [
        skill.strip()
        for skill in os.environ.get("CAREEROS_TEST_SKILLS", "").split(",")
        if skill.strip()
    ]
    if not all((user_id, company, job_title, required_skills)):
        raise SystemExit(
            "Set CAREEROS_TEST_USER_ID, CAREEROS_TEST_COMPANY, "
            "CAREEROS_TEST_ROLE, and comma-separated CAREEROS_TEST_SKILLS."
        )

    await neo4j_client.connect()
    if not neo4j_client.is_connected:
        raise SystemExit("Graph database is unavailable; no check was run.")
    try:
        match = await matchmaking_service.analyze_match_against_graph(
            user_id,
            {
                "company_name": company,
                "job_title": job_title,
                "required_skills": required_skills,
            },
        )
        print(json.dumps(match.get("referral_bridges", []), indent=2))
    finally:
        await neo4j_client.close()


if __name__ == "__main__":
    asyncio.run(main())
