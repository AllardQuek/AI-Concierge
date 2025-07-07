// Azure Speech-to-Text real-time transcription service for Socket.IO
// Usage: require and call attachAzureTranscriptionService(io)

const fs = require('fs').promises;
const path = require('path');

// Use centralized configuration
const { isAzureConfigured, getAzureConfig } = require('./config/env');

// Get Azure configuration
const azureConfig = getAzureConfig();
const AZURE_SPEECH_KEY = azureConfig.key;
const AZURE_SPEECH_REGION = azureConfig.region;

// Debug logging for Azure configuration
console.log('🔊 Azure configuration check:');
console.log('  AZURE_SPEECH_KEY:', AZURE_SPEECH_KEY ? 'SET' : 'NOT SET');
console.log('  AZURE_SPEECH_REGION:', AZURE_SPEECH_REGION ? 'SET' : 'NOT SET');
console.log('  isAzureConfigured:', azureConfig.isConfigured);

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
    
    // Catch-all event logger for debugging
    // socket.onAny((event, ...args) => {
    //   console.log(`[SOCKET DEBUG] Event: ${event}`, args);
    // });

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
        const sdk = require('microsoft-cognitiveservices-speech-sdk');
        const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
        speechConfig.speechRecognitionLanguage = 'en-US';
        
        // Optimize for real-time 16-bit PCM audio
        speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1000");
        speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000");
        speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, "1000");
        
        // Enable detailed logging for debugging
        speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_LogFilename, "azure-speech.log");
        // Use push stream for real-time audio
        const pushStream = sdk.AudioInputStream.createPushStream();
        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
        sessions[socket.id] = { 
          recognizer, 
          pushStream, 
          startTime: Date.now(), 
          seconds: 0,
          conversationId: null, // Will be set when conversation starts
          lastSampleRate: null // Track last sample rate
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
              id: `azure-final-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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

    socket.on('audio-chunk', async (data) => {
      const session = sessions[socket.id];
      if (!session) return;
      let audioData = data.data || data;
      const durationSec = data.durationSec || 0.02;
      const inputSampleRate = data.sampleRate || 48000; // Use sample rate from client, default to 48000
      const targetSampleRate = 16000;

      // Optionally, warn if sample rate changes mid-session
      if (session.lastSampleRate && session.lastSampleRate !== inputSampleRate) {
        console.warn(`Sample rate changed for session ${socket.id}: ${session.lastSampleRate} -> ${inputSampleRate}`);
      }
      session.lastSampleRate = inputSampleRate;

      // Accept Uint8Array, ArrayBuffer, or Array
      let int16Input;
      if (audioData instanceof Uint8Array) {
        // Ensure alignment by copying to a new buffer if needed
        if (audioData.byteOffset % 2 === 0 && audioData.byteLength % 2 === 0) {
          int16Input = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
        } else {
          // Copy to a new buffer that is aligned
          const aligned = new Uint8Array(audioData);
          int16Input = new Int16Array(aligned.buffer, 0, Math.floor(aligned.byteLength / 2));
        }
      } else if (audioData instanceof ArrayBuffer) {
        int16Input = new Int16Array(audioData);
      } else if (Array.isArray(audioData)) {
        // Convert plain array to Int16Array
        int16Input = new Int16Array(new Uint8Array(audioData).buffer);
        console.warn('audio-chunk: Received plain Array, converted to Int16Array');
      } else {
        console.error('audio-chunk: Unexpected audioData type', typeof audioData, audioData);
        socket.emit('transcription-error', { message: 'Server error: Invalid audio data format.' });
        return;
      }

      // 3. Convert Int16Array to Float32Array for resampling
      const float32Input = new Float32Array(int16Input.length);
      for (let i = 0; i < int16Input.length; i++) {
        float32Input[i] = int16Input[i] / 32768;
      }

      // 4. Resample from inputSampleRate to 16000 Hz
      let resampledFloat32;
      try {
        resampledFloat32 = resample(float32Input, 1, inputSampleRate, targetSampleRate);
      } catch (err) {
        console.error('Resampling error:', err);
        // Fallback: send original audio (may result in empty transcripts)
        resampledFloat32 = float32Input;
      }

      // 5. Convert back to Int16Array
      const resampledInt16 = new Int16Array(resampledFloat32.length);
      for (let i = 0; i < resampledFloat32.length; i++) {
        let s = Math.max(-1, Math.min(1, resampledFloat32[i]));
        resampledInt16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      const resampledBuffer = Buffer.from(resampledInt16.buffer);

      // 6. Write to Azure push stream
      session.pushStream.write(resampledBuffer);

      // Usage tracking (as before)
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

function resample(input, channels, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) return input;
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / sampleRateRatio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const idx = i * sampleRateRatio;
    const idx1 = Math.floor(idx);
    const idx2 = Math.min(idx1 + 1, input.length - 1);
    const frac = idx - idx1;
    output[i] = input[idx1] * (1 - frac) + input[idx2] * frac;
  }
  return output;
}

module.exports = { 
  attachAzureTranscriptionService,
  getConversationTranscripts,
  getAllConversationSummaries
}; 