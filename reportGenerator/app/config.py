"""Configuration management for Report Generator service."""

import os
from pathlib import Path
from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / ".env.local"
if not env_file.exists():
    env_file = Path(__file__).parent.parent / ".env"

load_dotenv(dotenv_path=env_file)


class Config:
    """Report Generator configuration."""
    
    SERVICE_PORT = int(os.getenv("SERVICE_PORT", "8004"))
    API_KEY = os.getenv("API_KEY", "dev-key")
    
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/clinical"
    )
    
    PDF_OUTPUT_DIR = os.getenv("PDF_OUTPUT_DIR", "reports/")
    
    PREVIEW_UI_ENDPOINT = os.getenv(
        "PREVIEW_UI_ENDPOINT",
        "http://localhost:3000/api/reports"
    )
    
    
    SCHEDULER_INTERVAL_SECONDS = int(os.getenv("SCHEDULER_INTERVAL_SECONDS", "3600"))  # Default: 1 hour
    SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    
    
    PREVIEW_UI_TIMEOUT_SECONDS = float(os.getenv("PREVIEW_UI_TIMEOUT_SECONDS", "10.0"))
    
    
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def validate(cls):
        """Validate critical configuration."""
        if not os.path.exists(cls.PDF_OUTPUT_DIR):
            os.makedirs(cls.PDF_OUTPUT_DIR)
            print(f"Created PDF output directory: {cls.PDF_OUTPUT_DIR}")
        
        if not cls.SCHEDULER_ENABLED:
            print("WARNING: Report Generator scheduler is disabled (SCHEDULER_ENABLED=false)")


# Load config on module import
config = Config()
