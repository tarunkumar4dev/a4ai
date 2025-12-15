# ingest.py - FAST PAID TIER VERSION
import os
import time
import google.generativeai as genai
from supabase import create_client, Client
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from dotenv import load_dotenv
import re
import sys
from typing import List, Optional, Tuple
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()

# --- CONFIGURATION ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# PAID TIER SETTINGS (Much faster!)
GEMINI_EMBEDDING_BATCH_SIZE = 50  # Process 50 chunks at once!
GEMINI_BATCH_DELAY = 1.0  # Only 1 second between batches
CHAPTER_DELAY = 5.0  # 5 seconds between chapters

def validate_env() -> bool:
    """Validate all required environment variables"""
    missing = []
    
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    
    if missing:
        logger.error("❌ Missing environment variables:")
        for var in missing:
            logger.error(f"   - {var}")
        logger.info("\n💡 Create a .env file with:")
        logger.info("   SUPABASE_URL=your-project-url")
        logger.info("   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key")
        logger.info("   GEMINI_API_KEY=your-gemini-api-key")
        return False
    
    logger.info("✅ Environment variables validated")
    return True

if not validate_env():
    sys.exit(1)

# --- CHAPTER NAMES ---
CHAPTER_NAMES = {
    1: "Chemical Reactions and Equations",
    2: "Acids, Bases and Salts", 
    3: "Metals and Non-metals",
    4: "Carbon and its Compounds",
    5: "Life Processes",
    6: "Control and Coordination",
    7: "How do Organisms Reproduce",
    8: "Heredity and Evolution",
    9: "Light - Reflection and Refraction",
    10: "Human Eye and Colourful World",
    11: "Electricity",
    12: "Magnetic Effects of Electric Current",
    13: "Our Environment"
}

# --- INITIALIZATION ---
logger.info("🔧 Initializing NCERT Class 10 Science Ingestion (13 Chapters)")
logger.info("💰 BILLING ACTIVE: Using PAID TIER settings")

try:
    genai.configure(api_key=GEMINI_API_KEY)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    logger.info("✅ Gemini & Supabase clients initialized")
except Exception as e:
    logger.error(f"❌ Failed to initialize clients: {e}")
    sys.exit(1)

# Optimal Chunking for Paid Tier
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
    keep_separator=True
)

def get_batch_embeddings_fast(texts: List[str]) -> Optional[List[List[float]]]:
    """
    Fast embedding generation for PAID tier.
    Process up to 50 texts in one API call.
    """
    if not texts:
        return []
    
    valid_texts = [text for text in texts if text and len(text.strip()) >= 30]
    if not valid_texts:
        return []
    
    try:
        result = genai.embed_content(
            model="models/embedding-001",
            content=valid_texts,
            task_type="retrieval_document"
        )
        
        if 'embedding' in result:
            return result['embedding']
            
    except Exception as e:
        error_str = str(e)
        logger.error(f"❌ Embedding failed: {str(e)[:100]}")
        
        # Still handle rate limits, but they should be rare now
        if "429" in error_str or "rate limit" in error_str.lower():
            logger.warning("⚠️ Unexpected rate limit, waiting 10s...")
            time.sleep(10)
            # Try one more time
            try:
                result = genai.embed_content(
                    model="models/embedding-001",
                    content=valid_texts,
                    task_type="retrieval_document"
                )
                if 'embedding' in result:
                    return result['embedding']
            except:
                pass
    
    return None

def clean_text(text: str) -> str:
    """Clean extracted text while preserving meaningful structure"""
    if not text:
        return ""
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    cleaned = ' '.join(lines)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = re.sub(r'\.\s+', '. ', cleaned)
    cleaned = re.sub(r'\?\s+', '? ', cleaned)
    cleaned = re.sub(r'!\s+', '! ', cleaned)
    
    return cleaned.strip()

def safe_pdf_extraction(page) -> str:
    """Safely extract text from PDF page with error handling"""
    try:
        return page.extract_text() or ""
    except Exception:
        try:
            return page.extract_text(extraction_mode="layout") or ""
        except:
            return ""

