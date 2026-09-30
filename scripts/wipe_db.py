import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.database import neo4j_client

async def wipe():
    print("🔌 Connecting to Neo4j AuraDB...")
    await neo4j_client.connect()
    if not neo4j_client.is_connected:
        print("❌ Failed to connect to Neo4j. Check credentials in .env")
        return

    print("🧹 Deleting all nodes, relationships, and graph data...")
    await neo4j_client.execute_query("MATCH (n) DETACH DELETE n")
    
    print("🔒 Re-initializing schema constraints and unique indexes...")
    await neo4j_client.init_schema()

    print("✅ Neo4j AuraDB is 100% clean and ready for fresh onboarding!")
    await neo4j_client.close()

if __name__ == "__main__":
    asyncio.run(wipe())
