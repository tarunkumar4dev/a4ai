"""
NCERT PDF Ingestion Script - FIXED VERSION
Optimized with better chapter extraction and error handling
"""

import asyncio
import asyncpg
import fitz  # PyMuPDF
import os
import re
import sys
import logging
import json
from pathlib import Path
from typing import List, Dict, Optional
import google.generativeai as genai
from datetime import datetime, timezone

# ========== FIX FOR WINDOWS UNICODE ==========
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ingest.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")
        logger.info("Loaded environment variables from .env")
    else:
        logger.warning(f".env file not found at {env_path}")

load_env()

class PDFProcessor:
    """Process PDF files and create meaningful chunks."""
    
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Common NCERT patterns for better extraction
        self.chapter_patterns = [
            (r'CHAPTER\s+\d+\s*[:\.]\s*([^\n]+)', "CHAPTER"),
            (r'Chapter\s+\d+\s*[:\.]\s*([^\n]+)', "Chapter"),
            (r'\b\d+\.\s*([A-Z][^\n]+)', "Numbered"),
            (r'^([A-Z][A-Za-z\s]{10,})\s*$', "Title"),
            (r'(\b[A-Z][A-Za-z\s]{10,}?\b)(?=\s+Chapter)', "BeforeChapter"),
        ]
        
    def clean_text(self, text: str) -> str:
        """Clean extracted text from PDF."""
        if not text:
            return ""
            
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page numbers (e.g., "1", "2", etc.)
        text = re.sub(r'\n\s*\d+\s*\n', '\n', text)
        
        # Remove common PDF artifacts
        text = re.sub(r'\x0c', '', text)  # Form feed
        text = re.sub(r'\uf0b7', '•', text)  # Bullet points
        
        # Remove headers/footers
        text = re.sub(r'NCERT\s+.*?\s+CLASS\s+X', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Science\s*-\s*Class\s*X', '', text, flags=re.IGNORECASE)
        
        return text.strip()
    
    def extract_chapter_title(self, text: str, filename: str) -> str:
        """Improved chapter title extraction."""
        # Get first 2000 characters for better pattern matching
        first_part = text[:2000]
        
        # Try each pattern
        for pattern, pattern_type in self.chapter_patterns:
            matches = re.findall(pattern, first_part, re.MULTILINE | re.IGNORECASE)
            if matches:
                # Get the most likely chapter title (longest match)
                matches = [m for m in matches if len(m.strip()) > 5]
                if matches:
                    title = max(matches, key=len).strip()
                    title = re.sub(r'\s+', ' ', title)
                    logger.debug(f"Extracted '{title}' using {pattern_type} pattern")
                    
                    # Clean up common issues
                    title = re.sub(r'^[\.\:\-]\s*', '', title)  # Remove leading punctuation
                    if len(title) > 3 and len(title) < 150:
                        return title
        
        # Fallback: Extract from filename
        filename_clean = re.sub(r'\.pdf$', '', filename, flags=re.IGNORECASE)
        
        # Try to extract chapter number and name
        filename_patterns = [
            r'Chapter\s*(\d+)[_\-\s]*([^\.]+)',
            r'Ch\s*(\d+)[_\-\s]*([^\.]+)',
            r'(\d+)[_\-\s]*([^\.]+)',
        ]
        
        for pattern in filename_patterns:
            match = re.search(pattern, filename_clean, re.IGNORECASE)
            if match:
                try:
                    chapter_num = match.group(1)
                    chapter_name = match.group(2) if match.lastindex > 1 else ""
                    
                    # Clean chapter name
                    if chapter_name:
                        chapter_name = re.sub(r'[_\-\s]+', ' ', chapter_name).strip()
                        chapter_name = re.sub(r'^\d+\s*', '', chapter_name)  # Remove leading numbers
                        return f"Chapter {chapter_num}: {chapter_name}"
                    else:
                        return f"Chapter {chapter_num}"
                except:
                    continue
        
        # Last resort: Use filename without extension
        base_name = Path(filename).stem
        base_name = re.sub(r'[_\-\s]+', ' ', base_name)
        return base_name[:100]
    
    def chunk_text(self, text: str, chapter: str) -> List[Dict]:
        """Split text into meaningful chunks with paragraph awareness."""
        if not text or len(text) < 100:
            return []
        
        # First split by paragraphs (better for NCERT content)
        paragraphs = re.split(r'\n\s*\n', text)
        chunks = []
        current_chunk = []
        current_length = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            para_length = len(para)
            
            # If paragraph is very long, split it
            if para_length > 300:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sentence in sentences:
                    sent_len = len(sentence)
                    if current_length + sent_len > self.chunk_size and current_chunk:
                        chunk_text = ' '.join(current_chunk)
                        if len(chunk_text) > 150:
                            chunks.append({'content': chunk_text, 'chapter': chapter})
                        
                        # Keep overlap
                        overlap_start = max(0, len(current_chunk) - 2)
                        current_chunk = current_chunk[overlap_start:]
                        current_length = sum(len(s) + 1 for s in current_chunk)
                    
                    current_chunk.append(sentence)
                    current_length += sent_len + 1
            else:
                # If adding this paragraph would exceed chunk size
                if current_length + para_length > self.chunk_size and current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    if len(chunk_text) > 150:
                        chunks.append({'content': chunk_text, 'chapter': chapter})
                    
                    # Keep overlap
                    overlap_start = max(0, len(current_chunk) - 2)
                    current_chunk = current_chunk[overlap_start:]
                    current_length = sum(len(s) + 1 for s in current_chunk)
                
                current_chunk.append(para)
                current_length += para_length + 1
        
        # Add remaining text
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            if len(chunk_text) > 150:
                chunks.append({'content': chunk_text, 'chapter': chapter})
        
        return chunks
    
    def process_pdf(self, pdf_path: Path, class_grade: str, subject: str) -> List[Dict]:
        """Process a single PDF file."""
        logger.info(f"Processing: {pdf_path.name}")
        
        try:
            doc = fitz.open(pdf_path)
            full_text = ""
            
            # Extract text with better quality
            for page_num, page in enumerate(doc):
                # Try to extract text in a structured way
                text = page.get_text("text")
                if not text or len(text.strip()) < 10:
                    # Fallback to block text
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
            logger.info(f"  Chapter identified: {chapter}")
            
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
            
            logger.info(f"  Created {len(chunks_with_metadata)} chunks")
            return chunks_with_metadata
            
        except Exception as e:
            logger.error(f"Error processing {pdf_path.name}: {str(e)}")
            return []

class DatabaseManager:
    """Handle database operations."""
    
    def __init__(self):
        self.conn = None
        self.batch_size = 50  # Insert in batches for better performance
        
    async def connect(self):
        """Connect to database."""
        try:
            password = os.getenv("DATABASE_PASSWORD", "").strip()
            if not password:
                logger.error("DATABASE_PASSWORD is empty or not set")
                return False
            
            self.conn = await asyncpg.connect(
                host='db.dcmnzvjftmdbywrjkust.supabase.co',
                port=5432,
                user='postgres',
                password=password,
                database='postgres',
                ssl='require',
                timeout=30
            )
            logger.info("Connected to database")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
    
    async def create_tables_if_not_exist(self):
        """Create necessary tables if they don't exist."""
        try:
            # Check if table exists
            table_exists = await self.conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'ncert_chunks'
                );
            """)
            
            if not table_exists:
                await self.conn.execute("""
                    CREATE TABLE ncert_chunks (
                        id SERIAL PRIMARY KEY,
                        class_grade TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        chapter TEXT NOT NULL,
                        content TEXT NOT NULL,
                        embedding vector(768),
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
                logger.info("Created 'ncert_chunks' table")
            
            # Create vector index if not exists
            try:
                await self.conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_ncert_embedding 
                    ON ncert_chunks USING ivfflat (embedding vector_cosine_ops);
                """)
                logger.info("Created embedding index")
            except:
                logger.info("Embedding index already exists or not supported")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup tables: {str(e)}")
            return False
    
    async def insert_chunk_batch(self, chunks: List[Dict], embeddings: List[List[float]]) -> int:
        """Insert multiple chunks in batch for better performance."""
        if not chunks or not embeddings:
            return 0
            
        try:
            values = []
            for chunk, embedding in zip(chunks, embeddings):
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                values.append((
                    chunk['class_grade'],
                    chunk['subject'],
                    chunk['chapter'],
                    chunk['content'],
                    embedding_str,
                    datetime.now(timezone.utc)
                ))
            
            # Insert in batch
            await self.conn.executemany("""
                INSERT INTO ncert_chunks 
                (class_grade, subject, chapter, content, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5::vector, $6)
            """, values)
            
            return len(chunks)
            
        except Exception as e:
            logger.error(f"Batch insert failed: {str(e)}")
            return 0
    
    async def count_chunks(self) -> int:
        """Count total chunks in database."""
        try:
            count = await self.conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
            return count
        except:
            return 0
    
    async def clear_old_data(self, class_grade: str = None, subject: str = None):
        """Clear old data before re-ingesting."""
        try:
            if class_grade and subject:
                await self.conn.execute("""
                    DELETE FROM ncert_chunks 
                    WHERE class_grade = $1 AND subject = $2
                """, class_grade, subject)
                logger.info(f"Cleared old data for {class_grade} {subject}")
            else:
                await self.conn.execute("DELETE FROM ncert_chunks")
                logger.info("Cleared all old data")
        except Exception as e:
            logger.error(f"Failed to clear data: {str(e)}")
    
    async def close(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
            logger.info("Database connection closed")

async def add_test_data():
    """Add high-quality test data directly."""
    logger.info("Adding high-quality test data...")
    
    db = DatabaseManager()
    if not await db.connect():
        return
    
    try:
        # Clear old test data first
        await db.clear_old_data("10", "Science")
        
        # High-quality NCERT Class 10 Science data
        test_chapters = [
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Chemical Reactions and Equations',
                'content': """A chemical reaction is a process where reactants transform into products. Chemical equations represent reactions using symbols and formulas. Equations must be balanced to follow the law of conservation of mass. Types of reactions: combination, decomposition, displacement, double displacement, oxidation-reduction. Examples: 2Mg + O2 → 2MgO (Magnesium burning), Zn + H2SO4 → ZnSO4 + H2 (Zinc with sulfuric acid)."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Acids, Bases and Salts',
                'content': """Acids are substances that release H+ ions in solution, taste sour, and turn blue litmus red. Bases release OH- ions, taste bitter, and turn red litmus blue. pH scale measures acidity from 0-14. Neutralization reaction: acid + base → salt + water. Examples: HCl + NaOH → NaCl + H2O. Common acids: Hydrochloric acid (HCl), Sulfuric acid (H2SO4). Common bases: Sodium hydroxide (NaOH), Calcium hydroxide [Ca(OH)2]."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Metals and Non-metals',
                'content': """Metals are lustrous, malleable, ductile, good conductors of heat and electricity. Non-metals are generally brittle, poor conductors. Reactivity series determines displacement reactions. Metals react with acids to produce hydrogen gas. Extraction methods depend on reactivity. Properties: Metals have 1-3 valence electrons, non-metals have 4-8. Examples of metals: Iron, Copper, Aluminum. Examples of non-metals: Carbon, Sulfur, Oxygen."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Carbon and its Compounds',
                'content': """Carbon forms covalent bonds due to tetravalency. Versatile nature leads to millions of organic compounds. Hydrocarbons contain only carbon and hydrogen. Functional groups determine properties. Homologous series shows gradation in properties. Important compounds: Methane (CH4), Ethanol (C2H5OH), Acetic acid (CH3COOH). Allotropes of carbon: Diamond, Graphite, Fullerene."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Life Processes',
                'content': """Living organisms perform nutrition, respiration, transportation, excretion. Photosynthesis converts light energy to chemical energy: 6CO2 + 6H2O → C6H12O6 + 6O2. Human digestive system breaks down food for absorption. Circulatory system transports substances. Respiration: C6H12O6 + 6O2 → 6CO2 + 6H2O + energy. Excretory system removes waste."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Control and Coordination',
                'content': """Nervous system and endocrine system help in control and coordination. Neurons transmit electrical signals. Brain has cerebrum, cerebellum, medulla. Reflex actions are quick responses. Hormones are chemical messengers: Insulin, Adrenaline, Thyroxine. Plant hormones: Auxin, Gibberellin, Cytokinin."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'How do Organisms Reproduce',
                'content': """Reproduction ensures continuity of species. Asexual reproduction involves single parent: Binary fission, Budding, Fragmentation. Sexual reproduction involves two parents: Pollination, Fertilization. Human reproductive system: Male (testes), Female (ovaries). Menstrual cycle duration: 28 days. Contraceptive methods prevent pregnancy."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Heredity and Evolution',
                'content': """Heredity is transmission of traits from parents to offspring. Mendel's laws: Law of segregation, Law of independent assortment. DNA carries genetic information. Evolution is change in inherited characteristics over generations. Natural selection: Survival of the fittest. Evidence: Fossils, Homologous organs, Embryological similarities."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Light - Reflection and Refraction',
                'content': """Light travels in straight lines. Reflection: Angle of incidence = Angle of reflection. Laws of reflection. Mirror formula: 1/f = 1/v + 1/u. Refraction: Bending of light when passing from one medium to another. Snell's law: n1 sinθ1 = n2 sinθ2. Lens formula same as mirror formula. Power of lens: P = 1/f (in meters)."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'The Human Eye and Colourful World',
                'content': """Human eye has cornea, iris, pupil, lens, retina. Accommodation: Ability to focus at different distances. Defects: Myopia (nearsightedness), Hypermetropia (farsightedness). Dispersion: Splitting of white light into colors. Atmospheric refraction causes twinkling of stars. Scattering of light makes sky blue. Rainbow formation requires rain and sunlight."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Electricity',
                'content': """Electric current: Flow of electric charge. Ohm's law: V = IR. Resistance depends on material, length, area. Series: R = R1 + R2. Parallel: 1/R = 1/R1 + 1/R2. Electric power: P = VI. Heating effect: H = I²Rt. Fuse protects from overcurrent. Earthing for safety."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Magnetic Effects of Electric Current',
                'content': """Moving charge creates magnetic field. Right-hand thumb rule for direction. Electromagnet: Temporary magnet. Electric motor converts electrical to mechanical energy. Electromagnetic induction: Changing magnetic field induces current. Generator converts mechanical to electrical energy. Domestic circuits: Live, Neutral, Earth wires."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Sources of Energy',
                'content': """Conventional sources: Fossil fuels (coal, petroleum), Thermal power. Non-conventional: Solar, Wind, Hydro, Geothermal, Biomass. Renewable energy: Can be replenished. Non-renewable: Limited stock. Solar cell converts sunlight to electricity. Wind energy via windmills. Hydroelectric from flowing water. Nuclear energy from fission."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Our Environment',
                'content': """Environment includes biotic and abiotic components. Ecosystem: Community + Environment. Food chain: Producer → Consumer → Decomposer. Trophic levels. Biomagnification: Increase in concentration at higher levels. Ozone layer depletion by CFCs. Waste management: Reduce, Reuse, Recycle. Biodegradable vs Non-biodegradable."""
            },
            {
                'class_grade': '10',
                'subject': 'Science',
                'chapter': 'Management of Natural Resources',
                'content': """Natural resources: Forest, Water, Coal, Petroleum. Conservation needed for sustainability. Three R's: Reduce, Reuse, Recycle. Water harvesting: Collecting rainwater. Dams: Advantages (electricity, irrigation) and Disadvantages (displacement, ecological). Wildlife conservation. Sustainable development: Meet present needs without compromising future."""
            }
        ]
        
        # Create dummy embeddings (768 dimensions)
        dummy_embedding = [0.1] * 768
        
        # Insert in batches
        all_chunks = []
        all_embeddings = []
        
        for chunk in test_chapters:
            all_chunks.append(chunk)
            all_embeddings.append(dummy_embedding)
        
        # Insert all at once
        added = await db.insert_chunk_batch(all_chunks, all_embeddings)
        
        logger.info(f"✅ Successfully added {added} high-quality chapters to database")
        
        # Verify
        count = await db.count_chunks()
        logger.info(f"📊 Total chunks in database: {count}")
        
    except Exception as e:
        logger.error(f"Error adding test data: {str(e)}")
    finally:
        await db.close()

