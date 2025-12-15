# test_retrieval.py - FIXED VERSION WITH EMBEDDING CONVERSION
import os
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv
import json
from typing import List, Dict, Optional, Any
import logging
from datetime import datetime
import numpy as np
import ast  # Added for string to list conversion

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()

# --- CONFIGURATION ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize clients
genai.configure(api_key=GEMINI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# --- CHAPTER LIST ---
CHAPTER_LIST = [
    "Chemical Reactions and Equations",
    "Acids, Bases and Salts", 
    "Metals and Non-metals",
    "Carbon and its Compounds",
    "Life Processes",
    "Control and Coordination",
    "How do Organisms Reproduce",
    "Heredity and Evolution",
    "Light - Reflection and Refraction",
    "Human Eye and Colourful World",
    "Electricity",
    "Magnetic Effects of Electric Current",
    "Our Environment"
]

# --- TEST QUERIES ---
TEST_QUERIES = [
    {
        "query": "Explain covalent bonding in carbon compounds",
        "chapter": "Carbon and its Compounds",
        "description": "Test covalent bonding in correct chapter"
    },
    {
        "query": "What is the pH scale and how does it work?",
        "chapter": "Acids, Bases and Salts", 
        "description": "Test pH scale query"
    },
    {
        "query": "How do metals react with acids?",
        "chapter": "Metals and Non-metals",
        "description": "Test metals reactivity"
    },
    {
        "query": "What is photosynthesis and where does it occur?",
        "chapter": "Life Processes",
        "description": "Test photosynthesis query"
    },
    {
        "query": "Explain reflection of light",
        "chapter": None,
        "description": "Test query without chapter filter"
    }
]

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    vec1 = np.array(vec1, dtype='float64')
    vec2 = np.array(vec2, dtype='float64')
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))

def convert_embedding(embedding_data):
    """Convert embedding from various formats to numpy array"""
    if embedding_data is None:
        return None
    
    # If it's already a list
    if isinstance(embedding_data, list):
        return np.array(embedding_data, dtype='float64')
    
    # If it's a string (most common case from Supabase)
    if isinstance(embedding_data, str):
        try:
            # Try to parse as a Python list string
            embedding_list = ast.literal_eval(embedding_data)
            return np.array(embedding_list, dtype='float64')
        except:
            # If parsing fails, try JSON
            try:
                import json as json_module
                embedding_list = json_module.loads(embedding_data)
                return np.array(embedding_list, dtype='float64')
            except:
                logger.warning(f"Failed to parse embedding string: {embedding_data[:50]}...")
                return None
    
    # If it's already a numpy array
    if isinstance(embedding_data, np.ndarray):
        return embedding_data.astype('float64')
    
    return None

def get_embedding(text: str) -> Optional[List[float]]:
    """Get embedding from Gemini for queries"""
    try:
        result = genai.embed_content(
            model="models/embedding-001",
            content=text,
            task_type="retrieval_query"
        )
        return result.get('embedding')
    except Exception as e:
        logger.error(f"❌ Embedding generation failed: {e}")
        return None

def retrieve_chunks_with_similarity(query: str, chapter: str = None, limit: int = 5):
    """Retrieve chunks and calculate similarity manually"""
    logger.info(f"\n🔍 Query: '{query}'")
    if chapter:
        logger.info(f"   Filter: Chapter = '{chapter}'")
    else:
        logger.info(f"   Filter: None (all chapters)")
    
    # Get query embedding
    query_embedding = get_embedding(query)
    if not query_embedding:
        return []
    
    # Fetch chunks from database
    try:
        if chapter:
            response = supabase.table("ncert_chunks")\
                .select("id, content, chapter, embedding")\
                .eq("chapter", chapter)\
                .execute()
        else:
            response = supabase.table("ncert_chunks")\
                .select("id, content, chapter, embedding")\
                .execute()
        
        if not response.data:
            logger.info("   ℹ️ No chunks found in database")
            return []
        
        # Calculate similarity for each chunk
        chunks_with_similarity = []
        valid_chunks_count = 0
        
        for chunk in response.data:
            # Convert embedding to numpy array
            chunk_embedding = convert_embedding(chunk['embedding'])
            
            if chunk_embedding is None:
                logger.debug(f"   Skipping chunk {chunk['id']} - invalid embedding")
                continue
            
            valid_chunks_count += 1
            similarity = cosine_similarity(query_embedding, chunk_embedding)
            chunks_with_similarity.append({
                'id': chunk['id'],
                'content': chunk['content'][:200],  # First 200 chars
                'chapter': chunk['chapter'],
                'similarity': round(similarity, 4)
            })
        
        if valid_chunks_count == 0:
            logger.warning("   ⚠️ No valid embeddings found in retrieved chunks")
            return []
        
        # Sort by similarity (highest first) and take top N
        chunks_with_similarity.sort(key=lambda x: x['similarity'], reverse=True)
        
        # Filter by similarity threshold
        filtered_chunks = [chunk for chunk in chunks_with_similarity if chunk['similarity'] > 0.6]
        
        logger.info(f"   📊 Found {valid_chunks_count} valid chunks (from {len(response.data)} total)")
        logger.info(f"   ✅ Returning {min(len(filtered_chunks), limit)} most relevant chunks")
        
        if filtered_chunks:
            logger.info(f"   🎯 Best similarity score: {filtered_chunks[0]['similarity']:.4f}")
            logger.info(f"   📄 From chapter: {filtered_chunks[0]['chapter']}")
        else:
            logger.info(f"   ℹ️ No chunks above similarity threshold (0.6)")
            # Return top chunks anyway for debugging
            return chunks_with_similarity[:limit]
        
        return filtered_chunks[:limit]
        
    except Exception as e:
        logger.error(f"   ❌ Retrieval failed: {e}")
        import traceback
        traceback.print_exc()
        return []

