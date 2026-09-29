from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import neo4j_client
from app.api.v1 import health, ingest, profile, matches

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger("careeros")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing CareerOS-v5 backend engine...")
    await neo4j_client.connect()
    yield
    logger.info("Shutting down CareerOS-v5 backend engine...")
    await neo4j_client.close()

app = FastAPI(
    title="CareerOS-v5 Core API",
    description="GraphRAG Career Navigation, Hidden Referral Discovery & Dynamic Resume Tailoring",
    version="5.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(matches.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "service": "CareerOS-v5 API Engine",
        "status": "online",
        "docs_url": "/docs"
    }
