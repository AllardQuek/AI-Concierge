// AudioWorklet processor for real-time audio capture
// This runs in the audio worklet thread for minimal latency

class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    this.chunkSize = options.processorOptions.chunkSize || 4000; // 250ms at 16kHz
    this.speaker = options.processorOptions.speaker || 'unknown';
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;
    
    // Audio processing parameters
    this.sampleRate = sampleRate;
    this.channelCount = 1; // Mono for speech processing
    
    console.log(`AudioProcessor initialized for ${this.speaker} with chunk size ${this.chunkSize}`);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input && input.length > 0) {
      const inputChannel = input[0]; // Use first channel (mono)
      
      for (let i = 0; i < inputChannel.length; i++) {
        // Apply noise gate to filter out background noise
        const sample = this.applyNoiseGate(inputChannel[i]);
        
        this.buffer[this.bufferIndex] = sample;
        this.bufferIndex++;
        
        // When buffer is full, send it for processing
        if (this.bufferIndex >= this.chunkSize) {
          this.sendAudioChunk();
          this.bufferIndex = 0;
        }
      }
    }
    
    // Keep the processor alive
    return true;
  }
  
  applyNoiseGate(sample, threshold = 0.01) {
    // Simple noise gate to filter out low-level background noise
    return Math.abs(sample) > threshold ? sample : 0;
  }
  
  sendAudioChunk() {
    // Create a copy of the buffer to send
    const chunk = new Float32Array(this.buffer);
    
    // Calculate audio level for voice activity detection
    const audioLevel = this.calculateAudioLevel(chunk);
    
    // Only send if there's significant audio activity
    if (audioLevel > 0.005) {
      this.port.postMessage({
        type: 'audio-chunk',
        chunk: chunk,
        speaker: this.speaker,
        timestamp: currentTime * 1000, // Convert to milliseconds
        audioLevel: audioLevel,
        sampleRate: this.sampleRate
      });
    }
  }
  
  calculateAudioLevel(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += Math.abs(buffer[i]);
    }
    return sum / buffer.length;
  }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor);
