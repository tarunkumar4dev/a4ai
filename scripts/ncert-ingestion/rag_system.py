"""
NCERT RAG SYSTEM - PRODUCTION READY
Optimized for Flask API with proper sync/async handling
"""

import os
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import google.generativeai as genai
from datetime import datetime

# ========== FIX FOR WINDOWS UNICODE ==========
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rag_system.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class RAGSystem:
    """Production-ready RAG system for NCERT with sync/async support."""
    
    def __init__(self):
        self.conn = None
        self.current_model = None
        self.initialized = False
        self.initialize_sync()
    
    def initialize_sync(self):
        """Initialize the RAG system synchronously."""
        try:
            logger.info("🚀 Initializing NCERT RAG System...")
            
            # Load environment
            self._load_environment()
            
            # Initialize database connection synchronously
            if not self._init_database_sync():
                raise Exception("Failed to initialize database")
            
            # Initialize Gemini
            self._init_gemini_sync()
            
            self.initialized = True
            logger.info("✅ RAG System initialized successfully!")
            
        except Exception as e:
            logger.error(f"❌ Initialization failed: {e}", exc_info=True)
            raise
    
    def _load_environment(self):
        """Load environment variables."""
        env_path = Path(__file__).parent / '.env'
        if env_path.exists():
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and '=' in line and not line.startswith('#'):
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip().strip('"').strip("'")
            logger.info("✓ Loaded environment variables")
        else:
            logger.warning("⚠ .env file not found, using system environment")
    
    def _init_database_sync(self) -> bool:
        """Initialize database connection synchronously."""
        try:
            password = os.getenv("DATABASE_PASSWORD", "").strip()
            if not password:
                logger.error("❌ DATABASE_PASSWORD not set")
                return False
            
            # Use psycopg2 for synchronous database operations
            self.conn = psycopg2.connect(
                host='db.dcmnzvjftmdbywrjkust.supabase.co',
                port=5432,
                user='postgres',
                password=password,
                database='postgres',
                sslmode='require',
                connect_timeout=30
            )
            
            # Test connection
            with self.conn.cursor() as cursor:
                cursor.execute("SELECT version()")
                version = cursor.fetchone()[0]
                logger.info(f"✓ Connected to: {version.split(',')[0]}")
                
                # Check if table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'ncert_chunks'
                    )
                """)
                exists = cursor.fetchone()[0]
                
                if not exists:
                    logger.error("❌ Table 'ncert_chunks' does not exist!")
                    raise Exception("Table 'ncert_chunks' not found")
                
                # Count records
                cursor.execute("SELECT COUNT(*) FROM ncert_chunks")
                count = cursor.fetchone()[0]
                logger.info(f"✓ Database has {count} chunks")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    def _init_gemini_sync(self):
        """Initialize Gemini API synchronously."""
        try:
            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            if not api_key:
                logger.warning("⚠ GEMINI_API_KEY not set, using fallback mode")
                self.current_model = None
                return
            
            genai.configure(api_key=api_key)
            
            # Test models
            models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
            
            for model_name in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name)
                    # Quick test
                    response = model.generate_content("test", max_output_tokens=1)
                    if response.text:
                        self.current_model = model_name
                        logger.info(f"✓ Using model: {self.current_model}")
                        return
                except Exception as e:
                    logger.debug(f"Model {model_name} failed: {str(e)[:50]}")
                    continue
            
            logger.warning("⚠ No Gemini model worked, using fallback mode")
            self.current_model = None
            
        except Exception as e:
            logger.warning(f"⚠ Gemini initialization failed: {e}, using fallback")
            self.current_model = None
    
    def retrieve_chunks_sync(self, query: str, limit: int = 10) -> List[Dict]:
        """Retrieve relevant chunks from database synchronously."""
        if not self.conn:
            logger.error("Database not connected")
            return []
        
        try:
            # First try keyword search
            keywords = query.lower().split()
            keywords = [k for k in keywords if len(k) > 3][:5]
            
            chunks = []
            seen_ids = set()
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                for keyword in keywords:
                    cursor.execute("""
                        SELECT 
                            id, class_grade, subject, chapter, content,
                            0.8 as similarity
                        FROM ncert_chunks 
                        WHERE content ILIKE %s
                        ORDER BY id
                        LIMIT %s
                    """, (f'%{keyword}%', limit))
                    
                    rows = cursor.fetchall()
                    for row in rows:
                        if row['id'] not in seen_ids:
                            seen_ids.add(row['id'])
                            chunks.append(dict(row))
            
            # If no keyword matches found, get random chunks
            if not chunks:
                with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("""
                        SELECT 
                            id, class_grade, subject, chapter, content,
                            0.5 as similarity
                        FROM ncert_chunks 
                        ORDER BY RANDOM()
                        LIMIT %s
                    """, (limit,))
                    
                    rows = cursor.fetchall()
                    chunks = [dict(row) for row in rows]
            
            logger.debug(f"Retrieved {len(chunks)} chunks via keyword search")
            return chunks
            
        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            return []
    
    def generate_response_sync(self, query: str, chunks: List[Dict]) -> str:
        """Generate response using chunks synchronously."""
        if not chunks:
            return "I couldn't find relevant information in my NCERT knowledge base."
        
        # Try Gemini if available
        if self.current_model:
            try:
                # Prepare context
                context_parts = []
                for i, chunk in enumerate(chunks[:3], 1):
                    context_parts.append(
                        f"[Source {i}: Class {chunk.get('class_grade', 'N/A')}, "
                        f"Subject: {chunk.get('subject', 'N/A')}, "
                        f"Chapter: {chunk.get('chapter', 'N/A')}]\n"
                        f"{chunk['content']}"
                    )
                
                context = "\n\n---\n\n".join(context_parts)
                
                # Build prompt
                prompt = f"""You are an expert NCERT tutor. Answer based ONLY on the provided NCERT content.

