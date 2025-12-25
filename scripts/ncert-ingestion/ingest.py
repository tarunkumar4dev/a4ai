"""
NCERT PDF Ingestion Script
Processes Class 10 Science PDFs and stores in database with embeddings.
"""

import asyncio
import asyncpg
import fitz  # PyMuPDF
import os
import re
import sys
import logging
from pathlib import Path
from typing import List, Dict, Optional
import google.generativeai as genai
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ingest.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")
    else:
        logger.warning(f".env file not found at {env_path}")

load_env()

class PDFProcessor:
    """Process PDF files and create meaningful chunks."""
    
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100):
        """
        Initialize PDF processor.
        
        Args:
            chunk_size: Number of characters per chunk
            chunk_overlap: Overlap between chunks in characters
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def clean_text(self, text: str) -> str:
        """Clean extracted text from PDF."""
        if not text:
            return ""
            
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page numbers (e.g., "1", "2", etc. on their own line)
        text = re.sub(r'\n\d+\s*\n', '\n', text)
        
        # Remove common PDF artifacts
        text = re.sub(r'\x0c', '', text)  # Form feed
        text = re.sub(r'\uf0b7', '•', text)  # Bullet points
        
        # Remove headers/footers
        text = re.sub(r'NCERT\s+.*?\s+CLASS\s+X', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Science\s*-\s*Class\s*X', '', text, flags=re.IGNORECASE)
        
        return text.strip()
    
    def extract_chapter_title(self, text: str, filename: str) -> str:
        """Extract chapter title from text or filename."""
        # Try to extract from text first
        patterns = [
            r'CHAPTER\s+\d+[:\-]\s*(.+?)(?:\n|$)',
            r'Chapter\s+\d+[:\-]\s*(.+?)(?:\n|$)',
            r'\d+\.\s+(.+?)(?:\n|$)',
            r'(\b[A-Z][A-Za-z\s]+\b)(?=\s+CHAPTER|\s+Chapter)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text[:1000], re.IGNORECASE)
            if match:
                title = match.group(1).strip()
                title = re.sub(r'\s+', ' ', title)
                if len(title) > 3:  # Valid title
                    logger.debug(f"Extracted title from text: {title}")
                    return title[:150]
        
        # Fallback: Extract from filename
        filename_patterns = [
            r'Chapter(\d+)[_\-\s]*(.+)\.pdf',
            r'Ch(\d+)[_\-\s]*(.+)\.pdf'
        ]
        
        for pattern in filename_patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                chapter_num = match.group(1)
                title = match.group(2).replace('_', ' ').replace('-', ' ').strip()
                if title:
                    return f"Chapter {chapter_num}: {title}"
                else:
                    return f"Chapter {chapter_num}"
        
        return "Science Chapter"
    
    def chunk_text(self, text: str, chapter: str) -> List[Dict]:
        """Split text into meaningful chunks with sentence awareness."""
        if not text or len(text) < 100:
            return []
        
        chunks = []
        
        # Split by sentences first for better boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            sentence_length = len(sentence)
            
            # If adding this sentence would exceed chunk size and we have content
            if current_length + sentence_length > self.chunk_size and current_chunk:
                # Save current chunk
                chunk_text = ' '.join(current_chunk)
                if len(chunk_text) > 200:  # Minimum chunk size
                    chunks.append({
                        'content': chunk_text,
                        'chapter': chapter
                    })
                
                # Start new chunk with overlap
                overlap_start = max(0, len(current_chunk) - 3)  # Keep last 3 sentences
                current_chunk = current_chunk[overlap_start:]
                current_length = sum(len(s) + 1 for s in current_chunk)
            
            current_chunk.append(sentence)
            current_length += sentence_length + 1
        
        # Add the last chunk if it's large enough
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            if len(chunk_text) > 200:
                chunks.append({
                    'content': chunk_text,
                    'chapter': chapter
                })
        
        return chunks
    
    def process_pdf(self, pdf_path: Path, class_grade: str, subject: str) -> List[Dict]:
        """Process a single PDF file."""
        logger.info(f"Processing: {pdf_path.name}")
        
        try:
            doc = fitz.open(pdf_path)
            full_text = ""
            
            for page_num, page in enumerate(doc):
                text = page.get_text()
                cleaned_text = self.clean_text(text)
                if cleaned_text:
                    full_text += cleaned_text + "\n\n"
            
            doc.close()
            
            if not full_text.strip():
                logger.warning(f"No text extracted from {pdf_path.name}")
                return []
            
            # Extract chapter title
            chapter = self.extract_chapter_title(full_text, pdf_path.name)
            
            # Create chunks
            raw_chunks = self.chunk_text(full_text, chapter)
            
            # Add metadata
            chunks_with_metadata = []
            for chunk in raw_chunks:
                chunks_with_metadata.append({
                    'class_grade': class_grade,
                    'subject': subject,
                    'chapter': chapter,
                    'content': chunk['content']
                })
            
            logger.info(f"  Created {len(chunks_with_metadata)} chunks for '{chapter}'")
            return chunks_with_metadata
            
        except Exception as e:
            logger.error(f"Error processing {pdf_path.name}: {str(e)}")
            return []

class DatabaseManager:
    """Handle database operations."""
    
    def __init__(self):
        self.conn = None
        
    async def connect(self):
        """Connect to database."""
        try:
            self.conn = await asyncpg.connect(
                host='db.dcmnzvjftmdbywrjkust.supabase.co',
                port=5432,
                user='postgres',
                password=os.getenv("DATABASE_PASSWORD"),
                database='postgres',
                ssl='require',
                timeout=30
            )
            logger.info("Connected to database")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
    
    async def insert_chunk(self, chunk: Dict, embedding: List[float]) -> bool:
        """Insert a single chunk into database."""
        try:
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
            
            await self.conn.execute("""
                INSERT INTO ncert_chunks 
                (class_grade, subject, chapter, content, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5::vector, $6)
            """, 
            chunk['class_grade'], 
            chunk['subject'], 
            chunk['chapter'], 
            chunk['content'], 
            embedding_str,
            datetime.utcnow())
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to insert chunk: {str(e)[:100]}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
            logger.info("Database connection closed")

async def ingest_pdfs():
    """Main function to ingest PDFs."""
    logger.info("="*60)
    logger.info("STARTING NCERT PDF INGESTION")
    logger.info("="*60)
    
    # Check for required environment variables
    required_env_vars = ['DATABASE_PASSWORD', 'GEMINI_API_KEY']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing environment variables: {', '.join(missing_vars)}")
        return
    
    # Configure Gemini
    try:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        logger.info("Gemini API configured")
    except Exception as e:
        logger.error(f"Gemini configuration failed: {str(e)}")
        return
    
    # Find PDF directory
    current_dir = Path(__file__).parent
    # Try different possible locations
    possible_paths = [
        current_dir.parent.parent / "Class10_Science",  # product/Class10_Science
        current_dir.parent / "Class10_Science",         # scripts/Class10_Science
        Path(".") / "Class10_Science",                  # Current directory
    ]
    
    pdf_dir = None
    for path in possible_paths:
        if path.exists() and path.is_dir():
            pdf_dir = path
            break
    
    if not pdf_dir:
        logger.error(f"PDF directory not found. Tried: {possible_paths}")
        return
    
    logger.info(f"PDF directory: {pdf_dir}")
    
    # Get PDF files
    pdf_files = list(pdf_dir.glob("Chapter*.pdf"))
    if not pdf_files:
        logger.warning(f"No Chapter*.pdf files found in {pdf_dir}")
        pdf_files = list(pdf_dir.glob("*.pdf"))
    
    if not pdf_files:
        logger.error("No PDF files found to process")
        return
    
    logger.info(f"Found {len(pdf_files)} PDF files to process")
    
    # Initialize components
    db = DatabaseManager()
    processor = PDFProcessor(chunk_size=600, chunk_overlap=50)
    
    # Connect to database
    if not await db.connect():
        return
    
    total_added = 0
    total_failed = 0
    processed_files = 0
    
    try:
        for pdf_file in sorted(pdf_files):
            logger.info(f"\n{'='*40}")
            logger.info(f"Processing file {processed_files + 1}/{len(pdf_files)}: {pdf_file.name}")
            
            # Process PDF
            chunks = processor.process_pdf(
                pdf_file, 
                class_grade="Class 10",
                subject="Science"
            )
            
            if not chunks:
                logger.warning(f"No chunks created from {pdf_file.name}")
                continue
            
            # Process each chunk
            chunk_count = 0
            for chunk in chunks:
                try:
                    # Generate embedding
                    embedding_result = genai.embed_content(
                        model="models/embedding-001",
                        content=chunk['content'],
                        task_type="retrieval_document"
                    )
                    
                    embedding = embedding_result["embedding"]
                    
                    # Insert into database
                    success = await db.insert_chunk(chunk, embedding)
                    
                    if success:
                        total_added += 1
                        chunk_count += 1
                    else:
                        total_failed += 1
                        
                except Exception as e:
                    logger.error(f"Error processing chunk: {str(e)[:100]}")
                    total_failed += 1
            
            logger.info(f"  Added {chunk_count} chunks from {pdf_file.name}")
            processed_files += 1
            
    except KeyboardInterrupt:
        logger.warning("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await db.close()
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("INGESTION SUMMARY")
    logger.info("="*60)
    logger.info(f"Processed files: {processed_files}/{len(pdf_files)}")
    logger.info(f"Total chunks added: {total_added}")
    logger.info(f"Total chunks failed: {total_failed}")
    
    if total_added > 0:
        logger.info("✅ INGESTION COMPLETED SUCCESSFULLY")
    else:
        logger.warning("⚠️  No chunks were added to database")

def check_dependencies():
    """Check and install required dependencies."""
    try:
        import asyncpg
        import fitz
        import google.generativeai
        logger.info("All dependencies are installed")
        return True
    except ImportError as e:
        logger.warning(f"Missing dependency: {e.name}")
        logger.info("Installing required packages...")
        
        packages = {
            'asyncpg': 'asyncpg',
            'fitz': 'pymupdf',
            'google.generativeai': 'google-generativeai'
        }
        
        missing = e.name
        if missing in packages:
            import subprocess
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", packages[missing]])
                logger.info(f"Successfully installed {packages[missing]}")
                return True
            except subprocess.CalledProcessError:
                logger.error(f"Failed to install {packages[missing]}")
                return False
        return False

if __name__ == "__main__":
    print("\n" + "="*60)
    print("NCERT PDF INGESTION SYSTEM")
    print("="*60 + "\n")
    
    # Check dependencies
    if not check_dependencies():
        print("❌ Please install missing dependencies manually:")
        print("   pip install asyncpg pymupdf google-generativeai")
        sys.exit(1)
    
    # Run ingestion
    try:
        asyncio.run(ingest_pdfs())
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        print(f"\n❌ Fatal error occurred. Check ingest.log for details.")
    
    print("\n" + "="*60)
    print("Process completed")
    print("="*60)