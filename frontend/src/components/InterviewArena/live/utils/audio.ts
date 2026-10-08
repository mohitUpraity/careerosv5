/**
 * Audio Utilities for Gemini Live Multimodal API
 * - Input: 16kHz 16-bit Linear PCM Little-Endian
 * - Output: 24kHz 16-bit Linear PCM Little-Endian
 */

export class AudioStreamingManager {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private inputSourceNode: MediaStreamAudioSourceNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  private scheduledSources: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;
  private onAudioChunkCallback: ((base64Pcm: string) => void) | null = null;
  private onVolumeChangeCallback: ((inputVolume: number, outputVolume: number) => void) | null = null;
  private onUserInterruptCallback: (() => void) | null = null;
  private isMuted: boolean = false;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  constructor() {
    // Lazy initialize when user starts session
  }

  public setOnAudioChunk(cb: (base64Pcm: string) => void) {
    this.onAudioChunkCallback = cb;
  }

  public setOnVolumeChange(cb: (inputVol: number, outputVol: number) => void) {
    this.onVolumeChangeCallback = cb;
  }

  public setOnUserInterrupt(cb: () => void) {
    this.onUserInterruptCallback = cb;
  }

  private unlockHandler: (() => void) | null = null;

  public unlockAudioContext() {
    if (this.inputAudioCtx && this.inputAudioCtx.state === "suspended") {
      this.inputAudioCtx.resume().catch(() => {});
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state === "suspended") {
      this.outputAudioCtx.resume().catch(() => {});
    }
  }

