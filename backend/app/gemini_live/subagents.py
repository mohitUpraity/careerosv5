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
    ULTRA-STRICT proctoring subagent for live proctored assessments.
    Samples webcam frames at high frequency for real-time cheating detection.

    Detection targets:
    - Phone/device visible or being used
    - Eyes looking away from screen (off-camera gaze)
    - Additional person in frame
    - Face not visible / camera obstructed
    - Notes/cheat sheets visible
    - Earpiece/earbud detected
    - Screen/monitor reading (secondary display)

    Enforces 3-strike policy with ultra-low latency:
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
        add_scratchpad_note: Callable[..., None],
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
        self.warning_cooldown_seconds = 25.0  # Give candidate time to respond before next warning
        self.warmup_grace_seconds = 30.0  # No formal warnings in first 30s — verbal only
        self.last_visual_note_key = ""
        self.last_visual_note_at = 0.0
        self.specialist_note_keys: Dict[str, str] = {}
        self.specialist_note_times: Dict[str, float] = {}

        # Ultra-strict tracking counters
        self.consecutive_off_camera_frames = 0
        self.gaze_check_prompted = False
        self.consecutive_phone_attention_frames = 0
        self.phone_attention_prompted = False
        self.consecutive_obscured_face_frames = 0
        self.camera_adjustment_prompted = False
        self.camera_visibility_deadline = 0.0
        self.camera_visibility_warning_sent = False

        # NEW: Additional strict tracking
        self.consecutive_phone_visible_frames = 0
        self.phone_visible_warned = False
        self.total_off_camera_detections = 0
        self.total_phone_detections = 0
        self.session_start_time = time.time()

        # Camera-off / missing-frame heartbeat tracking
        self.camera_active = True
        self.last_frame_time = time.time()

        # Evaluation rate tracking
        self._eval_in_progress = False
        self._eval_count = 0
        self._eval_error_count = 0
        self._last_eval_log_time = time.time()
        self.camera_off_warned = False
        self.camera_off_warning_count = 0

    def update_frame(self, frame_bytes: bytes):
        """Update latest webcam frame buffer for proctor analysis."""
        self.latest_frame = frame_bytes
        self._frame_sequence += 1
        self.last_frame_time = time.time()

    def set_camera_active(self, active: bool):
        """Called by router when frontend sends camera_state message."""
        was_active = self.camera_active
        self.camera_active = active
        if active and not was_active:
            # Camera restored
            self.camera_off_warned = False
            logger.info("🛡️ ProctorGuardian: Camera feed restored by candidate.")
        elif not active and was_active:
            logger.warning("🛡️ ProctorGuardian: Camera feed DISABLED by candidate.")

    async def start(self):
        """Start the background vision monitoring worker."""
        self.is_running = True
        self.session_start_time = time.time()
        self._worker_task = asyncio.create_task(self._proctor_vision_worker())
        logger.info("🛡️ ProctorGuardianSubAgent started ULTRA-STRICT vision surveillance loop.")

    async def stop(self):
        """Stop surveillance loop."""
        self.is_running = False
        if self._worker_task:
            self._worker_task.cancel()
        logger.info("🛡️ ProctorGuardianSubAgent stopped.")

    async def _proctor_vision_worker(self):
        """Periodic proctor check: injects vision-check prompts into the Live session
        so the Gemini Live model (which already receives video at 1 FPS) actively
        monitors for cheating. Also handles camera-off heartbeat detection."""
        # Wait for the warmup grace period before starting proctor checks
        await asyncio.sleep(self.warmup_grace_seconds)
        logger.info("🛡️ ProctorGuardian: Warmup grace period complete. Active monitoring begins.")

        proctor_check_interval = 15  # seconds between proctor vision checks
        last_proctor_check = 0.0

        while self.is_running:
            try:
                now = time.time()
                seconds_since_last_frame = now - self.last_frame_time
                time_since_start = now - self.session_start_time

                # === HEARTBEAT: Detect camera-off or missing frames ===
                if not self.camera_active or seconds_since_last_frame > 5.0:
                    if not self.camera_off_warned:
                        self.camera_off_warned = True
                        self.camera_off_warning_count += 1
                        reason = (
                            "Camera feed disabled or not transmitting."
                            if not self.camera_active
                            else f"No webcam frames received for {seconds_since_last_frame:.1f} seconds — camera may be covered or obstructed."
                        )
                        logger.warning(f"🛡️ HEARTBEAT: {reason}")

                        await self.emit_json({"type": "camera_visibility_check", "data": {
                            "message": "⚠️ Your camera feed is not active. Your face MUST be visible at all times during this proctored assessment. Restore your camera immediately.",
                            "confidence": 1.0,
                            "score_impact": 0,
                            "countdown_seconds": 10,
                        }})

                        await self.send_interviewer_prompt(
                            "[STRICT PROCTOR ALERT: The candidate's camera feed has gone dark — either disabled, covered, or disconnected. "
                            "Tell them FIRMLY that their camera MUST be active and their face clearly visible at ALL times. "
                            "They have 10 seconds to restore it or a formal warning will be issued. This is non-negotiable.]"
                        )

                    elif self.camera_off_warned and seconds_since_last_frame > 20.0 and not self.camera_active:
                        self.camera_off_warned = False
                        await self.trigger_warning(
                            "camera_visibility",
                            f"Camera feed remained disabled for {seconds_since_last_frame:.0f} seconds. "
                            "Assessment integrity cannot be verified without an active camera feed.",
                        )
                elif self.camera_active and seconds_since_last_frame < 2.0:
                    if self.camera_off_warned:
                        self.camera_off_warned = False
                        await self.emit_json({"type": "camera_visibility_restored", "data": {
                            "message": "Camera view restored. The interview continues.",
                            "score_impact": 0,
                        }})

                # === PERIODIC PROCTOR VISION CHECK ===
                # Inject a silent system prompt that tells the Live model to examine
                # the current video feed for violations. The model already sees frames
                # at 1 FPS, so it just needs a nudge to actively scan.
                if now - last_proctor_check >= proctor_check_interval and self.camera_active:
                    last_proctor_check = now
                    check_number = int((time_since_start - self.warmup_grace_seconds) / proctor_check_interval) + 1
                    
                    await self.send_interviewer_prompt(
                        "[PROCTOR VISION CHECK #" + str(check_number) + ": MANDATORY — Before continuing the conversation, "
                        "carefully examine the CURRENT video frame you are receiving from the candidate's webcam. "
                        "Check for ALL of these IN ORDER:\n"
                        "1. FACE: Is the candidate's face clearly visible? If not → call issue_proctor_warning with violation_type='face_not_visible'\n"
                        "2. GAZE: Are they looking at the camera/screen or looking away/down? If looking away → call issue_proctor_warning with violation_type='gaze_away_from_screen'\n"
                        "3. PHONE/DEVICE: Is ANY phone, tablet, or secondary device visible ANYWHERE in the frame, even on the desk? If yes → call issue_proctor_warning with violation_type='mobile_phone_detected'\n"
                        "4. ANOTHER PERSON: Is anyone else visible or partially visible? If yes → call issue_proctor_warning with violation_type='multiple_persons_detected'\n"
                        "5. NOTES/PAPERS: Are any papers, sticky notes, or written materials visible? If yes → call issue_proctor_warning with violation_type='notes_detected'\n"
                        "6. EARPIECE: Is the candidate wearing earbuds or bluetooth headset? If yes → call issue_proctor_warning with violation_type='earpiece_detected'\n\n"
                        "If you detect a violation, call issue_proctor_warning with the violation_type and a specific warning_reason describing what you see. "
                        "Then address the candidate firmly about it. "
                        "If everything looks clean, continue the interview normally without mentioning this check. "
                        "DO NOT tell the candidate you are performing a proctor check — just act on what you see.]"
                    )
                    logger.info(
                        "🛡️ Proctor check #%d injected. Warnings: %d/3, frame_seq: %d",
                        check_number, self.warning_count, self._frame_sequence
                    )

                # Poll every 1 second
                await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"🛡️ Proctor vision cycle ERROR: {e}", exc_info=True)
                await asyncio.sleep(2.0)

    async def analyze_visual_question(self, candidate_question: str):
        """Analyze the newest frame immediately when the candidate asks about something visible."""
        frame_bytes = self.latest_frame
        if not frame_bytes:
            await self.emit_json({"type": "visual_observation", "data": {
                "description": "I don't have a fresh camera frame yet. Please hold it in view for a moment.",
                "confidence": 0,
            }})
            await self.send_interviewer_prompt(
                "[CAMERA STATUS: No webcam frame has reached the vision checker yet. Tell the candidate the video feed is not coming through, ask them to check/enable the camera, and continue the interview over audio.]"
            )
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
        time_since_start = now - self.session_start_time

        # ── WARMUP GRACE PERIOD ──
        # During the first 30 seconds, issue verbal-only warnings (no formal strikes)
        # This gives the candidate time to settle in, adjust camera, put phone away, etc.
        if time_since_start < self.warmup_grace_seconds and not is_critical:
            logger.info(
                "🛡️ Warmup grace period (%.0fs < %.0fs): verbal-only warning for %s: %s",
                time_since_start, self.warmup_grace_seconds, violation_type, reason
            )
            # Log to scratchpad but don't increment warning counter
            self.add_scratchpad_note(
                category="integrity_and_proctoring",
                observation=f"[Grace period] Detected {violation_type}: {reason}",
                sentiment="neutral",
                score_delta=0,
            )
            # Tell the interviewer to issue a verbal reminder (not a formal warning)
            await self.send_interviewer_prompt(
                f"[PROCTOR NOTICE — GRACE PERIOD: A {violation_type} was detected ({reason}). "
                "The session is still in the initial setup window. Give the candidate a firm but friendly "
                "reminder about the proctoring rules — camera on, phone away, eyes on screen — without "
                "issuing a formal warning count. Say something like: 'Before we get started, make sure "
                "your phone is completely out of reach and your camera is positioned so I can see you clearly.']"
            )
            return

        # Critical violations bypass cooldown entirely
        if self.warning_count and not is_critical and (now - self.last_warning_timestamp) < self.warning_cooldown_seconds:
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
                "data": {"emoji": "⚠️", "reaction_reason": f"⚠️ STRICT Proctor Warning {self.warning_count}/3: {reason}"},
            })

            # 3. Log to confidential candidate scratchpad
            self.add_scratchpad_note(
                category="integrity_and_proctoring",
                observation=f"STRICT Proctor Warning #{self.warning_count}: {reason} ({violation_type})",
                sentiment="concern",
                score_delta=0,
            )
            await self.emit_json({"type": "scratchpad_updated", "data": {
                "id": f"proctor_note_{self.warning_count}_{int(time.time() * 1000)}",
                "category": "integrity_and_proctoring",
                "note": f"⚠️ FORMAL WARNING #{self.warning_count}: {reason} ({violation_type})",
                "observation_type": "concern",
                "score_delta": 0,
                "timestamp": timestamp_str,
                "source": "Ultra-strict proctor system",
            }})

            # 4. Inject STRICT prompt to live AI interviewer
            if violation_type == "camera_visibility":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: The candidate's face is NOT visible on camera. "
                    f"State FIRMLY that this is a proctored assessment and their face MUST be visible at ALL times. "
                    f"This is formal warning {self.warning_count} of 3. One more will terminate the assessment immediately. "
                    "Pause the interview until they restore camera visibility.]"
                )
            elif violation_type == "multiple_persons_detected":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: Another person is detected in the frame. "
                    f"Tell {self.candidate_name} FIRMLY that this is a proctored assessment and they MUST be completely alone. "
                    f"The other person must leave the room immediately. This is warning {self.warning_count} of 3. "
                    "Do NOT continue until the other person has left.]"
                )
            elif violation_type == "mobile_phone_detected":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: A phone or secondary device has been detected. "
                    f"Evidence: {reason}. Tell {self.candidate_name} FIRMLY: 'This is a proctored assessment. "
                    "ALL phones and secondary devices must be completely out of sight and out of reach — not on the desk, "
                    "not in your hands, not anywhere visible. Put it away NOW.' "
                    f"This is warning {self.warning_count} of 3. One more infraction will END this assessment immediately.]"
                )
            elif violation_type == "gaze_away_from_screen":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: The candidate has been repeatedly looking away from the screen. "
                    f"Evidence: {reason}. Tell {self.candidate_name} FIRMLY: 'I need you to keep your eyes on the screen at all times. "
                    "This is a proctored assessment and looking away repeatedly is a formal violation. "
                    f"This is warning {self.warning_count} of 3. If this continues, the assessment will be terminated immediately.']"
                )
            elif violation_type == "notes_detected":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: Notes, papers, or written materials have been detected visible in the frame. "
                    f"Tell {self.candidate_name} FIRMLY: 'No external notes, papers, or reference materials are allowed during a proctored assessment. "
                    "Remove ALL written materials from your workspace immediately.' "
                    f"This is warning {self.warning_count} of 3.]"
                )
            elif violation_type == "earpiece_detected":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: An earpiece, earbud, or bluetooth headset has been detected. "
                    f"Tell {self.candidate_name} FIRMLY: 'External audio devices that could relay answers are not permitted. "
                    "Remove the earpiece immediately.' "
                    f"This is warning {self.warning_count} of 3.]"
                )
            elif violation_type == "screen_reading":
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING {self.warning_count}/3: Signs of reading from a secondary screen or monitor detected. "
                    f"Tell {self.candidate_name} FIRMLY: 'Only this assessment screen should be in use. "
                    "Close any other monitors or screens.' "
                    f"This is warning {self.warning_count} of 3.]"
                )
            elif self.warning_count == 1:
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING 1/3: Violation detected — {reason}. "
                    f"Tell {self.candidate_name} FIRMLY that this is their first formal warning. "
                    "This is a proctored assessment with zero tolerance. Two more infractions will immediately "
                    "terminate and disqualify them from this assessment.]"
                )
            else:
                interviewer_cue = (
                    f"[STRICT PROCTOR WARNING 2/3 — FINAL WARNING: {reason}. "
                    f"Tell {self.candidate_name} with absolute firmness: 'This is your SECOND and FINAL warning. "
                    "ONE MORE violation of ANY kind — looking away, phone visible, another person, notes — "
                    "will IMMEDIATELY terminate this assessment and result in disqualification. "
                    "There will be no further chances.']"
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
                "warningsIssued": self.warning_count,
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
