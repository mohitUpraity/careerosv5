import asyncio
import time
import json
import logging
from typing import Optional, Dict, Any, List, Callable, Awaitable
from google import genai
from google.genai import types

logger = logging.getLogger("gemini_live.subagents")


class ProctorGuardianSubAgent:
    """
    Autonomous Anti-Cheating & Proctoring Sub-Agent.
    Continuously monitors webcam frames for:
    - Eye aversion, looking away downward at hidden notes/phones, or excessive eye rolling
    - Mobile phone, tablet, or secondary electronic gadget usage
    - Multiple people in frame or unauthorized assistance
    - Suspicious movement or disappearing from frame

    Enforces 3-strike policy:
    - Warning 1: Screen banner (1/3) + ⚠️ Reaction + Scratchpad note + Spoken reminder
    - Warning 2: Screen banner (2/3) + ⚠️ Reaction + Scratchpad note + Spoken firm warning
    - Warning 3 / Critical Malpractice: Interview Disqualification & Instant Termination
    """

    def __init__(
        self,
        api_key: str,
        candidate_name: str,
        emit_json: Callable[[Dict[str, Any]], Awaitable[None]],
        send_interviewer_prompt: Callable[[str], Awaitable[None]],
        on_terminate: Callable[[str], Awaitable[None]],
        add_scratchpad_note: Callable[[str, str, str, int], None],
    ):
        self.api_key = api_key
        self.candidate_name = candidate_name
        self.emit_json = emit_json
        self.send_interviewer_prompt = send_interviewer_prompt
        self.on_terminate = on_terminate
        self.add_scratchpad_note = add_scratchpad_note

        self.client = genai.Client(api_key=self.api_key)
        self.is_running = False
        self._worker_task: Optional[asyncio.Task] = None
        self.latest_frame: Optional[bytes] = None
        self._frame_sequence = 0
        self._last_evaluated_sequence = -1

        self.warning_count = 0
        self.violations_history: List[Dict[str, Any]] = []
        self.last_warning_timestamp = 0.0
        self.consecutive_suspicious_frames = 0
        self.warning_cooldown_seconds = 14.0  # Fair grace period between sequential warnings

    def update_frame(self, frame_bytes: bytes):
        """Update latest webcam frame buffer for proctor analysis."""
        self.latest_frame = frame_bytes
        self._frame_sequence += 1

    async def start(self):
        """Start the background vision monitoring worker."""
        self.is_running = True
        self._worker_task = asyncio.create_task(self._proctor_vision_worker())
        logger.info("🛡️ ProctorGuardianSubAgent started vision surveillance loop.")

    async def stop(self):
        """Stop surveillance loop."""
        self.is_running = False
        if self._worker_task:
            self._worker_task.cancel()
        logger.info("🛡️ ProctorGuardianSubAgent stopped.")

    async def _proctor_vision_worker(self):
        """Inspect fresh webcam frames promptly without repeatedly scoring one frame."""
        # Initial 5s grace period for candidate to settle in
        await asyncio.sleep(5.0)

        while self.is_running:
            try:
                if self.latest_frame is not None and self._frame_sequence != self._last_evaluated_sequence:
                    frame_bytes = self.latest_frame
                    self._last_evaluated_sequence = self._frame_sequence

                    await self._evaluate_frame(frame_bytes)

                # Proctoring remains live, while avoiding a separate vision API
                # request for every webcam frame competing with the voice session.
                await asyncio.sleep(3.0)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Proctor vision cycle notice: {e}")
                await asyncio.sleep(4.0)

    async def _evaluate_frame(self, frame_bytes: bytes):
        """Analyze a single video frame for malpractice indicators."""
        prompt = (
            "You are a strict, authoritative Anti-Cheating AI Proctor analyzing this webcam frame for a high-stakes technical interview.\n"
            f"Candidate Name: {self.candidate_name}\n\n"
            "Examine the frame with high scrutiny for integrity violations:\n"
            "1. 'mobile_phone_detected': Candidate is holding, checking, touching, or has a visible smartphone/mobile phone/tablet in hand or on desk. ZERO TOLERANCE: Having or holding a phone on camera is a strict violation.\n"
            "2. 'looking_away': Candidate eyes or head are diverted downward or sideways (e.g. reading off-screen notes, looking down at lap/phone, or second monitor). Normal upward thinking gaze is ok, but looking downward/sideways is a violation.\n"
            "3. 'multiple_persons_detected': Another person visible in the frame, leaning in, or whispering.\n"
            "4. 'unusual_posture_or_gesture': Candidate face obscured, leaving the chair, or suspicious leaning.\n"
            "5. 'none': Normal candidate behavior (facing screen, speaking, gesturing naturally with no devices).\n\n"
            "Output strictly valid JSON with this format:\n"
            "{\n"
            '  "is_violation": true/false,\n'
            '  "violation_type": "none" | "looking_away" | "mobile_phone_detected" | "multiple_persons_detected" | "unusual_posture_or_gesture",\n'
            '  "confidence": 0.0 to 1.0,\n'
            '  "reason": "Clear 1-sentence description of what is seen"\n'
            "}"
        )

        try:
            part = types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")
            res = await self.client.aio.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                )
            )

            if not res or not res.text:
                return

            data = json.loads(res.text)
            is_violation = data.get("is_violation", False)
            violation_type = data.get("violation_type", "none")
            confidence = float(data.get("confidence", 0.0))
            reason = data.get("reason", "Suspicious behavioral pattern detected.")

            if is_violation and violation_type != "none" and confidence >= 0.60:
                self.consecutive_suspicious_frames += 1
                logger.info(
                    f"⚠️ Proctor notice: detected {violation_type} (conf={confidence:.2f}, count={self.consecutive_suspicious_frames}): {reason}"
                )

                # A second person is an immediate warning, but not critical malpractice.
                # Keep critical escalation for clear, high-confidence device use.
                is_immediate_critical = violation_type == "mobile_phone_detected" and confidence >= 0.85

                if is_immediate_critical or self.consecutive_suspicious_frames >= 2:
                    now = time.time()
                    if (now - self.last_warning_timestamp) >= self.warning_cooldown_seconds or is_immediate_critical:
                        self.consecutive_suspicious_frames = 0
                        await self.trigger_warning(violation_type, reason, is_immediate_critical)
            else:
                # Candidate resumed normal posture
                if self.consecutive_suspicious_frames > 0:
                    self.consecutive_suspicious_frames -= 1

        except Exception as e:
            logger.warning(f"Frame proctor evaluation error: {e}")

    async def analyze_visual_question(self, candidate_question: str):
        """Analyze the newest frame immediately when the candidate asks about something visible."""
        frame_bytes = self.latest_frame
        if not frame_bytes:
            await self.emit_json({"type": "visual_observation", "data": {
                "description": "I don't have a fresh camera frame yet. Please hold it in view for a moment.",
                "confidence": 0,
            }})
            return

        prompt = (
            "Analyze this current interview webcam image to answer the candidate's visual question: "
            f"{candidate_question!r}. Identify the visible object, its color, and what the candidate appears to be doing with it. "
            "Be concise and only describe details clearly visible. Distinguish merely holding/showing a phone from actively looking at or using it. "
            "Return JSON with description (one sentence), object (string), confidence (0 to 1), and active_device_use (boolean)."
        )
        try:
            image_part = types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")
            response = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1),
            )
            data = json.loads(response.text or "{}")
            description = str(data.get("description", "I can see an object in the frame, but can't identify it clearly."))
            confidence = float(data.get("confidence", 0))
            await self.emit_json({"type": "visual_observation", "data": {
                "description": description,
                "object": str(data.get("object", "unknown")),
                "confidence": confidence,
            }})
            # Feed grounded visual evidence back into the voice interviewer so the
            # reply acknowledges what is actually on camera.
            await self.send_interviewer_prompt(
                f"[VISUAL QUESTION: Candidate asked {candidate_question!r}. I inspected the latest camera frame: "
                f"{description} (visual confidence {confidence:.2f}). Respond naturally in their language, briefly describe it, "
                "then continue the interview with one focused follow-up. Do not claim details beyond that observation.]"
            )
            if data.get("active_device_use") and confidence >= 0.85:
                await self.trigger_warning(
                    "mobile_phone_detected",
                    f"Video analysis indicates active use of a secondary device: {description}",
                )
        except Exception as e:
            logger.warning("On-demand visual analysis failed: %s", e)
            await self.emit_json({"type": "visual_observation", "data": {
                "description": "I couldn't analyze that frame just now. Keep it visible and ask me once more.",
                "confidence": 0,
            }})

    async def trigger_warning(self, violation_type: str, reason: str, is_critical: bool = False):
        """Execute warning escalation or terminate interview if 3rd strike reached."""
        now = time.time()
        if self.warning_count and (now - self.last_warning_timestamp) < self.warning_cooldown_seconds:
            logger.info("Suppressing duplicate proctor warning within cooldown: %s", violation_type)
            return
        self.last_warning_timestamp = now
        self.warning_count += 1
        timestamp_str = time.strftime("%I:%M %p")

        violation_record = {
            "warning_number": self.warning_count,
            "violation_type": violation_type,
            "warning_reason": reason,
            "timestamp": timestamp_str,
        }
        self.violations_history.append(violation_record)

        if self.warning_count < 3 and not (is_critical and self.warning_count >= 2):
            # 1. Emit proctor warning banner to frontend
            await self.emit_json({
                "type": "proctor_warning",
                "data": violation_record,
            })

            # 2. Emit floating warning emoji micro-interaction
            await self.emit_json({
                "type": "interviewer_reaction",
                "data": {"emoji": "⚠️", "reaction_reason": f"Proctor Warning {self.warning_count}/3: {reason}"},
            })

            # 3. Log to confidential candidate scratchpad
            self.add_scratchpad_note(
                category="integrity_and_proctoring",
                observation=f"Proctor Warning #{self.warning_count}: {reason} ({violation_type})",
                sentiment="concern",
                score_delta=-10 * self.warning_count,
            )

            # 4. Inject prompt to live AI interviewer to politely verbally address the warning
            if violation_type == "multiple_persons_detected":
                interviewer_cue = (
                    f"[PROCTOR ALERT: Another person is visible in the room. Calmly ask {self.candidate_name} to have them step out, "
                    "then say you will wait and continue the interview once they are alone. Keep this to one natural spoken sentence.]"
                )
            elif violation_type == "mobile_phone_detected":
                interviewer_cue = (
                    f"[PROCTOR ALERT: A phone/device was detected: {reason}. Ask {self.candidate_name} to put it away and continue hands-free. "
                    "Keep this to one natural spoken sentence.]"
                )
            elif self.warning_count == 1:
                interviewer_cue = (
                    f"[PROCTOR ALERT: You observed {self.candidate_name} {reason.lower()}. "
                    f"Warning 1 of 3 has been visually displayed on their screen. In your next spoken sentence, "
                    f"politely ask them to keep their eyes on the camera and avoid looking at secondary notes/devices.]"
                )
            else:
                interviewer_cue = (
                    f"[PROCTOR ALERT: Second warning (2 of 3) issued for {reason.lower()}. "
                    f"Firmly inform the candidate verbally that this is their second warning, "
                    f"and one more infraction will immediately terminate the interview.]"
                )
            await self.send_interviewer_prompt(interviewer_cue)

        else:
            # STRIKE 3 or Critical Malpractice -> DISQUALIFICATION & TERMINATION
            disqualification_reason = (
                f"Candidate disqualified for repeated integrity violations ({self.warning_count} warnings): {reason}."
            )
            logger.warning(f"🚨 DISQUALIFYING CANDIDATE: {disqualification_reason}")

            # 1. Update scratchpad
            self.add_scratchpad_note(
                category="integrity_and_proctoring",
                observation=f"DISQUALIFICATION: {disqualification_reason}",
                sentiment="negative",
                score_delta=-50,
            )

            # 2. Emit floating reaction
            await self.emit_json({
                "type": "interviewer_reaction",
                "data": {"emoji": "❌", "reaction_reason": "Interview Terminated for Malpractice"},
            })

            # 3. Emit termination signal to client (pops Disqualification Modal)
            await self.emit_json({
                "type": "interview_terminated",
                "reason": disqualification_reason,
            })

            # 4. Terminate session
            await self.on_terminate(disqualification_reason)


