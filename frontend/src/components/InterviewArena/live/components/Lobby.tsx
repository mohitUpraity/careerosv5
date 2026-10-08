import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Upload,
  User,
  Zap,
  Briefcase,
  Layers,
  GraduationCap,
  FileText,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Maximize,
  X,
  RefreshCw,
  Sliders,
  Check,
  Building2,
  Target,
  ArrowRight,
} from "lucide-react";
import {
  InterviewConfig,
  InterviewerProfile,
  InterviewFormat,
  SeniorityLevel,
} from "../types";
import { INTERVIEWER_PROFILES } from "../data/interviewProfiles";
import { useAuth } from "../../../../context/AuthContext";
import { apiService } from "../../../../services/api";

interface LobbyProps {
  onJoinMeeting: (config: InterviewConfig) => void;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  userVolume: number;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  initialCompany?: string;
  initialRole?: string;
  initialJobDescription?: string;
  initialCandidateName?: string;
  initialResumeText?: string;
  onBack?: () => void;
}

const COMPANY_PRESETS = [
  {
    name: "Google",
    role: "Senior Distributed Systems Engineer (L5)",
    seniority: "Senior" as SeniorityLevel,
    jd: "Google Cloud Platform Core Infrastructure:\nDesigning high-throughput microservices, Paxos/Raft consensus pipelines, Spanner/Bigtable data modeling, and Kubernetes cluster orchestration. Candidates are evaluated on distributed systems trade-offs, concurrency bottlenecks, fault-tolerant replication, and end-to-end production ownership.",
    keySkills: ["Distributed Systems", "Go/C++/Java", "Kubernetes", "gRPC", "High Concurrency", "Consensus Algorithms"],
  },
  {
    name: "Meta",
    role: "Senior Full Stack Software Engineer (E5)",
    seniority: "Senior" as SeniorityLevel,
    jd: "Meta Core Products & Systems:\nBuilding ultra-responsive web interfaces using React/Next.js, high-concurrency GraphQL endpoints, distributed Redis caching, and real-time streaming architectures. Emphasizes problem decomposition, systematic edge case analysis, component telemetry, and high-velocity engineering execution.",
    keySkills: ["React", "TypeScript", "GraphQL", "Distributed Caching", "Node.js/Python", "System Architecture"],
  },
  {
    name: "Amazon",
    role: "Software Development Engineer II (SDE-2)",
    seniority: "Senior" as SeniorityLevel,
    jd: "Amazon Web Services (AWS):\nDesigning resilient, decoupled multi-tenant backend architectures with AWS DynamoDB, SQS, SNS, and ECS. Tested heavily on Amazon Leadership Principles (Customer Obsession, Ownership, Dive Deep, Bias for Action), operational metrics, and zero-downtime deployment pipelines.",
    keySkills: ["Java/Python", "AWS DynamoDB", "Event-Driven Architecture", "Microservices", "System Scalability"],
  },
  {
    name: "Stripe",
    role: "Senior Backend Payments Architect",
    seniority: "Senior" as SeniorityLevel,
    jd: "Stripe Payments Core Engine:\nHigh-integrity transactional infrastructure, idempotent payment processing APIs, ledger consistency, zero-downtime database migrations, and microsecond-latency API routing. High bar for code clarity, precision, and defensive error boundaries under high financial throughput.",
    keySkills: ["API Design", "Distributed Transactions", "PostgreSQL", "Idempotency", "Concurrency", "High Reliability"],
  },
  {
    name: "Apponward Technologies",
    role: "Senior Full Stack & AI Systems Lead",
    seniority: "Senior" as SeniorityLevel,
    jd: "Apponward Scalable Platform:\nFull stack engineering with Python FastAPI, React TypeScript, Neo4j knowledge graphs, distributed queue worker pools, and Gemini/Groq LLM streaming pipelines. Requires strong system architecture intuition, rapid prototyping, and clean API design.",
    keySkills: ["Python", "FastAPI", "React", "Neo4j", "Distributed Queues", "LLM Pipelines"],
  },
];

