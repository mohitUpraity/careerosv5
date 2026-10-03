import React, { useState, useEffect, useRef } from 'react';
import { 
  Swords, 
  Sparkles, 
  Building2, 
  FileText, 
  Mic, 
  MicOff, 
  Send, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  Compass, 
  Target, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  Briefcase, 
  Layers, 
  Zap, 
  ChevronRight, 
  Check, 
  Copy, 
  Play, 
  Volume2, 
  VolumeX, 
  Brain, 
  Code
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { LiveMultimodalArena } from './LiveMultimodalArena';
import { 
  JobIntelligence, 
  InterviewSessionState, 
  InterviewEvaluationResponse, 
  InterviewScorecard, 
  InterviewHistoryItem 
} from '../../types';

interface InterviewArenaProps {
  initialJob?: { company: string; role: string; jd: string };
  onTailorResume?: (role: string, company: string, jd: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onErrorToast?: (msg: string) => void;
  onSuccessToast?: (msg: string) => void;
}

type ArenaTab = 'live' | 'arena' | 'intelligence';

export const InterviewArena: React.FC<InterviewArenaProps> = ({
  initialJob,
  onTailorResume,
  onNavigateToTab,
  onErrorToast,
  onSuccessToast,
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  
  const [currentTab, setCurrentTab] = useState<ArenaTab>('live');
  const [targetCompany, setTargetCompany] = useState<string>(initialJob?.company || 'Apponward Technologies');
  const [targetRole, setTargetRole] = useState<string>(initialJob?.role || 'Senior Backend Engineer');
  const [targetJd, setTargetJd] = useState<string>(initialJob?.jd || '');
  
  // Job Intelligence State
  const [jobIntel, setJobIntel] = useState<JobIntelligence | null>(null);
  const [loadingIntel, setLoadingIntel] = useState<boolean>(false);

  // Interview Arena State
  const [roundType, setRoundType] = useState<string>('mixed'); // 'tech' | 'project_defense' | 'behavioral' | 'mixed'
  const [difficulty, setDifficulty] = useState<string>('medium'); // 'easy' | 'medium' | 'hard'
  const [session, setSession] = useState<InterviewSessionState | null>(null);
  const [startingSession, setStartingSession] = useState<boolean>(false);
  const [candidateAnswer, setCandidateAnswer] = useState<string>('');
  const [evaluatingAnswer, setEvaluatingAnswer] = useState<boolean>(false);
  const [lastEvaluation, setLastEvaluation] = useState<InterviewEvaluationResponse | null>(null);
  const [scorecard, setScorecard] = useState<InterviewScorecard | null>(null);
  const [finishingSession, setFinishingSession] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Speech Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Sync when initialJob props change
  useEffect(() => {
    if (initialJob?.company) {
      setTargetCompany(initialJob.company);
      setTargetRole(initialJob.role);
      setTargetJd(initialJob.jd || '');
    }
  }, [initialJob]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCandidateAnswer((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${transcript}` : transcript;
        });
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // 1. Fetch Job Intelligence
  const handleFetchJobIntel = async () => {
    if (!targetCompany.trim()) {
      onErrorToast?.('Please enter a target company name.');
      return;
    }

    setLoadingIntel(true);
    try {
      const headers = getAuthHeaders();
      const res = await apiService.getJobIntelligence(
        { company: targetCompany, role: targetRole, job_description: targetJd },
        headers
      );
      setJobIntel(res.intelligence);
      onSuccessToast?.(`Generated 360° Intelligence for ${targetCompany}`);
    } catch (err: any) {
      onErrorToast?.(err.message || 'Failed to generate job intelligence.');
    } finally {
      setLoadingIntel(false);
    }
  };

  // 3. Start Mock Interview Session
  const handleStartSession = async () => {
    if (!targetCompany.trim()) {
      onErrorToast?.('Please enter a target company name.');
      return;
    }

    setStartingSession(true);
    setScorecard(null);
    setLastEvaluation(null);
    setCandidateAnswer('');
    setShowHint(false);

    try {
      const headers = getAuthHeaders();
      const res = await apiService.startInterviewSession(
        {
          company: targetCompany,
          role: targetRole,
          job_description: targetJd,
          round_type: roundType,
          difficulty: difficulty,
        },
        headers
      );
      setSession(res);
      onSuccessToast?.(`Mock Interview started with Lead Interviewer at ${targetCompany}!`);
    } catch (err: any) {
      onErrorToast?.(err.message || 'Failed to start interview session.');
    } finally {
      setStartingSession(false);
    }
  };

  // 4. Submit Answer for Evaluation
  const handleSubmitAnswer = async () => {
    if (!session) return;
    if (!candidateAnswer.trim()) {
      onErrorToast?.('Please speak or type your response before submitting.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setEvaluatingAnswer(true);
    setShowHint(false);

    try {
      const headers = getAuthHeaders();
      const res = await apiService.respondInterviewSession(
        {
          company: session.company,
          role: session.role,
          round_type: session.round_type,
          current_question: session.current_question,
          candidate_answer: candidateAnswer,
          step: session.current_step,
          total_steps: session.total_steps,
          history: session.history,
        },
        headers
      );

      setLastEvaluation(res.evaluation);

      // Update history
      const updatedHistory: InterviewHistoryItem[] = [
        ...session.history.map((h, i) => {
          if (i === session.current_step - 1) {
            return {
              ...h,
              answer: candidateAnswer,
              score: res.evaluation.score,
              strengths: res.evaluation.strengths,
              gaps: res.evaluation.gaps,
              model_answer: res.evaluation.model_answer,
              interviewer_reaction: res.evaluation.interviewer_reaction,
            };
          }
          return h;
        }),
      ];

      if (res.evaluation.is_completed) {
        // Automatically finish session
        handleFinishSession(updatedHistory);
      } else if (res.evaluation.next_question) {
        // Advance session
        setSession({
          ...session,
          current_step: session.current_step + 1,
          current_question: res.evaluation.next_question,
          question_category: res.evaluation.next_category || 'Core Technical',
          context_hints: res.evaluation.next_hint || 'Focus on trade-offs and structure.',
          history: [
            ...updatedHistory,
            {
              step: session.current_step + 1,
              question: res.evaluation.next_question,
              category: res.evaluation.next_category || 'Core Technical',
              hint: res.evaluation.next_hint || '',
            },
          ],
        });
        setCandidateAnswer('');
      }
    } catch (err: any) {
      onErrorToast?.(err.message || 'Failed to submit answer.');
    } finally {
      setEvaluatingAnswer(false);
    }
  };

  // 5. Finish Interview Session and Generate Scorecard
  const handleFinishSession = async (historyOverride?: InterviewHistoryItem[]) => {
    if (!session) return;
    setFinishingSession(true);

    try {
      const headers = getAuthHeaders();
      const currentHist = historyOverride || session.history;
      const res = await apiService.finishInterviewSession(
        {
          company: session.company,
          role: session.role,
          round_type: session.round_type,
          history: currentHist,
        },
        headers
      );
      setScorecard(res.scorecard);
      onSuccessToast?.('Interview complete! Scorecard generated.');
    } catch (err: any) {
      onErrorToast?.(err.message || 'Failed to finish interview.');
    } finally {
      setFinishingSession(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div 
        className="p-6 rounded-2xl relative overflow-hidden shadow-sm"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Swords className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Interview Prep & AI Simulation Arena
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-wide">
                Live Simulation
              </span>
            </div>
            <p className="text-xs max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              Master your target company rounds with realistic AI interview simulations anchored on your actual projects, 360° company intelligence, and automated college WhatsApp placement notice extraction.
            </p>
          </div>

          {/* Target Company & Role Pill */}
          <div 
            className="flex items-center gap-3 p-3 rounded-xl shrink-0"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="text-xs">
              <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>{targetCompany}</span>
              <span className="block text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{targetRole}</span>
            </div>
            <button
              onClick={() => {
                const comp = prompt('Enter Company Name:', targetCompany);
                if (comp) setTargetCompany(comp);
                const r = prompt('Enter Target Role:', targetRole);
                if (r) setTargetRole(r);
              }}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              Change
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t flex-wrap" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={() => setCurrentTab('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'live'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>🎙️ Gemini 3 Live (Audio + Vision + Proctor)</span>
          </button>

          <button
            onClick={() => setCurrentTab('arena')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'arena'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Step-by-Step QA Arena
          </button>

          <button
            onClick={() => {
              setCurrentTab('intelligence');
              if (!jobIntel) handleFetchJobIntel();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'intelligence'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            360° Job & Company Intel
          </button>

        </div>
      </div>

      {/* VIEW 0: GEMINI 3 FLASH LIVE MULTIMODAL ARENA */}
      {currentTab === 'live' && (
        <LiveMultimodalArena
          company={targetCompany}
          role={targetRole}
          jobDescription={targetJd}
          onBack={() => setCurrentTab('arena')}
          onTailorResume={onTailorResume}
        />
      )}

      {/* VIEW 1: AI MOCK INTERVIEW ARENA (STEP-BY-STEP) */}
      {currentTab === 'arena' && (
        <div className="space-y-6">
          {/* Pre-flight Configuration (if session not active) */}
          {!session && (
            <div 
              className="p-6 rounded-2xl space-y-6"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Configure Your Mock Interview Simulation
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    The AI Interviewer will grill you on your actual projects, system design, and coding concepts for {targetCompany}.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Anchored on {activeProfile.name}'s Resume
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Round Type Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Target Interview Round
                  </label>
                  <select
                    value={roundType}
                    onChange={(e) => setRoundType(e.target.value)}
                    className="w-full p-2.5 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="mixed">⚡ 360° Comprehensive Round (Mixed)</option>
                    <option value="project_defense">🏗️ System Architecture & Project Defense</option>
                    <option value="tech">💻 Core Technical, DB & Language Internals</option>
                    <option value="behavioral">🤝 Behavioral & Leadership Fit (STAR)</option>
                  </select>
                </div>

                {/* Difficulty Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Simulation Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-2.5 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="medium">Standard Tech Bar (Medium)</option>
                    <option value="hard">Bar Raiser / Tier-1 Tech (Hard)</option>
                    <option value="easy">Foundational Warmup (Easy)</option>
                  </select>
                </div>

                {/* Custom JD summary */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Target Role Details
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g., SDE-2 Backend Engineer"
                    className="w-full p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Start Session Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <Mic className="w-4 h-4 text-blue-500" />
                  <span>Supports Voice / Microphone speech-to-text or typed answers</span>
                </div>

                <button
                  onClick={handleStartSession}
                  disabled={startingSession}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {startingSession ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Summoning AI Interviewer...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Enter Interview Arena
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Active Interview Arena Simulation */}
          {session && !scorecard && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Interview Flow (8 Cols) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Simulation Header / Progress */}
                <div 
                  className="p-4 rounded-2xl flex items-center justify-between gap-4"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                      {session.current_step}/{session.total_steps}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          Question {session.current_step} of {session.total_steps}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {session.question_category}
                        </span>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        Round: {session.round_type.toUpperCase()} • {session.company}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm('End this interview session and generate your scorecard?')) {
                        handleFinishSession();
                      }
                    }}
                    disabled={finishingSession}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium text-red-500 border-red-500/20 hover:bg-red-500/10 transition-all"
                  >
                    Finish Early
                  </button>
                </div>

                {/* Interviewer Question Box */}
                <div 
                  className="p-6 rounded-2xl space-y-4 shadow-sm"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--brand-600)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        AI
                      </div>
                      <span className="text-xs font-bold text-blue-600">
                        Lead Interviewer • {session.company}
                      </span>
                    </div>

                    <button
                      onClick={() => setShowHint(!showHint)}
                      className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600 font-medium transition-all"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showHint ? 'Hide Hint' : '💡 Need a Hint?'}
                    </button>
                  </div>

                  <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    "{session.current_question}"
                  </p>

                  {/* Collapsible Smart Hint */}
                  {showHint && session.context_hints && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <span className="font-bold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Interviewer Hint:
                      </span>
                      <p>{session.context_hints}</p>
                    </div>
                  )}
                </div>

                {/* Candidate Response Area */}
                <div 
                  className="p-4 rounded-2xl space-y-3"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Your Spoken / Typed Response:
                    </span>

                    <div className="flex items-center gap-2">
                      {speechSupported && (
                        <button
                          onClick={toggleListening}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            isListening
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20'
                          }`}
                        >
                          {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          {isListening ? 'Listening (Click to Stop)...' : 'Voice Input (Mic)'}
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    placeholder="Articulate your architectural decision, data flow, algorithm, or STAR scenario clearly..."
                    className="w-full p-3 rounded-xl text-xs font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none leading-relaxed"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      {candidateAnswer.split(/\s+/).filter(Boolean).length} words • Press Submit for live grading
                    </span>

                    <button
                      onClick={handleSubmitAnswer}
                      disabled={evaluatingAnswer || !candidateAnswer.trim()}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                    >
                      {evaluatingAnswer ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Evaluating Answer...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Submit & Next Question
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Grading & Interviewer Reactions (4 Cols) */}
              <div className="lg:col-span-4 space-y-4">
                {/* Last Answer Evaluation Card */}
                {lastEvaluation ? (
                  <div 
                    className="p-4 rounded-2xl space-y-4 shadow-sm"
                    style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                  >
                    <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-primary)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        Question {lastEvaluation.step} Grading
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        lastEvaluation.score >= 8 
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : lastEvaluation.score >= 6
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : 'bg-red-500/10 text-red-600 border border-red-500/20'
                      }`}>
                        Score: {lastEvaluation.score} / 10
                      </span>
                    </div>

                    {/* Interviewer Spoken Reaction */}
                    {lastEvaluation.interviewer_reaction && (
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                        "{lastEvaluation.interviewer_reaction}"
                      </div>
                    )}

                    {/* Strengths */}
                    {lastEvaluation.strengths && lastEvaluation.strengths.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          What Went Well:
                        </span>
                        <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {lastEvaluation.strengths.map((s, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gaps */}
                    {lastEvaluation.gaps && lastEvaluation.gaps.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Missing Key Points:
                        </span>
                        <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {lastEvaluation.gaps.map((g, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-amber-500 mt-0.5">•</span>
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Ideal Model Answer */}
                    {lastEvaluation.model_answer && (
                      <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-primary)' }}>
                        <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Ideal Model Articulation:
                        </span>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {lastEvaluation.model_answer}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="p-6 rounded-2xl text-center space-y-3"
                    style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                      <Target className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      Real-time AI Grading
                    </h4>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Submit your first answer to receive live /10 scoring, highlighted strengths, and missing architectural edge cases.
                    </p>
                  </div>
                )}

                {/* Live Transcript Drawer */}
                <div 
                  className="p-4 rounded-2xl space-y-2"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    Session Transcript ({session.history.length} Questions)
                  </span>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {session.history.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-2.5 rounded-xl text-xs space-y-1"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                      >
                        <div className="flex items-center justify-between text-[10px] font-semibold text-blue-500">
                          <span>Q{item.step}: {item.category}</span>
                          {item.score !== undefined && (
                            <span className="text-emerald-500">{item.score}/10</span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                          {item.question}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINAL HIREABILITY SCORECARD (After completion) */}
          {scorecard && (
            <div className="space-y-6">
              <div 
                className="p-8 rounded-3xl space-y-6 text-center shadow-lg relative overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '2px solid var(--brand-600)',
                }}
              >
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    <Award className="w-4 h-4" />
                    Interview Performance Verdict
                  </div>
                  <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Hiring Committee Final Scorecard
                  </h2>
                  <p className="text-xs max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                    {scorecard.verdict_summary}
                  </p>
                </div>

                {/* Score & Verdict Pill */}
                <div className="flex flex-wrap items-center justify-center gap-6 py-4">
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center min-w-[140px]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overall Score</span>
                    <div className="text-3xl font-black text-blue-600 mt-1">
                      {scorecard.overall_score}<span className="text-sm font-normal text-slate-400">/100</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center min-w-[140px]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Verdict</span>
                    <div className={`text-xl font-black mt-1 ${
                      scorecard.verdict.toLowerCase().includes('strong') || scorecard.verdict.toLowerCase().includes('hire')
                        ? 'text-emerald-500'
                        : 'text-amber-500'
                    }`}>
                      {scorecard.verdict}
                    </div>
                  </div>
                </div>

                {/* Competency Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-4xl mx-auto pt-4">
                  {Object.entries(scorecard.competency_breakdown).map(([key, val]) => (
                    <div 
                      key={key}
                      className="p-3.5 rounded-xl space-y-1.5"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                    >
                      <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
                        {key.replace('_', ' ')}
                      </span>
                      <div className="flex items-center justify-between">
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mr-2">
                          <div 
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${val}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{val}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Superpowers & Improvements Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto pt-4">
                  {/* Superpowers */}
                  <div 
                    className="p-5 rounded-2xl space-y-3"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                  >
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Demonstrated Superpowers
                    </span>
                    <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {scorecard.top_superpowers.map((sp, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                          <span>{sp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas for Improvement */}
                  <div 
                    className="p-5 rounded-2xl space-y-3"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                  >
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Priority Areas to Polish
                    </span>
                    <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {scorecard.areas_for_improvement.map((area, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold mt-0.5">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Fast Track Study Plan */}
                {scorecard.fast_track_study_plan && scorecard.fast_track_study_plan.length > 0 && (
                  <div 
                    className="p-5 rounded-2xl text-left max-w-4xl mx-auto space-y-3"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                  >
                    <span className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      3-Step Action Blueprint Before Real Interview
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {scorecard.fast_track_study_plan.map((step, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="font-bold text-blue-500 block mb-1">Step {idx + 1}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => {
                      setSession(null);
                      setScorecard(null);
                      setLastEvaluation(null);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Start Another Mock Round
                  </button>

                  {onTailorResume && (
                    <button
                      onClick={() => onTailorResume(targetRole, targetCompany, targetJd)}
                      className="px-6 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      Tailor Resume For This Job
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: 360° JOB & COMPANY INTELLIGENCE */}
      {currentTab === 'intelligence' && (
        <div className="space-y-6">
          <div 
            className="p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Deep Intelligence Dossier for {targetCompany}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Comprehensive breakdown of {targetCompany}'s engineering stack, candidate fit pitch, interview rounds, and top questions with hints.
              </p>
            </div>

            <button
              onClick={handleFetchJobIntel}
              disabled={loadingIntel}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition-all shrink-0"
            >
              {loadingIntel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Intelligence
            </button>
          </div>

          {loadingIntel && (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-400">Synthesizing 360° Job Intelligence for {targetCompany}...</p>
            </div>
          )}

          {jobIntel && !loadingIntel && (
            <div className="space-y-6">
              {/* Row 1: Company Profile & Candidate Match */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company 360 Profile */}
                <div 
                  className="p-6 rounded-2xl space-y-4"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                    <Building2 className="w-4 h-4" />
                    Company & Engineering Footprint
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {jobIntel.company_intel.business_overview}
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Engineering Culture:</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{jobIntel.company_intel.engineering_culture}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>Tech Stack Footprint:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {jobIntel.company_intel.tech_stack_footprint.map((tech, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Candidate Fit & Tailored Pitch */}
                <div 
                  className="p-6 rounded-2xl space-y-4"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                      <Target className="w-4 h-4" />
                      Candidate Fit & Match Assessment
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {jobIntel.candidate_fit_assessment.match_score}% Match
                    </span>
                  </div>

                  {/* Pitch */}
                  <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 flex items-center justify-between">
                      <span>Tailored 'Tell Me About Yourself' Pitch:</span>
                      <button 
                        onClick={() => handleCopy(jobIntel.candidate_fit_assessment.tailored_pitch, 'pitch')}
                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                      >
                        {copiedText === 'pitch' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                    </span>
                    <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                      "{jobIntel.candidate_fit_assessment.tailored_pitch}"
                    </p>
                  </div>

                  {/* Advantages & Gaps */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-600">Key Advantages:</span>
                      <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {jobIntel.candidate_fit_assessment.key_advantages.map((adv, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{adv}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-amber-500">Critical Prep Gaps:</span>
                      <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {jobIntel.candidate_fit_assessment.critical_gaps.map((gap, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Interview Rounds Blueprint */}
              <div 
                className="p-6 rounded-2xl space-y-4"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
              >
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  <Layers className="w-4 h-4 text-blue-500" />
                  Interview Rounds & Evaluation Blueprint
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {jobIntel.interview_rounds_blueprint.map((round, idx) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-xl space-y-2 relative"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">{round.weightage}</span>
                        <span className="text-[10px] text-slate-400">{round.duration}</span>
                      </div>
                      <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        {round.round_name}
                      </h4>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {round.focus}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: Top Likely Questions with Hints & Traps */}
              <div 
                className="p-6 rounded-2xl space-y-4"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    High-Probability Interview Questions (with Hints & Pitfalls)
                  </div>
                  <span className="text-xs text-blue-500 font-medium">Top 5 Questions</span>
                </div>

                <div className="space-y-4">
                  {jobIntel.top_interview_questions.map((q, idx) => (
                    <div 
                      key={q.id || idx}
                      className="p-4 rounded-xl space-y-3"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          Q{idx + 1}: {q.question}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 self-start sm:self-auto">
                          {q.category}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                        <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <span className="font-bold text-amber-600 block text-[11px] mb-0.5">💡 Key Hint:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{q.hint}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                          <span className="font-bold text-blue-600 block text-[11px] mb-0.5">📐 Recommended Flow:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{q.expected_structure}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                          <span className="font-bold text-red-500 block text-[11px] mb-0.5">⚠️ Common Trap:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{q.common_pitfall}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 4: Conceptual Cheat Sheet */}
              <div 
                className="p-6 rounded-2xl space-y-4"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
              >
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  <Zap className="w-4 h-4 text-amber-500" />
                  Quick-Fire Revision Cheat Sheet
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="font-bold text-blue-600 block">Must-Revise Concepts:</span>
                    <ul className="space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {jobIntel.cheat_sheet.key_concepts_to_revise.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="font-bold text-emerald-600 block">System Design Checklist:</span>
                    <ul className="space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {jobIntel.cheat_sheet.system_design_checklist.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="font-bold text-red-500 block">Red Flags to Avoid:</span>
                    <ul className="space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {jobIntel.cheat_sheet.red_flags_to_avoid.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-red-500 font-bold">✕</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
