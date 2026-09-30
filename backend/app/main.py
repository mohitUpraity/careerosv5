from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import neo4j_client
from app.api.v1 import health, ingest, profile, matches, resume

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

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

# Register API Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(matches.router, prefix="/api/v1")
app.include_router(resume.router, prefix="/api/v1")

# Mount Static Frontend
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/dashboard", StaticFiles(directory=frontend_dir, html=True), name="dashboard")

@app.get("/")
async def root():
    # If browser visits /, redirect to dashboard
    return RedirectResponse(url="/dashboard/")

