"""Preview/apply public-profile handles for all existing Neo4j User records.

Preview by default. Pass --apply only after reviewing the affected accounts.
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import neo4j_client


def make_handle(name: str, user_id: str, reserved: set[str]) -> str:
    base = re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-_")[:20]
    if len(base) < 3:
        base = "member"
    suffix = re.sub(r"[^a-z0-9]", "", user_id.lower())[-6:] or "profile"
    candidate = base
    if candidate in reserved:
        candidate = f"{base[:22]}-{suffix}"[:30]
    counter = 2
    while candidate in reserved:
        candidate = f"{base[:22]}-{suffix[:4]}{counter}"[:30]
        counter += 1
    return candidate


async def main(apply: bool) -> None:
    await neo4j_client.connect()
    if not neo4j_client.is_connected:
        raise RuntimeError("Neo4j is not connected; check the configured database environment.")

    users = await neo4j_client.execute_query(
        """
        MATCH (u:User)
        RETURN u.id AS id, u.username AS username,
               u.github_username AS github_username, u.full_name AS full_name,
               u.is_public AS is_public
        ORDER BY u.id
        """
    )
    reserved = {
        str(value).strip().lower()
        for user in users
        for value in (user.get("username"), user.get("github_username"))
        if value and str(value).strip()
    }
    changes: list[dict[str, Any]] = []
    for user in users:
        user_id = str(user.get("id") or "")
        if not user_id:
            continue
        username = str(user.get("username") or "").strip().lower()
        needs_handle = not re.fullmatch(r"[a-z0-9_-]{3,30}", username)
        if needs_handle:
            label = user.get("github_username") or user.get("full_name") or "member"
            username = make_handle(str(label), user_id, reserved)
            reserved.add(username)
        if user.get("is_public") is not True or needs_handle:
            changes.append({"id": user_id, "username": username})

    print(f"Existing user profiles: {len(users)}")
    print(f"Profiles to publish/update: {len(changes)}")
    if not apply:
        print("Preview only; database unchanged. Re-run with --apply to publish these profiles.")
        return

    for change in changes:
        await neo4j_client.execute_query(
            """
            MATCH (u:User {id: $id})
            SET u.is_public = true,
                u.username = $username,
                u.updated_at = datetime()
            RETURN u.id AS id
            """,
            change,
        )
    print(f"Published {len(changes)} profiles. Owners can switch their profile private in Profile settings.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply profile visibility updates to the configured Neo4j database")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
