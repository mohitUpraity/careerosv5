import asyncio
import json
from app.core.database import neo4j_client
from app.services.profile_service import profile_service

async def main():
    await neo4j_client.connect()
    # Default dev user id
    dev_user_id = "dev-user-0000-0000-0000-000000000001"
    analysis = await profile_service.get_comprehensive_profile_analysis(dev_user_id)
    print(json.dumps(analysis, indent=2))
    await neo4j_client.close()

if __name__ == "__main__":
    asyncio.run(main())
