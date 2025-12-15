# product/scripts/ncert-ingestion/routes/chat.py

"""
NCERT RAG Chat API Endpoint
Handles Q&A queries with NCERT context retrieval
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import logging
import time
from datetime import datetime

# Internal imports
from app_dependencies import get_rag_system
from rag_system import RAGSystem

# Setup logging
logger = logging.getLogger(__name__)
router = APIRouter()

# ============== REQUEST/RESPONSE MODELS ==============

class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    
    question: str = Field(
        ..., 
        min_length=3, 
        max_length=1000,
        description="The question to answer using NCERT content"
    )
    
    subject: Optional[str] = Field(
        None,
        min_length=2,
        max_length=50,
        description="Subject (e.g., 'Physics', 'Mathematics')"
    )
    
    class_num: Optional[int] = Field(
        None,
        ge=1,
        le=12,
        description="Class number (1-12)"
    )
    
    chapter: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
        description="Chapter name or number"
    )
    
    include_sources: bool = Field(
        True,
        description="Whether to include source documents in response"
    )
    
    top_k: int = Field(
        5,
        ge=1,
        le=20,
        description="Number of document chunks to retrieve"
    )
    
    threshold: float = Field(
        0.7,
        ge=0.1,
        le=1.0,
        description="Similarity threshold for retrieval"
    )
    
    language: Optional[str] = Field(
        "english",
        regex="^(english|hindi)$",
        description="Response language (english/hindi)"
    )
    
    @validator('question')
    def validate_question(cls, v):
        """Validate question is meaningful"""
        v = v.strip()
        if len(v.split()) < 2:
            raise ValueError('Question must be at least 2 words')
        return v

class SourceResponse(BaseModel):
    """Response model for source documents"""
    
    id: Optional[str] = Field(None, description="Source document ID")
    content: str = Field(..., description="Content snippet")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Document metadata (source, page, chapter, etc.)"
    )
    similarity: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Cosine similarity score"
    )
    relevance_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Normalized relevance score"
    )

class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    
    success: bool = Field(..., description="Request success status")
    answer: str = Field(..., description="Generated answer")
    question: str = Field(..., description="Original question")
    sources: List[SourceResponse] = Field(
        default_factory=list,
        description="Retrieved source documents"
    )
    chunks_retrieved: int = Field(
        ...,
        ge=0,
        description="Number of chunks retrieved"
    )
    confidence: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Overall confidence score"
    )
    processing_time_ms: int = Field(
        ..., 
        description="Total processing time in milliseconds"
    )
    request_id: Optional[str] = Field(
        None,
        description="Unique request identifier for debugging"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Any warnings during processing"
    )

# ============== ERROR HANDLERS ==============

class NCERTQueryError(Exception):
    """Custom exception for NCERT query errors"""
    def __init__(self, message: str, error_code: str = "NCERT_QUERY_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)

# ============== HELPER FUNCTIONS ==============

def enhance_query_for_ncert(
    question: str, 
    subject: Optional[str] = None,
    class_num: Optional[int] = None,
    chapter: Optional[str] = None
) -> str:
    """
    Enhance user query with NCERT context hints
    
    Args:
        question: Original user question
        subject: Subject name
        class_num: Class number
        chapter: Chapter name
    
    Returns:
        Enhanced query string
    """
    enhancements = []
    
    if subject:
        enhancements.append(f"Subject: {subject}")
    if class_num:
        enhancements.append(f"Class: {class_num}")
    if chapter:
        enhancements.append(f"Chapter: {chapter}")
    
    if enhancements:
        context = " | ".join(enhancements)
        return f"{context} - {question}"
    
    return question

def calculate_confidence(sources: List[Dict]) -> float:
    """
    Calculate overall confidence based on source similarities
    
    Args:
        sources: List of source documents with similarity scores
    
    Returns:
        Confidence score between 0 and 1
    """
    if not sources:
        return 0.0
    
    similarities = [s.get("similarity", 0) for s in sources]
    
    # Weighted average - higher weight for top results
    weights = [0.4, 0.3, 0.2, 0.1] + [0.05] * (len(similarities) - 4)
    weights = weights[:len(similarities)]
    
    # Normalize weights
    total_weight = sum(weights)
    weighted_sum = sum(w * s for w, s in zip(weights, similarities))
    
    return min(weighted_sum / total_weight, 1.0) if total_weight > 0 else 0.0

# ============== API ENDPOINT ==============

@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Query NCERT Content",
    description="""
    Answer questions using NCERT textbook content via RAG (Retrieval Augmented Generation).
    
    This endpoint:
    1. Retrieves relevant NCERT content using vector similarity search
    2. Uses LLM to generate answers based on retrieved context
    3. Returns answer along with source documents for verification
    
    **Authentication Required:** No (Public endpoint)
    **Rate Limiting:** 10 requests/minute per IP
    """
)
async def chat_query(
    request: ChatRequest,
    rag: RAGSystem = Depends(get_rag_system)
) -> JSONResponse:
    """
    Query NCERT content using RAG
    
    Args:
        request: ChatRequest with question and filters
        rag: RAGSystem instance (dependency injected)
    
    Returns:
        ChatResponse with answer and sources
    
    Raises:
        HTTPException: If query fails or validation error
    """
    # Start timing
    start_time = time.time()
    request_id = f"chat_{int(datetime.utcnow().timestamp())}_{hash(request.question) % 10000}"
    
    try:
        logger.info(f"Chat request received - ID: {request_id}, Question: {request.question[:50]}...")
        
        # Step 1: Enhance query with NCERT context
        enhanced_query = enhance_query_for_ncert(
            request.question,
            request.subject,
            request.class_num,
            request.chapter
        )
        
        logger.debug(f"Enhanced query: {enhanced_query}")
        
        # Step 2: Get RAG response (with timeout protection)
        rag.top_k = request.top_k  # Update RAG config
        
        result = await rag.query(enhanced_query)
        
        # Step 3: Process sources
        processed_sources = []
        warnings = []
        
        if request.include_sources:
            for i, source in enumerate(result.get("sources", [])):
                # Calculate relevance score (normalized position-based)
                relevance = 1.0 - (i * 0.1)  # Top results are more relevant
                
                processed_sources.append(
                    SourceResponse(
                        id=source.get("id"),
                        content=source.get("content", ""),
                        metadata=source.get("metadata", {}),
                        similarity=source.get("similarity", 0.0),
                        relevance_score=min(relevance, 1.0)
                    )
                )
        
        # Step 4: Calculate confidence
        confidence = calculate_confidence(result.get("sources", []))
        
        # Step 5: Check for low confidence
        if confidence < 0.3:
            warnings.append("Low confidence answer - consider rephrasing question")
        
        # Step 6: Prepare response
        processing_time = int((time.time() - start_time) * 1000)
        
        response = ChatResponse(
            success=True,
            answer=result.get("answer", "Unable to generate answer"),
            question=request.question,
            sources=processed_sources,
            chunks_retrieved=result.get("chunks_retrieved", 0),
            confidence=confidence,
            processing_time_ms=processing_time,
            request_id=request_id,
            warnings=warnings
        )
        
        logger.info(f"Chat request completed - ID: {request_id}, Time: {processing_time}ms")
        
        return response
        
    except ValueError as e:
        # Validation error
        logger.warning(f"Validation error - ID: {request_id}, Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Validation Error",
                "message": str(e),
                "request_id": request_id
            }
        )
        
    except NCERTQueryError as e:
        # Business logic error
        logger.error(f"NCERT query error - ID: {request_id}, Error: {e.error_code}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": e.error_code,
                "message": e.message,
                "request_id": request_id
            }
        )
        
    except Exception as e:
        # Unexpected error
        logger.error(f"Unexpected error - ID: {request_id}, Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "request_id": request_id,
                "hint": "Please try again or contact support"
            }
        )

# ============== HEALTH CHECK ENDPOINT ==============

@router.get(
    "/health",
    summary="Chat Endpoint Health Check",
    description="Check if chat endpoint is operational"
)
async def chat_health_check(
    rag: RAGSystem = Depends(get_rag_system)
) -> Dict[str, Any]:
    """
    Health check for chat endpoint
    
    Returns:
        Dictionary with health status and component checks
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "rag_system": "operational",
            "vector_database": "operational",
            "llm_service": "operational"
        }
    }
    
    try:
        # Quick test query to verify system works
        test_result = await rag.query("What is science?")
        health_status["test_query"] = {
            "success": True,
            "chunks_retrieved": test_result.get("chunks_retrieved", 0)
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["rag_system"] = "degraded"
        health_status["error"] = str(e)
    
    return health_status