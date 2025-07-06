import { SocketService } from './socket';
import { TranscriptionResult } from './transcription';

export class AzureTranscriptionService {
  private socket: SocketService | null = null;
  private isRecording: boolean = false;
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;
  private onErrorCallback?: (error: string) => void;
  private audioContext: AudioContext | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
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
      id: `azure-partial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      id: `azure-final-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    console.log('🔊 Switching to fallback transcription mode');
    
    // Send a fallback transcript to indicate the system is working
    const fallbackResult: TranscriptionResult = {
      id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: "Transcription service is currently unavailable. Please check your Azure credentials or try again later.",
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
      "Transcription service is in fallback mode.",
      "Azure Speech-to-Text is not configured.",
      "Please set up your Azure credentials to enable transcription.",
      "You can still make calls without transcription."
    ];

    let messageIndex = 0;
    this.fallbackInterval = setInterval(() => {
      if (!this.isRecording || !this.fallbackMode) {
        this.clearFallbackInterval();
        return;
      }

      const fallbackResult: TranscriptionResult = {
        id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      
      // Create a script processor to capture audio data
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.audioProcessor.onaudioprocess = (event) => {
        if (!this.isRecording) return;

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert to Uint8Array for sending to server
        const audioData = new Uint8Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 127 + 128;
        }

        // Send audio chunk to Azure service
        if (this.socket && !this.fallbackMode) {
          this.socket.sendAudioChunk(audioData, inputBuffer.duration);
        }
      };

      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);
      
      console.log('🔊 Audio processing pipeline set up');
    } catch (error) {
      console.error('Failed to set up audio processing:', error);
      throw error;
    }
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