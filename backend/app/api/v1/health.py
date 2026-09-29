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
