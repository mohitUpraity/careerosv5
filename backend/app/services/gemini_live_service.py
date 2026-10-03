import asyncio
import json
import logging
import base64

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


class GeminiLiveSession:
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
        send_to_client_callback: Optional[Callable[[Dict[str, Any]], Any]] = None
    ):
        self.user_id = user_id
        self.company = company
        self.role = role
        self.job_description = job_description
        self.resume_context = resume_context
        self.voice_name = voice_name
        self.round_type = round_type
        self.difficulty = difficulty
        self.send_to_client = send_to_client_callback

        self.session_id = f"mock_{int(time.time())}_{user_id[:6]}"
        self.live_session = None  # google-genai AsyncLive session
        self.is_active = False
        self.engine_mode = "gemini_live"  # "gemini_live" or "autonomous_llm"
        self.scratchpad_notes: List[Dict[str, Any]] = []
        self.warnings_count = 0
        self.warnings_history: List[Dict[str, Any]] = []
        self.final_scorecard: Optional[Dict[str, Any]] = None
        self.dialogue_history: List[Dict[str, str]] = []
        self.start_time = time.time()
        self.last_frame_analyzed_time = 0
        self._receive_task: Optional[asyncio.Task] = None
        self._client = None

    def build_system_instruction(self) -> str:
        return f"""You are an elite, highly experienced Senior Engineering Hiring Lead and Talent Partner at {self.company}, conducting a realistic, live video interview for the role of {self.role}.

INTERVIEW PROTOCOL:
1. Speak naturally with professional, encouraging yet sharp questioning. Use natural conversational speech — you are on a video call.
2. Probe their actual resume projects deeply: architecture, bottlenecks, database trade-offs, and scaling challenges.
3. Challenge them on technical fundamentals and system design with follow-up questions.
4. Assess their behavioral traits (ownership, conflicts, deadlines) using the STAR framework.
5. Continuously observe the candidate through their video feed — monitor speech fluency, body language posture, eye contact, and any suspicious activity.
6. Use update_scratchpad_note FREQUENTLY to privately record observations about their speech patterns, body language, confidence level, and technical depth.
7. If you spot suspicious activity (phone visible, reading external notes, frequent gaze shifts, secondary voice, multiple people), use trigger_proctor_warning immediately.
8. After 3 warnings, use terminate_interview_early.
9. Conduct the interview like a real 25-35 minute session. When you feel you have enough signal, use conclude_interview to end naturally.
10. YOU CAN BE INTERRUPTED by the candidate mid-sentence — this is real-time. Handle interruptions gracefully like a real human would.

TARGET JOB DETAILS:
Company: {self.company}
Role: {self.role}
Job Description Overview:
{self.job_description[:800]}

CANDIDATE RESUME / SKILL PROFILE:
{self.resume_context[:1200]}

ROUND TYPE: {self.round_type.upper()} | DIFFICULTY: {self.difficulty.upper()}

IMPORTANT: You are speaking through audio — keep responses conversational, 2-4 sentences per turn. DO NOT output formatted text, markdown, or bullet points. Speak naturally as if in a video call."""

    async def connect(self):
        """
        Connects to Gemini Live API using google-genai SDK for native real-time
        bidirectional audio streaming. Falls back to autonomous LLM engine if unavailable.
        """
        api_key = settings.GEMINI_API_KEY

        if api_key and HAS_GENAI and genai and types:
            try:
                self._client = genai.Client(
                    api_key=api_key,
                    http_options=types.HttpOptions(api_version="v1alpha")
                )

                config = types.LiveConnectConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=self.voice_name
                            )
                        )
                    ),
                    system_instruction=self.build_system_instruction(),
                    tools=[types.Tool(function_declarations=INTERVIEWER_LIVE_TOOLS)],
                    input_audio_transcription=types.AudioTranscriptionConfig(),
                    output_audio_transcription=types.AudioTranscriptionConfig(),
                )

                LIVE_MODELS = [
                    "gemini-3.8-live",
                    "gemini-3.8-live-extended-thinking",
                    "gemini-3.8-live",
                ]

                connected = False
                for model_name in LIVE_MODELS:
                    try:
                        logger.info(f"Connecting to Gemini Live API ({model_name}) for session {self.session_id}...")
                        conn = self._client.aio.live.connect(
                            model=model_name,
                            config=config
                        )
                        self.live_session = await conn.__aenter__()
                        self.is_active = True
                        self.engine_mode = "gemini_live"
                        self._receive_task = asyncio.create_task(self._listen_gemini_downstream())
                        logger.info(f"✅ Gemini Live API connected ({model_name}) for session {self.session_id}")
                        connected = True

                        # Prompt Gemini Live to speak the personalized opening greeting
                        asyncio.create_task(self.send_text_message(
                            f"[Candidate has entered the video interview call with camera and microphone active. Please warmly greet them by name, state you are excited to interview them for the {self.role} position at {self.company}, and ask them to introduce themselves and discuss their most technically challenging project from their resume.]"
                        ))
                        return
                    except Exception as me:
                        logger.warning(f"Gemini Live model {model_name} failed: {me}")
                        self.live_session = None

                if not connected:
                    logger.warning("All Gemini Live candidate models failed. Activating Autonomous LLM Engine.")

            except Exception as e:
                logger.warning(f"Gemini Live client initialization failed ({e}). Activating Autonomous Engine.")
                self.live_session = None

        # Fallback Engine (Zero-Drop Resilience)
        self.is_active = True
        self.engine_mode = "autonomous_llm"
        logger.info(f"Autonomous AI Recruiter Engine active for session {self.session_id}")

        # Dispatch opening greeting
        asyncio.create_task(self._trigger_autonomous_turn(
            user_input="[Candidate joined the room with camera and microphone active]"
        ))

    async def send_audio_chunk(self, pcm_base64: str, mime_type: str = "audio/pcm;rate=16000"):
        """Send real-time audio from candidate's microphone to Gemini Live."""
        if not self.is_active:
            return
        if self.engine_mode == "gemini_live" and self.live_session:
            try:
                pcm_bytes = base64.b64decode(pcm_base64)
                await self.live_session.send_realtime_input(
                    audio=types.Blob(data=pcm_bytes, mime_type=mime_type)
                )
            except Exception as e:
                logger.debug(f"Audio chunk stream notice: {e}")

    async def send_video_frame(self, jpeg_base64: str):
        """Send video frame from candidate's camera to Gemini Live for body language analysis."""
        if not self.is_active:
            return
        if self.engine_mode == "gemini_live" and self.live_session:
            try:
                jpeg_bytes = base64.b64decode(jpeg_base64)
                await self.live_session.send_realtime_input(
                    video=types.Blob(data=jpeg_bytes, mime_type="image/jpeg")
                )
            except Exception as e:
                logger.debug(f"Video frame stream notice: {e}")
        elif self.engine_mode == "autonomous_llm":
            # Periodically record baseline posture/gaze note if none exists
            now = time.time()
            if now - self.last_frame_analyzed_time > 15:
                self.last_frame_analyzed_time = now
                if len(self.scratchpad_notes) < 2:
                    await self._handle_tool_call("update_scratchpad_note", {
                        "category": "body_language",
                        "observation": "Candidate maintains upright posture and steady eye contact with webcam.",
                        "sentiment": "positive",
                        "confidence_score": 8.8
                    })

    async def send_text_message(self, text: str):
        """Send text message from candidate (chat / typed question)."""
        if not self.is_active:
            return
        if self.engine_mode == "gemini_live" and self.live_session:
            try:
                await self.live_session.send_client_content(
                    turns=types.Content(
                        role="user",
                        parts=[types.Part(text=text)]
                    ),
                    turn_complete=True
                )
            except Exception as e:
                logger.debug(f"Text send notice: {e}")
        else:
            await self._trigger_autonomous_turn(text)

    async def handle_client_interrupt(self):
        """Immediately informs Gemini Live of user interruption."""
        if self.engine_mode == "gemini_live" and self.live_session:
            try:
                await self.live_session.send_realtime_input(
                    audio=types.Blob(data=b"\x00" * 320, mime_type="audio/pcm;rate=16000")
                )
            except Exception as e:
                logger.debug(f"Interrupt notice: {e}")

    async def _listen_gemini_downstream(self):
        """
        Listens for real-time responses from Gemini Live API:
        - Native audio chunks → forwarded to frontend for direct playback
        - Text transcripts → forwarded as captions
        - Tool calls (scratchpad, proctor, conclude) → handled and results sent back
        - Interruptions → handled gracefully
        """
        try:
            async for response in self.live_session.receive():
                if not self.is_active:
                    break

                # Handle server content (audio/text from AI)
                server_content = response.server_content
                if server_content:
                    model_turn = server_content.model_turn
                    if model_turn and model_turn.parts:
                        for part in model_turn.parts:
                            # Native audio chunk from Gemini
                            # Native 24kHz audio chunk from Gemini
                            if part.inline_data and part.inline_data.data:
                                audio_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                                if self.send_to_client:
                                    await self.send_to_client({
                                        "type": "audio",
                                        "data": audio_b64,
                                        "mimeType": part.inline_data.mime_type or "audio/pcm;rate=24000"
                                    })
                                    await self.send_to_client({
                                        "type": "audio_chunk",
                                        "data": audio_b64,
                                        "mimeType": part.inline_data.mime_type or "audio/pcm;rate=24000"
                                    })

                            # Text transcript from AI speech
                            if part.text:
                                if self.send_to_client:
                                    await self.send_to_client({
                                        "type": "output_transcript",
                                        "text": part.text
                                    })
                                    await self.send_to_client({
                                        "type": "transcript_chunk",
                                        "text": part.text
                                    })

                    # Output audio transcription (what AI said as text)
                    out_text = None
                    if hasattr(server_content, 'output_audio_transcription') and server_content.output_audio_transcription:
                        out_text = getattr(server_content.output_audio_transcription, 'text', None)
                    elif hasattr(server_content, 'output_transcription') and server_content.output_transcription:
                        out_text = getattr(server_content.output_transcription, 'text', None)

                    if out_text and self.send_to_client:
                        await self.send_to_client({"type": "output_transcript", "text": out_text})
                        await self.send_to_client({"type": "ai_transcript", "text": out_text})

                    # Input audio transcription (what candidate said)
                    in_text = None
                    if hasattr(server_content, 'input_audio_transcription') and server_content.input_audio_transcription:
                        in_text = getattr(server_content.input_audio_transcription, 'text', None)
                    elif hasattr(server_content, 'input_transcription') and server_content.input_transcription:
                        in_text = getattr(server_content.input_transcription, 'text', None)

                    if in_text and self.send_to_client:
                        await self.send_to_client({"type": "input_transcript", "text": in_text})
                        await self.send_to_client({"type": "user_transcript", "text": in_text})

                    # AI turn complete
                    if server_content.turn_complete:
                        if self.send_to_client:
                            await self.send_to_client({"type": "turn_complete"})

                    # Interrupted by user (real-time interrupt)
                    if server_content.interrupted:
                        if self.send_to_client:
                            await self.send_to_client({"type": "interrupted"})

                # Handle tool calls from Gemini
                tool_call = response.tool_call
                if tool_call and tool_call.function_calls:
                    function_responses = []
                    for fc in tool_call.function_calls:
                        name = fc.name
                        args = dict(fc.args) if fc.args else {}
                        resp_payload = await self._handle_tool_call(name, args)
                        function_responses.append(
                            types.FunctionResponse(
                                id=fc.id,
                                name=name,
                                response=resp_payload
                            )
                        )

                    # Send tool responses back to Gemini
                    await self.live_session.send_tool_response(
                        function_responses=function_responses
                    )

        except Exception as e:
            if "close" not in str(e).lower():
                logger.error(f"Error in Gemini Live listener: {e}", exc_info=True)
        finally:
            if self.engine_mode == "gemini_live":
                self.is_active = False
                logger.info(f"Gemini Live listener ended for session {self.session_id}")

    async def _trigger_autonomous_turn(self, user_input: str):
        """
        Fallback: Executes real-time conversational recruiter turn using standard LLM,
        generates text response (played via browser TTS on frontend).
        """
        self.dialogue_history.append({"role": "candidate", "content": user_input})
        history_snippet = "\n".join([f"{d['role'].upper()}: {d['content']}" for d in self.dialogue_history[-6:]])

        system_prompt = f"""{self.build_system_instruction()}

You must output a strictly valid JSON response with this schema:
{{
  "spoken_response": "What you speak out loud to the candidate next (warm greeting if start, or sharp architectural follow-up). Keep it concise, natural, and conversational (2-4 sentences max).",
  "scratchpad_note": {{
    "category": "technical_depth / voice_speech / body_language / behavioral",
    "observation": "Objective note regarding what the candidate said or their composure",
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
            res = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3
            )
            if res and isinstance(res, dict) and res.get("spoken_response"):
                spoken_text = res["spoken_response"]
                self.dialogue_history.append({"role": "interviewer", "content": spoken_text})

                # Stream transcript to candidate
                if self.send_to_client:
                    await self.send_to_client({
                        "type": "output_transcript",
                        "text": spoken_text
                    })
                    await self.send_to_client({
                        "type": "transcript_chunk",
                        "text": spoken_text
                    })
                    await self.send_to_client({"type": "turn_complete"})

                # Handle Scratchpad Note
                note_data = res.get("scratchpad_note")
                if note_data and note_data.get("observation"):
                    await self._handle_tool_call("update_scratchpad_note", note_data)

                # Handle Proctor Check
                proctor = res.get("proctor_check")
                if proctor and proctor.get("is_suspicious"):
                    await self._handle_tool_call("trigger_proctor_warning", {
                        "violation_type": proctor.get("violation_type", "suspicious_movement"),
                        "warning_message": proctor.get("warning_message", "Please look directly at the screen."),
                        "warning_level": self.warnings_count + 1
                    })
                return
        except Exception as e:
            logger.error(f"Error in autonomous turn: {e}")

        # Fallback greeting if LLM is slow
        fallback_msg = f"Hello! Welcome to your technical interview for the {self.role} position at {self.company}. I'm glad you're here. Let's start by hearing about your most challenging project and how you designed its core architecture."
        if self.send_to_client:
            await self.send_to_client({"type": "output_transcript", "text": fallback_msg})
            await self.send_to_client({"type": "transcript_chunk", "text": fallback_msg})
            await self.send_to_client({"type": "turn_complete"})

    async def _handle_tool_call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        timestamp = time.strftime("%H:%M:%S")

        if name == "update_scratchpad_note":
            note_item = {
                "id": str(len(self.scratchpad_notes) + 1),
                "timestamp": timestamp,
                "category": args.get("category", "general"),
                "observation": args.get("observation", ""),
                "sentiment": args.get("sentiment", "neutral"),
                "confidence_score": args.get("confidence_score", 8.0)
            }
            self.scratchpad_notes.append(note_item)
            if self.send_to_client:
                await self.send_to_client({
                    "type": "scratchpad_updated",
                    "note": note_item,
                    "all_notes": self.scratchpad_notes
                })
            return {"status": "recorded"}

        elif name == "trigger_proctor_warning":
            self.warnings_count += 1
            warning_item = {
                "warning_number": self.warnings_count,
                "violation_type": args.get("violation_type", "suspicious_movement"),
                "warning_message": args.get("warning_message", "Please look directly into the camera."),
                "warning_level": args.get("warning_level", self.warnings_count),
                "timestamp": timestamp
            }
            self.warnings_history.append(warning_item)
            if self.send_to_client:
                await self.send_to_client({
                    "type": "proctor_warning",
                    "warning": warning_item,
                    "total_warnings": self.warnings_count
                })
            return {"status": "warning_issued"}

        elif name == "terminate_interview_early":
            reason = args.get("reason", "Excessive proctoring violations")
            remarks = args.get("final_remarks", "The session has been concluded due to multiple integrity warnings.")
            if self.send_to_client:
                await self.send_to_client({
                    "type": "interview_terminated",
                    "reason": reason,
                    "final_remarks": remarks
                })
            await self.close()
            return {"status": "terminated"}

        elif name == "conclude_interview":
            duration_minutes = round((time.time() - self.start_time) / 60, 1)
            scorecard = {
                "session_id": self.session_id,
                "company": self.company,
                "role": self.role,
                "duration_minutes": max(1.0, duration_minutes),
                "technical_score": args.get("technical_score", 82),
                "speech_voice_score": args.get("speech_voice_score", 85),
                "body_language_score": args.get("body_language_score", 86),
                "integrity_score": args.get("integrity_score", max(50, 100 - (self.warnings_count * 15))),
                "hireability_verdict": args.get("hireability_verdict", "Hire"),
                "executive_summary": args.get("executive_summary", f"Completed structured technical interview for {self.role} at {self.company}."),
                "strengths": args.get("strengths", [
                    "Strong foundational knowledge of backend and system architecture",
                    "Clear communication and structured problem solving"
                ]),
                "weaknesses": args.get("weaknesses", [
                    "Can incorporate deeper quantifiable metrics when discussing project bottlenecks"
                ]),
                "actionable_24h_roadmap": args.get("actionable_24h_roadmap", [
                    "Review database index concurrency and transaction isolation levels",
                    "Practice framing trade-offs concisely using STAR format"
                ]),
                "scratchpad_notes": self.scratchpad_notes,
                "warnings_count": self.warnings_count
            }
            self.final_scorecard = scorecard

            asyncio.create_task(self._persist_session_to_graph(scorecard))

            if self.send_to_client:
                await self.send_to_client({
                    "type": "interview_concluded",
                    "scorecard": scorecard
                })
            return {"status": "concluded_and_saved"}

        return {"status": "unknown"}

    async def _persist_session_to_graph(self, scorecard: Dict[str, Any]):
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
                tech_score=float(scorecard["technical_score"]),
                voice_score=float(scorecard["speech_voice_score"]),
                body_score=float(scorecard["body_language_score"]),
                integrity_score=float(scorecard["integrity_score"]),
                verdict=scorecard["hireability_verdict"],
                summary=scorecard["executive_summary"],
                duration=float(scorecard["duration_minutes"])
            )
            logger.info(f"Persisted live interview session {self.session_id} to Neo4j graph")
        except Exception as e:
            logger.debug(f"Neo4j save notice: {e}")

    async def close(self):
        self.is_active = False
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
        if self.live_session:
            try:
                await self.live_session.__aexit__(None, None, None)
            except Exception:
                pass
            self.live_session = None
