import json
import logging
import re
import uuid
from typing import Dict, Any, Optional, List
from app.services.llm_service import llm_service
from app.services.neo4j_service import neo4j_service

logger = logging.getLogger(__name__)

class InterviewService:
    @classmethod
    async def extract_raw_notice(cls, raw_text: str) -> Dict[str, Any]:
        """
        Extracts structured job intelligence from unstructured college placement notices,
        WhatsApp group forwards, and raw job postings.
        """
        if not raw_text or not raw_text.strip():
            raise ValueError("Raw text cannot be empty")

        system_prompt = """You are an expert Talent Acquisition AI and University Placement parser.
Extract structured job details from the provided unstructured college placement notice, WhatsApp group forward, or raw job description.
Be precise and thorough in extracting eligibility criteria, batch, CGPA requirements, package/stipend, and selection rounds.

Return STRICTLY a JSON object with this schema:
{
  "company": "Company Name",
  "role": "Job Role / Title (e.g., Software Development Engineer - Intern / Full-Time)",
  "location": "Location (e.g., Bengaluru, Hybrid, Remote, On-site)",
  "work_mode": "Remote / Hybrid / On-site",
  "opportunity_type": "Job / Internship / Apprenticeship",
  "ctc_stipend": "Compensation details (e.g., ₹12 - 16 LPA or ₹45,000 / month)",
  "eligibility": {
    "eligible_batches": ["2025", "2026"],
    "degrees": ["B.Tech", "M.Tech", "MCA"],
    "min_cgpa": "7.0 / 70%",
    "backlog_allowed": "No active backlogs",
    "other_criteria": "string"
  },
  "skills_required": ["Skill 1", "Skill 2", "Skill 3"],
  "selection_rounds": [
    {
      "round_number": 1,
      "round_name": "Online Assessment (OA)",
      "description": "DSA, Aptitude, Core CS MCQs (90 mins on HackerEarth/Mettl)"
    },
    {
      "round_number": 2,
      "round_name": "Technical Round 1",
      "description": "Live DSA, Problem Solving, Language fundamentals"
    },
    {
      "round_number": 3,
      "round_name": "Technical Round 2 & System Design",
      "description": "Project deep dive, High/Low Level Design, Database design"
    },
    {
      "round_number": 4,
      "round_name": "HR & Techno-Managerial Round",
      "description": "Culture fit, behavioral questions, compensation & joining discussion"
    }
  ],
  "deadline": "YYYY-MM-DD or deadline string mentioned",
  "apply_url": "Registration / Application link or empty string",
  "summary": "2-3 line executive summary of the opportunity"
}"""

        user_prompt = f"Raw Unstructured Placement Notice / Job Forward:\n\n{raw_text}"
        
        try:
            result = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1
            )
            if result and isinstance(result, dict) and result.get("company"):
                return result
        except Exception as e:
            logger.warning(f"LLM extract_raw_notice error: {e}")

        # Fallback heuristic parser if LLM fails
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
        first_line = lines[0] if lines else "Target Company"
        
        # Regex heuristics
        company_match = re.search(r'(?:hiring|drive|company|at)\s*[:\-]?\s*([A-Za-z0-9\s&]+)', raw_text, re.IGNORECASE)
        company = company_match.group(1).strip() if company_match else (first_line[:30] if len(first_line) <= 30 else "Hiring Company")
        
        role_match = re.search(r'(?:role|position|profile|title)\s*[:\-]?\s*([A-Za-z0-9\s/]+)', raw_text, re.IGNORECASE)
        role = role_match.group(1).strip() if role_match else "Software Development Engineer"
        
        ctc_match = re.search(r'(?:ctc|package|salary|stipend)\s*[:\-]?\s*([₹$0-9,\.\s\-LPAlpaKk/month]+)', raw_text, re.IGNORECASE)
        ctc = ctc_match.group(1).strip() if ctc_match else "Industry Standard / As per policy"

        return {
            "company": company,
            "role": role,
            "location": "India / Hybrid",
            "work_mode": "Hybrid",
            "opportunity_type": "Job",
            "ctc_stipend": ctc,
            "eligibility": {
                "eligible_batches": ["2025", "2026"],
                "degrees": ["B.Tech / B.E / MCA / M.Tech"],
                "min_cgpa": "6.5+ CGPA",
                "backlog_allowed": "No active backlogs",
                "other_criteria": "Clean academic record"
            },
            "skills_required": ["Data Structures", "Algorithms", "Problem Solving", "Core CS Fundamentals", "React / Node / Python"],
            "selection_rounds": [
                {"round_number": 1, "round_name": "Online Assessment (OA)", "description": "Coding & Core CS fundamentals"},
                {"round_number": 2, "round_name": "Technical Round", "description": "DSA, live problem solving & project breakdown"},
                {"round_number": 3, "round_name": "HR & Fitment Round", "description": "Behavioral & cultural fitment"}
            ],
            "deadline": "",
            "apply_url": "",
            "summary": f"Placement opportunity for {role} at {company}."
        }

    @classmethod
    async def get_job_intelligence(
        cls,
        company: str,
        role: str,
        jd: str,
        user_id: str,
        user_skills: Optional[List[str]] = None,
        user_projects: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generates 360° deep company & candidate match intelligence, interview format blueprint,
        top 10 high-probability questions with hints & traps, and a fast-track conceptual cheatsheet.
        """
        # Fetch candidate profile details if not passed
        if user_skills is None or user_projects is None:
            try:
                # Interview prep is grounded in the saved resume blueprint only.
                blueprint = await neo4j_service.get_user_resume_blueprint(user_id) or {}
                user_skills = [
                    skill
                    for category in blueprint.get("skills", [])
                    if isinstance(category, dict)
                    for skill in category.get("skills", [])
                ]
                user_projects = blueprint.get("projects", [])
            except Exception as e:
                logger.warning(f"Failed to fetch profile for job intelligence: {e}")
                user_skills = user_skills or []
                user_projects = user_projects or []

        projects_summary = "\n".join([
            f"- {p.get('name', 'Project')}: {'; '.join(p.get('bullets', [])[:2])} (Tech: {p.get('tech_stack', '')})"
            for p in user_projects[:4]
        ])

        system_prompt = """You are a Principal Engineering Interviewer and Career Strategist.
Generate a job and interview intelligence dossier using only the supplied company name, role, job description, and resume evidence. You have no web research tool: do not invent current company facts, culture, stack, recent initiatives, hiring rounds, or candidate credentials. Mark unsupported company details as unknown and derive role competencies/questions from the JD. Clearly distinguish JD requirements from resume evidence.

Return STRICTLY a JSON object with this schema:
{
  "company_intel": {
    "company_name": "Company Name",
    "business_overview": "2-3 sentences explaining what the company builds, its scale, and market position",
    "engineering_culture": "Description of their engineering footprint, coding standards, and deployment culture",
    "tech_stack_footprint": ["Key Tech 1", "Key Tech 2", "Key Tech 3", "Key Tech 4"],
    "recent_focus_areas": ["Recent engineering / product focus 1", "Focus 2"]
  },
  "candidate_fit_assessment": {
    "match_score": 85,
    "verdict": "High Fit / Strong Contender",
    "key_advantages": ["Advantage 1 anchored on their actual skills/projects", "Advantage 2"],
    "critical_gaps": ["Critical gap 1 to address immediately", "Gap 2"],
    "tailored_pitch": "A 2-3 sentence elevator pitch the candidate should say in 'Tell me about yourself'"
  },
  "interview_rounds_blueprint": [
    {
      "round_name": "Round 1: Online Assessment / DSA Screening",
      "focus": "Algorithms, HashMaps, Two Pointers, Time Complexity",
      "duration": "60-90 mins",
      "weightage": "High Filter"
    },
    {
      "round_name": "Round 2: Core Engineering & Tech Stack Deep Dive",
      "focus": "Framework internals, concurrency, async I/O, database indexing",
      "duration": "45-60 mins",
      "weightage": "Core Technical Bar"
    },
    {
      "round_name": "Round 3: System Design & Project Defense",
      "focus": "Defending candidate's actual projects, scalability trade-offs, caching, failovers",
      "duration": "60 mins",
      "weightage": "Seniority / Bar Raiser"
    },
    {
      "round_name": "Round 4: Behavioral & Leadership Fit",
      "focus": "STAR format situational responses, handling conflict, cross-functional delivery",
      "duration": "30-45 mins",
      "weightage": "Offer Decision"
    }
  ],
  "top_interview_questions": [
    {
      "id": "q1",
      "category": "DSA / Algorithmic Problem Solving",
      "question": "Realistic question likely asked by this company",
      "why_asked": "What the interviewer is testing",
      "hint": "Key architectural / algorithmic clue",
      "expected_structure": "Step 1 -> Step 2 -> Optimal approach",
      "common_pitfall": "Mistake most candidates make"
    },
    {
      "id": "q2",
      "category": "Core Backend & Language Internals",
      "question": "Question on concurrency, DB indexing, or framework internals",
      "why_asked": "Testing depth over shallow syntax",
      "hint": "Underlying mechanism",
      "expected_structure": "Internal mechanics -> Memory/Execution model -> Trade-off",
      "common_pitfall": "Superficial answer"
    },
    {
      "id": "q3",
      "category": "System Design & Project Defense",
      "question": "Question specifically challenging the candidate's projects or target role",
      "why_asked": "Checking if candidate genuinely built their projects or just followed a tutorial",
      "hint": "Focus on bottleneck identification and metrics",
      "expected_structure": "Architecture walkthrough -> Bottleneck identification -> Solution",
      "common_pitfall": "Hand-waving without concrete trade-offs"
    },
    {
      "id": "q4",
      "category": "Database & Data Modeling",
      "question": "Query optimization, indexing strategy, or ACID vs BASE question",
      "why_asked": "Data layer competency",
      "hint": "Consider read vs write heavy scenarios",
      "expected_structure": "Schema design -> Index selection -> Edge cases",
      "common_pitfall": "Over-indexing or ignoring write penalties"
    },
    {
      "id": "q5",
      "category": "Behavioral / STAR Method",
      "question": "Challenging behavioral question relevant to this company's culture",
      "why_asked": "Evaluating ownership and conflict resolution",
      "hint": "Use STAR (Situation, Task, Action, Result)",
      "expected_structure": "Context -> Action taken with 'I' -> Quantifiable business result",
      "common_pitfall": "Speaking in vague generalities with 'we'"
    }
  ],
  "cheat_sheet": {
    "key_concepts_to_revise": ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
    "system_design_checklist": ["Checklist item 1", "Checklist item 2", "Checklist item 3"],
    "red_flags_to_avoid": ["Red flag 1", "Red flag 2"]
  }
}"""

        user_prompt = f"""Target Company: {company}
Target Role: {role}

Target Job Description:
{jd or 'Standard SDE / Full-Stack Engineer requirements'}

Candidate Profile:
- Master Skills: {', '.join(user_skills[:20])}
- Projects:
{projects_summary or 'No projects registered yet'}
"""

        try:
            intel = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2
            )
            if intel and isinstance(intel, dict) and intel.get("company_intel"):
                return intel
        except Exception as e:
            logger.warning(f"Failed to generate deep job intelligence via LLM: {e}")

        # Honest fallback when generation fails; do not fabricate employer or candidate facts.
        return {
            "company_intel": {
                "company_name": company,
                "business_overview": "Company background could not be verified from the supplied job description.",
                "engineering_culture": "Not stated in the supplied job description.",
                "tech_stack_footprint": [],
                "recent_focus_areas": []
            },
            "candidate_fit_assessment": {
                "match_score": 0,
                "verdict": "Unable to assess; intelligence generation failed",
                "key_advantages": [f"Resume lists: {', '.join(user_skills[:4])}"] if user_skills else [],
                "critical_gaps": [
                    "Retry intelligence generation to compare resume evidence against the job description."
                ],
                "tailored_pitch": "Use the resume and job description to prepare a specific pitch; no tailored pitch could be generated."
            },
            "interview_rounds_blueprint": [
                {"round_name": "Round 1: Coding & DSA", "focus": "Data Structures, Algorithms, Complexity", "duration": "60 mins", "weightage": "Elimination"},
                {"round_name": "Round 2: Core Engineering & Frameworks", "focus": "Language internals, API design, DB indexing", "duration": "45-60 mins", "weightage": "Core Technical"},
                {"round_name": "Round 3: Project Defense & System Design", "focus": "Deep dive into your actual projects and design decisions", "duration": "60 mins", "weightage": "High Weightage"},
                {"round_name": "Round 4: Cultural Fit & Managerial", "focus": "STAR behavioral questions, ownership, team dynamics", "duration": "30 mins", "weightage": "Final Offer"}
            ],
            "top_interview_questions": [
                {
                    "id": "q1",
                    "category": "DSA / Problem Solving",
                    "question": "How would you optimize search and retrieval across 10 million records with low latency?",
                    "why_asked": "Tests indexing, hashing, and memory trade-offs",
                    "hint": "Consider B-trees, inverted indexes, or caching layers like Redis",
                    "expected_structure": "Brute force -> Indexing strategy -> Caching & Pagination",
                    "common_pitfall": "Suggesting in-memory loading of the entire dataset"
                },
                {
                    "id": "q2",
                    "category": "System Design & Project Defense",
                    "question": "Walk me through the most technically challenging bug or performance bottleneck in your top project.",
                    "why_asked": "Verifies genuine hands-on engineering vs shallow tutorial copy",
                    "hint": "Use the Situation -> Diagnosis -> Fix -> Quantified Outcome structure",
                    "expected_structure": "Problem symptom -> Profiling/Logs -> Architectural fix -> Result",
                    "common_pitfall": "Blaming external libraries without explaining the root cause"
                },
                {
                    "id": "q3",
                    "category": "Backend / DB Internals",
                    "question": "Explain the difference between synchronous blocking I/O and asynchronous event-driven I/O in high concurrency systems.",
                    "why_asked": "Tests event loop and thread pool mechanics",
                    "hint": "Think about CPU-bound vs I/O-bound workloads",
                    "expected_structure": "Mechanisms -> Thread overhead vs Event loop -> Concrete example",
                    "common_pitfall": "Thinking async always makes CPU calculations faster"
                }
            ],
            "cheat_sheet": {
                "key_concepts_to_revise": [
                    "Database Indexing (B-Tree vs Hash Index, Composite Indexes)",
                    "REST vs gRPC vs WebSocket trade-offs",
                    "Async/Await Event Loop mechanics",
                    "ACID transactions and isolation levels"
                ],
                "system_design_checklist": [
                    "Clarify scale requirements (DAU, QPS, Read/Write ratio)",
                    "Define high-level API contracts before database schemas",
                    "Always address single points of failure (SPOF) and caching"
                ],
                "red_flags_to_avoid": [
                    "Saying 'I don't know' without explaining how you would deduce or find the answer",
                    "Using 'We' exclusively instead of highlighting your personal engineering actions"
                ]
            }
        }

    @classmethod
    async def start_session(
        cls,
        user_id: str,
        company: str,
        role: str,
        jd: str,
        round_type: str = "mixed",
        difficulty: str = "medium",
        blueprint_override: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Initializes an AI Mock Interview Arena session anchored on the candidate's
        resume blueprint, target company, and target role.
        """
        session_id = f"interview-{uuid.uuid4().hex[:10]}"

        # Retrieve blueprint if not overridden
        blueprint = blueprint_override
        if not blueprint:
            try:
                blueprint = await neo4j_service.get_user_resume_blueprint(user_id)
            except Exception as e:
                logger.warning(f"Could not load resume blueprint for interview: {e}")
                blueprint = None

        candidate_name = blueprint.get("contact", {}).get("full_name", "") if blueprint else ""
        projects = blueprint.get("projects", []) if blueprint else []
        skills = []
        if blueprint and blueprint.get("skills"):
            for sc in blueprint["skills"]:
                if isinstance(sc, dict) and "skills" in sc:
                    skills.extend(sc["skills"])
                elif isinstance(sc, str):
                    skills.append(sc)

        projects_str = "\n".join([f"- {p.get('name')}: {', '.join(p.get('bullets', [])[:2])}" for p in projects[:3]])

        system_prompt = f"""You are an elite Senior Interviewer at {company} conducting a {round_type.upper()} mock interview for the {role} position.
Your persona: Adapt your seniority, questioning style, and evaluation bar to the target role and the requirements explicitly present in the job description. Be professional, rigorous, sharp, and encouraging.
You have the candidate's actual resume blueprint in front of you.
Use only the supplied job description and candidate resume as evidence about this role and candidate. Do not invent company-specific hiring practices, candidate experience, projects, metrics, or skills. If the JD is sparse, state uncertainty and ask role-relevant fundamentals.

Target Job Description:
{jd[:6000] or 'No job description supplied; use only the stated role and resume.'}

Candidate Info:
- Name: {candidate_name}
- Claimed Skills: {', '.join(skills[:15]) or 'Full Stack / Backend'}
- Actual Projects on Resume:
{projects_str or 'Various full stack projects'}

Instructions:
1. Greet the candidate briefly (1-2 sentences) mentioning their background and the {role} role at {company}.
2. Ask your FIRST challenging opening question tailored to the chosen round ({round_type}) and anchored on their real experience/projects.
3. For round_type='tech', ask deep technical/architecture questions.
4. For round_type='project_defense', ask them to defend a specific architectural decision in one of their listed projects.
5. For round_type='behavioral', ask a situational STAR question.
6. For round_type='mixed', start with a brief warmup question exploring their top project's architecture and trade-offs.

Return STRICTLY a JSON object with this schema:
{{
  "interviewer_name": "Lead Interviewer",
  "welcome_message": "Warm welcome message",
  "opening_question": "First interview question",
  "question_category": "Project Defense / Technical Depth / System Design / Behavioral",
  "question_number": 1,
  "total_questions": 5,
  "context_hints": "1-2 lines of hints for the candidate if they get stuck"
}}"""

        user_prompt = f"Initialize the {round_type} interview session for {company} - {role} at {difficulty} difficulty. Prioritize competencies and interview formats signaled by the supplied JD."

        try:
            res = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3
            )
            if res and isinstance(res, dict) and res.get("opening_question"):
                return {
                    "session_id": session_id,
                    "company": company,
                    "role": role,
                    "round_type": round_type,
                    "difficulty": difficulty,
                    "candidate_name": candidate_name,
                    "current_step": 1,
                    "total_steps": 5,
                    "interviewer_message": res.get("welcome_message", f"Welcome to your mock interview for {role} at {company}."),
                    "current_question": res.get("opening_question"),
                    "question_category": res.get("question_category", "Core Technical & Architecture"),
                    "context_hints": res.get("context_hints", "Focus on technical depth and concrete trade-offs."),
                    "history": [
                        {
                            "step": 1,
                            "question": res.get("opening_question"),
                            "category": res.get("question_category", "Core Technical"),
                            "hint": res.get("context_hints")
                        }
                    ]
                }
        except Exception as e:
            logger.error(f"Error starting interview session: {e}")

        # Heuristic fallback
        first_proj = projects[0]["name"] if projects else "your top project"
        return {
            "session_id": session_id,
            "company": company,
            "role": role,
            "round_type": round_type,
            "difficulty": difficulty,
            "candidate_name": candidate_name,
            "current_step": 1,
            "total_steps": 5,
            "interviewer_message": f"Hello {candidate_name}! Welcome to your technical interview simulation for {role} at {company}. Let's jump straight in.",
            "current_question": f"Looking at your resume, you highlighted {first_proj}. Could you walk me through the high-level architecture, the key technical challenges you ran into, and how you solved them?",
            "question_category": "Project Defense & Architecture",
            "context_hints": "Describe the data flow, database/API choices, and a specific bottleneck you overcame.",
            "history": [
                {
                    "step": 1,
                    "question": f"Walk me through the architecture of {first_proj} and how you handled key scalability bottlenecks.",
                    "category": "Project Defense & Architecture",
                    "hint": "Describe data flow, storage decisions, and trade-offs."
                }
            ]
        }

    @classmethod
    async def evaluate_and_next(
        cls,
        company: str,
        role: str,
        round_type: str,
        current_question: str,
        candidate_answer: str,
        step: int,
        total_steps: int = 5,
        history: Optional[List[Dict[str, Any]]] = None,
        job_description: str = ""
    ) -> Dict[str, Any]:
        """
        Scores candidate's answer (/10), provides immediate strengths, gaps, model response,
        and generates the next dynamic adaptive question (or ends session).
        """
        is_final = step >= total_steps

        system_prompt = f"""You are a Principal Software Engineer and Bar Raiser conducting an interview for {role} at {company}.
Evaluate the candidate's answer to the current question realistically.
Ground role-specific evaluation and the next question in this job description and the interview transcript only. Do not assume company practices or candidate credentials that are not stated.

Target job description:
{job_description[:6000] or 'Not supplied.'}

Current Question: "{current_question}"
Candidate Answer: "{candidate_answer}"
Step: {step} of {total_steps}
Is Final Question: {is_final}

Provide a fair score out of 10.
- 9-10: Exceptional depth, clear trade-offs, quantifiable metrics, precise architectural insight.
- 7-8: Good solid answer, correct concepts, minor missing edge cases or slight vagueness.
- 5-6: Basic surface-level answer, lacked technical depth or trade-offs.
- 1-4: Incorrect, evasive, or extremely superficial.

If not final, generate an adaptive, challenging follow-up question that builds on their answer or moves to the next essential competency.

Return STRICTLY a JSON object with this schema:
{{
  "score": 0,
  "strengths": [],
  "gaps": [],
  "model_answer": "",
  "interviewer_reaction": "",
  "next_question": "{"" if is_final else "Next challenging question"}",
  "next_category": "{"" if is_final else "Category for next question"}",
  "next_hint": "{"" if is_final else "Helpful clue for the candidate if they get stuck"}",
  "is_completed": {str(is_final).lower()}
}}"""

        user_prompt = f"Evaluate the candidate's response and provide feedback and the next step."

        try:
            eval_res = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2
            )
            if eval_res and isinstance(eval_res, dict) and "score" in eval_res:
                return {
                    "step": step,
                    "score": eval_res["score"],
                    "strengths": eval_res.get("strengths", []),
                    "gaps": eval_res.get("gaps", []),
                    "model_answer": eval_res.get("model_answer", ""),
                    "interviewer_reaction": eval_res.get("interviewer_reaction", ""),
                    "next_question": eval_res.get("next_question") if not is_final else None,
                    "next_category": eval_res.get("next_category", "") if not is_final else None,
                    "next_hint": eval_res.get("next_hint", "") if not is_final else None,
                    "is_completed": is_final
                }
        except Exception as e:
            logger.error(f"Error evaluating interview response: {e}")

        raise RuntimeError("Interview response evaluation is unavailable; no score or follow-up was generated.")

    @classmethod
    async def generate_final_scorecard(
        cls,
        company: str,
        role: str,
        round_type: str,
        conversation_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Produces a comprehensive Hireability Scorecard and Final Verdict across all interview steps.
        """
        history_text = "\n\n".join([
            f"Step {item.get('step', i+1)}: Question: {item.get('question', '')}\nAnswer: {item.get('answer', '')}\nScore: {item.get('score', 'N/A')}/10\nStrengths: {', '.join(item.get('strengths', []))}\nGaps: {', '.join(item.get('gaps', []))}"
            for i, item in enumerate(conversation_history)
        ])

        system_prompt = f"""You are the Hiring Committee Lead at {company} reviewing the completed interview session for the {role} position.
Analyze the transcript and scores to generate the final Hireability Scorecard.

Return STRICTLY a JSON object with this schema:
{{
  "overall_score": null,
  "verdict": "",
  "verdict_summary": "",
  "competency_breakdown": {
    "technical_depth": null,
    "system_architecture": null,
    "problem_solving": null,
    "communication_star": null
  },
  "top_superpowers": [],
  "areas_for_improvement": [],
  "fast_track_study_plan": []
}}"""

        user_prompt = f"Interview Transcript:\n\n{history_text}"

        try:
            card = await llm_service.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2
            )
            if card and isinstance(card, dict) and card.get("verdict"):
                return card
        except Exception as e:
            logger.error(f"Error generating final interview scorecard: {e}")

        raise RuntimeError("Interview scorecard generation is unavailable; no score was issued.")

interview_service = InterviewService()
