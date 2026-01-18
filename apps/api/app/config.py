from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    debug: bool = False
    cors_origins: str = "http://localhost:5173"
    
    # OpenRouter
    openrouter_api_key: str
    default_model: str = "anthropic/claude-3.5-sonnet"
    
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    database_url: str
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
