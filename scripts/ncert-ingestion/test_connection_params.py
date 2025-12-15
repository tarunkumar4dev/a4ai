# test_connection_params.py
import psycopg2

try:
    conn = psycopg2.connect(
        host="aws-0-ap-south-1.pooler.supabase.com",
        port=5432,
        database="postgres",
        user="postgres.dcmnzvjftmdbywrjkust",
        password="yourpassword@2025"  # Your actual password with @ symbol
    )
    
    print("✅ Connection successful!")
    
    cursor = conn.cursor()
    cursor.execute("SELECT version()")
    result = cursor.fetchone()
    print(f"✅ PostgreSQL version: {result[0]}")
    
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")