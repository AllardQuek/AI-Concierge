// Enhanced AI Analysis Service for Real-time Conversation Insights
// This service processes transcription data to provide intelligent insights

import { type TranscriptionSegment, type ConversationHistory } from './transcription';

export interface ConversationInsight {
  type: 'sentiment' | 'intent' | 'action_required' | 'escalation' | 'summary';
  severity: 'low' | 'medium' | 'high';
  message: string;
  confidence: number;
  timestamp: number;
  triggerSegment?: string; // The transcription segment that triggered this insight
}

export interface ConversationMetrics {
  duration: number;
  wordCount: number;
  speakerBalance: {
    agent: number;
    customer: number;
  };
  averageResponseTime: number;
  sentimentTrend: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
}

export interface AIAnalysisResult {
  insights: ConversationInsight[];
  metrics: ConversationMetrics;
  recommendations: string[];
  nextActions: string[];
}

class AIAnalysisService {
  private insights: ConversationInsight[] = [];
  private lastAnalyzedSegment = 0;

  // Mock AI analysis - in production this would connect to actual LLM/AI services
  analyzeConversation(conversation: ConversationHistory): AIAnalysisResult {
    const newSegments = conversation.segments.slice(this.lastAnalyzedSegment);
    this.lastAnalyzedSegment = conversation.segments.length;

    // Process new segments for insights
    const newInsights = this.extractInsights(newSegments, conversation);
    this.insights.push(...newInsights);

    // Calculate metrics
    const metrics = this.calculateMetrics(conversation);

    // Generate recommendations
    const recommendations = this.generateRecommendations(conversation, this.insights);
    const nextActions = this.generateNextActions(conversation, this.insights);

    return {
      insights: this.insights.slice(-10), // Keep last 10 insights
      metrics,
      recommendations,
      nextActions
    };
  }

  private extractInsights(segments: TranscriptionSegment[], conversation: ConversationHistory): ConversationInsight[] {
    const insights: ConversationInsight[] = [];

    for (const segment of segments) {
      // Sentiment analysis (mock)
      const sentiment = this.analyzeSentiment(segment.text);
      if (sentiment.confidence > 0.7) {
        insights.push({
          type: 'sentiment',
          severity: sentiment.severity,
          message: `${sentiment.sentiment} sentiment detected: "${segment.text.substring(0, 50)}..."`,
          confidence: sentiment.confidence,
          timestamp: segment.timestamp,
          triggerSegment: segment.text
        });
      }

      // Intent detection (mock)
      const intent = this.detectIntent(segment.text);
      if (intent.confidence > 0.6) {
        insights.push({
          type: 'intent',
          severity: intent.severity,
          message: `Customer intent: ${intent.intent}`,
          confidence: intent.confidence,
          timestamp: segment.timestamp,
          triggerSegment: segment.text
        });
      }

      // Action required detection
      if (this.requiresAction(segment.text)) {
        insights.push({
          type: 'action_required',
          severity: 'high',
          message: 'Customer request requires follow-up action',
          confidence: 0.8,
          timestamp: segment.timestamp,
          triggerSegment: segment.text
        });
      }

      // Escalation detection
      if (this.shouldEscalate(segment.text, conversation)) {
        insights.push({
          type: 'escalation',
          severity: 'high',
          message: 'Consider escalating to supervisor',
          confidence: 0.9,
          timestamp: segment.timestamp,
          triggerSegment: segment.text
        });
      }
    }

    return insights;
  }

  private analyzeSentiment(text: string): { sentiment: string; confidence: number; severity: 'low' | 'medium' | 'high' } {
    // Mock sentiment analysis - replace with actual AI service
    const lowerText = text.toLowerCase();
    
    // Negative sentiment keywords
    const negativeWords = ['frustrated', 'angry', 'upset', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'mad', 'annoyed'];
    const positiveWords = ['great', 'excellent', 'wonderful', 'amazing', 'perfect', 'love', 'fantastic', 'awesome', 'happy', 'satisfied'];
    
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;

    if (negativeCount > positiveCount && negativeCount > 0) {
      return {
        sentiment: 'negative',
        confidence: Math.min(0.9, 0.6 + (negativeCount * 0.1)),
        severity: negativeCount > 2 ? 'high' : 'medium'
      };
    } else if (positiveCount > negativeCount && positiveCount > 0) {
      return {
        sentiment: 'positive',
        confidence: Math.min(0.9, 0.6 + (positiveCount * 0.1)),
        severity: 'low'
      };
    }

    return { sentiment: 'neutral', confidence: 0.3, severity: 'low' };
  }

  private detectIntent(text: string): { intent: string; confidence: number; severity: 'low' | 'medium' | 'high' } {
    // Mock intent detection - replace with actual NLU service
    const lowerText = text.toLowerCase();

    const intents = [
      { pattern: /cancel|refund|return/, intent: 'cancellation', severity: 'high' as const },
      { pattern: /help|support|assist/, intent: 'support_request', severity: 'medium' as const },
      { pattern: /buy|purchase|order/, intent: 'purchase', severity: 'medium' as const },
      { pattern: /complain|problem|issue/, intent: 'complaint', severity: 'high' as const },
      { pattern: /thank|appreciate|grateful/, intent: 'gratitude', severity: 'low' as const },
      { pattern: /question|ask|wonder/, intent: 'inquiry', severity: 'low' as const },
    ];

    for (const { pattern, intent, severity } of intents) {
      if (pattern.test(lowerText)) {
        return {
          intent,
          confidence: 0.7 + Math.random() * 0.2, // Mock confidence
          severity
        };
      }
    }

    return { intent: 'general', confidence: 0.3, severity: 'low' };
  }

