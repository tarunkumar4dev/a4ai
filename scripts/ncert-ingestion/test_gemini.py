# test_gemini.py
import os
from dotenv import load_dotenv

load_dotenv()

key = os.getenv('GEMINI_API_KEY')
print(f'🔑 Key loaded (first 10 chars): {key[:10] if key else "NOT FOUND"}...')

if not key:
    print('❌ ERROR: GEMINI_API_KEY not found in .env file')
    exit(1)

import google.generativeai as genai
try:
    genai.configure(api_key=key)
    model = genai.GenerativeModel('models/gemini-2.5-flash')
    response = model.generate_content('Answer in one word: Hindi for hello')
    print(f'✅ Gemini Response: "{response.text}"')
    print('🎉 LOCAL GEMINI API TEST PASSED!')
except Exception as e:
    print(f'❌ Gemini Error: {type(e).__name__}: {e}')