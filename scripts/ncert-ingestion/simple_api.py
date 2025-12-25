import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio
import json
import traceback
from contextlib import asynccontextmanager

# Add current directory to path to import rag_system
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

# Try to import rag_system directly
try:
    import rag_system  # Import the module
    print("✓ Successfully imported rag_system module")
except ImportError as e:
    print(f"❌ Error importing rag_system: {e}")
    print(f"Current directory: {current_dir}")
    print(f"Files in directory: {os.listdir(current_dir)}")
    raise

# Global RAG system instance
rag_system_instance = None

# Lifespan manager for startup/shutdown (replaces on_event decorators)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global rag_system_instance
    print("🚀 Starting up NCERT RAG API...")
    
    try:
        rag_system_instance = rag_system.RAGSystem()
        await rag_system_instance.initialize()
        print("✅ RAG System initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize RAG system: {e}")
        traceback.print_exc()
        raise
    
    yield  # App runs here
    
    # Shutdown
    if rag_system_instance:
        await rag_system_instance.close()
        print("✅ RAG System shutdown complete")

# Initialize FastAPI with lifespan
app = FastAPI(
    title="NCERT RAG API",
    description="API for NCERT Textbook Question Answering System",
    version="1.0.0",
    lifespan=lifespan  # Use lifespan instead of on_event
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class QueryRequest(BaseModel):
    query: str
    class_grade: Optional[str] = None
    subject: Optional[str] = None
    chapter: Optional[str] = None
    top_k: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.7

class QueryResponse(BaseModel):
    response: str
    sources: List[Dict]
    chunks: List[Dict]
    processing_time: float

class HealthResponse(BaseModel):
    status: str
    database_connected: bool
    gemini_configured: bool
    total_chunks: int
    model_info: Dict

class StatsResponse(BaseModel):
    total_chunks: int
    by_class: List[Dict]
    by_subject: List[Dict]
    top_chapters: List[Dict]

class IngestRequest(BaseModel):
    text: str
    class_grade: str
    subject: str
    chapter: str
    metadata: Optional[Dict] = None

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to NCERT RAG API",
        "version": "1.0.0",
        "endpoints": {
            "POST /query": "Ask questions",
            "GET /health": "System health check",
            "GET /stats": "Database statistics",
            "POST /ingest": "Ingest new content"
        }
    }

@app.get("/health")
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    if not rag_system_instance:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    try:
        # Check database connection
        db_connected = False
        total_chunks = 0
        
        if rag_system_instance.pool:
            async with rag_system_instance.pool.acquire() as conn:
                try:
                    total_chunks = await conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
                    db_connected = True
                except:
                    db_connected = False
        
        # Check Gemini
        gemini_configured = rag_system_instance.gemini_api_key is not None
        
        return HealthResponse(
            status="healthy" if db_connected and gemini_configured else "degraded",
            database_connected=db_connected,
            gemini_configured=gemini_configured,
            total_chunks=total_chunks,
            model_info={
                "embedding_model": rag_system_instance.embedding_model,
                "llm_model": rag_system_instance.llm_model
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats() -> StatsResponse:
    """Get database statistics."""
    if not rag_system_instance or not rag_system_instance.pool:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    try:
        async with rag_system_instance.pool.acquire() as conn:
            # Total chunks
            total_chunks = await conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
            
            # By class
            class_stats = await conn.fetch(
                "SELECT class_grade, COUNT(*) as count FROM ncert_chunks GROUP BY class_grade ORDER BY class_grade"
            )
            
            # By subject
            subject_stats = await conn.fetch(
                "SELECT subject, COUNT(*) as count FROM ncert_chunks GROUP BY subject ORDER BY subject"
            )
            
            # Top chapters
            chapter_stats = await conn.fetch(
                "SELECT chapter, COUNT(*) as count FROM ncert_chunks GROUP BY chapter ORDER BY count DESC LIMIT 10"
            )
            
            return StatsResponse(
                total_chunks=total_chunks,
                by_class=[dict(row) for row in class_stats],
                by_subject=[dict(row) for row in subject_stats],
                top_chapters=[dict(row) for row in chapter_stats]
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest) -> QueryResponse:
    """Query endpoint - ask questions to the NCERT RAG system."""
    if not rag_system_instance:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    import time
    start_time = time.time()
    
    try:
        # Prepare filters
        filters = {}
        if request.class_grade:
            filters['class_grade'] = request.class_grade
        if request.subject:
            filters['subject'] = request.subject
        if request.chapter:
            filters['chapter'] = request.chapter
        
        print(f"📥 Received query: '{request.query}' with filters: {filters}")
        
        # Execute RAG query
        result = await rag_system_instance.rag_query(
            query=request.query,
            **filters
        )
        
        processing_time = time.time() - start_time
        
        return QueryResponse(
            response=result['response'],
            sources=result['sources'],
            chunks=result['chunks'],
            processing_time=round(processing_time, 2)
        )
        
    except Exception as e:
        print(f"❌ Error in query endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest")
async def ingest_content(request: IngestRequest):
    """Ingest new NCERT content."""
    if not rag_system_instance:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    try:
        # Prepare metadata
        metadata = {
            'class_grade': request.class_grade,
            'subject': request.subject,
            'chapter': request.chapter,
            'content': request.text
        }
        
        if request.metadata:
            metadata.update(request.metadata)
        
        # Generate embedding
        embedding = await rag_system_instance.generate_embedding(request.text)
        
        # Store in database
        success = await rag_system_instance.store_embeddings([embedding], [metadata])
        
        if success:
            return {
                "status": "success",
                "message": "Content ingested successfully",
                "metadata": metadata
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to store content")
            
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def main():
    """Main function to run the server."""
    print("\n" + "="*60)
    print("NCERT RAG API Server")
    print("="*60)
    
    # Import uvicorn here to avoid import if not running server
    import uvicorn
    
    # Run with reload=False to avoid the warning
    uvicorn.run(
        "simple_api:app",  # Pass as import string: "module_name:app_variable"
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=False  # Disable reload to avoid the warning
    )

if __name__ == "__main__":
    main()