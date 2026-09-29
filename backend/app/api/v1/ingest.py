import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user
from app.schemas.ingest_models import GitHubIngestRequest, GitHubIngestResponse
from app.services.github_service import github_service
from app.services.gemini_extractor import gemini_extractor
from app.services.neo4j_service import neo4j_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Data Ingestion"])

@router.post("/github", response_model=GitHubIngestResponse)
async def ingest_github_repositories(
    payload: GitHubIngestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Ingests public repositories for a candidate, extracts tech stacks using Gemini,
    and merges the graph topology into Neo4j scoped to the authenticated user.
    """
    username = payload.username or "mohitUpraity"
    user_id = current_user["id"]
    user_email = current_user.get("email", "")

    logger.info(f"Initiating GitHub ingestion for user {user_id} (GitHub: {username})")

    # 1. Fetch repositories
    raw_projects = await github_service.fetch_user_repositories(
        username=username,
        token=payload.github_token,
        max_repos=payload.max_repos
    )

    if not raw_projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No public repositories found for GitHub user '{username}'"
        )

    # 2. Extract skills per project using Gemini
    total_skills = set()
    processed_projects = []

    for proj in raw_projects:
        extracted_skills = await gemini_extractor.extract_project_skills(proj)
        proj["skills"] = extracted_skills
        for s in extracted_skills:
            total_skills.add(s["name"])
        processed_projects.append(proj)

    # 3. Upsert into Neo4j Graph with Multi-Tenant Isolation
    nodes_merged = await neo4j_service.upsert_user_github_projects(
        user_id=user_id,
        user_email=user_email,
        github_username=username,
        projects=processed_projects
    )

    return GitHubIngestResponse(
        status="success",
        username=username,
        repos_processed=len(processed_projects),
        skills_extracted=len(total_skills),
        projects=processed_projects,
        graph_nodes_merged=nodes_merged
    )
