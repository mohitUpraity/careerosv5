from pydantic import BaseModel
from typing import List, Optional

class LiveEngineConfig(BaseModel):
    model: str = "gemini-3.8-live"
    fallback_models: List[str] = ["gemini-3.8-live", "gemini-2.5-flash-native-audio-latest"]
    voice_name: str = "Zephyr"  # Options: Aoede, Puck, Charon, Kore, Fenrir, Zephyr
    input_sample_rate: int = 16000
    output_sample_rate: int = 24000
    channels: int = 1
    chunk_size: int = 512
    # Allow ordinary pauses between clauses without chopping the candidate's turn.
    silence_duration_ms: int = 700
    prefix_padding_ms: int = 80
    system_instruction: Optional[str] = (
        "You are an expert technical interviewer conducting a live conversational interview. "
        "Keep your answers and questions concise (2-3 short sentences max) for a natural live back-and-forth dialogue. "
        "Always listen to what the user says and respond promptly."
    )
