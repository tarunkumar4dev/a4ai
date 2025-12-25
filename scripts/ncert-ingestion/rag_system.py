"""
NCERT RAG SYSTEM - PRODUCTION READY
Version: 2.0.1 (Fixed SQL Syntax)
"""

import os
import asyncio
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple
import uuid
from datetime import datetime, timezone
import asyncpg
import google.generativeai as genai
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import traceback
import json
import hashlib

# ========== CONFIGURATION ==========
class Logger:
    def __init__(self, level: str = "INFO"):
        self.level = level
        logging.basicConfig(
            level=getattr(logging, level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def info(self, message: str):
        self.logger.info(message)
    
    def debug(self, message: str):
        self.logger.debug(message)
    
    def error(self, message: str, exc_info: bool = False):
        self.logger.error(message, exc_info=exc_info)
    
    def warning(self, message: str):
        self.logger.warning(message)

# ========== ENV LOADER ==========
def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        print(f"✓ Loading environment variables from: {env_path}")
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    try:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Remove quotes
                        if (value.startswith('"') and value.endswith('"')) or \
                           (value.startswith("'") and value.endswith("'")):
                            value = value[1:-1]
                        
                        os.environ[key] = value
                    except Exception as e:
                        continue
        return True
    else:
        print(f"⚠ .env file not found at {env_path}")
        return False

# ========== MAIN RAG SYSTEM ==========
class NCERTRAGSystem:
    """Production-ready NCERT RAG System with Supabase and Gemini."""
    
    def __init__(self):
        self.logger = Logger()
        
        # Load environment
        if not load_env():
            raise ValueError("Failed to load environment variables")
        
        # Validate credentials
        self._validate_credentials()
        
        # Initialize components
        self.db_config = self._get_db_config()
        self.current_model = None
        self.pool = None
        self.thread_pool = ThreadPoolExecutor(max_workers=5)
        self.embedding_cache = {}
        
        # Stats
        self.stats = {
            "queries_processed": 0,
            "embeddings_generated": 0,
            "cache_hits": 0,
            "errors": 0
        }
    
    def _validate_credentials(self):
        """Validate all required credentials."""
        required_vars = {
            "SUPABASE_URL": os.getenv("SUPABASE_URL"),
            "DATABASE_PASSWORD": os.getenv("DATABASE_PASSWORD"),
            "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY")
        }
        
        missing = [k for k, v in required_vars.items() if not v]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        self.logger.info("✓ All credentials validated")
    
    def _get_db_config(self):
        """Extract database configuration from Supabase URL."""
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        
        if supabase_url.startswith("https://"):
            supabase_url = supabase_url[8:]
        
        if ".supabase.co" in supabase_url:
            project_ref = supabase_url.split(".")[0]
            db_host = f"db.{project_ref}.supabase.co"
        else:
            db_host = supabase_url
        
        return {
            "host": db_host,
            "port": 5432,
            "user": "postgres",
            "password": os.getenv("DATABASE_PASSWORD"),
            "database": "postgres",
            "ssl": "require",
            "max_size": 10,
            "min_size": 1,
            "command_timeout": 30
        }
    
    async def initialize(self):
        """Initialize the RAG system."""
        try:
            self.logger.info("🚀 Initializing NCERT RAG System...")
            
            # Print configuration
            self._print_configuration()
            
            # Initialize database
            if not await self._init_database():
                return False
            
            # Initialize Gemini
            if not await self._init_gemini():
                return False
            
            self.logger.info("✅ RAG System initialized successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Initialization failed: {e}", exc_info=True)
            return False
    
    def _print_configuration(self):
        """Print system configuration."""
        print("\n" + "="*60)
        print("NCERT RAG SYSTEM - PRODUCTION CONFIGURATION")
        print("="*60)
        print(f"Database Host: {self.db_config['host']}")
        print(f"Database Port: {self.db_config['port']}")
        print(f"Embedding Model: models/embedding-001")
        print(f"LLM Models to try: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro")
        print("="*60 + "\n")
    
    async def _init_database(self):
        """Initialize database connection and schema."""
        try:
            self.logger.info("🔄 Connecting to Supabase PostgreSQL...")
            
            # Create connection pool
            self.pool = await asyncpg.create_pool(**self.db_config)
            
            async with self.pool.acquire() as conn:
                # Check connection
                db_version = await conn.fetchval("SELECT version()")
                self.logger.info(f"✓ Connected to PostgreSQL: {db_version.split(',')[0]}")
                
                # Ensure vector extension
                await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                
                # Setup schema
                await self._setup_schema(conn)
                
                # Get stats
                count = await conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
                self.logger.info(f"✓ Found {count} records in database")
                
                # Check existing chapters
                chapters = await conn.fetchval("SELECT COUNT(DISTINCT chapter) FROM ncert_chunks")
                self.logger.info(f"✓ Found {chapters} unique chapters")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Database initialization failed: {e}", exc_info=True)
            return False
    
    async def _setup_schema(self, conn):
        """Setup database schema - SIMPLIFIED VERSION (NO SQL SYNTAX ERRORS)."""
        # Check if table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'ncert_chunks'
            );
        """)
        
        if not table_exists:
            # Create table
            await conn.execute("""
                CREATE TABLE ncert_chunks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    class_grade VARCHAR(50),
                    subject VARCHAR(100),
                    chapter VARCHAR(200),
                    content TEXT,
                    embedding vector(768),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'::jsonb
                );
            """)
            self.logger.info("✓ Created new table 'ncert_chunks'")
        else:
            self.logger.info("✓ Table 'ncert_chunks' already exists")
        
        # Create indexes safely
        await self._create_indexes_safely(conn)
        
        self.logger.info("✓ Database schema setup complete")
    
    async def _create_indexes_safely(self, conn):
        """Create indexes with proper error handling."""
        # 1. Embedding index
        try:
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_ncert_embedding 
                ON ncert_chunks USING ivfflat (embedding vector_cosine_ops);
            """)
            self.logger.info("✓ Created embedding index")
        except Exception as e:
            self.logger.warning(f"Could not create ivfflat index: {e}")
            try:
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_ncert_embedding_simple 
                    ON ncert_chunks USING gin (embedding);
                """)
                self.logger.info("✓ Created simple embedding index")
            except Exception as e2:
                self.logger.warning(f"Could not create simple embedding index: {e2}")
        
        # 2. Other indexes
        indexes = [
            ("idx_ncert_class_subject", "ON ncert_chunks (class_grade, subject)"),
            ("idx_ncert_chapter", "ON ncert_chunks (chapter)"),
            ("idx_ncert_created", "ON ncert_chunks (created_at DESC)"),
            ("idx_ncert_content_hash", "ON ncert_chunks (md5(content))")
        ]
        
        for idx_name, idx_def in indexes:
            try:
                await conn.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} {idx_def}")
                self.logger.debug(f"✓ Created index: {idx_name}")
            except Exception as e:
                self.logger.debug(f"Could not create index {idx_name}: {e}")
    
    async def _init_gemini(self):
        """Initialize Gemini API and test models."""
        try:
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            self.logger.info("✓ Gemini API configured")
            
            # Test embedding model
            try:
                genai.embed_content(
                    model="models/embedding-001",
                    content="test",
                    task_type="retrieval_document"
                )
                self.logger.info("✓ Embedding model is working")
            except Exception as e:
                self.logger.error(f"❌ Embedding model failed: {e}")
                return False
            
            # Test LLM models
            self.logger.info("🔍 Testing LLM models...")
            llm_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
            
            for model_name in llm_models:
                try:
                    model = genai.GenerativeModel(model_name)
                    
                    def test_model():
                        try:
                            response = model.generate_content(
                                "Hello",
                                generation_config={"max_output_tokens": 5},
                                safety_settings=self._get_safety_settings()
                            )
                            return True
                        except:
                            return False
                    
                    loop = asyncio.get_event_loop()
                    success = await loop.run_in_executor(self.thread_pool, test_model)
                    
                    if success:
                        self.current_model = model_name
                        self.logger.info(f"✅ Selected model: {self.current_model}")
                        return True
                    else:
                        self.logger.warning(f"✗ Model {model_name} failed")
                        
                except Exception as e:
                    self.logger.debug(f"Model {model_name} error: {str(e)[:50]}")
                    continue
            
            self.logger.warning("⚠ No LLM model worked, using fallback mode")
            return True  # Still return True, will use fallback
            
        except Exception as e:
            self.logger.error(f"❌ Gemini initialization failed: {e}", exc_info=True)
            return False
    
    def _get_safety_settings(self):
        """Get safety settings for Gemini."""
        return [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding with caching."""
        if not text:
            return [0.0] * 768
        
        cache_key = hashlib.md5(text.encode()).hexdigest()
        
        # Cache hit
        if cache_key in self.embedding_cache:
            self.stats["cache_hits"] += 1
            return self.embedding_cache[cache_key]
        
        # Cache miss - generate
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.thread_pool,
                lambda: genai.embed_content(
                    model="models/embedding-001",
                    content=text,
                    task_type="retrieval_document"
                )
            )
            
            embedding = result["embedding"]
            self.embedding_cache[cache_key] = embedding
            self.stats["embeddings_generated"] += 1
            
            return embedding
            
        except Exception as e:
            self.logger.error(f"Embedding generation failed: {e}")
            self.stats["errors"] += 1
            return [0.0] * 768
    
    async def retrieve_chunks(self, query: str, top_k: int = 7, **filters) -> List[Dict]:
        """Retrieve relevant chunks from database."""
        if not self.pool:
            self.logger.error("Database not connected")
            return []
        
        try:
            # Generate query embedding
            query_embedding = await self.generate_embedding(query)
            
            # Build SQL query
            sql, params = self._build_retrieval_query(query_embedding, top_k, filters)
            
            # Execute query
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)
            
            # Process results
            chunks = []
            for row in rows:
                chunks.append({
                    "id": str(row["id"]),
                    "class_grade": row["class_grade"] or "N/A",
                    "subject": row["subject"] or "N/A",
                    "chapter": row["chapter"] or "N/A",
                    "content": row["content"] or "",
                    "similarity": float(row["similarity"] or 0),
                    "created_at": row["created_at"],
                    "metadata": row["metadata"] or {}
                })
            
            self.logger.debug(f"Retrieved {len(chunks)} chunks")
            return chunks
            
        except Exception as e:
            self.logger.error(f"Retrieval failed: {e}", exc_info=True)
            self.stats["errors"] += 1
            return []
    
    def _build_retrieval_query(self, embedding: List[float], top_k: int, filters: Dict) -> Tuple[str, List]:
        """Build SQL query for retrieval."""
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        
        sql = """
            SELECT id, class_grade, subject, chapter, content, 
                   created_at, metadata,
                   1 - (embedding <=> $1::vector) as similarity
            FROM ncert_chunks
            WHERE 1 - (embedding <=> $1::vector) > 0.25
        """
        
        params = [embedding_str]
        param_count = 2
        
        # Add filters
        if "class_grade" in filters and filters["class_grade"]:
            sql += f" AND class_grade = ${param_count}"
            params.append(filters["class_grade"])
            param_count += 1
        
        if "subject" in filters and filters["subject"]:
            sql += f" AND subject = ${param_count}"
            params.append(filters["subject"])
            param_count += 1
        
        sql += f" ORDER BY similarity DESC LIMIT ${param_count}"
        params.append(top_k)
        
        return sql, params
    
    async def generate_response(self, query: str, chunks: List[Dict]) -> str:
        """Generate response using Gemini or fallback."""
        if not chunks:
            return "I couldn't find relevant information in my NCERT knowledge base to answer this question."
        
        # Try Gemini first
        if self.current_model:
            try:
                context = self._prepare_context(chunks)
                prompt = self._build_prompt(query, context)
                
                model = genai.GenerativeModel(self.current_model)
                
                def generate():
                    response = model.generate_content(
                        prompt,
                        generation_config={
                            "temperature": 0.2,
                            "top_p": 0.8,
                            "top_k": 40,
                            "max_output_tokens": 1000,
                        },
                        safety_settings=self._get_safety_settings()
                    )
                    return response.text
                
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(self.thread_pool, generate)
                
                self.logger.info(f"Generated response using {self.current_model}")
                return response
                
            except Exception as e:
                self.logger.error(f"Gemini generation failed: {str(e)[:100]}")
                self.stats["errors"] += 1
        
        # Fallback response
        return self._generate_fallback_response(chunks)
    
    def _prepare_context(self, chunks: List[Dict]) -> str:
        """Prepare context from chunks."""
        context_parts = []
        for i, chunk in enumerate(chunks[:3]):
            context_parts.append(
                f"[Source {i+1}: Class {chunk.get('class_grade', 'N/A')}, "
                f"Subject: {chunk.get('subject', 'N/A')}, "
                f"Chapter: {chunk.get('chapter', 'N/A')}]\n\n"
                f"{chunk['content']}"
            )
        return "\n\n---\n\n".join(context_parts)
    
    def _build_prompt(self, query: str, context: str) -> str:
        """Build prompt for Gemini."""
        return f"""You are an expert NCERT tutor. Answer based ONLY on the provided NCERT content.

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
    
    def _generate_fallback_response(self, chunks: List[Dict]) -> str:
        """Generate fallback response."""
        if not chunks:
            return "I couldn't find relevant information to answer this question."
        
        best = chunks[0]
        preview = best["content"][:400] + "..." if len(best["content"]) > 400 else best["content"]
        
        return f"""Based on NCERT Class {best.get('class_grade', '')} {best.get('subject', '')}:

