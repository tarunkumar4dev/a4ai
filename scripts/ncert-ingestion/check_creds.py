import os
from pathlib import Path

print("="*60)
print("CHECKING YOUR SETUP")
print("="*60)

# Check .env file
env_path = Path(__file__).parent / '.env'
if not env_path.exists():
    print("❌ ERROR: .env file not found!")
    print(f"Expected at: {env_path}")
    print("\nCreate a .env file with:")
    print('SUPABASE_URL="https://dcmnzvjftmdbywrjkust.supabase.co"')
    print('DATABASE_PASSWORD="your-actual-database-password"')
    print('GEMINI_API_KEY="your-gemini-api-key"')
    exit(1)

print(f"✓ Found .env file at: {env_path}")

# Load it
with open(env_path, 'r') as f:
    lines = f.readlines()
    
print("\nContents of .env:")
print("-" * 40)
for line in lines:
    line = line.strip()
    if line and '=' in line and not line.startswith('#'):
        key = line.split('=')[0].strip()
        print(f"{key}: {'*' * 20 if 'PASSWORD' in key or 'KEY' in key else line}")
print("-" * 40)

# Extract values
supabase_url = ""
database_password = ""
gemini_key = ""

for line in lines:
    line = line.strip()
    if line and '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        
        if key == 'SUPABASE_URL':
            supabase_url = value
        elif key == 'DATABASE_PASSWORD':
            database_password = value
        elif key == 'GEMINI_API_KEY':
            gemini_key = value

print(f"\n✓ SUPABASE_URL: {supabase_url}")
print(f"✓ DATABASE_PASSWORD length: {len(database_password)} characters")
print(f"✓ GEMINI_API_KEY length: {len(gemini_key)} characters")

if not supabase_url:
    print("❌ SUPABASE_URL is empty!")
if not database_password:
    print("❌ DATABASE_PASSWORD is empty!")
if not gemini_key:
    print("❌ GEMINI_API_KEY is empty!")

print("\n" + "="*60)
print("NEXT STEPS:")
print("="*60)
print("1. If credentials look wrong, update your .env file")
print("2. Run: python rag_system.py")
print("3. If connection fails, check your Supabase dashboard")
print("   - Go to Settings → Database")
print("   - Verify your password")
print("   - Add your IP to allow list if needed")
print("="*60)