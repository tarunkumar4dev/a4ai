# ncert-ingestion/try_gemini_models.py
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

print("🔍 Testing Gemini API...")

gemini_key = os.getenv("GEMINI_API_KEY")
if not gemini_key:
    print("❌ GEMINI_API_KEY not found in .env file")
    exit(1)

print(f"✅ Key found (starts with): {gemini_key[:15]}...")

# Configure
genai.configure(api_key=gemini_key)

# 1. List all available models
print("\n📋 Available models:")
try:
    models = list(genai.list_models())
    for i, model in enumerate(models[:10]):  # First 10 models
        print(f"  {i+1}. {model.name}")
    print(f"  ... and {len(models)-10} more" if len(models) > 10 else "")
except Exception as e:
    print(f"❌ Error listing models: {e}")

# 2. Try different model names
print("\n🧪 Testing different models:")

models_to_test = [
    'gemini-1.5-pro',      # Latest
    'gemini-1.5-flash',    # Fast
    'gemini-pro',          # Standard
    'gemini-1.0-pro',      # Legacy
    'models/gemini-pro',   # Full path
    'models/gemini-1.0-pro',
    'models/gemini-1.5-pro-latest',
]

successful_model = None

for model_name in models_to_test:
    try:
        print(f"  Testing '{model_name}'... ", end="")
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Say 'Hello' in Hindi")
        
        if response.text:
            print(f"✅ WORKING!")
            print(f"     Response: {response.text}")
            successful_model = model_name
            break
        else:
            print(f"❌ No response")
    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg:
            print(f"❌ Not found")
        elif "403" in error_msg:
            print(f"❌ Permission denied")
        elif "429" in error_msg:
            print(f"❌ Rate limited")
        else:
            print(f"❌ Error: {error_msg[:50]}...")

# 3. Summary
print("\n" + "="*50)
if successful_model:
    print(f"🎉 SUCCESS! Use this model: '{successful_model}'")
    print(f"\nUpdate your .env file with:")
    print(f"GEMINI_MODEL={successful_model}")
else:
    print("😞 No working model found.")
    print("\nPossible issues:")
    print("1. API key expired/invalid")
    print("2. Billing not enabled (check https://makersuite.google.com/)")
    print("3. Regional restrictions")
    print("\nFix: Generate new API key from Google AI Studio")

# 4. Quick API quota check
print("\n📊 API Info:")
try:
    # Try to get model info
    for model in genai.list_models():
        if 'gemini' in model.name.lower():
            print(f"  Model: {model.name}")
            print(f"    Supports: {', '.join(model.supported_generation_methods)}")
            break
except:
    print("  Could not fetch model details")