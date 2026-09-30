import json
import logging
import httpx
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

    @classmethod
    async def chat_json(
        cls,
        system_prompt: str,
        user_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> Optional[Dict[str, Any]]:
        """
        Calls Groq API (Llama 3.3 70B) for ultra-fast JSON structured output.
        Falls back to Gemini if Groq key is absent or request fails.
        """
        # 1. Try Groq API (Primary Engine)
        if settings.GROQ_API_KEY:
            try:
                selected_model = model or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": selected_model,
                    "messages": [
                        {"role": "system", "content": system_prompt + "\nYou must output strictly valid JSON with no markdown formatting or commentary."},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": temperature,
                    "response_format": {"type": "json_object"}
                }

                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(cls.GROQ_URL, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        clean_content = content.strip().replace("```json", "").replace("```", "").strip()
                        return json.loads(clean_content)
                    else:
                        logger.warning(f"Groq API returned status {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Groq chat completion failed: {e}. Falling back to Gemini/Heuristics.")

        # 2. Fallback to Gemini if configured
        if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AQ."):
            try:
                import google.generativeai as genai
                import asyncio
                genai.configure(api_key=settings.GEMINI_API_KEY)
                gmodel = genai.GenerativeModel("gemini-3.5-flash-lite")
                combined_prompt = f"{system_prompt}\n\n{user_prompt}\n\nReturn strictly valid JSON only."
                response = await asyncio.to_thread(gmodel.generate_content, combined_prompt)
                clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
                return json.loads(clean_text)
            except Exception as ge:
                logger.warning(f"Gemini fallback failed: {ge}")

        return None

llm_service = LLMService()
