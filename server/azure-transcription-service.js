// Azure Speech-to-Text real-time transcription service for Socket.IO
// Usage: require and call attachAzureTranscriptionService(io)

const { SpeechConfig, AudioConfig, SpeechRecognizer } = require('microsoft-cognitiveservices-speech-sdk');
const fs = require('fs').promises;
const path = require('path');

// TODO: Replace with your actual Azure Speech key and region, or load from env
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || 'YOUR_AZURE_SPEECH_KEY';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'YOUR_AZURE_REGION';

// Check if Azure credentials are properly configured
const isAzureConfigured = AZURE_SPEECH_KEY !== 'YOUR_AZURE_SPEECH_KEY' && AZURE_SPEECH_REGION !== 'YOUR_AZURE_REGION';

// Free tier: 5 hours/month = 18,000 seconds
const FREE_TIER_SECONDS = 18000;
let usedSeconds = 0; // In-memory usage tracker (reset on server restart)

// Map of socket.id to recognizer and session info
const sessions = {};

// Conversation management
const conversations = new Map(); // conversationId -> ConversationSession
let transcriptsDir = null;

async function attachAzureTranscriptionService(io) {
  console.log('🔊 Azure transcription service attached to Socket.IO server');
  
  // Initialize storage
  await setupTranscriptionStorage();
  
  io.on('connection', (socket) => {
    console.log(`🔊 Azure transcription: New socket connection ${socket.id}`);
    
    socket.on('start-transcription', () => {
      if (usedSeconds >= FREE_TIER_SECONDS) {
        console.log(`🔊 Azure transcription: Free tier limit reached (${usedSeconds}/${FREE_TIER_SECONDS} seconds)`);
        socket.emit('transcription-error', { message: 'Azure free tier limit reached. Try again next month.' });
        return;
      }
      if (sessions[socket.id]) {
        console.log(`🔊 Azure transcription: Session already exists for ${socket.id}`);
        return; // Already started
      }
      
      // Check if Azure is properly configured
      if (!isAzureConfigured) {
        console.log('🔊 Azure transcription: Azure credentials not configured, sending fallback message');
        socket.emit('transcription-error', { 
          message: 'Transcription service is not configured. Please set up Azure Speech-to-Text credentials.' 
        });
        return;
      }
      
      try {
        const speechConfig = SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
        speechConfig.speechRecognitionLanguage = 'en-US';
      // Use push stream for real-time audio
      const sdk = require('microsoft-cognitiveservices-speech-sdk');
      const pushStream = sdk.AudioInputStream.createPushStream();
      const audioConfig = AudioConfig.fromStreamInput(pushStream);
      const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      sessions[socket.id] = { 
        recognizer, 
        pushStream, 
        startTime: Date.now(), 
        seconds: 0,
        conversationId: null // Will be set when conversation starts
      };
      console.log(`🔊 Azure transcription: Started session for ${socket.id}`);

      recognizer.recognizing = (s, e) => {
        console.log(`🔊 Azure transcription: Partial transcript for ${socket.id}: "${e.result.text}"`);
        socket.emit('transcript-partial', { text: e.result.text });
      };
      recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          console.log(`🔊 Azure transcription: Final transcript for ${socket.id}: "${e.result.text}"`);
          
          // Create transcript result
          const transcript = {
            id: `azure-final-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: e.result.text,
            speaker: session.participantId || 'Unknown', // Use actual participant ID/phone number
            timestamp: Date.now(),
            confidence: 0.95,
            isFinal: true
          };
          
          // Save to conversation session if available
          const session = sessions[socket.id];
          if (session && session.conversationId) {
            let conversation = conversations.get(session.conversationId);
            if (!conversation) {
              conversation = createConversationSession(session.conversationId);
              conversations.set(session.conversationId, conversation);
            }
            conversation.addTranscript(transcript);
            
            // Save to file
            saveTranscript(session.conversationId, transcript);
          }
          
          socket.emit('transcript-final', { text: e.result.text });
        }
      };
      recognizer.canceled = (s, e) => {
        socket.emit('transcription-error', { message: 'Transcription canceled: ' + e.errorDetails });
      };
      recognizer.sessionStopped = () => {
        socket.emit('transcription-ended');
      };
      recognizer.startContinuousRecognitionAsync();
      
      // Emit transcription started event
      socket.emit('transcription-started', { 
        conversationId: `azure-${Date.now()}`,
        mode: 'azure' 
      });
      
      } catch (error) {
        console.error('🔊 Azure transcription: Failed to initialize Azure Speech service:', error);
        socket.emit('transcription-error', { 
          message: 'Failed to initialize transcription service. Please check your Azure credentials.' 
        });
        return;
      }
    });

    socket.on('audio-chunk', (data) => {
      const session = sessions[socket.id];
      if (!session) return;
      
      // Extract audio data from the payload
      const audioData = data.data || data;
      const durationSec = data.durationSec || 0.02;
      
      // data should be a Buffer or Uint8Array
      session.pushStream.write(audioData);
      
      // Estimate usage: assume 16kHz, 16-bit mono PCM (32KB/minute ~ 0.5KB/sec)
      // We'll increment seconds by chunk duration if provided, else estimate
      session.seconds += durationSec;
      usedSeconds += durationSec;
      
      if (usedSeconds >= FREE_TIER_SECONDS) {
        session.pushStream.close();
        session.recognizer.stopContinuousRecognitionAsync();
        socket.emit('transcription-error', { message: 'Azure free tier limit reached. Stopping transcription.' });
      }
    });

    socket.on('stop-transcription', () => {
      const session = sessions[socket.id];
      if (!session) return;
      
      // Save conversation transcript if available
      if (session.conversationId) {
        const conversation = conversations.get(session.conversationId);
        if (conversation) {
          saveConversationTranscript(conversation);
          conversations.delete(session.conversationId);
        }
      }
      
      session.pushStream.close();
      session.recognizer.stopContinuousRecognitionAsync();
      delete sessions[socket.id];
    });

    // Handle conversation start
    socket.on('start-conversation', (data) => {
      const session = sessions[socket.id];
      if (session && data.conversationId) {
        session.conversationId = data.conversationId;
        
        // Store participant ID if provided
        if (data.participantId) {
          session.participantId = data.participantId;
          console.log(`👤 Set participant ID: ${data.participantId} for session ${socket.id}`);
        }
        
        console.log(`🔊 Azure transcription: Started conversation ${data.conversationId} for ${socket.id}`);
      }
    });

    // Handle conversation end
    socket.on('end-conversation', (data) => {
      const session = sessions[socket.id];
      if (session && session.conversationId) {
        const conversation = conversations.get(session.conversationId);
        if (conversation) {
          saveConversationTranscript(conversation);
          conversations.delete(session.conversationId);
        }
        console.log(`🔊 Azure transcription: Ended conversation ${session.conversationId} for ${socket.id}`);
      }
    });

    socket.on('disconnect', () => {
      const session = sessions[socket.id];
      if (session) {
        // Save conversation transcript if available
        if (session.conversationId) {
          const conversation = conversations.get(session.conversationId);
          if (conversation) {
            saveConversationTranscript(conversation);
            conversations.delete(session.conversationId);
          }
        }
        
        session.pushStream.close();
        session.recognizer.stopContinuousRecognitionAsync();
        delete sessions[socket.id];
      }
    });
  });
}

// Storage and conversation management functions
async function setupTranscriptionStorage() {
  transcriptsDir = path.join(__dirname, 'transcripts');
  await ensureTranscriptsDirectory();
}

async function ensureTranscriptsDirectory() {
  try {
    await fs.access(transcriptsDir);
  } catch {
    await fs.mkdir(transcriptsDir, { recursive: true });
  }
}

function createConversationSession(conversationId) {
  return {
    id: conversationId,
    participants: new Set(),
    transcripts: [],
    startTime: Date.now(),
    lastProcessedTime: 0,
    
    addTranscript(transcript) {
      this.transcripts.push(transcript);
      this.participants.add(transcript.speaker);
    },
    
    getSummary() {
      const speakerA = this.transcripts.filter(t => t.speaker === 'A');
      const speakerB = this.transcripts.filter(t => t.speaker === 'B');
      
      return {
        totalExchanges: this.transcripts.length,
        speakerAExchanges: speakerA.length,
        speakerBExchanges: speakerB.length,
        duration: this.transcripts.length > 0 ? 
          this.transcripts[this.transcripts.length - 1].timestamp - this.transcripts[0].timestamp : 0,
        averageConfidence: this.transcripts.length > 0 ? 
          this.transcripts.reduce((sum, t) => sum + t.confidence, 0) / this.transcripts.length : 0
      };
    }
  };
}

async function saveTranscript(conversationId, transcript) {
  try {
    const filePath = path.join(transcriptsDir, `${conversationId}.json`);
    
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

async function saveConversationTranscript(session) {
  try {
    const filePath = path.join(transcriptsDir, `${session.id}-complete.json`);
    
    const conversationData = {
      id: session.id,
      startTime: session.startTime,
      endTime: Date.now(),
      participants: Array.from(session.participants),
      transcripts: session.transcripts,
      summary: session.getSummary()
    };
    
    await fs.writeFile(filePath, JSON.stringify(conversationData, null, 2));
    console.log(`💾 Saved complete transcript for conversation: ${session.id}`);
    
  } catch (error) {
    console.error('Error saving conversation transcript:', error);
  }
}

// API functions for retrieving transcripts
async function getConversationTranscripts(conversationId) {
  try {
    const filePath = path.join(transcriptsDir, `${conversationId}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function getAllConversationSummaries() {
  try {
    const files = await fs.readdir(transcriptsDir);
    const summaries = [];
    
    for (const file of files) {
      if (file.endsWith('-complete.json')) {
        const filePath = path.join(transcriptsDir, file);
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

module.exports = { 
  attachAzureTranscriptionService,
  getConversationTranscripts,
  getAllConversationSummaries
}; 