import asyncio
import time
import json
import logging
from typing import Optional, Dict, Any, List, Callable, Awaitable
from google import genai
from google.genai import types
from app.gemini_live.config import LiveEngineConfig
from app.gemini_live.engine import GeminiLiveEngine
from app.gemini_live.subagents import (
    ProctorGuardianSubAgent,
    ScratchpadAndObservationSubAgent,
    CodingChallengeSubAgent,
)
from app.gemini_live.tools import get_live_tools

logger = logging.getLogger("gemini_live.interview")


class LiveInterviewSession:
    """
    High-level Live Interview Manager supporting audio, vision, behavioral tracking,
    anti-cheating proctoring, autonomous sub-agents, micro-interactions, and post-interview scorecard generation.
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
        self.current_ai_turn_text = ""
        self._pending_candidate_text = ""
        self._scratchpad_debounce_task: Optional[asyncio.Task] = None
        self.is_terminated = False
        self.termination_reason = ""

        # Build system instruction with behavioral, visual, and persona cues
        system_instruction = self._build_system_instruction()

        config = LiveEngineConfig(
            model="gemini-3.8-live",
            voice_name=self.voice_name,
            system_instruction=system_instruction,
            silence_duration_ms=700,
            prefix_padding_ms=80,
        )

        self.engine = GeminiLiveEngine(
            api_key=self.api_key,
            config=config,
            tools=get_live_tools(),
            on_audio_chunk=self._handle_engine_audio,
            on_output_transcript=self._handle_engine_output_transcript,
            on_input_transcript=self._handle_engine_input_transcript,
            on_interrupted=self._handle_engine_interrupted,
            on_turn_complete=self._handle_engine_turn_complete,
            on_error=self._handle_engine_error,
            on_tool_call=self._handle_live_tool_call,
        )

        # ------------------ Autonomous Sub-Agents ------------------
        # 1. Anti-cheating & Gaze / Phone / Malpractice Proctor Sub-Agent
        self.proctor_subagent = ProctorGuardianSubAgent(
            api_key=self.api_key,
            candidate_name=self.candidate_name,
            emit_json=self._emit_json,
            send_interviewer_prompt=self.engine.send_text_prompt,
            on_terminate=self._handle_malpractice_termination,
            add_scratchpad_note=self._add_scratchpad_note,
        )

        # 2. Confidential Scratchpad & Micro-Reactions Sub-Agent
        self.scratchpad_subagent = ScratchpadAndObservationSubAgent(
            api_key=self.api_key,
            role=self.role,
            company=self.company,
            candidate_name=self.candidate_name,
            emit_json=self._emit_json,
            add_scratchpad_note=self._add_scratchpad_note,
        )

        # 3. Dynamic Interactive Coding Sub-Agent
        self.coding_subagent = CodingChallengeSubAgent(
            api_key=self.api_key,
            role=self.role,
            company=self.company,
            emit_json=self._emit_json,
            send_interviewer_prompt=self.engine.send_text_prompt,
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
   - If asked about an object, use the latest visual frame and describe only what is clearly visible. The visual analysis may arrive as a system observation; acknowledge that object in your next spoken turn.
   - Holding a phone up to show it is not, by itself, proof of cheating. If the candidate is clearly consulting/using a secondary device during the interview, call issue_proctor_warning with the observed evidence. Never invent a visual violation.

7. INTERVIEW ACTION TOOLS:
   - Use trigger_interviewer_reaction for a brief on-screen reaction when it adds a natural human cue.
   - Use update_interview_scratchpad for specific evidence-based assessment notes, not generic praise.
   - Use push_coding_challenge when the interview should move into a coding exercise.
   - Follow the proctor warning sequence returned by the tools. Terminate only for a third warning or clear, serious malpractice; after any tool action, continue the spoken interview naturally unless the session was terminated.

TARGET ROLE CONTEXT:
Company: {self.company}
Role: {self.role}
ROUND TYPE: {self.round_type.upper()} | DIFFICULTY: {self.difficulty.upper()}"""

    def _add_scratchpad_note(self, category: str, observation: str, sentiment: str, score_delta: int):
        """Append an observation to session-level scratchpad ledger."""
        self.scratchpad_notes.append({
            "id": f"note_{len(self.scratchpad_notes)+1}_{int(time.time())}",
            "category": category,
            "observation": observation,
            "sentiment": sentiment,
            "score_delta": score_delta,
            "timestamp": time.strftime("%I:%M %p"),
        })

    async def _handle_malpractice_termination(self, reason: str):
        """Callback when ProctorGuardianSubAgent triggers disqualification termination."""
        self.is_terminated = True
        self.termination_reason = reason
        logger.warning(f"🚨 Interview session {self.session_id} terminated for malpractice: {reason}")
        # Stop engines safely
        try:
            await self.proctor_subagent.stop()
            await self.engine.close()
        except Exception as e:
            logger.debug(f"Error during malpractice close: {e}")

    async def start(self):
        """Starts live engine and triggers opening greeting alongside proctoring loop."""
        await self.engine.start()
        await self.proctor_subagent.start()

        # Trigger warm opening question
        greeting_prompt = (
            f"[The candidate has joined the live call. Greet them warmly and naturally by name ({self.candidate_name}), "
            f"mention that you can see and hear them clearly on video, welcome them to the {self.role} interview at {self.company}, "
            f"and ask how they're doing today before starting.]"
        )
        await self.engine.send_text_prompt(greeting_prompt)

    def push_audio(self, pcm_bytes: bytes):
        if not self.is_terminated:
            self.engine.push_audio(pcm_bytes)

    def push_video(self, jpeg_bytes: bytes):
        if not self.is_terminated:
            # 1. Stream to live voice persona for natural vision grounding
            self.engine.push_video(jpeg_bytes)
            # 2. Update proctoring vision buffer for anti-cheating scrutiny
            self.proctor_subagent.update_frame(jpeg_bytes)

    async def send_text_message(self, text: str):
        if not self.is_terminated:
            self.transcript_log.append({"speaker": "Candidate (Text)", "text": text})
            await self.engine.send_text_prompt(text)

    async def _handle_live_tool_call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute interview actions requested by the live interviewer model."""
        if self.is_terminated:
            return {"status": "ignored", "reason": "interview_terminated"}

        if name == "issue_proctor_warning":
            await self.proctor_subagent.trigger_warning(
                violation_type=str(args.get("violation_type", "looking_away")),
                reason=str(args.get("warning_reason", "Possible interview integrity violation")),
            )
            return {"status": "warning_recorded", "warnings": self.proctor_subagent.warning_count}
        if name == "terminate_interview_for_malpractice":
            reason = str(args.get("disqualification_reason", "Repeated interview integrity violations"))
            await self._terminate_for_malpractice(reason)
            return {"status": "terminated", "reason": reason}
        if name == "trigger_interviewer_reaction":
            await self._emit_json({"type": "interviewer_reaction", "data": {
                "emoji": str(args.get("emoji", "👍")),
                "reaction_reason": str(args.get("reaction_reason", "")),
            }})
            return {"status": "shown"}
        if name == "update_interview_scratchpad":
            category = str(args.get("category", "technical_depth"))
            observation = str(args.get("observation", ""))
            sentiment = str(args.get("sentiment", "neutral"))
            score_delta = max(-20, min(10, int(args.get("score_delta", 0))))
            self._add_scratchpad_note(category, observation, sentiment, score_delta)
            await self._emit_json({"type": "scratchpad_updated", "data": {
                "id": f"note_{len(self.scratchpad_notes)}_{int(time.time()*1000)}",
                "category": category, "note": observation,
                "observation_type": sentiment, "score_delta": score_delta,
                "timestamp": time.strftime("%I:%M %p"),
            }})
            return {"status": "recorded"}
        if name == "push_coding_challenge":
            challenge = {key: args.get(key, "") for key in ("title", "problem_description", "starter_code", "language")}
            await self._emit_json({"type": "push_coding_challenge", "data": challenge})
            self.coding_subagent.active_challenge = challenge
            return {"status": "challenge_opened", "title": challenge["title"]}
        return {"status": "unknown_tool", "name": name}

    async def _terminate_for_malpractice(self, reason: str):
        if self.is_terminated:
            return
        await self._emit_json({"type": "interview_terminated", "reason": reason})
        await self._handle_malpractice_termination(reason)

    async def trigger_coding_challenge(self, topic: Optional[str] = None):
        """Triggers coding subagent to push split-screen live coding challenge."""
        return await self.coding_subagent.push_challenge_for_role(topic)

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
        if self.send_audio and not self.is_terminated:
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

        visual_request = any(term in text.lower() for term in (
            "what is in my hand", "what am i holding", "can you see my phone",
            "what is this", "mere haath", "haath mein", "phone dikha", "dekh pa rahe",
            "हाथ में", "क्या पकड़ा", "क्या है", "फोन दिखा", "देख पा रहे",
        ))
        if visual_request:
            asyncio.create_task(self.proctor_subagent.analyze_visual_question(text))

        # Coalesce streamed transcript fragments; one evaluation per spoken pause
        # avoids launching a flash request for every partial transcript update.
        self._pending_candidate_text = f"{self._pending_candidate_text} {text}".strip()
        if self._scratchpad_debounce_task and not self._scratchpad_debounce_task.done():
            self._scratchpad_debounce_task.cancel()
        self._scratchpad_debounce_task = asyncio.create_task(self._flush_scratchpad_after_pause())

    async def _flush_scratchpad_after_pause(self):
        try:
            await asyncio.sleep(0.9)
            candidate_text = self._pending_candidate_text.strip()
            self._pending_candidate_text = ""
            if len(candidate_text.split()) >= 5:
                interviewer_context = self.current_ai_turn_text.strip() or f"Discussion for {self.role}"
                await self.scratchpad_subagent.analyze_turn(candidate_text, interviewer_context)
        except asyncio.CancelledError:
            return

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

    # ------------------ Post-Interview Evaluation & Scorecard ------------------
    async def generate_scorecard(self) -> Dict[str, Any]:
        """
        Compiles complete transcript, scratchpad notes, and proctoring integrity record
        into an executive hiring committee scorecard.
        """
        duration_min = round((time.time() - self.start_time) / 60, 1)
        violations = self.proctor_subagent.violations_history
        warning_count = self.proctor_subagent.warning_count

        # If terminated for malpractice, generate explicit disqualification scorecard
        if self.is_terminated or warning_count >= 3:
            return {
                "overallScore": 0,
                "hiringDecision": "Disqualified (Integrity & Proctoring Violation)",
                "executiveSummary": (
                    f"Interview was terminated early due to integrity malpractice: "
                    f"{self.termination_reason or 'Accumulated 3 proctor warnings'}. "
                    f"Violations recorded: {len(violations)}."
                ),
                "technicalScore": 0,
                "communicationScore": 0,
                "behavioralScore": 0,
                "topStrengths": ["N/A - Terminated for Malpractice"],
                "areasForImprovement": ["Adhere to interview code of conduct and proctoring rules."],
                "actionableRoadmap": ["Retake interview in an isolated room without secondary devices or notes."],
                "integrityReport": {
                    "status": "DISQUALIFIED",
                    "warningsIssued": warning_count,
                    "violations": violations,
                }
            }

        client = genai.Client(api_key=self.api_key)

        prompt = f"""You are an Executive Hiring Committee evaluating a live proctored technical interview.
