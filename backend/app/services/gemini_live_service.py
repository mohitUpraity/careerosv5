import asyncio
import base64
import json
import logging
from contextlib import AsyncExitStack

logger = logging.getLogger(__name__)
import time
from typing import Dict, Any, Optional, List, Callable

from app.core.config import settings
from app.services.llm_service import llm_service
from app.services.neo4j_service import neo4j_service

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    genai = None
    types = None
    HAS_GENAI = False

if HAS_GENAI and types:
    INTERVIEWER_LIVE_TOOLS = [
        types.FunctionDeclaration(
            name="update_scratchpad_note",
            description="Takes real-time private observation notes on the candidate's speech dynamics, voice clarity, body posture, nervous shivering/fidgeting, eye gaze, or technical depth.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "category": types.Schema(
                        type="STRING",
                        description="Category of observation",
                        enum=["voice_speech", "body_language", "eye_contact", "technical_depth", "problem_solving", "behavioral"]
                    ),
                    "observation": types.Schema(type="STRING", description="Specific objective observation"),
                    "sentiment": types.Schema(
                        type="STRING",
                        description="Assessment sentiment",
                        enum=["positive", "neutral", "concern", "red_flag"]
                    ),
                    "confidence_score": types.Schema(type="NUMBER", description="Rating from 1 to 10")
                },
                required=["category", "observation", "sentiment"]
            )
        ),
        types.FunctionDeclaration(
            name="trigger_proctor_warning",
            description="Issues an on-screen warning alert and polite verbal caution when suspicious activity is spotted (phone visible, reading external notes, frequent gaze shift, multiple people, secondary voice).",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "violation_type": types.Schema(
                        type="STRING",
                        description="Nature of suspicion",
                        enum=["phone_detected", "reading_external_notes", "frequent_gaze_shift", "multiple_people_in_frame", "audio_secondary_voice"]
                    ),
                    "warning_message": types.Schema(type="STRING", description="Warning message displayed on HUD"),
                    "warning_level": types.Schema(type="INTEGER", description="1, 2, or 3")
                },
                required=["violation_type", "warning_message", "warning_level"]
            )
        ),
        types.FunctionDeclaration(
            name="terminate_interview_early",
            description="Terminates the interview session immediately if candidate exceeds 3 warnings or shows severe integrity violation.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "reason": types.Schema(type="STRING", description="Reason for termination"),
                    "final_remarks": types.Schema(type="STRING", description="Final remarks to candidate")
                },
                required=["reason"]
            )
        ),
        types.FunctionDeclaration(
            name="conclude_interview",
            description="Formally completes the interview session and generates 360-degree multi-dimensional scorecard with strengths, weaknesses, and 24-hour study plan.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "technical_score": types.Schema(type="NUMBER", description="Technical score 0-100"),
                    "speech_voice_score": types.Schema(type="NUMBER", description="Speech and voice score 0-100"),
                    "body_language_score": types.Schema(type="NUMBER", description="Body language score 0-100"),
                    "integrity_score": types.Schema(type="NUMBER", description="Integrity score 0-100"),
                    "hireability_verdict": types.Schema(
                        type="STRING",
                        enum=["Strong Hire", "Hire", "Lean Hire", "Needs More Preparation"]
                    ),
                    "executive_summary": types.Schema(type="STRING", description="2-3 sentence executive summary"),
                    "strengths": types.Schema(type="ARRAY", items=types.Schema(type="STRING")),
                    "weaknesses": types.Schema(type="ARRAY", items=types.Schema(type="STRING")),
                    "actionable_24h_roadmap": types.Schema(type="ARRAY", items=types.Schema(type="STRING"))
                },
                required=["technical_score", "speech_voice_score", "body_language_score", "hireability_verdict", "executive_summary"]
            )
        )
    ]
else:
    INTERVIEWER_LIVE_TOOLS = []


# Sentiment -> score used ONLY when the model did not supply explicit scores.
_SENTIMENT_SCORE = {"positive": 85, "neutral": 70, "concern": 45, "red_flag": 20}
_TECH_CATS = {"technical_depth", "problem_solving"}
_SPEECH_CATS = {"voice_speech", "behavioral"}
_BODY_CATS = {"body_language", "eye_contact"}