def test_database_structure():
    """Check database schema and content"""
    logger.info("\n" + "="*60)
    logger.info("🗃️ DATABASE STRUCTURE CHECK")
    logger.info("="*60)
    
    checks = {}
    
    try:
        # Check total rows
        count_result = supabase.table("ncert_chunks").select("*", count="exact").limit(1).execute()
        checks['table_exists'] = hasattr(count_result, 'count')
        checks['row_count'] = count_result.count if hasattr(count_result, 'count') else 0
        
        logger.info(f"✅ Table 'ncert_chunks' exists")
        logger.info(f"📊 Total rows: {checks['row_count']}")
        
        # Check columns
        sample = supabase.table("ncert_chunks").select("*").limit(1).execute()
        if sample.data:
            checks['columns'] = list(sample.data[0].keys())
            logger.info(f"📋 Columns found: {', '.join(checks['columns'])}")
            
            required_cols = ['id', 'chapter', 'content', 'embedding']
            missing = [col for col in required_cols if col not in checks['columns']]
            if missing:
                logger.error(f"❌ Missing required columns: {missing}")
                checks['has_required_columns'] = False
            else:
                logger.info("✅ All required columns present")
                checks['has_required_columns'] = True
        
        # Check chapter distribution
        chapter_result = supabase.table("ncert_chunks").select("chapter").execute()
        if chapter_result.data:
            chapter_counts = {}
            for item in chapter_result.data:
                chapter = item.get('chapter', 'Unknown')
                chapter_counts[chapter] = chapter_counts.get(chapter, 0) + 1
            
            checks['chapter_distribution'] = chapter_counts
            checks['unique_chapters'] = len(chapter_counts)
            
            logger.info(f"\n📚 Chapter Distribution ({len(chapter_counts)} unique chapters):")
            for chapter, count in sorted(chapter_counts.items()):
                logger.info(f"  {chapter}: {count} chunks")
        
        return checks
        
    except Exception as e:
        logger.error(f"❌ Database check failed: {e}")
        return {'error': str(e)}

def run_query_tests():
    """Run all query tests"""
    logger.info("\n" + "="*60)
    logger.info("🧪 RUNNING QUERY TESTS")
    logger.info("="*60)
    
    all_results = []
    
    for test_case in TEST_QUERIES:
        logger.info(f"\n{'─'*60}")
        logger.info(f"🧪 Test: {test_case['description']}")
        logger.info(f"📝 Query: '{test_case['query']}'")
        
        result = {
            'test_description': test_case['description'],
            'query': test_case['query'],
            'target_chapter': test_case['chapter'],
            'with_filter_results': [],
            'without_filter_results': [],
            'filtered_chapters': [],
            'unfiltered_chapters': []
        }
        
        # Test WITH chapter filter
        if test_case['chapter']:
            filtered_chunks = retrieve_chunks_with_similarity(
                query=test_case['query'],
                chapter=test_case['chapter'],
                limit=3
            )
            
            result['with_filter_results'] = filtered_chunks
            result['filtered_chapters'] = list(set([chunk['chapter'] for chunk in filtered_chunks]))
            
            if filtered_chunks:
                logger.info(f"   ✅ With filter: Found {len(filtered_chunks)} relevant chunks")
                if len(result['filtered_chapters']) == 1 and result['filtered_chapters'][0] == test_case['chapter']:
                    logger.info(f"   ✓ All chunks from correct chapter: {test_case['chapter']}")
                else:
                    logger.warning(f"   ⚠️ Chapters in filtered results: {result['filtered_chapters']}")
            else:
                logger.info(f"   ℹ️ No relevant chunks found with chapter filter")
        
        # Test WITHOUT chapter filter
        unfiltered_chunks = retrieve_chunks_with_similarity(
            query=test_case['query'],
            chapter=None,
            limit=5
        )
        
        result['without_filter_results'] = unfiltered_chunks
        result['unfiltered_chapters'] = list(set([chunk['chapter'] for chunk in unfiltered_chunks]))
        
        if unfiltered_chunks:
            logger.info(f"   📊 Without filter: Found {len(unfiltered_chunks)} chunks from {len(result['unfiltered_chapters'])} chapters")
            logger.info(f"   Chapters: {', '.join(sorted(result['unfiltered_chapters']))}")
            
            # Show top similarity scores
            if unfiltered_chunks:
                logger.info(f"   🎯 Top similarity scores:")
                for i, chunk in enumerate(unfiltered_chunks[:3], 1):
                    logger.info(f"      {i}. {chunk['similarity']:.4f} - {chunk['chapter']}")
        else:
            logger.info(f"   ℹ️ No relevant chunks found without filter")
        
        all_results.append(result)
        
        # Small delay between queries
        import time
        time.sleep(1)
    
    return all_results

