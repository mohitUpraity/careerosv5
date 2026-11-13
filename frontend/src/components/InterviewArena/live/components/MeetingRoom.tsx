import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  InterviewConfig,
  ChatMessage,
  TranscriptItem,
  MeetingLayout,
  RubricStage,
  LiveAnalytics,
  EvaluationReport,
  ProctorWarning,
  ScratchpadNote,
  LiveAnswerAnalysis,
  OrchestratorAction,
} from "../types";
import { INITIAL_RUBRIC_STAGES } from "../data/interviewProfiles";
import { AudioStreamingManager } from "../utils/audio";
import { InterviewerTile } from "./InterviewerTile";
import { UserTile } from "./UserTile";
import { CodeEditor } from "./CodeEditor";
import { Whiteboard } from "./Whiteboard";
import { MeetingControls } from "./MeetingControls";
import { SidePanel } from "./SidePanel";
import { CaptionsOverlay } from "./CaptionsOverlay";
import { FloatingReactions, FloatingReactionItem } from "./FloatingReactions";
import { EvaluationModal } from "./EvaluationModal";
import { API_BASE } from "../../../../services/api";
import { useAuth } from "../../../../context/AuthContext";
import { Sparkles, Radio, Maximize2, Minimize2, ShieldCheck, AlertTriangle, Eye, X } from "lucide-react";