def process_chunks_batch(chunks_data: List[dict], batch_size: int = 100) -> int:
    """Process and upload chunks in batches for efficiency"""
    successful = 0
    total_batches = (len(chunks_data) + batch_size - 1) // batch_size
    
    for batch_idx in range(0, len(chunks_data), batch_size):
        batch = chunks_data[batch_idx:batch_idx + batch_size]
        batch_num = (batch_idx // batch_size) + 1
        
        try:
            response = supabase.table("ncert_chunks").insert(batch).execute()
            if response.data:
                successful += len(response.data)
                logger.info(f"  ✅ Batch {batch_num}/{total_batches}: Uploaded {len(response.data)} chunks")
            else:
                logger.warning(f"  ⚠️ Batch {batch_num}: No data returned")
                
            # Tiny delay between upload batches
            if batch_num < total_batches:
                time.sleep(0.1)
                
        except Exception as e:
            error_str = str(e).lower()
            if "rate limit" in error_str or "429" in error_str:
                logger.warning(f"  ⏳ Supabase rate limit hit, waiting 10 seconds...")
                time.sleep(10)
                try:
                    response = supabase.table("ncert_chunks").insert(batch).execute()
                    if response.data:
                        successful += len(response.data)
                        logger.info(f"  ✅ Batch {batch_num} (retry): Uploaded {len(response.data)} chunks")
                except Exception as retry_error:
                    logger.error(f"  ❌ Batch {batch_num} failed on retry: {str(retry_error)[:100]}")
            else:
                logger.error(f"  ❌ Batch {batch_num} failed: {str(e)[:100]}")
    
    return successful

def generate_embeddings_fast(chunks: List[str], chapter_name: str) -> Tuple[List[dict], int]:
    """
    Generate embeddings FAST for paid tier.
    """
    chunks_data = []
    embedding_failures = 0
    
    # Process chunks in large batches
    total_batches = (len(chunks) + GEMINI_EMBEDDING_BATCH_SIZE - 1) // GEMINI_EMBEDDING_BATCH_SIZE
    
    logger.info(f"  ⚡ Generating embeddings in {total_batches} batches of {GEMINI_EMBEDDING_BATCH_SIZE} chunks...")
    logger.info(f"  📊 Total chunks to process: {len(chunks)}")
    
    for batch_idx in range(0, len(chunks), GEMINI_EMBEDDING_BATCH_SIZE):
        batch_num = (batch_idx // GEMINI_EMBEDDING_BATCH_SIZE) + 1
        batch_end = min(batch_idx + GEMINI_EMBEDDING_BATCH_SIZE, len(chunks))
        
        # Get current batch
        batch_texts = chunks[batch_idx:batch_end]
        
        # Filter valid texts
        valid_texts = []
        for text in batch_texts:
            if text and len(text.strip()) >= 30:
                valid_texts.append(text)
        
        if not valid_texts:
            continue
        
        logger.info(f"  📦 Batch {batch_num}/{total_batches}: Processing {len(valid_texts)} chunks...")
        
        try:
            embeddings = get_batch_embeddings_fast(valid_texts)
            
            if embeddings and len(embeddings) == len(valid_texts):
                # Add successful chunks to data
                for idx, (chunk_text, embedding) in enumerate(zip(valid_texts, embeddings)):
                    chunks_data.append({
                        "class_grade": "10",
                        "subject": "Science",
                        "chapter": chapter_name,
                        "content": chunk_text,
                        "embedding": embedding
                    })
                
                logger.info(f"  ✅ Batch {batch_num}: Embedded {len(valid_texts)} chunks")
                
            else:
                embedding_failures += len(valid_texts)
                logger.warning(f"  ⚠️ Batch {batch_num}: Failed to embed")
                
        except Exception as e:
            embedding_failures += len(valid_texts)
            logger.error(f"  ❌ Batch {batch_num} failed: {str(e)[:100]}")
        
        # Very short delay between batches (paid tier!)
        if batch_num < total_batches:
            time.sleep(GEMINI_BATCH_DELAY)
    
    return chunks_data, embedding_failures

def ingest_chapter_pdf(pdf_path: str, chapter_num: int) -> int:
    """Ingest a single chapter PDF with FAST processing"""
    chapter_name = CHAPTER_NAMES.get(chapter_num)
    if not chapter_name:
        logger.error(f"❌ Invalid chapter number: {chapter_num}")
        return 0
    
    logger.info(f"\n📚 CHAPTER {chapter_num}: {chapter_name}")
    logger.info("   " + "="*50)
    
    try:
        # Check if PDF exists
        if not os.path.exists(pdf_path):
            logger.error(f"  ❌ PDF not found: {pdf_path}")
            return 0
        
        # Read PDF
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        logger.info(f"  📄 Pages: {total_pages}")
        
        # Extract text from all pages
        all_text = []
        for page_num, page in enumerate(reader.pages, 1):
            page_text = safe_pdf_extraction(page)
            cleaned_text = clean_text(page_text)
            
            if cleaned_text:
                # Add chapter context to each page
                page_with_context = f"[Chapter: {chapter_name}]\n{cleaned_text}"
                all_text.append(page_with_context)
            
            if page_num % 5 == 0 or page_num == total_pages:
                logger.info(f"  📖 Processed page {page_num}/{total_pages}")
        
        if not all_text:
            logger.warning(f"  ⚠️ No text extracted from PDF")
            return 0
        
        # Process text
        full_text = '\n\n'.join(all_text)
        logger.info(f"  📊 Extracted {len(full_text):,} characters")
        
        # Split into chunks
        chunks = splitter.split_text(full_text)
        logger.info(f"  ✂️ Split into {len(chunks)} chunks")
        
        # Generate embeddings FAST
        chunks_data, embedding_failures = generate_embeddings_fast(chunks, chapter_name)
        
        if embedding_failures > 0:
            logger.warning(f"  ⚠️ Failed to generate embeddings for {embedding_failures} chunks")
        
        if not chunks_data:
            logger.error(f"  ❌ No valid chunks to upload")
            return 0
        
        logger.info(f"  ✅ Generated embeddings for {len(chunks_data)} chunks")
        
        # Upload to Supabase
        logger.info(f"  🚀 Uploading {len(chunks_data)} chunks to Supabase...")
        successful_uploads = process_chunks_batch(chunks_data, batch_size=100)
        
        logger.info(f"  ✅ Upload complete: {successful_uploads}/{len(chunks_data)} successful")
        return successful_uploads
        
    except Exception as e:
        logger.error(f"❌ Error processing Chapter {chapter_num}: {e}")
        import traceback
        traceback.print_exc()
        return 0

def find_pdf_files(pdf_folder: str) -> dict:
    """Find PDF files (Chapter1.pdf to Chapter13.pdf)"""
    pdf_files = {}
    
    if not os.path.exists(pdf_folder):
        logger.error(f"❌ PDF folder not found: {pdf_folder}")
        return pdf_files
    
    # Look for Chapter1.pdf to Chapter13.pdf
    for i in range(1, 14):
        expected_name = f"Chapter{i}.pdf"
        expected_path = os.path.join(pdf_folder, expected_name)
        
        if os.path.exists(expected_path):
            pdf_files[i] = expected_path
            logger.info(f"  📄 Found: {expected_name}")
        else:
            logger.warning(f"  ⚠️ Missing: {expected_name}")
    
    return pdf_files

def clean_database():
    """Clean existing data from database"""
    logger.info("🧹 Cleaning existing data from database...")
    try:
        # First check if table exists and has data
        response = supabase.table("ncert_chunks").select("*").execute()
        if response.data and len(response.data) > 0:
            logger.info(f"  Found {len(response.data)} existing rows")
            
            # Get all IDs to delete
            ids_to_delete = [row['id'] for row in response.data]
            
            # Delete in batches of 100
            for i in range(0, len(ids_to_delete), 100):
                batch = ids_to_delete[i:i+100]
                supabase.table("ncert_chunks").delete().in_("id", batch).execute()
                time.sleep(0.1)
            
            logger.info("  ✅ Database cleaned successfully")
            return True
        else:
            logger.info("  ℹ️ Database is already empty")
            return True
    except Exception as e:
        logger.error(f"  ❌ Failed to clean database: {e}")
        return False

def main():
    """Main ingestion function - FAST VERSION for paid tier"""
    logger.info("\n" + "="*60)
    logger.info("📚 NCERT CLASS 10 SCIENCE - FAST INGESTION (PAID TIER)")
    logger.info("💰 Billing: ACTIVE | Credits: ₹26,782 available")
    logger.info("="*60)
    
    # Find PDF folder
    pdf_folder = "Class10_Science"
    
    if not os.path.exists(pdf_folder):
        logger.error(f"❌ PDF folder not found: {pdf_folder}")
        logger.info(f"   Current directory: {os.getcwd()}")
        logger.info(f"   Looking for: {os.path.abspath(pdf_folder)}")
        return
    
    logger.info(f"📁 PDF Folder: {os.path.abspath(pdf_folder)}")
    
    # Find PDF files
    pdf_files = find_pdf_files(pdf_folder)
    
    if not pdf_files:
        logger.error("❌ No PDF files found in the folder")
        logger.info("Expected files: Chapter1.pdf to Chapter13.pdf")
        return
    
    logger.info(f"\n📄 Found {len(pdf_files)}/13 PDF files")
    
    # Ask for confirmation
    logger.info("\n⚠️  This will delete all existing data and ingest new data.")
    logger.info("   Estimated time: 10-15 minutes (PAID TIER)")
    response = input("   Continue? (yes/no): ").strip().lower()
    
    if response not in ['yes', 'y']:
        logger.info("⏹️ Ingestion cancelled by user")
        return
    
    # Clean database
    if not clean_database():
        logger.error("❌ Cannot proceed without cleaning database")
        return
    
    # Process each chapter
    total_chunks = 0
    processed_chapters = 0
    
    for chapter_num in sorted(pdf_files.keys()):
        if chapter_num > 13:
            continue
            
        pdf_path = pdf_files[chapter_num]
        logger.info(f"\n{'='*60}")
        
        start_time = time.time()
        chunks_added = ingest_chapter_pdf(pdf_path, chapter_num)
        end_time = time.time()
        
        total_chunks += chunks_added
        processed_chapters += 1
        
        chapter_time = end_time - start_time
        logger.info(f"  ⏱️ Chapter processed in {chapter_time:.1f} seconds")
        
        # Short pause between chapters
        if chapter_num < 13:
            logger.info(f"\n   ⏳ Pausing for {CHAPTER_DELAY} seconds before next chapter...")
            time.sleep(CHAPTER_DELAY)
    
    # Final summary
    logger.info("\n" + "="*60)
    logger.info("🎉 INGESTION COMPLETE - SUMMARY")
    logger.info("="*60)
    logger.info(f"Chapters processed: {processed_chapters}/13")
    logger.info(f"Total chunks added: {total_chunks}")
    
    # Cost estimate
    estimated_tokens = total_chunks * 800  # Rough estimate
    estimated_cost = estimated_tokens * 0.0001 / 1000  # $0.0001 per 1K tokens
    logger.info(f"💰 Estimated cost: ${estimated_cost:.4f} (negligible!)")
    
    # Verify database
    logger.info("\n🔍 Verifying database...")
    try:
        result = supabase.table("ncert_chunks").select("*").execute()
        logger.info(f"📊 Database contains {len(result.data)} rows")
        
        # Get chapter distribution
        if result.data:
            chapter_counts = {}
            for item in result.data:
                chapter = item.get('chapter', 'Unknown')
                chapter_counts[chapter] = chapter_counts.get(chapter, 0) + 1
            
            logger.info("\n📚 Chapter distribution:")
            for chapter, count in sorted(chapter_counts.items()):
                logger.info(f"  {chapter}: {count} chunks")
        
    except Exception as e:
        logger.error(f"❌ Verification failed: {e}")
    
    logger.info("\n✅ Check your data: Supabase → Table Editor → ncert_chunks")
    logger.info("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n⏹️ Ingestion stopped by user")
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()