  private requiresAction(text: string): boolean {
    // Mock action detection
    const actionWords = ['need', 'want', 'can you', 'could you', 'please', 'help me', 'send me', 'give me'];
    return actionWords.some(word => text.toLowerCase().includes(word));
  }

  private shouldEscalate(text: string, conversation: ConversationHistory): boolean {
    // Mock escalation logic
    const escalationTriggers = ['supervisor', 'manager', 'unacceptable', 'lawyer', 'sue', 'complaint'];
    const hasEscalationKeyword = escalationTriggers.some(word => text.toLowerCase().includes(word));
    
    // Also check if conversation is getting long (potential frustration)
    const longConversation = conversation.segments.length > 20;
    
    return hasEscalationKeyword || longConversation;
  }

  private calculateMetrics(conversation: ConversationHistory): ConversationMetrics {
    const now = Date.now();
    const duration = now - conversation.startTime;
    
    const agentSegments = conversation.segments.filter(s => s.speaker === 'agent');
    const customerSegments = conversation.segments.filter(s => s.speaker === 'customer');
    
    const totalWords = conversation.segments.reduce((sum, segment) => 
      sum + segment.text.split(' ').length, 0
    );
    
    const agentWords = agentSegments.reduce((sum, segment) => 
      sum + segment.text.split(' ').length, 0
    );
    
    const customerWords = customerSegments.reduce((sum, segment) => 
      sum + segment.text.split(' ').length, 0
    );

    // Calculate average response time (mock)
    let totalResponseTime = 0;
    let responseCount = 0;
    for (let i = 1; i < conversation.segments.length; i++) {
      const prev = conversation.segments[i - 1];
      const current = conversation.segments[i];
      if (prev.speaker !== current.speaker) {
        totalResponseTime += current.timestamp - prev.timestamp;
        responseCount++;
      }
    }

    // Extract key topics (mock)
    const allText = conversation.segments.map(s => s.text).join(' ').toLowerCase();
    const commonWords = ['account', 'order', 'payment', 'delivery', 'product', 'service', 'issue', 'problem'];
    const keyTopics = commonWords.filter(word => allText.includes(word));

    return {
      duration,
      wordCount: totalWords,
      speakerBalance: {
        agent: agentWords,
        customer: customerWords
      },
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      sentimentTrend: this.calculateOverallSentiment(conversation),
      keyTopics: keyTopics.slice(0, 5)
    };
  }

  private calculateOverallSentiment(conversation: ConversationHistory): 'positive' | 'neutral' | 'negative' {
    // Mock overall sentiment calculation
    const recentSegments = conversation.segments.slice(-5); // Last 5 segments
    let positiveCount = 0;
    let negativeCount = 0;

    for (const segment of recentSegments) {
      const sentiment = this.analyzeSentiment(segment.text);
      if (sentiment.sentiment === 'positive') positiveCount++;
      if (sentiment.sentiment === 'negative') negativeCount++;
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private generateRecommendations(conversation: ConversationHistory, insights: ConversationInsight[]): string[] {
    const recommendations: string[] = [];

    // Check for recent negative sentiment
    const recentNegative = insights.filter(i => 
      i.type === 'sentiment' && 
      i.message.includes('negative') && 
      Date.now() - i.timestamp < 30000 // Last 30 seconds
    );

    if (recentNegative.length > 0) {
      recommendations.push("🎯 Address customer concerns with empathy and active listening");
      recommendations.push("💡 Offer specific solutions or alternatives");
    }

    // Check for escalation indicators
    const escalationWarnings = insights.filter(i => i.type === 'escalation');
    if (escalationWarnings.length > 0) {
      recommendations.push("⚠️ Consider transferring to a supervisor or specialist");
      recommendations.push("🤝 Use de-escalation techniques and acknowledge concerns");
    }

    // Check conversation balance
    const metrics = this.calculateMetrics(conversation);
    if (metrics.speakerBalance.agent > metrics.speakerBalance.customer * 2) {
      recommendations.push("🗣️ Allow more customer input - ask open-ended questions");
    } else if (metrics.speakerBalance.customer > metrics.speakerBalance.agent * 2) {
      recommendations.push("💬 Provide more guidance and structure to the conversation");
    }

    return recommendations.slice(0, 3); // Max 3 recommendations
  }

  private generateNextActions(_conversation: ConversationHistory, insights: ConversationInsight[]): string[] {
    const actions: string[] = [];

    // Check for action-required insights
    const actionInsights = insights.filter(i => i.type === 'action_required');
    if (actionInsights.length > 0) {
      actions.push("📋 Document customer request for follow-up");
      actions.push("✅ Confirm next steps with customer");
    }

    // Check for purchase intent
    const purchaseIntent = insights.find(i => 
      i.type === 'intent' && i.message.includes('purchase')
    );
    if (purchaseIntent) {
      actions.push("💳 Guide customer through purchase process");
      actions.push("📞 Offer additional products or services");
    }

    // Check for support requests
    const supportIntent = insights.find(i => 
      i.type === 'intent' && i.message.includes('support')
    );
    if (supportIntent) {
      actions.push("🛠️ Provide technical assistance or troubleshooting");
      actions.push("📚 Share relevant documentation or resources");
    }

    return actions.slice(0, 3); // Max 3 actions
  }

  // Reset insights for new conversation
  reset(): void {
    this.insights = [];
    this.lastAnalyzedSegment = 0;
  }

  // Get current insights for external access
  getCurrentInsights(): ConversationInsight[] {
    return [...this.insights];
  }
}

export const aiAnalysisService = new AIAnalysisService();