Chapter: {best.get('chapter', '')}

{preview}

[Direct excerpt from NCERT textbook. Refer to original for complete explanation.]"""
    
    async def query(self, question: str, **filters) -> Dict[str, Any]:
        """Main query method - full RAG pipeline."""
        self.stats["queries_processed"] += 1
        
        start_time = asyncio.get_event_loop().time()
        
        # Retrieve chunks
        chunks = await self.retrieve_chunks(question, top_k=10, **filters)
        retrieval_time = asyncio.get_event_loop().time() - start_time
        
        if not chunks:
            return {
                "question": question,
                "answer": "I couldn't find relevant information in my NCERT knowledge base.",
                "sources": [],
                "metadata": {
                    "retrieval_time": f"{retrieval_time:.2f}s",
                    "total_time": f"{retrieval_time:.2f}s",
                    "chunks_found": 0,
                    "top_similarity": "0%",
                    "model": "none"
                }
            }
        
        # Generate response
        generation_start = asyncio.get_event_loop().time()
        answer = await self.generate_response(question, chunks)
        generation_time = asyncio.get_event_loop().time() - generation_start
        
        total_time = asyncio.get_event_loop().time() - start_time
        
        # Prepare sources
        sources = []
        for i, chunk in enumerate(chunks[:3]):
            sources.append({
                "id": chunk.get("id", ""),
                "class": chunk.get("class_grade", "N/A"),
                "subject": chunk.get("subject", "N/A"),
                "chapter": chunk.get("chapter", "N/A"),
                "confidence": f"{chunk.get('similarity', 0):.1%}",
                "preview": chunk.get("content", "")[:100] + "..." if len(chunk.get("content", "")) > 100 else chunk.get("content", ""),
                "rank": i + 1
            })
        
        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "metadata": {
                "retrieval_time": f"{retrieval_time:.2f}s",
                "generation_time": f"{generation_time:.2f}s",
                "total_time": f"{total_time:.2f}s",
                "chunks_found": len(chunks),
                "top_similarity": f"{chunks[0].get('similarity', 0):.1%}",
                "model": self.current_model or "fallback",
                "filters": filters
            }
        }
    
    async def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        if not self.pool:
            return {}
        
        try:
            async with self.pool.acquire() as conn:
                # Basic stats
                total = await conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
                classes = await conn.fetchval("SELECT COUNT(DISTINCT class_grade) FROM ncert_chunks")
                subjects = await conn.fetchval("SELECT COUNT(DISTINCT subject) FROM ncert_chunks")
                chapters = await conn.fetchval("SELECT COUNT(DISTINCT chapter) FROM ncert_chunks")
                
                # Chapter distribution
                chapter_dist = await conn.fetch("""
                    SELECT chapter, COUNT(*) as count 
                    FROM ncert_chunks 
                    GROUP BY chapter 
                    ORDER BY count DESC 
                    LIMIT 10
                """)
                
                chapters_list = [{"chapter": r["chapter"], "count": r["count"]} for r in chapter_dist]
                
                # Recent additions
                recent = await conn.fetch("""
                    SELECT class_grade, subject, chapter, created_at 
                    FROM ncert_chunks 
                    ORDER BY created_at DESC 
                    LIMIT 5
                """)
                
                recent_list = [
                    {
                        "class": r["class_grade"],
                        "subject": r["subject"],
                        "chapter": r["chapter"],
                        "added": r["created_at"].strftime("%Y-%m-%d %H:%M")
                    }
                    for r in recent
                ]
                
                return {
                    "total_records": total,
                    "unique_classes": classes,
                    "unique_subjects": subjects,
                    "unique_chapters": chapters,
                    "top_chapters": chapters_list,
                    "recent_additions": recent_list,
                    "system_stats": self.stats,
                    "current_model": self.current_model or "fallback"
                }
                
        except Exception as e:
            self.logger.error(f"Failed to get stats: {e}")
            return {}
    
    async def close(self):
        """Cleanup resources."""
        self.logger.info("🔄 Cleaning up resources...")
        
        if self.pool:
            await self.pool.close()
            self.logger.info("✓ Database connection closed")
        
        if self.thread_pool:
            self.thread_pool.shutdown(wait=False)
            self.logger.info("✓ Thread pool shutdown")
        
        self.embedding_cache.clear()
        self.logger.info("✅ Cleanup complete")

# ========== COMMAND LINE INTERFACE ==========
async def run_tests(rag):
    """Run system tests."""
    test_questions = [
        "What is photosynthesis?",
        "Explain Newton's first law of motion",
        "What are acids and bases?",
        "What is democracy?",
        "Describe the human digestive system"
    ]
    
    for question in test_questions:
        print(f"\n{'='*40}")
        print(f"Test: {question}")
        print(f"{'='*40}")
        
        result = await rag.query(question)
        
        print(f"Answer: {result['answer'][:150]}...")
        print(f"Time: {result['metadata']['total_time']}")
        print(f"Chunks: {result['metadata']['chunks_found']}")
        print(f"Model: {result['metadata']['model']}")
        
        await asyncio.sleep(0.5)

async def show_stats(rag):
    """Show system statistics."""
    stats = await rag.get_database_stats()
    
    if not stats:
        print("❌ Could not retrieve statistics")
        return
    
    print(f"\n📈 DATABASE STATISTICS:")
    print(f"   Total records: {stats.get('total_records', 0)}")
    print(f"   Unique classes: {stats.get('unique_classes', 0)}")
    print(f"   Unique subjects: {stats.get('unique_subjects', 0)}")
    print(f"   Unique chapters: {stats.get('unique_chapters', 0)}")
    print(f"   Current model: {stats.get('current_model', 'N/A')}")
    
    if stats.get('top_chapters'):
        print(f"\n📚 TOP CHAPTERS:")
        for i, chapter in enumerate(stats['top_chapters'][:5], 1):
            print(f"   {i}. {chapter['chapter']}: {chapter['count']} records")
    
    if stats.get('system_stats'):
        print(f"\n⚙️  SYSTEM STATS:")
        sys_stats = stats['system_stats']
        print(f"   Queries processed: {sys_stats.get('queries_processed', 0)}")
        print(f"   Embeddings generated: {sys_stats.get('embeddings_generated', 0)}")
        print(f"   Cache hits: {sys_stats.get('cache_hits', 0)}")
        print(f"   Errors: {sys_stats.get('errors', 0)}")

async def run_query(rag, question: str):
    """Run a single query."""
    print(f"\n🔍 Query: {question}")
    print("⏳ Processing...")
    
    result = await rag.query(question)
    
    print(f"\n✅ ANSWER:")
    print(f"{result['answer']}\n")
    
    if result['sources']:
        print(f"📚 SOURCES:")
        for i, source in enumerate(result['sources'], 1):
            print(f"   {i}. Class {source['class']} - {source['subject']}")
            print(f"      Chapter: {source['chapter']}")
            print(f"      Confidence: {source['confidence']}")
            if source['preview']:
                print(f"      Preview: {source['preview']}")
            print()
    
    print(f"⏱️  PERFORMANCE:")
    print(f"   Total time: {result['metadata']['total_time']}")
    print(f"   Chunks found: {result['metadata']['chunks_found']}")
    print(f"   Top similarity: {result['metadata']['top_similarity']}")
    print(f"   Model used: {result['metadata']['model']}")

async def run_filtered_query(rag, question: str, class_grade: str, subject: str):
    """Run a filtered query."""
    print(f"\n🔍 Filtered Query:")
    print(f"   Class: {class_grade}")
    print(f"   Subject: {subject}")
    print(f"   Question: {question}")
    print("⏳ Processing...")
    
    result = await rag.query(question, class_grade=class_grade, subject=subject)
    
    print(f"\n✅ ANSWER:")
    print(f"{result['answer']}\n")
    
    print(f"⏱️  PERFORMANCE:")
    print(f"   Total time: {result['metadata']['total_time']}")
    print(f"   Chunks found: {result['metadata']['chunks_found']}")

async def interactive_mode(rag):
    """Interactive mode."""
    print("\n📚 INTERACTIVE NCERT RAG SYSTEM")
    print("Type 'help' for commands, 'quit' to exit")
    print("-" * 50)
    
    while True:
        try:
            user_input = input("\n🎯 Query/Command: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
                
            if user_input.lower() == 'help':
                print("\n📖 COMMANDS:")
                print("  <question>                    - Ask a question")
                print("  filter <class> <subject> <q>  - Filtered query")
                print("  stats                         - Show statistics")
                print("  test                          - Run tests")
                print("  quit/exit/q                   - Exit")
                continue
                
            if user_input.lower() == 'stats':
                await show_stats(rag)
                continue
                
            if user_input.lower() == 'test':
                await run_tests(rag)
                continue
            
            # Check for filter command
            if user_input.lower().startswith('filter '):
                parts = user_input.split(' ', 3)
                if len(parts) >= 4:
                    await run_filtered_query(rag, parts[3], parts[1], parts[2])
                else:
                    print("❌ Usage: filter <class> <subject> <question>")
                continue
            
            # Regular query
            print("⏳ Processing...")
            result = await rag.query(user_input)
            
            print(f"\n✅ ANSWER:")
            print(f"{result['answer']}\n")
            
            if result['sources']:
                print("📚 SOURCES:")
                for source in result['sources']:
                    print(f"  • Class {source['class']} {source['subject']}")
                    print(f"    Chapter: {source['chapter']} ({source['confidence']})")
            
            print(f"⏱️  Time: {result['metadata']['total_time']}")
            print("-" * 50)
            
        except KeyboardInterrupt:
            print("\n\n🛑 Interrupted")
            break
        except Exception as e:
            print(f"\n❌ Error: {str(e)[:100]}")

def show_help():
    """Show help message."""
    print("\n📖 USAGE:")
    print("  python rag_system.py test            - Run system tests")
    print("  python rag_system.py stats           - Show statistics")
    print("  python rag_system.py query <text>    - Run a query")
    print("  python rag_system.py filter <class> <subject> <query>")
    print("  python rag_system.py                 - Interactive mode")

async def main():
    """Main CLI entry point."""
    print("\n" + "="*60)
    print("NCERT RAG SYSTEM - PRODUCTION READY")
    print("="*60)
    
    rag = None
    try:
        # Initialize system
        rag = NCERTRAGSystem()
        
        if not await rag.initialize():
            print("\n❌ Initialization failed!")
            return
        
        # Handle command line arguments
        if len(sys.argv) > 1:
            command = sys.argv[1].lower()
            
            if command == "test":
                print("\n🧪 Running system test...")
                await run_tests(rag)
                
            elif command == "stats":
                print("\n📊 Getting system statistics...")
                await show_stats(rag)
                
            elif command == "query" and len(sys.argv) > 2:
                question = " ".join(sys.argv[2:])
                await run_query(rag, question)
                
            elif command == "filter" and len(sys.argv) > 4:
                class_grade = sys.argv[2]
                subject = sys.argv[3]
                question = " ".join(sys.argv[4:])
                await run_filtered_query(rag, question, class_grade, subject)
                
            else:
                show_help()
                
        else:
            # Interactive mode
            await interactive_mode(rag)
            
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        traceback.print_exc()
    finally:
        if rag:
            await rag.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")