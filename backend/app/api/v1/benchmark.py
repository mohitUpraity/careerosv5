import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from app.core.security import get_current_user
from app.services.benchmark_service import benchmark_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/benchmark", tags=["Benchmark & Peer Gap Analysis"])

class AddPeerRequest(BaseModel):
    github_username: Optional[str] = Field(None, description="Peer GitHub username to ingest")
    name: Optional[str] = Field(None, description="Peer display name")
    role: Optional[str] = Field(None, description="Peer target role / title")
    company: Optional[str] = Field(None, description="Peer company")
    custom_skills: Optional[List[str]] = Field(default=[], description="List of peer skills")
    github_token: Optional[str] = Field(None, description="Optional GitHub token for rate-limit bypass")

@router.get("/peers", response_model=Dict[str, Any])
async def get_user_benchmark_peers(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves all benchmark peers saved for the current user.
    """
    user_id = current_user["id"]
    try:
        peers = await benchmark_service.get_user_peers(user_id=user_id)
        return {"status": "success", "total": len(peers), "peers": peers}
    except Exception as e:
        logger.error(f"Failed to fetch peers for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/peers", response_model=Dict[str, Any])
async def add_benchmark_peer(
    payload: AddPeerRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Ingests a new peer via GitHub scanning or custom parameters.
    """
    user_id = current_user["id"]
    try:
        res = await benchmark_service.add_benchmark_peer(
            user_id=user_id,
            github_username=payload.github_username,
            name=payload.name,
            role=payload.role,
            company=payload.company,
            custom_skills=payload.custom_skills,
            github_token=payload.github_token
        )
        return res
    except Exception as e:
        logger.error(f"Failed to add peer for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/compare", response_model=Dict[str, Any])
async def compare_with_peer(
    peer_id: Optional[str] = Query(None, description="Peer ID to compare against"),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Computes side-by-side gap matrix, AST skill overlaps, and AI strategic roadmap.
    """
    user_id = current_user["id"]
    try:
        res = await benchmark_service.compare_candidate_vs_peer(user_id=user_id, peer_id=peer_id)
        return res
    except Exception as e:
        logger.error(f"Failed to compare user {user_id} with peer {peer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/peers/{peer_id}", response_model=Dict[str, Any])
async def delete_benchmark_peer(
    peer_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Removes a benchmark peer from user's account.
    """
    user_id = current_user["id"]
    try:
        await benchmark_service.delete_peer(user_id=user_id, peer_id=peer_id)
        return {"status": "success", "message": f"Peer {peer_id} removed"}
    except Exception as e:
        logger.error(f"Failed to delete peer {peer_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
