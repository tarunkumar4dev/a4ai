# rag_system.py - Production Ready RAG System for NCERT Content
import os
import json
import asyncio
import sys
import io
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging

# Fix Windows console encoding for emojis
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Try to import required packages with fallbacks
try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    print("⚠️ FastAPI not installed. API mode disabled.")

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("⚠️ Sentence Transformers not installed.")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.pool import SimpleConnectionPool
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    print("⚠️ psycopg2 not installed.")

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️ Supabase not installed.")

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("⚠️ Google Generative AI not installed.")

from dotenv import load_dotenv
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rag_system.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Only create FastAPI app if available
if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="NCERT RAG System API",
        description="Retrieval Augmented Generation System for NCERT Textbook Content",
        version="1.0.0"
    )

    class QueryRequest(BaseModel):
        query: str
        top_k: int = 5
        similarity_threshold: float = 0.7
        filters: Optional[Dict[str, str]] = None

    class QueryResponse(BaseModel):
        question: str
        answer: str
        context: str
        sources: List[Dict[str, Any]]
        chunks_retrieved: int
        success: bool
        processing_time_ms: float

class RAGSystem:
    """Production Ready Retrieval Augmented Generation System for NCERT content"""
    
    def __init__(self):
        logger.info("🚀 Initializing RAG System...")
        
        # Configuration
        self.embedding_dimension = 768  # all-mpnet-base-v2 dimension
        self.connection_pool = None
        
        # Load environment
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.database_password = os.getenv("DATABASE_PASSWORD", "PasswordDatabaseSupasbase@2025")
        
        # Initialize components
        self.supabase_client = None
        self.embedding_model = None
        self.gemini_model = None
        
        self._initialize_components()
        
    def _initialize_components(self):
        """Initialize all system components with error handling"""
        
        # Initialize Supabase if available
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            try:
                self.supabase_client = create_client(self.supabase_url, self.supabase_key)
                logger.info("✅ Supabase client initialized")
            except Exception as e:
                logger.error(f"❌ Supabase initialization failed: {e}")
        
        # Initialize Sentence Transformers if available
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.embedding_model = SentenceTransformer('all-mpnet-base-v2')
                logger.info(f"✅ Embedding model loaded ({self.embedding_dimension} dimensions)")
            except Exception as e:
                logger.error(f"❌ Embedding model failed: {e}")
        
        # Initialize Gemini if available
        if GEMINI_AVAILABLE and self.gemini_key:
            try:
                genai.configure(api_key=self.gemini_key)
                self.gemini_model = genai.GenerativeModel('gemini-pro')
                logger.info("✅ Gemini model loaded")
            except Exception as e:
                logger.error(f"❌ Gemini initialization failed: {e}")
        
        # Initialize connection pool
        self._initialize_connection_pool()
        
        logger.info("✅ RAG System initialized successfully")
    
    def _initialize_connection_pool(self):
        """Initialize database connection pool"""
        if not PSYCOPG2_AVAILABLE:
            logger.warning("⚠️ psycopg2 not available, connection pool disabled")
            return
        
        try:
            # Create connection pool using PARAMETERS instead of connection string
            self.connection_pool = SimpleConnectionPool(
                1, 10,  # min 1, max 10 connections
                host="aws-0-ap-south-1.pooler.supabase.com",
                port=5432,
                database="postgres",
                user="postgres.dcmnzvjftmdbywrjkust",
                password=self.database_password  # Your password with @ symbol
            )
            logger.info("✅ Database connection pool initialized")
            
        except Exception as e:
            logger.error(f"❌ Connection pool initialization failed: {e}")
            self.connection_pool = None
    
    def get_connection(self):
        """Get a database connection from pool"""
        if not self.connection_pool:
            logger.error("❌ Connection pool not available")
            return None
        
        try:
            conn = self.connection_pool.getconn()
            return conn
        except Exception as e:
            logger.error(f"❌ Failed to get connection from pool: {e}")
            return None
    
    def return_connection(self, conn):
        """Return connection to pool"""
        if self.connection_pool and conn:
            try:
                self.connection_pool.putconn(conn)
            except Exception as e:
                logger.error(f"❌ Failed to return connection to pool: {e}")
    
    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text with fallback"""
        if self.embedding_model:
            try:
                return self.embedding_model.encode(text).tolist()
            except Exception as e:
                logger.error(f"❌ Embedding generation failed: {e}")
        
        # Fallback: return normalized random embedding
        import random
        random.seed(hash(text) % 2**32)
        embedding = [random.random() * 2 - 1 for _ in range(self.embedding_dimension)]
        
        # Normalize to unit length
        norm = sum(x*x for x in embedding) ** 0.5
        if norm > 0:
            embedding = [x/norm for x in embedding]
        
        logger.warning("⚠️ Using fallback embedding")
        return embedding
    
    def _build_filter_clauses(self, filters: Optional[Dict[str, str]]) -> Tuple[str, List[Any]]:
        """Build SQL filter clauses from filters dictionary"""
        if not filters:
            return "", []
        
        clauses = []
        params = []
        for key, value in filters.items():
            if key in ['class_grade', 'subject', 'chapter', 'topic', 'subtopic'] and value:
                clauses.append(f"{key} = %s")
                params.append(value)
        
        if clauses:
            return " AND " + " AND ".join(clauses), params
        return "", []
    
    async def retrieve_chunks_advanced(self, query: str, top_k: int = 5, 
                                     similarity_threshold: float = 0.7,
                                     filters: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """Advanced retrieval with hybrid search (vector + keyword)"""
        logger.info(f"🔍 Advanced search for: '{query}'")
        
        conn = self.get_connection()
        if not conn:
            logger.error("❌ Database connection failed")
            return []
        
        try:
            # Generate query embedding
            query_embedding = self.get_embedding(query)
            embedding_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
            
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build filter clauses
            filter_clause, filter_params = self._build_filter_clauses(filters)
            
            # Method 1: Try to use existing PostgreSQL function if available
            try:
                sql_function = """
                    SELECT * FROM ncert_rag_search(
                        query_text => %s,
                        query_embedding => %s::vector(%s),
                        match_threshold => %s,
                        match_count => %s
                    )
                """
                cur.execute(sql_function, (query, embedding_str, self.embedding_dimension, 
                                         similarity_threshold, top_k))
                rows = cur.fetchall()
                if rows:
                    logger.info(f"✅ Found {len(rows)} chunks via ncert_rag_search function")
                    return [dict(row) for row in rows]
            except Exception as e:
                logger.debug(f"ncert_rag_search function not available: {e}")
            
            # Method 2: Vector similarity search with filters
            sql_vector = f"""
                SELECT 
                    id, 
                    class_grade, 
                    subject, 
                    chapter, 
                    content,
                    topic,
                    page_number,
                    subtopic,
                    source_book,
                    chunk_size,
                    created_at,
                    1 - (embedding <=> %s::vector) as similarity
                FROM ncert_chunks
                WHERE embedding IS NOT NULL 
                AND 1 - (embedding <=> %s::vector) > %s
                {filter_clause}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """
            
            params = [embedding_str, embedding_str, similarity_threshold]
            params.extend(filter_params)
            params.extend([embedding_str, top_k])
            
            cur.execute(sql_vector, params)
            rows = cur.fetchall()
            
            if rows:
                chunks = [dict(row) for row in rows]
                logger.info(f"✅ Found {len(chunks)} chunks via vector similarity")
                return chunks
            
            # Method 3: Hybrid search (vector + keyword)
            logger.info("Trying hybrid search...")
            keywords = query.split()[:5]  # Use first 5 words as keywords
            keyword_conditions = " OR ".join(["content ILIKE %s"] * len(keywords))
            
            sql_hybrid = f"""
                SELECT 
                    id, 
                    class_grade, 
                    subject, 
                    chapter, 
                    content,
                    topic,
                    page_number,
                    subtopic,
                    source_book,
                    chunk_size,
                    created_at,
                    GREATEST(
                        1 - (embedding <=> %s::vector),
                        0.3  -- Minimum score for keyword matches
                    ) as similarity
                FROM ncert_chunks
                WHERE embedding IS NOT NULL 
                AND ({keyword_conditions})
                {filter_clause}
                ORDER BY similarity DESC
                LIMIT %s
            """
            
            keyword_params = [f'%{kw}%' for kw in keywords]
            hybrid_params = [embedding_str] + keyword_params + filter_params + [top_k]
            
            cur.execute(sql_hybrid, hybrid_params)
            rows = cur.fetchall()
            
            if rows:
                chunks = [dict(row) for row in rows]
                logger.info(f"✅ Found {len(chunks)} chunks via hybrid search")
                return chunks
            
            # Method 4: Simple keyword search as final fallback
            logger.info("Trying simple keyword search...")
            sql_keyword = f"""
                SELECT 
                    id, 
                    class_grade, 
                    subject, 
                    chapter, 
                    content,
                    topic,
                    page_number,
                    subtopic,
                    source_book,
                    chunk_size,
                    created_at,
                    0.5 as similarity
                FROM ncert_chunks 
                WHERE content ILIKE %s 
                {filter_clause}
                LIMIT %s
            """
            
            keyword_params = [f'%{query}%'] + filter_params + [top_k]
            cur.execute(sql_keyword, keyword_params)
            rows = cur.fetchall()
            
            chunks = [dict(row) for row in rows]
            if chunks:
                logger.info(f"✅ Found {len(chunks)} chunks via keyword search")
            else:
                logger.warning("❌ No chunks found via any search method")
            
            return chunks
            
        except Exception as e:
            logger.error(f"❌ Retrieval error: {e}")
            return []
        finally:
            self.return_connection(conn)
    
    async def retrieve_chunks(self, query: str, top_k: int = 5, 
                            similarity_threshold: float = 0.7,
                            filters: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """Main retrieval method - wrapper for advanced retrieval"""
        return await self.retrieve_chunks_advanced(
            query, top_k, similarity_threshold, filters
        )
    
    async def generate_answer(self, query: str, context_chunks: List[Dict]) -> str:
        """Generate answer using Gemini with proper citation"""
        if not context_chunks:
            return "No relevant information found in NCERT textbooks. Please try a different question or check if the topic is covered in NCERT curriculum."
        
        # Prepare context with citations
        context_parts = []
        for i, chunk in enumerate(context_chunks[:5], 1):  # Limit to 5 chunks
            class_info = chunk.get('class_grade', 'Unknown')
            subject = chunk.get('subject', 'Unknown')
            chapter = chunk.get('chapter', 'Unknown')
            topic = chunk.get('topic', '')
            
            citation = f"[Source {i}: NCERT Class {class_info} {subject}"
            if chapter:
                citation += f", Chapter: {chapter}"
            if topic:
                citation += f", Topic: {topic}"
            citation += "]"
            
            content = chunk.get('content', '')
            context_parts.append(f"{citation}\n{content}")
        
        context_text = "\n\n".join(context_parts)
        
        # Use Gemini if available
        if self.gemini_model:
            try:
                prompt = f"""You are a helpful NCERT textbook assistant. Your task is to answer questions based ONLY on the provided NCERT textbook excerpts.

