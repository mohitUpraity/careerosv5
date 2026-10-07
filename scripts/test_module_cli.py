import asyncio
import os
import sys
import numpy as np
import sounddevice as sd
from dotenv import load_dotenv

# Add backend directory to sys.path to import our module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.gemini_live import LiveInterviewSession

load_dotenv(".env")
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("❌ GEMINI_API_KEY missing in .env")
    sys.exit(1)

FORMAT = 'int16'
CHANNELS = 1
SEND_RATE = 16000
RECV_RATE = 24000
CHUNK = 1024

async def main():
    print("=" * 60)
    print("🎙️ TESTING STANDALONE 'gemini_live' MODULE")
    print("=" * 60)

    audio_playback_queue = asyncio.Queue()
    is_speaking = False

    # 1. Non-blocking raw PCM audio output
    speaker_stream = sd.RawOutputStream(
        samplerate=RECV_RATE,
        channels=CHANNELS,
        dtype=FORMAT
    )
    speaker_stream.start()

    async def speaker_worker():
        nonlocal is_speaking
        while True:
            try:
                chunk = await audio_playback_queue.get()
                if not speaker_stream.closed:
                    if not speaker_stream.active:
                        try:
                            speaker_stream.start()
                        except Exception:
                            pass
                    await asyncio.to_thread(speaker_stream.write, chunk)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"\n⚠️ [Speaker Playback Warning]: {e}", flush=True)
            finally:
                if audio_playback_queue.empty():
                    is_speaking = False

    playback_task = asyncio.create_task(speaker_worker())

    # 2. Callbacks for module
    async def on_audio_chunk(pcm_bytes: bytes):
        nonlocal is_speaking
        is_speaking = True
        await audio_playback_queue.put(pcm_bytes)

    async def on_json_message(data: dict):
        nonlocal is_speaking
        msg_type = data.get("type")
        if msg_type == "output_transcript":
            print(data.get("text", ""), end="", flush=True)
        elif msg_type == "input_transcript":
            print(f"\n🗣️ [You]: {data.get('text', '')}", flush=True)
        elif msg_type == "interrupted":
            print("\n⚡ [Interrupted AI - Audio flushed]", flush=True)
            is_speaking = False
            # Safely drain unplayed audio queue without killing hardware PortAudio stream
            while not audio_playback_queue.empty():
                try:
                    audio_playback_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
        elif msg_type == "turn_complete":
            is_speaking = False
            print()

    # 3. Instantiate our new module's session
    session = LiveInterviewSession(
        api_key=API_KEY,
        user_id="test_candidate",
        company="Google",
        role="Senior Backend Engineer",
        candidate_name="Mohit",
        send_json_callback=on_json_message,
        send_audio_callback=on_audio_chunk,
    )

    # 4. Continuous Full-Duplex Microphone Stream
    def mic_callback(indata, frames, time_info, status):
        session.push_audio(indata.tobytes())

    mic_stream = sd.InputStream(
        samplerate=SEND_RATE,
        channels=CHANNELS,
        dtype=FORMAT,
        blocksize=CHUNK,
        callback=mic_callback
    )
    mic_stream.start()

    print("🟢 Initializing LiveInterviewSession from module...")
    print("💡 Tip: You can interrupt the AI at any time. (Headphones recommended for best experience)")
    try:
        await session.start()
        print("✅ Session started! Speak to the interviewer (Press Ctrl+C to stop)...\n")
        while True:
            await asyncio.sleep(0.5)
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n🛑 Ending interview and generating scorecard...")
        try:
            scorecard = await session.generate_scorecard()
            print("\n" + "=" * 50)
            print("📊 FINAL INTERVIEW SCORECARD")
            print("=" * 50)
            import json
            print(json.dumps(scorecard, indent=2))
        except Exception as e:
            print(f"Could not generate scorecard: {e}")
    finally:
        playback_task.cancel()
        mic_stream.stop()
        mic_stream.close()
        speaker_stream.stop()
        speaker_stream.close()
        await session.close()
        print("\n👋 Cleanly shutdown.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
