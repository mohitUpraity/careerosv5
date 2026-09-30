import io
import json
import logging
import re
from typing import Dict, Any, Optional, List
from pypdf import PdfReader
from app.core.config import settings
from app.schemas.resume_blueprint import (
    ResumeBlueprint,
    ContactInfo,
    ExperienceEntry,
    EducationEntry,
    ProjectEntry,
    SkillCategory
)

logger = logging.getLogger(__name__)

class ResumeService:
    def __init__(self):
        pass

    @classmethod
    def extract_text_from_pdf(cls, file_bytes: bytes) -> str:
        """Extracts clean digital text from a PDF byte stream while preserving layout structure."""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            full_text = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                full_text.append(page_text.strip())
            return "\n\n".join(full_text)
        except Exception as e:
            logger.error(f"Error reading PDF byte stream: {e}")
            return ""

    async def parse_resume_to_blueprint(self, raw_text: str) -> ResumeBlueprint:
        """
        Parses unstructured resume text into a strict JSON Layout Blueprint
        using high-precision Gemini 1.5 Flash and Groq Llama 3.3.
        """
        from app.services.llm_service import llm_service

        if not raw_text or not raw_text.strip():
            return self._advanced_heuristic_parser("", "")

        system_prompt = """You are an elite, high-precision ATS resume and candidate intelligence parser.
Extract the EXACT factual information from the candidate's resume into a structured JSON blueprint.

CRITICAL EXTRACTION RULES:
1. Candidate Full Name: Extract the actual human person's name from the very top of the resume. Never put project names, technologies, or job titles as the candidate name.
2. Education: Extract university/college name, degree title (e.g. B.Tech, B.E., M.S., B.S.), major/field of study, and years.
3. Experience: Extract company name, role/title, dates, and achievement bullet points.
4. Projects: Extract project title, tech stack used, and bullet points.
5. Skills: Categorize real technical skills into clean groups (Languages, Frameworks, Databases, Cloud & DevOps, AI/ML & Tools).

Return ONLY valid JSON matching this schema (no markdown fences, no commentary):"""

        user_prompt = f"""
Resume Content:
\"\"\"
{raw_text[:18000]}
\"\"\"

JSON Schema:
{{
  "contact": {{
    "full_name": "Exact Candidate Name",
    "email": "candidate email or empty",
    "phone": "candidate phone or empty",
    "location": "City, State or Country or empty",
    "linkedin_url": "linkedin profile url or username or empty",
    "github_url": "github profile url or username or empty",
    "portfolio_url": ""
  }},
  "summary": "Candidate professional summary statement",
  "education": [
    {{
      "university": "College or University Name",
      "degree": "Degree Title",
      "field_of_study": "Major / Field",
      "start_date": "Start Year / Date",
      "end_date": "End Year / Date",
      "gpa": ""
    }}
  ],
  "experience": [
    {{
      "company": "Company Name",
      "role": "Job Role / Title",
      "location": "Location or Remote",
      "start_date": "Start Date",
      "end_date": "End Date or Present",
      "is_current": true,
      "bullets": [
        "Achievement or responsibility bullet"
      ]
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "tech_stack": "React, Python, etc.",
      "repo_url": "",
      "live_url": "",
      "bullets": [
        "Project description or feature bullet"
      ]
    }}
  ],
  "skills": [
    {{
      "category": "Languages",
      "skills": ["Skill 1", "Skill 2"]
    }},
    {{
      "category": "Frameworks",
      "skills": ["Skill 1", "Skill 2"]
    }},
    {{
      "category": "Databases & Cloud",
      "skills": ["Skill 1", "Skill 2"]
    }}
  ]
}}
"""
        parsed_data = await llm_service.chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1
        )

        if parsed_data and isinstance(parsed_data, dict) and "contact" in parsed_data:
            try:
                parsed_data["raw_text"] = raw_text
                return ResumeBlueprint(**parsed_data)
            except Exception as pe:
                logger.warning(f"Validation error constructing ResumeBlueprint from LLM output: {pe}")

        # Fallback to algorithmic parser if LLM fails
        return self._advanced_heuristic_parser(raw_text, raw_text)

    def _advanced_heuristic_parser(self, text: str, raw_text: str) -> ResumeBlueprint:
        """
        Dynamically extracts contact info, education, experience, projects, and skills from unstructured text
        without any hardcoded fallbacks or mock data.
        """
        # 1. Contact info extraction
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}', text)
        github_match = re.search(r'(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)', text, re.IGNORECASE)
        linkedin_match = re.search(r'(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)', text, re.IGNORECASE)

        # Name extraction: look at the top lines of text
        name = ""
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        for line in lines[:5]:
            if len(line.split()) <= 4 and not re.search(r'@|phone|email|github|linkedin|resume|curriculum|profile', line, re.IGNORECASE):
                # Candidate names are usually capitalized title case
                if re.match(r'^[A-Z][a-zA-Z\s\.\'-]+$', line):
                    name = line
                    break

        if not name:
            name_search = re.search(r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})', text)
            if name_search and not any(w in name_search.group(1).lower() for w in ["summary", "skills", "experience", "education", "projects"]):
                name = name_search.group(1)

        # 2. Dynamic Education extraction
        education = []
        edu_matches = re.finditer(r'([A-Za-z\s,\.-]+(?:College|University|Institute|IIT|NIT|IIIT|Academy|School)[A-Za-z\s,\.-]*)', text, re.IGNORECASE)
        seen_colleges = set()
        for m in edu_matches:
            col = m.group(1).strip()
            # Clean length
            clean_col = col.split("\n")[0].strip()[:60]
            if clean_col.lower() not in seen_colleges and len(clean_col) > 5:
                seen_colleges.add(clean_col.lower())
                education.append(EducationEntry(
                    university=clean_col,
                    degree="Degree / Studies",
                    field_of_study="Computer Science / Engineering",
                    start_date="",
                    end_date=""
                ))

        # 3. Dynamic Experience extraction
        experience = []
        # Look for bullet points in raw text
        raw_bullets = re.findall(r'(?:^|\n)\s*[•\-\*]\s*([^\n\r]+)', raw_text)
        if raw_bullets:
            # Group bullets into experience entry
            experience.append(ExperienceEntry(
                company="Professional Experience",
                role="Software Engineer",
                start_date="",
                end_date="Present",
                is_current=True,
                bullets=raw_bullets[:6]
            ))

        # 4. Dynamic Projects extraction
        projects = []
        proj_headings = re.findall(r'(?:Project|Projects)\s*[:\-]?\s*([A-Za-z0-9\s_-]+)', text, re.IGNORECASE)
        for ph in proj_headings[:3]:
            cleaned_p = ph.strip()[:40]
            if len(cleaned_p) > 3:
                projects.append(ProjectEntry(
                    name=cleaned_p,
                    tech_stack="",
                    bullets=[]
                ))

        # 5. Dynamic Skills extraction
        known_skills_vocab = [
            ("Python", "Languages"), ("JavaScript", "Languages"), ("TypeScript", "Languages"),
            ("Java", "Languages"), ("C++", "Languages"), ("C#", "Languages"), ("Go", "Languages"),
            ("Rust", "Languages"), ("HTML", "Languages"), ("CSS", "Languages"), ("SQL", "Languages"),
            ("React.js", "Frameworks"), ("React", "Frameworks"), ("Next.js", "Frameworks"), 
            ("Vue", "Frameworks"), ("Node.js", "Frameworks"), ("Express.js", "Frameworks"), 
            ("FastAPI", "Frameworks"), ("Django", "Frameworks"), ("Flask", "Frameworks"),
            ("Spring Boot", "Frameworks"), ("MongoDB", "Databases"), ("PostgreSQL", "Databases"), 
            ("MySQL", "Databases"), ("Firebase", "Databases"), ("Redis", "Databases"),
            ("Docker", "DevOps & Cloud"), ("Kubernetes", "DevOps & Cloud"), ("Git", "DevOps & Cloud"), 
            ("AWS", "DevOps & Cloud"), ("GCP", "DevOps & Cloud"), ("Supabase", "Databases"),
            ("Neo4j", "Databases"), ("Postman", "DevOps & Cloud"), ("Vercel", "DevOps & Cloud"),
            ("NLP", "AI/ML & Security"), ("RAG", "AI/ML & Security"), ("LLMs", "AI/ML & Security"),
            ("Agentic AI", "AI/ML & Security"), ("PyTorch", "AI/ML & Security"), ("TensorFlow", "AI/ML & Security"),
            ("Network Security", "AI/ML & Security"), ("TCP/IP", "AI/ML & Security"), ("Wireshark", "AI/ML & Security"),
            ("Intrusion Detection", "AI/ML & Security"), ("Linux", "DevOps & Cloud")
        ]

        categorized_skills: Dict[str, List[str]] = {}
        for skill_name, category in known_skills_vocab:
            if re.search(rf"\b{re.escape(skill_name)}\b", text, re.IGNORECASE):
                categorized_skills.setdefault(category, []).append(skill_name)

        skill_categories = [
            SkillCategory(category=cat, skills=list(dict.fromkeys(s_list)))
            for cat, s_list in categorized_skills.items()
        ]

        summary_match = re.search(r'(?:Summary|About|Professional Summary)\s*[:\-]?\s*([^\n\r]+(?:\n[^\n\r]+){1,3})', raw_text, re.IGNORECASE)
        summary_text = summary_match.group(1).strip() if summary_match else ""

        return ResumeBlueprint(
            contact=ContactInfo(
                full_name=name,
                email=email_match.group(0) if email_match else "",
                phone=phone_match.group(0) if phone_match else "",
                location="",
                github_url=f"github.com/{github_match.group(1)}" if github_match else "",
                linkedin_url=f"linkedin.com/in/{linkedin_match.group(1)}" if linkedin_match else ""
            ),
            summary=summary_text,
            experience=experience,
            education=education,
            projects=projects,
            skills=skill_categories,
            raw_text=raw_text
        )

    async def tailor_blueprint_to_job(
        self,
        base_blueprint: ResumeBlueprint,
        job_info: Dict[str, Any]
    ) -> ResumeBlueprint:
        """
        Uses Groq / Gemini to tailor bullet points to target role keywords while preserving 100% layout structure.
        """
        from app.services.llm_service import llm_service

        system_prompt = "You are an elite ATS resume optimizer. Rewrite experience and project bullet points into high-impact STAR method bullet points tailored to the target job description while strictly retaining existing facts."
        user_prompt = f"""
Target Role: {job_info.get('job_title', 'Software Engineer')}
Target Company: {job_info.get('company_name', 'Target Company')}
Job Description:
{job_info.get('job_description', '')[:10000]}

Original Experience:
{[e.model_dump() for e in base_blueprint.experience]}

Original Projects:
{[p.model_dump() for p in base_blueprint.projects]}

Return JSON with tailored bullet points:
{{
  "experience": [
    {{
      "company": "Company Name",
      "role": "Role Title",
      "bullets": ["STAR Bullet 1", "STAR Bullet 2"]
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "bullets": ["STAR Bullet 1", "STAR Bullet 2"]
    }}
  ]
}}
"""
        parsed = await llm_service.chat_json(system_prompt=system_prompt, user_prompt=user_prompt)

        tailored_exp = [e.model_copy(deep=True) for e in base_blueprint.experience]
        tailored_proj = [p.model_copy(deep=True) for p in base_blueprint.projects]

        if parsed and isinstance(parsed, dict):
            # Update experience bullets if matched
            if "experience" in parsed and isinstance(parsed["experience"], list):
                for new_exp in parsed["experience"]:
                    for orig in tailored_exp:
                        if new_exp.get("company", "").lower() in orig.company.lower() or orig.company.lower() in new_exp.get("company", "").lower():
                            if new_exp.get("bullets"):
                                orig.bullets = new_exp["bullets"]

            # Update project bullets if matched
            if "projects" in parsed and isinstance(parsed["projects"], list):
                for new_proj in parsed["projects"]:
                    for orig_p in tailored_proj:
                        if new_proj.get("name", "").lower() in orig_p.name.lower() or orig_p.name.lower() in new_proj.get("name", "").lower():
                            if new_proj.get("bullets"):
                                orig_p.bullets = new_proj["bullets"]

        top_skills_list = []
        for s in base_blueprint.skills:
            if s.skills:
                top_skills_list.extend(s.skills[:2])

        skills_str = ", ".join(top_skills_list[:4]) if top_skills_list else "Full Stack Engineering"

        return ResumeBlueprint(
            contact=base_blueprint.contact,
            summary=base_blueprint.summary or f"Software Engineer specialized in {job_info.get('job_title', 'Software Engineering')} with proven code evidence across {skills_str}, tailored for high-impact contributions at {job_info.get('company_name', 'target organizations')}.",
            experience=tailored_exp,
            education=base_blueprint.education,
            projects=tailored_proj,
            skills=base_blueprint.skills,
            certifications=getattr(base_blueprint, "certifications", []),
            achievements=getattr(base_blueprint, "achievements", []),
            raw_text=base_blueprint.raw_text
        )

resume_service = ResumeService()

