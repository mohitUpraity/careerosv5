import React from "react";
import { Sparkles, Mic } from "lucide-react";

interface CaptionsOverlayProps {
  isVisible: boolean;
  speaker: "ai" | "user" | "none";
  speakerName: string;
  text: string;
  isLiveSpeaking?: boolean;
}

export const CaptionsOverlay: React.FC<CaptionsOverlayProps> = ({
  isVisible,
  speaker,
  speakerName,
  text,
  isLiveSpeaking = true,
}) => {
  if (!isVisible || !text || speaker === "none") return null;

  const isAi = speaker === "ai";

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 max-w-2xl w-[92%] z-20 pointer-events-none transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-[#121316]/92 backdrop-blur-xl px-4 sm:px-5 py-3 rounded-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-start space-x-3.5 text-left">
        {/* Speaker Avatar / Icon */}
        <div
          className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
            isAi
              ? "bg-gradient-to-br from-blue-500/25 to-indigo-500/20 text-blue-300 border-blue-400/30 shadow-sm shadow-blue-500/20"
              : "bg-gradient-to-br from-emerald-500/25 to-teal-500/20 text-emerald-300 border-emerald-400/30 shadow-sm shadow-emerald-500/20"
          }`}
        >
          {isAi ? (
            <Sparkles className="w-4 h-4 animate-pulse" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </div>

        {/* Caption Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span
                className={`text-xs font-semibold tracking-wide ${
                  isAi ? "text-blue-300" : "text-emerald-300"
                }`}
              >
                {speakerName}
              </span>
              {/* Real-time speaking audio waveform indicator */}
              {isLiveSpeaking && (
                <div className="flex items-center space-x-0.5" aria-hidden="true">
                  <span
                    className={`w-0.5 h-2 rounded-full animate-pulse ${
                      isAi ? "bg-blue-400" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`w-0.5 h-3.5 rounded-full animate-pulse [animation-delay:150ms] ${
                      isAi ? "bg-blue-400" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`w-0.5 h-2.5 rounded-full animate-pulse [animation-delay:300ms] ${
                      isAi ? "bg-blue-400" : "bg-emerald-400"
                    }`}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono uppercase tracking-wider text-gray-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isAi ? "bg-blue-400" : "bg-emerald-400"
                } animate-ping`}
              />
              <span>Live CC</span>
            </div>
          </div>

          <p className="text-sm sm:text-base text-gray-100 font-normal leading-relaxed mt-1 break-words select-none tracking-wide antialiased">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
};