class GeminiLiveSession:
    """
    One live, full-duplex interview session bridged to the Gemini Live API.

    Design notes:
      * Upstream audio/video is queued and sent by a dedicated sender task, so the
        browser WebSocket read loop is never blocked by Gemini network I/O and a
        slow video frame can never delay audio (audio has strict priority).
      * The downstream listener loops across turns (``receive()`` ends at every
        ``turn_complete``) and transparently reconnects using Gemini session
        resumption when the Live session is rotated / dropped.
      * Barge-in is handled by Gemini's server-side VAD with
        START_OF_ACTIVITY_INTERRUPTS; the client only has to flush its playback
        buffer when it receives ``interrupted``.
    """

    AUDIO_QUEUE_MAX = 150          # ~3 s of 20 ms frames; oldest dropped on overflow
    MAX_RECONNECTS = 3

    def __init__(
        self,
        user_id: str,
        company: str,
        role: str,
        job_description: str,
        resume_context: str,
        voice_name: str = "Aoede",
        round_type: str = "mixed",
        difficulty: str = "medium",
        send_to_client_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
        send_audio_to_client_callback: Optional[Callable[[bytes], Any]] = None,
        candidate_name: str = "",
    ):
        self.user_id = user_id
        self.company = company
        self.role = role
        self.job_description = job_description
        self.resume_context = resume_context
        self.voice_name = voice_name
        self.round_type = round_type
        self.difficulty = difficulty
        self.candidate_name = candidate_name
        self.send_to_client = send_to_client_callback
        self.send_audio_to_client = send_audio_to_client_callback

        self.session_id = f"mock_{int(time.time())}_{user_id[:6]}"
        self.live_session = None  # google-genai AsyncSession
        self.is_active = False
        self.engine_mode = "gemini_live"  # "gemini_live" or "autonomous_llm"
        self.model_in_use: Optional[str] = None
        self.scratchpad_notes: List[Dict[str, Any]] = []
        self.warnings_count = 0
        self.warnings_history: List[Dict[str, Any]] = []
        self.final_scorecard: Optional[Dict[str, Any]] = None
        self.dialogue_history: List[Dict[str, str]] = []
        self.start_time = time.time()

        self._receive_task: Optional[asyncio.Task] = None
        self._sender_task: Optional[asyncio.Task] = None
        self._client = None
        self._stack: Optional[AsyncExitStack] = None
        self._resume_handle: Optional[str] = None
        self._go_away = False
        self._closing = False
        self._audio_q: "asyncio.Queue[bytes]" = asyncio.Queue(maxsize=self.AUDIO_QUEUE_MAX)
        self._video_slot: Optional[bytes] = None      # latest frame wins
        self._wakeup = asyncio.Event()
        self._scorecard_event = asyncio.Event()
        self._bg_tasks: set = set()

    # ------------------------------------------------------------------ prompt
    def build_system_instruction(self) -> str:
        who = f" The candidate's name is {self.candidate_name}." if self.candidate_name else ""
        return f"""You are an elite, highly experienced Senior Engineering Hiring Lead and Talent Partner at {self.company}, conducting a realistic, live video interview for the role of {self.role}.{who}

INTERVIEW PROTOCOL:
1. Speak naturally with professional, encouraging yet sharp questioning. Use natural conversational speech — you are on a video call.
2. Probe their actual resume projects deeply: architecture, bottlenecks, database trade-offs, and scaling challenges.
3. Challenge them on technical fundamentals and system design with follow-up questions.
4. Assess their behavioral traits (ownership, conflicts, deadlines) using the STAR framework.
5. Continuously observe the candidate through their video feed — monitor speech fluency, body language posture, eye contact, and any suspicious activity. Only record what you actually see or hear.
6. Use update_scratchpad_note regularly (silently — never mention tools aloud) to privately record observations.
7. If you spot suspicious activity (phone visible, reading external notes, frequent gaze shifts, secondary voice, multiple people), use trigger_proctor_warning.
8. After 3 warnings, use terminate_interview_early.
9. Conduct the interview like a real 25-35 minute session. When you have enough signal, use conclude_interview with honest scores.
10. THE CANDIDATE CAN INTERRUPT YOU at any moment. If you are cut off, do not repeat what you already said: acknowledge briefly, listen, and respond to what they actually said.
11. Use brief natural backchannels and fillers sparingly; never monologue for more than 2-4 sentences.

TARGET JOB DETAILS:
Company: {self.company}
Role: {self.role}
Job Description Overview:
{self.job_description[:2000]}

CANDIDATE RESUME / SKILL PROFILE:
{self.resume_context[:4000]}

ROUND TYPE: {self.round_type.upper()} | DIFFICULTY: {self.difficulty.upper()}

IMPORTANT: You are speaking through audio — keep responses conversational, 2-4 sentences per turn. DO NOT output formatted text, markdown, or bullet points. Speak naturally as if in a video call."""

    # ------------------------------------------------------------------ config
    def _model_candidates(self) -> List[str]:
        configured = [m.strip() for m in (settings.GEMINI_LIVE_MODEL or "").split(",") if m.strip()]
        fallbacks = ["gemini-3.8-live", "gemini-2.5-flash-native-audio-latest"]
        seen, out = set(), []
        for m in configured + fallbacks:
            if m not in seen:
                seen.add(m)
                out.append(m)
        return out

    def _build_config(self, minimal: bool = False):
        instruction_text = self.build_system_instruction()
        kwargs: Dict[str, Any] = dict(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice_name)
                )
            ),
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=instruction_text)]
            ),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )
        if not minimal and INTERVIEWER_LIVE_TOOLS:
            try:
                kwargs["tools"] = [types.Tool(function_declarations=INTERVIEWER_LIVE_TOOLS)]
            except Exception as e:
                logger.debug(f"Tools config notice: {e}")

        if not minimal:
            # Human-like turn taking: fast end-of-speech detection + real barge-in.
            try:
                kwargs["realtime_input_config"] = types.RealtimeInputConfig(
                    automatic_activity_detection=types.AutomaticActivityDetection(
                        disabled=False,
                        start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                        end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                        prefix_padding_ms=settings.GEMINI_LIVE_PREFIX_PADDING_MS,
                        silence_duration_ms=settings.GEMINI_LIVE_SILENCE_MS,
                    ),
                    activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
                )
            except Exception as e:
                logger.debug(f"RealtimeInputConfig not available in this SDK version: {e}")
            try:
                kwargs["context_window_compression"] = types.ContextWindowCompressionConfig(
                    sliding_window=types.SlidingWindow()
                )
            except Exception as e:
                logger.debug(f"ContextWindowCompressionConfig not available: {e}")
        return types.LiveConnectConfig(**kwargs)

    async def _open_live_session(self, model_name: str, minimal: bool):
        stack = AsyncExitStack()
        try:
            cfg = self._build_config(minimal=minimal)
            session = await asyncio.wait_for(
                stack.enter_async_context(self._client.aio.live.connect(model=model_name, config=cfg)),
                timeout=settings.GEMINI_LIVE_CONNECT_TIMEOUT,
            )
        except BaseException:
            try:
                await stack.aclose()
            except Exception:
                pass
            raise
        self._stack = stack
        self.live_session = session
        self.model_in_use = model_name
        return session

    def _spawn(self, coro) -> asyncio.Task:
        task = asyncio.create_task(coro)
        self._bg_tasks.add(task)

        def _done(t: asyncio.Task):
            self._bg_tasks.discard(t)
            if not t.cancelled() and t.exception():
                logger.error("Background task failed: %s", t.exception(), exc_info=t.exception())

        task.add_done_callback(_done)
        return task

    # ----------------------------------------------------------------- connect
    async def connect(self):
        """
        Connects to the Gemini Live API. Falls back to the text-only autonomous LLM
        engine only if every candidate model fails. ``engine_mode`` tells the
        client which one it got.
        """
        api_key = settings.GEMINI_API_KEY

        if api_key and HAS_GENAI and genai and types:
            try:
                self._client = genai.Client(
                    api_key=api_key,
                    http_options=types.HttpOptions(api_version="v1alpha"),
                )
            except Exception as e:
                logger.warning(f"Gemini client initialization failed ({e}).")
                self._client = None

            if self._client:
                for model_name in self._model_candidates():
                    for minimal in (False, True):
                        try:
                            logger.info(f"Connecting to Gemini Live ({model_name}, minimal={minimal}) for {self.session_id}...")
                            await self._open_live_session(model_name, minimal)
                            self.is_active = True
                            self.engine_mode = "gemini_live"
                            # Anything buffered before we were connected is stale speech.
                            self._drain_audio_queue()
                            self._video_slot = None
                            self._sender_task = asyncio.create_task(self._sender_loop())
                            self._receive_task = asyncio.create_task(self._listen_gemini_downstream())
                            logger.info(f"✅ Gemini Live connected ({model_name}) for {self.session_id}")
                            self._spawn(self._send_greeting())
                            return
                        except Exception as me:
                            logger.warning(f"Gemini Live {model_name} (minimal={minimal}) failed: {me}")
                            self.live_session = None
                logger.warning("All Gemini Live models failed. Activating Autonomous LLM Engine.")

        self.is_active = True
        self.engine_mode = "autonomous_llm"
        self._drain_audio_queue()
        logger.info(f"Autonomous AI Recruiter Engine active for session {self.session_id}")
        self._spawn(self._send_instant_welcome())

    async def _send_greeting(self):
        name = f" by name ({self.candidate_name})" if self.candidate_name else ""
        text = (
            "[The candidate has just joined the video call with camera and microphone on. "
            f"Greet them warmly{name}, say you're glad to interview them for the {self.role} position at "
            f"{self.company}, and ask them to briefly introduce themselves and describe their most "
            "technically challenging project. Keep it to 2-3 short sentences.]"
        )
        await self.send_text_message(text)

    async def _send_instant_welcome(self):
        """Autonomous-engine opening line."""
        name = f" {self.candidate_name}" if self.candidate_name else ""
        msg = (
            f"Hello{name}! Welcome to your technical interview for the {self.role} position at {self.company}. "
            "I'm glad you're here. Let's start with a quick introduction, and then I'd love to hear about "
            "the most challenging project you've designed and how its core architecture works."
        )
        self.dialogue_history.append({"role": "interviewer", "content": msg})
        if self.send_to_client:
            await self.send_to_client({"type": "output_transcript", "text": msg})
            await self.send_to_client({"type": "turn_complete"})

    # ---------------------------------------------------------------- upstream
    def _drain_audio_queue(self):
        while not self._audio_q.empty():
            try:
                self._audio_q.get_nowait()
            except asyncio.QueueEmpty:
                break

    def push_audio(self, pcm: bytes):
        """Non-blocking enqueue of 16 kHz mono PCM16 from the candidate's mic."""
        if self._closing or self.engine_mode != "gemini_live" or not pcm:
            return
        if self._audio_q.full():
            try:
                self._audio_q.get_nowait()  # drop oldest, keep latency bounded
            except asyncio.QueueEmpty:
                pass
        try:
            self._audio_q.put_nowait(pcm)
        except asyncio.QueueFull:
            return
        self._wakeup.set()

    def push_video(self, jpeg: bytes):
        """Latest-frame-wins slot; video can never queue up behind itself or delay audio."""
        if self._closing or self.engine_mode != "gemini_live" or not jpeg:
            return
        self._video_slot = jpeg
        self._wakeup.set()

    async def send_audio_chunk(self, pcm_base64: str, mime_type: str = "audio/pcm;rate=16000"):
        """Legacy base64 entry point (kept for backward compatibility)."""
        try:
            self.push_audio(base64.b64decode(pcm_base64))
        except Exception as e:
            logger.debug(f"Bad audio chunk: {e}")

    async def send_video_frame(self, jpeg_base64: str):
        """Legacy base64 entry point (kept for backward compatibility)."""
        try:
            self.push_video(base64.b64decode(jpeg_base64))
        except Exception as e:
            logger.debug(f"Bad video frame: {e}")

    async def _sender_loop(self):
        try:
            while not self._closing:
                await self._wakeup.wait()
                self._wakeup.clear()
                while not self._closing:
                    session = self.live_session
                    if session is None:  # reconnecting: pending media is stale
                        self._drain_audio_queue()
                        self._video_slot = None
                        break
                    try:
                        chunk = self._audio_q.get_nowait()
                    except asyncio.QueueEmpty:
                        chunk = None
                    try:
                        if chunk is not None:
                            await session.send_realtime_input(
                                audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                            )
                        elif self._video_slot is not None:
                            frame, self._video_slot = self._video_slot, None
                            await session.send_realtime_input(
                                video=types.Blob(data=frame, mime_type="image/jpeg")
                            )
                        else:
                            break
                    except Exception as e:
                        logger.debug(f"Upstream send notice: {e}")
                        break
        except asyncio.CancelledError:
            pass

    async def end_audio_stream(self):
        """Tell Gemini the mic stream paused (mute) so it flushes cached audio."""
        if self.engine_mode == "gemini_live" and self.live_session:
            try:
                await self.live_session.send_realtime_input(audio_stream_end=True)
            except Exception as e:
                logger.debug(f"audio_stream_end notice: {e}")

    async def send_text_message(self, text: str):
        """Send text (chat / code / system cue) to the interviewer."""
        if not self.is_active and self.engine_mode == "gemini_live" and not self.live_session:
            return
        if self.engine_mode == "gemini_live" and self.live_session:
            try:
                await self.live_session.send_client_content(
                    turns=types.Content(role="user", parts=[types.Part(text=text)]),
                    turn_complete=True,
                )
            except Exception as e:
                logger.debug(f"send_client_content failed ({e}); trying realtime text")
                try:
                    await self.live_session.send_realtime_input(text=text)
                except Exception as e2:
                    logger.debug(f"Text send notice: {e2}")
        elif self.engine_mode == "autonomous_llm":
            await self._trigger_autonomous_turn(text)

    async def handle_client_interrupt(self):
        """
        Barge-in is detected by Gemini's server-side VAD from the *continuous* mic
        stream (activity_handling=START_OF_ACTIVITY_INTERRUPTS). Nothing to inject here;
        the previous implementation sent 20 ms of silence which does not interrupt anything.
        """
        logger.debug("Client-side barge-in hint received (server VAD is authoritative).")

    # -------------------------------------------------------------- downstream
    async def _emit_audio(self, pcm: bytes, mime: str):
        if self.send_audio_to_client:
            await self.send_audio_to_client(pcm)
        elif self.send_to_client:
            await self.send_to_client({
                "type": "audio",
                "data": base64.b64encode(pcm).decode("ascii"),
                "mimeType": mime or "audio/pcm;rate=24000",
            })

    @staticmethod
    def _transcript_text(server_content, *names) -> Optional[str]:
        for n in names:
            obj = getattr(server_content, n, None)
            if obj:
                t = getattr(obj, "text", None)
                if t:
                    return t
        return None

    async def _handle_response(self, response):
        # ---- session bookkeeping
        upd = getattr(response, "session_resumption_update", None)
        if upd and getattr(upd, "resumable", False) and getattr(upd, "new_handle", None):
            self._resume_handle = upd.new_handle
        if getattr(response, "go_away", None):
            logger.info("Gemini GoAway received; will resume on next turn boundary.")
            self._go_away = True

        sc = response.server_content
        if sc:
            if sc.interrupted:
                # Flush marker. The server stops generating *before* this message, so every
                # audio frame after it belongs to the next turn - no client-side discard flag needed.
                if self.send_to_client:
                    await self.send_to_client({"type": "interrupted"})

            mt = sc.model_turn
            if mt and mt.parts:
                for part in mt.parts:
                    inline = getattr(part, "inline_data", None)
                    if inline and inline.data:
                        await self._emit_audio(inline.data, inline.mime_type or "audio/pcm;rate=24000")
                    # NOTE: part.text on native-audio models can be model "thoughts"; captions come
                    # from output_transcription below, so text parts are intentionally not forwarded
                    # (forwarding both duplicated every caption).

            out_text = self._transcript_text(sc, "output_transcription", "output_audio_transcription")
            if out_text and self.send_to_client:
                await self.send_to_client({"type": "output_transcript", "text": out_text})

            in_text = self._transcript_text(sc, "input_transcription", "input_audio_transcription")
            if in_text and self.send_to_client:
                await self.send_to_client({"type": "input_transcript", "text": in_text})

            if sc.turn_complete and self.send_to_client:
                await self.send_to_client({"type": "turn_complete"})

        tc = response.tool_call
        if tc and tc.function_calls:
            responses = []
            for fc in tc.function_calls:
                args = dict(fc.args) if fc.args else {}
                try:
                    payload = await self._handle_tool_call(fc.name, args)
                except Exception as e:
                    logger.error(f"Tool {fc.name} failed: {e}", exc_info=True)
                    payload = {"status": "error", "message": str(e)}
                responses.append(types.FunctionResponse(id=fc.id, name=fc.name, response=payload))
            if self.live_session and not self._closing:
                await self.live_session.send_tool_response(function_responses=responses)

    async def _listen_gemini_downstream(self):
        """
        ``AsyncSession.receive()`` yields ONE model turn and then ends. The old code ran a single
        ``async for`` and so stopped listening after the interviewer's first reply
        (is_active -> False, no more audio/transcripts/tools). We loop across turns here.
        """
        empty_passes = 0
        reconnects = 0
        try:
            while not self._closing:
                try:
                    got_any = False
                    async for response in self.live_session.receive():
                        got_any = True
                        await self._handle_response(response)
                    if self._go_away and not self._closing:
                        self._go_away = False
                        if not await self._reconnect():
                            break
                        continue
                    if got_any:
                        empty_passes = 0
                    else:
                        empty_passes += 1
                        await asyncio.sleep(0.05)
                        if empty_passes >= 20:  # socket silently closed
                            raise ConnectionError("Gemini Live stream ended")
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    if self._closing:
                        break
                    logger.warning(f"Gemini Live stream error: {e}")
                    reconnects += 1
                    if reconnects > self.MAX_RECONNECTS or not await self._reconnect():
                        break
                    empty_passes = 0
        except asyncio.CancelledError:
            pass
        finally:
            if not self._closing and self.engine_mode == "gemini_live":
                self.is_active = False
                logger.info(f"Gemini Live listener ended for session {self.session_id}")
                if self.send_to_client:
                    try:
                        await self.send_to_client({
                            "type": "error",
                            "message": "The live interviewer connection was lost. Please rejoin the call.",
                        })
                    except Exception:
                        pass

    async def _reconnect(self) -> bool:
        if self._closing or not self._client or not self.model_in_use:
            return False
        if self.send_to_client:
            await self.send_to_client({"type": "status", "message": "Reconnecting to interviewer..."})
        old_stack, self._stack, self.live_session = self._stack, None, None
        if old_stack:
            try:
                await old_stack.aclose()
            except Exception:
                pass
        for attempt in range(1, self.MAX_RECONNECTS + 1):
            if self._closing:
                return False
            for minimal in (False, True):
                try:
                    await self._open_live_session(self.model_in_use, minimal)
                    logger.info(f"Gemini Live resumed (attempt {attempt}, resume_handle={'yes' if self._resume_handle else 'no'})")
                    if self.send_to_client:
                        await self.send_to_client({"type": "status", "message": "Reconnected"})
                    return True
                except Exception as e:
                    logger.warning(f"Reconnect attempt {attempt} (minimal={minimal}) failed: {e}")
            await asyncio.sleep(0.4 * attempt)
        return False

    # -------------------------------------------------------------- autonomous
    async def _trigger_autonomous_turn(self, user_input: str):
        """
        Fallback: text-only recruiter turn via the standard LLM (browser TTS speaks it).
        """
        self.dialogue_history.append({"role": "candidate", "content": user_input})
        history_snippet = "\n".join([f"{d['role'].upper()}: {d['content']}" for d in self.dialogue_history[-6:]])

        system_prompt = f"""{self.build_system_instruction()}

You must output a strictly valid JSON response with this schema:
{{
  "spoken_response": "What you speak out loud to the candidate next. Concise, natural, conversational (2-4 sentences max).",
  "scratchpad_note": {{
    "category": "technical_depth / voice_speech / body_language / behavioral",
    "observation": "Objective note regarding what the candidate said",
    "sentiment": "positive / neutral / concern",
    "confidence_score": 8.5
  }},
  "proctor_check": {{
    "is_suspicious": false,
    "violation_type": "",
    "warning_message": ""
  }}
}}"""

        user_prompt = f"Candidate Input / Event:\n{user_input}\n\nRecent Dialogue:\n{history_snippet}"

        try:
            res = await llm_service.chat_json(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.3)
            if res and isinstance(res, dict) and res.get("spoken_response"):
                spoken_text = res["spoken_response"]
                self.dialogue_history.append({"role": "interviewer", "content": spoken_text})

                if self.send_to_client:
                    await self.send_to_client({"type": "output_transcript", "text": spoken_text})
                    await self.send_to_client({"type": "turn_complete"})

                note_data = res.get("scratchpad_note")
                if note_data and note_data.get("observation"):
                    await self._handle_tool_call("update_scratchpad_note", note_data)

                proctor = res.get("proctor_check")
                if proctor and proctor.get("is_suspicious"):
                    await self._handle_tool_call("trigger_proctor_warning", {
                        "violation_type": proctor.get("violation_type", "frequent_gaze_shift"),
                        "warning_message": proctor.get("warning_message", "Please look directly at the screen."),
                        "warning_level": self.warnings_count + 1,
                    })
                return
        except Exception as e:
            logger.error(f"Error in autonomous turn: {e}")

        fallback_msg = "Thanks for sharing that. Could you walk me through the core architecture and the main trade-offs you made?"
        if self.send_to_client:
            await self.send_to_client({"type": "output_transcript", "text": fallback_msg})
            await self.send_to_client({"type": "turn_complete"})

    # ------------------------------------------------------------------- tools
    def _derive_scores(self) -> Dict[str, Optional[float]]:
        def avg(cats):
            vals = [_SENTIMENT_SCORE.get(n.get("sentiment", "neutral"), 70)
                    for n in self.scratchpad_notes if n.get("category") in cats]
            return round(sum(vals) / len(vals)) if vals else None
        return {
            "technical_score": avg(_TECH_CATS),
            "speech_voice_score": avg(_SPEECH_CATS),
            "body_language_score": avg(_BODY_CATS),
            "integrity_score": max(0, 100 - self.warnings_count * 15),
        }

    @staticmethod
    def _verdict_from(score: Optional[float], dimensions: int = 3) -> str:
        if score is None or dimensions < 2:
            return "Insufficient Data"  # never invent a hire/no-hire call from <2 observed dimensions
        if score >= 85:
            return "Strong Hire"
        if score >= 72:
            return "Hire"
        if score >= 60:
            return "Lean Hire"
        return "Needs More Preparation"

    async def request_conclusion(self, timeout: float = 8.0) -> Optional[Dict[str, Any]]:
        """Ask the interviewer to score honestly; if it doesn't in time, derive from its own notes."""
        if self.final_scorecard:
            return self.final_scorecard
        if self.engine_mode == "gemini_live" and self.live_session:
            await self.send_text_message(
                "[The candidate has ended the interview. Call conclude_interview now with honest scores "
                "based only on what you observed. Do not speak a long goodbye.]"
            )
            try:
                await asyncio.wait_for(self._scorecard_event.wait(), timeout)
            except asyncio.TimeoutError:
                logger.info("Model did not conclude in time; deriving scorecard from notes.")
        if not self.final_scorecard:
            await self._handle_tool_call("conclude_interview", {})
        return self.final_scorecard

    async def _handle_tool_call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        timestamp = time.strftime("%H:%M:%S")

        if name == "update_scratchpad_note":
            note_item = {
                "id": str(len(self.scratchpad_notes) + 1),
                "timestamp": timestamp,
                "category": args.get("category", "general"),
                "observation": args.get("observation", ""),
                "sentiment": args.get("sentiment", "neutral"),
                "confidence_score": args.get("confidence_score"),
            }
            self.scratchpad_notes.append(note_item)
            if self.send_to_client:
                await self.send_to_client({"type": "scratchpad_updated", "note": note_item, "all_notes": self.scratchpad_notes})
            return {"status": "recorded"}

        elif name == "trigger_proctor_warning":
            self.warnings_count += 1
            warning_item = {
                "warning_number": self.warnings_count,
                "violation_type": args.get("violation_type", "frequent_gaze_shift"),
                "warning_message": args.get("warning_message", "Please look directly into the camera."),
                "warning_level": args.get("warning_level", self.warnings_count),
                "timestamp": timestamp,
            }
            self.warnings_history.append(warning_item)
            if self.send_to_client:
                await self.send_to_client({"type": "proctor_warning", "warning": warning_item, "total_warnings": self.warnings_count})
            return {"status": "warning_issued"}

        elif name == "terminate_interview_early":
            reason = args.get("reason", "Excessive proctoring violations")
            remarks = args.get("final_remarks", "The session has been concluded due to multiple integrity warnings.")
            if self.send_to_client:
                await self.send_to_client({"type": "interview_terminated", "reason": reason, "final_remarks": remarks})
            # close() cancels the listener task we are running in; run it detached.
            self._spawn(self.close())
            return {"status": "terminated"}

        elif name == "conclude_interview":
            duration_minutes = round((time.time() - self.start_time) / 60, 1)
            derived = self._derive_scores()

            def pick(key):
                v = args.get(key)
                return v if v is not None else derived.get(key)

            tech, voice, body = pick("technical_score"), pick("speech_voice_score"), pick("body_language_score")
            integrity = args.get("integrity_score")
            if integrity is None:
                integrity = derived["integrity_score"]
            known = [s for s in (tech, voice, body) if s is not None]
            overall = sum(known) / len(known) if known else None
            estimated = any(args.get(k) is None for k in ("technical_score", "speech_voice_score", "body_language_score"))

            scorecard = {
                "session_id": self.session_id,
                "company": self.company,
                "role": self.role,
                "duration_minutes": max(1.0, duration_minutes),
                "technical_score": tech,
                "speech_voice_score": voice,
                "body_language_score": body,
                "integrity_score": integrity,
                "hireability_verdict": args.get("hireability_verdict") or self._verdict_from(overall, len(known)),
                "executive_summary": args.get("executive_summary") or (
                    f"Interview for {self.role} at {self.company} ended after {max(1.0, duration_minutes)} min. "
                    "Scores are estimated from the interviewer's live notes."
                ),
                "strengths": args.get("strengths") or [],
                "weaknesses": args.get("weaknesses") or [],
                "actionable_24h_roadmap": args.get("actionable_24h_roadmap") or [],
                "scratchpad_notes": self.scratchpad_notes,
                "warnings_count": self.warnings_count,
                "scores_estimated": estimated,
            }
            self.final_scorecard = scorecard
            self._scorecard_event.set()
            self._spawn(self._persist_session_to_graph(scorecard))
            if self.send_to_client:
                await self.send_to_client({"type": "interview_concluded", "scorecard": scorecard})
            return {"status": "concluded_and_saved"}

        return {"status": "unknown"}

    async def _persist_session_to_graph(self, scorecard: Dict[str, Any]):
        def num(v):
            return float(v) if v is not None else 0.0
        try:
            query = """
            MATCH (u:User {id: $user_id})
            CREATE (s:InterviewSession {
                id: $session_id,
                company: $company,
                role: $role,
                technical_score: $tech_score,
                speech_voice_score: $voice_score,
                body_language_score: $body_score,
                integrity_score: $integrity_score,
                verdict: $verdict,
                summary: $summary,
                completed_at: datetime(),
                duration_minutes: $duration
            })
            CREATE (u)-[:ATTENDED_INTERVIEW]->(s)
            RETURN s.id
            """
            await neo4j_service.run_query(
                query,
                user_id=self.user_id,
                session_id=scorecard["session_id"],
                company=scorecard["company"],
                role=scorecard["role"],
                tech_score=num(scorecard["technical_score"]),
                voice_score=num(scorecard["speech_voice_score"]),
                body_score=num(scorecard["body_language_score"]),
                integrity_score=num(scorecard["integrity_score"]),
                verdict=scorecard["hireability_verdict"],
                summary=scorecard["executive_summary"],
                duration=num(scorecard["duration_minutes"]),
            )
            logger.info(f"Persisted live interview session {self.session_id} to Neo4j graph")
        except Exception as e:
            logger.debug(f"Neo4j save notice: {e}")

    async def close(self):
        if self._closing:
            return
        self._closing = True
        self.is_active = False
        self._wakeup.set()
        current = asyncio.current_task()
        for t in (self._sender_task, self._receive_task, *list(self._bg_tasks)):
            if t and t is not current and not t.done():
                t.cancel()
        stack, self._stack, self.live_session = self._stack, None, None
        if stack:
            try:
                await asyncio.wait_for(stack.aclose(), timeout=2.0)
            except Exception:
                pass
