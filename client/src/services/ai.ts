// AI Service Architecture for Sybil
// This service will run parallel to WebRTC for real-time conversation analysis

import { EventEmitter } from 'events';

export interface ConversationInsight {
  timestamp: number;
  speaker: 'customer' | 'agent';
  text: string;
  confidence: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  intent?: string;
  entities?: { type: string; value: string; confidence: number }[];
  suggestedActions?: AgentAction[];
}

export interface AgentAction {
  id: string;
  type: 'knowledge_lookup' | 'crm_update' | 'escalation' | 'follow_up' | 'information_request';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  payload?: any;
  requiresApproval: boolean;
}

export interface ConversationContext {
  sessionId: string;
  customerName: string;
  customerHistory?: any[];
  currentTopic?: string;
  emotionalState: 'calm' | 'frustrated' | 'confused' | 'satisfied';
  resolution?: string;
}

export class SybilAIService extends EventEmitter {
  private audioProcessor: AudioProcessor;
  private speechToText: SpeechToTextService;
  private llmProcessor: LLMProcessor;
  private actionEngine: ActionEngine;
  private context: ConversationContext;
  private isActive: boolean = false;

  constructor() {
    super();
    this.audioProcessor = new AudioProcessor();
    this.speechToText = new SpeechToTextService();
    this.llmProcessor = new LLMProcessor();
    this.actionEngine = new ActionEngine();
  }

  async initialize(sessionId: string, customerName: string): Promise<void> {
    this.context = {
      sessionId,
      customerName,
      emotionalState: 'calm'
    };
    
    await this.speechToText.initialize();
    await this.llmProcessor.initialize();
    
    this.setupEventHandlers();
    this.isActive = true;
  }

  // Main method to start processing audio streams
  async startProcessing(customerStream: MediaStream, agentStream: MediaStream): Promise<void> {
    if (!this.isActive) throw new Error('AI Service not initialized');

    // Process customer audio
    this.audioProcessor.processStream(customerStream, 'customer', (audioChunk) => {
      this.speechToText.processAudio(audioChunk, 'customer');
    });

    // Process agent audio
    this.audioProcessor.processStream(agentStream, 'agent', (audioChunk) => {
      this.speechToText.processAudio(audioChunk, 'agent');
    });
  }

  private setupEventHandlers(): void {
    // Handle speech-to-text results
    this.speechToText.on('transcription', async (result: TranscriptionResult) => {
      const insight = await this.processTranscription(result);
      this.emit('insight', insight);
      
      // Update conversation context
      this.updateContext(insight);
      
      // Generate actions if needed
      const actions = await this.actionEngine.generateActions(insight, this.context);
      if (actions.length > 0) {
        this.emit('actions', actions);
      }
    });

    // Handle LLM processing results
    this.llmProcessor.on('analysis', (analysis: LLMAnalysis) => {
      this.emit('analysis', analysis);
    });
  }

  private async processTranscription(result: TranscriptionResult): Promise<ConversationInsight> {
    // Parallel processing for speed
    const [sentiment, entities] = await Promise.all([
      this.llmProcessor.analyzeSentiment(result.text),
      this.llmProcessor.extractEntities(result.text)
    ]);

    const insight: ConversationInsight = {
      timestamp: result.timestamp,
      speaker: result.speaker,
      text: result.text,
      confidence: result.confidence,
      sentiment: sentiment.label,
      entities: entities
    };

    return insight;
  }

  private updateContext(insight: ConversationInsight): void {
    // Update emotional state based on sentiment
    if (insight.sentiment === 'negative') {
      this.context.emotionalState = 'frustrated';
    } else if (insight.sentiment === 'positive') {
      this.context.emotionalState = 'satisfied';
    }

    // Extract and update current topic
    const topicEntities = insight.entities?.filter(e => e.type === 'topic');
    if (topicEntities && topicEntities.length > 0) {
      this.context.currentTopic = topicEntities[0].value;
    }
  }

  async cleanup(): Promise<void> {
    this.isActive = false;
    await this.audioProcessor.stop();
    await this.speechToText.cleanup();
    await this.llmProcessor.cleanup();
  }
}

// Audio processing with minimal latency
class AudioProcessor {
  private audioContext: AudioContext;
  private processors: Map<string, AudioWorkletNode> = new Map();

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
  }

  async processStream(
    stream: MediaStream, 
    speaker: 'customer' | 'agent',
    onAudioChunk: (chunk: Float32Array) => void
  ): Promise<void> {
    const source = this.audioContext.createMediaStreamSource(stream);
    
    // Use AudioWorklet for low-latency processing
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');
    const processor = new AudioWorkletNode(this.audioContext, 'audio-processor', {
      processorOptions: { 
        chunkSize: 4000, // 250ms at 16kHz
        speaker 
      }
    });

    processor.port.onmessage = (event) => {
      if (event.data.type === 'audio-chunk') {
        onAudioChunk(event.data.chunk);
      }
    };

    source.connect(processor);
    this.processors.set(speaker, processor);
  }

  async stop(): Promise<void> {
    this.processors.forEach(processor => processor.disconnect());
    this.processors.clear();
    await this.audioContext.close();
  }
}

