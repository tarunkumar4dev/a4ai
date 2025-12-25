"""
Database Chunk Checker - Verifies chunk quality and content in database.
Production-ready with comprehensive checks and reporting.
"""

import asyncio
import asyncpg
import os
import logging
from pathlib import Path
from typing import List, Tuple
import statistics

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
    """Load environment variables."""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_environment()

class ChunkChecker:
    """Checks database chunk quality and content."""
    
    def __init__(self):
        self.connection = None
    
    async def connect(self) -> bool:
        """Establish database connection."""
        try:
            self.connection = await asyncpg.connect(
                host='db.dcmnzvjftmdbywrjkust.supabase.co',
                port=5432,
                user='postgres',
                password=os.getenv('DATABASE_PASSWORD'),
                database='postgres',
                ssl='require',
                timeout=30
            )
            logger.info("Connected to database")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.connection:
            await self.connection.close()
            logger.info("Database connection closed")
    
    async def get_random_chunks(self, limit: int = 5) -> List[dict]:
        """Get random chunks from database."""
        try:
            return await self.connection.fetch("""
                SELECT chapter, content, LENGTH(content) as length 
                FROM ncert_chunks 
                WHERE LENGTH(content) > 200
                ORDER BY RANDOM() 
                LIMIT $1
            """, limit)
        except Exception as e:
            logger.error(f"Error fetching random chunks: {str(e)}")
            return []
    
    async def get_chapter_chunks(self, chapter: str, limit: int = 2) -> List[dict]:
        """Get chunks for specific chapter."""
        try:
            return await self.connection.fetch("""
                SELECT content, LENGTH(content) as length 
                FROM ncert_chunks 
                WHERE chapter = $1 
                AND LENGTH(content) > 200
                ORDER BY RANDOM()
                LIMIT $2
            """, chapter, limit)
        except Exception as e:
            logger.error(f"Error fetching chapter chunks for {chapter}: {str(e)}")
            return []
    
    async def get_chunk_statistics(self) -> dict:
        """Get comprehensive chunk statistics."""
        try:
            stats = await self.connection.fetchrow("""
                SELECT 
                    COUNT(*) as total_chunks,
                    COUNT(DISTINCT chapter) as unique_chapters,
                    AVG(LENGTH(content)) as avg_length,
                    MIN(LENGTH(content)) as min_length,
                    MAX(LENGTH(content)) as max_length,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(content)) as median_length,
                    COUNT(CASE WHEN LENGTH(content) < 200 THEN 1 END) as small_chunks,
                    COUNT(CASE WHEN LENGTH(content) > 1000 THEN 1 END) as large_chunks
                FROM ncert_chunks
            """)
            return dict(stats) if stats else {}
        except Exception as e:
            logger.error(f"Error fetching statistics: {str(e)}")
            return {}
    
    async def get_top_chapters(self, limit: int = 10) -> List[Tuple[str, int]]:
        """Get chapters with most chunks."""
        try:
            rows = await self.connection.fetch("""
                SELECT chapter, COUNT(*) as count 
                FROM ncert_chunks 
                GROUP BY chapter 
                ORDER BY count DESC 
                LIMIT $1
            """, limit)
            return [(row['chapter'], row['count']) for row in rows]
        except Exception as e:
            logger.error(f"Error fetching top chapters: {str(e)}")
            return []

