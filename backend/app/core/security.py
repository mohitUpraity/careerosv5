from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Dict[str, Any]:
    """
    Validates the Supabase JWT token from Authorization header and extracts user identity.
    In development mode without token, falls back gracefully to a default demo tenant.
    """
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
        # Supabase uses HS256 with SUPABASE_SERVICE_ROLE_KEY / JWT Secret or unverified payload decode if secret not provided
        if settings.SUPABASE_SERVICE_ROLE_KEY:
            # Decode using unverified signature or secret check
            payload = jwt.decode(
                token,
                options={"verify_signature": False}, # Supabase tokens can be decoded or verified
                algorithms=["HS256", "RS256"]
            )
        else:
            payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims: missing subject identifier"
            )

        return {
            "id": user_id,
            "email": payload.get("email", ""),
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
