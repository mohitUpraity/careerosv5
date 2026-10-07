import asyncio
import os
import sys
import numpy as np
import sounddevice as sd
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(".env")
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("❌ GEMINI_API_KEY missing in .env")
    sys.exit(1)

# Audio Parameters (Google Live API Official Specs)
FORMAT = 'int16'
CHANNELS = 1
SEND_SAMPLE_RATE = 16000     # Gemini expects 16kHz audio input
RECEIVE_SAMPLE_RATE = 24000  # Gemini outputs 24kHz audio
CHUNK_SIZE = 512             # ~32ms low-latency frames

MODEL = "gemini-3.8-live"

# Dedicated Queues for Decoupled Audio Pipeline
audio_queue_output = asyncio.Queue()
audio_queue_mic = asyncio.Queue(maxsize=10)

client = genai.Client(
    api_key=API_KEY,
    http_options=types.HttpOptions(api_version="v1alpha")
)

CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    output_audio_transcription=types.AudioTranscriptionConfig(),
    input_audio_transcription=types.AudioTranscriptionConfig(),
    system_instruction=types.Content(
        parts=[
            types.Part.from_text(
                text="You are an expert technical interviewer conducting a live conversational interview. "
                     "Speak in concise, punchy 1-2 sentence replies. "
                     "Listen to the candidate and respond promptly without unnecessary pause."
            )
        ]
    ),
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(
            disabled=False,
            start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
            end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
            prefix_padding_ms=20,
            silence_duration_ms=180,  # 180ms instant turn-taking
        ),
        activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
    )
)

is_ai_speaking = False

async def listen_audio(loop):
    """Task 1: Non-blocking hardware microphone capture."""
    def callback(indata, frames, time_info, status):
        # Audio energy threshold to prevent speaker bleed
        rms = np.sqrt(np.mean(indata.astype(np.float32)**2))
        if is_ai_speaking and rms < 650:
            return
        data_bytes = indata.tobytes()
        loop.call_soon_threadsafe(
            lambda: audio_queue_mic.put_nowait({"data": data_bytes, "mime_type": "audio/pcm;rate=16000"})
            if not audio_queue_mic.full() else None
        )

    mic_stream = sd.InputStream(
        samplerate=SEND_SAMPLE_RATE,
        channels=CHANNELS,
        dtype=FORMAT,
        blocksize=CHUNK_SIZE,
        callback=callback
    )
    mic_stream.start()
    try:
        while True:
            await asyncio.sleep(1)
    finally:
        mic_stream.stop()
        mic_stream.close()

async def send_realtime(session):
    """Task 2: Upstream audio streaming."""
    while True:
        msg = await audio_queue_mic.get()
        try:
            await session.send_realtime_input(
                audio=types.Blob(data=msg["data"], mime_type=msg["mime_type"])
            )
        except Exception:
            pass
        audio_queue_mic.task_done()

async def receive_audio(session):
    """Task 3: Downstream multi-turn streaming & transcription."""
    global is_ai_speaking
    last_was_input = False
    
    while True:
        try:
            turn = session.receive()
            async for response in turn:
                sc = response.server_content
                if not sc:
                    continue
                
                # Instant interruption flush
                if sc.interrupted:
                    print("\n⚡ [Interruption Detected - Flushed]")
                    is_ai_speaking = False
                    while not audio_queue_output.empty():
                        try:
                            audio_queue_output.get_nowait()
                            audio_queue_output.task_done()
                        except asyncio.QueueEmpty:
                            break
                    continue

                if sc.model_turn:
                    for part in sc.model_turn.parts:
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            is_ai_speaking = True
                            pcm_chunk = np.frombuffer(part.inline_data.data, dtype=np.int16).reshape(-1, 1)
                            await audio_queue_output.put(pcm_chunk)

                if sc.input_transcription and getattr(sc.input_transcription, 'text', None):
                    t = sc.input_transcription.text
                    if not last_was_input:
                        print(f"\n🗣️ [You]: ", end="", flush=True)
                        last_was_input = True
                    print(t, end="", flush=True)

                if sc.output_transcription and getattr(sc.output_transcription, 'text', None):
                    t = sc.output_transcription.text
                    if last_was_input:
                        print(f"\n🤖 [AI]: ", end="", flush=True)
                        last_was_input = False
                    print(t, end="", flush=True)

                if sc.turn_complete:
                    is_ai_speaking = False
                    print()
        except asyncio.CancelledError:
            break
        except Exception as e:
            await asyncio.sleep(0.05)

async def play_audio():
    """Task 4: Non-blocking hardware speaker playback."""
    global is_ai_speaking
    speaker_stream = sd.OutputStream(
        samplerate=RECEIVE_SAMPLE_RATE,
        channels=CHANNELS,
        dtype=FORMAT,
        blocksize=CHUNK_SIZE
    )
    speaker_stream.start()
    try:
        while True:
            chunk = await audio_queue_output.get()
            await asyncio.to_thread(speaker_stream.write, chunk)
            audio_queue_output.task_done()
            if audio_queue_output.empty():
                is_ai_speaking = False
    finally:
        speaker_stream.stop()
        speaker_stream.close()

async def run():
    print("=" * 60)
    print(f"🎙️ GOOGLE GEMINI LIVE OFFICIAL DUPLEX (Model: {MODEL})")
    print("=" * 60)
    print("Connecting to Gemini Live WebSocket...")

    loop = asyncio.get_running_loop()

    try:
        async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
            print("✅ Connected to Gemini Live API!")
            print("🗣️ AI Interviewer is starting the session...\n")

            # Trigger opening greeting
            await session.send_client_content(
                turns=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text="[Candidate has joined. Greet them in 1 concise sentence and ask what role they are interviewing for.]")]
                    )
                ],
                turn_complete=True
            )

            async with asyncio.TaskGroup() as tg:
                tg.create_task(listen_audio(loop))
                tg.create_task(send_realtime(session))
                tg.create_task(receive_audio(session))
                tg.create_task(play_audio())

    except Exception as e:
        print(f"\n❌ Session Error: {e}")
    finally:
        print("\n👋 Audio hardware cleanly released.")

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n👋 Exited session.")