async def check_database():
    """Main function to check database chunks."""
    logger.info("="*60)
    logger.info("DATABASE CHUNK QUALITY CHECK")
    logger.info("="*60)
    
    # Check environment
    if not os.getenv('DATABASE_PASSWORD'):
        logger.error("DATABASE_PASSWORD environment variable is not set")
        return
    
    # Initialize checker
    checker = ChunkChecker()
    
    if not await checker.connect():
        return
    
    try:
        # 1. Get statistics
        logger.info("\n📊 DATABASE STATISTICS:")
        stats = await checker.get_chunk_statistics()
        
        if stats:
            logger.info(f"  Total chunks: {stats.get('total_chunks', 0)}")
            logger.info(f"  Unique chapters: {stats.get('unique_chapters', 0)}")
            logger.info(f"  Avg chunk length: {stats.get('avg_length', 0):.0f} chars")
            logger.info(f"  Min chunk length: {stats.get('min_length', 0)} chars")
            logger.info(f"  Max chunk length: {stats.get('max_length', 0)} chars")
            logger.info(f"  Median length: {stats.get('median_length', 0):.0f} chars")
            logger.info(f"  Small chunks (<200 chars): {stats.get('small_chunks', 0)}")
            logger.info(f"  Large chunks (>1000 chars): {stats.get('large_chunks', 0)}")
        
        # 2. Check random chunks
        logger.info("\n🔍 RANDOM CHUNK SAMPLES:")
        random_chunks = await checker.get_random_chunks(5)
        
        for i, chunk in enumerate(random_chunks, 1):
            logger.info(f"\n  Chunk {i}:")
            logger.info(f"    Chapter: {chunk['chapter']}")
            logger.info(f"    Length: {chunk['length']} characters")
            preview = chunk['content'][:200].replace('\n', ' ')
            logger.info(f"    Preview: {preview}...")
        
        # 3. Check specific chapters
        logger.info("\n📚 SPECIFIC CHAPTER CHECKS:")
        
        # Define chapters to check (add more as needed)
        chapters_to_check = [
            'Chemical Reactions and Equations',
            'Acids, Bases and Salts',
            'Life Processes',
            'Light - Reflection and Refraction',
            'Electricity'
        ]
        
        for chapter in chapters_to_check:
            logger.info(f"\n  {chapter}:")
            chapter_chunks = await checker.get_chapter_chunks(chapter, 2)
            
            if chapter_chunks:
                for j, chunk in enumerate(chapter_chunks, 1):
                    preview = chunk['content'][:100].replace('\n', ' ')
                    logger.info(f"    Chunk {j}: {chunk['length']} chars - {preview}...")
            else:
                logger.info(f"    No chunks found (or all chunks < 200 chars)")
        
        # 4. Top chapters
        logger.info("\n🏆 TOP CHAPTERS BY CHUNK COUNT:")
        top_chapters = await checker.get_top_chapters(10)
        
        for i, (chapter, count) in enumerate(top_chapters, 1):
            logger.info(f"  {i:2}. {chapter[:50]:50} - {count:4} chunks")
        
        # 5. Quality assessment
        logger.info("\n✅ QUALITY ASSESSMENT:")
        
        if stats:
            total = stats.get('total_chunks', 0)
            small = stats.get('small_chunks', 0)
            
            if total == 0:
                logger.warning("  Database is empty!")
            elif small == 0:
                logger.info("  ✓ No small chunks (<200 chars) found")
            else:
                percentage = (small / total) * 100
                logger.warning(f"  ⚠️  {small} small chunks found ({percentage:.1f}%)")
            
            if stats.get('avg_length', 0) > 300:
                logger.info(f"  ✓ Good average chunk size ({stats.get('avg_length', 0):.0f} chars)")
            else:
                logger.warning(f"  ⚠️  Average chunk size is small ({stats.get('avg_length', 0):.0f} chars)")
    
    except Exception as e:
        logger.error(f"Error during database check: {str(e)}")
    finally:
        await checker.close()
    
    logger.info("\n" + "="*60)
    logger.info("CHECK COMPLETED")
    logger.info("="*60)

def main():
    """Main entry point."""
    print("\n" + "="*60)
    print("NCERT DATABASE CHUNK CHECKER")
    print("="*60)
    
    try:
        asyncio.run(check_database())
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
    
    print("\n" + "="*60)
    print("Process completed")
    print("="*60)

if __name__ == "__main__":
    main()