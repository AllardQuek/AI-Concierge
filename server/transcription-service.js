const fs = require('fs').promises;
const path = require('path');

class TranscriptionService {
  constructor(io) {
    this.io = io;
    this.conversations = new Map(); // conversationId -> ConversationSession
    this.transcriptionProviders = {
      // Free tier options for POC
      // webSpeech: this.createWebSpeechProvider(),
      // Add more providers as needed
    };
    
    this.setupSocketIOHandlers();
    this.setupTranscriptionStorage();
  }

  setupSocketIOHandlers() {
    // This will be called from the main Socket.IO connection handler
    console.log('🎤 Transcription service initialized with Socket.IO');
  }

  // Method to handle transcription events from Socket.IO
  handleTranscriptionEvent(socket, eventType, data) {
    switch (eventType) {
      case 'audio-chunk':
        this.handleAudioChunk(socket, data);
        break;
      
      case 'start-conversation':
        this.startConversation(socket, data);
        break;
      
      case 'end-conversation':
        this.endConversation(socket, data);
        break;
      
      default:
        console.log('Unknown transcription event type:', eventType);
    }
  }



  async handleAudioChunk(socket, data) {
    const { conversationId, participantId, timestamp, audioData, audioLevel } = data;
    
    // Get or create conversation session
    let session = this.conversations.get(conversationId);
    if (!session) {
      session = this.createConversationSession(conversationId);
      this.conversations.set(conversationId, session);
    }

    // Add audio chunk to session
    session.addAudioChunk({
      participantId,
      timestamp,
      audioData: Buffer.from(audioData, 'base64'),
      audioLevel
    });

    // Process audio if we have enough data
    if (session.shouldProcessAudio()) {
      await this.processConversationAudio(session);
    }
  }

  createConversationSession(conversationId) {
    return {
      id: conversationId,
      participants: new Set(),
      audioChunks: [],
      transcripts: [],
      startTime: Date.now(),
      lastProcessedTime: 0,
      
      addAudioChunk(chunk) {
        this.audioChunks.push(chunk);
        this.participants.add(chunk.participantId);
        
        // Keep only recent chunks (last 10 seconds)
        const cutoff = Date.now() - 10000;
        this.audioChunks = this.audioChunks.filter(chunk => chunk.timestamp > cutoff);
      },
      
      shouldProcessAudio() {
        // Process every 2 seconds or when we have significant audio activity
        const timeSinceLastProcess = Date.now() - this.lastProcessedTime;
        const hasRecentAudio = this.audioChunks.some(chunk => 
          Date.now() - chunk.timestamp < 3000 && chunk.audioLevel > 0.01
        );
        
        return timeSinceLastProcess > 2000 && hasRecentAudio;
      },
      
      getRecentAudioChunks(durationMs = 5000) {
        const cutoff = Date.now() - durationMs;
        return this.audioChunks.filter(chunk => chunk.timestamp > cutoff);
      }
    };
  }

  async processConversationAudio(session) {
    try {
      session.lastProcessedTime = Date.now();
      
      // Get recent audio chunks
      const recentChunks = session.getRecentAudioChunks();
      if (recentChunks.length === 0) return;

      // Group chunks by participant
      const participantChunks = this.groupChunksByParticipant(recentChunks);
      
      // Process each participant's audio
      for (const [participantId, chunks] of Object.entries(participantChunks)) {
        if (chunks.length > 0) {
          await this.transcribeParticipantAudio(session, participantId, chunks);
        }
      }
      
    } catch (error) {
      console.error('Error processing conversation audio:', error);
    }
  }

  groupChunksByParticipant(chunks) {
    const grouped = {};
    for (const chunk of chunks) {
      if (!grouped[chunk.participantId]) {
        grouped[chunk.participantId] = [];
      }
      grouped[chunk.participantId].push(chunk);
    }
    return grouped;
  }

  async transcribeParticipantAudio(session, participantId, chunks) {
    try {
      // Combine audio chunks into a single buffer
      const audioBuffer = this.combineAudioChunks(chunks);
      
      // Use Web Speech API for free transcription (client-side)
      // For server-side, we'll use a simple approach for POC
      const transcript = await this.transcribeAudio(audioBuffer, participantId);
      
      if (transcript && transcript.text.trim()) {
        const transcriptionResult = {
          id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: transcript.text,
          speaker: this.mapParticipantToSpeaker(participantId),
          timestamp: Date.now(),
          confidence: transcript.confidence || 0.8,
          isFinal: true
        };
        
        // Store transcript
        session.transcripts.push(transcriptionResult);
        
        // Send to all clients in this conversation
        this.broadcastToConversation(session.id, {
          type: 'transcription',
          result: transcriptionResult
        });
        
        // Save to storage
        await this.saveTranscript(session.id, transcriptionResult);
        
        console.log(`📝 [${session.id}] ${transcriptionResult.speaker}: ${transcriptionResult.text}`);
      }
      
    } catch (error) {
      console.error('Error transcribing participant audio:', error);
    }
  }

  combineAudioChunks(chunks) {
    // Simple concatenation for POC
    // In production, you'd want proper audio format handling
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.audioData.length, 0);
    const combined = Buffer.alloc(totalLength);
    
