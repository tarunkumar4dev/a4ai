import asyncio
import asyncpg
import os
from pathlib import Path

env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

async def verify():
    conn = await asyncpg.connect(
        host='db.dcmnzvjftmdbywrjkust.supabase.co',
        port=5432,
        user='postgres',
        password=os.getenv('DATABASE_PASSWORD'),
        database='postgres',
        ssl='require'
    )
    
    print("✅ VERIFYING INGESTION RESULTS")
    print("="*60)
    
    # 1. Total count
    total = await conn.fetchval('SELECT COUNT(*) FROM ncert_chunks')
    print(f"Total chunks in database: {total}")
    
    # 2. Check for small chunks (should be none)
    small_chunks = await conn.fetchval("""
        SELECT COUNT(*) FROM ncert_chunks 
        WHERE LENGTH(content) < 200
    """)
    print(f"Chunks under 200 chars: {small_chunks}")
    
    # 3. Check chapter names
    print("\n📚 CHAPTER DISTRIBUTION:")
    chapters = await conn.fetch("""
        SELECT chapter, COUNT(*) as count 
        FROM ncert_chunks 
        GROUP BY chapter 
        ORDER BY count DESC 
        LIMIT 10
    """)
    
    for i, row in enumerate(chapters, 1):
        print(f"{i:2}. {row['chapter'][:50]:50} - {row['count']:4} chunks")
    
    # 4. Sample content quality
    print("\n🔍 SAMPLE CHUNKS (random):")
    samples = await conn.fetch("""
        SELECT chapter, LENGTH(content) as len, LEFT(content, 150) as preview
        FROM ncert_chunks 
        ORDER BY RANDOM()
        LIMIT 3
    """)
    
    for i, row in enumerate(samples, 1):
        print(f"\nSample {i}:")
        print(f"  Chapter: {row['chapter']}")
        print(f"  Length: {row['len']} chars")
        print(f"  Preview: {row['preview']}...")
    
    await conn.close()
    print("\n" + "="*60)
    print("VERIFICATION COMPLETE")

asyncio.run(verify())