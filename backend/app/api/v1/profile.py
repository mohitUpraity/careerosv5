import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
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
