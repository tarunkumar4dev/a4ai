"""
NCERT Content Inserter - Adds curated NCERT content samples to database.
Production-ready with error handling, logging, and batch processing.
"""

import asyncio
import asyncpg
import google.generativeai as genai
import os
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict
import hashlib

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def load_environment():
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
        logger.warning(".env file not found - using system environment variables")

# Load environment
load_environment()

# NCERT Content Samples - Curated, high-quality content
NCERT_CONTENT = [
    {
        "class_grade": "Class 10",
        "subject": "Science",
        "chapter": "Life Processes - Photosynthesis",
        "content": """
        Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy. 
        During photosynthesis, carbon dioxide and water are converted into glucose and oxygen using sunlight energy.
        
        The overall equation: 6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂
        
        Process occurs in chloroplasts containing chlorophyll.
        Two main stages:
        1. Light-dependent reactions: Capture light energy, produce ATP and NADPH
        2. Light-independent reactions (Calvin Cycle): Use ATP and NADPH to produce glucose
        
        Importance:
        - Produces food for all organisms
        - Releases oxygen for respiration
        - Maintains O₂-CO₂ balance
        - Source of energy in ecosystems
        """
    },
    {
        "class_grade": "Class 10",
        "subject": "Science", 
        "chapter": "Chemical Reactions and Equations",
        "content": """
        Chemical reaction: Process where reactants transform into products with different properties.
        
        Types of reactions:
        1. Combination: A + B → AB
        2. Decomposition: AB → A + B
        3. Displacement: A + BC → AC + B
        4. Double displacement: AB + CD → AD + CB
        5. Redox: Oxidation and reduction occur simultaneously
        
        Chemical equations must be balanced according to Law of Conservation of Mass.
        Example: 2H₂ + O₂ → 2H₂O
        
        Indicators of chemical reactions:
        - Change in color
        - Evolution of gas
        - Formation of precipitate
        - Change in temperature
        """
    },
    {
        "class_grade": "Class 10",
        "subject": "Science",
        "chapter": "Light - Reflection and Refraction",
        "content": """
        Light is a form of electromagnetic radiation that enables vision.
        
        Reflection: Bouncing back of light from a surface.
        - Laws of reflection:
          1. Incident ray, reflected ray, and normal lie in same plane
          2. Angle of incidence = Angle of reflection
        
        Refraction: Bending of light when passing from one medium to another.
        - Snell's Law: n₁ sin θ₁ = n₂ sin θ₂
        - Refractive index: n = c/v
        
        Lenses:
        - Convex (converging): Thicker at center
        - Concave (diverging): Thinner at center
        
        Mirror formula: 1/f = 1/v + 1/u
        Lens formula: 1/f = 1/v - 1/u
        """
    },
    {
        "class_grade": "Class 10",
        "subject": "Social Science",
        "chapter": "Power Sharing - Democracy",
        "content": """
        Democracy: System of government where power is vested in the people.
        
        Features of democracy:
        1. Rule by the people (direct or representative)
        2. Free and fair elections
        3. Protection of fundamental rights
        4. Rule of law
        5. Separation of powers
        
        Power sharing in democracy:
        - Horizontal: Among legislature, executive, judiciary
        - Vertical: Between central and state governments
        - Community: Among different social groups
        - Political: Among political parties, pressure groups
        
        Importance of power sharing:
        - Reduces conflict
        - Ensures stability
        - Promotes unity
        - Respects diversity
        """
    },
    {
        "class_grade": "Class 9",
        "subject": "Science",
        "chapter": "Motion",
        "content": """
        Motion: Change in position of an object with time.
        
        Types of motion:
        1. Linear motion (in straight line)
        2. Circular motion (along circular path)
        3. Periodic motion (repeats at regular intervals)
        4. Rotational motion (about an axis)
        
        Newton's Laws of Motion:
        1. First Law (Inertia): Object remains at rest or uniform motion unless acted upon
        2. Second Law: F = ma (Force = mass × acceleration)
        3. Third Law: Every action has equal and opposite reaction
        
        Speed = Distance/Time
        Velocity = Displacement/Time (vector quantity)
        Acceleration = Change in velocity/Time
        
        Equations of motion:
        v = u + at
        s = ut + ½at²
        v² = u² + 2as
        """
    }
]

class DatabaseManager:
    """Handles database operations."""
    
    def __init__(self):
        self.connection = None
        
    async def connect(self) -> bool:
        """Establish database connection."""
        try:
            self.connection = await asyncpg.connect(
                host='db.dcmnzvjftmdbywrjkust.supabase.co',
                port=5432,
                user='postgres',
                password=os.getenv("DATABASE_PASSWORD"),
                database='postgres',
                ssl='require',
                timeout=30
            )
            logger.info("Database connection established")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.connection:
            await self.connection.close()
            logger.info("Database connection closed")

