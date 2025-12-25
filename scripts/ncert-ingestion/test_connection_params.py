import os
from pathlib import Path

# Load .env file
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
                    
                    if value and ((value.startswith('"') and value.endswith('"')) or 
                                 (value.startswith("'") and value.endswith("'"))):
                        value = value[1:-1]
                    
                    os.environ[key] = value
                    print(f"  Set: {key} = {'*' * len(value) if 'PASSWORD' in key or 'KEY' in key else value}")
                except Exception as e:
                    continue
else:
    print(f"⚠ .env file not found")

# Check what we have
print(f"\nChecking environment variables:")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL', 'NOT SET')}")
print(f"DATABASE_PASSWORD: {'*' * len(os.getenv('DATABASE_PASSWORD', '')) if os.getenv('DATABASE_PASSWORD') else 'NOT SET'}")
print(f"GEMINI_API_KEY: {'*' * len(os.getenv('GEMINI_API_KEY', '')) if os.getenv('GEMINI_API_KEY') else 'NOT SET'}")

# Extract host from SUPABASE_URL
supabase_url = os.getenv('SUPABASE_URL', '')
if supabase_url:
    if supabase_url.startswith('https://'):
        supabase_url = supabase_url[8:]
    
    if '.supabase.co' in supabase_url:
        host_parts = supabase_url.split('.')
        if len(host_parts) >= 2:
            project_ref = host_parts[0]
            db_host = f"db.{project_ref}.supabase.co"
            print(f"\nExtracted DB Host: {db_host}")
        else:
            print(f"\nCould not extract host from URL: {supabase_url}")