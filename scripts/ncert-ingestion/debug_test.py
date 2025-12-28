# debug_test.py
import asyncio
import asyncpg
import os

async def test_database():
    print("🔍 Testing database connection and content...")
    
    # Load environment
    from dotenv import load_dotenv
    load_dotenv()
    
    try:
        # Connect to database
        conn = await asyncpg.connect(
            host='db.dcmnzvjftmdbywrjkust.supabase.co',
            port=5432,
            user='postgres',
            password=os.getenv("DATABASE_PASSWORD"),
            database='postgres',
            ssl='require'
        )
        
        print("✅ Connected to database")
        
        # 1. Check total chunks
        total = await conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
        print(f"📊 Total chunks: {total}")
        
        # 2. Check if embeddings exist
        has_embeddings = await conn.fetchval("""
            SELECT COUNT(*) FROM ncert_chunks 
            WHERE embedding IS NOT NULL 
            AND array_length(string_to_array(trim(both '[]' from embedding::text), ','), 1) = 768
        """)
        print(f"📊 Chunks with embeddings: {has_embeddings}")
        
        # 3. Check chapters
        chapters = await conn.fetch("SELECT DISTINCT chapter FROM ncert_chunks LIMIT 10")
        print("\n📚 Chapters in database:")
        for i, row in enumerate(chapters, 1):
            print(f"  {i}. {row['chapter']}")
        
        # 4. Search for "photosynthesis" directly
        print("\n🔍 Searching for 'photosynthesis' in content:")
        results = await conn.fetch("""
            SELECT chapter, content 
            FROM ncert_chunks 
            WHERE content ILIKE '%photosynthesis%' 
            LIMIT 3
        """)
        
        if results:
            print(f"✅ Found {len(results)} chunks with 'photosynthesis':")
            for i, row in enumerate(results, 1):
                print(f"\n  Result {i}:")
                print(f"  Chapter: {row['chapter']}")
                print(f"  Content: {row['content'][:200]}...")
        else:
            print("❌ No 'photosynthesis' found in content")
            
            # Show some content to see what's there
            print("\n📄 Sample content from database:")
            samples = await conn.fetch("SELECT chapter, content FROM ncert_chunks LIMIT 3")
            for i, row in enumerate(samples, 1):
                print(f"\n  Sample {i} - {row['chapter']}:")
                print(f"  {row['content'][:200]}...")
        
        # 5. Check embeddings format
        print("\n🔧 Checking embeddings format:")
        embedding_sample = await conn.fetchrow("""
            SELECT embedding::text as embedding_str 
            FROM ncert_chunks 
            WHERE embedding IS NOT NULL 
            LIMIT 1
        """)
        
        if embedding_sample:
            emb_str = embedding_sample['embedding_str']
            print(f"✅ Embedding exists (length: {len(emb_str)} chars)")
            
            # Check if it's proper vector format
            if emb_str.startswith('[') and emb_str.endswith(']'):
                print("✅ Embedding is in proper vector format")
                # Count dimensions
                dims = len(emb_str.strip('[]').split(','))
                print(f"✅ Embedding dimensions: {dims}")
            else:
                print("❌ Embedding NOT in proper vector format")
        else:
            print("❌ No embeddings found in database!")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_database())