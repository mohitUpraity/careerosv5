import json
import logging
import google.generativeai as genai
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class GeminiExtractor:
    def __init__(self):
        if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AQ."):
            # Genuine Google AI Studio API Key
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-3.5-flash-lite")
        else:
            self.model = None

    async def extract_project_skills(self, repo_data: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        Uses Gemini 1.5 Flash to parse project description, languages, and readme into categorized skills.
        Includes deterministic fallback heuristics.
        """
        if self.model:
            prompt = f"""
You are a technical knowledge graph parser for CareerOS.
Analyze this GitHub project and extract the technical skills, frameworks, databases, libraries, and tools used.

Project Name: {repo_data.get('name')}
Description: {repo_data.get('description')}
Languages: {", ".join(repo_data.get('languages', []))}
README Snippet:
{repo_data.get('readme_snippet', '')}

Return ONLY a valid JSON array of objects with the exact structure:
[
  {{"name": "SkillName", "category": "Language|Framework|Database|Cloud|DevOps|AI/ML"}}
]
Do not include backticks, markdown fences, or explanations.
"""
            try:
                response = self.model.generate_content(prompt)
                clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
                extracted = json.loads(clean_text)
                if isinstance(extracted, list):
                    return extracted
            except Exception as e:
                logger.warning(f"Gemini API call fallback to heuristic parser: {e}")

        # High-precision deterministic fallback parser
        skills = []
        for lang in repo_data.get("languages", []):
            skills.append({"name": lang, "category": "Language"})

        readme_lower = repo_data.get("readme_snippet", "").lower()
        known_tech = {
            "fastapi": ("FastAPI", "Framework"),
            "react": ("React", "Framework"),
            "vite": ("Vite", "DevOps"),
            "neo4j": ("Neo4j", "Database"),
            "postgresql": ("PostgreSQL", "Database"),
            "postgres": ("PostgreSQL", "Database"),
            "supabase": ("Supabase", "Cloud"),
            "docker": ("Docker", "DevOps"),
            "tailwind": ("TailwindCSS", "Framework"),
            "next.js": ("Next.js", "Framework"),
            "nextjs": ("Next.js", "Framework"),
            "redis": ("Redis", "Database"),
            "pytorch": ("PyTorch", "AI/ML"),
            "tensorflow": ("TensorFlow", "AI/ML"),
            "langchain": ("LangChain", "AI/ML"),
            "weasyprint": ("WeasyPrint", "Tool")
        }

        for keyword, (std_name, category) in known_tech.items():
            if keyword in readme_lower and not any(s["name"] == std_name for s in skills):
                skills.append({"name": std_name, "category": category})

        return skills

gemini_extractor = GeminiExtractor()
