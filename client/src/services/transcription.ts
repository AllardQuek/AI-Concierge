// Mock Transcription Service for Phase 2
// This simulates real-time speech-to-text conversion

export interface TranscriptionSegment {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
  isPartial: boolean; // For real-time updates
}

export interface ConversationHistory {
  sessionId: string;
  segments: TranscriptionSegment[];
  startTime: number;
  lastActivity: number;
}

export class TranscriptionService {
  private conversations = new Map<string, ConversationHistory>();
  private mockResponses = {
    customer: [
      "Hi, I need help with my account",
      "I can't access my online banking",
      "I tried resetting my password but it's not working",
      "Can you help me with that?",
      "Yes, that would be great",
      "My email is john.doe@email.com",
      "I see, that makes sense",
      "Thank you for your help",
      "Actually, I have one more question",
      "When will the changes take effect?",
      "Perfect, I appreciate your assistance",
      "Have a great day!"
    ],
    agent: [
      "Hello! I'd be happy to help you with your account",
      "I understand you're having trouble with online banking access",
      "Let me check your account details",
      "I can see the issue here",
      "I'll need to verify your identity first",
      "Can you confirm your email address?",
      "Great, I've found your account",
      "I'm updating your password reset settings now",
      "You should receive an email shortly",
      "The changes will be active within 5 minutes",
      "Is there anything else I can help you with?",
      "You're welcome! Take care!"
    ]
  };

  private currentMockIndex = { customer: 0, agent: 0 };
  private simulationInterval: number | null = null;

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
    console.log(`Transcription session started: ${sessionId}`);
  }

  endSession(sessionId: string): void {
    const conversation = this.conversations.get(sessionId);
    if (conversation) {
      console.log(`Transcription session ended: ${sessionId}`, conversation);
    }
    
    this.conversations.delete(sessionId);
    this.stopMockSimulation();
    this.resetMockIndices();
  }

  getConversationHistory(sessionId: string): ConversationHistory | null {
    return this.conversations.get(sessionId) || null;
  }

  // Mock transcription - simulates real-time speech recognition
  private addMockSegment(sessionId: string, speaker: 'agent' | 'customer', text: string): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    const segment: TranscriptionSegment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      speaker,
      text,
      timestamp: Date.now(),
      confidence: 0.85 + Math.random() * 0.15, // Mock confidence 85-100%
      isPartial: false
    };

    conversation.segments.push(segment);
    conversation.lastActivity = Date.now();

    // Trigger custom event for real-time updates
    window.dispatchEvent(new CustomEvent('transcription-update', {
      detail: { sessionId, segment, conversation }
    }));
  }

  // Start mock conversation simulation
  startMockSimulation(sessionId: string): void {
    if (this.simulationInterval) return;

    let isCustomerTurn = true;
    let turnCount = 0;
    const maxTurns = 24; // 12 exchanges

    this.simulationInterval = window.setInterval(() => {
      if (turnCount >= maxTurns) {
        this.stopMockSimulation();
        return;
      }

      const speaker = isCustomerTurn ? 'customer' : 'agent';
      const responses = this.mockResponses[speaker];
      const currentIndex = this.currentMockIndex[speaker];

      if (currentIndex < responses.length) {
        this.addMockSegment(sessionId, speaker, responses[currentIndex]);
        this.currentMockIndex[speaker]++;
      }

      isCustomerTurn = !isCustomerTurn;
      turnCount++;
    }, 3000 + Math.random() * 2000); // Random interval 3-5 seconds
  }

  stopMockSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  private resetMockIndices(): void {
    this.currentMockIndex = { customer: 0, agent: 0 };
  }

  // Subscribe to transcription updates
  onTranscriptionUpdate(callback: (data: { sessionId: string; segment: TranscriptionSegment; conversation: ConversationHistory }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('transcription-update', handler as EventListener);
    
    return () => {
      window.removeEventListener('transcription-update', handler as EventListener);
    };
  }

  // Simulate real-time partial transcription (for future enhancement)
  simulatePartialTranscription(sessionId: string, speaker: 'agent' | 'customer', partialText: string): void {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return;

    // Remove previous partial segment if exists
    const lastSegment = conversation.segments[conversation.segments.length - 1];
    if (lastSegment && lastSegment.isPartial && lastSegment.speaker === speaker) {
      conversation.segments.pop();
    }

    // Add new partial segment
    const segment: TranscriptionSegment = {
      id: `partial-${Date.now()}`,
      speaker,
      text: partialText,
      timestamp: Date.now(),
      confidence: 0.6 + Math.random() * 0.2, // Lower confidence for partial
      isPartial: true
    };

    conversation.segments.push(segment);

    window.dispatchEvent(new CustomEvent('transcription-update', {
      detail: { sessionId, segment, conversation }
    }));
  }

  // Get conversation summary for AI analysis
  getConversationSummary(sessionId: string): {
    totalSegments: number;
    duration: number;
    customerMessages: number;
    agentMessages: number;
    lastCustomerMessage?: string;
    lastAgentMessage?: string;
  } | null {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) return null;

    const customerSegments = conversation.segments.filter(s => s.speaker === 'customer' && !s.isPartial);
    const agentSegments = conversation.segments.filter(s => s.speaker === 'agent' && !s.isPartial);

    return {
      totalSegments: conversation.segments.length,
      duration: Date.now() - conversation.startTime,
      customerMessages: customerSegments.length,
      agentMessages: agentSegments.length,
      lastCustomerMessage: customerSegments[customerSegments.length - 1]?.text,
      lastAgentMessage: agentSegments[agentSegments.length - 1]?.text
    };
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService();
