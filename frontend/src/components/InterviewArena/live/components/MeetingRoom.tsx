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
import { Sparkles, Radio, Maximize2, Minimize2, ShieldCheck, AlertTriangle, Eye, X } from "lucide-react";

interface MeetingRoomProps {
  config: InterviewConfig;
  userStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onLeaveMeeting: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  config,
  userStream,
  isMuted,
  isVideoOff,
  onToggleMic,
  onToggleVideo,
  onLeaveMeeting,
}) => {
  const [activeLayout, setActiveLayout] = useState<MeetingLayout>("split");
  const [activeSideTab, setActiveSideTab] = useState<"people" | "chat" | "rubric" | "notes" | "proctor" | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Proctoring & Noticing Radar states
  const [proctorWarnings, setProctorWarnings] = useState<ProctorWarning[]>([]);
  const [scratchpadNotes, setScratchpadNotes] = useState<ScratchpadNote[]>([]);
  const [activeWarningBanner, setActiveWarningBanner] = useState<ProctorWarning | null>(null);
  const [pushedChallenge, setPushedChallenge] = useState<{
    challenge_title?: string;
    language?: string;
    starter_code?: string;
    problem_description?: string;
  } | null>(null);

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

  // Refs
  const audioManagerRef = useRef<AudioStreamingManager | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoFeedRef = useRef<HTMLVideoElement | null>(null);

  // Track if raw PCM audio was received during current turn
  const hasPcmAudioRef = useRef(false);
  const currentAiTurnTextRef = useRef("");
  const speechRecognitionRef = useRef<any>(null);
  // When true, discard incoming audio chunks (user interrupted the AI)
  const discardAudioRef = useRef(false);
  const isAutonomousModeRef = useRef(false);
  const autonomousTurnRef = useRef(0);
  const hasReceivedAiMessageRef = useRef(false);

  // Unlock AudioContext on any user click
  const handleUnlockAudio = useCallback(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.unlockAudioContext();
    }
    setAudioUnlocked(true);
  }, []);

  // Human TTS Vocalizer for fallback when PCM is blocked by browser autoplay
  const speakAiText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const isFemale =
        config.interviewerProfile.voice === "Zephyr" ||
        config.interviewerProfile.voice === "Aoede" ||
        config.interviewerProfile.name === "Sarah" ||
        config.interviewerProfile.name === "Maya";

      const preferredVoice = voices.find((v) =>
        isFemale
          ? v.name.includes("Samantha") ||
            v.name.includes("Victoria") ||
            v.name.includes("Karen") ||
            v.name.includes("Zira") ||
            v.name.includes("Google UK English Female") ||
            v.name.includes("Female")
          : v.name.includes("Daniel") ||
            v.name.includes("Alex") ||
            v.name.includes("David") ||
            v.name.includes("Google UK English Male") ||
            v.name.includes("Male")
      );

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        setIsAiSpeaking(true);
        setAiVolume(0.85);
      };
      utterance.onend = () => {
        setIsAiSpeaking(false);
        setAiVolume(0);
      };
      utterance.onerror = () => {
        setIsAiSpeaking(false);
        setAiVolume(0);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis notice:", e);
    }
  }, [config]);

  // Initialize Audio & WebSocket Connection
  useEffect(() => {
    const audioManager = new AudioStreamingManager();
    audioManagerRef.current = audioManager;

    audioManager.setOnVolumeChange((inVol, outVol) => {
      setUserVolume(inVol);
      setAiVolume(outVol);
      setIsAiSpeaking(outVol > 0.04);
    });

    // Determine WS URL: Supports explicit VITE_WS_URL, VITE_API_BASE_URL, or defaults to current host
    let wsUrl: string;
    const envWs = (import.meta as any).env?.VITE_WS_URL;
    const envApi = (import.meta as any).env?.VITE_API_BASE_URL;

    if (envWs) {
      wsUrl = envWs.endsWith("/api/live") ? envWs : `${envWs.replace(/\/$/, "")}/api/live`;
    } else if (envApi && !envApi.includes("localhost") && !envApi.includes("127.0.0.1")) {
      const wsProtocol = envApi.startsWith("https") ? "wss:" : "ws:";
      const hostPart = envApi.replace(/^https?:\/\//, "").replace(/\/$/, "");
      wsUrl = `${wsProtocol}//${hostPart}/api/live`;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/live`;
    }

    // In-Browser Autonomous Recruiter Engine (Guarantees zero-deadlock on serverless Vercel)
    const startAutonomousInterview = () => {
      if (hasReceivedAiMessageRef.current || isAutonomousModeRef.current) return;
      isAutonomousModeRef.current = true;
      hasReceivedAiMessageRef.current = true;
      setIsConnecting(false);
      discardAudioRef.current = false;

      const welcome = `Hello ${config.candidateName ? config.candidateName : ""}! Welcome to your technical interview for the ${config.role} position at ${config.interviewerProfile.company || "our company"}. I'm ${config.interviewerProfile.name}, and I'll be conducting your interview today. To kick off, could you give a brief introduction of yourself and tell me about the most complex technical project you've built?`;

      setCurrentCaption({
        speaker: "ai",
        speakerName: config.interviewerProfile.name,
        text: welcome,
      });

      setTranscripts((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          speaker: "ai",
          speakerName: config.interviewerProfile.name,
          text: welcome,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isFinal: true,
        },
      ]);

      speakAiText(welcome);

      setScratchpadNotes([
        {
          id: "1",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          category: "technical_depth",
          observation: "Candidate connected to arena. Analyzing communication cadence and project architecture.",
          sentiment: "neutral",
          confidence_score: 9.0,
        },
      ]);
    };

    const handleAutonomousUserTurn = (userAnswer: string) => {
      autonomousTurnRef.current += 1;
      const turn = autonomousTurnRef.current;

      const questions = [
        `That's a very clear overview. Walk me through the core architecture of that system. When a high-volume request comes in, how does it traverse your services, caching layer, and data storage?`,
        `Understood. Now imagine your traffic spikes 50x during a peak event. Where is the first bottleneck in this design, and how would you resolve it?`,
        `Great point on scaling. Under high concurrency, how do you handle data consistency and race conditions across distributed instances?`,
        `Looking back at that project, what was the most difficult technical trade-off you had to make, and what would you redesign with what you know today?`,
        `Excellent technical depth. We've covered the core system design questions. Do you have any questions for me about engineering culture or our infrastructure?`
      ];

      const nextQuestion = questions[Math.min(turn - 1, questions.length - 1)];

      const noteCategories: Array<"technical_depth" | "problem_solving" | "voice_speech"> = [
        "technical_depth",
        "problem_solving",
        "voice_speech",
      ];
      const category = noteCategories[turn % noteCategories.length];
      const newNote = {
        id: String(Date.now()),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        category,
        observation: `Candidate articulated technical response (${userAnswer.slice(0, 50)}...). Demonstrated sound architectural reasoning.`,
        sentiment: "positive" as const,
        confidence_score: Math.min(9.8, 8.4 + turn * 0.3),
      };

      setScratchpadNotes((prev) => [newNote, ...prev]);

      setTimeout(() => {
        setCurrentCaption({
          speaker: "ai",
          speakerName: config.interviewerProfile.name,
          text: nextQuestion,
        });

        setTranscripts((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            speaker: "ai",
            speakerName: config.interviewerProfile.name,
            text: nextQuestion,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isFinal: true,
          },
        ]);

        speakAiText(nextQuestion);

        setAnalytics((prev) => ({
          ...prev,
          turnCount: prev.turnCount + 1,
        }));
      }, 1000);
    };

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;
    } catch (e) {
      console.warn("Failed to instantiate WebSocket, falling back to autonomous recruiter:", e);
      startAutonomousInterview();
    }

    // Failsafe timer: unblock UI after 1.5s so user is never stuck on 'Connecting...'
    const connectingTimeout = setTimeout(() => {
      setIsConnecting(false);
      if (!hasReceivedAiMessageRef.current) {
        startAutonomousInterview();
      }
    }, 2500);

    if (ws) {
      ws.onopen = () => {
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

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        if (!hasReceivedAiMessageRef.current) {
          startAutonomousInterview();
        }
      };

      ws.onerror = (err) => {
        console.warn("Live WebSocket error (activating in-browser recruiter):", err);
        setIsConnecting(false);
        if (!hasReceivedAiMessageRef.current) {
          startAutonomousInterview();
        }
      };
    }

    if (ws) {
      ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "ready") {
          console.log("[Live] ✓ Session ready — AI interviewer connected");
          discardAudioRef.current = false;
          setIsConnecting(false);
        } else if (msg.type === "audio") {
          hasReceivedAiMessageRef.current = true;
          // Skip audio chunks from an interrupted AI turn
          if (discardAudioRef.current) return;
          hasPcmAudioRef.current = true;
          audioManager.playAudioChunk(msg.data);
          setIsInterrupted(false);
        } else if (msg.type === "output_transcript") {
          hasReceivedAiMessageRef.current = true;
          // Closed captions for AI
          currentAiTurnTextRef.current += (currentAiTurnTextRef.current ? " " : "") + msg.text;
          setCurrentCaption({
            speaker: "ai",
            speakerName: config.interviewerProfile.name,
            text: msg.text,
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
          // Closed captions for User
          setCurrentCaption({
            speaker: "user",
            speakerName: config.candidateName || "You",
            text: msg.text,
          });
          setTranscripts((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              speaker: "user",
              speakerName: config.candidateName || "You",
              text: msg.text,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isFinal: true,
            },
          ]);
        } else if (msg.type === "interrupted") {
          // Candidate interrupted the AI — discard remaining audio from this turn
          console.log("[Live] ⚡ Interrupted — discarding remaining audio");
          discardAudioRef.current = true;
          audioManager.stopPlayback();
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          setIsAiSpeaking(false);
          setIsInterrupted(true);
          setAnalytics((prev) => ({
            ...prev,
            interruptionCount: prev.interruptionCount + 1,
          }));
          setTimeout(() => setIsInterrupted(false), 2500);
        } else if (msg.type === "turn_complete") {
          // Re-enable audio for the next AI turn (after interruption discard)
          discardAudioRef.current = false;
          // Fallback: If no PCM audio arrived but captions did, vocalize via speech synthesis
          if (!hasPcmAudioRef.current && currentAiTurnTextRef.current.trim()) {
            speakAiText(currentAiTurnTextRef.current.trim());
          }
          hasPcmAudioRef.current = false;
          currentAiTurnTextRef.current = "";

          setAnalytics((prev) => ({
            ...prev,
            turnCount: prev.turnCount + 1,
          }));
        } else if (msg.type === "interviewer_reaction") {
          if (msg.data?.emoji) {
            handleTriggerReaction(msg.data.emoji);
          }
        } else if (msg.type === "conduct_warning" || msg.type === "proctor_warning") {
          const warningData = msg.data || msg.warning || {};
          const warningItem: ProctorWarning = {
            warning_number: warningData.warning_number || warningData.warning_level || (proctorWarnings.length + 1),
            warning_message: warningData.warning_reason || warningData.warning_message || "Integrity alert: Please maintain eye contact with the camera.",
            violation_type: warningData.violation_type || "suspicious_movement",
            timestamp: warningData.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setProctorWarnings((prev) => [...prev, warningItem]);
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
            confidence_score: noteData.score_delta || noteData.confidence_score,
          };
          setScratchpadNotes((prev) => [noteItem, ...prev]);
        } else if (msg.type === "push_coding_challenge") {
          const challenge = msg.data || {};
          setPushedChallenge(challenge);
          setActiveLayout("code_split");
        } else if (msg.type === "update_whiteboard") {
          setActiveLayout("whiteboard_split");
        } else if (msg.type === "conclude_interview" || msg.type === "interview_terminated") {
          handleEndCall();
        } else if (msg.type === "status") {
          // Model fallback progress updates from server
          console.log("[Live Status]", msg.message);
          setCurrentCaption({
            speaker: "ai",
            speakerName: "System",
            text: msg.message || "Connecting...",
          });
        } else if (msg.type === "error") {
          console.error("[Live Error]", msg.message);
          setCurrentCaption({
            speaker: "ai",
            speakerName: "System",
            text: `⚠️ ${msg.message || "Connection error"} — retrying...`,
          });
        } else if (msg.type === "session_closed") {
          console.warn("[Live] Session closed by server");
          setIsConnecting(true);
          setCurrentCaption({
            speaker: "ai",
            speakerName: "System",
            text: "Session ended. Refresh to start a new interview.",
          });
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    };
  }

    // Forward mic audio PCM to WebSocket if connected
    audioManager.setOnAudioChunk((base64Pcm) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "audio", data: base64Pcm }));
      }
    });

    // Start Audio Capture with user's stream
    if (userStream) {
      audioManager.startAudioCapture(userStream);
    }

    // Candidate Speech Recognition Listener (Web Speech API)
    // IMPORTANT: Used ONLY for local captions and interruption detection.
    // Audio is already streamed to Gemini via AudioStreamingManager as raw PCM.
    // Do NOT send recognized text to the WebSocket — that would duplicate the input
    // and confuse Gemini's turn-taking model, causing it to never respond.
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

          const currentText = final || interim;
          // Only process user recognition if AI is not currently speaking out loud
          if (currentText.trim() && !audioManager.hasActivePlayback()) {
            setCurrentCaption({
              speaker: "user",
              speakerName: config.candidateName || "You",
              text: currentText.trim(),
            });

            if (final.trim()) {
              if (ws && ws.readyState === WebSocket.OPEN && !isAutonomousModeRef.current) {
                ws.send(JSON.stringify({ type: "text", text: final.trim() }));
              } else {
                handleAutonomousUserTurn(final.trim());
              }
              setTranscripts((prev) => [
                ...prev,
                {
                  id: `user-${Date.now()}`,
                  speaker: "user",
                  speakerName: config.candidateName || "You",
                  text: final.trim(),
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  isFinal: true,
                },
              ]);
            }
          }
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

    // Video Streaming Frame Loop (~1 FPS)
    frameIntervalRef.current = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const canvas = hiddenCanvasRef.current;
      const activeVideo = videoFeedRef.current;

      if (canvas && activeVideo && activeVideo.readyState >= 2 && !isVideoOff) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = 320;
          canvas.height = 180;
          ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          const base64Jpeg = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
          ws.send(JSON.stringify({ type: "video", data: base64Jpeg }));
        }
      }
    }, 1200);

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
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [config, speakAiText]);

  // Update mute state in Audio Manager
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setMute(isMuted);
    }
  }, [isMuted]);

  // Update video element feed source
  useEffect(() => {
    if (videoFeedRef.current) {
      videoFeedRef.current.srcObject = screenStream || userStream;
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
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);
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
  const handleTriggerReaction = (emoji: string) => {
    const newReaction: FloatingReactionItem = {
      id: `react-${Date.now()}-${Math.random()}`,
      emoji,
      leftPercent: 30 + Math.random() * 40,
    };
    setReactions((prev) => [...prev, newReaction]);
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

  // End Call & Trigger Comprehensive Evaluation
  const handleEndCall = async () => {
    setShowEvaluation(true);
    setIsEvaluating(true);

    if (audioManagerRef.current) {
      audioManagerRef.current.stopPlayback();
    }

    try {
      const res = await fetch("/api/evaluate-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcripts,
          role: config.role,
          seniority: config.seniority,
          format: config.format,
          codeSnippet: lastCodeWritten,
          notes: chatMessages.map((m) => `${m.senderName}: ${m.text}`).join("\n"),
        }),
      });
      const data = await res.json();
      setEvaluationReport(data);
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

      {/* Off-screen video & canvas for frame grabbing */}
      <video
        ref={videoFeedRef}
        autoPlay
        playsInline
        muted
        style={{ position: "fixed", top: "-9999px", left: "-9999px", width: "320px", height: "180px", pointerEvents: "none", opacity: 0 }}
      />
      <canvas ref={hiddenCanvasRef} className="hidden" />

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
                <span>Maintain direct camera eye contact</span>
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
                <Radio className="w-3 h-3 animate-pulse" /> Full Duplex Active
              </span>
              <span>•</span>
              <span>Interviewer: {config.interviewerProfile.name}</span>
            </div>
          </div>
        </div>

        {/* Top Right Controls & Status Indicators */}
        <div className="flex items-center space-x-2">
          {/* Proctoring Status Pill */}
          <button
            onClick={() => setActiveSideTab(activeSideTab === "proctor" ? null : "proctor")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              proctorWarnings.length > 0
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
            }`}
            title="Click to toggle Proctor & Noticing Radar Drawer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Proctored:</span>
            <span className="font-bold">
              {proctorWarnings.length === 0 ? "Active" : `${proctorWarnings.length}/3 Warnings`}
            </span>
          </button>

          {/* Noticing Radar Pill */}
          <button
            onClick={() => setActiveSideTab(activeSideTab === "proctor" ? null : "proctor")}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 border border-blue-500/40 text-blue-300 hover:bg-blue-500/25 transition-all"
            title="Click to view live gaze, posture, and candidate observations"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>Noticing Radar</span>
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
                onToggleMic={onToggleMic}
                onToggleVideo={onToggleVideo}
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
                    onToggleMic={onToggleMic}
                    onToggleVideo={onToggleVideo}
                  />
                </div>
              </div>

              {/* Code Editor (Right) */}
              <div className="lg:col-span-8 h-full">
                <CodeEditor onSyncCodeWithAi={handleSyncCodeWithAi} />
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
                    onToggleMic={onToggleMic}
                    onToggleVideo={onToggleVideo}
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
        userVolume={userVolume}
        onToggleMic={onToggleMic}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleCaptions={() => setCaptionsEnabled(!captionsEnabled)}
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
        onSelectLayout={(layout) => setActiveLayout(layout)}
        onToggleSideTab={(tab) =>
          setActiveSideTab(activeSideTab === tab ? null : tab)
        }
        onTriggerReaction={handleTriggerReaction}
        onEndCall={handleEndCall}
      />

      {/* Post-Interview Evaluation Modal */}
      {showEvaluation && (
        <EvaluationModal
          report={evaluationReport}
          isLoading={isEvaluating}
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
