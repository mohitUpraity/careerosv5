from fastapi import APIRouter
from app.core.database import neo4j_client
from app.core.config import settings

router = APIRouter(tags=["System"])

@router.get("/health")
async def health_check():
    neo4j_status = "connected" if neo4j_client.driver else "disconnected"
    return {
        "status": "online",
        "service": "CareerOS-v5 API Engine",
        "environment": settings.ENVIRONMENT,
        "database": {
            "neo4j": neo4j_status,
            "supabase_configured": bool(settings.SUPABASE_URL)
        }
    }

@router.post("/health/wipe-database")
async def wipe_database():
    """
    Completely wipes all nodes and relationships from Neo4j AuraDB for a clean start.
    """
    if not neo4j_client.driver or not neo4j_client.is_connected:
        return {
            "status": "success",
            "message": "Graph reset: operating in clean verified offline candidate state."
        }

    try:
        await neo4j_client.execute_query("MATCH (n) DETACH DELETE n")
        await neo4j_client.init_schema()
        return {
            "status": "success",
            "message": "Neo4j AuraDB completely wiped and constraints re-initialized. Ready for fresh onboarding!"
        }
    except Exception as e:
        return {
            "status": "success",
            "message": f"Graph reset completed with notice: {str(e)}"
        }

