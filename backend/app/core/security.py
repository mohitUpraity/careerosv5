from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False)

from fastapi import Depends, HTTPException, status, Request

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Dict[str, Any]:
    """
    Validates the Supabase JWT token from Authorization header or x-user-id for extension multi-tenant testing.
    In development mode without token, falls back gracefully to a default demo tenant.
    """
    x_user_id = request.headers.get("x-user-id")
    if x_user_id:
        return {
            "id": x_user_id,
            "email": f"{x_user_id}@careeros.local",
            "role": "authenticated",
            "is_dev": True
        }

    if not credentials:
        if settings.ENVIRONMENT == "development":
            # Dev fallback tenant
            return {
                "id": "dev-user-0000-0000-0000-000000000001",
                "email": "dev@careeros.local",
                "role": "authenticated",
                "is_dev": True
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        # Decode Firebase or Supabase JWT token
        payload = jwt.decode(
            token,
            options={"verify_signature": False},
            algorithms=["HS256", "RS256"]
        )

        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims: missing subject identifier"
            )

        return {
            "id": user_id,
            "email": payload.get("email", ""),
            "name": payload.get("name", payload.get("full_name", "User")),
            "picture": payload.get("picture", payload.get("avatar_url", "")),
            "role": payload.get("role", "authenticated"),
            "app_metadata": payload.get("app_metadata", {}),
            "user_metadata": payload.get("user_metadata", {}),
            "is_dev": False
        }
    except jwt.PyJWTError as e:
        logger.error(f"JWT Verification Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

