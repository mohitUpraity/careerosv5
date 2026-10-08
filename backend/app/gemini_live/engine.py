import asyncio
import logging
from typing import Optional, Callable, Awaitable, List, Dict, Any
from google import genai
from google.genai import types
from app.gemini_live.config import LiveEngineConfig

logger = logging.getLogger("gemini_live.engine")

class GeminiLiveEngine:
    """
    Decoupled Full-Duplex Engine for Google Gemini Live API.
    Follows Google's official 4-Worker TaskGroup architecture.
    """

    def __init__(
        self,
        api_key: str,
        config: Optional[LiveEngineConfig] = None,
        tools: Optional[List[types.Tool]] = None,
        on_audio_chunk: Optional[Callable[[bytes], Awaitable[None]]] = None,
        on_output_transcript: Optional[Callable[[str], Awaitable[None]]] = None,
        on_input_transcript: Optional[Callable[[str], Awaitable[None]]] = None,
        on_tool_call: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None,
        on_interrupted: Optional[Callable[[], Awaitable[None]]] = None,
        on_turn_complete: Optional[Callable[[], Awaitable[None]]] = None,
        on_error: Optional[Callable[[str], Awaitable[None]]] = None,
    ):
        self.api_key = api_key
        self.config = config or LiveEngineConfig()
        self.tools = tools
        self.on_audio_chunk = on_audio_chunk
        self.on_output_transcript = on_output_transcript
        self.on_input_transcript = on_input_transcript
        self.on_tool_call = on_tool_call
        self.on_interrupted = on_interrupted
        self.on_turn_complete = on_turn_complete
        self.on_error = on_error

        self.client = genai.Client(
            api_key=self.api_key,
            http_options=types.HttpOptions(api_version="v1alpha")
        )
        
        self.session = None
        self.is_connected = False
        self.is_closing = False
        self._send_lock = asyncio.Lock()

        # Upstream and downstream queues
        self.audio_in_queue = asyncio.Queue(maxsize=100)
        self.video_in_slot: Optional[bytes] = None  # Latest frame wins
        self._loop_task: Optional[asyncio.Task] = None

    async def _safe_send_realtime_input(self, **kwargs):
        """Serialize realtime input (audio/video) across tasks without concurrency collisions."""
        if not self.session or not self.is_connected or self.is_closing:
            return
        async with self._send_lock:
            try:
                await self.session.send_realtime_input(**kwargs)
            except Exception as e:
                logger.debug(f"Notice in send_realtime_input: {e}")

    async def _safe_send_client_content(self, **kwargs):
        """Serialize client turns / text prompt sends."""
        if not self.session or not self.is_connected or self.is_closing:
            return
        async with self._send_lock:
            try:
                await self.session.send_client_content(**kwargs)
            except Exception as e:
                logger.warning(f"Error in send_client_content: {e}")

    def push_audio(self, pcm_bytes: bytes):
        """Enqueue 16kHz PCM16 audio bytes from microphone."""
        if self.is_closing or not pcm_bytes:
            return
        if self.audio_in_queue.full():
            try:
                self.audio_in_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            self.audio_in_queue.put_nowait(pcm_bytes)
        except asyncio.QueueFull:
            pass

    def push_video(self, jpeg_bytes: bytes):
        """Enqueue latest JPEG video frame."""
        if self.is_closing or not jpeg_bytes:
            return
        self.video_in_slot = jpeg_bytes

    async def send_text_prompt(self, text: str):
        """Send a client turn or text instruction into the live session."""
        if self.session and self.is_connected:
            await self._safe_send_client_content(
                turns=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=text)]
                    )
                ],
                turn_complete=True
            )

    def _build_connect_config(self) -> types.LiveConnectConfig:
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.config.voice_name)
                )
            ),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=self.config.system_instruction or "")]
            ),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    disabled=False,
                    start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                    prefix_padding_ms=self.config.prefix_padding_ms,
                    silence_duration_ms=self.config.silence_duration_ms,
                ),
                activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
            )
        )

    async def start(self):
        """Connects and starts the 4-task asynchronous pipeline."""
        live_config = self._build_connect_config()
        
        models_to_try = [self.config.model] + [m for m in self.config.fallback_models if m != self.config.model]
        connected = False

        from contextlib import AsyncExitStack
        self._exit_stack = AsyncExitStack()

        for model_id in models_to_try:
            try:
                logger.info(f"Connecting to Gemini Live with model {model_id}...")
                cm = self.client.aio.live.connect(model=model_id, config=live_config)
                self.session = await self._exit_stack.enter_async_context(cm)
                self.is_connected = True
                self.config.model = model_id
                connected = True
                logger.info(f"Connected to Gemini Live with {model_id}")
                break
            except Exception as e:
                logger.warning(f"Connection attempt failed on {model_id}: {e}")

        if not connected:
            err = f"Failed to connect to any candidate Gemini Live models ({models_to_try})"
            logger.error(err)
            if self.on_error:
                await self.on_error(err)
            raise ConnectionError(err)

        self._loop_task = asyncio.create_task(self._run_pipeline())

    async def _run_pipeline(self):
        """TaskGroup pipeline coordinating real-time duplex IO."""
        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(self._upstream_audio_worker())
                tg.create_task(self._upstream_video_worker())
                tg.create_task(self._downstream_receiver_worker())
        except Exception as e:
            if not self.is_closing:
                logger.error(f"Live pipeline error: {e}", exc_info=True)
                if self.on_error:
                    await self.on_error(str(e))

    async def _upstream_audio_worker(self):
        """Streams microphone PCM frames to Gemini."""
        while not self.is_closing:
            try:
                chunk = await self.audio_in_queue.get()
                if self.session and self.is_connected:
                    await self._safe_send_realtime_input(
                        audio=types.Blob(data=chunk, mime_type=f"audio/pcm;rate={self.config.input_sample_rate}")
                    )
                self.audio_in_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Audio upstream notice: {e}")

    async def _upstream_video_worker(self):
        """Streams latest webcam frame responsive to camera capture (~1-2 FPS)."""
        sent_count = 0
        while not self.is_closing:
            try:
                if self.video_in_slot is not None and self.session and self.is_connected:
                    frame, self.video_in_slot = self.video_in_slot, None
                    await self._safe_send_realtime_input(
                        media=types.Blob(data=frame, mime_type="image/jpeg")
                    )
                    sent_count += 1
                    if sent_count % 10 == 1:
                        logger.info(f"📹 Streamed webcam frame #{sent_count} ({len(frame)} bytes) to Gemini Live Vision")
                    await asyncio.sleep(0.7)  # ~1.4 FPS steady pacing
                else:
                    await asyncio.sleep(0.1)  # Low-latency polling for next frame
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Video upstream notice: {e}")
                await asyncio.sleep(0.2)

    async def _downstream_receiver_worker(self):
        """Processes server responses across continuous turns."""
        while not self.is_closing and self.session:
            try:
                turn = self.session.receive()
                async for response in turn:
                    sc = response.server_content
                    if not sc:
                        continue

                    # Barge-in Interruption Signal
                    if sc.interrupted:
                        logger.info("⚡ Live API received barge-in interruption signal")
                        if self.on_interrupted:
                            await self.on_interrupted()

                    # Spoken Audio Stream
                    if sc.model_turn and sc.model_turn.parts:
                        for part in sc.model_turn.parts:
                            if part.inline_data and isinstance(part.inline_data.data, bytes):
                                if self.on_audio_chunk:
                                    await self.on_audio_chunk(part.inline_data.data)

                    # Output Transcripts (AI Speech)
                    if sc.output_transcription and getattr(sc.output_transcription, 'text', None):
                        if self.on_output_transcript:
                            await self.on_output_transcript(sc.output_transcription.text)

                    # Input Transcripts (Candidate Speech)
                    if sc.input_transcription and getattr(sc.input_transcription, 'text', None):
                        if self.on_input_transcript:
                            await self.on_input_transcript(sc.input_transcription.text)

                    # Turn Completed
                    if sc.turn_complete:
                        if self.on_turn_complete:
                            await self.on_turn_complete()

            except asyncio.CancelledError:
                break
            except Exception as e:
                if not self.is_closing:
                    err_str = str(e)
                    logger.warning(f"Receiver turn notice: {err_str}")
                    if "1011" in err_str or "1006" in err_str or "closed" in err_str.lower():
                        logger.info("Session closed by server. Terminating receiver loop.")
                        if self.on_error:
                            await self.on_error(err_str)
                        break
                    await asyncio.sleep(0.2)

    async def close(self):
        """Clean teardown of live session and tasks."""
        self.is_closing = True
        self.is_connected = False
        if self._loop_task:
            self._loop_task.cancel()
        if hasattr(self, '_exit_stack') and self._exit_stack:
            try:
                await self._exit_stack.aclose()
            except Exception:
                pass
        self.session = None
        logger.info("Gemini Live Engine session closed.")
