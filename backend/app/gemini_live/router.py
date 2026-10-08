import asyncio
import json
import base64
import logging
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.config import settings
from app.gemini_live.interview import LiveInterviewSession

logger = logging.getLogger("gemini_live.router")

router = APIRouter(prefix="/live", tags=["Gemini Live Multimodal Engine"])

FRAME_AUDIO = 0x01
FRAME_VIDEO = 0x02

@router.websocket("/ws")
async def gemini_live_websocket(
    websocket: WebSocket,
    user_id: str = "candidate_1",
    company: str = "Google",
    role: str = "Senior Backend Engineer",
    candidate_name: str = "Candidate",
    voice: str = "Zephyr"
):
    """
    Direct WebSocket bridge connecting Browser WebRTC/Audio to Google Gemini Live API.
    Supports both binary streams and JSON Base64 audio for web meeting rooms.
    """
    await websocket.accept()
    logger.info(f"Gemini Live WebSocket client connected: user={user_id}, role={role}")

    send_lock = asyncio.Lock()

    async def send_json_to_client(data: Dict[str, Any]):
        try:
            async with send_lock:
                await websocket.send_text(json.dumps(data))
        except Exception:
            pass

    async def send_audio_to_client(pcm_bytes: bytes):
        try:
            # Base64 JSON audio frame for MeetingRoom.tsx Web Audio player
            b64 = base64.b64encode(pcm_bytes).decode("ascii")
            async with send_lock:
                await websocket.send_text(json.dumps({"type": "audio", "data": b64}))
        except Exception:
            pass

    session = LiveInterviewSession(
        api_key=settings.GEMINI_API_KEY,
        user_id=user_id,
        company=company,
        role=role,
        candidate_name=candidate_name,
        voice_name=voice,
        send_json_callback=send_json_to_client,
        send_audio_callback=send_audio_to_client,
    )

    try:
        await session.start()
        await send_json_to_client({
            "type": "ready",
            "message": "Live Interview Session connected",
            "model": "gemini-3.8-live"
        })

        while True:
            try:
                frame = await websocket.receive()
            except WebSocketDisconnect:
                logger.info("Client WebSocket disconnected gracefully.")
                break
            except Exception as re:
                logger.info(f"WebSocket receive exited: {re}")
                break

            if frame.get("type") == "websocket.disconnect":
                logger.info(f"Client sent disconnect signal (code: {frame.get('code', 1000)})")
                break

            # Handle binary frames (audio / video)
            if frame.get("bytes"):
                b = frame["bytes"]
                if len(b) > 1:
                    kind = b[0]
                    payload = b[1:]
                    if kind == FRAME_AUDIO:
                        session.push_audio(payload)
                    elif kind == FRAME_VIDEO:
                        session.push_video(payload)
                continue

            # Handle JSON text frames
            if frame.get("text"):
                try:
                    msg = json.loads(frame["text"])
                except Exception as je:
                    logger.debug(f"Non-JSON or malformed text frame: {je}")
                    continue

                msg_type = msg.get("type")
                
                if msg_type == "audio" and msg.get("data"):
                    try:
                        # Base64 PCM audio from Web Audio API
                        pcm_bytes = base64.b64decode(msg["data"])
                        session.push_audio(pcm_bytes)
                    except Exception as ae:
                        logger.debug(f"Invalid audio frame data: {ae}")
                elif msg_type == "video" and msg.get("data"):
                    try:
                        # Real-time webcam / screen JPEG frames for Gemini Vision
                        raw = msg["data"]
                        if "," in raw:
                            raw = raw.split(",")[1]
                        frame_bytes = base64.b64decode(raw)
                        session.push_video(frame_bytes)
                    except Exception as ve:
                        logger.debug(f"Invalid video frame data: {ve}")
                elif msg_type == "text":
                    await session.send_text_message(msg.get("data") or msg.get("text", ""))
                elif msg_type == "code_sync":
                    code = msg.get("code", "")
                    lang = msg.get("language", "python")
                    prompt = f"[Candidate updated code in the editor ({lang}):\n```{lang}\n{code}\n```\nShare a brief, natural 1-sentence thought on their code.]"
                    await session.send_text_message(prompt)
                elif msg_type == "setup":
                    logger.info(f"Received setup payload: {msg.get('role', 'N/A')}")
                elif msg_type == "interrupt":
                    logger.info("Client signaled manual/local speech barge-in interrupt")
                    session.handle_client_interrupted()
                elif msg_type == "request_coding_challenge":
                    logger.info("Client requested coding challenge from CodingChallengeSubAgent")
                    await session.trigger_coding_challenge(msg.get("topic"))
                elif msg_type == "test_proctor_warning":
                    logger.info("Manual test trigger for proctor warning")
                    await session.proctor_subagent.trigger_warning(
                        violation_type=msg.get("violation_type", "looking_away"),
                        reason=msg.get("reason", "Candidate averted eye contact downward towards secondary notes or phone."),
                        is_critical=msg.get("is_critical", False)
                    )
                elif msg_type == "test_reaction":
                    await send_json_to_client({
                        "type": "interviewer_reaction",
                        "data": {"emoji": msg.get("emoji", "👍")}
                    })
                elif msg_type == "conclude":
                    scorecard = await session.generate_scorecard()
                    await send_json_to_client({"type": "scorecard", "data": scorecard})
                    break

    except WebSocketDisconnect:
        logger.info("Client disconnected from Live WebSocket.")
    except Exception as e:
        logger.error(f"WebSocket session error: {e}", exc_info=True)
    finally:
        await session.close()
        try:
            await websocket.close()
        except Exception:
            pass
