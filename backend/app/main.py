import asyncio
import os
import httpx
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.core.config import settings
from app.core.database import neo4j_client
from app.api.v1 import health, ingest, profile, matches, resume

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger("careeros")

async def keep_alive_worker():
    """
    Background worker that pings the /health endpoint every 10 minutes.
    Prevents Render and free-tier cloud containers from entering sleep/cold-start state.
    """
    target_url = settings.KEEP_ALIVE_URL or settings.RENDER_EXTERNAL_URL
    if not target_url:
        render_service_name = os.environ.get("RENDER_SERVICE_NAME")
        if render_service_name:
            target_url = f"https://{render_service_name}.onrender.com"
        elif settings.ENVIRONMENT == "production":
            target_url = "http://localhost:8000"

    if not target_url:
        logger.info("Self-pinger dormant (no KEEP_ALIVE_URL set).")
        return

    health_endpoint = f"{target_url.rstrip('/')}/api/v1/health"
    logger.info(f"Self-ping keep-alive loop active for {health_endpoint} (every {settings.KEEP_ALIVE_INTERVAL_SECONDS}s)")
    
    # Wait 60s for server port to bind
    await asyncio.sleep(60)

    while True:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(health_endpoint)
                logger.info(f"Keep-alive self-ping delivered to {health_endpoint} [status: {res.status_code}]")
        except Exception as e:
            logger.debug(f"Keep-alive ping notice: {e}")
        
        await asyncio.sleep(settings.KEEP_ALIVE_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing CareerOS-v5 backend engine...")
    await neo4j_client.connect()
    
    # Spawn background self-ping task
    keep_alive_task = asyncio.create_task(keep_alive_worker())
    
    yield
    
    logger.info("Shutting down CareerOS-v5 backend engine...")
    keep_alive_task.cancel()
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
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|https://.*\.railway\.app|https://.*\.pages\.dev|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/healthz")
@app.get("/health")
async def root_health_check():
    return {"status": "healthy", "service": "CareerOS-v5"}

@app.get("/")
async def root():
    # If browser visits /, redirect to dashboard
    return RedirectResponse(url="/dashboard/")