  public async startAudioCapture(stream: MediaStream): Promise<void> {
    this.mediaStream = stream;

    // Create 16kHz audio context for microphone capture
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
    
    // Create 24kHz audio context for Gemini output playback
    this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });

    const tryResume = () => {
      if (this.inputAudioCtx && this.inputAudioCtx.state === "suspended") {
        this.inputAudioCtx.resume().catch(() => {});
      }
      if (this.outputAudioCtx && this.outputAudioCtx.state === "suspended") {
        this.outputAudioCtx.resume().catch(() => {});
      }
    };

    tryResume();

    this.unlockHandler = () => {
      tryResume();
    };
    window.addEventListener("click", this.unlockHandler, { passive: true });
    window.addEventListener("keydown", this.unlockHandler, { passive: true });
    window.addEventListener("touchstart", this.unlockHandler, { passive: true });

    // Input Analyzer for UI visualizer
    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 64;
    this.inputAnalyser.smoothingTimeConstant = 0.5;

    // Output Analyzer for AI speech visualizer
    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 64;
    this.outputAnalyser.smoothingTimeConstant = 0.5;

    if (stream.getAudioTracks().length === 0) {
      try {
        const osc = this.inputAudioCtx.createOscillator();
        const dst = this.inputAudioCtx.createMediaStreamDestination();
        const gain = this.inputAudioCtx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        const silentTrack = dst.stream.getAudioTracks()[0];
        if (silentTrack) stream.addTrack(silentTrack);
      } catch (err) {
        console.warn("Could not attach fallback silent track:", err);
      }
    }

    this.inputSourceNode = this.inputAudioCtx.createMediaStreamSource(stream);
    this.inputSourceNode.connect(this.inputAnalyser);

    // 2048 samples at 16kHz = 128ms, keeping speech and VAD updates responsive.
    this.processorNode = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRunning || this.isMuted) return;

      const channelData = e.inputBuffer.getChannelData(0);

      // Calculate RMS energy of current microphone frame
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sumSquares / channelData.length);

      // Guarantee strict 16kHz PCM regardless of Safari's native hardware AudioContext rate (44.1k/48k)
      const nativeRate = this.inputAudioCtx ? this.inputAudioCtx.sampleRate : 16000;
      const resampled = this.downsampleTo16k(channelData, nativeRate);
      // Preserve silence packets so server-side VAD can detect the end of a phrase,
      // while zeroing low-level room noise that could trigger false speech starts.
      if (rms < 0.001) resampled.fill(0);
      const base64Pcm = this.floatTo16BitPCMBase64(resampled);
      if (this.onAudioChunkCallback) {
        this.onAudioChunkCallback(base64Pcm);
      }
    };

    this.inputAnalyser.connect(this.processorNode);

    // Muted gain node to keep ScriptProcessor alive without playing mic into speakers
    const silentGain = this.inputAudioCtx.createGain();
    silentGain.gain.value = 0;
    this.processorNode.connect(silentGain);
    silentGain.connect(this.inputAudioCtx.destination);

    this.isRunning = true;
    this.startVolumeMonitoring();
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Returns true if AI audio sources are currently scheduled/playing.
   * Used to avoid stale React state closures for interruption detection.
   */
  public hasActivePlayback(): boolean {
    return this.scheduledSources.length > 0;
  }

  /**
   * Resamples Float32 audio buffer from native hardware sample rate to 16kHz
   */
  private downsampleTo16k(input: Float32Array, fromRate: number): Float32Array {
    if (!fromRate || Math.abs(fromRate - 16000) < 100) return input;
    const ratio = fromRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetInput = 0;
    while (offsetResult < result.length) {
      const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
        accum += input[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : (input[offsetInput] || 0);
      offsetResult++;
      offsetInput = nextOffsetInput;
    }
    return result;
  }

  /**
   * Converts Float32Array (-1.0 to 1.0) into 16-bit PCM (little-endian) and encodes to Base64
   */
  private floatTo16BitPCMBase64(float32Array: Float32Array): string {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp between -1 and 1
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert to 16-bit signed integer (-32768 to 32767)
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, val, true); // true = little-endian
    }

    // Convert ArrayBuffer to binary string
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Queue & schedule gapless 24kHz audio playback received from Gemini Live
   */
  public playAudioChunk(base64Pcm: string) {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === "closed") return;

    if (this.outputAudioCtx.state === "suspended") {
      this.outputAudioCtx.resume().catch((err) => {
        console.warn("Could not resume interviewer audio playback:", err);
      });
    }

    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM little-endian back to Float32
      const dataView = new DataView(bytes.buffer);
      const sampleCount = Math.floor(len / 2);
      const float32Array = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, sampleCount, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // Route through output analyzer so AI avatar pulses with voice
      if (this.outputAnalyser) {
        sourceNode.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.outputAudioCtx.destination);
      } else {
        sourceNode.connect(this.outputAudioCtx.destination);
      }

      // Schedule gapless playback
      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime + 0.08; // Small jitter buffer for network-delivered audio chunks
      }

      sourceNode.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;

      this.scheduledSources.push(sourceNode);

      sourceNode.onended = () => {
        const idx = this.scheduledSources.indexOf(sourceNode);
        if (idx !== -1) {
          this.scheduledSources.splice(idx, 1);
        }
      };
    } catch (err) {
      console.error("Error playing audio chunk:", err);
    }
  }

  public isAiAudioPlaying(): boolean {
    return this.scheduledSources.length > 0;
  }

  /**
   * Interrupt AI playback immediately (Full-duplex cutoff)
   */
  public stopPlayback() {
    this.scheduledSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // Source might already have finished
      }
    });
    this.scheduledSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
  }

  private startVolumeMonitoring() {
    const checkVolume = () => {
      let inputVol = 0;
      let outputVol = 0;

      if (this.inputAnalyser && !this.isMuted) {
        const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);
        this.inputAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        inputVol = sum / dataArray.length / 255;
      }

      if (this.outputAnalyser && this.scheduledSources.length > 0) {
        const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        outputVol = sum / dataArray.length / 255;
      }

      if (this.onVolumeChangeCallback) {
        this.onVolumeChangeCallback(inputVol, outputVol);
      }

      if (this.isRunning) {
        this.animationFrameId = requestAnimationFrame(checkVolume);
      }
    };

    this.animationFrameId = requestAnimationFrame(checkVolume);
  }

  public cleanup() {
    this.isRunning = false;
    if (this.unlockHandler) {
      window.removeEventListener("click", this.unlockHandler);
      window.removeEventListener("keydown", this.unlockHandler);
      window.removeEventListener("touchstart", this.unlockHandler);
      this.unlockHandler = null;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopPlayback();

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.inputSourceNode) {
      this.inputSourceNode.disconnect();
      this.inputSourceNode = null;
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state !== "closed") {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state !== "closed") {
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }
  }
}
