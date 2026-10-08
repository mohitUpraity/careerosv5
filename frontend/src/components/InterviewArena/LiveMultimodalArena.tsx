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

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const setupAudioAnalyzer = (stream: MediaStream) => {
    try {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

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
    } catch (e) {
      console.warn('Could not setup audio analyzer:', e);
    }
  };

  const acquireMediaStream = async (): Promise<MediaStream> => {
    // Stage 1: Try HD echo-cancelled audio + HD video
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280, min: 480 },
          height: { ideal: 720, min: 360 },
          facingMode: 'user',
        },
      });
    } catch (err1) {
      console.warn('Stage 1 HD constraints failed, falling back to basic audio/video:', err1);
    }

    // Stage 2: Try basic video: true + audio: true without restrictive constraints
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
    } catch (err2) {
      console.warn('Stage 2 basic audio+video failed, requesting separately:', err2);
    }

    // Stage 3: Request video and audio individually so one device doesn't block the other
    let videoTrack: MediaStreamTrack | null = null;
    let audioTrack: MediaStreamTrack | null = null;

    try {
      const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoTrack = vStream.getVideoTracks()[0] || null;
    } catch (vErr) {
      console.warn('Separate video acquisition failed:', vErr);
    }

    try {
      const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioTrack = aStream.getAudioTracks()[0] || null;
    } catch (aErr) {
      console.warn('Separate audio acquisition failed:', aErr);
    }

    // Stage 4: Synthesize fallback tracks if any device is unavailable or errored
    if (!audioTrack) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const actx = new AudioContextClass();
          const osc = actx.createOscillator();
          const dst = actx.createMediaStreamDestination();
          const gain = actx.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          audioTrack = dst.stream.getAudioTracks()[0] || null;
        }
      } catch (e) {
        console.warn('Fallback audio track creation notice:', e);
      }
    }

    if (!videoTrack) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#111827';
          ctx.fillRect(0, 0, 640, 480);
        }
        const vStream = canvas.captureStream(10);
        videoTrack = vStream.getVideoTracks()[0] || null;
      } catch (e) {
        console.warn('Fallback video track creation notice:', e);
      }
    }

    const availableTracks: MediaStreamTrack[] = [];
    if (videoTrack) availableTracks.push(videoTrack);
    if (audioTrack) availableTracks.push(audioTrack);

    return new MediaStream(availableTracks);
  };

  const requestMediaPermissions = async () => {
    setPermissionError(null);
    try {
      const stream = await acquireMediaStream();

      // Check tracks
      const hasLiveVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
      const hasLiveAudio = stream.getAudioTracks().some((t) => t.readyState === 'live');

      // Stop previous tracks if replacing
      setUserStream((prev) => {
        if (prev && prev !== stream) {
          prev.getTracks().forEach((t) => {
            try { t.stop(); } catch (e) {}
          });
        }
        return stream;
      });

      setIsVideoOff(!hasLiveVideo);
      setIsMuted(!hasLiveAudio);

      setupAudioAnalyzer(stream);
    } catch (err: any) {
      console.error('Failed to acquire camera/mic stream:', err);
      setPermissionError(err.message || 'Camera or microphone permissions were denied.');
      setIsVideoOff(true);
    }
  };

  // Request initial MediaStream (audio + video) in Lobby & listen for changes
  useEffect(() => {
    requestMediaPermissions();

    // 1. Listen for browser permission state changes (e.g. user toggles Camera/Mic in Chrome dropdown)
    if (navigator.permissions && navigator.permissions.query) {
      const monitor = async (name: 'camera' | 'microphone') => {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          status.onchange = () => {
            console.log(`[Permissions API] ${name} permission status changed to:`, status.state);
            if (status.state === 'granted') {
              requestMediaPermissions();
            }
          };
        } catch (e) {}
      };
      monitor('camera');
      monitor('microphone');
    }

    // 2. Re-check when window/tab gains focus (e.g. user toggles Chrome site settings popover and clicks back)
    const onFocus = () => {
      setUserStream((currentStream) => {
        const hasLiveVideo = currentStream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
        if (!hasLiveVideo) {
          requestMediaPermissions();
        }
        return currentStream;
      });
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
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

  const handleToggleVideo = async () => {
    try {
      // If currently ON, toggle to OFF
      if (!isVideoOff) {
        if (userStream) {
          userStream.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        setIsVideoOff(true);
        return;
      }

      // If currently OFF, turn ON:
      // 1. Check if there's an existing live video track that just needs enabling
      const existingTrack = userStream?.getVideoTracks().find((t) => t.readyState === 'live');
      if (existingTrack) {
        existingTrack.enabled = true;
        setIsVideoOff(false);
        return;
      }

      // 2. Otherwise, explicitly request a new video stream from browser
      let freshVideoStream: MediaStream | null = null;
      try {
        freshVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280, min: 480 }, height: { ideal: 720, min: 360 }, facingMode: 'user' },
        });
      } catch {
        freshVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const newVideoTrack = freshVideoStream.getVideoTracks()[0];
      if (newVideoTrack) {
        const existingAudioTracks = userStream
          ? userStream.getAudioTracks().filter((t) => t.readyState === 'live')
          : [];

        // If userStream had no audio, try getting audio too
        let allTracks = [newVideoTrack, ...existingAudioTracks];
        if (existingAudioTracks.length === 0) {
          try {
            const freshAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const newAudioTrack = freshAudioStream.getAudioTracks()[0];
            if (newAudioTrack) allTracks.push(newAudioTrack);
          } catch (e) {}
        }

        const combinedStream = new MediaStream(allTracks);
        setUserStream(combinedStream);
        setIsVideoOff(false);
        setPermissionError(null);
        setupAudioAnalyzer(combinedStream);
      }
    } catch (err: any) {
      console.error('Could not activate camera:', err);
      setPermissionError('Camera permission blocked. Please enable camera in your browser settings.');
      alert('Camera access was blocked or could not be accessed. Please check permissions in your address bar.');
    }
  };

  const handleJoinMeeting = async (config: InterviewConfig) => {
    let stream = userStream;
    const hasLiveVideo = stream?.getVideoTracks().some((t) => t.readyState === 'live');
    const hasLiveAudio = stream?.getAudioTracks().some((t) => t.readyState === 'live');

    // Always actively prompt for camera & mic if not already live
    if (!hasLiveVideo || !hasLiveAudio) {
      try {
        stream = await acquireMediaStream();
        setUserStream(stream);
        setIsVideoOff(!stream.getVideoTracks().some((t) => t.readyState === 'live'));
        setIsMuted(!stream.getAudioTracks().some((t) => t.readyState === 'live'));
      } catch (err) {
        console.warn('Camera & microphone prompt during join notice:', err);
      }
    }

    setMeetingConfig(config);
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
      <div className="dashboard-live-arena fixed inset-0 z-50 w-screen h-screen bg-[#202124] text-[#e8eaed] overflow-hidden select-none">
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
    <div className="dashboard-live-arena ws-interview-lobby-frame w-full">
      <Lobby
        onJoinMeeting={handleJoinMeeting}
        stream={userStream}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        userVolume={userVolume}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onRequestPermissions={requestMediaPermissions}
        permissionError={permissionError}
        initialCompany={company}
        initialRole={role}
        initialJobDescription={jobDescription}
        initialCandidateName={activeProfile?.name || 'Candidate'}
        onBack={onBack}
      />
    </div>
  );
};
