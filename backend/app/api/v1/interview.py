import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.services.interview_service import interview_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interview", tags=["Job Preparation & Interview Arena"])

class ExtractNoticeRequest(BaseModel):
    raw_text: str

class JobIntelligenceRequest(BaseModel):
    company: str
    role: str
    job_description: Optional[str] = ""

class StartSessionRequest(BaseModel):
    company: str
    role: str
    job_description: Optional[str] = ""
    round_type: Optional[str] = "mixed" # 'tech' | 'project_defense' | 'behavioral' | 'mixed'
    difficulty: Optional[str] = "medium" # 'easy' | 'medium' | 'hard'
    blueprint_override: Optional[Dict[str, Any]] = None

class RespondSessionRequest(BaseModel):
    company: str
    role: str
    round_type: str = "mixed"
    current_question: Optional[str] = "Can you share an overview of your background and technical architecture?"
    candidate_answer: str
    step: int = 1
    total_steps: int = 5
    history: Optional[List[Dict[str, Any]]] = None
    job_description: Optional[str] = ""

class LiveRespondRequest(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = "Senior Software Engineer"
    candidate_answer: str
    current_question: Optional[str] = ""
    job_description: Optional[str] = ""
    resume_context: Optional[str] = ""
    history: Optional[List[Dict[str, Any]]] = None

class FinishSessionRequest(BaseModel):
    company: str
    role: str
    round_type: str = "mixed"
    history: List[Dict[str, Any]]

@router.post("/extract-notice", response_model=Dict[str, Any])
async def extract_raw_notice(
    req: ExtractNoticeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Parses unstructured college placement WhatsApp posts, notices, or messy JDs
    into a structured job & eligibility object.
    """
    try:
        data = await interview_service.extract_raw_notice(req.raw_text)
        return {
            "status": "success",
            "extracted_job": data
        }
    except Exception as e:
        logger.error(f"Failed to extract notice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/job-intelligence", response_model=Dict[str, Any])
async def get_job_intelligence(
    req: JobIntelligenceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generates 360° company background, candidate fit analysis, rounds blueprint,
    top 10 likely questions with hints, and cheatsheets.
    """
    user_id = current_user["id"]
    try:
        intel = await interview_service.get_job_intelligence(
            company=req.company,
            role=req.role,
            jd=req.job_description or "",
            user_id=user_id
        )
        return {
            "status": "success",
            "intelligence": intel
        }
    except Exception as e:
        logger.error(f"Failed to generate job intelligence: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/start", response_model=Dict[str, Any])
async def start_interview_session(
    req: StartSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Initializes an AI Mock Interview Arena session anchored on the candidate's resume blueprint.
    """
    user_id = current_user["id"]
    try:
        session_data = await interview_service.start_session(
            user_id=user_id,
            company=req.company,
            role=req.role,
            jd=req.job_description or "",
            round_type=req.round_type or "mixed",
            difficulty=req.difficulty or "medium",
            blueprint_override=req.blueprint_override
        )
        return {
            "status": "success",
            **session_data
        }
    except Exception as e:
        logger.error(f"Failed to start interview session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/respond", response_model=Dict[str, Any])
async def respond_interview_session(
    req: RespondSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Scores candidate's response in real-time, returns constructive feedback,
    and supplies the next adaptive interview question.
    """
    try:
        eval_result = await interview_service.evaluate_and_next(
            company=req.company,
            role=req.role,
            round_type=req.round_type,
            current_question=req.current_question,
            candidate_answer=req.candidate_answer,
            step=req.step,
            total_steps=req.total_steps,
            history=req.history,
            job_description=req.job_description or ""
        )
        return {
            "status": "success",
            "evaluation": eval_result
        }
    except Exception as e:
        logger.error(f"Failed to evaluate answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/live-respond", response_model=Dict[str, Any])
async def live_interview_turn(
    req: LiveRespondRequest
) -> Dict[str, Any]:
    """
    Rapid conversational response endpoint for Live Interview room fallback.
    Does not require strict authentication, allowing seamless conversational flow.
    """
    try:
        from app.services.llm_service import llm_service
        company = req.company or ""
        role = req.role or ""
        jd = req.job_description or ""
        resume = req.resume_context or ""

        system_prompt = f"""You are an elite, highly experienced Senior Engineering Hiring Lead at {company}, conducting a realistic technical video interview for {role}.
TARGET JOB CONTEXT:
{jd[:500]}
CANDIDATE RESUME / SKILL PROFILE:
{resume[:600]}

PROTOCOL:
1. Speak naturally like a senior interviewer on a video call. Keep responses conversational and sharp.
2. Acknowledge what the candidate just explained concisely (1 sentence).
3. Ask a sharp, insightful technical or architectural follow-up question directly related to their answer or project (1-2 sentences).
4. Keep total response to 2-3 sentences max. Speak conversationally without markdown formatting or bullet points."""

        user_prompt = f"Candidate Answer:\n{req.candidate_answer}\n\nPrevious Question: {req.current_question or 'Technical overview'}"
        response_text = await llm_service.chat_text(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.3)
        clean_text = response_text.strip().replace('"', '').replace('**', '')

        return {
            "status": "success",
            "next_question": clean_text,
            "interviewer_reaction": "Insightful technical explanation."
        }
    except Exception as e:
        logger.error(f"Live response generation failed: {e}")
        raise HTTPException(status_code=503, detail="Live interview response is unavailable. Please retry.")

@router.post("/session/finish", response_model=Dict[str, Any])
async def finish_interview_session(
    req: FinishSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Produces final hireability scorecard, verdict, competency matrix, and study plan.
    """
    try:
        scorecard = await interview_service.generate_final_scorecard(
            company=req.company,
            role=req.role,
            round_type=req.round_type,
            conversation_history=req.history
        )
        return {
            "status": "success",
            "scorecard": scorecard
        }
    except Exception as e:
        logger.error(f"Failed to generate final scorecard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=Dict[str, Any])
async def get_interview_history(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Fetches the candidate's past completed mock interview sessions, scores, and behavioral radar metrics.
    """
    user_id = current_user["id"]
    try:
        from app.services.neo4j_service import neo4j_service
        query = """
        MATCH (u:User {id: $user_id})-[:ATTENDED_INTERVIEW]->(s:InterviewSession)
        RETURN s.id AS id,
               s.company AS company,
               s.role AS role,
               s.technical_score AS technical_score,
               s.speech_voice_score AS speech_voice_score,
               s.body_language_score AS body_language_score,
               s.integrity_score AS integrity_score,
               s.verdict AS verdict,
               s.summary AS summary,
               toString(s.completed_at) AS completed_at,
               s.duration_minutes AS duration_minutes
        ORDER BY s.completed_at DESC
        LIMIT 10
        """
        records = await neo4j_service.run_query(query, user_id=user_id)
        return {
            "status": "success",
            "history": records or []
        }
    except Exception as e:
        logger.warning(f"Could not load interview history from Neo4j: {e}")
        raise HTTPException(status_code=503, detail="Interview history is unavailable.") from e


@router.post("/run-code", response_model=Dict[str, Any])
async def run_code_simulation(
    req: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes or simulates code execution for the live interview coding canvas.
    """
    code = req.get("code", "")
    language = req.get("language", "javascript")

    if not code.strip():
        return {"success": False, "output": "No code provided."}

    try:
        from app.services.llm_service import llm_service
        system_prompt = f"You are a code execution runtime. Output ONLY the exact standard output and standard error from running this {language} code. Do not output explanations or markdown wrappers."
        user_prompt = f"Code:\n{code}"
        
        output = await llm_service.chat(system_prompt=system_prompt, user_prompt=user_prompt)
        return {
            "success": True,
            "output": output or "Code executed successfully (no output)."
        }
    except Exception as e:
        logger.error(f"Code execution error: {e}")
        return {
            "success": False,
            "output": f"Execution error: {str(e)}"
        }


@router.post("/analyze-live-turn", response_model=Dict[str, Any])
async def analyze_live_turn(req: Dict[str, Any]) -> Dict[str, Any]:
    """Return a provisional, evidence-linked observation for one completed answer."""
    answer = str(req.get("answer", "")).strip()
    if not answer:
        raise HTTPException(status_code=400, detail="Answer text is required.")
    skill = str(req.get("skillAssessment") or "")
    role = str(req.get("role") or "")
    job_description = str(req.get("jobDescription") or "")[:1800]
    question = str(req.get("question") or "")[:700]
    prompt = f"""Analyze this completed interview answer for immediate candidate feedback. Assessment target: {skill or role or 'general interview'}.
Job description / rubric context: {job_description or 'Use only general interview communication criteria.'}
Question: {question or 'Not provided'}
Answer: {answer[:5000]}
Return JSON only with keys: {{"headline": "short neutral observation", "evidence": "brief exact paraphrase or quote from this answer", "rubric_area": "skill/rubric area tested", "feedback": "one actionable suggestion", "confidence": "high|medium|limited"}}.
Ground every claim in this answer. Do not infer personality, honesty, emotion, intelligence, or competence from voice, accent, pauses, gaze, posture, or gestures. If evidence is insufficient, say so. This is provisional feedback, not a final score."""
    try:
        from app.services.llm_service import llm_service
        result = await asyncio.wait_for(
            llm_service.chat_json(system_prompt="You provide careful, candidate-facing interview feedback.", user_prompt=prompt),
            timeout=8.0,
        )
        if isinstance(result, dict) and result.get("headline"):
            return result
    except Exception as exc:
        logger.info("Live answer analysis unavailable: %s", exc)
    return {
        "headline": "Answer captured for the final skill review",
        "evidence": answer[:240],
        "rubric_area": skill or role or "Interview response",
        "feedback": "The detailed analysis will appear in your final report.",
        "confidence": "limited",
    }


@router.post("/evaluate-interview", response_model=Dict[str, Any])
async def evaluate_interview_full(
    req: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generates the comprehensive 360-degree interview evaluation report and scorecard.
    """
    transcript = req.get("transcript", [])
    role = req.get("role", "")
    seniority = req.get("seniority", "")
    code_snippet = req.get("codeSnippet", "")
    notes = req.get("notes", "")
    skill_assessment = req.get("skillAssessment")
    interview_format = str(req.get("format", ""))
    job_description = req.get("jobDescription", "")
    # Count distinct canonical candidate utterances. The browser previously mixed
    # Gemini transcripts with Web Speech captions, which could duplicate evidence.
    candidate_answers = []
    seen_answers = set()
    for item in transcript if isinstance(transcript, list) else []:
        if str(item.get("speaker", "")).lower() not in {"user", "candidate", "candidate (text)"}:
            continue
        text = str(item.get("text", "")).strip()
        normalized = " ".join(text.lower().split())
        if len(normalized.split()) >= 3 and normalized not in seen_answers:
            seen_answers.add(normalized)
            candidate_answers.append(text)
    answer_word_count = sum(len(answer.split()) for answer in candidate_answers)
    candidate_turns = len(candidate_answers)
    live_analysis = req.get("liveAnalysis", [])
    session_observations = req.get("sessionObservations", [])
    orchestrator_actions = req.get("orchestratorActions", [])
    ui_events = req.get("uiEvents", [])
    proctor_events = req.get("proctorEvents", [])
    disqualified = bool(req.get("disqualified", False))
    termination_reason = str(req.get("terminationReason", ""))[:500]
    warnings_issued = max(int(req.get("warningsIssued", 0) or 0), len(proctor_events))

    if disqualified:
        return {
            "assessmentStatus": "incomplete",
            "overallScore": None,
            "hiringDecision": "Interview ended after proctor escalation",
            "executiveSummary": (
                "The interview ended after the proctoring escalation limit was reached. "
                "This is a session-integrity outcome, not an assessment of the candidate's skill."
            ),
            "metrics": [],
            "topStrengths": [],
            "areasForImprovement": [],
            "actionableStudyRoadmap": ["If you believe the automated flags were mistaken, review the recorded session events with the assessment administrator."],
            "evidenceSummary": [{
                "area": "Session integrity",
                "evidence": termination_reason or f"{len(proctor_events)} proctor event(s) were recorded before the interview ended.",
                "confidence": "review required",
            }],
            "communicationAnalysis": {"clarity": "Not scored", "structure": "Not scored", "pace": "Not scored"},
            "proctoringSummary": "Interview ended after proctor escalation. Recorded events are reviewable and are not skill evidence.",
            "integrityReport": {"status": "TERMINATED_FOR_REVIEW", "warningsIssued": warnings_issued, "events": proctor_events},
        }

    coding_format = "coding" in interview_format.lower() or "program" in str(skill_assessment or "").lower()
    insufficient_evidence = candidate_turns < 3 or answer_word_count < 60 or (coding_format and not code_snippet.strip())
    if insufficient_evidence:
        reasons = []
        if candidate_turns < 3 or answer_word_count < 60:
            reasons.append("too few substantive candidate answers were captured")
        if coding_format and not code_snippet.strip():
            reasons.append("no code artifact was submitted for the coding portion")
        report = {
            "assessmentStatus": "incomplete",
            "overallScore": None,
            "hiringDecision": "Insufficient evidence",
            "executiveSummary": (
                "This session does not support a reliable skill score or hiring verdict because "
                + " and ".join(reasons)
                + ". The available answers below are preliminary evidence only; this is not a finding that the candidate lacks the skill."
            ),
            "metrics": [],
            "topStrengths": [],
            "areasForImprovement": ["Complete the missing interview evidence before interpreting performance."],
            "questionBreakdown": [],
            "actionableStudyRoadmap": ["Retake or resume the interview and complete the required role-specific questions and practical exercise."],
            "evidenceSummary": [
                {"area": "Session completeness", "evidence": f"Captured {candidate_turns} distinct substantive answers ({answer_word_count} words).", "confidence": "high"}
            ],
            "communicationAnalysis": {"clarity": "Not enough recorded speech to assess reliably.", "structure": "Not enough recorded speech to assess reliably.", "pace": "Insufficient audio transcript evidence."},
            "proctoringSummary": "Logged events are shown separately and do not establish skill or intent.",
        }
        return report

    transcript_text = "\n".join([f"{item.get('speakerName', item.get('speaker', 'Speaker'))}: {item.get('text', '')}" for item in transcript])

    system_prompt = f"""You are a Principal Engineering Hiring Lead conducting a comprehensive post-interview evaluation.
Target Role: {role} ({seniority})
Interview format: {interview_format}
Job requirements: {job_description[:5000] or 'No job description supplied.'}
Assess only areas the interview actually tested. Cite specific answers or submitted work for every positive or negative claim. Distinguish “not demonstrated in this session” from “does not have the skill”; an unasked question or missing opportunity is not proof of weakness. Proctor events must never change skill scores or hiring verdicts.
User interface events are operational context only and must never count as skill evidence or change scores.

Evaluate the candidate based on their transcript and code:
Transcript:
{transcript_text[:2000]}

Candidate Code / System Design:
{code_snippet or notes or 'No separate code written.'}

Return STRICTLY a JSON object with this schema:
{{
  "overallScore": null,
  "assessmentStatus": "complete / incomplete",
  "hiringDecision": "",
  "executiveSummary": "",
  "metrics": [
    {{ "category": "rubric area", "score": null, "feedback": "" }}
  ],
  "topStrengths": [],
  "areasForImprovement": [],
  "questionBreakdown": [
    {{
      "topic": "tested topic",
      "candidateResponseQuality": "",
      "interviewerNotes": ""
    }}
  ],
  "actionableStudyRoadmap": ["Step 1", "Step 2", "Step 3"],
  "evidenceSummary": [{{"area": "rubric area", "evidence": "specific transcript/code evidence", "confidence": "high / medium / limited"}}],
  "communicationAnalysis": {{"clarity": "evidence-based observation", "structure": "evidence-based observation", "pace": "transcript-based estimate or insufficient data"}},
  "proctoringSummary": "Summarize logged objective events only; do not infer intent from gaze, posture, gestures, or pauses."
}}"""

    if skill_assessment:
        system_prompt = f"""You are an independent expert assessor for a high-stakes live skill assessment.
Assess only demonstrated skill: {skill_assessment}. Use this skill-specific interview plan and rubric: {job_description[:3000]}
Do not reward unsupported claims, resume history, generic confidence, or interviewer hints. Judge the actual spoken answers and submitted work. For programming skills, inspect the code for correctness, edge cases, clarity, and trade-offs. For leadership, communication, and product skills, judge concrete case decisions, ownership, listening, prioritization, and clarity. Missing evidence scores low. Never invent evidence.
Distinguish “not demonstrated in this session” from “does not have the skill.” Score only competencies that were actually tested; if too little evidence exists to assess fairly, return assessmentStatus=incomplete, overallScore=null, and hiringDecision="Insufficient evidence". Proctor events must never change skill scores or the hiring decision.
User interface events are operational context only and must never count as skill evidence or change scores.
Candidate answer turns: {candidate_turns}
Interview format: {interview_format}
Transcript:\n{transcript_text[:9000]}
        Candidate code/work artifact:\n{code_snippet or notes or 'No separate artifact submitted.'}
Live turn-by-turn evidence notes (verify against the complete transcript; these are provisional):
{json.dumps(live_analysis, ensure_ascii=False)[:5000]}
Private interviewer/session observations (treat as unverified context and cite only if supported by transcript or an objective event):
{json.dumps(session_observations, ensure_ascii=False)[:4000]}

Return STRICTLY JSON: {{"overallScore": integer 0-100 or null, "assessmentStatus": "complete" or "incomplete", "hiringDecision": "Strong Hire / Hire / Lean Hire / No Hire / Insufficient evidence", "executiveSummary": "Evidence-based assessment and limits", "metrics": [{{"category": "skill-specific rubric area", "score": integer 0-100 or null, "feedback": "cite concrete evidence"}}], "topStrengths": ["evidence-backed strength"], "areasForImprovement": ["specific gap"], "questionBreakdown": [{{"topic": "tested area", "candidateResponseQuality": "Exceptional / Solid / Adequate / Needs Improvement", "interviewerNotes": "specific evidence"}}], "actionableStudyRoadmap": ["specific next step"], "evidenceSummary": [{{"area": "rubric area", "evidence": "specific transcript/code evidence", "confidence": "high / medium / limited"}}], "communicationAnalysis": {{"clarity": "evidence-based observation", "structure": "evidence-based observation", "pace": "transcript-based estimate or insufficient data"}}, "proctoringSummary": "Summarize logged objective events only; do not infer intent from gaze, posture, gestures, or pauses."}}"""

    report = None
    try:
        from app.services.llm_service import llm_service
        report = await llm_service.chat_json(
            system_prompt=system_prompt,
            user_prompt=("Generate a full-session report. Review provisional live notes against the complete transcript and submitted artifact. "
                         "Use only the objective proctor events below; they are session context, not proof of misconduct. "
                         "Do not score accent, inferred emotion, gaze, posture, or gesture quality.\n"
                         f"Provisional live answer analysis: {json.dumps(live_analysis, ensure_ascii=False)[:5000]}\n"
                         f"Session observations (unverified; use only if supported by transcript/objective event): {json.dumps(session_observations, ensure_ascii=False)[:4000]}\n"
                         f"Orchestrator actions routed during the session: {json.dumps(orchestrator_actions, ensure_ascii=False)[:3000]}\n"
                         f"Candidate interface actions (operational context only): {json.dumps(ui_events, ensure_ascii=False)[:3000]}\n"
                         f"Objective proctor events: {json.dumps(proctor_events, ensure_ascii=False)[:3000]}"),
        )
    except Exception as e:
        logger.error(f"Error generating full evaluation: {e}")

    if not (report and isinstance(report, dict) and "overallScore" in report):
        raise HTTPException(status_code=503, detail="Interview evaluation is unavailable. No score or verification was issued; please retry later.")
    report.setdefault("assessmentStatus", "complete")

    # Persist session to Neo4j for Mock Interview History tracking
    try:
        from app.services.neo4j_service import neo4j_service
        import uuid
        company = req.get("company") or ""
        user_id = current_user["id"]
        session_id = f"eval_{uuid.uuid4().hex[:8]}"

        m_dict = {m.get("category", ""): m.get("score") for m in report.get("metrics", [])}
        query = """
        MERGE (u:User {id: $user_id})
        CREATE (s:InterviewSession {
            id: $session_id,
            company: $company,
            role: $role,
            technical_score: $tech_score,
            verdict: $verdict,
            summary: $summary,
            completed_at: datetime()
        })
        CREATE (u)-[:ATTENDED_INTERVIEW]->(s)
        RETURN s.id
        """
        await neo4j_service.run_query(
            query,
            user_id=user_id,
            session_id=session_id,
            company=company,
            role=role,
            tech_score=m_dict.get("Technical Competence & Knowledge"),
            verdict=report.get("hiringDecision"),
            summary=report.get("executiveSummary"),
        )
        logger.info(f"Persisted evaluation report {session_id} to Neo4j")
    except Exception as ne:
        logger.debug(f"Could not persist evaluation to Neo4j: {ne}")

    return report


from fastapi import WebSocket, WebSocketDisconnect, Query
from app.services.gemini_live_service import GeminiLiveSession
from app.services.profile_service import profile_service

# Binary frame protocol (browser <-> backend). First byte = frame type.
#   client -> server: 0x01 = PCM16 mono 16 kHz mic audio, 0x02 = JPEG camera frame
#   server -> client: 0x01 = PCM16 mono 24 kHz interviewer audio
# JSON text frames carry control/transcript events (and legacy base64 audio/video).
FRAME_AUDIO = 0x01
FRAME_VIDEO = 0x02


@router.websocket("/live")
@router.websocket("/live-ws")
async def live_interview_websocket(
    websocket: WebSocket,
    user_id: str = "",
    company: str = "",
    role: str = "",
    job_description: str = "",
    voice: str = "Zephyr",
    round_type: str = "mixed",
    difficulty: str = "medium"
):
    """
    Bidirectional WebSocket bridge for the Live Interview Arena.

    Latency notes: binary audio frames (no base64/JSON), a send lock so concurrent producers
    can't interleave frames, media queued toward Gemini by the session's own sender task, and
    ``ready`` is only sent once the Gemini session really exists (it used to be sent
    immediately, before connect() had even started).
    """
    await websocket.accept()

    q = websocket.query_params
    u_id = str(q.get("user_id", user_id))
    comp = str(q.get("company", company))
    rl = str(q.get("role", role))
    vc = str(q.get("voice", voice if not hasattr(voice, "default") else "Zephyr"))
    jd = str(q.get("job_description", job_description if not hasattr(job_description, "default") else ""))
    rnd = str(q.get("round_type", round_type if not hasattr(round_type, "default") else "mixed"))
    diff = str(q.get("difficulty", difficulty if not hasattr(difficulty, "default") else "medium"))

    logger.info(f"Live Interview WebSocket accepted: user={u_id}, company={comp}, role={rl}")

    send_lock = asyncio.Lock()
    closed = False

    async def send_to_frontend(payload: Dict[str, Any]):
        if closed:
            return
        try:
            async with send_lock:
                await websocket.send_text(json.dumps(payload, default=str))
        except Exception as err:
            logger.debug(f"Failed to forward message to frontend: {err}")

    async def send_audio_to_frontend(pcm: bytes):
        if closed:
            return
        try:
            async with send_lock:
                await websocket.send_bytes(bytes([FRAME_AUDIO]) + pcm)
        except Exception as err:
            logger.debug(f"Failed to forward audio to frontend: {err}")

    await send_to_frontend({"type": "status", "message": "Connecting to interviewer..."})

    # Kick off the (slow) profile lookup immediately; it overlaps with waiting for `setup`.
    default_resume = "No resume details were provided; ask the candidate to describe their background and projects."
    async def _load_resume() -> str:
        try:
            profile_data = await asyncio.wait_for(
                profile_service.get_comprehensive_profile_analysis(u_id), timeout=1.5
            )
            if profile_data:
                skills = [s.get("name") for s in profile_data.get("skills", []) if s.get("name")]
                projects = [f"{p.get('name')}: {p.get('description')}" for p in profile_data.get("projects", [])]
                return f"Candidate Skills: {', '.join(skills[:15])}\nProjects:\n" + "\n".join(projects[:3])
        except Exception as e:
            logger.debug(f"Using default resume context: {e}")
        return default_resume

    resume_task = asyncio.create_task(_load_resume())

    # The client sends `setup` first. Wait briefly for it so the system prompt is built with the
    # real role/voice/resume (previously `setup` raced connect() and was silently ignored).
    setup: Dict[str, Any] = {}
    first_frame = None
    try:
        first_frame = await asyncio.wait_for(websocket.receive(), timeout=2.0)
        if first_frame.get("type") == "websocket.disconnect":
            resume_task.cancel()
            return
        if first_frame.get("text"):
            try:
                m = json.loads(first_frame["text"])
                if m.get("type") == "setup":
                    setup, first_frame = m, None
            except Exception:
                pass
    except asyncio.TimeoutError:
        pass

    resume_context = await resume_task
    if setup.get("customContext"):
        resume_context = str(setup["customContext"])

    session = GeminiLiveSession(
        user_id=u_id,
        company=comp,
        role=str(setup.get("role") or rl),
        job_description=jd,
        resume_context=resume_context,
        voice_name=str(setup.get("voice") or vc),
        round_type=rnd,
        difficulty=diff,
        send_to_client_callback=send_to_frontend,
        send_audio_to_client_callback=send_audio_to_frontend,
        candidate_name=str(setup.get("candidateName") or ""),
    )

    async def _connect_and_announce():
        await session.connect()
        await send_to_frontend({
            "type": "ready",
            "message": "Interviewer connected",
            "engine": session.engine_mode,
            "model": session.model_in_use,
            "company": session.company,
            "role": session.role,
            "voice": session.voice_name,
            "inputSampleRate": 16000,
            "outputSampleRate": 24000,
        })

    connect_task = asyncio.create_task(_connect_and_announce())

    def _connect_done(t: asyncio.Task):
        if not t.cancelled() and t.exception():
            logger.error(f"Live session connect failed: {t.exception()}", exc_info=t.exception())
    connect_task.add_done_callback(_connect_done)

    async def handle_frame(frame: Dict[str, Any]) -> bool:
        """Returns False when the loop should end."""
        if frame.get("type") == "websocket.disconnect":
            return False
        data = frame.get("bytes")
        if data:
            kind, payload = data[0], data[1:]
            if kind == FRAME_AUDIO:
                session.push_audio(payload)
            elif kind == FRAME_VIDEO:
                session.push_video(payload)
            return True

        raw = frame.get("text")
        if not raw:
            return True
        msg = json.loads(raw)
        msg_type = msg.get("type")

        if msg_type == "setup":
            logger.debug("Late setup message ignored (session already built).")
        elif msg_type in ("audio", "audio_chunk"):
            if msg.get("data"):
                await session.send_audio_chunk(msg["data"], msg.get("mimeType", "audio/pcm;rate=16000"))
        elif msg_type in ("video", "video_frame"):
            if msg.get("data"):
                await session.send_video_frame(msg["data"])
        elif msg_type in ("text", "text_prompt"):
            text = msg.get("data") or msg.get("text", "")
            if text:
                await session.send_text_message(text)
        elif msg_type == "audio_stream_end":
            await session.end_audio_stream()
        elif msg_type == "ping":
            await send_to_frontend({"type": "pong", "t": msg.get("t")})
        elif msg_type == "interrupt":
            await session.handle_client_interrupt()
        elif msg_type == "conclude_session":
            await session.request_conclusion()
            return False
        return True

    try:
        if first_frame is not None and not await handle_frame(first_frame):
            return
        while True:
            frame = await websocket.receive()
            if not await handle_frame(frame):
                break
    except WebSocketDisconnect:
        logger.info(f"Candidate disconnected from Live Interview session {session.session_id}")
    except Exception as e:
        logger.error(f"Error in Live Interview WebSocket: {e}", exc_info=True)
        await send_to_frontend({"type": "error", "message": str(e)})
    finally:
        closed = True
        connect_task.cancel()
        await session.close()
