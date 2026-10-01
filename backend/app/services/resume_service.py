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
        High-precision section-segmented line parser that accurately separates:
        - Contact Info
        - Education (Universities, Degrees, Dates)
        - Work Experience (Companies, Roles, Bullets)
        - Projects (Names, Tech Stacks, Bullets)
        - Technical Skills (Languages, Frameworks, Databases, Tools)
        - Achievements & Hackathons (Milestones, Awards)
        Never mixes bullet text or project verbs into Education or Skills.
        """
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

        # 1. Contact info extraction
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', raw_text)
        phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}', raw_text)
        github_match = re.search(r'(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)', raw_text, re.IGNORECASE)
        linkedin_match = re.search(r'(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)', raw_text, re.IGNORECASE)

        name = ""
        for line in lines[:5]:
            if len(line.split()) <= 4 and not re.search(r'@|phone|email|github|linkedin|resume|curriculum|profile|developer|engineer', line, re.IGNORECASE):
                if re.match(r'^[A-Z][a-zA-Z\s\.\'-]+$', line):
                    name = line
                    break
        if not name and lines:
            name = lines[0][:40]

        # 2. Segment lines into distinct sections
        sections: Dict[str, List[str]] = {
            "header": [],
            "education": [],
            "experience": [],
            "projects": [],
            "skills": [],
            "achievements": [],
            "summary": []
        }

        current_sec = "header"
        header_patterns = [
            ("education", re.compile(r'^(?:EDUCATION|ACADEMIC|ACADEMICS|QUALIFICATIONS|EDUCATION\s*&\s*TRAINING)\b', re.IGNORECASE)),
            ("experience", re.compile(r'^(?:EXPERIENCE|WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|EMPLOYMENT|INTERNSHIPS|INTERNSHIP)\b', re.IGNORECASE)),
            ("projects", re.compile(r'^(?:PROJECTS|KEY\s+PROJECTS|PERSONAL\s+PROJECTS|ACADEMIC\s+PROJECTS|TECHNICAL\s+PROJECTS)\b', re.IGNORECASE)),
            ("skills", re.compile(r'^(?:TECHNICAL\s+SKILLS|SKILLS|SKILLS\s*&\s*TOOLS|CORE\s+COMPETENCIES|TECHNOLOGIES)\b', re.IGNORECASE)),
            ("achievements", re.compile(r'^(?:ACHIEVEMENTS|HACKATHONS|HONORS\s*&\s*AWARDS|AWARDS|MILESTONES|EXTRACURRICULAR|ACCOMPLISHMENTS)\b', re.IGNORECASE)),
            ("summary", re.compile(r'^(?:SUMMARY|PROFESSIONAL\s+SUMMARY|ABOUT\s+ME|OBJECTIVE|PROFILE)\b', re.IGNORECASE)),
        ]

        for line in lines:
            matched_header = False
            for sec_name, pat in header_patterns:
                if pat.search(line) and len(line.split()) <= 4:
                    current_sec = sec_name
                    matched_header = True
                    break
            if not matched_header:
                sections[current_sec].append(line)

        # 3. Process Education Section (Strictly validated)
        education = []
        univ_keywords = {"college", "university", "institute", "iit", "nit", "iiit", "school", "academy", "vidyalaya", "campus"}
        verb_blocklist = {"developed", "built", "engineered", "processed", "implemented", "created", "designed", "optimized", "managed", "prototype", "for", "with"}

        seen_colleges = set()
        for eline in sections["education"]:
            # Must not be a bullet point or contain action verbs
            if re.match(r'^[•\-\*\+]\s*', eline) or any(v in eline.lower().split()[:3] for v in verb_blocklist):
                continue
            
            # Check for institution keywords on this specific line
            has_univ_keyword = any(k in eline.lower() for k in univ_keywords)
            if has_univ_keyword and len(eline) > 5 and len(eline) < 100:
                clean_name = re.split(r'\s*[-–—|,]\s*(?:B\.?Tech|Bachelor|Master|B\.?E|Degree|Engineering|Diploma)', eline, flags=re.IGNORECASE)[0].strip()
                clean_name = re.sub(r'[\(\)\[\]]', '', clean_name).strip()
                
                # Verify not polluted with code / frameworks
                if any(tech in clean_name.lower() for tech in ["react", "next.js", "python", "node", "fastapi", "docker"]):
                    continue

                if clean_name.lower() not in seen_colleges and len(clean_name) > 4:
                    seen_colleges.add(clean_name.lower())
                    
                    # Extract degree & year from the same or surrounding text
                    deg_match = re.search(r'(B\.?Tech|Bachelor|Master|B\.?E|B\.?Sc|M\.?S|M\.?Tech|Diploma|High\s*School)[\w\s\.]*', eline, re.IGNORECASE)
                    degree_str = deg_match.group(0).strip() if deg_match else "Bachelor of Technology"
                    
                    year_match = re.search(r'\b(20\d{2}\s*[-–—]\s*(?:20\d{2}|Present|\d{2}))\b|\b(20\d{2})\b', eline)
                    year_str = year_match.group(0) if year_match else ""

                    education.append(EducationEntry(
                        university=clean_name[:60],
                        degree=degree_str[:50],
                        field_of_study="Computer Science & Engineering",
                        start_date=year_str.split("-")[0].strip() if "-" in year_str else year_str,
                        end_date=year_str.split("-")[1].strip() if "-" in year_str else year_str
                    ))

        # 4. Process Work Experience Section
        experience = []
        current_exp: Optional[ExperienceEntry] = None
        for xline in sections["experience"]:
            is_bullet = bool(re.match(r'^[•\-\*\+]\s*', xline))
            if not is_bullet and len(xline.split()) <= 10 and not any(k in xline.lower() for k in ["languages:", "skills:", "tools:"]):
                # New company/role line
                parts = re.split(r'\s*[-–—|]\s*', xline)
                comp = parts[0].strip()[:50]
                role = parts[1].strip()[:40] if len(parts) > 1 else "Software Engineer"
                dates = parts[2].strip() if len(parts) > 2 else ""
                
                if comp and len(comp) > 2:
                    current_exp = ExperienceEntry(
                        company=comp,
                        role=role,
                        start_date=dates,
                        end_date="Present" if "present" in dates.lower() else dates,
                        is_current="present" in dates.lower(),
                        bullets=[]
                    )
                    experience.append(current_exp)
            elif is_bullet and current_exp:
                clean_b = re.sub(r'^[•\-\*\+]\s*', '', xline).strip()
                if clean_b:
                    current_exp.bullets.append(clean_b)

        # 5. Process Projects Section
        projects = []
        current_proj: Optional[ProjectEntry] = None
        for pline in sections["projects"]:
            is_bullet = bool(re.match(r'^[•\-\*\+]\s*', pline))
            if not is_bullet and len(pline.split()) <= 8 and not pline.lower().startswith("tech stack"):
                parts = re.split(r'\s*[-–—|]\s*', pline)
                pname = parts[0].strip()[:40]
                stack = parts[1].strip()[:60] if len(parts) > 1 else ""
                if pname and len(pname) > 2 and not any(w in pname.lower() for w in ["project", "projects", "overview"]):
                    current_proj = ProjectEntry(
                        name=pname,
                        tech_stack=stack,
                        bullets=[]
                    )
                    projects.append(current_proj)
            elif is_bullet and current_proj:
                clean_pb = re.sub(r'^[•\-\*\+]\s*', '', pline).strip()
                if clean_pb:
                    current_proj.bullets.append(clean_pb)

        # 6. Process Achievements & Hackathons
        achievements = []
        for aline in sections["achievements"]:
            clean_ach = re.sub(r'^[•\-\*\+]\s*', '', aline).strip()
            if clean_ach and len(clean_ach) > 3 and len(clean_ach) < 120:
                achievements.append(clean_ach)

        # 7. Process Technical Skills
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
            if re.search(rf"\b{re.escape(skill_name)}\b", raw_text, re.IGNORECASE):
                categorized_skills.setdefault(category, []).append(skill_name)

        skill_categories = [
            SkillCategory(category=cat, skills=list(dict.fromkeys(s_list)))
            for cat, s_list in categorized_skills.items()
        ]

        summary_text = " ".join(sections["summary"][:3]) if sections["summary"] else ""

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
            achievements=achievements,
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

