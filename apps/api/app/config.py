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
    
    # OpenRouter (multi-provider gateway)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.5-flash"
    
    # Google Gemini Direct
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    
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
