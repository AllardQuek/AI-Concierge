import { SocketService } from './socket';
import { TranscriptionResult } from './transcription';

export class AzureTranscriptionService {
  private socket: SocketService | null = null;
  private isRecording: boolean = false;
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;
  private onErrorCallback?: (error: string) => void;
  private audioContext: AudioContext | null = null;
  private audioProcessor: AudioWorkletNode | ScriptProcessorNode | null = null;
  private participantId: string = '';
  private fallbackMode: boolean = false;
  private fallbackInterval: number | null = null;

  constructor(socketService: SocketService) {
    this.socket = socketService;
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Listen for Azure transcription events
    this.socket.on('transcript-partial', (data: { text: string }) => {
      this.handlePartialTranscript(data.text);
    });

    this.socket.on('transcript-final', (data: { text: string }) => {
      this.handleFinalTranscript(data.text);
    });

    this.socket.on('transcription-error', (data: { message: string }) => {
      this.handleTranscriptionError(data.message);
    });

    this.socket.on('transcription-ended', () => {
      console.log('🔊 Azure transcription session ended');
    });
  }

  private handlePartialTranscript(text: string): void {
    if (!text.trim()) return;

    const result: TranscriptionResult = {
      id: `azure-partial-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      text: text,
      speaker: this.participantId || 'Unknown', // Use actual participant ID/phone number
      timestamp: Date.now(),
      confidence: 0.85, // Default confidence for partial results
      isFinal: false
    };

    if (this.onTranscriptionCallback) {
      this.onTranscriptionCallback(result);
    }
  }

  private handleFinalTranscript(text: string): void {
    if (!text.trim()) return;

    const result: TranscriptionResult = {
      id: `azure-final-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      text: text,
      speaker: this.participantId || 'Unknown', // Use actual participant ID/phone number
      timestamp: Date.now(),
      confidence: 0.95, // High confidence for final results
      isFinal: true
    };

    if (this.onTranscriptionCallback) {
      this.onTranscriptionCallback(result);
    }
  }

  private handleTranscriptionError(message: string): void {
    console.error('🔊 Azure transcription error:', message);
    
    // If Azure is not available, switch to fallback mode
    if (message.includes('Azure free tier limit reached') || 
        message.includes('Invalid subscription key') ||
        message.includes('Invalid region')) {
      this.switchToFallbackMode();
    }

    if (this.onErrorCallback) {
      this.onErrorCallback(message);
    }
  }

