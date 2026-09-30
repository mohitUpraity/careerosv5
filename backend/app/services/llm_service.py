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
            for g_model in [model or settings.GROQ_MODEL or "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]:
                try:
                    headers = {
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": g_model,
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
                except Exception as e:
                    logger.warning(f"Groq model {g_model} chat failed: {e}")

        # 2. Fallback to Gemini if configured (High rate-limit Flash & Lite models)
        if settings.GEMINI_API_KEY:
            for gem_model_name in [
                "gemini-2.0-flash-lite",
                "gemini-1.5-flash-8b",
                "gemini-1.5-flash",
                "gemini-2.0-flash",
                "gemini-1.5-pro"
            ]:
                try:
                    import google.generativeai as genai
                    import asyncio
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    gmodel = genai.GenerativeModel(gem_model_name)
                    combined_prompt = f"{system_prompt}\n\n{user_prompt}\n\nReturn strictly valid JSON only (no markdown fences, no commentary)."
                    response = await asyncio.to_thread(gmodel.generate_content, combined_prompt)
                    if response and response.text:
                        clean_text = response.text.strip()
                        if "```json" in clean_text:
                            clean_text = clean_text.split("```json")[1].split("```")[0].strip()
                        elif "```" in clean_text:
                            clean_text = clean_text.split("```")[1].split("```")[0].strip()
                        return json.loads(clean_text)
                except Exception as ge:
                    logger.warning(f"Gemini model {gem_model_name} failed: {ge}")

        return None

llm_service = LLMService()
