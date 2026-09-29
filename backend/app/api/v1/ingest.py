import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from app.core.security import get_current_user
from app.schemas.ingest_models import GitHubIngestRequest, GitHubIngestResponse
from app.schemas.resume_blueprint import ResumeIngestResponse
from app.services.github_service import github_service
from app.services.gemini_extractor import gemini_extractor
from app.services.resume_service import resume_service
from app.services.linkedin_service import linkedin_service
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

@router.post("/resume", response_model=ResumeIngestResponse)
async def ingest_candidate_resume(
    file: UploadFile = File(None),
    storage_path: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Ingests Golden Base Resume (PDF upload or Supabase storage path),
    extracts sections into an editable JSON Blueprint using Gemini 1.5 Flash,
    and updates user profile, university, and experience nodes in Neo4j AuraDB.
    """
    user_id = current_user["id"]
    logger.info(f"Processing resume upload for user {user_id}")

    pdf_bytes = b""
    if file:
        pdf_bytes = await file.read()
    elif storage_path:
        # Future: download from Supabase storage if storage_path provided
        logger.info(f"Fetching from storage path: {storage_path}")

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PDF file provided in upload"
        )

    # 1. Extract digital text stream
    raw_text = resume_service.extract_text_from_pdf(pdf_bytes)
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to extract text from PDF document"
        )

    # 2. Parse into structured JSON layout blueprint
    blueprint = await resume_service.parse_resume_to_blueprint(raw_text)

    # 3. Upsert into Neo4j Graph
    nodes_merged = await neo4j_service.upsert_user_resume_blueprint(
        user_id=user_id,
        blueprint=blueprint
    )

    all_skills = []
    for cat in blueprint.skills:
        all_skills.extend(cat.skills)

    universities = [edu.university for edu in blueprint.education if edu.university]
    companies = [exp.company for exp in blueprint.experience if exp.company]

    return ResumeIngestResponse(
        status="success",
        user_id=user_id,
        blueprint=blueprint,
        total_skills_extracted=len(set(all_skills)),
        universities_mapped=universities,
        companies_mapped=companies,
        graph_nodes_merged=nodes_merged
    )

@router.post("/linkedin")
async def ingest_linkedin_connections(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Ingests official LinkedIn Connections.csv, mapping 1st-degree contacts,
    current employers, and alumni nodes into Neo4j AuraDB.
    """
    user_id = current_user["id"]
    logger.info(f"Processing LinkedIn Connections.csv for user {user_id}")

    csv_bytes = await file.read()
    connections = linkedin_service.parse_connections_csv(csv_bytes)

    if not connections:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to parse valid connections from uploaded CSV. Ensure it is the official LinkedIn Connections.csv file."
        )

    # Upsert into Neo4j
    nodes_merged = await neo4j_service.upsert_user_linkedin_connections(
        user_id=user_id,
        connections=connections
    )

    companies = list(set([c["company"] for c in connections if c["company"]]))

    return {
        "status": "success",
        "user_id": user_id,
        "total_connections_imported": len(connections),
        "companies_mapped": len(companies),
        "sample_companies": companies[:10],
        "graph_nodes_merged": nodes_merged
    }

class LeadPostRequest(BaseModel):
    post_text: str
    target_role_hint: Optional[str] = None

@router.post("/lead-post")
async def ingest_hiring_lead_post(
    payload: LeadPostRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Pastes a raw LinkedIn 'I am hiring' post or job snippet, extracts company and skills,
    and immediately runs graph traversal to discover referral paths in your network.
    """
    user_id = current_user["id"]
    lead_data = await linkedin_service.parse_hiring_lead_post(payload.post_text)
    
    result = await neo4j_service.upsert_hiring_lead_job(
        user_id=user_id,
        lead_data=lead_data
    )

    return {
        "status": "success",
        "lead_extracted": lead_data,
        "referral_bridges": result["referral_bridges"]
    }
