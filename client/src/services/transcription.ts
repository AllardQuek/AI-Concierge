// Real-time Transcription Service for Phase 2
// This integrates with Web Speech API for actual speech-to-text conversion
// NOTE: Web Speech API limitations require manual speaker identification

export interface TranscriptionSegment {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
  isPartial: boolean; // For real-time updates
  source: 'speech-api' | 'manual'; // Track how this was captured
}

export interface ConversationHistory {
  sessionId: string;
  segments: TranscriptionSegment[];
  startTime: number;
  lastActivity: number;
}

// Web Speech API type definitions
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export class TranscriptionService {
  private conversations = new Map<string, ConversationHistory>();
  private recognition: any = null;
  private isListening = false;
  private currentSessionId: string | null = null;
  
  // WebRTC Integration (for future enhancement)
  private localAudioStream: MediaStream | null = null;
  private remoteAudioStream: MediaStream | null = null;

  constructor() {
    this.initializeSpeechRecognition();
  }

  // Connect to WebRTC audio streams
  connectToWebRTCStreams(localStream: MediaStream | null, remoteStream: MediaStream | null): void {
    this.localAudioStream = localStream;
    this.remoteAudioStream = remoteStream;
    
    console.log('TranscriptionService: Connected to WebRTC streams', {
      localTracks: localStream?.getAudioTracks().length || 0,
      remoteTracks: remoteStream?.getAudioTracks().length || 0
    });

    // TODO: In a real implementation, we would need to:
    // 1. Use Web Audio API to create AudioContext from these streams
    // 2. Apply speech recognition to each stream separately
    // 3. Use voice activity detection to determine speaker
    // Currently limited by browser APIs - Web Speech API can't process MediaStream directly
  }

  private initializeSpeechRecognition(): void {
    // Check if speech recognition is supported
    if (!this.isSpeechRecognitionSupported()) {
      console.warn('Speech recognition is not supported in this browser');
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition settings
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Set up event handlers
    this.setupRecognitionHandlers();
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleSpeechResult(event);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      
      // Restart if we have an active session
      if (this.currentSessionId && this.isSpeechRecognitionSupported()) {
        setTimeout(() => {
          this.startListening();
        }, 100);
      }
    };
  }

  private handleSpeechResult(event: SpeechRecognitionEvent): void {
    if (!this.currentSessionId) return;

    const result = event.results[event.resultIndex];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence || 0.8;
    const isPartial = !result.isFinal;

    // IMPORTANT: Web Speech API only captures agent's microphone
    // Customer speech must be added manually due to browser limitations
    this.addTranscriptionSegment(
      this.currentSessionId,
      'agent', // Always agent since we can only capture agent's mic
      transcript,
      confidence,
      isPartial,
      'speech-api'
    );
  }

  private addTranscriptionSegment(
    sessionId: string, 
    speaker: 'agent' | 'customer', 
    text: string, 
    confidence: number, 
    isPartial: boolean,
    source: 'speech-api' | 'manual' = 'manual'
  ): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    // Remove previous partial segment if exists (same speaker and source)
    if (isPartial) {
      const lastSegment = conversation.segments[conversation.segments.length - 1];
      if (lastSegment && lastSegment.isPartial && lastSegment.speaker === speaker && lastSegment.source === source) {
        conversation.segments.pop();
      }
    }

    const segment: TranscriptionSegment = {
      id: isPartial ? `partial-${Date.now()}` : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      speaker,
      text: text.trim(),
      timestamp: Date.now(),
      confidence,
      isPartial,
      source
    };

    conversation.segments.push(segment);
    conversation.lastActivity = Date.now();

    // Trigger custom event for real-time updates
    window.dispatchEvent(new CustomEvent('transcription-update', {
      detail: { sessionId, segment, conversation }
    }));
  }

  isSpeechRecognitionSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  startSession(sessionId: string): void {
    if (this.conversations.has(sessionId)) {
      return; // Session already exists
    }

    const conversation: ConversationHistory = {
      sessionId,
      segments: [],
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    this.conversations.set(sessionId, conversation);
    this.currentSessionId = sessionId;
    console.log(`Transcription session started: ${sessionId}`);

    // Start listening for speech
    this.startListening();
  }

  endSession(sessionId: string): void {
    const conversation = this.conversations.get(sessionId);
    if (conversation) {
      console.log(`Transcription session ended: ${sessionId}`, conversation);
    }
    
    this.conversations.delete(sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.stopListening();
      this.currentSessionId = null;
    }
  }

  private startListening(): void {
    if (!this.recognition || this.isListening || !this.isSpeechRecognitionSupported()) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }

  private stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  setSpeaker(speaker: 'agent' | 'customer'): void {
    // Note: This is legacy - Web Speech API only captures agent speech
    // Customer speech must be added manually
    console.log(`Note: Web Speech API only captures agent speech. Customer: "${speaker}" speech requires manual input.`);
  }

  getConversationHistory(sessionId: string): ConversationHistory | null {
    return this.conversations.get(sessionId) || null;
  }

  // Subscribe to transcription updates
  onTranscriptionUpdate(callback: (data: { sessionId: string; segment: TranscriptionSegment; conversation: ConversationHistory }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('transcription-update', handler as EventListener);
    
    return () => {
      window.removeEventListener('transcription-update', handler as EventListener);
    };
  }

  // Get conversation summary for AI analysis
  getConversationSummary(sessionId: string): {
    totalSegments: number;
    duration: number;
    customerMessages: number;
    agentMessages: number;
    lastCustomerMessage?: string;
    lastAgentMessage?: string;
    speechRecognitionActive: boolean;
  } | null {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return null;

    const customerSegments = conversation.segments.filter((s: any) => s.speaker === 'customer' && !s.isPartial);
    const agentSegments = conversation.segments.filter((s: any) => s.speaker === 'agent' && !s.isPartial);

    return {
      totalSegments: conversation.segments.length,
      duration: Date.now() - conversation.startTime,
      customerMessages: customerSegments.length,
      agentMessages: agentSegments.length,
      lastCustomerMessage: customerSegments[customerSegments.length - 1]?.text,
      lastAgentMessage: agentSegments[agentSegments.length - 1]?.text,
      speechRecognitionActive: this.isListening && this.isSpeechRecognitionSupported()
    };
  }

  // Manual transcription for testing and customer speech (required due to browser limitations)
  addManualTranscription(sessionId: string, speaker: 'agent' | 'customer', text: string): void {
    this.addTranscriptionSegment(sessionId, speaker, text, 1.0, false, 'manual');
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService();
