"""
Database Maintenance Script - Fixes chapter names, cleans data, optimizes database.
"""

import asyncio
import asyncpg
import os
import logging
from pathlib import Path

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

async def maintain_database():
    """Main maintenance function."""
    logger.info("="*60)
    logger.info("DATABASE MAINTENANCE")
    logger.info("="*60)
    
    # Check environment
    if not os.getenv('DATABASE_PASSWORD'):
        logger.error("DATABASE_PASSWORD environment variable is not set")
        return
    
    conn = None
    try:
        # Connect to database
        conn = await asyncpg.connect(
            host='db.dcmnzvjftmdbywrjkust.supabase.co',
            port=5432,
            user='postgres',
            password=os.getenv('DATABASE_PASSWORD'),
            database='postgres',
            ssl='require',
            timeout=30
        )
        
        logger.info("Connected to database")
        
        # Get initial stats
        initial_count = await conn.fetchval('SELECT COUNT(*) FROM ncert_chunks')
        logger.info(f"Initial record count: {initial_count}")
        
        # ===== FIX 1: STANDARDIZE CLASS GRADES =====
        logger.info("\n1. Standardizing class grades...")
        updated_classes = await conn.fetchval("""
            UPDATE ncert_chunks 
            SET class_grade = 'Class 10'
            WHERE class_grade = '10'
            RETURNING COUNT(*)
        """)
        logger.info(f"   Updated {updated_classes} class grades")
        
        # ===== FIX 2: FIX CHAPTER NAMES =====
        logger.info("\n2. Fixing chapter names...")
        
        # Create a mapping of bad chapter names to proper names based on content analysis
        chapter_fixes = [
            # Map generic names to actual chapter names based on content patterns
            ("Science Chapter", "General Science Content"),
            ("In this", "Introduction"),
            ("CHAPTER I n the last", "Chapter Introduction"),
            ("CHAPTER I n the previous", "Previous Chapter Context"),
            ("CHAPTER Y ou have studied in the previous", "Previous Studies Review"),
            ("The wire XY is kept perpendicular to the plane of paper. n Horizontally place a small compass near to this copper wire. See the position of its needle", "Magnetic Effects - Experiment")
        ]
        
        total_fixed = 0
        for bad_name, good_name in chapter_fixes:
            fixed = await conn.fetchval("""
                UPDATE ncert_chunks 
                SET chapter = $1
                WHERE chapter = $2
                RETURNING COUNT(*)
            """, good_name, bad_name)
            
            if fixed and fixed > 0:
                logger.info(f"   '{bad_name[:30]}...' -> '{good_name}': {fixed} records")
                total_fixed += fixed
        
        # ===== FIX 3: REMOVE EXACT DUPLICATES =====
        logger.info("\n3. Removing exact duplicates...")
        duplicates_removed = await conn.fetchval("""
            DELETE FROM ncert_chunks 
            WHERE ctid NOT IN (
                SELECT MIN(ctid)
                FROM ncert_chunks 
                GROUP BY md5(content::text)
            )
            RETURNING COUNT(*)
        """)
        logger.info(f"   Removed {duplicates_removed} duplicate records")
        
        # ===== FIX 4: ADD MISSING METADATA =====
        logger.info("\n4. Ensuring consistent metadata...")
        metadata_fixed = await conn.fetchval("""
            UPDATE ncert_chunks 
            SET subject = 'Science'
            WHERE subject IS NULL 
            OR subject = ''
            RETURNING COUNT(*)
        """)
        logger.info(f"   Fixed {metadata_fixed} missing subjects")
        
        # ===== FIX 5: CLEAN VERY SHORT CHUNKS =====
        logger.info("\n5. Cleaning very short chunks...")
        short_chunks = await conn.fetchval("""
            DELETE FROM ncert_chunks 
            WHERE LENGTH(content) < 150
            RETURNING COUNT(*)
        """)
        logger.info(f"   Removed {short_chunks} chunks under 150 characters")
        
        # ===== FINAL STATISTICS =====
        logger.info("\n" + "="*60)
        logger.info("MAINTENANCE SUMMARY")
        logger.info("="*60)
        
        final_count = await conn.fetchval('SELECT COUNT(*) FROM ncert_chunks')
        logger.info(f"Final record count: {final_count}")
        logger.info(f"Records changed: {initial_count - final_count}")
        
        # Show chapter distribution after fixes
        logger.info("\nUpdated Chapter Distribution:")
        chapters = await conn.fetch("""
            SELECT chapter, COUNT(*) as count 
            FROM ncert_chunks 
            GROUP BY chapter 
            ORDER BY count DESC 
            LIMIT 10
        """)
        
        for i, row in enumerate(chapters, 1):
            logger.info(f"  {i:2}. {row['chapter'][:40]:40} - {row['count']:4} records")
        
        # Quality metrics
        quality = await conn.fetchrow("""
            SELECT 
                AVG(LENGTH(content)) as avg_length,
                MIN(LENGTH(content)) as min_length,
                MAX(LENGTH(content)) as max_length,
                COUNT(CASE WHEN LENGTH(content) < 200 THEN 1 END) as small_chunks,
                COUNT(DISTINCT chapter) as unique_chapters
            FROM ncert_chunks
        """)
        
        logger.info("\nQuality Metrics After Maintenance:")
        logger.info(f"  Average chunk size: {quality['avg_length']:.0f} chars")
        logger.info(f"  Min chunk size: {quality['min_length']} chars")
        logger.info(f"  Max chunk size: {quality['max_length']} chars")
        logger.info(f"  Small chunks (<200 chars): {quality['small_chunks']}")
        logger.info(f"  Unique chapters: {quality['unique_chapters']}")
        
        if quality['small_chunks'] == 0:
            logger.info("  ✅ Excellent: No small chunks!")
        
        logger.info("\n✅ MAINTENANCE COMPLETED SUCCESSFULLY")
        
    except Exception as e:
        logger.error(f"Maintenance failed: {str(e)}")
    finally:
        if conn:
            await conn.close()
            logger.info("Database connection closed")

def main():
    """Main entry point."""
    print("\n" + "="*60)
    print("NCERT DATABASE MAINTENANCE TOOL")
    print("="*60)
    
    try:
        asyncio.run(maintain_database())
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
    
    print("\n" + "="*60)
    print("Maintenance completed")
    print("="*60)

if __name__ == "__main__":
    main()