    let offset = 0;
    for (const chunk of chunks) {
      chunk.audioData.copy(combined, offset);
      offset += chunk.audioData.length;
    }
    
    return combined;
  }

  async transcribeAudio(audioBuffer, participantId) {
    // For POC, we'll use a simple approach
    // In production, integrate with OpenAI Whisper, Azure Speech, or similar
    
    // Simulate transcription for demo purposes
    // Replace this with actual transcription service
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock transcription - replace with real service
        const mockTranscripts = [
          "Hello, how are you today?",
          "I'm calling about the project",
          "Can you help me with this?",
          "Thank you for your time",
          "Let's schedule a meeting"
        ];
        
        const randomText = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        
        resolve({
          text: randomText,
          confidence: 0.85 + Math.random() * 0.15
        });
      }, 500); // Simulate processing time
    });
  }

  mapParticipantToSpeaker(participantId) {
    // Map participant IDs to speaker labels (A, B)
    // You can customize this based on your participant naming
    return participantId.includes('A') ? 'A' : 'B';
  }

  broadcastToConversation(conversationId, message) {
    // Use Socket.IO to broadcast to all clients in the conversation room
    this.io.to(`transcription-${conversationId}`).emit('transcription', message);
  }

  sendError(socket, message) {
    socket.emit('transcription-error', { message });
  }

  cleanupClientConnections(socket) {
    // Clean up any conversation references
    this.conversations.forEach((session, conversationId) => {
      // Remove disconnected clients from conversation
    });
  }

  async startConversation(socket, data) {
    const { conversationId } = data;
    socket.conversationId = conversationId;
    
    // Join the transcription room for this conversation
    socket.join(`transcription-${conversationId}`);
    
    console.log(`🎬 Started transcription for conversation: ${conversationId}`);
  }

  async endConversation(socket, data) {
    const { conversationId } = data;
    
    // Leave the transcription room
    socket.leave(`transcription-${conversationId}`);
    
    // Save final transcript
    const session = this.conversations.get(conversationId);
    if (session) {
      await this.saveConversationTranscript(session);
      this.conversations.delete(conversationId);
    }
    
    console.log(`🏁 Ended transcription for conversation: ${conversationId}`);
  }

  setupTranscriptionStorage() {
    // Create transcripts directory if it doesn't exist
    this.transcriptsDir = path.join(__dirname, 'transcripts');
    this.ensureTranscriptsDirectory();
  }

  async ensureTranscriptsDirectory() {
    try {
      await fs.access(this.transcriptsDir);
    } catch {
      await fs.mkdir(this.transcriptsDir, { recursive: true });
    }
  }

  async saveTranscript(conversationId, transcript) {
    try {
      const filePath = path.join(this.transcriptsDir, `${conversationId}.json`);
      
      // Load existing transcripts or create new file
      let transcripts = [];
      try {
        const existingData = await fs.readFile(filePath, 'utf8');
        transcripts = JSON.parse(existingData);
      } catch {
        // File doesn't exist, start with empty array
      }
      
      // Add new transcript
      transcripts.push(transcript);
      
      // Save back to file
      await fs.writeFile(filePath, JSON.stringify(transcripts, null, 2));
      
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  }

  async saveConversationTranscript(session) {
    try {
      const filePath = path.join(this.transcriptsDir, `${session.id}-complete.json`);
      
      const conversationData = {
        id: session.id,
        startTime: session.startTime,
        endTime: Date.now(),
        participants: Array.from(session.participants),
        transcripts: session.transcripts,
        summary: this.generateConversationSummary(session.transcripts)
      };
      
      await fs.writeFile(filePath, JSON.stringify(conversationData, null, 2));
      console.log(`💾 Saved complete transcript for conversation: ${session.id}`);
      
    } catch (error) {
      console.error('Error saving conversation transcript:', error);
    }
  }

  generateConversationSummary(transcripts) {
    const speakerA = transcripts.filter(t => t.speaker === 'A');
    const speakerB = transcripts.filter(t => t.speaker === 'B');
    
    return {
      totalExchanges: transcripts.length,
      speakerAExchanges: speakerA.length,
      speakerBExchanges: speakerB.length,
      duration: transcripts.length > 0 ? 
        transcripts[transcripts.length - 1].timestamp - transcripts[0].timestamp : 0,
      averageConfidence: transcripts.reduce((sum, t) => sum + t.confidence, 0) / transcripts.length
    };
  }

  // Get conversation transcripts
  async getConversationTranscripts(conversationId) {
    try {
      const filePath = path.join(this.transcriptsDir, `${conversationId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  // Get all conversation summaries
  async getAllConversationSummaries() {
    try {
      const files = await fs.readdir(this.transcriptsDir);
      const summaries = [];
      
      for (const file of files) {
        if (file.endsWith('-complete.json')) {
          const filePath = path.join(this.transcriptsDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const conversation = JSON.parse(data);
          summaries.push({
            id: conversation.id,
            startTime: conversation.startTime,
            endTime: conversation.endTime,
            participants: conversation.participants,
            summary: conversation.summary
          });
        }
      }
      
      return summaries;
    } catch (error) {
      console.error('Error getting conversation summaries:', error);
      return [];
    }
  }
}

module.exports = TranscriptionService; 