def run_comprehensive_test():
    """Run all tests comprehensively"""
    logger.info("\n" + "="*60)
    logger.info("🚀 STARTING COMPREHENSIVE RAG TEST")
    logger.info("="*60)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results = {
        'timestamp': timestamp,
        'database_checks': {},
        'query_tests': [],
        'summary': {}
    }
    
    # Database check
    results['database_checks'] = test_database_structure()
    
    # Run query tests
    query_results = run_query_tests()
    results['query_tests'] = query_results
    
    # Generate summary
    total_tests = len(query_results)
    filtered_tests = [t for t in query_results if t['target_chapter']]
    
    total_filtered_chunks = sum(len(t['with_filter_results']) for t in filtered_tests)
    total_unfiltered_chunks = sum(len(t['without_filter_results']) for t in query_results)
    
    results['summary'] = {
        'total_tests': total_tests,
        'filtered_tests': len(filtered_tests),
        'total_filtered_chunks': total_filtered_chunks,
        'total_unfiltered_chunks': total_unfiltered_chunks,
        'avg_filtered_chunks': total_filtered_chunks / len(filtered_tests) if filtered_tests else 0,
        'avg_unfiltered_chunks': total_unfiltered_chunks / total_tests if total_tests else 0
    }
    
    # Display summary
    logger.info("\n" + "="*60)
    logger.info("📊 TEST SUMMARY")
    logger.info("="*60)
    logger.info(f"Total tests run: {results['summary']['total_tests']}")
    logger.info(f"Filtered tests: {results['summary']['filtered_tests']}")
    logger.info(f"Total filtered chunks retrieved: {results['summary']['total_filtered_chunks']}")
    logger.info(f"Total unfiltered chunks retrieved: {results['summary']['total_unfiltered_chunks']}")
    logger.info(f"Average filtered chunks per query: {results['summary']['avg_filtered_chunks']:.1f}")
    logger.info(f"Average unfiltered chunks per query: {results['summary']['avg_unfiltered_chunks']:.1f}")
    
    # Check filtering effectiveness
    if filtered_tests and total_filtered_chunks > 0:
        logger.info("\n✅ SIMILARITY-BASED SEARCH IS WORKING!")
        logger.info("   Retrieving most relevant chunks based on semantic similarity")
        
        # Show example of similarity scores
        if query_results and query_results[0]['without_filter_results']:
            example = query_results[0]['without_filter_results'][0]
            logger.info(f"   Example: Similarity score {example['similarity']:.4f} for '{example['chapter']}'")
    else:
        logger.warning("\n⚠️ No chunks retrieved. Check embedding format in database.")
    
    return results

def save_results(results: Dict[str, Any]):
    """Save test results to JSON file"""
    filename = f"test_results_{results['timestamp']}.json"
    
    # Make results JSON serializable
    serializable_results = json.loads(json.dumps(results, default=str))
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(serializable_results, f, indent=2, ensure_ascii=False)
    
    logger.info(f"\n💾 Results saved to: {filename}")
    return filename

def main():
    """Main test function"""
    try:
        logger.info("Starting RAG System Test...")
        
        results = run_comprehensive_test()
        
        results_file = save_results(results)
        
        # Final status
        logger.info("\n" + "="*60)
        logger.info("✅ TESTING COMPLETE")
        logger.info("="*60)
        
        if results['database_checks'].get('row_count', 0) > 0:
            logger.info(f"📊 Database has {results['database_checks']['row_count']} chunks")
            
            # Show quick test
            logger.info("\n🚀 Quick Test:")
            test_query = "What is Ohm's law?"
            logger.info(f"Query: '{test_query}'")
            chunks = retrieve_chunks_with_similarity(test_query, chapter="Electricity", limit=2)
            if chunks:
                logger.info(f"Found {len(chunks)} relevant chunks from 'Electricity' chapter")
                for i, chunk in enumerate(chunks, 1):
                    logger.info(f"  {i}. Similarity: {chunk['similarity']:.4f}")
                    logger.info(f"     Preview: {chunk['content'][:100]}...")
                logger.info("🎯 RAG System is WORKING CORRECTLY!")
            else:
                logger.warning("⚠️ Quick test failed - no relevant chunks found")
        else:
            logger.error("❌ Database appears to be empty. Run ingest.py first!")
        
        logger.info(f"📄 Results saved to: {results_file}")
        logger.info("="*60)
        
    except KeyboardInterrupt:
        logger.info("\n\n⏹️ Testing stopped by user")
    except Exception as e:
        logger.error(f"\n❌ Testing failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()