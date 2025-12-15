# product/scripts/ncert-ingestion/routes/test_gen.py

"""
Test Generation API Endpoint
Generates NCERT-aligned tests using RAG + LLM
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from pydantic import BaseModel, Field, validator, conint, confloat
from typing import List, Optional, Dict, Any, Literal, Union
import json
import uuid
import logging
import asyncio
import time
from datetime import datetime, timedelta
from enum import Enum
import os

# Internal imports
from app_dependencies import get_rag_system
from rag_system import RAGSystem

# Setup logging
logger = logging.getLogger(__name__)
router = APIRouter()

# ============== CONSTANTS & ENUMS ==============

class QuestionType(str, Enum):
    MCQ = "mcq"
    SHORT = "short"
    LONG = "long"
    NUMERICAL = "numerical"
    CASE_BASED = "case_based"
    TRUE_FALSE = "true_false"
    FILL_BLANKS = "fill_blanks"

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    MIXED = "mixed"

class CognitiveLevel(str, Enum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"

class Language(str, Enum):
    ENGLISH = "english"
    HINDI = "hindi"

class OutputFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    CSV = "csv"
    JSON = "json"
    HTML = "html"

# ============== REQUEST MODELS ==============

class TestBucket(BaseModel):
    """Model for test question bucket configuration"""
    
    type: QuestionType = Field(
        ..., 
        description="Type of questions in this bucket"
    )
    
    difficulty: DifficultyLevel = Field(
        default=DifficultyLevel.MEDIUM,
        description="Difficulty level for questions"
    )
    
    cognitive: Optional[CognitiveLevel] = Field(
        default=CognitiveLevel.UNDERSTAND,
        description="Cognitive level (Bloom's taxonomy)"
    )
    
    count: conint(ge=1, le=100) = Field(
        ...,
        description="Number of questions in this bucket"
    )
    
    marks: conint(ge=0, le=20) = Field(
        default=1,
        description="Marks per question"
    )
    
    negativeMarking: Optional[confloat(ge=0.0, le=1.0)] = Field(
        default=None,
        description="Negative marking ratio (e.g., 0.25 for ¼ negative marking)"
    )
    
    chapters: Optional[List[str]] = Field(
        default=None,
        description="Specific chapters to focus on"
    )
    
    ncertChapters: Optional[List[str]] = Field(
        default=None,
        description="NCERT chapter references"
    )
    
    topics: Optional[List[str]] = Field(
        default=None,
        description="Specific topics within chapters"
    )

class TestGenerationRequest(BaseModel):
    """Request model for test generation"""
    
    # Core Identity
    userId: str = Field(
        ...,
        min_length=1,
        description="User ID for tracking and personalization"
    )
    
    requestId: Optional[str] = Field(
        default=None,
        description="Custom request ID for idempotency"
    )
    
    # Subject & Scope
    subject: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Subject name (e.g., Physics, Mathematics)"
    )
    
    classNum: conint(ge=1, le=12) = Field(
        ...,
        description="Class number (1-12)"
    )
    
    board: Optional[str] = Field(
        default="CBSE",
        description="Education board (CBSE, ICSE, State, etc.)"
    )
    
    topic: Optional[str] = Field(
        default=None,
        description="Specific topic for focused test"
    )
    
    chapters: Optional[List[str]] = Field(
        default=None,
        description="List of chapters to include"
    )
    
    # NCERT/RAG Configuration
    useNCERT: bool = Field(
        default=True,
        description="Whether to use NCERT content"
    )
    
    ncertClass: Optional[conint(ge=1, le=12)] = Field(
        default=None,
        description="Specific NCERT class (defaults to classNum)"
    )
    
    ncertSubject: Optional[str] = Field(
        default=None,
        description="Specific NCERT subject name"
    )
    
    ncertChapters: List[str] = Field(
        default_factory=list,
        description="NCERT chapters to reference"
    )
    
    ncertWeight: confloat(ge=0.0, le=1.0) = Field(
        default=0.7,
        description="Weight given to NCERT content vs general knowledge"
    )
    
    # RAG Parameters
    useRAG: bool = Field(
        default=True,
        description="Use RAG for context retrieval"
    )
    
    ragContext: Optional[str] = Field(
        default=None,
        description="Pre-fetched RAG context (skip retrieval if provided)"
    )
    
    ragQuery: Optional[str] = Field(
        default=None,
        description="Custom query for RAG retrieval"
    )
    
    ragThreshold: confloat(ge=0.1, le=1.0) = Field(
        default=0.7,
        description="Similarity threshold for RAG retrieval"
    )
    
    ragTopK: conint(ge=1, le=20) = Field(
        default=5,
        description="Number of chunks to retrieve via RAG"
    )
    
    # Test Configuration
    qCount: Optional[conint(ge=1, le=100)] = Field(
        default=10,
        description="Total number of questions"
    )
    
    difficulty: DifficultyLevel = Field(
        default=DifficultyLevel.MEDIUM,
        description="Overall test difficulty"
    )
    
    buckets: Optional[List[TestBucket]] = Field(
        default=None,
        description="Detailed question bucket configuration"
    )
    
    # Output Configuration
    language: Language = Field(
        default=Language.ENGLISH,
        description="Language for test paper"
    )
    
    outputFormat: OutputFormat = Field(
        default=OutputFormat.PDF,
        description="Output format for test paper"
    )
    
    includePageNumbers: bool = Field(
        default=True,
        description="Include page numbers in output"
    )
    
    includeAnswerKey: bool = Field(
        default=True,
        description="Include answer key with test"
    )
    
    includeInstructions: bool = Field(
        default=True,
        description="Include test instructions"
    )
    
    watermark: bool = Field(
        default=True,
        description="Add watermark to output"
    )
    
    teacherName: Optional[str] = Field(
        default=None,
        description="Teacher name for test header"
    )
    
    examDate: Optional[str] = Field(
        default=None,
        description="Exam date in YYYY-MM-DD format"
    )
    
    # Advanced Settings
    shuffleQuestions: bool = Field(
        default=True,
        description="Shuffle question order"
    )
    
    shuffleOptions: bool = Field(
        default=True,
        description="Shuffle MCQ options"
    )
    
    timeLimit: Optional[conint(ge=5, le=180)] = Field(
        default=None,
        description="Time limit in minutes"
    )
    
    maxMarks: Optional[conint(ge=1, le=200)] = Field(
        default=None,
        description="Maximum marks for test"
    )
    
    # Validators
    @validator('examDate')
    def validate_exam_date(cls, v):
        if v:
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('examDate must be in YYYY-MM-DD format')
        return v
    
    @validator('ncertClass')
    def set_ncert_class(cls, v, values):
        if v is None and 'classNum' in values:
            return values['classNum']
        return v
    
    @validator('ncertSubject')
    def set_ncert_subject(cls, v, values):
        if v is None and 'subject' in values:
            return values['subject']
        return v
    
    @validator('buckets')
    def validate_buckets(cls, v, values):
        if v:
            total_questions = sum(bucket.count for bucket in v)
            if 'qCount' in values and values['qCount']:
                if total_questions != values['qCount']:
                    raise ValueError(f'Total questions in buckets ({total_questions}) must match qCount ({values["qCount"]})')
            else:
                # Set qCount from buckets if not provided
                values['qCount'] = total_questions
        return v

# ============== RESPONSE MODELS ==============

class QuestionModel(BaseModel):
    """Model for individual question"""
    
    id: str = Field(..., description="Unique question ID")
    type: QuestionType = Field(..., description="Question type")
    question: str = Field(..., description="Question text")
    options: Optional[List[str]] = Field(
        default=None,
        description="Options for MCQ/True-False"
    )
    correctAnswer: str = Field(..., description="Correct answer")
    explanation: Optional[str] = Field(
        default=None,
        description="Explanation for answer"
    )
    marks: int = Field(default=1, description="Marks for question")
    difficulty: DifficultyLevel = Field(
        default=DifficultyLevel.MEDIUM,
        description="Question difficulty"
    )
    cognitiveLevel: CognitiveLevel = Field(
        default=CognitiveLevel.UNDERSTAND,
        description="Cognitive level"
    )
    chapter: Optional[str] = Field(default=None, description="Chapter reference")
    pageReference: Optional[str] = Field(
        default=None,
        description="NCERT page reference"
    )
    ncertSource: Optional[str] = Field(
        default=None,
        description="NCERT source text snippet"
    )

class TestGenerationResponse(BaseModel):
    """Response model for test generation"""
    
    success: bool = Field(..., description="Request success status")
    testId: str = Field(..., description="Unique test ID")
    testContent: str = Field(
        default="",
        description="Generated test content (formatted text)"
    )
    questions: Optional[List[QuestionModel]] = Field(
        default=None,
        description="Structured questions data"
    )
    pdfUrl: Optional[str] = Field(
        default=None,
        description="URL to download PDF (if generated)"
    )
    docxUrl: Optional[str] = Field(
        default=None,
        description="URL to download DOCX (if generated)"
    )
    csvUrl: Optional[str] = Field(
        default=None,
        description="URL to download CSV (if generated)"
    )
    jsonUrl: Optional[str] = Field(
        default=None,
        description="URL to download JSON (if generated)"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Test metadata and statistics"
    )
    ragContext: Optional[str] = Field(
        default=None,
        description="Retrieved NCERT context"
    )
    sources: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Source documents used"
    )
    processingTimeMs: int = Field(
        ..., 
        description="Total processing time in milliseconds"
    )
    requestId: str = Field(..., description="Request ID for tracking")
    warnings: List[str] = Field(
        default_factory=list,
        description="Warnings during generation"
    )
    expiresAt: Optional[str] = Field(
        default=None,
        description="Expiry timestamp for generated files"
    )

# ============== BUSINESS LOGIC ==============

class TestGenerationService:
    """Service layer for test generation logic"""
    
    def __init__(self, rag_system: RAGSystem):
        self.rag = rag_system
        self.test_storage = {}  # In production, use Redis/Database
        
    async def generate_ncert_context(
        self, 
        request: TestGenerationRequest
    ) -> tuple[str, List[Dict]]:
        """Generate NCERT context using RAG"""
        
        if not request.useRAG or not request.useNCERT:
            return "", []
        
        # Build comprehensive query
        query_parts = []
        
        # Basic context
        query_parts.append(f"NCERT {request.subject} Class {request.classNum}")
        
        # Topic/Chapter focus
        if request.topic:
            query_parts.append(f"Topic: {request.topic}")
        elif request.chapters:
            query_parts.append(f"Chapters: {', '.join(request.chapters[:3])}")
        
        # Question requirements
        if request.buckets:
            bucket_desc = []
            for bucket in request.buckets:
                bucket_desc.append(
                    f"{bucket.count} {bucket.type.value} questions "
                    f"({bucket.difficulty.value} difficulty)"
                )
            query_parts.append(f"Question types: {', '.join(bucket_desc)}")
        else:
            query_parts.append(
                f"{request.qCount} questions ({request.difficulty.value} difficulty)"
            )
        
        # Build final query
        base_query = f"Generate test questions for: {' | '.join(query_parts)}"
        
        detailed_query = f"""
        {base_query}
        
        Requirements:
        1. Cover key concepts, definitions, and applications
        2. Include examples and exercises from NCERT
        3. Vary cognitive levels (remember, understand, apply, analyze)
        4. Ensure questions are exam-appropriate
        5. Include numerical problems if applicable
        6. Reference specific pages/examples from NCERT
        
        Provide comprehensive content suitable for generating a complete test paper.
        """
        
        # Get RAG context
        logger.info(f"Fetching NCERT context for test generation")
        rag_result = await self.rag.query(detailed_query)
        
        context = rag_result.get("answer", "")
        sources = rag_result.get("sources", [])
        
        logger.info(f"Retrieved {len(sources)} NCERT sources with {rag_result.get('chunks_retrieved', 0)} chunks")
        
        return context, sources
    
    async def generate_questions(
        self, 
        request: TestGenerationRequest, 
        ncert_context: str
    ) -> List[QuestionModel]:
        """Generate structured questions using LLM"""
        
        # TODO: Integrate with actual LLM service
        # This is a placeholder implementation
        
        questions = []
        
        # Determine question distribution
        if request.buckets:
            buckets = request.buckets
        else:
            # Create default bucket
            buckets = [TestBucket(
                type=QuestionType.MCQ,
                difficulty=request.difficulty,
                count=request.qCount or 10,
                marks=1
            )]
        
        # Generate questions for each bucket
        question_counter = 1
        for bucket_idx, bucket in enumerate(buckets):
            for q_idx in range(bucket.count):
                question_id = f"Q{question_counter}"
                
                # Generate question based on type
                if bucket.type == QuestionType.MCQ:
                    question_text = f"Sample MCQ question {question_counter} about {request.subject}"
                    options = ["Option A", "Option B", "Option C", "Option D"]
                    correct_answer = "Option A"
                elif bucket.type == QuestionType.SHORT:
                    question_text = f"Sample short answer question {question_counter} about {request.subject}"
                    options = None
                    correct_answer = "Sample short answer"
                else:
                    question_text = f"Sample {bucket.type.value} question {question_counter}"
                    options = None
                    correct_answer = "Sample answer"
                
                questions.append(QuestionModel(
                    id=question_id,
                    type=bucket.type,
                    question=question_text,
                    options=options,
                    correctAnswer=correct_answer,
                    explanation="This is a sample explanation.",
                    marks=bucket.marks,
                    difficulty=bucket.difficulty,
                    cognitiveLevel=bucket.cognitive or CognitiveLevel.UNDERSTAND,
                    chapter=request.chapters[0] if request.chapters else None,
                    pageReference="Page 45",
                    ncertSource="Based on NCERT Chapter 3, Example 2"
                ))
                
                question_counter += 1
        
        return questions
    
    def format_test_content(
        self, 
        questions: List[QuestionModel], 
        request: TestGenerationRequest
    ) -> str:
        """Format questions into test paper text"""
        
        # Header
        test_content = f"""
        {'='*60}
        TEST PAPER
        {'='*60}
        
        Subject: {request.subject}
        Class: {request.classNum}
        Board: {request.board}
        {'Topic: ' + request.topic if request.topic else ''}
        {'Chapters: ' + ', '.join(request.chapters) if request.chapters else ''}
        
        Time: {request.timeLimit} minutes (if specified)
        Maximum Marks: {sum(q.marks for q in questions)}
        
        General Instructions:
        1. All questions are compulsory.
        2. Read each question carefully.
        3. Marks are indicated against each question.
        4. Write answers neatly and legibly.
        """
        
        if request.includeInstructions:
            test_content += """
            
            Section-wise Instructions:
            - Section A: Multiple Choice Questions (1 mark each)
            - Section B: Short Answer Questions (2 marks each)
            - Section C: Long Answer Questions (5 marks each)
            """
        
        # Questions
        test_content += "\n\n" + "="*60 + "\nQUESTIONS\n" + "="*60 + "\n"
        
        for i, question in enumerate(questions, 1):
            test_content += f"\nQ{i}. [{question.type.upper()}] ({question.marks} mark{'s' if question.marks > 1 else ''})\n"
            test_content += f"    {question.question}\n"
            
            if question.options:
                for opt_idx, option in enumerate(question.options):
                    test_content += f"    ({chr(65+opt_idx)}) {option}\n"
            
            if request.includeAnswerKey:
                test_content += f"    [Ans: {question.correctAnswer}]\n"
                if question.explanation:
                    test_content += f"    [Explanation: {question.explanation}]\n"
            
            test_content += f"    [Difficulty: {question.difficulty.value.title()} | "
            test_content += f"Cognitive: {question.cognitiveLevel.value.title()}]\n"
            
            if question.chapter:
                test_content += f"    [Chapter: {question.chapter} | Page: {question.pageReference}]\n"
        
        # Footer
        test_content += f"""
        
        {'='*60}
        END OF TEST
        {'='*60}
        
        Generated by: NCERT Test Generator
        Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """
        
        return test_content

# ============== API ENDPOINTS ==============

@router.post(
    "/generate-test",
    response_model=TestGenerationResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate NCERT-Aligned Test",
    description="""
    Generate a complete test paper aligned with NCERT curriculum.
    
    Features:
    - Retrieves relevant NCERT content using RAG
    - Generates questions based on specified parameters
    - Supports multiple question types and difficulty levels
    - Provides output in multiple formats (PDF, DOCX, CSV, JSON)
    - Includes answer key and explanations
    
    **Authentication:** Required (via API key or JWT)
    **Rate Limit:** 5 requests/hour per user
    **Processing Time:** 10-30 seconds depending on complexity
    """
)
async def generate_test(
    request: TestGenerationRequest,
    background_tasks: BackgroundTasks,
    rag: RAGSystem = Depends(get_rag_system)
) -> JSONResponse:
    """Generate test using RAG + NCERT context"""
    
    # Start timing
    start_time = time.time()
    request_id = request.requestId or f"test_{uuid.uuid4().hex[:8]}"
    
    try:
        logger.info(f"Test generation request - ID: {request_id}, User: {request.userId}")
        
        # Initialize service
        service = TestGenerationService(rag)
        
        # Step 1: Get NCERT context
        ncert_context, sources = await service.generate_ncert_context(request)
        
        # Step 2: Generate questions
        questions = await service.generate_questions(request, ncert_context)
        
        # Step 3: Format test content
        test_content = service.format_test_content(questions, request)
        
        # Step 4: Generate output files (async in background)
        file_urls = await _generate_output_files(
            request_id, test_content, questions, request, background_tasks
        )
        
        # Step 5: Prepare metadata
        metadata = {
            "subject": request.subject,
            "class": request.classNum,
            "board": request.board,
            "difficulty": request.difficulty.value,
            "totalQuestions": len(questions),
            "totalMarks": sum(q.marks for q in questions),
            "questionTypes": list(set(q.type.value for q in questions)),
            "ragUsed": request.useRAG,
            "ncertBased": request.useNCERT,
            "ragSourcesCount": len(sources),
            "language": request.language.value,
            "generatedAt": datetime.utcnow().isoformat(),
            "timeLimit": request.timeLimit,
            "shuffled": request.shuffleQuestions
        }
        
        # Step 6: Prepare warnings
        warnings = []
        if len(sources) < 3 and request.useRAG:
            warnings.append("Limited NCERT sources found - consider broadening topic")
        if request.ncertWeight < 0.5:
            warnings.append("Low NCERT weight - test may not be fully NCERT-aligned")
        
        # Step 7: Calculate processing time
        processing_time = int((time.time() - start_time) * 1000)
        
        # Step 8: Prepare response
        response = TestGenerationResponse(
            success=True,
            testId=request_id,
            testContent=test_content,
            questions=questions if request.outputFormat == OutputFormat.JSON else None,
            pdfUrl=file_urls.get("pdf"),
            docxUrl=file_urls.get("docx"),
            csvUrl=file_urls.get("csv"),
            jsonUrl=file_urls.get("json"),
            metadata=metadata,
            ragContext=ncert_context if request.useRAG else None,
            sources=sources if request.useRAG else None,
            processingTimeMs=processing_time,
            requestId=request_id,
            warnings=warnings,
            expiresAt=(datetime.utcnow() + timedelta(hours=24)).isoformat()
        )
        
        logger.info(f"Test generation completed - ID: {request_id}, Time: {processing_time}ms")
        
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error - ID: {request_id}, Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": str(e),
                "request_id": request_id
            }
        )
        
    except Exception as e:
        logger.error(f"Test generation failed - ID: {request_id}, Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "GENERATION_FAILED",
                "message": "Failed to generate test paper",
                "request_id": request_id,
                "hint": "Please check parameters and try again"
            }
        )

async def _generate_output_files(
    test_id: str,
    test_content: str,
    questions: List[QuestionModel],
    request: TestGenerationRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, str]:
    """Generate output files in requested formats"""
    
    file_urls = {}
    
    # In production, this would:
    # 1. Generate files using appropriate libraries (reportlab for PDF, python-docx for DOCX)
    # 2. Upload to cloud storage (S3, Supabase Storage)
    # 3. Return signed URLs
    
    # Placeholder implementation
    if request.outputFormat == OutputFormat.PDF:
        file_urls["pdf"] = f"/api/tests/{test_id}/download?format=pdf"
        background_tasks.add_task(_generate_pdf, test_id, test_content, request)
    
    elif request.outputFormat == OutputFormat.DOCX:
        file_urls["docx"] = f"/api/tests/{test_id}/download?format=docx"
        background_tasks.add_task(_generate_docx, test_id, test_content, request)
    
    elif request.outputFormat == OutputFormat.CSV:
        file_urls["csv"] = f"/api/tests/{test_id}/download?format=csv"
        background_tasks.add_task(_generate_csv, test_id, questions)
    
    elif request.outputFormat == OutputFormat.JSON:
        file_urls["json"] = f"/api/tests/{test_id}/download?format=json"
        background_tasks.add_task(_generate_json, test_id, questions, request)
    
    return file_urls

# Placeholder file generation functions
async def _generate_pdf(test_id: str, content: str, request: TestGenerationRequest):
    """Generate PDF file"""
    await asyncio.sleep(0.1)  # Simulate processing
    logger.info(f"PDF generated for test {test_id}")

async def _generate_docx(test_id: str, content: str, request: TestGenerationRequest):
    """Generate DOCX file"""
    await asyncio.sleep(0.1)
    logger.info(f"DOCX generated for test {test_id}")

async def _generate_csv(test_id: str, questions: List[QuestionModel]):
    """Generate CSV file"""
    await asyncio.sleep(0.1)
    logger.info(f"CSV generated for test {test_id}")

async def _generate_json(test_id: str, questions: List[QuestionModel], request: TestGenerationRequest):
    """Generate JSON file"""
    await asyncio.sleep(0.1)
    logger.info(f"JSON generated for test {test_id}")

# ============== ADDITIONAL ENDPOINTS ==============

@router.get(
    "/tests/{test_id}",
    summary="Get Generated Test",
    description="Retrieve previously generated test by ID"
)
async def get_test(test_id: str):
    """Get generated test by ID"""
    # In production, fetch from database
    return {"message": f"Test {test_id} details would be fetched from database"}

@router.get(
    "/tests/{test_id}/download",
    summary="Download Test File",
    description="Download test in specified format"
)
async def download_test(
    test_id: str, 
    format: OutputFormat = OutputFormat.PDF
):
    """Download test file"""
    # In production, serve from storage
    return {"message": f"Download test {test_id} in {format} format"}

@router.post(
    "/tests/{test_id}/regenerate",
    summary="Regenerate Test",
    description="Regenerate test with same parameters"
)
async def regenerate_test(test_id: str):
    """Regenerate test with same parameters"""
    return {"message": f"Test {test_id} regeneration endpoint"}

# ============== HEALTH CHECK ==============

@router.get(
    "/test-gen/health",
    summary="Test Generation Health Check"
)
async def test_gen_health_check():
    """Health check for test generation service"""
    return {
        "status": "healthy",
        "service": "test_generation",
        "timestamp": datetime.utcnow().isoformat(),
        "capabilities": {
            "rag_integration": True,
            "multiple_formats": True,
            "ncert_alignment": True
        }
    }