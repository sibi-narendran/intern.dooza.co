from fastapi import Header, HTTPException, status
from jose import jwt, JWTError

from app.config import get_settings


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    Validate Supabase JWT token and extract user_id.
    
    The token is passed from the frontend in the Authorization header.
    Supabase JWTs contain the user_id in the 'sub' claim.
    """
    settings = get_settings()
    
    # Extract token from "Bearer <token>" format
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )
        
        return user_id
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