async def ingest_pdfs():
    """Main function to ingest PDFs."""
    logger.info("="*60)
    logger.info("STARTING NCERT PDF INGESTION - OPTIMIZED")
    logger.info("="*60)
    
    # Check for required environment variables
    required_env_vars = ['DATABASE_PASSWORD']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing environment variables: {', '.join(missing_vars)}")
        logger.info("Please check your .env file")
        return
    
    # Initialize database
    db = DatabaseManager()
    if not await db.connect():
        logger.error("Failed to connect to database. Adding test data instead...")
        await add_test_data()
        return
    
    # Create tables if needed
    await db.create_tables_if_not_exist()
    
    # Check existing data
    initial_count = await db.count_chunks()
    logger.info(f"Initial chunks in database: {initial_count}")
    
    # Configure Gemini
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    use_gemini = bool(gemini_api_key)
    
    if use_gemini:
        try:
            genai.configure(api_key=gemini_api_key)
            logger.info("Gemini API configured")
        except Exception as e:
            logger.error(f"Gemini configuration failed: {str(e)}")
            use_gemini = False
    else:
        logger.warning("GEMINI_API_KEY not found. Using dummy embeddings.")
    
    # Find PDF directory
    pdf_dir = Path(__file__).parent / "Class10_Science"
    
    if not pdf_dir.exists():
        logger.error(f"PDF directory not found: {pdf_dir}")
        logger.info("Adding high-quality test data instead...")
        await db.close()
        await add_test_data()
        return
    
    logger.info(f"PDF directory: {pdf_dir}")
    
    # Get PDF files
    pdf_files = list(pdf_dir.glob("Chapter*.pdf"))
    if not pdf_files:
        logger.error("No Chapter*.pdf files found")
        await db.close()
        await add_test_data()
        return
    
    logger.info(f"Found {len(pdf_files)} PDF files to process")
    
    # Ask user what to do
    print("\n" + "="*60)
    print("OPTIONS:")
    print("1. Process ALL PDF files (may take time)")
    print("2. Process first 3 PDFs for testing")
    print("3. Clear database and add high-quality test data (recommended)")
    print("4. Exit")
    print("="*60)
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "4":
        print("Exiting...")
        await db.close()
        return
    
    # Initialize PDF processor
    processor = PDFProcessor(chunk_size=600, chunk_overlap=50)
    
    if choice == "3":
        await db.close()
        await add_test_data()
        return
    
    # Process PDFs based on choice
    if choice == "1":
        files_to_process = pdf_files
        logger.info("Processing ALL PDF files...")
    elif choice == "2":
        files_to_process = pdf_files[:3]
        logger.info(f"Processing first {len(files_to_process)} PDFs for testing...")
    else:
        files_to_process = pdf_files[:3]  # Default
        logger.info(f"Processing first {len(files_to_process)} PDFs...")
    
    total_added = 0
    total_failed = 0
    processed_files = 0
    
    try:
        for pdf_file in sorted(files_to_process):
            logger.info(f"\n{'='*40}")
            logger.info(f"Processing file {processed_files + 1}/{len(files_to_process)}: {pdf_file.name}")
            
            # Process PDF
            chunks = processor.process_pdf(
                pdf_file, 
                class_grade="10",
                subject="Science"
            )
            
            if not chunks:
                logger.warning(f"No chunks created from {pdf_file.name}")
                continue
            
            # Process in batches
            batch_chunks = []
            batch_embeddings = []
            
            for chunk in chunks:
                try:
                    if use_gemini:
                        # Generate embedding using Gemini
                        embedding_result = genai.embed_content(
                            model="models/embedding-001",
                            content=chunk['content'],
                            task_type="retrieval_document"
                        )
                        embedding = embedding_result["embedding"]
                    else:
                        # Use dummy embedding
                        embedding = [0.1] * 768
                    
                    batch_chunks.append(chunk)
                    batch_embeddings.append(embedding)
                    
                    # Insert when batch is full
                    if len(batch_chunks) >= db.batch_size:
                        added = await db.insert_chunk_batch(batch_chunks, batch_embeddings)
                        total_added += added
                        
                        # Clear batch
                        batch_chunks = []
                        batch_embeddings = []
                        
                except Exception as e:
                    logger.error(f"Error processing chunk: {str(e)[:100]}")
                    total_failed += 1
            
            # Insert remaining chunks
            if batch_chunks:
                added = await db.insert_chunk_batch(batch_chunks, batch_embeddings)
                total_added += added
            
            logger.info(f"  Added {len(chunks)} chunks from {pdf_file.name}")
            processed_files += 1
            
    except KeyboardInterrupt:
        logger.warning("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await db.close()
    
    # Final count
    final_count = initial_count + total_added
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("INGESTION SUMMARY")
    logger.info("="*60)
    logger.info(f"Processed files: {processed_files}")
    logger.info(f"Total chunks added: {total_added}")
    logger.info(f"Total chunks failed: {total_failed}")
    logger.info(f"Total chunks in database: {final_count}")
    
    if total_added > 0:
        logger.info("✅ INGESTION COMPLETED SUCCESSFULLY")
    elif initial_count > 0:
        logger.info("✅ Database already has data")
    else:
        logger.warning("⚠️  No data was added. Adding high-quality test data...")
        await add_test_data()

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
    print("NCERT PDF INGESTION SYSTEM - OPTIMIZED")
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