class ScratchpadAndObservationSubAgent:
    """
    Sub-Agent responsible for maintaining real-time technical evaluation scratchpad
    and triggering contextual human micro-reactions (👍, 💡, 🎯, 🤔).
    """

    def __init__(
        self,
        api_key: str,
        role: str,
        company: str,
        candidate_name: str,
        emit_json: Callable[[Dict[str, Any]], Awaitable[None]],
        add_scratchpad_note: Callable[[str, str, str, int], None],
    ):
        self.api_key = api_key
        self.role = role
        self.company = company
        self.candidate_name = candidate_name
        self.emit_json = emit_json
        self.add_scratchpad_note = add_scratchpad_note

        self.client = genai.Client(api_key=self.api_key)
        self.eval_lock = asyncio.Lock()
        self.turn_counter = 0

    async def analyze_turn(self, candidate_speech: str, interviewer_question: str):
        """Analyzes a candidate response and publishes live scratchpad observations + reactions."""
        if not candidate_speech or len(candidate_speech.strip().split()) < 5:
            return

        self.turn_counter += 1
        # Run every 1-2 turns to keep observations rich and responsive
        asyncio.create_task(self._evaluate_dialogue(candidate_speech, interviewer_question))

    async def _evaluate_dialogue(self, candidate_speech: str, interviewer_question: str):
        async with self.eval_lock:
            prompt = (
                f"You are a Senior Technical Hiring Lead taking confidential scratchpad notes on {self.candidate_name}'s live technical response.\n"
                f"Target Role: {self.role} at {self.company}\n"
                f"Question Asked: {interviewer_question}\n"
                f"Candidate's Answer: {candidate_speech}\n\n"
                "Evaluate this turn and provide:\n"
                "1. A sharp 1-sentence technical observation for the candidate's confidential dossier.\n"
                "2. Category: 'technical_depth' | 'problem_solving' | 'system_design' | 'communication'\n"
                "3. Sentiment: 'positive' | 'neutral' | 'concern'\n"
                "4. Score delta: integer from -10 to +10\n"
                "5. Reaction emoji for screen: '👍' (good answer), '💡' (clever insight), '🎯' (spot on), '🤔' (complex trade-off), or 'none'\n\n"
                "Output strictly valid JSON:\n"
                "{\n"
                '  "observation": "1-sentence specific evaluation note",\n'
                '  "category": "technical_depth",\n'
                '  "sentiment": "positive",\n'
                '  "score_delta": 8,\n'
                '  "reaction_emoji": "👍"\n'
                "}"
            )

            try:
                res = await self.client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    )
                )

                if not res or not res.text:
                    return

                data = json.loads(res.text)
                observation = data.get("observation", "")
                category = data.get("category", "technical_depth")
                sentiment = data.get("sentiment", "positive")
                score_delta = int(data.get("score_delta", 5))
                reaction_emoji = data.get("reaction_emoji", "none")

                if observation:
                    # Record note and broadcast to frontend
                    timestamp_str = time.strftime("%I:%M %p")
                    note_id = f"note_{int(time.time()*1000)}"

                    self.add_scratchpad_note(
                        category=category,
                        observation=observation,
                        sentiment=sentiment,
                        score_delta=score_delta,
                    )

                    await self.emit_json({
                        "type": "scratchpad_updated",
                        "data": {
                            "id": note_id,
                            "category": category,
                            "note": observation,
                            "observation_type": sentiment,
                            "score_delta": score_delta,
                            "timestamp": timestamp_str,
                        }
                    })

                if reaction_emoji and reaction_emoji != "none":
                    await self.emit_json({
                        "type": "interviewer_reaction",
                        "data": {
                            "emoji": reaction_emoji,
                            "reaction_reason": observation,
                        }
                    })

            except Exception as e:
                logger.debug(f"Scratchpad observation generation notice: {e}")


