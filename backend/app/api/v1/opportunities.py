import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user
from app.services.opportunities_service import OpportunitiesService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/opportunities", tags=["Live Opportunities & Semantic Matchmaker"])

@router.get("", response_model=Dict[str, Any])
async def get_live_opportunities(
    category: Optional[str] = Query("all", description="all, jobs, internships, hackathons, opensource"),
    search: Optional[str] = Query(None, description="Search term for title, company, or skills"),
    remote_only: bool = Query(False, description="Filter for 100% remote or virtual opportunities"),
    sort_by: str = Query("match_score", description="match_score, deadline, newest"),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns real-time verified opportunities (Jobs, Internships, Hackathons, Open Source Fellowships)
    scored semantically against the user's verified skills & project topology in Neo4j.
    """
    user_id = current_user["id"]
    try:
        opportunities = await OpportunitiesService.get_semantic_opportunities(
            user_id=user_id,
            category=category,
            search_query=search,
            remote_only=remote_only,
            sort_by=sort_by
        )

        # Compute summary counts
        counts = {
            "all": len(opportunities),
            "jobs": sum(1 for o in opportunities if o["category"] == "jobs"),
            "internships": sum(1 for o in opportunities if o["category"] == "internships"),
            "hackathons": sum(1 for o in opportunities if o["category"] == "hackathons"),
            "opensource": sum(1 for o in opportunities if o["category"] == "opensource"),
        }

        return {
            "status": "success",
            "total": len(opportunities),
            "category_counts": counts,
            "opportunities": opportunities
        }
    except Exception as e:
        logger.error(f"Failed to fetch opportunities for {user_id}: {e}")
        return {
            "status": "error",
            "total": 0,
            "opportunities": []
        }