// Real-time speech-to-text with streaming
class SpeechToTextService extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private config = {
    provider: 'azure', // or 'openai'
    language: 'en-US',
    enableSpeakerDiarization: true,
    interimResults: true
  };

  async initialize(): Promise<void> {
    // Initialize speech service connections
  }

  async processAudio(audioChunk: Float32Array, speaker: 'customer' | 'agent'): Promise<void> {
    const connection = this.connections.get(speaker);
    if (!connection || connection.readyState !== WebSocket.OPEN) {
      await this.createConnection(speaker);
    }

    // Convert to appropriate format and send
    const audioData = this.convertAudioFormat(audioChunk);
    this.connections.get(speaker)?.send(audioData);
  }

  private async createConnection(speaker: string): Promise<void> {
    const ws = new WebSocket(this.getSTTWebSocketURL());
    
    ws.onmessage = (event) => {
      const result = JSON.parse(event.data);
      if (result.RecognitionStatus === 'Success') {
        this.emit('transcription', {
          timestamp: Date.now(),
          speaker,
          text: result.DisplayText,
          confidence: result.Confidence,
          isFinal: result.isFinal
        });
      }
    };

    this.connections.set(speaker, ws);
  }

  private convertAudioFormat(audioChunk: Float32Array): ArrayBuffer {
    // Convert Float32Array to PCM 16-bit
    const buffer = new ArrayBuffer(audioChunk.length * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < audioChunk.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioChunk[i]));
      view.setInt16(i * 2, sample * 0x7FFF, true);
    }
    
    return buffer;
  }

  private getSTTWebSocketURL(): string {
    // Return appropriate WebSocket URL based on provider
    return process.env.AZURE_SPEECH_WEBSOCKET_URL || '';
  }

  async cleanup(): Promise<void> {
    this.connections.forEach(ws => ws.close());
    this.connections.clear();
  }
}

// LLM processing for conversation analysis
class LLMProcessor extends EventEmitter {
  private openaiClient: any; // OpenAI client
  private conversationBuffer: ConversationInsight[] = [];
  private maxBufferSize = 50; // Keep last 50 exchanges

  async initialize(): Promise<void> {
    // Initialize LLM clients
  }

  async analyzeSentiment(text: string): Promise<{ label: string; confidence: number }> {
    // Use a fast sentiment model for real-time analysis
    const response = await this.openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Analyze the sentiment of the following text. Respond with only: positive, negative, or neutral."
        },
        { role: "user", content: text }
      ],
      max_tokens: 10,
      temperature: 0
    });

    return {
      label: response.choices[0].message.content.trim().toLowerCase(),
      confidence: 0.95 // For simplicity, could use more sophisticated scoring
    };
  }

  async extractEntities(text: string): Promise<{ type: string; value: string; confidence: number }[]> {
    // Use NER model or LLM for entity extraction
    const response = await this.openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Extract entities from the text. Return JSON array with format: [{"type": "person|organization|location|product|issue", "value": "entity_text", "confidence": 0.9}]`
        },
        { role: "user", content: text }
      ],
      max_tokens: 200,
      temperature: 0
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch {
      return [];
    }
  }

  async analyzeConversation(insights: ConversationInsight[]): Promise<LLMAnalysis> {
    // Comprehensive conversation analysis
    const conversationText = insights
      .map(i => `${i.speaker}: ${i.text}`)
      .join('\n');

    const response = await this.openaiClient.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant analyzing customer service conversations. Provide insights about:
          1. Main customer issue/intent
          2. Current conversation status
          3. Customer satisfaction level
          4. Recommended next actions for the agent
          5. Any compliance or quality concerns
          
          Respond in JSON format.`
        },
        { role: "user", content: conversationText }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async cleanup(): Promise<void> {
    // Cleanup LLM connections
  }
}

// Action engine for generating agent assistance
class ActionEngine {
  private knowledgeBase: KnowledgeBase;
  private crmService: CRMService;

  constructor() {
    this.knowledgeBase = new KnowledgeBase();
    this.crmService = new CRMService();
  }

  async generateActions(
    insight: ConversationInsight, 
    context: ConversationContext
  ): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];

    // Sentiment-based actions
    if (insight.sentiment === 'negative' && context.emotionalState === 'frustrated') {
      actions.push({
        id: `escalation-${Date.now()}`,
        type: 'escalation',
        priority: 'high',
        title: 'Consider Escalation',
        description: 'Customer appears frustrated. Consider escalating to supervisor.',
        requiresApproval: true
      });
    }

    // Entity-based actions
    const productEntities = insight.entities?.filter(e => e.type === 'product');
    if (productEntities && productEntities.length > 0) {
      const product = productEntities[0].value;
      const knowledgeArticles = await this.knowledgeBase.search(product);
      
      if (knowledgeArticles.length > 0) {
        actions.push({
          id: `knowledge-${Date.now()}`,
          type: 'knowledge_lookup',
          priority: 'medium',
          title: `Product Information: ${product}`,
          description: `Found ${knowledgeArticles.length} relevant articles`,
          payload: { articles: knowledgeArticles },
          requiresApproval: false
        });
      }
    }

    // Intent-based actions
    if (insight.text.toLowerCase().includes('cancel') || insight.text.toLowerCase().includes('refund')) {
      actions.push({
        id: `crm-update-${Date.now()}`,
        type: 'crm_update',
        priority: 'high',
        title: 'Update CRM - Cancellation Request',
        description: 'Customer mentioned cancellation/refund. Update CRM accordingly.',
        payload: { 
          updateType: 'cancellation_request',
          customerName: context.customerName,
          timestamp: insight.timestamp
        },
        requiresApproval: true
      });
    }

    return actions;
  }
}

// Supporting interfaces
interface TranscriptionResult {
  timestamp: number;
  speaker: 'customer' | 'agent';
  text: string;
  confidence: number;
  isFinal: boolean;
}

interface LLMAnalysis {
  mainIssue: string;
  conversationStatus: string;
  customerSatisfaction: number;
  recommendedActions: string[];
  complianceConcerns: string[];
}

class KnowledgeBase {
  async search(query: string): Promise<any[]> {
    // Implement vector search or traditional search
    return [];
  }
}

class CRMService {
  async updateCustomerRecord(customerId: string, update: any): Promise<void> {
    // Implement CRM integration
  }
}

export default SybilAIService;