class CodingChallengeSubAgent:
    """
    Sub-Agent that dynamically orchestrates interactive live coding challenges.
    Generates challenges aligned with candidate's role and pushes split-screen IDE.
    """

    def __init__(
        self,
        api_key: str,
        role: str,
        company: str,
        emit_json: Callable[[Dict[str, Any]], Awaitable[None]],
        send_interviewer_prompt: Callable[[str], Awaitable[None]],
    ):
        self.api_key = api_key
        self.role = role
        self.company = company
        self.emit_json = emit_json
        self.send_interviewer_prompt = send_interviewer_prompt
        self.client = genai.Client(api_key=self.api_key)
        self.active_challenge: Optional[Dict[str, Any]] = None

    async def push_challenge_for_role(self, topic: Optional[str] = None):
        """Generates and pushes a live split-screen coding challenge."""
        topic_clause = f"Focusing on {topic}." if topic else "Algorithm / System component implementation."
        prompt = (
            f"You are a Lead Engineer at {self.company} selecting a live coding interview problem for {self.role}.\n"
            f"{topic_clause}\n\n"
            "Generate a realistic, focused 20-minute coding challenge.\n"
            "Return strictly valid JSON:\n"
            "{\n"
            '  "title": "Short descriptive title",\n'
            '  "problem_description": "Clear problem description with input/output examples and constraints.",\n'
            '  "starter_code": "def solution(...):\\n    # Write your implementation here\\n    pass",\n'
            '  "language": "python"\n'
            "}"
        )

        try:
            res = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                )
            )

            if res and res.text:
                challenge = json.loads(res.text)
                self.active_challenge = challenge

                # 1. Push coding challenge to client (triggers split-screen Monaco editor)
                await self.emit_json({
                    "type": "push_coding_challenge",
                    "data": challenge,
                })

                # 2. Inform live interviewer to introduce the challenge naturally
                await self.send_interviewer_prompt(
                    f"[You just opened the split-screen code editor with challenge '{challenge.get('title')}'. "
                    f"Briefly introduce the problem to {self.role} candidate in 1-2 spoken sentences and invite them to think aloud.]"
                )
                logger.info(f"💻 Pushed coding challenge: {challenge.get('title')}")
                return challenge
        except Exception as e:
            logger.error(f"Error creating coding challenge: {e}")
            # Fallback challenge
            fallback = {
                "title": "Design a Distributed Rate Limiter",
                "problem_description": "Implement a Token Bucket or Sliding Window rate limiter function in Python that enforces max_requests per window_seconds for a given user_id.",
                "starter_code": "import time\n\nclass RateLimiter:\n    def __init__(self, max_requests: int, window_seconds: float):\n        self.max_requests = max_requests\n        self.window_seconds = window_seconds\n        self.history = {}\n\n    def is_allowed(self, user_id: str) -> bool:\n        # TODO: Implement sliding window rate limit\n        return True\n",
                "language": "python"
            }
            self.active_challenge = fallback
            await self.emit_json({"type": "push_coding_challenge", "data": fallback})
            return fallback
