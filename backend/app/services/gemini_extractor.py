import json
import logging
from typing import List, Dict, Any
from app.core.config import settings
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

class GeminiExtractor:
    def __init__(self):
        pass

    async def extract_project_skills(self, repo_data: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        Uses Groq Llama 3.3 / Gemini to parse project description, languages, and readme into categorized skills.
        Includes deterministic fallback heuristics.
        """
        system_prompt = "You are a technical knowledge graph parser. Analyze the GitHub project and extract the technical skills, frameworks, databases, libraries, and tools."
        user_prompt = f"""
Project Name: {repo_data.get('name')}
Description: {repo_data.get('description')}
Languages: {", ".join(repo_data.get('languages', []))}
README Snippet:
{repo_data.get('readme_snippet', '')}

Return JSON with structure:
{{
  "skills": [
    {{"name": "SkillName", "category": "Language|Framework|Database|Cloud|DevOps|AI/ML|Security"}}
  ]
}}
"""
        parsed = await llm_service.chat_json(system_prompt=system_prompt, user_prompt=user_prompt)
        if parsed and isinstance(parsed, dict) and "skills" in parsed and isinstance(parsed["skills"], list):
            return parsed["skills"]
        elif isinstance(parsed, list):
            return parsed


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
