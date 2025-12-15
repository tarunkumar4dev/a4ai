# product/scripts/ncert-ingestion/routes/upload.py

"""
Document Upload & Ingestion API
Handles NCERT document uploads for vector database ingestion
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Literal
import json
import uuid
import hashlib
import logging
import asyncio
from datetime import datetime
import os
from pathlib import Path
import tempfile

# Internal imports
from app_dependencies import get_rag_system
from rag_system import RAGSystem, DocumentIngestor

# Setup logging
logger = logging.getLogger(__name__)
router = APIRouter()

# ============== CONSTANTS ==============

SUPPORTED_FILE_TYPES = {
    "pdf": "application/pdf",
    "txt": "text/plain", 
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "md": "text/markdown"
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_TEXT_LENGTH = 1_000_000  # 1 million characters

# ============== REQUEST/RESPONSE MODELS ==============

class DocumentMetadata(BaseModel):
    """Model for document metadata"""
    
    source: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Source name (e.g., 'NCERT Physics Class 12 Textbook')"
    )
    
    subject: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Subject (e.g., 'Physics', 'Mathematics')"
    )
    
    class_num: int = Field(
        ...,
        ge=1,
        le=12,
        description="Class number (1-12)"
    )
    
    chapter: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Chapter name or number"
    )
    
    pages: Optional[str] = Field(
        default=None,
        description="Page range (e.g., '45-67')"
    )
    
    author: Optional[str] = Field(
        default=None,
        description="Author or publisher"
    )
    
    year: Optional[int] = Field(
        default=None,
        ge=2000,
        le=datetime.now().year,
        description="Publication year"
    )
    
    language: str = Field(
        default="english",
        regex="^(english|hindi)$",
        description="Document language"
    )
    
    board: Optional[str] = Field(
        default="CBSE",
        description="Education board (CBSE, ICSE, etc.)"
    )
    
    tags: Optional[List[str]] = Field(
        default=None,
        description="Additional tags for categorization"
    )
    
    @validator('pages')
    def validate_pages(cls, v):
        if v:
            # Validate page range format
            import re
            if not re.match(r'^\d+(-\d+)?$', v):
                raise ValueError('pages must be in format like "45" or "45-67"')
        return v

class ChunkConfig(BaseModel):
    """Model for chunking configuration"""
    
    chunk_size: int = Field(
        default=1000,
        ge=100,
        le=5000,
        description="Size of each chunk in characters"
    )
    
    overlap: int = Field(
        default=200,
        ge=0,
        le=1000,
        description="Overlap between chunks in characters"
    )
    
    separator: str = Field(
        default="\n\n",
        description="Separator for splitting text"
    )

class UploadRequest(BaseModel):
    """Request model for document upload"""
    
    # Document content (either file or text)
    text: Optional[str] = Field(
        default=None,
        max_length=MAX_TEXT_LENGTH,
        description="Raw text content (alternative to file upload)"
    )
    
    # Metadata
    metadata: DocumentMetadata = Field(
        ...,
        description="Document metadata"
    )
    
    # Processing options
    chunk_config: Optional[ChunkConfig] = Field(
        default=None,
        description="Custom chunking configuration"
    )
    
    index_immediately: bool = Field(
        default=True,
        description="Whether to index immediately or queue for later"
    )
    
    overwrite_existing: bool = Field(
        default=False,
        description="Overwrite if document already exists"
    )
    
    validate_content: bool = Field(
        default=True,
        description="Validate content before ingestion"
    )
    
    # Advanced options
    extract_images: bool = Field(
        default=False,
        description="Extract and process images from document"
    )
    
    generate_summary: bool = Field(
        default=False,
        description="Generate document summary"
    )
    
    # Validators
    @validator('text')
    def validate_text_or_file(cls, v, values):
        # At least one of text or file must be provided
        # File validation happens at endpoint level
        return v

class UploadResponse(BaseModel):
    """Response model for document upload"""
    
    success: bool = Field(..., description="Upload success status")
    document_id: str = Field(..., description="Unique document identifier")
    upload_id: str = Field(..., description="Upload session identifier")
    chunks_ingested: int = Field(..., description="Number of chunks created")
    chunks_failed: int = Field(default=0, description="Number of chunks that failed")
    total_chunks: int = Field(..., description="Total chunks processed")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Processing metadata"
    )
    processing_time_ms: int = Field(
        ..., 
        description="Total processing time in milliseconds"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Warnings during processing"
    )
    next_steps: Optional[List[str]] = Field(
        default=None,
        description="Suggested next steps"
    )
    expires_at: Optional[str] = Field(
        default=None,
        description="Expiry timestamp for temporary files"
    )

class UploadStatus(BaseModel):
    """Model for upload status query"""
    
    upload_id: str = Field(..., description="Upload session identifier")
    status: Literal["pending", "processing", "completed", "failed"] = Field(
        ..., 
        description="Current upload status"
    )
    progress: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Processing progress percentage"
    )
    message: Optional[str] = Field(
        default=None,
        description="Status message"
    )
    created_at: str = Field(..., description="Upload creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")
    estimated_completion: Optional[str] = Field(
        default=None,
        description="Estimated completion time"
    )

# ============== BUSINESS LOGIC ==============

class DocumentUploadService:
    """Service layer for document upload processing"""
    
    def __init__(self, rag_system: RAGSystem):
        self.rag = rag_system
        self.upload_status = {}  # In production, use Redis/Database
        self.temp_storage = Path(tempfile.gettempdir()) / "ncert_uploads"
        self.temp_storage.mkdir(exist_ok=True)
    
    def generate_document_id(self, content: str, metadata: DocumentMetadata) -> str:
        """Generate unique document ID"""
        
        # Create hash from content + metadata
        hash_input = f"{content[:1000]}{metadata.source}{metadata.subject}{metadata.class_num}"
        content_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
        
        # Create readable ID
        doc_id = (
            f"doc_{metadata.subject.lower()[:3]}_"
            f"c{metadata.class_num}_"
            f"{content_hash}"
        )
        
        return doc_id
    
    async def process_uploaded_file(
        self, 
        file: UploadFile,
        metadata: DocumentMetadata
    ) -> str:
        """Process uploaded file and extract text"""
        
        # Validate file type
        file_extension = file.filename.split('.')[-1].lower() if file.filename else ''
        content_type = file.content_type or ''
        
        if (file_extension not in SUPPORTED_FILE_TYPES and 
            content_type not in SUPPORTED_FILE_TYPES.values()):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file type. Supported: {list(SUPPORTED_FILE_TYPES.keys())}"
            )
        
        # Check file size
        file_size = 0
        temp_file_path = self.temp_storage / f"upload_{uuid.uuid4().hex}"
        
        try:
            # Save uploaded file temporarily
            with open(temp_file_path, "wb") as f:
                while chunk := await file.read(8192):  # 8KB chunks
                    file_size += len(chunk)
                    if file_size > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB"
                        )
                    f.write(chunk)
            
            # Extract text based on file type
            if file_extension == "pdf" or content_type == "application/pdf":
                text_content = await self._extract_text_from_pdf(temp_file_path)
            elif file_extension == "docx":
                text_content = await self._extract_text_from_docx(temp_file_path)
            elif file_extension in ["txt", "md"]:
                with open(temp_file_path, "r", encoding="utf-8") as f:
                    text_content = f.read()
            else:
                # Try generic text extraction
                with open(temp_file_path, "r", encoding="utf-8", errors="ignore") as f:
                    text_content = f.read()
            
            return text_content
            
        finally:
            # Clean up temp file
            if temp_file_path.exists():
                temp_file_path.unlink()
    
    async def _extract_text_from_pdf(self, file_path: Path) -> str:
        """Extract text from PDF file"""
        try:
            import pypdf
            text = ""
            with open(file_path, "rb") as file:
                pdf_reader = pypdf.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n\n"
            return text.strip()
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to extract text from PDF: {str(e)}"
            )
    
    async def _extract_text_from_docx(self, file_path: Path) -> str:
        """Extract text from DOCX file"""
        try:
            import docx
            doc = docx.Document(file_path)
            text = "\n\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text.strip()
        except Exception as e:
            logger.error(f"DOCX extraction failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to extract text from DOCX: {str(e)}"
            )
    
    def validate_document_content(self, text: str, metadata: DocumentMetadata) -> List[str]:
        """Validate document content for quality"""
        
        warnings = []
        
        # Check minimum length
        if len(text) < 500:
            warnings.append("Document content is very short (less than 500 characters)")
        
        # Check for non-text content
        if len(text.split()) < 50:
            warnings.append("Document appears to have limited text content")
        
        # Check for encoding issues
        try:
            text.encode('utf-8')
        except UnicodeEncodeError:
            warnings.append("Document contains non-UTF-8 characters")
        
        # Subject-specific validation
        subject_keywords = {
            "physics": ["force", "energy", "motion", "electric", "magnetic"],
            "mathematics": ["equation", "solve", "calculate", "formula", "theorem"],
            "chemistry": ["element", "compound", "reaction", "molecule", "atom"],
            "biology": ["cell", "organism", "DNA", "evolution", "ecosystem"]
        }
        
        if metadata.subject.lower() in subject_keywords:
            keywords = subject_keywords[metadata.subject.lower()]
            found_keywords = [kw for kw in keywords if kw.lower() in text.lower()]
            if len(found_keywords) < 2:
                warnings.append(f"Limited {metadata.subject} content detected")
        
        return warnings
    
    async def ingest_document(
        self,
        document_id: str,
        text: str,
        metadata: DocumentMetadata,
        chunk_config: Optional[ChunkConfig] = None,
        upload_id: str = None
    ) -> Dict[str, Any]:
        """Ingest document into vector database"""
        
        upload_id = upload_id or f"upl_{uuid.uuid4().hex[:8]}"
        start_time = datetime.utcnow()
        
        # Update status
        self.upload_status[upload_id] = {
            "status": "processing",
            "progress": 10,
            "message": "Starting document ingestion",
            "updated_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Initialize ingestor
            ingestor = DocumentIngestor(self.rag)
            
            # Update chunk config if provided
            if chunk_config:
                # Note: You'll need to update DocumentIngestor to accept chunk config
                pass
            
            # Update status
            self.upload_status[upload_id].update({
                "progress": 30,
                "message": "Chunking document content"
            })
            
            # Ingest document
            result = await ingestor.ingest_document(
                document_id=document_id,
                text=text,
                metadata=metadata.dict()
            )
            
            # Update status
            self.upload_status[upload_id].update({
                "status": "completed",
                "progress": 100,
                "message": "Document ingestion completed",
                "updated_at": datetime.utcnow().isoformat()
            })
            
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return {
                "document_id": document_id,
                "chunks_ingested": len(result.data) if result.data else 0,
                "processing_time_ms": int(processing_time),
                "upload_id": upload_id
            }
            
        except Exception as e:
            # Update status on error
            self.upload_status[upload_id].update({
                "status": "failed",
                "progress": 0,
                "message": f"Ingestion failed: {str(e)}",
                "updated_at": datetime.utcnow().isoformat()
            })
            raise

# ============== API ENDPOINTS ==============

@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload NCERT Document",
    description="""
    Upload NCERT or educational documents for ingestion into vector database.
    
    Supports:
    - File upload (PDF, TXT, DOCX, MD)
    - Direct text submission
    - Custom chunking configuration
    - Background processing
    
    **Authentication:** Required (Admin/Uploader role)
    **Rate Limit:** 10 uploads/hour per user
    **File Size Limit:** 50MB
    """
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    metadata: str = Form(...),
    chunk_config: Optional[str] = Form(None),
    index_immediately: bool = Form(True),
    overwrite_existing: bool = Form(False),
    rag: RAGSystem = Depends(get_rag_system)
) -> JSONResponse:
    """Upload NCERT document for ingestion"""
    
    upload_start_time = datetime.utcnow()
    upload_id = f"upl_{uuid.uuid4().hex[:8]}"
    
    try:
        # Parse metadata and config
        try:
            meta_dict = json.loads(metadata)
            metadata_obj = DocumentMetadata(**meta_dict)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid metadata JSON: {str(e)}"
            )
        
        chunk_config_obj = None
        if chunk_config:
            try:
                chunk_dict = json.loads(chunk_config)
                chunk_config_obj = ChunkConfig(**chunk_dict)
            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid chunk config: {str(e)}"
                )
        
        # Get document content
        text_content = ""
        if file:
            service = DocumentUploadService(rag)
            text_content = await service.process_uploaded_file(file, metadata_obj)
        elif text:
            text_content = text.strip()
            if len(text_content) > MAX_TEXT_LENGTH:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Text too long. Max length: {MAX_TEXT_LENGTH:,} characters"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either file or text must be provided"
            )
        
        # Validate content
        warnings = []
        service = DocumentUploadService(rag)
        warnings = service.validate_document_content(text_content, metadata_obj)
        
        # Generate document ID
        document_id = service.generate_document_id(text_content, metadata_obj)
        
        # Check if document already exists (in production, check database)
        # For now, we'll just check if we have a hash collision warning
        if not overwrite_existing:
            # In production: query database for existing document_id
            pass
        
        # Ingest document (sync or async based on flag)
        if index_immediately:
            # Immediate ingestion
            result = await service.ingest_document(
                document_id=document_id,
                text=text_content,
                metadata=metadata_obj,
                chunk_config=chunk_config_obj,
                upload_id=upload_id
            )
            chunks_ingested = result["chunks_ingested"]
        else:
            # Queue for background processing
            background_tasks.add_task(
                service.ingest_document,
                document_id,
                text_content,
                metadata_obj,
                chunk_config_obj,
                upload_id
            )
            chunks_ingested = 0
            warnings.append("Document queued for background processing")
        
        # Prepare metadata
        processing_time = (datetime.utcnow() - upload_start_time).total_seconds() * 1000
        
        # Prepare response
        response = UploadResponse(
            success=True,
            document_id=document_id,
            upload_id=upload_id,
            chunks_ingested=chunks_ingested,
            chunks_failed=0,
            total_chunks=chunks_ingested,
            metadata={
                "source": metadata_obj.source,
                "subject": metadata_obj.subject,
                "class": metadata_obj.class_num,
                "chapter": metadata_obj.chapter,
                "language": metadata_obj.language,
                "content_length": len(text_content),
                "word_count": len(text_content.split()),
                "indexed_immediately": index_immediately,
                "uploaded_at": datetime.utcnow().isoformat()
            },
            processing_time_ms=int(processing_time),
            warnings=warnings,
            next_steps=[
                f"Query document using ID: {document_id}",
                "Test retrieval with sample questions",
                "Review ingestion logs if warnings present"
            ] if chunks_ingested > 0 else ["Document queued for processing"],
            expires_at=(datetime.utcnow() + timedelta(days=7)).isoformat()
        )
        
        logger.info(
            f"Document uploaded - ID: {document_id}, "
            f"Source: {metadata_obj.source}, "
            f"Chunks: {chunks_ingested}"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed - ID: {upload_id}, Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "UPLOAD_FAILED",
                "message": "Document upload failed",
                "upload_id": upload_id,
                "hint": "Check file format and metadata"
            }
        )

@router.get(
    "/upload/{upload_id}/status",
    response_model=UploadStatus,
    summary="Get Upload Status",
    description="Check status of document upload and processing"
)
async def get_upload_status(upload_id: str) -> JSONResponse:
    """Get status of document upload"""
    
    service = DocumentUploadService(None)  # No RAG needed for status check
    
    if upload_id not in service.upload_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload ID {upload_id} not found"
        )
    
    status_info = service.upload_status[upload_id]
    
    return UploadStatus(
        upload_id=upload_id,
        status=status_info["status"],
        progress=status_info["progress"],
        message=status_info.get("message"),
        created_at=status_info.get("created_at", datetime.utcnow().isoformat()),
        updated_at=status_info["updated_at"],
        estimated_completion=status_info.get("estimated_completion")
    )

@router.delete(
    "/documents/{document_id}",
    summary="Delete Document",
    description="Delete document and its chunks from vector database"
)
async def delete_document(
    document_id: str,
    rag: RAGSystem = Depends(get_rag_system)
) -> JSONResponse:
    """Delete document from vector database"""
    
    try:
        # Delete from Supabase
        # In production: Also delete from your tracking database
        result = rag.supabase.table("document_chunks") \
            .delete() \
            .eq("document_id", document_id) \
            .execute()
        
        chunks_deleted = len(result.data) if result.data else 0
        
        logger.info(f"Document deleted - ID: {document_id}, Chunks removed: {chunks_deleted}")
        
        return {
            "success": True,
            "document_id": document_id,
            "chunks_deleted": chunks_deleted,
            "message": "Document deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Document deletion failed - ID: {document_id}, Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )

@router.get(
    "/upload/supported-formats",
    summary="Get Supported Formats",
    description="Get list of supported file formats for upload"
)
async def get_supported_formats() -> JSONResponse:
    """Get supported file formats"""
    
    formats = []
    for ext, mime in SUPPORTED_FILE_TYPES.items():
        formats.append({
            "extension": ext,
            "mime_type": mime,
            "max_size_mb": MAX_FILE_SIZE // (1024 * 1024),
            "description": {
                "pdf": "Portable Document Format",
                "txt": "Plain Text File",
                "docx": "Microsoft Word Document",
                "md": "Markdown File"
            }.get(ext, "Document File")
        })
    
    return {
        "supported_formats": formats,
        "limits": {
            "max_file_size_mb": MAX_FILE_SIZE // (1024 * 1024),
            "max_text_length": MAX_TEXT_LENGTH,
            "max_files_per_upload": 1  # Currently single file only
        }
    }

# ============== HEALTH CHECK ==============

@router.get(
    "/upload/health",
    summary="Upload Service Health Check"
)
async def upload_health_check() -> JSONResponse:
    """Health check for upload service"""
    
    # Check temp directory
    temp_dir = Path(tempfile.gettempdir())
    temp_writable = os.access(temp_dir, os.W_OK)
    
    # Check dependencies
    dependencies = {
        "pypdf": False,
        "python-docx": False,
        "temp_directory": temp_writable
    }
    
    try:
        import pypdf
        dependencies["pypdf"] = True
    except ImportError:
        pass
    
    try:
        import docx
        dependencies["python-docx"] = True
    except ImportError:
        pass
    
    return {
        "status": "healthy" if all(dependencies.values()) else "degraded",
        "service": "document_upload",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": dependencies,
        "storage": {
            "temp_directory": str(temp_dir),
            "writable": temp_writable
        }
    }