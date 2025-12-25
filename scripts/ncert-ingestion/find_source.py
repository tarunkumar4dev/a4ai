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

async def investigate():
    conn = await asyncpg.connect(
        host='db.dcmnzvjftmdbywrjkust.supabase.co',
        port=5432,
        user='postgres',
        password=os.getenv('DATABASE_PASSWORD'),
        database='postgres',
        ssl='require'
    )
    
    print("🔍 INVESTIGATING DATA SOURCE")
    print("="*60)
    
    # 1. Check total counts
    total = await conn.fetchval('SELECT COUNT(*) FROM ncert_chunks')
    print(f"Total chunks in DB: {total}")
    
    # 2. Check if there are chunks from add_ncert_content.py
    sample_chapters = [
        'Life Processes - Photosynthesis',
        'Chemical Reactions and Equations', 
        'Light - Reflection and Refraction',
        'Power Sharing - Democracy',
        'Motion'
    ]
    
    sample_count = await conn.fetchval("""
        SELECT COUNT(*) FROM ncert_chunks 
        WHERE chapter IN ($1, $2, $3, $4, $5)
    """, *sample_chapters)
    
    print(f"Chunks from add_ncert_content.py: {sample_count}")
    print(f"Other chunks (likely from PDFs): {total - sample_count}")
    
    # 3. Show some examples of non-sample content
    print("\n📚 NON-SAMPLE CONTENT (likely from PDFs):")
    rows = await conn.fetch("""
        SELECT chapter, LENGTH(content) as len, LEFT(content, 100) as preview
        FROM ncert_chunks 
        WHERE chapter NOT IN ($1, $2, $3, $4, $5)
        ORDER BY RANDOM()
        LIMIT 5
    """, *sample_chapters)
    
    for i, row in enumerate(rows, 1):
        print(f"\n{i}. {row['chapter']} ({row['len']} chars)")
        print(f"   Preview: {row['preview']}")
    
    # 4. Check for class_grade distribution
    print("\n🎓 CLASS GRADE DISTRIBUTION:")
    grades = await conn.fetch("""
        SELECT class_grade, COUNT(*) as count
        FROM ncert_chunks 
        GROUP BY class_grade 
        ORDER BY count DESC
    """)
    
    for grade in grades:
        print(f"   {grade['class_grade']}: {grade['count']} chunks")
    
    await conn.close()

asyncio.run(investigate())