interface MeetingRoomProps {
  config: InterviewConfig;
  userStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onLeaveMeeting: () => void;
  proctoredAssessment?: boolean;
  onAssessmentResult?: (result: { report: EvaluationReport; warnings: number; disqualified: boolean; candidateTurns: number; codeArtifact: string; interviewMode: InterviewConfig['interviewMode'] } | null) => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  config,
  userStream,
  isMuted,
  isVideoOff,
  onToggleMic,
  onToggleVideo,
  onLeaveMeeting,
  proctoredAssessment = true,
  onAssessmentResult,
}) => {
  const { getAuthHeaders } = useAuth();
  const [activeLayout, setActiveLayout] = useState<MeetingLayout>("split");
  const [activeSideTab, setActiveSideTab] = useState<"people" | "chat" | "rubric" | "notes" | "proctor" | "analysis" | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Proctoring & Noticing Radar states
  const [proctorWarnings, setProctorWarnings] = useState<ProctorWarning[]>([]);
  const [scratchpadNotes, setScratchpadNotes] = useState<ScratchpadNote[]>([]);
  const [liveAnalysis, setLiveAnalysis] = useState<LiveAnswerAnalysis[]>([]);
  const [isAnalyzingAnswer, setIsAnalyzingAnswer] = useState(false);
  const [orchestratorActions, setOrchestratorActions] = useState<OrchestratorAction[]>([]);
  const [orchestratorNotice, setOrchestratorNotice] = useState<OrchestratorAction | null>(null);
  const [cameraVisibilityMessage, setCameraVisibilityMessage] = useState<string | null>(null);
  const [cameraVisibilityCountdown, setCameraVisibilityCountdown] = useState<number | null>(null);
  const [activeWarningBanner, setActiveWarningBanner] = useState<ProctorWarning | null>(null);
  const [pushedChallenge, setPushedChallenge] = useState<{
    challenge_title?: string;
    language?: string;
    starter_code?: string;
    problem_description?: string;
  } | null>(null);
  const [disqualificationReason, setDisqualificationReason] = useState<string | null>(null);

  useEffect(() => {
    if (cameraVisibilityCountdown === null || cameraVisibilityCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCameraVisibilityCountdown((seconds) => seconds === null ? null : Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cameraVisibilityCountdown]);

  // Live Speech & Audio states
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [aiVolume, setAiVolume] = useState(0);
  const [userVolume, setUserVolume] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<{
    speaker: "ai" | "user" | "none";
    speakerName: string;
    text: string;
  }>({
    speaker: "none",
    speakerName: "",
    text: "",
  });
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserTurnTextRef = useRef("");
  const userTurnCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeminiInputTranscriptTimeRef = useRef<number>(0);

  // Helper: display sliding window for captions so long turns remain concise and legible
  const formatCaptionWindow = useCallback((fullText: string, maxWords = 22): string => {
    if (!fullText) return "";
    const words = fullText.trim().split(/\s+/);
    if (words.length <= maxWords) return fullText.trim();
    return "… " + words.slice(-maxWords).join(" ");
  }, []);

  // Helper: set caption with auto-clear after delay (like real closed captions)
  const setCaptionWithAutoClear = useCallback((caption: { speaker: "ai" | "user" | "none"; speakerName: string; text: string }, clearDelayMs = 4000) => {
    if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    setCurrentCaption(caption);
    if (caption.speaker !== "none" && clearDelayMs > 0) {
      captionTimerRef.current = setTimeout(() => {
        setCurrentCaption({ speaker: "none", speakerName: "", text: "" });
        captionTimerRef.current = null;
      }, clearDelayMs);
    }
  }, []);

  // Data collections
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [rubricStages, setRubricStages] = useState<RubricStage[]>(INITIAL_RUBRIC_STAGES);
  const [reactions, setReactions] = useState<FloatingReactionItem[]>([]);
  const [analytics, setAnalytics] = useState<LiveAnalytics>({
    userSpeakingSeconds: 0,
    aiSpeakingSeconds: 0,
    interruptionCount: 0,
    turnCount: 0,
    paceWpm: 130,
  });

  // Post-Interview Evaluation Modal
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState<EvaluationReport | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastCodeWritten, setLastCodeWritten] = useState<string>("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const localViolationCountRef = useRef(0);
  const liveAnalysisRef = useRef<LiveAnswerAnalysis[]>([]);
  const transcriptsRef = useRef(transcripts);
  const scratchpadNotesRef = useRef(scratchpadNotes);
  const proctorWarningsRef = useRef(proctorWarnings);
  const lastCodeWrittenRef = useRef(lastCodeWritten);
  const orchestratorActionsRef = useRef(orchestratorActions);
  const uiEventsRef = useRef<Array<{ event: string; detail: string; timestamp: string }>>([]);
  transcriptsRef.current = transcripts;
  scratchpadNotesRef.current = scratchpadNotes;
  proctorWarningsRef.current = proctorWarnings;
  lastCodeWrittenRef.current = lastCodeWritten;
  orchestratorActionsRef.current = orchestratorActions;
  const isDisqualifiedRef = useRef(false);
  const endCallStartedRef = useRef(false);
  const terminationReasonRef = useRef("");
  const proctorWarningCountRef = useRef(0);
  const lastLocalWarningAtRef = useRef(0);

  // Refs
  const audioManagerRef = useRef<AudioStreamingManager | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const devStrictModeProbeSkippedRef = useRef(false);
  const emitUiEvent = (name: string, detail = "") => {
    uiEventsRef.current = [...uiEventsRef.current, {
      event: name,
      detail,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    }].slice(-40);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ui_event", name, details: { detail } }));
    }
  };
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoFeedRef = useRef<HTMLVideoElement | null>(null);

  // Track if raw PCM audio was received during current turn
  const hasPcmAudioRef = useRef(false);
  const currentAiTurnTextRef = useRef("");
  const speechRecognitionRef = useRef<any>(null);
  // When true, discard incoming audio chunks (user interrupted the AI)
  const discardAudioRef = useRef(false);
  const discardAudioTimerRef = useRef<any>(null);

  // Sync state refs for speech recognition and callback closures
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const isAiSpeakingRef = useRef(isAiSpeaking);
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  // Unlock AudioContext on any user click
  const handleUnlockAudio = useCallback(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.unlockAudioContext();
    }
    setAudioUnlocked(true);
  }, []);

  // Use browser speech only when a completed Live turn supplied captions but no PCM audio.
  const speakAiText = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = /[\u0900-\u097f]/.test(text) ? "hi-IN" : "en-IN";
    utterance.rate = 0.94;
    utterance.pitch = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speakAiTextRef = useRef(speakAiText);
  useEffect(() => {
    speakAiTextRef.current = speakAiText;
  }, [speakAiText]);

  const [reconnectCount, setReconnectCount] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const isCallEndedRef = useRef(false);

  const analyzeCompletedAnswer = useCallback(async (answer: string) => {
    if (!answer.trim()) return;
    setIsAnalyzingAnswer(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/interview/analyze-live-turn`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          answer,
          skillAssessment: config.proctoredSkill || null,
          role: config.role,
          jobDescription: config.jobDescription,
        }),
      });
      if (!response.ok) return;
      const result = await response.json();
      const item: LiveAnswerAnalysis = {
        id: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        headline: result.headline || "Answer reviewed",
        evidence: result.evidence || answer.slice(0, 220),
        rubric_area: result.rubric_area || config.proctoredSkill || config.role || "Interview response",
        feedback: result.feedback || "See the final report for full-session feedback.",
        confidence: result.confidence || "limited",
      };
      liveAnalysisRef.current = [item, ...liveAnalysisRef.current].slice(0, 8);
      setLiveAnalysis(liveAnalysisRef.current);
    } catch (error) {
      console.info("Live answer analysis could not be reached; final evaluation remains available.", error);
    } finally {
      setIsAnalyzingAnswer(false);
    }
  }, [config.proctoredSkill, config.role, config.jobDescription]);

  // Stable key so the WebSocket connection lifecycle is not re-triggered by cosmetic parent re-renders
    const connectionKey = `${config.role}_${config.interviewerProfile?.company || ""}_${config.interviewerProfile?.name || "Interviewer"}_${config.interviewerProfile?.voice || "Kore"}_${config.candidateName}`;

  // Initialize Audio & WebSocket Connection
  useEffect(() => {
    // React.StrictMode runs an extra mount/cleanup cycle in development. Skip
    // that probe so it cannot open a backend session that is closed immediately.
    if ((import.meta as any).env?.DEV && !devStrictModeProbeSkippedRef.current) {
      devStrictModeProbeSkippedRef.current = true;
      return;
    }
    const audioManager = new AudioStreamingManager();
    audioManagerRef.current = audioManager;

    audioManager.setOnVolumeChange((inVol, outVol) => {
      setUserVolume(inVol);
      setAiVolume(outVol);
      setIsAiSpeaking(outVol > 0.04);
    });

    audioManager.setOnUserInterrupt(() => {
      console.log("[Live] ⚡ Proactive User Barge-In detected — stopping audio playback");
      discardAudioRef.current = true;
      setIsAiSpeaking(false);
      setIsInterrupted(true);
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "interrupt" }));
      }
      setTimeout(() => setIsInterrupted(false), 1500);

      if (discardAudioTimerRef.current) clearTimeout(discardAudioTimerRef.current);
      discardAudioTimerRef.current = setTimeout(() => {
        discardAudioRef.current = false;
        discardAudioTimerRef.current = null;
      }, 500);
    });

    // Determine WS URL: Supports explicit VITE_WS_URL, VITE_API_BASE_URL, or defaults to current host / Render in production
    let wsUrl: string;
    const envWs = (import.meta as any).env?.VITE_WS_URL;
    const envApi = (import.meta as any).env?.VITE_API_BASE_URL;

    if (envWs) {
      wsUrl = envWs.endsWith("/api/live") ? envWs : `${envWs.replace(/\/$/, "")}/api/live`;
    } else if (envApi && !envApi.includes("localhost") && !envApi.includes("127.0.0.1")) {
      const wsProtocol = envApi.startsWith("https") ? "wss:" : "ws:";
      const hostPart = envApi.replace(/^https?:\/\//, "").replace(/\/$/, "");
      wsUrl = `${wsProtocol}//${hostPart}/api/live`;
    } else if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
      // Running on Vercel -> connect directly to deployed Render backend WebSockets
      wsUrl = "wss://careerosv5.onrender.com/api/live";
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/live`;
    }

    const params = new URLSearchParams({
      role: config.role || "",
      company: config.company || config.interviewerProfile?.company || "",
      candidate_name: config.candidateName || "",
      voice: config.interviewerProfile?.voice || "Kore",
      job_description: config.jobDescription || "",
      round_type: config.format || "mixed",
      difficulty: config.seniority || "medium",
      interview_mode: config.interviewMode || "strict",
    });
    wsUrl = `${wsUrl}?${params.toString()}`;

    // Close any previous lingering socket before creating a new connection
    if (socketRef.current) {
      try {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;
    } catch (e) {
      console.warn("Failed to instantiate interview WebSocket:", e);
      setIsConnecting(false);
      setCurrentCaption({ speaker: "ai", speakerName: "System", text: "Live interview connection is unavailable. Please retry." });
    }

    // Failsafe timer: unblock 'Connecting...' spinner after 5s if still loading
    const connectingTimeout = setTimeout(() => {
      setIsConnecting(false);
    }, 5000);

    if (ws) {
      ws.onopen = () => {
        clearTimeout(connectingTimeout);
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        reconnectAttemptsRef.current = 0;
        console.log("WebSocket connected to", wsUrl);
        setIsConnecting(false);
        discardAudioRef.current = false;
        // Send Setup packet to Gemini Live API
        ws?.send(
          JSON.stringify({
            type: "setup",
            role: config.role,
            seniority: config.seniority,
            voice: config.interviewerProfile.voice,
            candidateName: config.candidateName,
            interviewType: config.format,
            customContext: `Candidate Resume: ${config.resumeText}\nJob Description: ${config.jobDescription}`,
          })
        );
      };

      ws.onclose = (event: CloseEvent) => {
        console.log(`[Live] WebSocket connection closed (code: ${event.code}, reason: "${event.reason}", wasClean: ${event.wasClean})`);
        
        // If user voluntarily ended the call or normal 1000 closure, do not reconnect
        if (isCallEndedRef.current || event.code === 1000) {
          setIsConnecting(false);
          return;
        }

        // Auto-reconnect on service restart (1012), network drop (1006), or unexpected closure
        if (reconnectAttemptsRef.current < 6) {
          reconnectAttemptsRef.current += 1;
          console.log(`[Live] Connection closed unexpectedly (code: ${event.code}). Auto-reconnecting (${reconnectAttemptsRef.current}/6) to Gemini Live...`);
          setIsConnecting(true);
          setTimeout(() => {
            setReconnectCount((c) => c + 1);
          }, 1200);
        } else {
          setIsConnecting(false);
          console.warn("[Live] Maximum reconnect attempts reached.");
        }
      };

      ws.onerror = (err) => {
        console.warn("Live WebSocket error:", err);
      };
    }

    if (ws) {
      ws.onmessage = (event) => {
        try {
          if (typeof event.data !== "string") {
            // Binary Blob received, skip JSON parse
            return;
          }
          const msg = JSON.parse(event.data);

        if (msg.type === "ready") {
          clearTimeout(connectingTimeout);
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }
            console.log("[Live] ✓ Session ready — AI interviewer connected");
          discardAudioRef.current = false;
          setIsConnecting(false);
        } else if (msg.type === "audio") {
          // Skip audio chunks from an interrupted AI turn
          if (discardAudioRef.current) return;
          hasPcmAudioRef.current = audioManager.playAudioChunk(msg.data) || hasPcmAudioRef.current;
          setIsInterrupted(false);
        } else if (msg.type === "output_transcript") {
          // Fresh speech arrived: ensure audio playback is unblocked
          discardAudioRef.current = false;
          if (discardAudioTimerRef.current) {
            clearTimeout(discardAudioTimerRef.current);
            discardAudioTimerRef.current = null;
          }
          // If candidate was speaking when AI speech started, finalize candidate turn
          if (currentUserTurnTextRef.current.trim()) {
            const completedAnswer = currentUserTurnTextRef.current.trim();
            currentUserTurnTextRef.current = "";
            if (userTurnCompleteTimeoutRef.current) {
              clearTimeout(userTurnCompleteTimeoutRef.current);
              userTurnCompleteTimeoutRef.current = null;
            }
            void analyzeCompletedAnswer(completedAnswer);
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === "user" && !last.isFinal) {
                return [...prev.slice(0, -1), { ...last, isFinal: true }];
              }
              return prev;
            });
          }

          // Closed captions for AI — show accumulated sliding window
          currentAiTurnTextRef.current += (currentAiTurnTextRef.current ? " " : "") + msg.text;
          // Cancel any pending auto-clear since AI is still speaking
          if (captionTimerRef.current) { clearTimeout(captionTimerRef.current); captionTimerRef.current = null; }
          setCurrentCaption({
            speaker: "ai",
            speakerName: config.interviewerProfile.name,
            text: formatCaptionWindow(currentAiTurnTextRef.current, 22),
          });
          // Append to transcripts
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === "ai" && !last.isFinal) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + " " + msg.text },
              ];
            }
            return [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                speaker: "ai",
                speakerName: config.interviewerProfile.name,
                text: msg.text,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                isFinal: false,
              },
            ];
          });
        } else if (msg.type === "input_transcript") {
          lastGeminiInputTranscriptTimeRef.current = Date.now();
          const cleanChunk = (msg.text || "").trim();
          if (!cleanChunk) return;

          // Accumulate candidate turn text
          currentUserTurnTextRef.current += (currentUserTurnTextRef.current ? " " : "") + cleanChunk;

          // Display candidate's speech in closed captions
          if (captionTimerRef.current) {
            clearTimeout(captionTimerRef.current);
            captionTimerRef.current = null;
          }
          setCurrentCaption({
            speaker: "user",
            speakerName: config.candidateName || "You",
            text: formatCaptionWindow(currentUserTurnTextRef.current, 22),
          });

          // Append to transcripts list
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === "user" && !last.isFinal) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + " " + cleanChunk },
              ];
            }
            return [
              ...prev,
              {
                id: `user-${Date.now()}`,
                speaker: "user",
                speakerName: config.candidateName || "You",
                text: cleanChunk,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                isFinal: false,
              },
            ];
          });

          // Debounce user turn completion (after 2s of silence, finalize turn and analyze)
          if (userTurnCompleteTimeoutRef.current) {
            clearTimeout(userTurnCompleteTimeoutRef.current);
          }
          userTurnCompleteTimeoutRef.current = setTimeout(() => {
            if (currentUserTurnTextRef.current.trim()) {
              const fullAnswer = currentUserTurnTextRef.current.trim();
              currentUserTurnTextRef.current = "";
              void analyzeCompletedAnswer(fullAnswer);
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === "user" && !last.isFinal) {
                  return [...prev.slice(0, -1), { ...last, isFinal: true }];
                }
                return prev;
              });
            }
            if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
            captionTimerRef.current = setTimeout(() => {
              setCurrentCaption((prev) => prev.speaker === "user" ? { speaker: "none", speakerName: "", text: "" } : prev);
              captionTimerRef.current = null;
            }, 3500);
            userTurnCompleteTimeoutRef.current = null;
          }, 2000);
        } else if (msg.type === "visual_observation") {
          const observation = msg.data?.description;
          if (observation) {
            const item: ScratchpadNote = {
              id: `visual-${Date.now()}`,
              category: "visual_observation",
              observation,
              sentiment: "neutral",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setScratchpadNotes((prev) => [item, ...prev]);
            setCaptionWithAutoClear({
              speaker: "ai",
              speakerName: config.interviewerProfile.name,
              text: observation,
            }, 5000);
          }
        } else if (msg.type === "camera_visibility_check") {
          setCameraVisibilityMessage(msg.data?.message || "Please return to the camera view.");
          setCameraVisibilityCountdown(Number(msg.data?.countdown_seconds || 10));
        } else if (msg.type === "camera_visibility_warning") {
          setCameraVisibilityMessage(msg.data?.message || "The interview is paused until the camera view is restored.");
          setCameraVisibilityCountdown(0);
        } else if (msg.type === "camera_attention_check") {
          setCameraVisibilityMessage(msg.data?.message || "The camera review noticed repeated off-camera gaze. Please explain if you are checking something or need a moment.");
          setCameraVisibilityCountdown(null);
          window.setTimeout(() => setCameraVisibilityMessage(null), 7000);
        } else if (msg.type === "device_attention_check") {
          setCameraVisibilityMessage(msg.data?.message || "A phone is visible while the camera review sees repeated off-camera attention. Please clarify whether you are using it.");
          setCameraVisibilityCountdown(null);
          window.setTimeout(() => setCameraVisibilityMessage(null), 9000);
        } else if (msg.type === "camera_visibility_restored") {
          setCameraVisibilityMessage(msg.data?.message || "Camera view restored. The interview can continue.");
          setCameraVisibilityCountdown(null);
          window.setTimeout(() => setCameraVisibilityMessage(null), 3500);
        } else if (msg.type === "interrupted") {
          // Candidate interrupted the AI — discard in-flight stale audio from previous turn
          console.log("[Live] ⚡ Interrupted — discarding in-flight audio");
          discardAudioRef.current = true;
          audioManager.stopPlayback();
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          setIsAiSpeaking(false);
          setIsInterrupted(true);
          // Clear stale AI captions on interruption
          if (captionTimerRef.current) { clearTimeout(captionTimerRef.current); captionTimerRef.current = null; }
          setCurrentCaption({ speaker: "none", speakerName: "", text: "" });
          setAnalytics((prev) => ({
            ...prev,
            interruptionCount: prev.interruptionCount + 1,
          }));
          setTimeout(() => setIsInterrupted(false), 2000);

          // Flush in-flight stale chunks for at most 400ms, then automatically re-arm for next turn
          if (discardAudioTimerRef.current) clearTimeout(discardAudioTimerRef.current);
          discardAudioTimerRef.current = setTimeout(() => {
            discardAudioRef.current = false;
            discardAudioTimerRef.current = null;
          }, 400);
        } else if (msg.type === "turn_complete") {
          // Re-enable audio for the next AI turn
          discardAudioRef.current = false;
          if (discardAudioTimerRef.current) {
            clearTimeout(discardAudioTimerRef.current);
            discardAudioTimerRef.current = null;
          }
          if ((!hasPcmAudioRef.current || !audioManager.isOutputContextRunning()) && currentAiTurnTextRef.current.trim()) {
            speakAiTextRef.current(currentAiTurnTextRef.current);
          }
          // Mark last AI transcript item as final
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === "ai") {
              return [...prev.slice(0, -1), { ...last, isFinal: true }];
            }
            return prev;
          });
          hasPcmAudioRef.current = false;
          currentAiTurnTextRef.current = "";
          // Auto-clear AI caption after turn ends (brief delay so user can read last words)
          if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
          captionTimerRef.current = setTimeout(() => {
            setCurrentCaption((prev) => prev.speaker === "ai" ? { speaker: "none", speakerName: "", text: "" } : prev);
            captionTimerRef.current = null;
          }, 3500);

          setAnalytics((prev) => ({
            ...prev,
            turnCount: prev.turnCount + 1,
          }));
        } else if (msg.type === "interviewer_reaction") {
          if (msg.data?.emoji) {
            handleTriggerReaction(msg.data.emoji, true);
          }
        } else if (msg.type === "conduct_warning" || msg.type === "proctor_warning") {
          const warningData = msg.data || msg.warning || {};
          const warningItem: ProctorWarning = {
            warning_number: warningData.warning_number || warningData.warning_level || (proctorWarnings.length + 1),
            warning_message: warningData.warning_reason || warningData.warning_message || "A session event was flagged for review. Please continue; automated flags can be mistaken.",
            violation_type: warningData.violation_type || "unverified_event",
            timestamp: warningData.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setProctorWarnings((prev) => [...prev, warningItem]);
          proctorWarningCountRef.current = Math.max(proctorWarningCountRef.current, warningItem.warning_number);
          setActiveWarningBanner(warningItem);
          setTimeout(() => setActiveWarningBanner(null), 7000);
        } else if (msg.type === "interviewer_observation" || msg.type === "scratchpad_updated") {
          const noteData = msg.data || msg.note || {};
          const noteItem: ScratchpadNote = {
            id: noteData.id || `note-${Date.now()}-${Math.random()}`,
            category: noteData.category || "general",
            observation: noteData.note || noteData.observation || "",
            sentiment: noteData.observation_type || noteData.sentiment || "neutral",
            timestamp: noteData.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            confidence_score: noteData.confidence_score ?? noteData.confidence,
          };
          setScratchpadNotes((prev) => [noteItem, ...prev]);
        } else if (msg.type === "orchestrator_action") {
          const action = msg.data as OrchestratorAction;
          const nextActions = [action, ...orchestratorActionsRef.current].slice(0, 12);
          orchestratorActionsRef.current = nextActions;
          setOrchestratorActions(nextActions);
          setOrchestratorNotice(action);
          window.setTimeout(() => setOrchestratorNotice((current) => current?.id === action.id ? null : current), 8000);
        } else if (msg.type === "push_coding_challenge") {
          const challenge = msg.data || {};
          setPushedChallenge(challenge);
          setActiveLayout("code_split");
        } else if (msg.type === "update_whiteboard") {
          setActiveLayout("whiteboard_split");
        } else if (msg.type === "ui_action") {
          const action = msg.data?.action;
          if (action === "open_coding_playground") setActiveLayout("code_split");
          else if (action === "open_whiteboard") setActiveLayout("whiteboard_split");
          else if (action === "set_layout" && ["split", "interviewer_focus", "candidate_focus", "code_split", "whiteboard_split"].includes(msg.data?.layout)) {
            setActiveLayout(msg.data.layout as MeetingLayout);
          } else if (action === "open_panel" && (
            ["people", "chat", "rubric", "notes", "analysis"].includes(msg.data?.panel)
            || (config.interviewMode === "strict" && msg.data?.panel === "proctor")
          )) {
            setActiveSideTab(msg.data.panel);
          } else if (action === "close_panel") setActiveSideTab(null);
          else if (action === "set_captions") setCaptionsEnabled(Boolean(msg.data?.enabled));
          else if (action === "trigger_reaction" && msg.data?.emoji) handleTriggerReaction(msg.data.emoji, true);
        } else if (msg.type === "conclude_interview" || msg.type === "interview_terminated") {
          if (msg.type === "interview_terminated") {
            isDisqualifiedRef.current = true;
            terminationReasonRef.current = msg.reason || "The interview ended after the proctoring escalation limit was reached.";
            proctorWarningCountRef.current = Math.max(proctorWarningCountRef.current, Number(msg.warningsIssued || 0));
            setDisqualificationReason(terminationReasonRef.current);
          }
          handleEndCall();
        } else if (msg.type === "status") {
          // Model fallback progress updates from server
          console.log("[Live Status]", msg.message);
          setCaptionWithAutoClear({
            speaker: "ai",
            speakerName: "System",
            text: msg.message || "Connecting...",
          }, 6000);
        } else if (msg.type === "error") {
          console.error("[Live Error]", msg.message);
          setIsConnecting(false);
          setCaptionWithAutoClear({
            speaker: "ai",
            speakerName: "System",
            text: msg.message || "Live interview response is unavailable. Please retry.",
          }, 8000);
        } else if (msg.type === "session_closed") {
          console.warn("[Live] Session closed by server");
          setIsConnecting(false);
          setCaptionWithAutoClear({
            speaker: "ai",
            speakerName: "System",
            text: "Session ended. Refresh to start a new interview.",
          }, 0); // Don't auto-clear — persistent message
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    };
  }

    // Forward mic audio PCM to WebSocket if connected
    audioManager.setOnAudioChunk((base64Pcm) => {
      // Never let a slow socket buffer seconds of stale speech; live voice should
      // resume from the current phrase as soon as the connection catches up.
      if (ws && ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 32 * 1024) {
        ws.send(JSON.stringify({ type: "audio", data: base64Pcm }));
      }
    });

    // Start Audio Capture with user's stream
    if (userStream) {
      void audioManager.startAudioCapture(userStream).catch((error) => {
        console.error("Could not start live microphone streaming:", error);
        setCaptionWithAutoClear({
          speaker: "ai",
          speakerName: "System",
          text: "I can’t hear you yet. Please check microphone permission and reload the interview if needed.",
        }, 8000);
      });
    }

    // Browser speech recognition is caption-only. Gemini Live's input transcript
    // is the canonical record; keeping both created duplicate evidence in reports.
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        speechRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (e: any) => {
          // CRITICAL: Ignore any input if candidate is muted, or if AI is currently speaking/playing audio
          if (isMutedRef.current || isAiSpeakingRef.current || audioManager.hasActivePlayback()) {
            return;
          }

          let interim = "";
          let final = "";

          for (let i = e.resultIndex; i < e.results.length; i++) {
            const text = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              final += text;
            } else {
              interim += text;
            }
          }

          const currentText = (final || interim).trim();
          if (!currentText) return;

          // If Gemini Live's native input_transcript arrived within the last 1500ms,
          // Gemini Live is providing cloud-native transcription, so don't double-post.
          const isGeminiLiveTranscribing = Date.now() - lastGeminiInputTranscriptTimeRef.current < 1500;
          if (isGeminiLiveTranscribing) return;

          // Otherwise, browser SpeechRecognition serves as real-time caption provider
          currentUserTurnTextRef.current = currentText;
          if (captionTimerRef.current) {
            clearTimeout(captionTimerRef.current);
            captionTimerRef.current = null;
          }
          setCurrentCaption({
            speaker: "user",
            speakerName: config.candidateName || "You",
            text: formatCaptionWindow(currentText, 22),
          });

          // Recover spoken answers as text when the browser's WebAudio path
          // is not actually capturing speech. This also records the answer
          // through the canonical server transcript path.
          if (final.trim() && !audioManager.hasRecentSpeech() && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "recognized_text", data: final.trim() }));
          }

          if (userTurnCompleteTimeoutRef.current) clearTimeout(userTurnCompleteTimeoutRef.current);
          userTurnCompleteTimeoutRef.current = setTimeout(() => {
            if (currentUserTurnTextRef.current.trim()) {
              const fullAnswer = currentUserTurnTextRef.current.trim();
              currentUserTurnTextRef.current = "";
              void analyzeCompletedAnswer(fullAnswer);
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === "user" && !last.isFinal) {
                  return [...prev.slice(0, -1), { ...last, isFinal: true }];
                }
                return [
                  ...prev,
                  {
                    id: `user-${Date.now()}`,
                    speaker: "user",
                    speakerName: config.candidateName || "You",
                    text: fullAnswer,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    isFinal: true,
                  },
                ];
              });
            }
            if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
            captionTimerRef.current = setTimeout(() => {
              setCurrentCaption((prev) => prev.speaker === "user" ? { speaker: "none", speakerName: "", text: "" } : prev);
              captionTimerRef.current = null;
            }, 3500);
            userTurnCompleteTimeoutRef.current = null;
          }, 2000);
        };

        recognition.onerror = (err: any) => {
          if (err?.error !== "no-speech" && err?.error !== "aborted") {
            console.debug("Speech recognition event:", err?.error);
          }
        };

        recognition.onend = () => {
          // Auto-restart speech recognition if still in meeting
          if (speechRecognitionRef.current) {
            try {
              recognition.start();
            } catch (e) {}
          }
        };

        recognition.start();
      } catch (err) {
        console.debug("Speech recognition start skipped:", err);
      }
    }

    // Ultra-strict proctoring: capture frames at 2.5 FPS for near-instant violation detection.
    // Track whether we've already sent a camera-off notification to avoid spamming
    let cameraOffNotified = false;
    frameIntervalRef.current = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // CRITICAL: If video is off, notify backend so proctor heartbeat detects it
      if (isVideoOff) {
        if (!cameraOffNotified) {
          cameraOffNotified = true;
          ws.send(JSON.stringify({ type: "camera_state", active: false }));
        }
        return;
      }
      // Video is on — reset notification flag
      if (cameraOffNotified) {
        cameraOffNotified = false;
        ws.send(JSON.stringify({ type: "camera_state", active: true }));
      }

      if (ws.bufferedAmount > 24 * 1024) return;
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      // Prioritize on-screen active video feed in UserTile (active in viewport, never suspended by Safari)
      let activeVideo = (document.getElementById("active-user-webcam-video") as HTMLVideoElement) || videoFeedRef.current;
      if (!activeVideo || activeVideo.readyState < 2 || activeVideo.videoWidth === 0 || activeVideo.paused) {
        const allVideos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
        const playing = allVideos.find((v) => v.readyState >= 2 && v.videoWidth > 0 && !v.paused);
        if (playing) {
          activeVideo = playing;
        }
      }

      if (activeVideo && activeVideo.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Preserve source detail for face, hand, device, and additional-person observations.
          const scale = Math.min(720 / activeVideo.videoWidth, 540 / activeVideo.videoHeight, 1);
          canvas.width = Math.max(1, Math.round(activeVideo.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(activeVideo.videoHeight * scale));
          ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const base64Jpeg = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
          ws.send(JSON.stringify({ type: "video", data: base64Jpeg }));
        }
      }
    }, 400);

    // Live analytics timer
    const analyticsTimer = setInterval(() => {
      setAnalytics((prev) => ({
        ...prev,
        userSpeakingSeconds: prev.userSpeakingSeconds + (userVolume > 0.05 && !isMuted ? 1 : 0),
        aiSpeakingSeconds: prev.aiSpeakingSeconds + (isAiSpeaking ? 1 : 0),
      }));
    }, 1000);

    return () => {
      clearTimeout(connectingTimeout);
      clearInterval(analyticsTimer);
      if (discardAudioTimerRef.current) clearTimeout(discardAudioTimerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) {}
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioManager.cleanup();
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [connectionKey, reconnectCount, analyzeCompletedAnswer]);

  // Update mute state in Audio Manager
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setMute(isMuted);
    }
  }, [isMuted]);

  // Update video element feed source and start playback
  useEffect(() => {
    if (videoFeedRef.current) {
      videoFeedRef.current.srcObject = screenStream || userStream;
      videoFeedRef.current.play().catch(() => {});
    }
  }, [userStream, screenStream, isVideoOff]);

  // Screen share handling
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
      }
      setIsScreenSharing(false);
      emitUiEvent("screen_share_stopped");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);
        emitUiEvent("screen_share_started");
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
        };
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  };

  // Reactions trigger
  const handleTriggerReaction = (emoji: string, fromInterviewer = false) => {
    const newReaction: FloatingReactionItem = {
      id: `react-${Date.now()}-${Math.random()}`,
      emoji,
      leftPercent: 30 + Math.random() * 40,
    };
    setReactions((prev) => [...prev, newReaction]);
    if (!fromInterviewer) emitUiEvent("reaction_sent", emoji);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2500);
  };

  // Chat message send
  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      senderName: config.candidateName || "You",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages((prev) => [...prev, newMsg]);

    // Send to Gemini Live session
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "text",
          data: `Candidate shared message in chat: "${text}"`,
        })
      );
    }
  };

  // Sync Code IDE with AI
  const handleSyncCodeWithAi = (code: string, language: string) => {
    setLastCodeWritten(code);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "text",
          data: `[Candidate Code in ${language} IDE]:\n\`\`\`${language}\n${code}\n\`\`\`\nPlease examine the candidate's code, give interactive feedback or ask them about their design choices.`,
        })
      );
    }
    handleTriggerReaction("💻");
  };

  // Sync Whiteboard with AI
  const handleSyncWhiteboardWithAi = (base64Jpeg: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "video",
          data: base64Jpeg,
        })
      );
      socketRef.current.send(
        JSON.stringify({
          type: "text",
          data: "Candidate updated their System Design Whiteboard architecture diagram. Please review the diagram they drew on their screen.",
        })
      );
    }
    handleTriggerReaction("🎨");
  };

  const registerLocalProctorWarning = useCallback((reason: string) => {
    if (!proctoredAssessment || isDisqualifiedRef.current) return;
    const now = Date.now();
    // 30s debounce between local warnings to avoid rapid-fire
    if (now - lastLocalWarningAtRef.current < 30_000) return;
    lastLocalWarningAtRef.current = now;
    localViolationCountRef.current += 1;
    const number = localViolationCountRef.current;
    const warning: ProctorWarning = {
      warning_number: Math.min(3, proctorWarnings.length + 1),
      violation_type: 'assessment_integrity',
      warning_message: reason,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setProctorWarnings(previous => [...previous, warning]);
    setActiveWarningBanner(warning);
    setTimeout(() => setActiveWarningBanner(null), 10_000);
    // Local violations require 5 strikes to disqualify (backend proctor handles vision-based disqualification at 3)
    if (number >= 5) {
      isDisqualifiedRef.current = true;
      setDisqualificationReason('The assessment was ended after repeated camera, microphone, fullscreen, or focus interruptions.');
      setTimeout(() => { void handleEndCall(); }, 0);
    }
  }, [proctoredAssessment, proctorWarnings.length]);

  useEffect(() => {
    if (!proctoredAssessment) return;
    const mountedAt = Date.now();
    let cameraFlagged = false;
    let micFlagged = false;
    let focusFlagged = false;
    // Fullscreen is optional unless the candidate entered it first. Do not
    // count page load outside fullscreen as a violation.
    let fullscreenFlagged = !document.fullscreenElement;
    const checkDevices = () => {
      // 30 second warmup grace period — don't fire local warnings while candidate is setting up
      if (Date.now() - mountedAt < 30_000) return;
      const cameraLive = Boolean(userStream?.getVideoTracks().some(track => track.readyState === 'live' && track.enabled)) && !isVideoOff;
      const micLive = Boolean(userStream?.getAudioTracks().some(track => track.readyState === 'live' && track.enabled)) && !isMuted;
      if (!cameraLive && !cameraFlagged) { cameraFlagged = true; registerLocalProctorWarning('Camera feed was disabled or interrupted.'); }
      else if (cameraLive) cameraFlagged = false;
      if (!micLive && !micFlagged) { micFlagged = true; registerLocalProctorWarning('Microphone was muted or interrupted.'); }
      else if (micLive) micFlagged = false;
    };
    const checkFocus = () => {
      if (document.visibilityState !== 'visible' && !focusFlagged) { focusFlagged = true; registerLocalProctorWarning('The assessment page was moved to the background.'); }
      else if (document.visibilityState === 'visible') focusFlagged = false;
    };
    const checkFullscreen = () => {
      if (!document.fullscreenElement && !fullscreenFlagged) { fullscreenFlagged = true; registerLocalProctorWarning('Fullscreen assessment mode was exited.'); }
      else if (document.fullscreenElement) fullscreenFlagged = false;
    };
    document.addEventListener('visibilitychange', checkFocus);
    document.addEventListener('fullscreenchange', checkFullscreen);
    const timer = window.setInterval(checkDevices, 1500);
    checkDevices();
    checkFullscreen();
    return () => {
      document.removeEventListener('visibilitychange', checkFocus);
      document.removeEventListener('fullscreenchange', checkFullscreen);
      window.clearInterval(timer);
    };
  }, [proctoredAssessment, userStream, isVideoOff, isMuted, registerLocalProctorWarning]);

  const guardMicToggle = () => {
    if (proctoredAssessment) {
      emitUiEvent("microphone_toggle_blocked", "Proctored mode keeps the microphone enabled.");
      registerLocalProctorWarning('Attempted to mute the microphone during a proctored assessment.');
      return;
    }
    if (!isMuted) {
      // User is muting: instantly clear user captions and clear in-progress turn
      currentUserTurnTextRef.current = "";
      if (userTurnCompleteTimeoutRef.current) {
        clearTimeout(userTurnCompleteTimeoutRef.current);
        userTurnCompleteTimeoutRef.current = null;
      }
      setCurrentCaption((prev) => prev.speaker === "user" ? { speaker: "none", speakerName: "", text: "" } : prev);
    }
    onToggleMic();
    emitUiEvent(isMuted ? "microphone_unmuted" : "microphone_muted");
  };
  const guardVideoToggle = () => {
    if (proctoredAssessment) {
      emitUiEvent("camera_toggle_blocked", "Proctored mode keeps the camera enabled.");
      registerLocalProctorWarning('Attempted to turn off the camera during a proctored assessment.');
      return;
    }
    onToggleVideo();
    emitUiEvent(isVideoOff ? "camera_enabled" : "camera_disabled");
  };

  // End Call & Trigger Comprehensive Evaluation
  const handleEndCall = async () => {
    if (endCallStartedRef.current) return;
    endCallStartedRef.current = true;
    isCallEndedRef.current = true;
    setShowEvaluation(true);
    setIsEvaluating(true);

    if (audioManagerRef.current) {
      audioManagerRef.current.stopPlayback();
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }
    userStream?.getTracks().forEach((track) => track.stop());
    const liveSocket = socketRef.current;
    socketRef.current = null;
    if (liveSocket && liveSocket.readyState < WebSocket.CLOSING) {
      liveSocket.close(1000, "Interview ended");
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/interview/evaluate-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptsRef.current,
          company: config.company,
          role: config.role,
          seniority: config.seniority,
          format: config.format,
          skillAssessment: config.proctoredSkill || null,
          jobDescription: config.jobDescription,
          liveAnalysis: liveAnalysisRef.current,
          sessionObservations: scratchpadNotesRef.current,
          orchestratorActions: orchestratorActionsRef.current,
          uiEvents: uiEventsRef.current,
          proctorEvents: proctorWarningsRef.current.map(({ violation_type, warning_message, timestamp }) => ({ violation_type, warning_message, timestamp })),
          warningsIssued: proctorWarningCountRef.current,
          disqualified: isDisqualifiedRef.current,
          terminationReason: terminationReasonRef.current,
          candidateTurns: transcriptsRef.current.filter(item => item.speaker === 'user' && item.text.trim().length >= 12).length,
          codeSnippet: lastCodeWrittenRef.current,
          notes: chatMessages.map((m) => `${m.senderName}: ${m.text}`).join("\n"),
        }),
      });
      const data = await res.json();
      setEvaluationReport(data);
      if (proctoredAssessment && config.interviewMode === 'strict' && config.proctoredSkill && data && typeof data.overallScore === 'number') {
        onAssessmentResult?.({
          report: data,
          warnings: Math.max(proctorWarnings.length, localViolationCountRef.current),
          disqualified: isDisqualifiedRef.current || Boolean(disqualificationReason),
          candidateTurns: transcriptsRef.current.filter(item => item.speaker === 'user' && item.text.trim().length >= 12).length,
          codeArtifact: lastCodeWrittenRef.current,
          interviewMode: config.interviewMode,
        });
      }
    } catch (err) {
      console.error("Evaluation request failed:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div
      className="h-screen w-screen bg-[#202124] text-[#e8eaed] flex flex-col overflow-hidden select-none relative"
      onClick={handleUnlockAudio}
    >
      {/* Audio Unlock Overlay — Chrome requires a user gesture to play audio */}
      {!audioUnlocked && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center cursor-pointer"
          onClick={handleUnlockAudio}
        >
          <div className="text-center space-y-4 animate-pulse">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h2.5l4.5-4v14l-4.5-4z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Click to Start Interview</h2>
            <p className="text-gray-300 text-sm">Click anywhere to enable audio playback</p>
          </div>
        </div>
      )}

      {/* Active video & canvas for Safari-compliant frame grabbing */}
      <video
        ref={videoFeedRef}
        autoPlay
        playsInline
        muted
        style={{ position: "fixed", bottom: 0, right: 0, width: "320px", height: "180px", opacity: 0.001, pointerEvents: "none", zIndex: -10 }}
      />
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {orchestratorNotice && (
        <div className={`fixed right-4 top-16 z-[80] max-w-sm rounded-xl border p-3 shadow-2xl ${orchestratorNotice.action === "explanation_required" ? "border-amber-400/40 bg-amber-950/90" : "border-blue-400/30 bg-[#202124]/95"}`} role="status">
          <div className="text-xs font-semibold text-white">{orchestratorNotice.action === "explanation_required" ? "Please add context" : orchestratorNotice.action === "camera_adjustment_required" ? "Camera visibility check" : "Live assessment update"}</div>
          <p className="mt-1 text-xs leading-relaxed text-gray-200">{orchestratorNotice.message}</p>
        </div>
      )}

      {cameraVisibilityMessage && (
        <div className={`fixed left-1/2 top-16 z-[85] w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border p-4 shadow-2xl ${cameraVisibilityCountdown === 0 ? "border-amber-400/60 bg-amber-950/95" : "border-blue-400/50 bg-[#202124]/95"}`} role="alert" aria-live="assertive">
          <div className={`mb-1 text-xs font-bold uppercase tracking-wider ${cameraVisibilityCountdown === 0 ? "text-amber-200" : "text-blue-200"}`}>
            {cameraVisibilityCountdown === 0 ? "Camera visibility warning · please return to frame" : cameraVisibilityCountdown === null ? "Camera attention check · no score impact" : "Camera visibility check · no score impact"}
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm leading-relaxed text-white">{cameraVisibilityMessage}</p>
            {cameraVisibilityCountdown !== null && cameraVisibilityCountdown > 0 && (
              <span className="shrink-0 rounded-full border border-amber-300/50 px-3 py-1 text-lg font-bold tabular-nums text-amber-200" aria-label={`${cameraVisibilityCountdown} seconds remaining`}>
                {cameraVisibilityCountdown}s
              </span>
            )}
          </div>
          {cameraVisibilityCountdown !== null && cameraVisibilityCountdown > 0 && (
            <div className="mt-3 h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-300 transition-all duration-1000" style={{ width: `${cameraVisibilityCountdown * 10}%` }} /></div>
          )}
        </div>
      )}

      {/* Floating Emojis Overlay */}
      <FloatingReactions reactions={reactions} />

      {/* High-Impact Conduct Warning Banner (Proctored Mode) */}
      {activeWarningBanner && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-11/12 animate-bounce">
          <div className="bg-red-950/95 border-2 border-red-500 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start space-x-3.5 backdrop-blur-md">
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-red-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Proctor Warning</span>
                  <span className="px-2 py-0.5 bg-red-800 text-white rounded text-[11px]">
                    {activeWarningBanner.warning_number}/3
                  </span>
                </span>
                <button
                  onClick={() => setActiveWarningBanner(null)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-200 mt-1 leading-relaxed">
                {activeWarningBanner.warning_message}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-red-800/50 text-[11px] text-amber-300">
                <span>{activeWarningBanner.warning_number >= 2 ? "⚠️ FINAL WARNING — Next violation = disqualification" : "Proctoring integrity violation · formal warning issued"}</span>
                <span className="font-mono text-gray-400">{activeWarningBanner.timestamp}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Meeting Bar */}
      <header className="h-14 px-4 sm:px-6 bg-[#202124] border-b border-[#3c4043]/50 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {config.role} • {config.format}
            </h1>
            <div className="flex items-center space-x-2 text-[11px] text-gray-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <Radio className="w-3 h-3 animate-pulse" /> {config.interviewMode === "coach" ? "Coach mode · Guided feedback" : "Strict interview · Proctored"}
              </span>
              <span>•</span>
              <span>Interviewer: {config.interviewerProfile.name}</span>
            </div>
          </div>
        </div>

        {/* Top Right Controls & Status Indicators */}
        <div className="flex items-center space-x-2">
          {/* Proctoring Status Pill */}
          {proctoredAssessment && <button
            onClick={() => setActiveSideTab(activeSideTab === "proctor" ? null : "proctor")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              proctorWarnings.length > 0
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
            }`}
            title="Open session monitoring and event log"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Proctored:</span>
            <span className="font-bold">
              {proctorWarnings.length === 0 ? "Active" : `${proctorWarnings.length}/3 Warnings`}
            </span>
          </button>}

          {/* Live analysis shortcut */}
          <button
            onClick={() => setActiveSideTab(activeSideTab === "analysis" ? null : "analysis")}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 border border-blue-500/40 text-blue-300 hover:bg-blue-500/25 transition-all"
            title="View live answer analysis and evidence"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>Live Analysis</span>
          </button>

          {isHandRaised && (
            <div className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 animate-bounce">
              <span>✋</span> Hand Raised
            </div>
          )}

          <div className="hidden lg:flex items-center space-x-1.5 bg-[#2d2f34] px-3 py-1 rounded-full border border-[#3c4043] text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono">REC Live</span>
          </div>
        </div>
      </header>

      {/* Center Stage Layout */}
      <main className="flex-1 flex overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4 relative">
        {/* Dynamic Main Workspace */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {/* Layout 1: Normal Video Grid (Split) */}
          {activeLayout === "split" && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 h-full">
              {/* Interviewer Tile */}
              <InterviewerTile
                profile={config.interviewerProfile}
                isAiSpeaking={isAiSpeaking}
                aiVolume={aiVolume}
                isConnecting={isConnecting}
                isInterrupted={isInterrupted}
              />

              {/* Candidate Tile */}
              <UserTile
                stream={screenStream || userStream}
                candidateName={config.candidateName}
                isMuted={isMuted}
                isVideoOff={isVideoOff && !isScreenSharing}
                userVolume={userVolume}
                onToggleMic={guardMicToggle}
                onToggleVideo={guardVideoToggle}
              />
            </div>
          )}

          {/* Layout 2: Code Editor Split */}
          {activeLayout === "code_split" && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 h-full">
              {/* Video Tiles Stack (Left) */}
              <div className="lg:col-span-4 flex flex-col gap-3 h-full">
                <div className="flex-1 min-h-0">
                  <InterviewerTile
                    profile={config.interviewerProfile}
                    isAiSpeaking={isAiSpeaking}
                    aiVolume={aiVolume}
                    isConnecting={isConnecting}
                    isInterrupted={isInterrupted}
                  />
                </div>
                <div className="h-44 sm:h-52">
                  <UserTile
                    stream={screenStream || userStream}
                    candidateName={config.candidateName}
                    isMuted={isMuted}
                    isVideoOff={isVideoOff && !isScreenSharing}
                    userVolume={userVolume}
                    onToggleMic={guardMicToggle}
                    onToggleVideo={guardVideoToggle}
                  />
                </div>
              </div>

              {/* Code Editor (Right) */}
              <div className="lg:col-span-8 h-full">
                <CodeEditor
                  onSyncCodeWithAi={handleSyncCodeWithAi}
                  pushedChallenge={pushedChallenge}
                  onRequestAiChallenge={() => {
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                      socketRef.current.send(JSON.stringify({ type: "request_coding_challenge" }));
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Layout 3: Whiteboard Split */}
          {activeLayout === "whiteboard_split" && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 h-full">
              {/* Video Tiles Stack (Left) */}
              <div className="lg:col-span-4 flex flex-col gap-3 h-full">
                <div className="flex-1 min-h-0">
                  <InterviewerTile
                    profile={config.interviewerProfile}
                    isAiSpeaking={isAiSpeaking}
                    aiVolume={aiVolume}
                    isConnecting={isConnecting}
                    isInterrupted={isInterrupted}
                  />
                </div>
                <div className="h-44 sm:h-52">
                  <UserTile
                    stream={screenStream || userStream}
                    candidateName={config.candidateName}
                    isMuted={isMuted}
                    isVideoOff={isVideoOff && !isScreenSharing}
                    userVolume={userVolume}
                    onToggleMic={guardMicToggle}
                    onToggleVideo={guardVideoToggle}
                  />
                </div>
              </div>

              {/* System Design Whiteboard (Right) */}
              <div className="lg:col-span-8 h-full">
                <Whiteboard onSyncWhiteboardWithAi={handleSyncWhiteboardWithAi} />
              </div>
            </div>
          )}

          {/* Real-time Closed Captions Overlay */}
          <CaptionsOverlay
            isVisible={captionsEnabled}
            speaker={currentCaption.speaker}
            speakerName={currentCaption.speakerName}
            text={currentCaption.text}
            isLiveSpeaking={currentCaption.speaker === "ai" ? isAiSpeaking : !isMuted}
          />
        </div>

        {/* Right Side Drawer */}
        {activeSideTab && (
          <SidePanel
            activeTab={activeSideTab}
            interviewerProfile={config.interviewerProfile}
            candidateName={config.candidateName}
            chatMessages={chatMessages}
            rubricStages={rubricStages}
            analytics={analytics}
            isAiSpeaking={isAiSpeaking}
            userVolume={userVolume}
            proctorWarnings={proctorWarnings}
            scratchpadNotes={scratchpadNotes}
            liveAnalysis={liveAnalysis}
            isAnalyzingAnswer={isAnalyzingAnswer}
            orchestratorActions={orchestratorActions}
            onSendMessage={handleSendMessage}
            onClose={() => setActiveSideTab(null)}
          />
        )}
      </main>

      {/* Bottom Floating Control Bar */}
      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff && !isScreenSharing}
        isScreenSharing={isScreenSharing}
        captionsEnabled={captionsEnabled}
        activeLayout={activeLayout}
        activeSideTab={activeSideTab}
        isHandRaised={isHandRaised}
        warningCount={proctorWarnings.length}
        showProctorControls={proctoredAssessment}
        userVolume={userVolume}
        onToggleMic={guardMicToggle}
        onToggleVideo={guardVideoToggle}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleCaptions={() => {
          const enabled = !captionsEnabled;
          setCaptionsEnabled(enabled);
          emitUiEvent("captions_changed", enabled ? "captions on" : "captions off");
        }}
        onToggleHandRaise={() => {
          setIsHandRaised(!isHandRaised);
          if (!isHandRaised) {
            handleTriggerReaction("✋");
            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(
                JSON.stringify({
                  type: "text",
                  data: "Candidate raised their hand to ask a question or clarify something.",
                })
              );
            }

          }
        }}
        onSelectLayout={(layout) => {
          setActiveLayout(layout);
          if (layout === "code_split") emitUiEvent("opened_coding_playground");
          else if (layout === "whiteboard_split") emitUiEvent("opened_whiteboard");
          else emitUiEvent("meeting_layout_changed", layout);
        }}
        onToggleSideTab={(tab) => {
          const closing = activeSideTab === tab;
          setActiveSideTab(closing ? null : tab);
          if (!closing) emitUiEvent("side_panel_opened", tab);
        }}
        onTriggerReaction={handleTriggerReaction}
        onEndCall={handleEndCall}
      />

      {/* Malpractice Disqualification Modal */}
      {disqualificationReason && (
        <div className="fixed inset-0 z-[40] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1e1014] border-2 border-red-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center">
              <AlertTriangle className="w-9 h-9 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-red-400">Interview Disqualified</h2>
              <p className="text-xs text-red-300/80 font-mono mt-1 uppercase tracking-wider">Integrity Proctoring Termination</p>
            </div>
            <div className="bg-black/40 border border-red-500/30 rounded-xl p-3.5 text-left text-xs text-gray-300 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-red-400 font-semibold">
                <span>Violation Cause</span>
                <span className="font-mono">Integrity Violation</span>
              </div>
              <p className="leading-relaxed text-gray-200">{disqualificationReason}</p>
            </div>
            <button
              onClick={() => {
                setDisqualificationReason(null);
                onLeaveMeeting();
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-900/30 cursor-pointer"
            >
              Exit Meeting Room
            </button>
          </div>
        </div>
      )}

      {/* Post-Interview Evaluation Modal */}
      {showEvaluation && (
        <EvaluationModal
          report={evaluationReport}
          isLoading={isEvaluating}
          isCoachMode={config.interviewMode === "coach"}
          onRetake={() => {
            setShowEvaluation(false);
            onLeaveMeeting();
          }}
          onClose={() => {
            setShowEvaluation(false);
            onLeaveMeeting();
          }}
        />
      )}
    </div>
  );
};
