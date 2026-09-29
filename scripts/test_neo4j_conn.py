import asyncio
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from neo4j import AsyncGraphDatabase
from app.core.config import settings

async def test_neo4j():
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD
    database = settings.NEO4J_DATABASE

    print(f"Connecting to {uri} with user={user} and database={database}...")
    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    try:
        await driver.verify_connectivity()
        print("🎉 SUCCESS! Connected to Neo4j AuraDB instance.")
        async with driver.session(database=database) as session:
            result = await session.run("RETURN 'Connected securely via .env' AS message")
            record = await result.single()
            print("Query test result:", record["message"])
    except Exception as e:
        print("❌ Connection error:", type(e), e)
    finally:
        await driver.close()

if __name__ == "__main__":
    asyncio.run(test_neo4j())