export const Lobby: React.FC<LobbyProps> = ({
  onJoinMeeting,
  stream,
  isMuted,
  isVideoOff,
  userVolume,
  onToggleMic,
  onToggleVideo,
  initialCompany,
  initialRole,
  initialJobDescription,
  initialCandidateName,
  initialResumeText,
  onBack,
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();

  // Basic Information
  const [candidateName, setCandidateName] = useState(
    initialCandidateName || activeProfile?.name || "Alex Turner"
  );
  const [company, setCompany] = useState(initialCompany || "Google");
  const [role, setRole] = useState(initialRole || "Senior Distributed Systems Engineer (L5)");
  const [seniority, setSeniority] = useState<SeniorityLevel>("Senior");
  const [format, setFormat] = useState<InterviewFormat>("Full Technical & Coding");
  const [selectedInterviewer, setSelectedInterviewer] = useState<InterviewerProfile>(
    INTERVIEWER_PROFILES[0]
  );

  // Resume State & Upload
  const [resumeText, setResumeText] = useState(initialResumeText || "");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [showResumeEditor, setShowResumeEditor] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Job Description
  const [jobDescription, setJobDescription] = useState(
    initialJobDescription || COMPANY_PRESETS[0].jd
  );
  const [showJdEditor, setShowJdEditor] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (initialCompany) setCompany(initialCompany); }, [initialCompany]);
  useEffect(() => { if (initialRole) setRole(initialRole); }, [initialRole]);
  useEffect(() => { if (initialJobDescription !== undefined) setJobDescription(initialJobDescription); }, [initialJobDescription]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isVideoOff]);

  // Handle Preset Selection
  const handleSelectPreset = (preset: typeof COMPANY_PRESETS[0]) => {
    setCompany(preset.name);
    setRole(preset.role);
    setSeniority(preset.seniority);
    setJobDescription(preset.jd);
  };

  // Pre-fill from active CareerOS profile
  const handlePreloadFromProfile = async () => {
    setIsUploadingResume(true);
    setUploadError(null);
    try {
      const { profile } = await apiService.getProfileDetails(getAuthHeaders());
      if (!profile) throw new Error("No profile information is available yet. Upload a resume to get started.");
      const parts = [
        "Candidate: " + profile.full_name,
        profile.headline || "",
        "Skills: " + (profile.skills || []).join(", "),
        ...(profile.experience || []).map(item => [item.role, item.company, item.description].filter(Boolean).join(" · ")),
        ...(profile.projects || []).map(item => [item.name, item.description].filter(Boolean).join(": "))
      ].filter(Boolean);
      setCandidateName(profile.full_name || candidateName);
      setResumeText(parts.join("\n"));
      setExtractedSkills(profile.skills || []);
      setUploadedFileName("Your CareerOS profile");
      setUploadedFileSize("Profile information");
    } catch (error: any) { setUploadError(error.message || "Could not load your profile. Please try again."); }
    finally { setIsUploadingResume(false); }
  };

  // Resume File Upload Handler (PDF, TXT, DOCX)
  const handleResumeFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadError("Choose a resume smaller than 10 MB."); input.value = ""; return; }
    setIsUploadingResume(true);
    setUploadError(null);
    try {
      let text = "";
      let skills: string[] = [];
      if (/\.txt$/i.test(file.name)) {
        text = await file.text();
        const commonSkills = ["React", "Python", "TypeScript", "Node.js", "Go", "Java", "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB", "Redis", "Kafka", "GraphQL", "FastAPI", "System Design"];
        skills = commonSkills.filter(skill => text.toLowerCase().includes(skill.toLowerCase()));
      } else {
        const result = await apiService.uploadResumePdf(file, getAuthHeaders());
        const bp = result.blueprint;
        if (!bp) throw new Error("Could not extract your resume. Try a text file or load your profile.");
        skills = (bp.skills || []).flatMap((group: any) => typeof group === "string" ? [group] : group.skills || (group.name ? [group.name] : []));
        text = [
          bp.contact?.full_name ? "Candidate: " + bp.contact.full_name : "",
          bp.summary || "",
          "Skills: " + skills.join(", "),
          ...(bp.experience || bp.work_experience || []).map((item: any) => [item.company, item.role, ...(item.bullets || [])].filter(Boolean).join(" · ")),
          ...(bp.projects || []).map((item: any) => [item.name, ...(item.bullets || [])].filter(Boolean).join(": "))
        ].filter(Boolean).join("\n");
        if (bp.contact?.full_name) setCandidateName(bp.contact.full_name);
      }
      if (!text.trim()) throw new Error("This file has no readable resume text. Please choose another file.");
      setResumeText(text);
      setExtractedSkills(skills);
      setUploadedFileName(file.name);
      setUploadedFileSize((file.size / 1024).toFixed(1) + " KB");
    } catch (error: any) { setUploadError(error.message || "Could not read this resume. Try a text file or load your profile."); }
    finally { setIsUploadingResume(false); input.value = ""; }
  };

  // Calculate dynamic JD-Resume match score
  const calculateMatchScore = () => {
    if (!jobDescription || !resumeText) return 0;
    const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const resumeWords = new Set(resumeText.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    let matchCount = 0;
    for (const w of jdWords) {
      if (resumeWords.has(w)) matchCount++;
    }
    const ratio = Math.round((matchCount / Math.max(1, jdWords.length)) * 100);
    return ratio;
  };

  const matchScore = calculateMatchScore();

  // Submit & Take Interview (with Fullscreen)
  const handleTakeInterview = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trigger true Fullscreen mode on user gesture
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    onJoinMeeting({
      candidateName: candidateName.trim() || "Candidate",
      company: company.trim() || "Target Company",
      role: role.trim() || "Senior Software Engineer",
      seniority,
      format,
      interviewerProfile: selectedInterviewer,
      resumeText: resumeText.trim(),
      jobDescription: jobDescription.trim(),
      customRequirements: `Target Company: ${company}\nTarget Role: ${seniority} ${role}\nCandidate Resume Context:\n${resumeText}\nJob Description:\n${jobDescription}`,
      durationMinutes: 45,
    });
  };

  const hasAudio = !!stream?.getAudioTracks().some(track => track.readyState === 'live' && track.enabled) && !isMuted;
  const hasVideo = !!stream?.getVideoTracks().some(track => track.readyState === 'live' && track.enabled) && !isVideoOff;

  return (
    <div className="ws-interview-lobby flex flex-col gap-6">
      {/* Top Google Meet style Header */}
      <header className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#3c4043]">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight flex flex-wrap items-center gap-2">
              Your interview room
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Audio & video practice
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Practice your next interview with audio, video, and personalised feedback.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/40">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{hasAudio ? "Microphone ready" : "Check your microphone"}</span>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#2d2f34] text-gray-300 hover:text-white hover:bg-[#3c4043] border border-[#3c4043] transition-all cursor-pointer"
            >
              Question practice
            </button>
          )}
        </div>
      </header>

      {/* Main Grid: Left Device Preview & Right Configuration */}
      <main className="ws-interview-setup-grid grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (5 Cols): Live Camera & Mic Preview */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="ws-device-preview relative w-full aspect-video bg-[#1e1e24] rounded-3xl overflow-hidden border border-[#3c4043] shadow-2xl flex items-center justify-center group">
            {hasVideo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-[#2d2f34] flex items-center justify-center text-white text-2xl font-semibold mb-3 border border-[#3c4043] shadow-inner">
                  {candidateName ? candidateName.slice(0, 2).toUpperCase() : <User className="w-8 h-8 text-gray-400" />}
                </div>
                <p className="text-sm font-semibold text-gray-200">Camera preview</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Enable your camera to preview your video feed before entering the arena.
                </p>
                <button
                  type="button"
                  onClick={onToggleVideo}
                  className="mt-3 mb-5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Turn On Camera</span>
                </button>
              </div>
            )}

            {/* Mic Visualizer Badge */}
            <div className="absolute bottom-4 left-4 bg-[#202124]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#3c4043] flex items-center space-x-2 text-xs text-white shadow-lg">
              {isMuted ? (
                <MicOff className="w-4 h-4 text-red-400" />
              ) : (
                <div className="flex items-center space-x-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <div className="w-16 h-2 bg-[#3c4043] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${Math.min(100, userVolume * 250)}%` }}
                    />
                  </div>
                </div>
              )}
              <span className="font-semibold text-gray-200">
                {hasAudio ? "Mic ready" : isMuted ? "Muted" : "Mic unavailable"}
              </span>
            </div>

            {/* Camera / Mic Quick Action Pills */}
            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
              <button
                type="button"
                onClick={onToggleMic}
                className={`p-2.5 rounded-full transition-all duration-200 shadow-xl cursor-pointer ${
                  isMuted
                    ? "bg-[#ea4335] text-white hover:bg-[#d93025]"
                    : "bg-[#3c4043] text-white hover:bg-[#4a4e52]"
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onToggleVideo}
                className={`p-2.5 rounded-full transition-all duration-200 shadow-xl cursor-pointer ${
                  isVideoOff
                    ? "bg-[#ea4335] text-white hover:bg-[#d93025]"
                    : "bg-[#3c4043] text-white hover:bg-[#4a4e52]"
                }`}
                title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Device Diagnostic Checklist */}
          <div className="bg-[#1e1e24] p-4 rounded-2xl border border-[#3c4043] space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hasAudio ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                Microphone Feed
              </span>
              <span className="text-gray-400 font-mono">{hasAudio ? "Ready" : isMuted ? "Muted" : "Not connected"}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hasVideo ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                Video Camera
              </span>
              <span className="text-gray-400 font-mono">{hasVideo ? "Ready" : "Off"}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Your interviewer
              </span>
              <span className="text-gray-400 font-mono">{selectedInterviewer.name} ({selectedInterviewer.voice})</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Proctoring Radar
              </span>
              <span className="text-gray-400 font-mono">Enabled during your interview</span>
            </div>
          </div>

          {/* Quick Match Preview */}
          <div className="bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-purple-950/30 p-4 rounded-2xl border border-blue-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                Resume keyword overlap
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {resumeText.trim() ? `${matchScore}% overlap` : 'Add a resume'}
              </span>
            </div>
            <div className="w-full bg-[#2d2f34] h-2 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${matchScore}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Interviewer will anchor technical questions directly on your uploaded resume projects and {company}'s requirements.
            </p>
          </div>
        </div>

        {/* Right Column (7 Cols): Comprehensive Resume & JD Setup */}
        <div className="ws-interview-setup lg:col-span-7 bg-[#1e1e24] p-6 sm:p-7 rounded-3xl border border-[#3c4043] shadow-2xl space-y-6">
          
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Set up your practice session
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Add your resume and the role details to make the questions relevant to your experience.
            </p>
          </div>

          {/* SECTION 1: UPLOAD RESUME */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Your resume</span>
              </label>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={isUploadingResume} onClick={handlePreloadFromProfile}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Load from CareerOS Profile
                </button>
              </div>
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleResumeFileSelect}
              accept=".pdf,.txt,.docx,.doc"
              className="hidden"
            />

            {/* Drag & Drop or Active Uploaded Card */}
            {!uploadedFileName ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a resume file"
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click(); } }}
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#3c4043] hover:border-blue-500/80 bg-[#2d2f34]/50 hover:bg-[#2d2f34] p-5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-white">
                  Choose a resume file
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  PDF, TXT, or DOCX up to 10MB • Automatically extracts skills, projects & experience
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#2d2f34] border border-emerald-500/40 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                        <span>{uploadedFileName}</span>
                        <span className="text-[10px] font-mono text-gray-400 font-normal">
                          ({uploadedFileSize || "Uploaded"})
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        Resume context ready for your practice session
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowResumeEditor(!showResumeEditor)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#3c4043] hover:bg-[#4a4e52] text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-blue-400" />
                      {showResumeEditor ? "Hide Text" : "Edit Text"}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#3c4043] hover:bg-[#4a4e52] text-gray-200 transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Extracted Skills Pills */}
                {extractedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {extractedSkills.slice(0, 10).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#1e1e24] text-blue-300 border border-blue-500/30"
                      >
                        {skill}
                      </span>
                    ))}
                    {extractedSkills.length > 10 && (
                      <span className="text-[10px] text-gray-400 self-center">
                        +{extractedSkills.length - 10} more
                      </span>
                    )}
                  </div>
                )}

                {/* Expandable Raw Resume Text Area */}
                {showResumeEditor && (
                  <div className="mt-2 pt-2 border-t border-[#3c4043]/60 space-y-1">
                    <label className="block text-[10px] font-semibold text-gray-300">
                      Extracted Resume Content (Sent to AI Interviewer):
                    </label>
                    <textarea aria-label="Extracted Resume Content (Sent to AI Interviewer):"
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      rows={4}
                      className="w-full bg-[#1e1e24] text-xs text-gray-200 p-2.5 rounded-xl border border-[#3c4043] focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-y"
                    />
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {uploadError}
              </p>
            )}
          </div>

          {/* SECTION 2: TARGET COMPANY & ROLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>The role you want</span>
              </label>
              <span className="text-[11px] text-gray-400">Quick Select:</span>
            </div>

            {/* Quick Company Preset Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    company.toLowerCase() === p.name.toLowerCase()
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-[#2d2f34] text-gray-300 hover:bg-[#383a40] border border-[#3c4043]"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Company, Role & Candidate Name Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Candidate Name
                </label>
                <input aria-label="Candidate Name"
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Alex Turner"
                  required
                  className="w-full bg-[#2d2f34] text-white text-xs rounded-xl px-3 py-2.5 border border-[#3c4043] focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Target Company
                </label>
                <input aria-label="Target Company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google, Meta"
                  required
                  className="w-full bg-[#2d2f34] text-white text-xs rounded-xl px-3 py-2.5 border border-[#3c4043] focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Target Role
                </label>
                <input aria-label="Target Role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  required
                  className="w-full bg-[#2d2f34] text-white text-xs rounded-xl px-3 py-2.5 border border-[#3c4043] focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Seniority & Format Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> Seniority Level
                </label>
                <select aria-label="Seniority Level"
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value as SeniorityLevel)}
                  className="w-full bg-[#2d2f34] text-white text-xs rounded-xl px-3 py-2.5 border border-[#3c4043] focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="Junior">Junior (L3 / Associate)</option>
                  <option value="Mid-Level">Mid-Level (L4 / SWE II)</option>
                  <option value="Senior">Senior (L5 / Senior SWE)</option>
                  <option value="Staff / Principal">Staff / Principal (L6/L7)</option>
                  <option value="Engineering Lead">Engineering Lead / Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" /> Interview Format
                </label>
                <select aria-label="Interview Format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as InterviewFormat)}
                  className="w-full bg-[#2d2f34] text-white text-xs rounded-xl px-3 py-2.5 border border-[#3c4043] focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="Full Technical & Coding">Full Technical & Live Coding (45m)</option>
                  <option value="System Design & Architecture">System Design & Distributed Scalability (45m)</option>
                  <option value="Behavioral & Leadership (STAR)">Behavioral & Leadership STAR Method (30m)</option>
                </select>
              </div>
            </div>

            {/* Target Job Description Card */}
            <div className="bg-[#2d2f34] p-3.5 rounded-2xl border border-[#3c4043] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                  Job description
                </span>
                <button
                  type="button"
                  onClick={() => setShowJdEditor(!showJdEditor)}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {showJdEditor ? "Collapse JD" : "Customize JD"}
                </button>
              </div>

              {showJdEditor ? (
                <textarea aria-label="Paste or customize job description requirements..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-[#1e1e24] text-xs text-gray-200 p-2.5 rounded-xl border border-[#3c4043] focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-y"
                  placeholder="Paste or customize job description requirements..."
                />
              ) : (
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                  {jobDescription}
                </p>
              )}
            </div>
          </div>

          {/* SECTION 3: AI INTERVIEWER PERSONA */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Select AI Interviewer Persona & Voice</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {INTERVIEWER_PROFILES.map((interviewer) => (
                <button
                  key={interviewer.name}
                  type="button"
                  onClick={() => setSelectedInterviewer(interviewer)}
                  className={`p-2.5 rounded-2xl border text-left flex flex-col items-center text-center transition-all cursor-pointer ${
                    selectedInterviewer.name === interviewer.name
                      ? "bg-blue-600/20 border-blue-500 text-white shadow-lg ring-1 ring-blue-500"
                      : "bg-[#2d2f34] border-[#3c4043] text-gray-300 hover:bg-[#383a40]"
                  }`}
                >
                  <img
                    src={interviewer.avatarUrl}
                    alt={interviewer.name}
                    className="w-12 h-12 rounded-full object-cover mb-2 border border-[#3c4043]"
                  />
                  <div className="text-xs font-bold truncate w-full">
                    {interviewer.name}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate w-full">
                    {interviewer.role}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-mono bg-[#1e1e24] text-blue-300 border border-blue-500/20">
                    Voice: {interviewer.voice}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 4: TAKE INTERVIEW BUTTON (FULLSCREEN LAUNCH) */}
          <form onSubmit={handleTakeInterview} className="pt-2">
            <button
              type="submit" disabled={isUploadingResume || !candidateName.trim() || !company.trim() || !role.trim()}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center space-x-2.5 transition-all duration-200 shadow-xl shadow-blue-600/25 cursor-pointer border border-blue-400/20"
            >
              <Maximize className="w-4 h-4 shrink-0" />
              <span>Start practice interview</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Automatically enters Fullscreen Mode just like a real interview call. You can toggle out at any time.
            </p>
          </form>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto pt-4 border-t border-[#3c4043] text-center text-xs text-gray-500">
        Your session uses the resume and role details you choose above.
      </footer>
    </div>
  );
};
