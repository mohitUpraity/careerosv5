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
                        "CRITICAL: Call this function IMMEDIATELY whenever the candidate violates interview integrity on video: "
                        "such as holding or checking a mobile phone/device, repeatedly looking away/down at hidden screens or notes, "
                        "whispering to someone, another person appearing, or suspicious postures. "
                        "You must pass the sequential warning number (1, 2, or 3) and a detailed reason. "
                        "Also speak a firm verbal warning to the candidate."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "warning_number": types.Schema(
                                type=types.Type.INTEGER,
                                description="Sequential warning count: 1 for first offense, 2 for second offense, 3 for third offense"
                            ),
                            "violation_type": types.Schema(
                                type=types.Type.STRING,
                                description="Specific category of integrity violation",
                                enum=[
                                    "mobile_phone_detected",
                                    "looking_away",
                                    "multiple_persons_detected",
                                    "unusual_posture_or_gesture",
                                    "background_voice",
                                    "suspicious_movement",
                                ]
                            ),
                            "warning_reason": types.Schema(
                                type=types.Type.STRING,
                                description="Precise explanation of what was visually or auditorily detected (e.g., candidate holding smartphone, eyes averted sideways, phone in hand)"
                            )
                        },
                        required=["warning_number", "violation_type", "warning_reason"]
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
                    name="trigger_interviewer_reaction",
                    description=(
                        "Display a floating reaction emoji on the candidate screen to convey human interviewer warmth, "
                        "nodding approval, analytical thinking, or integrity caution."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "emoji": types.Schema(
                                type=types.Type.STRING,
                                description="Single emoji: 👍 (approval), 💡 (insight), 👏 (great explanation), ⚠️ (caution/alert), 🤔 (thinking), 🎯 (spot on), ❌ (disqualification)"
                            ),
                            "reaction_reason": types.Schema(
                                type=types.Type.STRING,
                                description="Short explanation for the reaction"
                            )
                        },
                        required=["emoji"]
                    )
                ),
                types.FunctionDeclaration(
                    name="update_interview_scratchpad",
                    description=(
                        "Record a real-time behavioral observation, technical assessment note, or score delta into the confidential candidate dossier."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "category": types.Schema(
                                type=types.Type.STRING,
                                enum=["technical_depth", "problem_solving", "communication", "integrity_and_proctoring", "system_design"]
                            ),
                            "observation": types.Schema(
                                type=types.Type.STRING,
                                description="Specific assessment observation"
                            ),
                            "sentiment": types.Schema(
                                type=types.Type.STRING,
                                enum=["positive", "neutral", "concern", "negative"]
                            ),
                            "score_delta": types.Schema(
                                type=types.Type.INTEGER,
                                description="Score delta from -20 to +10"
                            )
                        },
                        required=["category", "observation", "sentiment"]
                    )
                ),
                types.FunctionDeclaration(
                    name="push_coding_challenge",
                    description=(
                        "Trigger the split-screen interactive code editor with an algorithmic or system implementation challenge."
                    ),
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "title": types.Schema(type=types.Type.STRING, description="Challenge title"),
                            "problem_description": types.Schema(type=types.Type.STRING, description="Detailed problem statement"),
                            "starter_code": types.Schema(type=types.Type.STRING, description="Starter code template"),
                            "language": types.Schema(type=types.Type.STRING, description="Programming language (e.g. python, javascript)")
                        },
                        required=["title", "problem_description", "starter_code", "language"]
                    )
                )
            ]
        )
    ]
