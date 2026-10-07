import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

API_KEY = os.environ.get("GEMINI_API_KEY")

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("❌ google-genai package is not installed. Please install it with: pip install google-genai")
    sys.exit(1)

async def test_live_text_ping():
    if not API_KEY:
        print("❌ GEMINI_API_KEY is missing in .env!")
        return

    print(f"🔑 Loaded API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
    
    # Check client initialization
    client = genai.Client(
        api_key=API_KEY,
        http_options=types.HttpOptions(api_version="v1alpha")
    )
    
    # Active models supporting bidiGenerateContent
    candidate_models = [
        "gemini-3.8-live",
        "gemini-2.5-flash-native-audio-latest",
    ]

    for model_id in candidate_models:
        print(f"\n🔄 [Attempt] Testing Gemini Live WebSocket with model: '{model_id}'...")
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            output_audio_transcription=types.AudioTranscriptionConfig()
        )

        try:
            async with client.aio.live.connect(model=model_id, config=config) as session:
                print(f"✅ Successfully Connected to Gemini Live API over WebSocket ({model_id})!")
                
                test_prompt = "Hello Gemini Live! Confirm that bidirectional connection is working in one short sentence."
                print(f"📤 Sending test prompt: '{test_prompt}'")
                
                await session.send_client_content(
                    turns=[
                        types.Content(
                            role="user",
                            parts=[types.Part.from_text(text=test_prompt)]
                        )
                    ],
                    turn_complete=True
                )

                print("📥 Receiving streaming response from Gemini Live:")
                received_any = False
                async for response in session.receive():
                    sc = response.server_content
                    if sc:
                        if sc.model_turn:
                            for part in sc.model_turn.parts:
                                if part.inline_data:
                                    received_any = True
                                    print(f" [🔊 Received Audio chunk: {len(part.inline_data.data)} bytes, mime={part.inline_data.mime_type}] ", end="", flush=True)
                        if sc.output_transcription and getattr(sc.output_transcription, 'text', None):
                            print(sc.output_transcription.text, end="", flush=True)
                        if sc.turn_complete:
                            print("\n\n🎉 [SUCCESS] Live Voice Connection confirmed working!")
                            return True
                        
                if not received_any:
                    print("\n⚠️ Session closed without text parts.")
        except Exception as e:
            print(f"❌ Connection failed on model {model_id}: {e}")

    print("\n❌ All tested live models failed. Please verify API key permissions and network access.")
    return False

if __name__ == "__main__":
    asyncio.run(test_live_text_ping())
