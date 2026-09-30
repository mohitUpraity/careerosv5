from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Supabase Auth & Storage
    SUPABASE_URL: str = Field(default="", description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(default="", description="Supabase anonymous client key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="", description="Supabase service role key")
    DATABASE_URL: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "resumes"

    # AI Providers
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Neo4j Graph Database
    NEO4J_URI: str = "neo4j+ssc://a68e0c1f.databases.neo4j.io"
    NEO4J_USERNAME: str = "a68e0c1f"
    NEO4J_PASSWORD: str = ""
    NEO4J_DATABASE: str = "a68e0c1f"


    # Keep-Alive & Self-Pinger (Prevents Render Free Tier Cold Sleep)
    KEEP_ALIVE_URL: Optional[str] = None
    RENDER_EXTERNAL_URL: Optional[str] = None
    KEEP_ALIVE_INTERVAL_SECONDS: int = 600  # 10 minutes (Render spins down after 15 mins)


    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            ".env"
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
