import logging
from typing import List
from google.genai import types

logger = logging.getLogger("gemini_live.tools")

def get_live_tools() -> List[types.Tool]:
    """
    Returns native Gemini Live function declarations for active proctoring,
    malpractice warnings, disqualification, emoji reactions, and coding challenges.
    """
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="issue_proctor_warning",
                    description=(
                        "CRITICAL — ULTRA-STRICT PROCTORING: Call this function IMMEDIATELY for ANY of the following: "
                        "(1) Phone, tablet, smartwatch, or ANY secondary device visible anywhere in frame — even sitting on desk, "
                        "(2) Candidate repeatedly looking away from screen/camera — including looking down, to the side, or at a phone area, "
                        "(3) Another person visible or partially visible in the frame, "
                        "(4) Background voice or secondary audio detected, "
                        "(5) Notes, papers, sticky notes, or any written materials visible, "
                        "(6) Earpiece, earbud, or bluetooth headset detected, "
                        "(7) Signs of reading from a secondary screen or monitor. "
                        "This is a PROCTORED EXAM — zero tolerance. A phone merely being visible on the desk IS a violation. "
                        "Repeated gaze away from screen IS a violation. Do NOT wait for 'active use' — flag it immediately. "
                        "Pass the observed violation category and detailed evidence. The server assigns the authoritative warning number. "
                        "Also speak a FIRM verbal warning to the candidate."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "violation_type": types.Schema(
                                type=types.Type.STRING,
                                description="Specific category of integrity violation",
                                enum=[
                                    "mobile_phone_detected",
                                    "multiple_persons_detected",
                                    "background_voice",
                                    "gaze_away_from_screen",
                                    "notes_detected",
                                    "earpiece_detected",
                                    "screen_reading",
                                ]
                            ),
                            "warning_reason": types.Schema(
                                type=types.Type.STRING,
                                description="Describe the specific violation evidence: what device/person/material is visible, where in frame, and candidate's behavior"
                            )
                        },
                        required=["violation_type", "warning_reason"]
                    )
                ),
                types.FunctionDeclaration(
                    name="terminate_interview_for_malpractice",
                    description=(
                        "CRITICAL: Call this function to disqualify the candidate and terminate the interview immediately "
                        "if they commit a 3rd proctoring violation, or if blatant cheating is observed (e.g. actively using phone to lookup answers, "
                        "having a proxy interview assistant). Also verbally announce that they are disqualified."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "disqualification_reason": types.Schema(
                                type=types.Type.STRING,
                                description="Explicit reason for disqualification and termination"
                            ),
                            "severity": types.Schema(
                                type=types.Type.STRING,
                                description="Severity category of violation",
                                enum=["accumulated_warnings", "critical_malpractice", "unauthorized_device"]
                            )
                        },
                        required=["disqualification_reason", "severity"]
                    )
                ),
                types.FunctionDeclaration(
                    name="conclude_interview",
                    description=(
                        "End a completed interview and show the final evaluation report. Call only after the candidate clearly says they are finished, "
                        "or after you have explicitly delivered the interview closing. Do not use this for pauses, silence, or a request to repeat a question."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "closing_reason": types.Schema(type=types.Type.STRING, description="Brief reason the interview is concluding")
                        },
                        required=["closing_reason"],
                    ),
                ),
                types.FunctionDeclaration(
                    name="trigger_interviewer_reaction",
                    description=(
                        "Show a natural human reaction on screen — like nodding, raising an eyebrow, or looking impressed. "
                        "Use sparingly and only when you genuinely feel it. Don't react to every answer. "
                        "A real interviewer doesn't nod at everything — they nod when something is actually good."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "emoji": types.Schema(
                                type=types.Type.STRING,
                                description="Single emoji: 👍 (genuine approval/solid answer), 💡 (interesting insight you hadn't considered), 👏 (exceptional depth or clarity), ⚠️ (something doesn't add up), 🤔 (skeptical/need more evidence), 🎯 (nailed it precisely), ❌ (disqualification)"
                            ),
                            "reaction_reason": types.Schema(
                                type=types.Type.STRING,
                                description="Your honest internal reason for this reaction — what specifically triggered it"
                            )
                        },
                        required=["emoji"]
                    )
                ),
                types.FunctionDeclaration(
                    name="update_interview_scratchpad",
                    description=(
                        "YOUR private notepad — the candidate never sees this. Write like a real interviewer jotting quick notes during the interview. "
                        "Be specific and honest: 'Strong distributed systems intuition but couldn't articulate CAP trade-offs clearly', "
                        "'Claims 4yrs React but struggled with basic hooks question — red flag', "
                        "'Gave concrete metrics: reduced p99 from 2s to 200ms, sounds credible'. "
                        "Use score_delta honestly: positive for demonstrated competence, negative for gaps, red flags, or inconsistencies you caught. "
                        "Write a note after EVERY substantive answer — a real interviewer takes notes constantly."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "category": types.Schema(
                                type=types.Type.STRING,
                                enum=["technical_depth", "problem_solving", "communication", "leadership", "integrity_and_proctoring", "system_design", "domain_knowledge", "culture_fit", "red_flag"]
                            ),
                            "observation": types.Schema(
                                type=types.Type.STRING,
                                description="Your honest interviewer assessment — specific, evidence-based, like real handwritten interview notes. Include what they said AND what it tells you about their actual skill level."
                            ),
                            "sentiment": types.Schema(
                                type=types.Type.STRING,
                                enum=["positive", "neutral", "concern", "negative"]
                            ),
                            "score_delta": types.Schema(
                                type=types.Type.INTEGER,
                                description="Score impact: +5 to +10 for strong evidence, 0 for neutral, -5 to -10 for gaps, -15 to -20 for serious red flags or contradictions"
                            )
                        },
                        required=["category", "observation", "sentiment"]
                    )
                ),
                types.FunctionDeclaration(
                    name="push_coding_challenge",
                    description=(
                        "Open the split-screen code editor with a practical coding problem. Choose problems that test skills SPECIFIC to the job requirements — "
                        "not generic leetcode. For a backend role: API design, data modeling, concurrency. For frontend: component architecture, state management. "
                        "For ML: data pipeline, model evaluation. Make the candidate actually write and explain code, don't just discuss it."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "title": types.Schema(type=types.Type.STRING, description="Challenge title — concise and role-relevant"),
                            "problem_description": types.Schema(type=types.Type.STRING, description="Detailed problem statement with clear requirements, constraints, and expected behavior. Include edge cases to probe."),
                            "starter_code": types.Schema(type=types.Type.STRING, description="Minimal starter code — enough structure to get going, not so much that it gives away the solution"),
                            "language": types.Schema(type=types.Type.STRING, description="Programming language matching the role (e.g. python, javascript, typescript, java, go)")
                        },
                        required=["title", "problem_description", "starter_code", "language"]
                    )
                ),
                types.FunctionDeclaration(
                    name="control_interview_ui",
                    description=(
                        "Control a candidate-facing interview workspace element when it helps the interview: open the coding playground or whiteboard, "
                        "change the meeting layout, open a side panel, toggle captions, or show a brief reaction emoji. Never end the call, change microphone/camera permissions, "
                        "start screen sharing, or send chat messages on the candidate's behalf."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "action": types.Schema(
                                type=types.Type.STRING,
                                enum=["open_coding_playground", "open_whiteboard", "set_layout", "open_panel", "close_panel", "set_captions", "trigger_reaction"],
                            ),
                            "layout": types.Schema(
                                type=types.Type.STRING,
                                enum=["split", "interviewer_focus", "candidate_focus", "code_split", "whiteboard_split"],
                            ),
                            "panel": types.Schema(
                                type=types.Type.STRING,
                                enum=["people", "chat", "rubric", "notes", "proctor", "analysis"],
                            ),
                            "enabled": types.Schema(type=types.Type.BOOLEAN),
                            "emoji": types.Schema(type=types.Type.STRING, description="One brief reaction emoji when action is trigger_reaction"),
                        },
                        required=["action"],
                    ),
                )
            ]
        )
    ]
