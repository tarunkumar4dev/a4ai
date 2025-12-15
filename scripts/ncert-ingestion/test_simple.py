# test_simple.py
import os
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import google.generativeai as genai

load_dotenv()

# Test 1: Embedding model
print("Testing embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
embedding = model.encode("Hello world")
print(f"✅ Embedding generated: {len(embedding)} dimensions")

# Test 2: Gemini
print("\nTesting Gemini...")
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    genai.configure(api_key=gemini_key)
    gemini_model = genai.GenerativeModel('gemini-pro')
    
    response = gemini_model.generate_content("Say hello in Hindi")
    print(f"✅ Gemini response: {response.text}")
else:
    print("❌ Gemini key not found")

# Test 3: Supabase connection
print("\nTesting Supabase...")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if supabase_url and supabase_key:
    from supabase import create_client, Client
    supabase = create_client(supabase_url, supabase_key)
    
    # Simple query
    try:
        response = supabase.table('ncert_chunks').select('count').execute()
        print(f"✅ Supabase connected")
    except Exception as e:
        print(f"❌ Supabase error: {e}")
else:
    print("❌ Supabase credentials missing")