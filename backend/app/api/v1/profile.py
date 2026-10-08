import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.services.profile_service import profile_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["Profile Intelligence"])

@router.get("/analysis", response_model=Dict[str, Any])
async def get_profile_analysis(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves deep Graph Intelligence analysis of the authenticated user's career footprint:
    - Code-verified vs Resume-claimed skills
    - GitHub projects & linked tech stack
    - Work experience & Education history
    - Network Reach & Alumni company connections
    - Career Readiness & Profile Completeness Score
    """
    user_id = current_user["id"]
    try:
        analysis = await profile_service.get_comprehensive_profile_analysis(user_id=user_id)
        return analysis
    except Exception as e:
        logger.error(f"Failed to fetch profile analysis for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph", response_model=Dict[str, Any])
async def get_graph_topology(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves full physics-simulated node and edge topology for D3 Force-Directed Canvas.
    """
    user_id = current_user["id"]
    try:
        topology = await profile_service.get_graph_topology(user_id=user_id)
        return topology
    except Exception as e:
        logger.error(f"Failed to fetch graph topology for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/connections", response_model=Dict[str, Any])
async def get_connections(
    search: str = "",
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves searchable connection directory and alumni bridges.
    """
    user_id = current_user["id"]
    try:
        connections = await profile_service.get_user_connections(user_id=user_id, search=search, limit=limit)
        return {
            "status": "success",
            "total": len(connections),
            "connections": connections,
            "contacts": connections
        }
    except Exception as e:
        logger.error(f"Failed to fetch connections for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preferences", response_model=Dict[str, Any])
async def get_user_preferences(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves user's career & opportunity matching preferences (Target Country, Cities, Roles, Work Modes, Stipend/Salary).
    """
    from app.services.neo4j_service import neo4j_service
    user_id = current_user["id"]
    try:
        prefs = await neo4j_service.get_user_preferences(user_id=user_id)
        return {
            "status": "success",
            "preferences": prefs
        }
    except Exception as e:
        logger.error(f"Failed to fetch preferences for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/preferences", response_model=Dict[str, Any])
async def update_user_preferences(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates user's career & opportunity matching preferences in Neo4j.
    """
    from app.services.neo4j_service import neo4j_service
    user_id = current_user["id"]
    try:
        updated = await neo4j_service.upsert_user_preferences(user_id=user_id, preferences=payload)
        return {
            "status": "success",
            "message": "Career preferences successfully updated",
            "preferences": updated
        }
    except Exception as e:
        logger.error(f"Failed to update preferences for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/details", response_model=Dict[str, Any])
async def get_profile_details(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves full user identity, headline, bio, education, experience,
    core skills list, and career matching preferences.
    """
    user_id = current_user["id"]
    try:
        details = await profile_service.get_user_profile_details(user_id=user_id)
        return {
            "status": "success",
            "profile": details
        }
    except Exception as e:
        logger.error(f"Failed to fetch profile details for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/details", response_model=Dict[str, Any])
async def update_profile_details(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates full user profile information, education, experience, skills,
    and matching preferences in Neo4j.
    """
    user_id = current_user["id"]
    try:
        updated = await profile_service.update_user_profile_details(user_id=user_id, payload=payload)
        return {
            "status": "success",
            "message": "User profile and career preferences updated successfully",
            "profile": updated
        }
    except Exception as e:
        logger.error(f"Failed to update profile details for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset", response_model=Dict[str, Any])
async def reset_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Safely resets the user's personal profile and graph data.
    """
    user_id = current_user["id"]
    try:
        res = await profile_service.reset_user_profile_data(user_id=user_id)
        return res
    except Exception as e:
        logger.error(f"Failed to reset profile for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market-intelligence", response_model=Dict[str, Any])
async def get_market_intelligence(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Calculates live market skill demand percentages, high-ROI missing skill unlock metrics,
    and actionable project sprints for bridging gaps.
    """
    user_id = current_user["id"]
    try:
        data = await profile_service.get_market_intelligence(user_id=user_id)
        return data
    except Exception as e:
        logger.error(f"Failed to calculate market intelligence for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/learning-action", response_model=Dict[str, Any])
async def toggle_learning_action(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Interactively toggles a skill between learning, mastered (synced to graph), or removed.
    """
    user_id = current_user["id"]
    skill_name = payload.get("skill_name", "")
    action = payload.get("action", "")
    try:
        res = await profile_service.toggle_learning_skill(user_id=user_id, skill_name=skill_name, action=action)
        return res
    except Exception as e:
        logger.error(f"Failed to execute learning action for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notegpt-bridge/{skill_name}", response_model=Dict[str, Any])
async def get_notegpt_skill_bridge(
    skill_name: str,
    target_role: str = "Backend Engineer",
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns NoteGPT-style features for any identified skill gap:
    - Interactive hierarchical Mind Map
    - 4-phase step-by-step Learning Roadmap with milestones
    - Free and Paid Verified Course & Certification Proofs with URLs
    - AI Study Notes & CLI Cheat Sheets
    - Mastery Flashcards / Interview Quiz
    """
    from app.services.notegpt_service import notegpt_bridge_service
    user_id = current_user.get("id")
    try:
        data = await notegpt_bridge_service.get_or_generate_skill_bridge(
            skill_name=skill_name,
            target_role=target_role,
            user_id=user_id
        )
        return data
    except Exception as e:
        logger.error(f"Failed to generate NoteGPT skill bridge for '{skill_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-certificate", response_model=Dict[str, Any])
async def verify_certificate_proof(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Submits a certificate verification proof URL or ID,
    attaches it to user's profile certifications, and marks the skill as mastered in the Graph.
    """
    from app.services.notegpt_service import notegpt_bridge_service
    user_id = current_user["id"]
    skill_name = payload.get("skill_name", "")
    certificate_title = payload.get("certificate_title", "")
    issuer = payload.get("issuer", "Independent Course Provider")
    credential_url = payload.get("credential_url", "")

    if not skill_name or not certificate_title:
        raise HTTPException(status_code=400, detail="skill_name and certificate_title are required")

    try:
        res = await notegpt_bridge_service.record_verified_certificate(
            user_id=user_id,
            skill_name=skill_name,
            certificate_title=certificate_title,
            issuer=issuer,
            credential_url=credential_url
        )
        return res
    except Exception as e:
        logger.error(f"Failed to record verified certificate for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ClaimUsernameRequest(BaseModel):
    username: str = Field(..., description="Unique alphanumeric username handle")

class VerifySkillRequest(BaseModel):
    skill_name: str = Field(..., description="Name of the skill to verify")
    difficulty_tier: Optional[str] = Field("L2", description="L1, L2, or L3")
    verification_score: Optional[int] = Field(90, description="Verification test score 0-100")
    proctoring_score: Optional[int] = Field(100, description="Proctoring integrity score 0-100")
    audio_proof_url: Optional[str] = Field(None, description="URL or key to audio highlight snippet")
    radar_scores: Optional[Dict[str, int]] = Field(None, description="Radar chart rubrics")
    feedback_summary: Optional[str] = Field(None, description="AI feedback summary of round")

@router.get("/public/{username}", response_model=Dict[str, Any])
async def get_public_profile(username: str) -> Dict[str, Any]:
    """
    Public-facing recruiter verification dossier (No Authentication Required).
    Returns verified skills with proof audio snippets, integrity scores,
    backed GitHub projects, and career footprint.
    """
    try:
        data = await profile_service.get_public_profile(username=username)
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to fetch public profile for '{username}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-username/{username}", response_model=Dict[str, Any])
async def check_username_availability(
    username: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Checks if a username handle is available or taken.
    """
    user_id = current_user.get("id")
    res = await profile_service.check_username_availability(username=username, current_user_id=user_id)
    if "temporarily unavailable" in res.get("message", "").lower():
        raise HTTPException(status_code=503, detail=res["message"])
    return res

@router.post("/username", response_model=Dict[str, Any])
async def claim_username_handle(
    payload: ClaimUsernameRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Claims or updates the unique CareerOS public username for the authenticated candidate.
    """
    user_id = current_user["id"]
    res = await profile_service.claim_or_update_username(user_id=user_id, username=payload.username)
    if not res.get("success"):
        status_code = 503 if "temporarily unavailable" in res.get("message", "").lower() else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Username unavailable"))
    return res

@router.post("/verify-skill", response_model=Dict[str, Any])
async def verify_skill_record(
    payload: VerifySkillRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mints a Verified Skill Badge on candidate's graph following an AI Proctored round.
    Stores audio proof, proctoring score, difficulty tier, and radar rubric breakdown.
    """
    user_id = current_user["id"]
    res = await profile_service.record_skill_verification(
        user_id=user_id,
        skill_name=payload.skill_name,
        difficulty_tier=payload.difficulty_tier or "L2",
        verification_score=payload.verification_score or 90,
        proctoring_score=payload.proctoring_score or 100,
        audio_proof_url=payload.audio_proof_url,
        radar_scores=payload.radar_scores,
        feedback_summary=payload.feedback_summary
    )
    return res
