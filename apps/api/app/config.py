from __future__ import annotations
from functools import lru_cache
from typing import List, Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    debug: bool = False
    cors_origins: str = "http://localhost:5173"
    
    # LLM Provider Selection
    # Options: "openai" (recommended for LangGraph), "openrouter", "gemini"
    llm_provider: Literal["openai", "openrouter", "gemini"] = "openai"
    
    # OpenAI Direct (recommended for best LangGraph compatibility)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"  # Best for agentic workflows
    default_model: str = "gpt-4o"  # Default model fallback
    
    # OpenRouter (multi-provider gateway)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-3-flash-preview"
    
    # Google Gemini Direct (v3 requires langchain-google-genai for thoughtSignature support)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"
    
    # Google Cloud / Vertex AI (fallback for image generation)
    google_cloud_project: str = ""
    google_cloud_location: str = "global"
    
    # Image Generation - uses OpenRouter by default (via openrouter_api_key)
    # Model: "gemini-3-pro-image-preview" (Nano Banana Pro)
    image_gen_model: str = "gemini-3-pro-image-preview"
    
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    database_url: str
    
    # Composio (for integrations)
    composio_api_key: str = ""
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
