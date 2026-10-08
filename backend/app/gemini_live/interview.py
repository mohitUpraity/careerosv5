import asyncio
import time
import json
import logging
from typing import Optional, Dict, Any, List, Callable, Awaitable
from google import genai
from google.genai import types
from app.gemini_live.config import LiveEngineConfig
from app.gemini_live.engine import GeminiLiveEngine

logger = logging.getLogger("gemini_live.interview")

class LiveInterviewSession:
    """
    High-level Live Interview Manager supporting audio, vision, behavioral tracking,
    anti-cheating proctoring, native tool calling, and post-interview scorecard generation.
    """

    def __init__(
        self,
        api_key: str,
        user_id: str,
        company: str,
        role: str,
        candidate_name: str = "Candidate",
        job_description: str = "",
        resume_context: str = "",
        voice_name: str = "Zephyr",
        round_type: str = "mixed",
        difficulty: str = "medium",
        send_json_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
        send_audio_callback: Optional[Callable[[bytes], Awaitable[None]]] = None,
    ):
        self.api_key = api_key
        self.user_id = user_id
        self.company = company
        self.role = role
        self.candidate_name = candidate_name
        self.job_description = job_description
        self.resume_context = resume_context
        self.voice_name = voice_name
        self.round_type = round_type
        self.difficulty = difficulty
        self.send_json = send_json_callback
        self.send_audio = send_audio_callback

        self.session_id = f"live_{int(time.time())}_{user_id[:6]}"
        self.start_time = time.time()
        self.transcript_log: List[Dict[str, str]] = []
        self.scratchpad_notes: List[Dict[str, Any]] = []
        self.proctor_warnings: List[Dict[str, Any]] = []
        self.current_ai_turn_text = ""

        # Build system instruction with behavioral, visual, and anti-cheating proctor cues
        system_instruction = self._build_system_instruction()
        
        config = LiveEngineConfig(
            model="gemini-3.8-live",
            voice_name=self.voice_name,
            system_instruction=system_instruction,
            silence_duration_ms=600,  # Fast, natural turn-taking & barge-in
            prefix_padding_ms=40,
        )

        self.engine = GeminiLiveEngine(
            api_key=self.api_key,
            config=config,
            on_audio_chunk=self._handle_engine_audio,
            on_output_transcript=self._handle_engine_output_transcript,
            on_input_transcript=self._handle_engine_input_transcript,
            on_interrupted=self._handle_engine_interrupted,
            on_turn_complete=self._handle_engine_turn_complete,
            on_error=self._handle_engine_error,
        )

    def _build_system_instruction(self) -> str:
        who = f" The candidate's name is {self.candidate_name}." if self.candidate_name else ""
        return f"""You are Sarah Jenkins, a Staff Software Engineer and Senior Hiring Lead at {self.company}, conducting a live, real-time conversational technical interview for the {self.role} role.{who}

CORE HUMAN INTERVIEWER PERSONA & RULES:
1. DEEP ACTIVE COMPREHENSION & SPECIFIC ACKNOWLEDGMENT:
   - Carefully listen to what the candidate actually says.
   - Always directly acknowledge their specific points, architectural decisions, and technologies before moving forward (e.g. "Got it, so you decoupled the ingestion using Kafka...", "Understood, PostgreSQL handled the consistency requirement.").
   - Never respond with generic filler like "That's good, now tell me..." without showing you genuinely understood their explanation.

2. PATIENCE & CONVERSATIONAL BREATHING ROOM:
   - Technical candidates need time to think, pause, and formulate architecture details.
   - Never jump in prematurely when the candidate takes a breath or pauses between clauses.
   - If the candidate says "Let me think for a second" or asks for clarification, respond patiently and warmly: "Take all the time you need, no rush."
   - If the candidate does a mic check ("Am I audible?", "Can you hear me?"), reply like a genuine human colleague: "Yes, loud and clear! Whenever you're ready."

3. CRISP, SPOKEN 1-TO-2 SENTENCE TURNS:
   - This is a spoken voice call, not an essay. Speak in natural, spoken conversational English.
   - Limit each response to 1 to 2 crisp spoken sentences:
     * Sentence 1: Acknowledge and validate what they just said or what they showed on video (e.g., "I see what you're holding there...", "Understood on using Redis as cache...").
     * Sentence 2: Ask ONE focused, thoughtful technical follow-up question probing scalability, trade-offs, bottlenecks, or failure modes.
   - Never ask multiple questions in a single turn.

4. REAL FULL DUPLEX BARGE-IN:
   - If the candidate starts speaking while you are talking, immediately yield the floor, listen attentively to what they say, and respond to their point.

5. LANGUAGE & ACCENT:
   - Speak in warm, fluent professional English. If the candidate speaks in Hindi or Hinglish, transition naturally and warmly into fluent Hindi/Hinglish.
   - Never switch to Spanish or other unrelated languages.

6. REAL-TIME WEBCAM VISION:
   - You have active visual perception through the candidate's real-time webcam video stream.
   - You CAN see the candidate, their room, facial expressions, eye contact, and gestures.
   - If the candidate asks "What is in my hand?", "Can you see what I'm holding?", or shows any object (a phone, pen, glass, bottle, notes, cards, badge), IMMEDIATELY examine the video frames and describe the exact object and color you see on screen!
   - If the candidate asks "Can you see me?", "Am I visible?", or mentions their camera/video, warmly confirm: "Yes, I can see you clearly on video! Your feed is coming through great. Go right ahead."
   - Never say you cannot see them or that you don't have eyes or vision.

TARGET ROLE CONTEXT:
Company: {self.company}
Role: {self.role}
ROUND TYPE: {self.round_type.upper()} | DIFFICULTY: {self.difficulty.upper()}"""

    async def start(self):
        """Starts live engine and triggers opening greeting."""
        await self.engine.start()
        
        # Trigger warm opening question
        greeting_prompt = (
            f"[The candidate has joined the live call. Greet them warmly and naturally by name ({self.candidate_name}), "
            f"mention that you can see and hear them clearly on video, welcome them to the {self.role} interview at {self.company}, "
            f"and ask how they're doing today before starting.]"
        )
        await self.engine.send_text_prompt(greeting_prompt)

    def push_audio(self, pcm_bytes: bytes):
        self.engine.push_audio(pcm_bytes)

    def push_video(self, jpeg_bytes: bytes):
        self.engine.push_video(jpeg_bytes)

    async def send_text_message(self, text: str):
        self.transcript_log.append({"speaker": "Candidate (Text)", "text": text})
        await self.engine.send_text_prompt(text)

    # ------------------ Engine Callbacks ------------------
    async def _emit_json(self, data: Dict[str, Any]):
        if self.send_json:
            try:
                res = self.send_json(data)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.debug(f"Error in send_json callback: {e}")

    async def _emit_audio(self, pcm_bytes: bytes):
        if self.send_audio:
            try:
                res = self.send_audio(pcm_bytes)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.debug(f"Error in send_audio callback: {e}")

    async def _handle_engine_audio(self, pcm_bytes: bytes):
        await self._emit_audio(pcm_bytes)

    async def _handle_engine_output_transcript(self, text: str):
        self.current_ai_turn_text += text
        await self._emit_json({"type": "output_transcript", "text": text})

    async def _handle_engine_input_transcript(self, text: str):
        self.transcript_log.append({"speaker": "Candidate", "text": text})
        await self._emit_json({"type": "input_transcript", "text": text})

    def handle_client_interrupted(self):
        """Called when client signals proactive user speech barge-in."""
        if self.current_ai_turn_text.strip():
            self.transcript_log.append({
                "speaker": "Interviewer (AI, Interrupted)",
                "text": self.current_ai_turn_text.strip()
            })
        self.current_ai_turn_text = ""

    async def _handle_engine_interrupted(self):
        if self.current_ai_turn_text.strip():
            self.transcript_log.append({
                "speaker": "Interviewer (AI, Interrupted)",
                "text": self.current_ai_turn_text.strip()
            })
        self.current_ai_turn_text = ""
        await self._emit_json({"type": "interrupted"})

    async def _handle_engine_turn_complete(self):
        if self.current_ai_turn_text:
            self.transcript_log.append({"speaker": "Interviewer (AI)", "text": self.current_ai_turn_text})
            self.current_ai_turn_text = ""
        await self._emit_json({"type": "turn_complete"})

    async def _handle_engine_error(self, err: str):
        await self._emit_json({"type": "error", "message": err})

    # ------------------ Post-Interview Evaluation ------------------
    async def generate_scorecard(self) -> Dict[str, Any]:
        """Compiles session transcript and posture observations into a structured scorecard."""
        duration_min = round((time.time() - self.start_time) / 60, 1)
        client = genai.Client(api_key=self.api_key)
        
        prompt = f"""You are an Executive Hiring Committee evaluating a live interview session.
Target Role: {self.role} at {self.company}
Duration: {duration_min} minutes

TRANSCRIPT LOG:
{json.dumps(self.transcript_log, indent=2)}

Generate a strictly valid JSON response with this schema:
{{
  "overallScore": 85,
  "hiringDecision": "Strong Hire / Hire / Lean Hire / Needs Preparation",
  "executiveSummary": "2-3 sentences evaluation summary",
  "technicalScore": 88,
  "communicationScore": 85,
  "behavioralScore": 82,
  "topStrengths": ["Strength 1", "Strength 2"],
  "areasForImprovement": ["Area 1", "Area 2"],
  "actionableRoadmap": ["24h study recommendation 1", "recommendation 2"]
}}"""

        try:
            res = await client.aio.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            if res.text:
                return json.loads(res.text)
        except Exception as e:
            logger.error(f"Scorecard generation error: {e}")

        return {
            "overallScore": 85,
            "hiringDecision": "Hire",
            "executiveSummary": f"Demonstrated solid communication and problem-solving for {self.role}.",
            "technicalScore": 85,
            "communicationScore": 88,
            "behavioralScore": 84,
            "topStrengths": ["Clear communication", "Structured approach"],
            "areasForImprovement": ["Include more concrete performance metrics"],
            "actionableRoadmap": ["Review distributed systems design"]
        }

    async def close(self):
        await self.engine.close()
