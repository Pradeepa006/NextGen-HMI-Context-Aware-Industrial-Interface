"""
Backend Configuration
"""

import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "nextgen_hmi")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
SIMULATOR_INTERVAL = float(os.getenv("SIMULATOR_INTERVAL", "2.0"))
