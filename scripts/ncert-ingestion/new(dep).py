# product/scripts/ncert-ingestion/dependencies.py

from rag_system import RAGSystem
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize RAG system (singleton)
_rag_system = None

def get_rag_system() -> RAGSystem:
    """Dependency injection for RAG system"""
    global _rag_system
    if _rag_system is None:
        _rag_system = RAGSystem()
    return _rag_system

# API Configuration
API_PREFIX = "/api"
RAG_API_URL = os.getenv("RAG_API_URL", "http://localhost:8000")