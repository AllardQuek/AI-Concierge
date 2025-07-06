// AudioWorklet processor for real-time audio capture
// This runs in the audio worklet thread for minimal latency

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (input.length > 0) {
      const inputChannel = input[0];
      
      // Copy input data to our buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // When buffer is full, send it to main thread
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage({
            type: 'audio-data',
            data: this.buffer.slice(),
            duration: this.bufferSize / sampleRate
          });
          this.bufferIndex = 0;
        }
      }
      
      // Copy input to output (pass-through)
      for (let i = 0; i < inputChannel.length; i++) {
        output[0][i] = inputChannel[i];
      }
    }
    
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
