const CHUNK_SAMPLES = 2048;

class InterviewCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(CHUNK_SAMPLES);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (output) output.fill(0);
    if (!input) return true;

    let sourceOffset = 0;
    while (sourceOffset < input.length) {
      const count = Math.min(CHUNK_SAMPLES - this.offset, input.length - sourceOffset);
      this.pending.set(input.subarray(sourceOffset, sourceOffset + count), this.offset);
      this.offset += count;
      sourceOffset += count;
      if (this.offset === CHUNK_SAMPLES) {
        const chunk = this.pending;
        this.pending = new Float32Array(CHUNK_SAMPLES);
        this.offset = 0;
        this.port.postMessage(chunk, [chunk.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("interview-capture-processor", InterviewCaptureProcessor);
