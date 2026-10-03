import React, { useState, useEffect, useRef } from 'react';
import { InterviewConfig } from './live/types';
import { Lobby } from './live/components/Lobby';
import { MeetingRoom } from './live/components/MeetingRoom';
import { useAuth } from '../../context/AuthContext';

export interface LiveMultimodalArenaProps {
  company: string;
  role: string;
  jobDescription?: string;
  onConclude?: () => void;
  onBack?: () => void;
  onTailorResume?: (role: string, company: string, jd: string) => void;
}

export const LiveMultimodalArena: React.FC<LiveMultimodalArenaProps> = ({
  company,
  role,
  jobDescription,
  onConclude,
  onBack,
  onTailorResume,
}) => {
  const { activeProfile } = useAuth();
  const [meetingConfig, setMeetingConfig] = useState<InterviewConfig | null>(null);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [userVolume, setUserVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Request initial MediaStream (audio + video) in Lobby
  useEffect(() => {
    let active = true;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setUserStream(stream);

        // Real-time volume monitor for Lobby preview
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const monitor = () => {
          if (analyserRef.current) {
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length / 255;
            setUserVolume(avg);
          }
          animFrameRef.current = requestAnimationFrame(monitor);
        };
        animFrameRef.current = requestAnimationFrame(monitor);
      } catch (err) {
        console.warn('Could not access camera/mic in Lobby:', err);
        // Fallback: try audio only
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          if (active) {
            setUserStream(audioOnlyStream);
            setIsVideoOff(true);
          }
        } catch (e) {
          console.warn('Microphone also unavailable:', e);
        }
      }
    }

    initMedia();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleToggleMic = () => {
    if (userStream) {
      userStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const handleToggleVideo = () => {
    if (userStream) {
      userStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    } else {
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleJoinMeeting = (config: InterviewConfig) => {
    setMeetingConfig(config);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  };

  const handleLeaveMeeting = async () => {
    setMeetingConfig(null);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      // ignore
    }
    onConclude?.();
  };

  if (meetingConfig) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-[#202124] text-[#e8eaed] overflow-hidden select-none">
        <MeetingRoom
          config={meetingConfig}
          userStream={userStream}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMic={handleToggleMic}
          onToggleVideo={handleToggleVideo}
          onLeaveMeeting={handleLeaveMeeting}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-140px)] bg-[#202124] text-[#e8eaed] rounded-3xl overflow-hidden shadow-2xl border border-[#3c4043]">
      <Lobby
        onJoinMeeting={handleJoinMeeting}
        stream={userStream}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        userVolume={userVolume}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        initialCompany={company}
        initialRole={role}
        initialJobDescription={jobDescription}
        initialCandidateName={activeProfile?.name || 'Candidate'}
        onBack={onBack}
      />
    </div>
  );
};