NCERT CONTENT:
{context}

QUESTION: {query}

INSTRUCTIONS:
1. Answer concisely using ONLY the NCERT content above
2. If answer not in content, say: "This information is not available in the provided NCERT content."
3. Use simple, student-friendly language
4. Do not add external information
5. Mention relevant class and subject if applicable

ANSWER: """
                
                # Generate response
                model = genai.GenerativeModel(self.current_model)
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0.2,
                        "max_output_tokens": 1000,
                    }
                )
                
                return response.text
                
            except Exception as e:
                logger.error(f"Gemini generation failed: {e}, using fallback")
                # Fall through to fallback
        
        # Fallback response - combine top chunks
        return self._generate_fallback_response(chunks)
    
    def _generate_fallback_response(self, chunks: List[Dict]) -> str:
        """Generate fallback response when Gemini fails."""
        if not chunks:
            return "I couldn't find relevant information to answer this question."
        
        # Combine top 3 chunks
        response_parts = ["Based on NCERT content:"]
        
        for i, chunk in enumerate(chunks[:3], 1):
            response_parts.append(
                f"\n{i}. Class {chunk.get('class_grade', 'N/A')} - {chunk.get('subject', 'N/A')}"
                f"\n   Chapter: {chunk.get('chapter', 'N/A')}"
                f"\n   {chunk['content'][:200]}..."
            )
        
        response_parts.append("\n[Refer to NCERT textbook for complete information.]")
        
        return "\n".join(response_parts)
    
    def query_sync(self, question: str, limit: int = 10) -> Tuple[str, int]:
        """
        Synchronous query method - CRITICAL FOR FLASK API
        Returns: (answer, chunks_retrieved)
        """
        if not self.initialized:
            raise Exception("RAG system not initialized")
        
        start_time = datetime.now()
        
        # Retrieve chunks synchronously
        chunks = self.retrieve_chunks_sync(question, limit=limit)
        
        if not chunks:
            return "I couldn't find relevant information in my NCERT knowledge base.", 0
        
        # Generate response synchronously
        answer = self.generate_response_sync(question, chunks)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Query processed in {processing_time:.2f}s, chunks: {len(chunks)}")
        
        return answer, len(chunks)
    
    def count_chunks(self) -> int:
        """Count total chunks in database."""
        if not self.conn:
            return 0
        
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM ncert_chunks")
                count = cursor.fetchone()[0]
                return count
        except Exception as e:
            logger.error(f"Failed to count chunks: {e}")
            return 0
    
    def get_stats_sync(self) -> Dict[str, Any]:
        """Get database statistics synchronously."""
        if not self.conn:
            return {}
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT COUNT(*) as total FROM ncert_chunks")
                total = cursor.fetchone()['total']
                
                cursor.execute("SELECT COUNT(DISTINCT chapter) as chapters FROM ncert_chunks")
                chapters = cursor.fetchone()['chapters']
                
                cursor.execute("SELECT COUNT(DISTINCT subject) as subjects FROM ncert_chunks")
                subjects = cursor.fetchone()['subjects']
            
            return {
                "total_chunks": total,
                "unique_chapters": chapters,
                "unique_subjects": subjects,
                "current_model": self.current_model or "none",
            }
            
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}
    
    def list_chapters_sync(self) -> List[str]:
        """List all chapters in database synchronously."""
        if not self.conn:
            return []
        
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("SELECT DISTINCT chapter FROM ncert_chunks ORDER BY chapter")
                chapters = cursor.fetchall()
                return [row[0] for row in chapters if row[0]]
        except Exception as e:
            logger.error(f"Failed to list chapters: {e}")
            return []
    
    def close(self):
        """Cleanup resources."""
        if self.conn:
            self.conn.close()
            logger.info("✓ Database connection closed")

class VectorDatabase:
    """Wrapper for database operations (for backward compatibility)."""
    
    def __init__(self, rag_system: RAGSystem):
        self.rag = rag_system
    
    def count_chunks(self) -> int:
        """Count total chunks."""
        return self.rag.count_chunks()
    
    def get_similar_chunks(self, embedding: List[float], k: int = 5) -> List[Tuple]:
        """Get similar chunks (placeholder)."""
        # For now, return empty list
        return []
    
    def search_by_keyword(self, keyword: str, limit: int = 5) -> List[Tuple]:
        """Search by keyword."""
        if not self.rag.conn:
            return []
        
        try:
            with self.rag.conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, content, '{}'::jsonb as metadata
                    FROM ncert_chunks 
                    WHERE content ILIKE %s 
                    LIMIT %s
                """, (f'%{keyword}%', limit))
                return cursor.fetchall()
        except Exception as e:
            logger.error(f"Keyword search failed: {e}")
            return []

def test_system_sync():
    """Test the RAG system synchronously."""
    print("\n" + "="*60)
    print("TESTING NCERT RAG SYSTEM (SYNC)")
    print("="*60)
    
    try:
        rag = RAGSystem()
        
        # Test questions
        test_questions = [
            "What is photosynthesis?",
            "Explain chemical reactions",
            "What are acids and bases?",
            "Describe metals and non-metals",
            "What is electricity?"
        ]
        
        for question in test_questions:
            print(f"\n🔍 Question: {question}")
            answer, chunks = rag.query_sync(question)
            
            print(f"✅ Answer: {answer[:150]}...")
            print(f"📊 Chunks found: {chunks}")
            print("-" * 50)
        
        # Show stats
        stats = rag.get_stats_sync()
        print(f"\n📈 DATABASE STATS:")
        print(f"   Total chunks: {stats.get('total_chunks', 0)}")
        print(f"   Unique chapters: {stats.get('unique_chapters', 0)}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
    finally:
        rag.close()

if __name__ == "__main__":
    # Run synchronous test
    test_system_sync()