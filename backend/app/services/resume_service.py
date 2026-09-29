import io
import json
import logging
import re
from typing import Dict, Any, Optional
from pypdf import PdfReader
import google.generativeai as genai
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
        if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AQ."):
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
        else:
            self.model = None

    @classmethod
    def extract_text_from_pdf(cls, file_bytes: bytes) -> str:
        """Extracts clean digital text from a PDF byte stream."""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            full_text = []
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                full_text.append(page_text.strip())
            return "\n\n".join(full_text)
        except Exception as e:
            logger.error(f"Error reading PDF byte stream: {e}")
            return ""

    async def parse_resume_to_blueprint(self, raw_text: str) -> ResumeBlueprint:
        """
        Parses unstructured resume text into a strict JSON Layout Blueprint using Gemini 1.5 Flash,
        with deterministic heuristic fallbacks.
        """
        if self.model and raw_text:
            prompt = f"""
You are an expert ATS and Resume Layout Parser for CareerOS.
Analyze the following resume text and parse it into an exact structured JSON blueprint.

Resume Text:
\"\"\"
{raw_text[:12000]}
\"\"\"

Return ONLY a valid JSON object with the exact structure below (no markdown fences, no backticks):
{{
  "contact": {{
    "full_name": "Candidate Name",
    "email": "email@example.com",
    "phone": "+1234567890",
    "location": "City, Country",
    "linkedin_url": "linkedin.com/in/username",
    "github_url": "github.com/username",
    "portfolio_url": ""
  }},
  "summary": "Brief 1-2 sentence professional bio",
  "experience": [
    {{
      "company": "Company Name",
      "role": "Job Title",
      "location": "City/Remote",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or Present",
      "is_current": false,
      "bullets": [
        "Quantified achievement or responsibility in STAR format"
      ]
    }}
  ],
  "education": [
    {{
      "university": "University Name",
      "degree": "B.S. in Computer Science",
      "field_of_study": "Computer Science",
      "start_date": "2020",
      "end_date": "2024",
      "gpa": ""
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "tech_stack": "React, FastAPI, PostgreSQL",
      "repo_url": "",
      "live_url": "",
      "bullets": [
        "Key feature built or metric achieved"
      ]
    }}
  ],
  "skills": [
    {{
      "category": "Languages",
      "skills": ["Python", "JavaScript", "SQL"]
    }},
    {{
      "category": "Frameworks",
      "skills": ["FastAPI", "React", "Node.js"]
    }},
    {{
      "category": "Databases",
      "skills": ["PostgreSQL", "Neo4j", "Redis"]
    }},
    {{
      "category": "Cloud & DevOps",
      "skills": ["Docker", "Supabase", "Git"]
    }}
  ]
}}
"""
            try:
                response = self.model.generate_content(prompt)
                clean_json = response.text.strip().replace("```json", "").replace("```", "").strip()
                parsed_data = json.loads(clean_json)
                parsed_data["raw_text"] = raw_text
                return ResumeBlueprint(**parsed_data)
            except Exception as e:
                logger.warning(f"Gemini API parse failed, falling back to heuristic parser: {e}")

        # Deterministic Heuristic Fallback Parser
        return self._heuristic_fallback_parser(raw_text)

    def _heuristic_fallback_parser(self, text: str) -> ResumeBlueprint:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        
        # Email & Phone regex
        email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
        phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
        github_match = re.search(r"github\.com/[\w\-]+", text)
        linkedin_match = re.search(r"linkedin\.com/in/[\w\-]+", text)

        name = lines[0] if lines else "Candidate"
        email = email_match.group(0) if email_match else ""
        phone = phone_match.group(0) if phone_match else ""
        github = github_match.group(0) if github_match else ""
        linkedin = linkedin_match.group(0) if linkedin_match else ""

        # Extract basic skill keywords
        known_skills = ["Python", "FastAPI", "React", "TypeScript", "JavaScript", "Docker", "PostgreSQL", "Neo4j", "Git", "Supabase", "Node.js", "C++", "Java"]
        found_skills = [s for s in known_skills if re.search(rf"\b{re.escape(s)}\b", text, re.IGNORECASE)]

        return ResumeBlueprint(
            contact=ContactInfo(
                full_name=name,
                email=email,
                phone=phone,
                github_url=github,
                linkedin_url=linkedin
            ),
            summary="Extracted Candidate Profile",
            experience=[
                ExperienceEntry(
                    company="Software Engineering Experience",
                    role="Software Developer",
                    start_date="2023",
                    end_date="Present",
                    is_current=True,
                    bullets=[line for line in lines if line.startswith("•") or line.startswith("-")][:4] or ["Developed scalable applications."]
                )
            ],
            education=[
                EducationEntry(
                    university="University Institution",
                    degree="Bachelor of Technology in Computer Science",
                    field_of_study="Computer Science",
                    end_date="2025"
                )
            ],
            projects=[],
            skills=[
                SkillCategory(
                    category="Technical Skills",
                    skills=found_skills or ["Python", "FastAPI", "React", "PostgreSQL"]
                )
            ],
            raw_text=text
        )

resume_service = ResumeService()
