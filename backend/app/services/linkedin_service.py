import csv
import io
import logging
import re
from typing import List, Dict, Any, Optional
try:
    import google.generativeai as genai
except ImportError:
    genai = None

from app.core.config import settings

logger = logging.getLogger(__name__)

class LinkedInService:
    def __init__(self):
        if settings.GEMINI_API_KEY and genai:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel("gemini-1.5-flash")
            except Exception:
                self.model = None
        else:
            self.model = None

    @classmethod
    def clean_entity_name(cls, name: str) -> str:
        """Standardizes company and university names."""
        if not name:
            return ""
        # Remove common corporate suffixes
        cleaned = re.sub(r'\b(Inc\.?|LLC|Ltd\.?|Pvt\.?|Corp\.?|Corporation|Technologies|Solutions|Services)\b', '', name, flags=re.IGNORECASE)
        # Remove extra punctuation and whitespace
        cleaned = re.sub(r'[^\w\s\-\&]', '', cleaned).strip()
        cleaned = re.sub(r'\s{2,}', ' ', cleaned)
        return cleaned or name.strip()

    @classmethod
    def parse_connections_csv(cls, csv_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Parses LinkedIn official Connections.csv export format.
        LinkedIn exports usually start with 3 header metadata notes before the actual table.
        """
        try:
            text = csv_bytes.decode('utf-8', errors='ignore')
            lines = text.splitlines()
            
            # Find the header row (starts with "First Name" or contains "Company")
            header_idx = 0
            for idx, line in enumerate(lines[:10]):
                if "First Name" in line and "Company" in line:
                    header_idx = idx
                    break

            reader = csv.DictReader(lines[header_idx:])
            connections = []

            for row in reader:
                first_name = row.get("First Name", "").strip()
                last_name = row.get("Last Name", "").strip()
                company = row.get("Company", "").strip()
                position = row.get("Position", "").strip()
                connected_on = row.get("Connected On", "").strip()
                url = row.get("URL", "").strip()

                if not first_name or not company:
                    continue  # Skip empty or private rows

                full_name = f"{first_name} {last_name}".strip()
                clean_company = cls.clean_entity_name(company)
                person_id = f"linkedin:{first_name.lower()}_{last_name.lower()}_{clean_company.lower()}".replace(" ", "_")

                connections.append({
                    "id": person_id,
                    "name": full_name,
                    "first_name": first_name,
                    "last_name": last_name,
                    "raw_company": company,
                    "company": clean_company,
                    "position": position,
                    "connected_on": connected_on,
                    "profile_url": url
                })

            return connections
        except Exception as e:
            logger.error(f"Error parsing LinkedIn Connections.csv: {e}")
            return []

    async def parse_hiring_lead_post(self, post_text: str) -> Dict[str, Any]:
        """
        Extracts company, role, hiring manager, and required skills from a raw LinkedIn hiring post text.
        """
        if self.model and post_text:
            prompt = f"""
Analyze this LinkedIn hiring post and extract key lead entities in strict JSON:
\"\"\"
{post_text[:3000]}
\"\"\"

Return ONLY valid JSON with this exact schema:
{{
  "company_name": "Target Company",
  "hiring_manager_name": "Name of poster or contact",
  "job_title": "Role Title (e.g. Backend Engineer)",
  "skills": ["Python", "FastAPI", "Docker"],
  "location": "Remote / City",
  "application_link_or_email": ""
}}
"""
            try:
                response = self.model.generate_content(prompt)
                clean_json = response.text.strip().replace("```json", "").replace("```", "").strip()
                return json.loads(clean_json)
            except Exception as e:
                logger.warning(f"Gemini post extraction fallback: {e}")

        # Fallback Heuristic
        company_match = re.search(r'\bat\s+([A-Z][A-Za-z0-9]+)', post_text)
        role_match = re.search(r'\b(Software Engineer|Backend Developer|Full Stack|DevOps|Data Scientist)\b', post_text, re.IGNORECASE)
        
        return {
            "company_name": company_match.group(1) if company_match else "Target Company",
            "hiring_manager_name": "Hiring Manager",
            "job_title": role_match.group(0) if role_match else "Software Developer",
            "skills": ["Python", "FastAPI", "React"],
            "location": "Remote",
            "application_link_or_email": ""
        }

linkedin_service = LinkedInService()
