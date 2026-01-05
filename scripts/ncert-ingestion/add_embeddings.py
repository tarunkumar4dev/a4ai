# fixed_embeddings.py - Recreate ALL embeddings properly
import asyncio
import asyncpg
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

async def recreate_all_embeddings():
    print("🔄 RECREATING ALL EMBEDDINGS PROPERLY...")
    print("This will take a few minutes...")
    
    # Configure Gemini
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("❌ GEMINI_API_KEY not set")
        return
    
    genai.configure(api_key=api_key)
    
    # Connect to database
    conn = await asyncpg.connect(
        host='db.dcmnzvjftmdbywrjkust.supabase.co',
        port=5432,
        user='postgres',
        password=os.getenv("DATABASE_PASSWORD"),
        database='postgres',
        ssl='require'
    )
    
    try:
        # Get ALL chunks
        chunks = await conn.fetch("SELECT id, content FROM ncert_chunks")
        print(f"Found {len(chunks)} chunks to process")
        
        updated = 0
        failed = 0
        
        # Process in batches of 50
        for i in range(0, len(chunks), 50):
            batch = chunks[i:i+50]
            print(f"\n📦 Processing batch {i//50 + 1}/{(len(chunks)+49)//50}...")
            
            for chunk in batch:
                try:
                    # Generate proper embedding
                    result = genai.embed_content(
                        model="models/embedding-001",
                        content=chunk['content'][:3000],  # Limit to 3000 chars
                        task_type="retrieval_document"
                    )
                    
                    embedding = result["embedding"]
                    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                    
                    # Update database
                    await conn.execute("""
                        UPDATE ncert_chunks 
                        SET embedding = $1::vector 
                        WHERE id = $2
                    """, embedding_str, chunk['id'])
                    
                    updated += 1
                    
                    if updated % 10 == 0:
                        print(f"  ✓ Updated {updated} embeddings...")
                        
                except Exception as e:
                    failed += 1
                    if failed <= 3:  # Show first 3 errors
                        print(f"  ✗ Error with chunk {chunk['id']}: {str(e)[:50]}")
                    continue
        
        print(f"\n✅ COMPLETED!")
        print(f"   Successfully updated: {updated}")
        print(f"   Failed: {failed}")
        
        # Verify
        print("\n🔍 Verifying embeddings...")
        total = await conn.fetchval("SELECT COUNT(*) FROM ncert_chunks")
        unique_emb = await conn.fetchval("""
            SELECT COUNT(DISTINCT embedding::text) 
            FROM ncert_chunks 
            WHERE embedding IS NOT NULL
        """)
        
        print(f"   Total chunks: {total}")
        print(f"   Unique embeddings: {unique_emb}")
        
        if unique_emb == 1:
            print("❌ WARNING: All embeddings are identical!")
        elif unique_emb < total * 0.5:
            print("⚠️  WARNING: Many duplicate embeddings")
        else:
            print("✅ Good: Embeddings are unique")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await conn.close()
        print("\n🎉 Embedding recreation complete!")

if __name__ == "__main__":
    asyncio.run(recreate_all_embeddings())