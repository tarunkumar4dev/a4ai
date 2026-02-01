"""
Configuration for NCERT Test Generator
"""

import os
import sys
from dataclasses import dataclass
import urllib.parse

# ===== FIX: Load environment from the correct .env file =====
from dotenv import load_dotenv

# Find and load the .env file from ncert-ingestion folder
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)  # Goes up to scripts folder

# Look for .env in ncert-ingestion folder
env_path_1 = os.path.join(project_root, "ncert-ingestion", ".env")
env_path_2 = os.path.join(project_root, ".env")

if os.path.exists(env_path_1):
    load_dotenv(env_path_1)
    print(f"[Config] Loaded .env from: {env_path_1}")
elif os.path.exists(env_path_2):
    load_dotenv(env_path_2)
    print(f"[Config] Loaded .env from: {env_path_2}")
else:
    load_dotenv()
    print("[Config] Loaded .env from default location")

# ===== Configuration Classes =====

@dataclass
class DatabaseConfig:
    """Database configuration for Supabase."""
    host: str = "db.dcmnzvjftmdbywrjkust.supabase.co"
    port: int = 5432
    database: str = "postgres"
    user: str = "postgres"
    password: str = os.getenv("DATABASE_PASSWORD", "")
    
    @property
    def encoded_connection_string(self) -> str:
        """URL-encoded connection string for passwords with special characters."""
        if not self.password:
            raise ValueError("DATABASE_PASSWORD not found in environment")
        
        encoded_password = urllib.parse.quote(self.password)
        return f"postgresql://{self.user}:{encoded_password}@{self.host}:{self.port}/{self.database}?sslmode=require"

@dataclass
class EmbeddingConfig:
    model_name: str = "all-MiniLM-L6-v2"
    dimension: int = 384
    similarity_threshold: float = 0.7
    max_chunks: int = 15

@dataclass
class LLMConfig:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    model_name: str = "gemini-pro"
    temperature: float = 0.7
    max_tokens: int = 4000

@dataclass
class AppConfig:
    db: DatabaseConfig = DatabaseConfig()
    embedding: EmbeddingConfig = EmbeddingConfig()
    llm: LLMConfig = LLMConfig()
    
    def validate(self):
        """Validate required configuration."""
        errors = []
        
        if not self.db.password:
            errors.append("DATABASE_PASSWORD environment variable is required")
        
        if not self.llm.gemini_api_key:
            errors.append("GEMINI_API_KEY environment variable is required")
        
        if errors:
            raise ValueError(" | ".join(errors))
        
        return True

# Global config instance
config = AppConfig()

# Test on import
try:
    config.validate()
    print("[Config] ✅ Configuration validated successfully")
except ValueError as e:
    print(f"[Config] ⚠️ Configuration warning: {e}")
    print("[Config] Some features may not work without proper configuration")

if __name__ == "__main__":
    print("=== CONFIG TEST ===")
    print(f"Database Host: {config.db.host}")
    print(f"Database User: {config.db.user}")
    print(f"Has Password: {'YES' if config.db.password else 'NO'}")
    print(f"Gemini API Key: {'SET' if config.llm.gemini_api_key else 'NOT SET'}")