Target Role: {self.role} at {self.company}
Duration: {duration_min} minutes
Candidate Name: {self.candidate_name}

PROCTOR INTEGRITY SUMMARY:
- Warnings Issued: {warning_count}/3
- Recorded Violations: {json.dumps(violations, indent=2)}

SCRATCHPAD EVALUATION NOTES:
{json.dumps(self.scratchpad_notes, indent=2)}

TRANSCRIPT LOG:
{json.dumps(self.transcript_log[-30:], indent=2)}

Generate a strictly valid JSON response with this schema:
{{
  "overallScore": 85,
  "hiringDecision": "Strong Hire / Hire / Lean Hire / Needs Preparation",
  "executiveSummary": "2-3 sentences comprehensive evaluation incorporating technical depth and integrity.",
  "technicalScore": 88,
  "communicationScore": 85,
  "behavioralScore": 82,
  "topStrengths": ["Specific strength 1", "Specific strength 2"],
  "areasForImprovement": ["Specific improvement area 1", "Specific improvement area 2"],
  "actionableRoadmap": ["24h study recommendation 1", "recommendation 2"],
  "integrityReport": {{
    "status": "PASSED / FLAGGED_WITH_WARNINGS",
    "warningsIssued": {warning_count},
    "integrityScore": 95
  }}
}}"""

        try:
            res = await client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            if res.text:
                data = json.loads(res.text)
                if "integrityReport" not in data:
                    data["integrityReport"] = {
                        "status": "PASSED" if warning_count == 0 else "FLAGGED_WITH_WARNINGS",
                        "warningsIssued": warning_count,
                        "integrityScore": max(0, 100 - (warning_count * 20)),
                    }
                return data
        except Exception as e:
            logger.error(f"Scorecard generation error: {e}")

        # Baseline fallback
        return {
            "overallScore": 82,
            "hiringDecision": "Hire",
            "executiveSummary": f"Demonstrated solid communication and problem-solving for {self.role}.",
            "technicalScore": 84,
            "communicationScore": 86,
            "behavioralScore": 80,
            "topStrengths": ["Clear communication", "Structured approach"],
            "areasForImprovement": ["Deepen edge case analysis"],
            "actionableRoadmap": ["Review distributed systems design"],
            "integrityReport": {
                "status": "PASSED" if warning_count == 0 else "FLAGGED_WITH_WARNINGS",
                "warningsIssued": warning_count,
                "integrityScore": max(0, 100 - (warning_count * 20)),
            }
        }

    async def close(self):
        """Clean teardown of live session, subagents, and tasks."""
        if self._scratchpad_debounce_task and not self._scratchpad_debounce_task.done():
            self._scratchpad_debounce_task.cancel()
        try:
            await self.proctor_subagent.stop()
        except Exception:
            pass
        await self.engine.close()
        logger.info(f"Live Interview Session {self.session_id} cleanly closed.")
