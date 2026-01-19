"""
Health Check Router

Provides endpoints for monitoring and load balancer health checks.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns:
        JSON with status "healthy" if service is running
    """
    return {"status": "healthy", "service": "dooza-ai-api"}
