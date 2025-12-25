"""
Database Analysis Tool - Comprehensive analysis of NCERT database.
Production-ready with detailed insights and reporting.
"""

import asyncio
import asyncpg
import os
import logging
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime, timedelta

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('database_analysis.log'),
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

class DatabaseAnalyzer:
    """Analyzes database content and structure."""
    
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
            logger.info("Connected to database for analysis")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.connection:
            await self.connection.close()
            logger.info("Database connection closed")
    
    async def get_basic_stats(self) -> Dict[str, Any]:
        """Get basic database statistics."""
        try:
            stats = await self.connection.fetchrow("""
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(DISTINCT chapter) as unique_chapters,
                    COUNT(DISTINCT subject) as unique_subjects,
                    COUNT(DISTINCT class_grade) as unique_classes,
                    MIN(created_at) as oldest_record,
                    MAX(created_at) as newest_record,
                    AVG(LENGTH(content)) as avg_content_length,
                    SUM(LENGTH(content)) as total_content_size
                FROM ncert_chunks
            """)
            return dict(stats) if stats else {}
        except Exception as e:
            logger.error(f"Error fetching basic stats: {str(e)}")
            return {}
    
    async def get_chapter_distribution(self, limit: int = 20) -> List[Dict]:
        """Get chapter distribution."""
        try:
            return await self.connection.fetch("""
                SELECT 
                    chapter,
                    COUNT(*) as record_count,
                    AVG(LENGTH(content)) as avg_length,
                    MIN(LENGTH(content)) as min_length,
                    MAX(LENGTH(content)) as max_length,
                    COUNT(CASE WHEN LENGTH(content) < 200 THEN 1 END) as small_chunks,
                    COUNT(CASE WHEN LENGTH(content) > 800 THEN 1 END) as large_chunks
                FROM ncert_chunks 
                GROUP BY chapter 
                ORDER BY record_count DESC 
                LIMIT $1
            """, limit)
        except Exception as e:
            logger.error(f"Error fetching chapter distribution: {str(e)}")
            return []
    
    async def get_class_subject_distribution(self) -> List[Dict]:
        """Get distribution by class and subject."""
        try:
            return await self.connection.fetch("""
                SELECT 
                    class_grade,
                    subject,
                    COUNT(*) as record_count,
                    COUNT(DISTINCT chapter) as chapter_count
                FROM ncert_chunks 
                GROUP BY class_grade, subject 
                ORDER BY class_grade, subject
            """)
        except Exception as e:
            logger.error(f"Error fetching class/subject distribution: {str(e)}")
            return []
    
    async def search_content(self, search_term: str, limit: int = 5) -> List[Dict]:
        """Search for specific content."""
        try:
            return await self.connection.fetch("""
                SELECT 
                    chapter,
                    subject,
                    LEFT(content, 300) as content_preview,
                    LENGTH(content) as content_length
                FROM ncert_chunks 
                WHERE content ILIKE '%' || $1 || '%'
                OR chapter ILIKE '%' || $1 || '%'
                ORDER BY LENGTH(content) DESC
                LIMIT $2
            """, search_term, limit)
        except Exception as e:
            logger.error(f"Error searching content: {str(e)}")
            return []
    
    async def get_content_quality_metrics(self) -> Dict[str, Any]:
        """Get content quality metrics."""
        try:
            metrics = await self.connection.fetchrow("""
                SELECT 
                    -- Size distribution
                    COUNT(CASE WHEN LENGTH(content) < 100 THEN 1 END) as tiny_chunks,
                    COUNT(CASE WHEN LENGTH(content) BETWEEN 100 AND 300 THEN 1 END) as small_chunks,
                    COUNT(CASE WHEN LENGTH(content) BETWEEN 300 AND 600 THEN 1 END) as medium_chunks,
                    COUNT(CASE WHEN LENGTH(content) BETWEEN 600 AND 1000 THEN 1 END) as large_chunks,
                    COUNT(CASE WHEN LENGTH(content) > 1000 THEN 1 END) as huge_chunks,
                    
                    -- Content issues
                    COUNT(CASE WHEN content LIKE 'Chapter:%' OR content LIKE '[Chapter:%]' THEN 1 END) as metadata_chunks,
                    COUNT(CASE WHEN content LIKE '%Figure%' THEN 1 END) as has_figures,
                    COUNT(CASE WHEN content LIKE '%Table%' THEN 1 END) as has_tables,
                    
                    -- Timeliness
                    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_chunks
                FROM ncert_chunks
            """)
            return dict(metrics) if metrics else {}
        except Exception as e:
            logger.error(f"Error fetching quality metrics: {str(e)}")
            return {}
    
    async def get_recent_activity(self, days: int = 7) -> List[Dict]:
        """Get recent database activity."""
        try:
            return await self.connection.fetch("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as chunks_added,
                    COUNT(DISTINCT chapter) as chapters_added
                FROM ncert_chunks 
                WHERE created_at > NOW() - INTERVAL $1 || ' days'
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at) DESC
            """, days)
        except Exception as e:
            logger.error(f"Error fetching recent activity: {str(e)}")
            return []

async def analyze_database():
    """Main analysis function."""
    logger.info("="*70)
    logger.info("COMPREHENSIVE DATABASE ANALYSIS")
    logger.info("="*70)
    
    # Check environment
    if not os.getenv('DATABASE_PASSWORD'):
        logger.error("DATABASE_PASSWORD environment variable is not set")
        return
    
    # Initialize analyzer
    analyzer = DatabaseAnalyzer()
    
    if not await analyzer.connect():
        return
    
    try:
        # 1. Basic Statistics
        logger.info("\n📊 BASIC STATISTICS:")
        basic_stats = await analyzer.get_basic_stats()
        
        if basic_stats:
            logger.info(f"  Total records: {basic_stats.get('total_records', 0):,}")
            logger.info(f"  Unique chapters: {basic_stats.get('unique_chapters', 0)}")
            logger.info(f"  Unique subjects: {basic_stats.get('unique_subjects', 0)}")
            logger.info(f"  Unique classes: {basic_stats.get('unique_classes', 0)}")
            logger.info(f"  Average content length: {basic_stats.get('avg_content_length', 0):.0f} chars")
            logger.info(f"  Total content size: {basic_stats.get('total_content_size', 0):,} chars")
            
            if basic_stats.get('oldest_record'):
                oldest = basic_stats['oldest_record']
                newest = basic_stats['newest_record']
                logger.info(f"  Data range: {oldest.strftime('%Y-%m-%d')} to {newest.strftime('%Y-%m-%d')}")
        
        # 2. Chapter Distribution
        logger.info("\n📚 CHAPTER DISTRIBUTION (Top 20):")
        chapters = await analyzer.get_chapter_distribution(20)
        
        for i, chapter in enumerate(chapters, 1):
            logger.info(f"  {i:2}. {chapter['chapter'][:45]:45} - {chapter['record_count']:4} records")
            logger.info(f"       Size: {chapter['avg_length']:.0f} avg, {chapter['min_length']} min, {chapter['max_length']} max")
            if chapter['small_chunks'] > 0:
                logger.info(f"       ⚠️  {chapter['small_chunks']} small chunks (<200 chars)")
        
        # 3. Class/Subject Distribution
        logger.info("\n🎓 CLASS & SUBJECT DISTRIBUTION:")
        distributions = await analyzer.get_class_subject_distribution()
        
        for dist in distributions:
            logger.info(f"  {dist['class_grade']} - {dist['subject']}:")
            logger.info(f"       Records: {dist['record_count']}, Chapters: {dist['chapter_count']}")
        
        # 4. Content Quality Analysis
        logger.info("\n✅ CONTENT QUALITY METRICS:")
        quality_metrics = await analyzer.get_content_quality_metrics()
        
        if quality_metrics:
            total = basic_stats.get('total_records', 0)
            if total > 0:
                logger.info("  Chunk Size Distribution:")
                for size_type in ['tiny_chunks', 'small_chunks', 'medium_chunks', 'large_chunks', 'huge_chunks']:
                    count = quality_metrics.get(size_type, 0)
                    percentage = (count / total) * 100
                    logger.info(f"    {size_type.replace('_', ' ').title()}: {count} ({percentage:.1f}%)")
                
                logger.info("\n  Content Issues:")
                if quality_metrics.get('metadata_chunks', 0) > 0:
                    logger.warning(f"    ⚠️  Metadata chunks: {quality_metrics['metadata_chunks']}")
                else:
                    logger.info(f"    ✓ No metadata chunks found")
                
                logger.info(f"    Contains figures: {quality_metrics.get('has_figures', 0)} chunks")
                logger.info(f"    Contains tables: {quality_metrics.get('has_tables', 0)} chunks")
        
        # 5. Search Examples
        logger.info("\n🔍 CONTENT SEARCH EXAMPLES:")
        search_terms = ['photosynthesis', 'chemical', 'electric', 'motion']
        
        for term in search_terms:
            logger.info(f"\n  Searching for '{term}':")
            results = await analyzer.search_content(term, 3)
            
            if results:
                for result in results:
                    logger.info(f"    • {result['chapter']} ({result['subject']})")
                    logger.info(f"      {result['content_preview'][:80]}...")
            else:
                logger.info(f"    No results found for '{term}'")
        
        # 6. Recent Activity
        logger.info("\n📈 RECENT ACTIVITY (Last 7 days):")
        recent_activity = await analyzer.get_recent_activity(7)
        
        if recent_activity:
            for activity in recent_activity:
                logger.info(f"  {activity['date']}: {activity['chunks_added']} chunks, {activity['chapters_added']} chapters")
        else:
            logger.info("  No recent activity found")
        
        # 7. Recommendations
        logger.info("\n💡 RECOMMENDATIONS:")
        
        if quality_metrics:
            if quality_metrics.get('metadata_chunks', 0) > 0:
                logger.warning("  ⚠️  Clean up metadata chunks from database")
            
            tiny = quality_metrics.get('tiny_chunks', 0)
            if tiny > 0:
                logger.warning(f"  ⚠️  Merge {tiny} tiny chunks (<100 chars) with adjacent chunks")
        
        avg_length = basic_stats.get('avg_content_length', 0)
        if avg_length < 300:
            logger.warning(f"  ⚠️  Consider increasing chunk size (current avg: {avg_length:.0f} chars)")
        elif avg_length > 800:
            logger.info(f"  ✓ Good chunk size (avg: {avg_length:.0f} chars)")
    
    except Exception as e:
        logger.error(f"Error during analysis: {str(e)}")
    finally:
        await analyzer.close()
    
    logger.info("\n" + "="*70)
    logger.info("ANALYSIS COMPLETED")
    logger.info("="*70)
    logger.info("Detailed log saved to: database_analysis.log")

def main():
    """Main entry point."""
    print("\n" + "="*70)
    print("NCERT DATABASE ANALYSIS TOOL")
    print("="*70)
    
    try:
        asyncio.run(analyze_database())
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
    
    print("\n" + "="*70)
    print("Analysis completed. Check database_analysis.log for details.")
    print("="*70)

if __name__ == "__main__":
    main()