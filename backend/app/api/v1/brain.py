import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import get_current_user
from app.services.brain_service import brain_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/brain", tags=["CareerOS Brain (GraphRAG)"])

class ChatMessageItem(BaseModel):
    role: str
    content: str

class BrainChatRequest(BaseModel):
    query: str
    conversation_history: Optional[List[ChatMessageItem]] = None
    context_mode: Optional[str] = "general"

class GraphQueryRequest(BaseModel):
    query: str


@router.post("/chat", response_model=Dict[str, Any])
async def chat_with_brain(
    request: BrainChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Executes a GraphRAG career intelligence query.
    Traverses the user's Neo4j Knowledge Graph, retrieves verified code evidence,
    and returns an AI reasoning response with graph node citations and follow-up prompts.
    """
    user_id = current_user["id"]
    try:
        history_dicts = [
            {"role": m.role, "content": m.content}
            for m in (request.conversation_history or [])
        ]
        response = await brain_service.chat(
            user_id=user_id,
            query=request.query,
            conversation_history=history_dicts,
            context_mode=request.context_mode or "general"
        )
        return response
    except Exception as e:
        logger.error(f"Error executing GraphRAG Brain Chat for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/graph-query", response_model=Dict[str, Any])
async def execute_smart_graph_query(
    request: GraphQueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Translates a natural language user query into an uncluttered, focused Knowledge Graph subgraph.
    """
    user_id = current_user["id"]
    try:
        res = await brain_service.smart_graph_query(user_id=user_id, query=request.query)
        return res
    except Exception as e:
        logger.error(f"Error executing smart graph query for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

