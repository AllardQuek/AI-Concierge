// Server-side AI Service for Sybil
// Handles AI processing pipeline and external service integrations

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { OpenAI } = require('openai');
const WebSocket = require('ws');

class SybilAIServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.activeSessions = new Map();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupRoutes() {
    this.app.use(express.json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // AI processing endpoint
    this.app.post('/api/process-text', async (req, res) => {
      try {
        const { text, speaker, sessionId } = req.body;
        const analysis = await this.processText(text, speaker, sessionId);
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get conversation insights
    this.app.get('/api/insights/:sessionId', (req, res) => {
      const sessionId = req.params.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        insights: session.insights,
        context: session.context,
        metrics: session.metrics
      });
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('AI service client connected:', socket.id);

      // Initialize AI session
      socket.on('ai-session-start', async (data) => {
        const { sessionId, customerName, agentId } = data;
        
        const session = {
          sessionId,
          customerName,
          agentId,
          socketId: socket.id,
          insights: [],
          context: {
            emotionalState: 'neutral',
            currentTopic: null,
            issues: [],
            resolutionStatus: 'in-progress'
          },
          metrics: {
            totalExchanges: 0,
            avgSentiment: 0,
            topKeywords: [],
            callDuration: 0
          },
          startTime: Date.now()
        };
        
        this.activeSessions.set(sessionId, session);
        socket.join(`ai-${sessionId}`);
        
        socket.emit('ai-session-ready', { sessionId });
      });

      // Process real-time transcription
      socket.on('transcription', async (data) => {
        try {
          const { sessionId, text, speaker, timestamp, confidence } = data;
          const session = this.activeSessions.get(sessionId);
          
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          // Process the transcription
          const insight = await this.processTranscription(text, speaker, session);
          
          // Store insight
          session.insights.push(insight);
          session.metrics.totalExchanges++;
          
          // Generate actions if needed
          const actions = await this.generateActions(insight, session);
          
          // Emit insights to agent dashboard
          this.io.to(`ai-${sessionId}`).emit('ai-insight', {
            insight,
            actions,
            context: session.context
          });
          
          // Update session metrics
          this.updateSessionMetrics(session, insight);
          
        } catch (error) {
          console.error('Error processing transcription:', error);
          socket.emit('error', { message: 'Failed to process transcription' });
        }
      });

      // Handle action approval/execution
      socket.on('execute-action', async (data) => {
        try {
          const { sessionId, actionId, approved } = data;
          const session = this.activeSessions.get(sessionId);
          
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          if (approved) {
            const result = await this.executeAction(actionId, session);
            socket.emit('action-executed', { actionId, result });
          } else {
            socket.emit('action-declined', { actionId });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to execute action' });
        }
      });

      // End AI session
      socket.on('ai-session-end', (data) => {
        const { sessionId } = data;
        const session = this.activeSessions.get(sessionId);
        
        if (session) {
          session.endTime = Date.now();
          session.metrics.callDuration = session.endTime - session.startTime;
          
          // Store session data for analytics
          this.storeSessionData(session);
          
          // Clean up
          this.activeSessions.delete(sessionId);
          socket.leave(`ai-${sessionId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log('AI service client disconnected:', socket.id);
        // Clean up any sessions associated with this socket
        this.cleanupDisconnectedSocket(socket.id);
      });
    });
  }

  async processTranscription(text, speaker, session) {
    // Parallel processing for speed
    const [sentiment, entities, intent] = await Promise.all([
      this.analyzeSentiment(text),
      this.extractEntities(text),
      this.detectIntent(text, speaker)
    ]);

    const insight = {
      id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      speaker,
      text,
      sentiment: sentiment.label,
      confidence: sentiment.confidence,
      entities,
      intent,
      processed: true
    };

    // Update conversation context
    this.updateConversationContext(session, insight);

    return insight;
  }

  async analyzeSentiment(text) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze sentiment. Respond with JSON: {\"label\": \"positive|negative|neutral\", \"confidence\": 0.95, \"reasoning\": \"brief explanation\"}"
          },
          { role: "user", content: text }
        ],
        max_tokens: 100,
        temperature: 0
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return { label: 'neutral', confidence: 0.5, reasoning: 'Error in analysis' };
    }
  }

  async extractEntities(text) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract entities as JSON array: [{\"type\": \"person|product|issue|location|organization|date|number\", \"value\": \"text\", \"confidence\": 0.9}]"
          },
          { role: "user", content: text }
        ],
        max_tokens: 200,
        temperature: 0
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Entity extraction error:', error);
      return [];
    }
  }

  async detectIntent(text, speaker) {
    if (speaker === 'agent') return null; // Only analyze customer intent
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Detect customer intent. Respond with JSON: {\"intent\": \"complaint|question|request|compliment|cancellation|technical_support\", \"confidence\": 0.9}"
          },
          { role: "user", content: text }
        ],
        max_tokens: 50,
        temperature: 0
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Intent detection error:', error);
      return null;
    }
  }

  updateConversationContext(session, insight) {
    // Update emotional state
    if (insight.speaker === 'customer') {
      if (insight.sentiment === 'negative') {
        session.context.emotionalState = 'frustrated';
      } else if (insight.sentiment === 'positive') {
        session.context.emotionalState = 'satisfied';
      }
    }

    // Extract current topic from entities
    const topicEntities = insight.entities.filter(e => 
      ['product', 'issue', 'organization'].includes(e.type)
    );
    if (topicEntities.length > 0) {
      session.context.currentTopic = topicEntities[0].value;
    }

    // Track issues
    if (insight.intent && insight.intent.intent === 'complaint') {
      const issueEntities = insight.entities.filter(e => e.type === 'issue');
      issueEntities.forEach(entity => {
        if (!session.context.issues.includes(entity.value)) {
          session.context.issues.push(entity.value);
        }
      });
    }
  }

  async generateActions(insight, session) {
    const actions = [];

    // Sentiment-based actions
    if (insight.sentiment === 'negative' && session.context.emotionalState === 'frustrated') {
      actions.push({
        id: `escalation-${Date.now()}`,
        type: 'escalation',
        priority: 'high',
        title: 'Consider Escalation',
        description: 'Customer appears frustrated. Consider escalating to supervisor.',
        requiresApproval: true,
        suggestedResponse: "I understand your frustration. Let me connect you with a supervisor who can better assist you."
      });
    }

    // Intent-based actions
    if (insight.intent && insight.intent.intent === 'cancellation') {
      actions.push({
        id: `retention-${Date.now()}`,
        type: 'retention',
        priority: 'high',
        title: 'Retention Opportunity',
        description: 'Customer mentioned cancellation. Offer retention options.',
        requiresApproval: false,
        suggestedResponse: "Before we proceed with cancellation, let me see what options we have to address your concerns."
      });
    }

    // Entity-based knowledge lookup
    const productEntities = insight.entities.filter(e => e.type === 'product');
    if (productEntities.length > 0) {
      const knowledgeArticles = await this.searchKnowledgeBase(productEntities[0].value);
      if (knowledgeArticles.length > 0) {
        actions.push({
          id: `knowledge-${Date.now()}`,
          type: 'knowledge_lookup',
          priority: 'medium',
          title: `Product Info: ${productEntities[0].value}`,
          description: `Found ${knowledgeArticles.length} relevant articles`,
          requiresApproval: false,
          payload: { articles: knowledgeArticles }
        });
      }
    }

    // Compliance monitoring
    const complianceKeywords = ['legal', 'lawsuit', 'attorney', 'discrimination', 'harassment'];
    if (complianceKeywords.some(keyword => insight.text.toLowerCase().includes(keyword))) {
      actions.push({
        id: `compliance-${Date.now()}`,
        type: 'compliance_alert',
        priority: 'high',
        title: 'Compliance Alert',
        description: 'Potential compliance issue detected. Review conversation.',
        requiresApproval: true
      });
    }

    return actions;
  }

  async searchKnowledgeBase(query) {
    // Mock knowledge base search
    // In production, this would connect to your actual knowledge base
    const mockArticles = [
      {
        title: `How to troubleshoot ${query}`,
        url: `/kb/troubleshoot-${query.toLowerCase()}`,
        summary: `Common troubleshooting steps for ${query} issues`
      },
      {
        title: `${query} User Guide`,
        url: `/kb/guide-${query.toLowerCase()}`,
        summary: `Complete user guide for ${query}`
      }
    ];
    
    return mockArticles;
  }

  async executeAction(actionId, session) {
    // Mock action execution
    // In production, this would integrate with external systems
    console.log(`Executing action ${actionId} for session ${session.sessionId}`);
    return { success: true, executedAt: Date.now() };
  }

  updateSessionMetrics(session, insight) {
    // Update average sentiment
    const sentimentScore = insight.sentiment === 'positive' ? 1 : 
                          insight.sentiment === 'negative' ? -1 : 0;
    session.metrics.avgSentiment = 
      (session.metrics.avgSentiment * (session.metrics.totalExchanges - 1) + sentimentScore) / 
      session.metrics.totalExchanges;

    // Update top keywords
    const words = insight.text.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    words.forEach(word => {
      const existing = session.metrics.topKeywords.find(k => k.word === word);
      if (existing) {
        existing.count++;
      } else {
        session.metrics.topKeywords.push({ word, count: 1 });
      }
    });

    // Keep only top 10 keywords
    session.metrics.topKeywords.sort((a, b) => b.count - a.count);
    session.metrics.topKeywords = session.metrics.topKeywords.slice(0, 10);
  }

  storeSessionData(session) {
    // In production, store to database for analytics
    console.log(`Storing session data for ${session.sessionId}:`, {
      duration: session.metrics.callDuration,
      totalExchanges: session.metrics.totalExchanges,
      avgSentiment: session.metrics.avgSentiment,
      resolutionStatus: session.context.resolutionStatus,
      issues: session.context.issues
    });
  }

  cleanupDisconnectedSocket(socketId) {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.socketId === socketId) {
        console.log(`Cleaning up session ${sessionId} for disconnected socket ${socketId}`);
        this.activeSessions.delete(sessionId);
        break;
      }
    }
  }

  start(port = 5001) {
    this.server.listen(port, () => {
      console.log(`Sybil AI Service running on port ${port}`);
    });
  }
}

module.exports = SybilAIServer;

// Start the server if this file is run directly
if (require.main === module) {
  const aiServer = new SybilAIServer();
  aiServer.start(process.env.AI_PORT || 5001);
}