CONTEXT EXCERPTS FROM NCERT TEXTBOOKS:
{context_text}

QUESTION: {query}

CRITICAL INSTRUCTIONS:
1. Answer STRICTLY using ONLY information from the provided NCERT context
2. If the information is NOT in the context, say: "This specific topic is not covered in the provided NCERT excerpts."
3. Keep answers accurate, concise, and in simple language suitable for students
4. Reference the class and subject when relevant
5. Include citation numbers like [Source 1] when using specific information
6. If multiple sources provide similar information, synthesize them into a coherent answer
7. Do not add any information not present in the context

ANSWER:"""
                
                response = self.gemini_model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                logger.error(f"❌ Gemini error: {e}")
                # Fall through to basic answer
        
        # Basic fallback answer
        return self._generate_basic_answer(context_chunks)
    
    def _generate_basic_answer(self, context_chunks: List[Dict]) -> str:
        """Generate basic answer when Gemini is unavailable"""
        if not context_chunks:
            return "No relevant information found."
        
        answer_parts = ["Based on NCERT textbooks:"]
        
        for i, chunk in enumerate(context_chunks[:3], 1):
            class_info = chunk.get('class_grade', 'Unknown')
            subject = chunk.get('subject', 'Unknown')
            chapter = chunk.get('chapter', '')
            content = chunk.get('content', '')[:300]
            
            source_info = f"Class {class_info} {subject}"
            if chapter:
                source_info += f" (Chapter: {chapter})"
            
            answer_parts.append(f"\n[{i}] {source_info}:\n{content}...")
        
        answer_parts.append("\n\n*Note: This is a summarized version. For complete information, refer to the original NCERT textbooks.*")
        
        return "\n".join(answer_parts)
    
    async def query(self, question: str, top_k: int = 5, 
                   similarity_threshold: float = 0.7,
                   filters: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Main RAG query function with performance tracking"""
        import time
        start_time = time.time()
        
        logger.info(f"\n📝 Processing query: {question}")
        
        try:
            # 1. Retrieve chunks
            chunks = await self.retrieve_chunks(
                question, top_k, similarity_threshold, filters
            )
            
            # 2. Generate answer
            answer = await self.generate_answer(question, chunks)
            
            # 3. Calculate processing time
            processing_time_ms = (time.time() - start_time) * 1000
            
            # 4. Prepare detailed sources
            sources = []
            for chunk in chunks:
                source_info = {
                    "class": chunk.get("class_grade"),
                    "subject": chunk.get("subject"),
                    "chapter": chunk.get("chapter"),
                    "topic": chunk.get("topic"),
                    "page": chunk.get("page_number"),
                    "content_preview": chunk.get("content", "")[:200] + "...",
                    "similarity": round(float(chunk.get("similarity", 0.0)), 3),
                    "chunk_size": chunk.get("chunk_size")
                }
                sources.append(source_info)
            
            # 5. Prepare context summary
            context = f"Retrieved {len(chunks)} relevant chunks from NCERT textbooks."
            if chunks:
                class_dist = {}
                for chunk in chunks:
                    cls = chunk.get('class_grade', 'Unknown')
                    class_dist[cls] = class_dist.get(cls, 0) + 1
                context += f" Classes: {', '.join([f'Class {k} ({v})' for k, v in class_dist.items()])}."
            
            return {
                "question": question,
                "answer": answer,
                "context": context,
                "sources": sources,
                "chunks_retrieved": len(chunks),
                "success": len(chunks) > 0,
                "processing_time_ms": round(processing_time_ms, 2),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Query processing failed: {e}")
            processing_time_ms = (time.time() - start_time) * 1000
            return {
                "question": question,
                "answer": f"Error processing query: {str(e)}",
                "context": "",
                "sources": [],
                "chunks_retrieved": 0,
                "success": False,
                "processing_time_ms": round(processing_time_ms, 2),
                "timestamp": datetime.now().isoformat()
            }

# Initialize system
rag_system = RAGSystem()

# FastAPI endpoints if available
if FASTAPI_AVAILABLE:
    @app.post("/api/rag/search", response_model=QueryResponse)
    async def rag_search_endpoint(request: QueryRequest):
        """Main RAG search endpoint"""
        try:
            result = await rag_system.query(
                question=request.query,
                top_k=request.top_k,
                similarity_threshold=request.similarity_threshold,
                filters=request.filters
            )
            return QueryResponse(**result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/rag/health")
    async def health_check():
        """Health check endpoint"""
        health_status = {
            "status": "healthy",
            "rag_system": "initialized",
            "supabase": bool(rag_system.supabase_client),
            "embedding_model": bool(rag_system.embedding_model),
            "gemini": bool(rag_system.gemini_model),
            "database_pool": bool(rag_system.connection_pool),
            "timestamp": datetime.now().isoformat()
        }
        
        # Test database connection
        if rag_system.connection_pool:
            try:
                conn = rag_system.get_connection()
                if conn:
                    health_status["database"] = "connected"
                    rag_system.return_connection(conn)
                else:
                    health_status["database"] = "disconnected"
            except Exception as e:
                health_status["database"] = f"error: {str(e)}"
        
        return health_status
    
    @app.get("/api/rag/stats")
    async def get_stats():
        """Get system statistics"""
        return {
            "embedding_dimension": rag_system.embedding_dimension,
            "models_loaded": {
                "embedding": bool(rag_system.embedding_model),
                "gemini": bool(rag_system.gemini_model)
            },
            "timestamp": datetime.now().isoformat()
        }
    
    @app.get("/")
    async def root():
        """Root endpoint with API information"""
        return {
            "name": "NCERT RAG System API",
            "version": "1.0.0",
            "description": "Retrieval Augmented Generation for NCERT Textbook Content",
            "endpoints": {
                "/api/rag/search": "POST - Search NCERT content",
                "/api/rag/health": "GET - System health check",
                "/api/rag/stats": "GET - System statistics",
                "/docs": "API documentation"
            }
        }

# Test function
async def test():
    """Comprehensive test of the RAG system"""
    print("\n" + "="*60)
    print("🧪 TESTING PRODUCTION RAG SYSTEM")
    print("="*60)
    
    test_questions = [
        "What is photosynthesis?",
        "Explain Newton's laws of motion",
        "What is democracy?",
        "Explain the water cycle",
        "What is Pythagoras theorem?"
    ]
    
    for i, q in enumerate(test_questions, 1):
        print(f"\n❓ Question {i}: {q}")
        result = await rag_system.query(q, top_k=3)
        
        print(f"✅ Chunks found: {result['chunks_retrieved']}")
        print(f"⏱️  Processing time: {result['processing_time_ms']:.2f}ms")
        print(f"📝 Answer preview: {result['answer'][:150]}...")
        
        if result['sources']:
            print(f"📚 Sources: {len(result['sources'])} found")
            for src in result['sources'][:2]:  # Show top 2 sources
                print(f"   • Class {src['class']} {src['subject']}: similarity={src['similarity']}")
        
        print("-" * 50)

# Interactive query mode
async def interactive_query():
    """Interactive query interface"""
    print("\n🤖 NCERT RAG System - Interactive Mode")
    print("="*40)
    print("Type your questions (or 'quit' to exit)")
    print("You can add filters like: 'class:10 subject:Science'")
    print("="*40)
    
    while True:
        try:
            user_input = input("\n❓ Enter question: ").strip()
            if user_input.lower() == 'quit':
                break
            
            # Parse filters from input
            question = user_input
            filters = {}
            
            # Simple filter parsing (e.g., "class:10 subject:Science")
            if ':' in user_input:
                parts = user_input.split()
                question_parts = []
                for part in parts:
                    if ':' in part:
                        key, value = part.split(':', 1)
                        if key in ['class', 'subject', 'chapter']:
                            filters[f"{key}_grade" if key == 'class' else key] = value
                        else:
                            question_parts.append(part)
                    else:
                        question_parts.append(part)
                question = ' '.join(question_parts)
            
            if not question:
                print("⚠️ Please enter a question")
                continue
            
            result = await rag_system.query(question, filters=filters)
            
            print(f"\n📝 Answer: {result['answer']}")
            print(f"\n📊 Statistics:")
            print(f"   • Chunks retrieved: {result['chunks_retrieved']}")
            print(f"   • Processing time: {result['processing_time_ms']:.2f}ms")
            print(f"   • Success: {'✅' if result['success'] else '❌'}")
            
            if result['sources']:
                print(f"\n📚 Top sources:")
                for i, src in enumerate(result['sources'][:3], 1):
                    print(f"   {i}. Class {src['class']} {src['subject']}")
                    if src['chapter']:
                        print(f"      Chapter: {src['chapter']}")
                    if src.get('similarity'):
                        print(f"      Similarity: {src['similarity']:.3f}")
            
        except KeyboardInterrupt:
            print("\n👋 Exiting...")
            break
        except Exception as e:
            print(f"❌ Error: {e}")

# Command line interface
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "test":
            asyncio.run(test())
        elif sys.argv[1] == "server" and FASTAPI_AVAILABLE:
            import uvicorn
            port = int(os.getenv("PORT", 8000))
            host = os.getenv("HOST", "0.0.0.0")
            print(f"🚀 Starting production server on http://{host}:{port}")
            print(f"📚 API Documentation: http://{host}:{port}/docs")
            uvicorn.run(
                app, 
                host=host, 
                port=port,
                log_level="info"
            )
        elif sys.argv[1] == "query":
            asyncio.run(interactive_query())
        else:
            print(f"❌ Unknown command: {sys.argv[1]}")
    else:
        # Default: interactive mode
        asyncio.run(interactive_query())