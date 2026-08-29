from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "ANN — Surplus Food Redistribution Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api"
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://ann_user:ann_secure_pass@localhost:5432/ann_db"
    )
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ann-super-secret-production-jwt-key-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days
    
    ALLOWED_ORIGINS: Union[str, List[str]] = "http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000"
    UPLOAD_DIR: str = "uploads"

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, str):
            return [i.strip() for i in self.ALLOWED_ORIGINS.split(",") if i.strip()]
        return self.ALLOWED_ORIGINS

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()