class ContentInserter:
    """Handles content insertion with embeddings."""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        
    def generate_content_hash(self, content: str) -> str:
        """Generate hash for content to check duplicates."""
        return hashlib.md5(content.encode()).hexdigest()
    
    async def insert_content(self, content_item: Dict) -> bool:
        """Insert a single content item with embedding."""
        try:
            # Generate embedding
            embedding_result = genai.embed_content(
                model="models/embedding-001",
                content=content_item["content"],
                task_type="retrieval_document"
            )
            
            embedding = embedding_result["embedding"]
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
            
            # Insert into database
            await self.db.connection.execute("""
                INSERT INTO ncert_chunks 
                (class_grade, subject, chapter, content, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5::vector, $6)
            """, 
            content_item["class_grade"], 
            content_item["subject"], 
            content_item["chapter"], 
            content_item["content"], 
            embedding_str,
            datetime.now()
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to insert {content_item['chapter']}: {str(e)}")
            return False
    
    async def content_exists(self, content_item: Dict) -> bool:
        """Check if content already exists in database."""
        try:
            content_hash = self.generate_content_hash(content_item["content"])
            
            exists = await self.db.connection.fetchval("""
                SELECT EXISTS(
                    SELECT 1 FROM ncert_chunks 
                    WHERE class_grade = $1 
                    AND subject = $2 
                    AND chapter = $3
                    AND md5(content) = $4
                )
            """, 
            content_item["class_grade"], 
            content_item["subject"], 
            content_item["chapter"], 
            content_hash)
            
            return exists
        except Exception as e:
            logger.warning(f"Error checking content existence: {str(e)}")
            return False

async def add_content_to_db():
    """Main function to add NCERT content to database."""
    logger.info("="*60)
    logger.info("ADDING NCERT CONTENT TO DATABASE")
    logger.info("="*60)
    
    # Check environment variables
    if not os.getenv("GEMINI_API_KEY"):
        logger.error("GEMINI_API_KEY environment variable is not set")
        return
    
    if not os.getenv("DATABASE_PASSWORD"):
        logger.error("DATABASE_PASSWORD environment variable is not set")
        return
    
    # Configure Gemini
    try:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        logger.info("Gemini API configured successfully")
    except Exception as e:
        logger.error(f"Failed to configure Gemini API: {str(e)}")
        return
    
    # Initialize database manager
    db = DatabaseManager()
    
    if not await db.connect():
        return
    
    # Initialize content inserter
    inserter = ContentInserter(db)
    
    added = 0
    skipped = 0
    failed = 0
    
    try:
        for i, content_item in enumerate(NCERT_CONTENT, 1):
            logger.info(f"Processing item {i}/{len(NCERT_CONTENT)}: {content_item['chapter']}")
            
            # Check if content already exists
            if await inserter.content_exists(content_item):
                logger.info(f"  Skipping - already exists: {content_item['chapter']}")
                skipped += 1
                continue
            
            # Insert content
            if await inserter.insert_content(content_item):
                logger.info(f"  Added successfully: {content_item['chapter']}")
                added += 1
            else:
                logger.error(f"  Failed to add: {content_item['chapter']}")
                failed += 1
                
    except KeyboardInterrupt:
        logger.warning("Process interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await db.close()
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("INSERTION SUMMARY")
    logger.info("="*60)
    logger.info(f"Total items processed: {len(NCERT_CONTENT)}")
    logger.info(f"Successfully added: {added}")
    logger.info(f"Skipped (already exists): {skipped}")
    logger.info(f"Failed: {failed}")
    
    if failed == 0 and added > 0:
        logger.info("SUCCESS: All new content added successfully")
    elif failed > 0:
        logger.warning("WARNING: Some items failed to add")

def check_dependencies():
    """Check if required packages are installed."""
    try:
        import asyncpg
        import google.generativeai
        return True
    except ImportError as e:
        logger.error(f"Missing dependency: {e.name}")
        logger.info("Please install required packages:")
        logger.info("  pip install asyncpg google-generativeai")
        return False

if __name__ == "__main__":
    print("\n" + "="*60)
    print("NCERT CONTENT INSERTION SYSTEM")
    print("="*60)
    
    if check_dependencies():
        try:
            asyncio.run(add_content_to_db())
        except KeyboardInterrupt:
            print("\nProcess interrupted by user")
        except Exception as e:
            logger.error(f"Fatal error: {str(e)}")
    else:
        print("❌ Missing dependencies. Please install required packages.")
    
    print("\n" + "="*60)
    print("Process completed")
    print("="*60)