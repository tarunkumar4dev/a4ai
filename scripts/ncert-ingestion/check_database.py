# scripts/ncert-ingestion/check_database.py
import psycopg2
import sys
import os
from pathlib import Path

# Get the current script directory
script_dir = Path(__file__).parent

# Try multiple possible locations for .env file
env_locations = [
    script_dir / ".env",  # Same directory as script
    script_dir.parent / ".env",  # Parent directory
    Path.cwd() / ".env",  # Current working directory
    Path.home() / "OneDrive" / "Desktop" / "product" / "src" / "scripts" / "ncert-ingestion" / ".env",  # Full path to your .env
]

env_file = None
for location in env_locations:
    if location.exists():
        env_file = location
        print(f"✅ Found .env at: {location}")
        break

if env_file:
    # Load environment variables from the found .env file
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=env_file)
    
    # Now check if variables are loaded
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    print(f"SUPABASE_URL loaded: {'Yes' if supabase_url else 'No'}")
    print(f"SUPABASE_KEY loaded: {'Yes' if supabase_key else 'No'}")
    
    if supabase_url and supabase_key:
        try:
            from supabase import create_client, Client
            supabase = create_client(supabase_url, supabase_key)
            
            # Try to check if vector extension exists
            try:
                result = supabase.table("ncert_chunks").select("id").limit(1).execute()
                print("✅ Database connection successful")
                print(f"✅ Found ncert_chunks table with data")
                
                # Check if embedding column exists
                try:
                    # Try to query embedding column
                    result = supabase.table("ncert_chunks").select("embedding").limit(1).execute()
                    print("✅ Embedding column exists")
                except:
                    print("⚠ Embedding column not found or need to be created")
                    
            except Exception as e:
                print(f"❌ Database error: {e}")
                
        except Exception as e:
            print(f"❌ Supabase connection error: {e}")
    else:
        print("❌ SUPABASE_URL or SUPABASE_KEY not found in .env")
else:
    print("❌ Could not find .env file in any of these locations:")
    for location in env_locations:
        print(f"  - {location}")