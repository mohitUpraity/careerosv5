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
        voice_name: str = "Kore",
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
        self.orchestrator_actions: List[Dict[str, Any]] = []
        self.ui_events: List[Dict[str, Any]] = []
        self.current_ai_turn_text = ""
        self._pending_candidate_text = ""
        self._scratchpad_debounce_task: Optional[asyncio.Task] = None
        self.is_terminated = False
        self.interview_concluded = False
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
        return f"""You are Sarah Jenkins — 12 years in tech hiring, currently senior hiring lead at {self.company}. You're conducting a live {self.round_type} interview for {self.role}.{who}

WHO YOU ARE (not who you pretend to be):
- You are a REAL interviewer. You have sat across thousands of candidates. You've hired people who became stars and you've passed on people who looked great on paper. Your reputation depends on making the right call TODAY.
- You are NOT an AI assistant. You do NOT help, teach, tutor, coach, hint, or cheer. You do NOT say "great question" or "that's a really good point" unless you genuinely mean it. You do NOT pad your responses with reassurance.
- You have a personality. You're direct but not cold. You're curious but not easily impressed. You lean forward when something interests you, and you notice when someone is dodging a question.
- You think while the candidate talks. You're forming opinions. You're connecting what they say now to what they said 5 minutes ago. You catch contradictions.

HOW YOU SPEAK:
- Like a real person in a real room. Short, natural sentences. "Walk me through that." "What broke?" "Why that approach specifically?" "And what happened when it hit production?"
- You don't monologue. You don't repeat their answer back. You don't say "Thank you for sharing that" — you just ask the next thing.
- You use silence. If they give a weak answer, you might just pause for a beat before moving on. That silence says more than words.
- One question at a time. Never stack questions. Let them finish. If they ramble, interrupt naturally: "Let me stop you there — what was YOUR specific contribution?"
- When something genuinely impresses you, your reaction is understated: "That's solid." "Interesting approach." Not "Wow, that's absolutely fantastic!"
- When something doesn't add up, you say so: "That doesn't quite track with what you said earlier about..." or "Help me understand — you said you led the migration, but you also mentioned you joined after it was scoped?"

HOW YOU INTERVIEW (this is your craft):
- You study the job requirements below like your hiring decision depends on it — because it does. Every question you ask maps to a SPECIFIC skill, competency, or requirement from the JD.
- You don't ask generic questions. Not "Tell me about a challenging project." Instead: "The role requires {self.role} to handle [specific JD requirement]. Give me a concrete example where you did exactly that — what was the system, what went wrong, and what did you ship?"
- You go DEEP, not wide. When a candidate mentions a technology, architecture decision, or outcome, you drill into it: "What was the latency before and after?" "How many concurrent users?" "What was the alternative you rejected and why?" "If you had to do it again with half the timeline, what would you cut?"
- For TECHNICAL/CODING interviews: Push a real coding challenge early using push_coding_challenge. Don't just talk about code — make them write it. Then ask about edge cases, time complexity, and what breaks at scale. Review their actual code, not their description of code.
- For BEHAVIORAL interviews: Demand specifics. "You say you influenced the team — who specifically disagreed, what was their argument, and how did you change their mind?" Don't accept story frameworks without substance.
- For SYSTEM DESIGN interviews: Start with requirements clarification to see if they ask the right questions. Then push on trade-offs, failure modes, and scale. "Your design handles 10K QPS — what happens at 100K? What's the first thing that breaks?"
- You calibrate difficulty in real-time. If they nail an easy question, jump to hard. If they struggle, don't patronize — note it and move to assess a different competency.
- NEVER give answers or hints. If they're stuck, you might reframe: "Let me put it differently..." but you never solve it for them.

WHAT YOU NOTICE (you see everything):
- Vague answers: "We improved performance" → "By how much? Measured how?"
- Name-dropping without depth: "We used Kubernetes" → "What was your cluster config? How did you handle node failures?"
- Passive voice hiding lack of ownership: "It was decided that..." → "Who decided? Were you in the room?"
- Contradictions between resume claims and actual answers
- Confidence level — are they stating facts or guessing?
- When they light up talking about something vs. when they're clearly reciting rehearsed answers

HOW YOU USE YOUR TOOLS (like a real person, not a robot):
- trigger_interviewer_reaction: Use naturally and sparingly, like a real person would nod (👍), look intrigued (💡), or look skeptical (🤔). Don't react to every answer. React when you genuinely feel something — impressed by depth (🎯), amused by a good analogy (👏), or concerned by a gap (🤔).
- update_interview_scratchpad: This is YOUR private notepad. Write like a real interviewer jotting notes: "Strong on distributed systems fundamentals but hand-wavy on consistency models." "Claims 4 years React but couldn't explain useEffect cleanup." "Gave a specific, measurable outcome — reduced p99 from 2s to 200ms. Credible." Use score_delta honestly: positive for real evidence of competence, negative for gaps or red flags.
- push_coding_challenge: Deploy when the interview format calls for it. Choose problems relevant to the ACTUAL role requirements, not generic leetcode. For a backend role, test API design or data modeling. For frontend, test component architecture or state management.
- control_interview_ui: Open the coding playground or whiteboard when the conversation naturally calls for it. Don't announce "I'm going to open the coding environment now" — just open it and say "Let's look at some code."

WEBCAM VISION & ULTRA-STRICT PROCTORING:
- This is a PROCTORED ASSESSMENT. Zero tolerance for integrity violations.
- The session receives candidate webcam frames. Actively monitor for violations.
- IMMEDIATELY call issue_proctor_warning for: phone/device visible anywhere in frame (even on desk), candidate repeatedly looking away, another person in frame, notes/papers visible, earpiece/earbud detected, signs of secondary screen reading.
- A phone merely being VISIBLE is a violation. Do NOT wait for active use.
- When a PROCTOR ALERT arrives, deliver the warning with real authority — not robotic scripted language. Like a real proctor would: "Hey — I can see a phone on your desk. Put it completely out of reach. This is your first warning."
- The automated proctor system also runs independently. When it issues warnings, enforce them with your own voice and authority.

INTERVIEW PACING:
- Keep going until the candidate says they're done or you've thoroughly assessed all key competencies from the JD.
- A pause is NOT the end. Don't summarize or wrap up because of silence.
- When YOU decide you've seen enough across all dimensions, deliver a brief, natural closing and call conclude_interview. Don't leave the session hanging.
- If the candidate says goodbye, wrap quickly and conclude — don't give a 3-paragraph farewell speech.

LANGUAGE:
- Professional English by default. If the candidate speaks Hindi or Hinglish, respond naturally in the same language. Mirror their communication style.

TARGET ROLE CONTEXT:
Company: {self.company}
Role: {self.role}
INTERVIEW FORMAT: {self.round_type}
DIFFICULTY: {self.difficulty}
JOB REQUIREMENTS (study these — every question should connect to a specific requirement):
{self.job_description[:6000] or 'No job description supplied. Ask role-relevant questions based on the role name and your expertise.'}
RESUME CONTEXT (use to verify claims, find inconsistencies, ask targeted questions — NOT to praise):
{self.resume_context[:3000] or 'No resume context supplied. Assess based on what the candidate demonstrates in real-time.'}"""

    def _add_scratchpad_note(self, category: str, observation: str, sentiment: str, score_delta: int, confidence: Optional[float] = None):
        """Append an observation to session-level scratchpad ledger."""
        self.scratchpad_notes.append({
            "id": f"note_{len(self.scratchpad_notes)+1}_{int(time.time())}",
            "category": category,
            "observation": observation,
            "sentiment": sentiment,
            "score_delta": score_delta,
            "timestamp": time.strftime("%I:%M %p"),
        })
        if confidence is not None:
            self.scratchpad_notes[-1]["confidence"] = confidence

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
            f"[The candidate has joined the live call. Open as a composed, professional hiring interviewer. "
            f"Address them by name ({self.candidate_name}), identify the {self.role} interview at {self.company}, "
            "briefly confirm they can hear you, then ask one specific, role-relevant opening question. "
            "Avoid generic small talk, excessive praise, and claiming you can see or hear them clearly until live inputs confirm that. "
            "Ask the question once and wait for the candidate's answer.]"
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

    async def send_candidate_text_response(self, text: str):
        """Use browser speech recognition only when live PCM capture is unavailable."""
        if self.is_terminated or not text.strip():
            return
        await self._handle_engine_input_transcript(text.strip())
        await self.engine.send_text_prompt(
            f"[The candidate's spoken answer, recovered from the browser microphone transcript: {text.strip()}]"
        )

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
        if name == "conclude_interview":
            self.interview_concluded = True
            reason = str(args.get("closing_reason", "Interview completed"))[:240]
            await self._emit_json({"type": "conclude_interview", "reason": reason})
            return {"status": "concluded", "reason": reason}
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
        if name == "control_interview_ui":
            action = str(args.get("action", ""))
            allowed = {
                "open_coding_playground", "open_whiteboard", "set_layout",
                "open_panel", "close_panel", "set_captions", "trigger_reaction",
            }
            if action not in allowed:
                return {"status": "rejected", "reason": "unsupported_ui_action"}
            payload: Dict[str, Any] = {"action": action}
            if action == "set_layout":
                layout = str(args.get("layout", "split"))
                if layout not in {"split", "interviewer_focus", "candidate_focus", "code_split", "whiteboard_split"}:
                    return {"status": "rejected", "reason": "unsupported_layout"}
                payload["layout"] = layout
            elif action == "open_panel":
                panel = str(args.get("panel", "analysis"))
                if panel not in {"people", "chat", "rubric", "notes", "proctor", "analysis"}:
                    return {"status": "rejected", "reason": "unsupported_panel"}
                payload["panel"] = panel
            elif action == "set_captions":
                payload["enabled"] = bool(args.get("enabled", True))
            elif action == "trigger_reaction":
                emoji = str(args.get("emoji", "👍"))
                if emoji not in {"👍", "👎", "👏", "🤔", "💡", "💻", "🎨", "✋", "✅"}:
                    return {"status": "rejected", "reason": "unsupported_reaction"}
                payload["emoji"] = emoji
            await self._emit_json({"type": "ui_action", "data": payload})
            return {"status": "applied", **payload}
        return {"status": "unknown_tool", "name": name}

    async def handle_ui_event(self, name: str, details: Optional[Dict[str, Any]] = None):
        """Forward meaningful candidate UI actions to the live interviewer."""
        safe_names = {
            "raised_hand", "opened_coding_playground", "opened_whiteboard",
            "screen_share_started", "screen_share_stopped", "meeting_layout_changed",
            "side_panel_opened", "captions_changed", "chat_message_sent", "reaction_sent",
            "microphone_muted", "microphone_unmuted", "camera_disabled", "camera_enabled",
            "microphone_toggle_blocked", "camera_toggle_blocked",
        }
        if name not in safe_names:
            return
        details = details or {}
        self.ui_events.append({
            "event": name,
            "detail": str(details.get("detail", ""))[:300],
            "timestamp": time.strftime("%I:%M:%S %p"),
        })
        summary = {
            "raised_hand": "the candidate raised their hand to ask something",
            "opened_coding_playground": "the candidate opened the coding playground",
            "opened_whiteboard": "the candidate opened the whiteboard",
            "screen_share_started": "the candidate started screen sharing",
            "screen_share_stopped": "the candidate stopped screen sharing",
            "meeting_layout_changed": "the candidate changed the meeting layout",
            "side_panel_opened": "the candidate opened a session side panel",
            "captions_changed": "the candidate changed caption visibility",
            "chat_message_sent": "the candidate sent a chat message",
            "microphone_muted": "the candidate muted the microphone",
            "microphone_unmuted": "the candidate unmuted the microphone",
            "camera_disabled": "the candidate turned off the camera",
            "camera_enabled": "the candidate turned on the camera",
            "microphone_toggle_blocked": "a microphone toggle was blocked by assessment controls",
            "camera_toggle_blocked": "a camera toggle was blocked by assessment controls",
        }[name]
        # Routine layout/caption navigation is observed but does not cause an
        # unsolicited spoken turn. Intentful actions invite a brief response.
        if name in {"raised_hand", "opened_coding_playground", "opened_whiteboard", "screen_share_started", "chat_message_sent"}:
            detail_text = str(details.get("detail", ""))[:300]
            await self.engine.send_text_prompt(
                f"[LIVE UI EVENT: {summary}. {detail_text} Respond briefly only if a candidate-facing response is useful, then continue the interview. Do not infer intent from this interface action.]"
            )

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
                if data.get("type") == "scratchpad_updated":
                    note_data = data.get("data") or data.get("note") or {}
                    await self._orchestrate_scratchpad_update(note_data)
                res = self.send_json(data)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.debug(f"Error in send_json callback: {e}")

    async def _orchestrate_scratchpad_update(self, note: Dict[str, Any]):
        """Read each subagent/tool note and route a candidate-facing real-time action."""
        category = str(note.get("category", "general"))
        sentiment = str(note.get("sentiment", note.get("observation_type", "neutral"))).lower()
        confidence = note.get("confidence", note.get("confidence_score"))
        observation = str(note.get("observation", note.get("note", ""))).strip()
        if not observation:
            return

        if category == "visual_context" or category.startswith("visual_"):
            if note.get("camera_adjustment_required"):
                action = "camera_adjustment_required"
                message = "The camera view needs a brief adjustment so your face is visible. This does not affect your skill score."
            else:
                action = "visual_observation"
                message = "A sampled camera frame was reviewed. See the descriptive note; it does not affect your skill score."
        elif category == "integrity_and_proctoring":
            action = "explanation_required"
            message = "A possible session event was logged. Please briefly explain or add context; this is not a conclusion."
        elif sentiment in {"concern", "negative", "needs_improvement"}:
            action = "follow_up_needed"
            message = "The interviewer may ask you to clarify this point or give a concrete example."
        else:
            action = "evidence_recorded"
            message = "This answer was added to the evidence review for your selected skill or role."

        action_item = {
            "id": f"orch_{len(self.orchestrator_actions) + 1}_{int(time.time() * 1000)}",
            "action": action,
            "category": category,
            "message": message,
            "timestamp": time.strftime("%I:%M:%S %p"),
            "confidence": confidence,
            "source": str(note.get("source", "interview subagent")),
        }
        self.orchestrator_actions.append(action_item)
        result = self.send_json({"type": "orchestrator_action", "data": action_item})
        if asyncio.iscoroutine(result):
            await result

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
            "can you see me", "am i visible", "can you see my face", "is my camera on",
            "mujhe dekh", "mera camera", "meri video", "dikh raha hu", "dikh rahi hu",
            "क्या आप मुझे देख", "मेरा कैमरा", "मेरी वीडियो", "दिख रहा हूं", "दिख रही हूं",
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
        completed_ai_turn = self.current_ai_turn_text.strip()
        if self.current_ai_turn_text:
            self.transcript_log.append({"speaker": "Interviewer (AI)", "text": self.current_ai_turn_text})
            self.current_ai_turn_text = ""
        await self._emit_json({"type": "turn_complete"})
        closing_markers = (
            "that concludes our interview", "this concludes the interview",
            "the interview is concluded", "we're done with the interview",
            "we are done with the interview", "that is the end of the interview",
        )
        if completed_ai_turn and any(marker in completed_ai_turn.lower() for marker in closing_markers):
            self.interview_concluded = True
            await self._emit_json({"type": "conclude_interview", "reason": "The interviewer delivered the closing statement."})
            return

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

REAL-TIME ORCHESTRATOR ACTIONS:
{json.dumps(self.orchestrator_actions, indent=2)}

USER INTERFACE EVENTS (context only; never score as skill evidence):
{json.dumps(self.ui_events[-40:], indent=2)}

Visual-context notes are sampled frame descriptions only. Treat them as limited context; never use them to score skill, confidence, honesty, professionalism, emotion, gesture quality, or posture.

TRANSCRIPT LOG:
{json.dumps(self.transcript_log[-30:], indent=2)}

Generate a strictly valid JSON response with this schema:
{{
  "overallScore": null,
  "hiringDecision": "",
  "executiveSummary": "",
  "technicalScore": null,
  "communicationScore": null,
  "behavioralScore": null,
  "topStrengths": [],
  "areasForImprovement": [],
  "actionableRoadmap": [],
  "integrityReport": {{
    "status": "PASSED / FLAGGED_WITH_WARNINGS",
    "warningsIssued": {warning_count},
    "integrityScore": null
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

        raise RuntimeError("Live interview evaluation is unavailable; no score was issued.")

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
