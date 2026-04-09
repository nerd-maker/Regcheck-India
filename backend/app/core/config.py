"""
Configuration management for RegCheck-India backend.
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = ConfigDict(env_file=".env", case_sensitive=False, extra="ignore")
    
    # API Configuration
    app_name: str = "RegCheck-India"
    app_version: str = "1.0.0"
    
    # LLM Configuration (NVIDIA OpenAI-compatible API)
    llm_api_key: str = ""
    llm_base_url: str = "https://integrate.api.nvidia.com/v1"
    llm_model: str = "openai/gpt-oss-120b"
    llm_max_tokens: int = 8000
    llm_temperature: float = 0.0
    
    # Server Configuration
    backend_port: int = 8000
    frontend_port: int = 3000
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Rate Limiting
    rate_limit_per_minute: int = 30
    
    # ChromaDB Configuration
    chromadb_path: str = "./data/chromadb"
    chromadb_collection_name: str = "regulatory_knowledge"
    memory_optimized_mode: bool = True
    
    # File Upload Configuration
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"
    allowed_extensions: List[str] = [".pdf", ".docx"]
    runtime_state_db: str = "./data/runtime/runtime_state.db"
    audit_log_retention_days: int = 30
    audit_log_encryption_key: str = ""
    
    # RAG Configuration
    rag_top_k: int = 10
    rag_similarity_threshold: float = 0.7
    
    # Environment
    environment: str = "development"
    log_level: str = "INFO"
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Convert comma-separated origins to list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]
    
    @property
    def max_upload_size_bytes(self) -> int:
        """Convert MB to bytes."""
        return self.max_upload_size_mb * 1024 * 1024


# Global settings instance
settings = Settings()