  private switchToFallbackMode(): void {
    if (this.fallbackMode) return;
    
    this.fallbackMode = true;
    console.log('🔊 Switching to fallback transcription mode - audio will still be sent to server');
    
    // Send a fallback transcript to indicate the system is working
    const fallbackResult: TranscriptionResult = {
      id: `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      text: "Audio is being captured and sent to server. Azure transcription is not configured - please set up credentials for real-time transcription.",
      speaker: this.participantId || 'Unknown',
      timestamp: Date.now(),
      confidence: 1.0,
      isFinal: true
    };

    if (this.onTranscriptionCallback) {
      this.onTranscriptionCallback(fallbackResult);
    }

    // Add periodic fallback messages to show the system is active
    this.startFallbackMessages();
  }

  private startFallbackMessages(): void {
    const fallbackMessages = [
      "Audio is being captured and sent to server.",
      "Azure Speech-to-Text is not configured.",
      "Please set up your Azure credentials to enable real-time transcription.",
      "You can still make calls - audio pipeline is working."
    ];

    let messageIndex = 0;
    this.fallbackInterval = setInterval(() => {
      if (!this.isRecording || !this.fallbackMode) {
        this.clearFallbackInterval();
        return;
      }

      const fallbackResult: TranscriptionResult = {
        id: `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        text: fallbackMessages[messageIndex % fallbackMessages.length],
        speaker: this.participantId || 'Unknown',
        timestamp: Date.now(),
        confidence: 1.0,
        isFinal: true
      };

      if (this.onTranscriptionCallback) {
        this.onTranscriptionCallback(fallbackResult);
      }

      messageIndex++;
    }, 10000); // Send a message every 10 seconds
  }

  async startTranscription(
    audioStream: MediaStream,
    conversationId: string,
    participantId: string
  ): Promise<void> {
    try {
      this.participantId = participantId;
      this.fallbackMode = false;

      console.log('🔊 Starting Azure transcription for conversation:', conversationId);

      // Try to start Azure transcription
      if (this.socket) {
        this.socket.startTranscription();
        
        // Send conversation ID and participant ID to backend for proper transcript association
        this.socket.emit('start-conversation', { 
          conversationId,
          participantId: this.participantId 
        });
      }

      // Set up audio processing pipeline
      await this.setupAudioProcessing(audioStream);

      this.isRecording = true;
      console.log('🔊 Azure transcription started for participant:', participantId);
    } catch (error) {
      console.error('Failed to start Azure transcription:', error);
      this.switchToFallbackMode();
    }
  }

  private async setupAudioProcessing(audioStream: MediaStream): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      
      // Handle mobile audio context suspension
      if (this.audioContext.state === 'suspended') {
        console.log('🔊 Audio context suspended, waiting for user interaction...');
        await this.audioContext.resume();
      }
      
      const source = this.audioContext.createMediaStreamSource(audioStream);
      
      // Try to load AudioWorklet first
      try {
        console.log('🔊 Loading AudioWorklet...');
        await this.audioContext.audioWorklet.addModule('/audio-processor.js');
        console.log('🔊 AudioWorklet loaded successfully');
        
        // Create AudioWorkletNode
        this.audioProcessor = new AudioWorkletNode(this.audioContext, 'audio-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        
        // Handle audio data from the worklet
        this.audioProcessor.port.onmessage = (event) => {
          if (event.data.type === 'audio-data' && this.isRecording) {
            const { data, duration } = event.data;
            
            // Convert Float32Array to Uint8Array for sending to server
            const audioData = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
              audioData[i] = Math.max(-1, Math.min(1, data[i])) * 127 + 128;
            }

            // Send audio chunk to server regardless of fallback mode
            if (this.socket) {
              console.log(`🔊 Sending audio chunk (AudioWorklet): ${audioData.length} bytes, duration: ${duration}s`);
              this.socket.sendAudioChunk(audioData, duration);
              
              // Log in fallback mode for debugging
              if (this.fallbackMode) {
                console.log('🔊 Audio sent to server (fallback mode - Azure not configured)');
              }
            } else {
              console.warn('🔊 No socket available to send audio chunk');
            }
          }
        };

        // Connect the audio nodes
        if (this.audioProcessor) {
          source.connect(this.audioProcessor as AudioNode);
          (this.audioProcessor as AudioNode).connect(this.audioContext.destination);
        }
        
        console.log('🔊 AudioWorklet processing pipeline set up successfully');
        
      } catch (workletError) {
        console.warn('🔊 AudioWorklet failed, falling back to ScriptProcessorNode:', workletError);
        this.setupScriptProcessorFallback(source);
        return;
      }
      
      console.log('🔊 Audio processor created:', !!this.audioProcessor);
      console.log('🔊 Audio context state:', this.audioContext?.state);
    } catch (error) {
      console.error('Failed to set up audio processing:', error);
      throw error;
    }
  }

  private setupScriptProcessorFallback(source: MediaStreamAudioSourceNode): void {
    console.log('🔊 Using ScriptProcessorNode fallback');
    
    // Use ScriptProcessorNode as fallback
    this.audioProcessor = this.audioContext!.createScriptProcessor(4096, 1, 1) as any;
    
    (this.audioProcessor as any).onaudioprocess = (event: any) => {
      if (!this.isRecording) return;

      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Convert to Uint8Array for sending to server
      const audioData = new Uint8Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 127 + 128;
      }

      // Send audio chunk to server regardless of fallback mode
      if (this.socket) {
        console.log(`🔊 Sending audio chunk (ScriptProcessor): ${audioData.length} bytes, duration: ${inputBuffer.duration}s`);
        this.socket.sendAudioChunk(audioData, inputBuffer.duration);
        
        // Log in fallback mode for debugging
        if (this.fallbackMode) {
          console.log('🔊 Audio sent to server (fallback mode - Azure not configured)');
        }
      } else {
        console.warn('🔊 No socket available to send audio chunk');
      }
    };

    source.connect(this.audioProcessor as AudioNode);
    (this.audioProcessor as AudioNode).connect(this.audioContext!.destination);
    
    console.log('🔊 ScriptProcessorNode fallback set up successfully');
  }

  stopTranscription(): void {
    this.isRecording = false;

    // Clear fallback interval
    this.clearFallbackInterval();

    // Stop Azure transcription
    if (this.socket) {
      this.socket.stopTranscription();
    }

    // Clean up audio processing
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('🔊 Azure transcription stopped');
  }

  onTranscription(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  isActive(): boolean {
    return this.isRecording;
  }

  isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  private clearFallbackInterval(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }
} 