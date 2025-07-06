// Transcription Service for real-time audio capture and processing
import { io, Socket } from 'socket.io-client';

export interface TranscriptionChunk {
  type: 'audio-chunk';
  conversationId: string;
  participantId: string;
  timestamp: number;
  audioData: string; // Base64 encoded audio
  audioLevel: number;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  speaker: string; // Allow any string for participant IDs
  timestamp: number;
  confidence: number;
  isFinal: boolean;
}

export class TranscriptionService {
  private socket: Socket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioProcessor: AudioWorkletNode | null = null;
  private conversationId: string | null = null;
  private participantId: string | null = null;
  private isRecording = false;
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    this.setupAudioContext();
  }

  private setupAudioContext() {
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async startTranscription(
    audioStream: MediaStream,
    conversationId: string,
    participantId: string,
    existingSocket?: Socket
  ): Promise<void> {
    try {
      this.conversationId = conversationId;
      this.participantId = participantId;

      // Use existing Socket.IO connection or create new one
      if (existingSocket) {
        this.socket = existingSocket;
        this.setupSocketListeners();
      } else {
        await this.connectToServer();
      }

      // Set up audio processing pipeline
      await this.setupAudioProcessing(audioStream);

      // Start the conversation on the server
      if (this.socket) {
        this.socket.emit('transcription-start-conversation', { conversationId });
      }

      this.isRecording = true;
      console.log('🎤 Transcription started for participant:', participantId);
    } catch (error) {
      console.error('Failed to start transcription:', error);
      throw error;
    }
  }

  private async connectToServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use the same server URL as the main socket service
      const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';
      this.socket = io(serverUrl);

      this.setupSocketListeners();

      this.socket.on('connect', () => {
        console.log('🔗 Connected to transcription server via Socket.IO');
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Socket.IO connection error:', error);
        reject(new Error('Failed to connect to transcription server'));
      });
    });
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('transcription', (data: any) => {
      this.handleServerMessage(data);
    });

    this.socket.on('transcription-error', (data: any) => {
      if (this.onErrorCallback) {
        this.onErrorCallback(data.message);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from transcription server');
      this.isRecording = false;
    });
  }

  private async setupAudioProcessing(audioStream: MediaStream): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    // Load audio worklet for processing
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');

    // Create audio source from stream
    const source = this.audioContext.createMediaStreamSource(audioStream);

    // Create audio processor for real-time chunking
    this.audioProcessor = new AudioWorkletNode(this.audioContext, 'audio-processor', {
      processorOptions: {
        chunkSize: 4000, // 250ms at 16kHz
        speaker: this.participantId
      }
    });

    // Handle audio chunks from processor
    this.audioProcessor.port.onmessage = (event) => {
      if (event.data.type === 'audio-chunk' && this.isRecording) {
        this.sendAudioChunk(event.data);
      }
    };

    // Connect audio pipeline
    source.connect(this.audioProcessor);
    this.audioProcessor.connect(this.audioContext.destination);
  }

  private sendAudioChunk(audioData: any): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    // Convert Float32Array to base64 for transmission
    const audioBuffer = this.convertFloat32ToBase64(audioData.chunk);

    const chunk: TranscriptionChunk = {
      type: 'audio-chunk',
      conversationId: this.conversationId!,
      participantId: this.participantId!,
      timestamp: audioData.timestamp,
      audioData: audioBuffer,
      audioLevel: audioData.audioLevel
    };

    // Send via Socket.IO
    this.socket.emit('transcription-audio-chunk', chunk);
  }

  private convertFloat32ToBase64(float32Array: Float32Array): string {
    // Convert Float32 to Int16 for better compression
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample * 32767;
    }

    // Convert to base64
    const uint8Array = new Uint8Array(int16Array.buffer);
    return btoa(String.fromCharCode(...uint8Array));
  }

  private handleServerMessage(data: any): void {
    switch (data.type) {
      case 'transcription':
        if (this.onTranscriptionCallback) {
          this.onTranscriptionCallback(data.result);
        }
        break;
      
      case 'error':
        if (this.onErrorCallback) {
          this.onErrorCallback(data.message);
        }
        break;
      
      default:
        console.log('Unknown server message type:', data.type);
    }
  }

  onTranscription(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  stopTranscription(): void {
    this.isRecording = false;

    // End the conversation on the server
    if (this.socket && this.conversationId) {
      this.socket.emit('transcription-end-conversation', { conversationId: this.conversationId });
    }

    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    // Don't disconnect the socket if it's shared with other services
    // Only disconnect if we created it ourselves
    if (this.socket && !this.socket.connected) {
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('🎤 Transcription stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  getParticipantId(): string | null {
    return this.participantId;
  }
} 