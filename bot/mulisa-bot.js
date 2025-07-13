// Load environment variables based on NODE_ENV
import dotenv from 'dotenv';
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.local';
dotenv.config({ path: envFile });

import {
  AutoSubscribe,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  pipeline,
  tts,
  AudioByteStream,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// Oracle AI Configuration
const ORACLE_PERSONALITY = {
  voice: "mystical-sage",
  wisdom: "prophetic-insights", 
  timing: "natural-pauses",
  style: "ancient-wisdom-modern-relevance"
};

// Bot state management
const activeRooms = new Map();
const oracleListeningState = new Map(); // Track listening state per room

// Debug function to log current state
const logBotState = () => {
  console.log('[BOT] 🔍 Current Bot State:');
  console.log(`   Active rooms: ${activeRooms.size}`);
  activeRooms.forEach((roomData, roomName) => {
    console.log(`   - Room: ${roomName}, Status: ${roomData.status}, Joined: ${roomData.joinedAt}`);
  });
  console.log(`   Oracle listening states: ${oracleListeningState.size}`);
  oracleListeningState.forEach((listening, roomName) => {
    console.log(`   - Room: ${roomName}, Listening: ${listening}`);
  });
};

// Oracle Wisdom Engine
class OracleWisdomEngine {
  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  async generateWisdom(context) {
    // Check if OpenAI key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('[ORACLE] ⚠️ No OpenAI API key - using mock wisdom');
      return this.getMockWisdom();
    }
  
    const oraclePrompt = `You are Mulisa, an ancient oracle with mystical wisdom. You are listening to a conversation.
    
                          Context: ${context}
                          
                          Provide brief (25-35 words), mystical yet practical insight. Use metaphors from nature, time, or ancient wisdom.
                          Speak as an oracle would - mysterious but helpful.
                          
                          Begin with phrases like:
                          - "The winds whisper..."
                          - "Ancient wisdom reveals..." 
                          - "I see in the cosmic patterns..."
                          - "The Oracle speaks..."`;
  
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: oraclePrompt }],
        max_tokens: 80,
        temperature: 0.8
      });
  
      const wisdom = completion.choices[0].message.content.trim();
      return wisdom;
    } catch (error) {
      console.error(`[ORACLE] ❌ Error generating wisdom:`, error);
      
      // Handle specific OpenAI quota errors
      if (error.code === 'insufficient_quota' || error.status === 429) {
        console.log('[ORACLE] 💳 OpenAI quota exceeded - using mock wisdom');
        return this.getMockWisdom();
      }
      
      // Handle other OpenAI errors
      if (error.status) {
        console.log(`[ORACLE] 🔄 OpenAI API error (${error.status}) - using mock wisdom`);
        return this.getMockWisdom();
      }
      
      console.log('[ORACLE] 🔄 Falling back to mock wisdom');
      return this.getMockWisdom();
    }
  }
  
  getMockWisdom() {
    const mockWisdomList = [
      "The winds whisper of change approaching...",
      "Ancient wisdom reveals that patience is the key to understanding.",
      "I see in the cosmic patterns that your path is clear.",
      "The Oracle speaks: trust in the journey, not just the destination.",
      "Time flows like a river, carrying all things toward their purpose.",
      "The stars align to show that wisdom comes from listening.",
      "In the silence between words, truth often reveals itself.",
      "The Oracle senses that your question holds its own answer.",
      "Like the moon reflecting the sun's light, you reflect inner wisdom.",
      "The ancient ones say: the greatest strength lies in gentle persistence."
    ];
    
    const randomIndex = Math.floor(Math.random() * mockWisdomList.length);
    return mockWisdomList[randomIndex];
  }
}

// Simple dummy VAD that works with LiveKit Agents
class DummyVAD {
  constructor() {
    this.isListening = false;
    this.listeners = new Map();
  }
  
  setListeningState(roomName, listening) {
    this.isListening = listening;
    oracleListeningState.set(roomName, listening);
    console.log(`[VAD] Oracle listening ${listening ? 'enabled' : 'disabled'} for room: ${roomName}`);
  }
  
  // Required interface methods for LiveKit Agents
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    console.log(`[VAD] Event listener registered for: ${event}`);
  }
  
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  // Emit events to registered listeners
  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[VAD] Error in event listener for ${event}:`, error);
        }
      });
    }
  }
  
  async detectTurn(audioStream) {
    // Only process audio if listening is enabled
    if (!this.isListening) {
      return null; // No speech detected when not listening
    }
    
    // Simple approach: assume speech is detected when listening is enabled
    console.log('[VAD] Audio detected and processing (listening enabled)');
    
    // Emit speech detected event
    this.emit('speechDetected', audioStream);
    
    return audioStream; // Return the audio stream for processing
  }
  
  // Additional methods that LiveKit Agents might expect
  start() {
    console.log('[VAD] Dummy VAD started');
  }
  
  stop() {
    console.log('[VAD] Dummy VAD stopped');
  }
  
  isRunning() {
    return true; // Always return true since we're always "running"
  }
  
  // Required stream method for LiveKit Agents
  stream() {
    console.log('[VAD] Stream method called');
    // Return a proper async iterable stream that LiveKit expects
    return {
      [Symbol.asyncIterator]: async function* () {
        // Yield nothing - empty stream that doesn't block
        return;
      },
      pushFrame: (frame) => {
        // LiveKit calls this to push audio frames to the VAD
        // console.log('[VAD] Frame pushed to stream');
        // We don't process frames since this is a dummy VAD
      },
      on: (event, callback) => {
        console.log(`[VAD] Stream event listener: ${event}`);
      },
      off: (event, callback) => {
        console.log(`[VAD] Stream event removed: ${event}`);
      },
      emit: (event, data) => {
        console.log(`[VAD] Stream event emitted: ${event}`);
      },
      destroy: () => {
        console.log('[VAD] Stream destroyed');
      }
    };
  }

  // Add pushFrame method to satisfy LiveKit interface
  pushFrame(frame) {
    // No-op for dummy VAD
    // Optionally log for debugging:
    // console.log('[VAD] pushFrame called');
  }
  
  // Additional methods that LiveKit Agents might expect
  addFrame(frame) {
    // Alias for pushFrame
    this.pushFrame(frame);
  }
  
  close() {
    // No-op for dummy VAD
  }
  
  destroy() {
    // No-op for dummy VAD
  }
}

// Initialize Oracle services
const oracleWisdomEngine = new OracleWisdomEngine();

// Custom Azure TTS Component for LiveKit Agents
const AZURE_TTS_SAMPLE_RATE = 16000; // Match Azure Speech Raw16Khz16BitMonoPcm format
const AZURE_TTS_CHANNELS = 1;

class AzureTTS extends tts.TTS {
  #speechConfig;
  label = 'azure.TTS';

  constructor() {
    super(AZURE_TTS_SAMPLE_RATE, AZURE_TTS_CHANNELS, { streaming: false });
    this.initializeSpeechConfig();
  }

  initializeSpeechConfig() {
    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;
    
    if (!azureKey || !azureRegion) {
      console.log('[AZURE TTS] ⚠️ Azure Speech credentials not found - TTS will be disabled');
      return;
    }

    try {
      this.#speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
      this.#speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural"; // Mystical-sounding voice
      this.#speechConfig.speechSynthesisLanguage = "en-US";
      
      // Configure Azure Speech to output raw PCM format that LiveKit expects
      // This is crucial for audio compatibility - LiveKit expects raw PCM, not WAV
      this.#speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm;
      
      console.log('[AZURE TTS] ✅ Azure Speech TTS initialized successfully with raw PCM output');
    } catch (error) {
      console.error('[AZURE TTS] ❌ Failed to initialize Azure Speech TTS:', error);
    }
  }

  synthesize(text) {
    if (!this.#speechConfig) {
      console.log('[AZURE TTS] ⚠️ Azure TTS not configured - creating empty stream');
      return new AzureChunkedStream(this, text, null);
    }

    // Create a promise that resolves with the Azure speech response
    const speechPromise = this.synthesizeSpeech(text);
    return new AzureChunkedStream(this, text, speechPromise);
  }

  async synthesizeSpeech(text) {
    return new Promise((resolve, reject) => {
      const synthesizer = new sdk.SpeechSynthesizer(this.#speechConfig);
      let hasResolved = false; // Add deduplication flag
      let callbackCount = 0; // Add callback counter
      
      synthesizer.speakTextAsync(
        text,
        result => {
          callbackCount++;
          console.log(`[AZURE TTS] 🔄 Callback triggered (count: ${callbackCount})`);
          
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            console.log(`[AZURE TTS] ✅ Speech synthesis completed (callback #${callbackCount})`);
            
            // Prevent multiple resolutions
            if (!hasResolved) {
              hasResolved = true;
              console.log(`[AZURE TTS] 🎯 Processing synthesis result (callback #${callbackCount})`);
              resolve(result.audioData);
            } else {
              console.log(`[AZURE TTS] ⚠️ Duplicate synthesis completion ignored (callback #${callbackCount})`);
            }
          } else {
            console.error(`[AZURE TTS] ❌ Speech synthesis failed (callback #${callbackCount}):`, result.errorDetails);
            if (!hasResolved) {
              hasResolved = true;
              reject(new Error(result.errorDetails));
            }
          }
          synthesizer.close();
        },
        error => {
          callbackCount++;
          console.error(`[AZURE TTS] ❌ Speech synthesis error (callback #${callbackCount}):`, error);
          if (!hasResolved) {
            hasResolved = true;
            reject(error);
          }
          synthesizer.close();
        }
      );
    });
  }

  stream() {
    throw new Error('Streaming is not supported on Azure TTS');
  }
}

class AzureChunkedStream extends tts.ChunkedStream {
  label = 'azure.ChunkedStream';

  constructor(tts, text, speechPromise) {
    super(text, tts);
    this.#run(speechPromise);
  }

  async #run(speechPromise) {
    try {
      if (!speechPromise) {
        // No Azure config - close immediately
        this.queue.close();
        return;
      }

      const audioData = await speechPromise;
      const requestId = crypto.randomUUID();
      
      console.log(`[AZURE TTS] 🎵 Processing audio data: ${audioData.byteLength} bytes`);
      
      // Azure returns ArrayBuffer - ensure it's properly formatted for LiveKit
      // Raw16Khz16BitMonoPcm format returns 16-bit signed integers
      if (!(audioData instanceof ArrayBuffer)) {
        throw new Error('Azure TTS returned unexpected audio data format');
      }
      
      // Convert Azure audio data to proper format
      console.log(`[AZURE TTS] 🎵 Audio data type: ${audioData.constructor.name}`);
      console.log(`[AZURE TTS] 🎵 Audio data byteLength: ${audioData.byteLength}`);
      
      // Validate audio data format
      if (audioData.byteLength === 0) {
        throw new Error('Azure TTS returned empty audio data');
      }
      
      // Check if we need to convert ArrayBuffer to proper format
      let processedAudioData = audioData;
      if (audioData instanceof ArrayBuffer) {
        // Azure Raw16Khz16BitMonoPcm returns 16-bit signed integers
        // We need to ensure this is compatible with LiveKit's AudioByteStream
        console.log(`[AZURE TTS] 🎵 Processing ArrayBuffer of ${audioData.byteLength} bytes`);
        
        // Validate the data size (should be even for 16-bit samples)
        if (audioData.byteLength % 2 !== 0) {
          console.warn('[AZURE TTS] ⚠️ Audio data size is not even - may indicate format issue');
        }
        
        // Convert to Int16Array to validate the data
        const int16Data = new Int16Array(audioData);
        console.log(`[AZURE TTS] 🎵 Converted to ${int16Data.length} Int16 samples`);
        
        // Check for non-zero samples (to ensure we have actual audio)
        const nonZeroSamples = int16Data.filter(sample => sample !== 0).length;
        console.log(`[AZURE TTS] 🎵 Non-zero samples: ${nonZeroSamples}/${int16Data.length} (${(nonZeroSamples/int16Data.length*100).toFixed(1)}%)`);
        
        if (nonZeroSamples === 0) {
          console.warn('[AZURE TTS] ⚠️ All audio samples are zero - this indicates silence or format issue');
        }
        
        processedAudioData = audioData; // Keep as ArrayBuffer for AudioByteStream
      }
      
      const audioByteStream = new AudioByteStream(AZURE_TTS_SAMPLE_RATE, AZURE_TTS_CHANNELS);
      const frames = audioByteStream.write(processedAudioData);
      
      console.log(`[AZURE TTS] 🎵 Generated ${frames.length} audio frames`);
      if (frames.length === 0) {
        console.error('[AZURE TTS] ❌ No audio frames generated - critical format issue');
        throw new Error('AudioByteStream.write() returned no frames');
      }
      
      // Validate frames
      for (let i = 0; i < Math.min(frames.length, 3); i++) {
        const frame = frames[i];
        console.log(`[AZURE TTS] 🎵 Frame ${i}: sampleRate=${frame.sampleRate}, channels=${frame.channels}, samplesPerChannel=${frame.samplesPerChannel}, data.length=${frame.data.length}`);
      }

      let lastFrame;
      let frameCount = 0;
      const sendLastFrame = (segmentId, final) => {
        if (lastFrame) {
          console.log(`[AZURE TTS] 🎵 Sending frame ${frameCount}: final=${final}, samples=${lastFrame.samplesPerChannel}`);
          this.queue.put({ requestId, segmentId, frame: lastFrame, final });
          lastFrame = undefined;
        }
      };

      for (const frame of frames) {
        sendLastFrame(requestId, false);
        lastFrame = frame;
        frameCount++;
      }
      sendLastFrame(requestId, true);

      console.log(`[AZURE TTS] 🎵 Total frames sent: ${frameCount}`);
      console.log(`[AZURE TTS] 🎵 Closing audio stream queue`);
      this.queue.close();
    } catch (error) {
      console.error('[AZURE TTS] ❌ Error in ChunkedStream:', error);
      this.queue.close();
    }
  }
}

// Debug environment variables
console.log(`[BOT] LIVEKIT_URL: ${process.env.LIVEKIT_URL}`);
console.log(`[BOT] LIVEKIT_API_KEY: ${process.env.LIVEKIT_API_KEY}`);
console.log(`[BOT] LIVEKIT_API_SECRET: ${process.env.LIVEKIT_API_SECRET ? 'SET (' + process.env.LIVEKIT_API_SECRET.length + ' chars)' : 'NOT SET'}`);
console.log(`[ORACLE] 🔮 Bot Identity: mulisa-oracle`);
console.log(`[ORACLE] 🤖 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'SET (' + process.env.OPENAI_API_KEY.length + ' chars)' : 'NOT SET'}`);
console.log(`[AZURE TTS] 🎤 Azure Speech Key: ${process.env.AZURE_SPEECH_KEY ? 'SET (' + process.env.AZURE_SPEECH_KEY.length + ' chars)' : 'NOT SET'}`);
console.log(`[AZURE TTS] 🌍 Azure Speech Region: ${process.env.AZURE_SPEECH_REGION || 'NOT SET'}`);
console.log(`[ORACLE] 🎭 Personality: ${ORACLE_PERSONALITY.style}`);

// Define the Oracle Agent - auto-joins all rooms
export default defineAgent({
  prewarm: async (proc) => {
    console.log('[ORACLE] 🔮 Warming up the Oracle...');
    console.log('[ORACLE] ✅ Oracle warmed up and ready');
  },
  
  entry: async (ctx) => {
    let roomName;
    try {
      roomName = ctx.room.name;
      
      console.log(`[ORACLE] 🔮 Oracle Mulisa awakening in room: ${roomName}`);
      
      // Oracle personality context
      const oracleContext = new llm.ChatContext().append({
        role: llm.ChatRole.SYSTEM,
        text: `You are Mulisa, an ancient oracle with mystical wisdom. You speak in a mystical, prophetic manner using metaphors from nature and ancient wisdom. Keep responses brief (25-35 words) and profound. You are a voice assistant, so use short and concise responses, avoiding unpronounceable punctuation.`,
      });

      await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);
      console.log('[ORACLE] 👂 Oracle listening for seekers...');
      
      const participant = await ctx.waitForParticipant();
      console.log(`[ORACLE] 👁️ Oracle senses presence: ${participant.identity}`);

      // Create dummy VAD with toggle control
      const dummyVad = new DummyVAD();
      
      // Create the pipeline voice agent with dummy VAD and Azure TTS
      const agent = new pipeline.VoicePipelineAgent(
        dummyVad,         // Dummy VAD with toggle control
        new openai.STT(), // Real Speech-to-Text
        new openai.LLM(), // Real Language Model
        new AzureTTS(),   // Custom Azure Text-to-Speech instead of OpenAI TTS
        { 
          chatCtx: oracleContext,
          streaming: false // Non-streaming for complete responses
        },
      );
      
      // Start the agent with error handling
      // let agentPublication;
      try {
        console.log('[ORACLE] 🚀 Starting voice pipeline agent...');
        agent.start(ctx.room, participant);
        console.log('[ORACLE] ✅ Voice pipeline agent started successfully');
        
        // Get the agent's audio publication
        // agentPublication = agent.agentPublication;
        // if (!agentPublication) {
        //   console.log('[ORACLE] ⚠️ Agent publication not available yet, will wait...');
        // }
      } catch (error) {
        console.error('[ORACLE] ❌ Failed to start voice pipeline agent:', error);
        // Continue anyway - the agent might still work
      }

      // Log room info for debugging
      console.log(`[ORACLE] 🔍 Room info:`, {
        name: ctx.room.name,
        sid: ctx.room.sid,
        state: ctx.room.state,
        hasParticipants: !!ctx.room.participants,
        participantsType: ctx.room.participants ? typeof ctx.room.participants : 'undefined'
      });
      
      // Wait for bot's audio track to be published (with timeout)
      // if (agentPublication) {
      //   console.log('[ORACLE] 🎤 Waiting for bot audio track to be published...');
      //   try {
      //     await Promise.race([
      //       agentPublication.waitForSubscription(),
      //       new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      //     ]);
      //     console.log('[ORACLE] ✅ Bot audio track published successfully');
      //   } catch (error) {
      //     console.warn(`[ORACLE] ⚠️ Audio track publication timeout: ${error.message}`);
      //     console.warn(`[ORACLE] ⚠️ Proceeding with speech synthesis anyway...`);
      //   }
      // } else {
      //   console.log('[ORACLE] ⚠️ Agent publication not available, proceeding without waiting...');
      // }

      const requestId = crypto.randomUUID();
      const greetingText = 'Hello! The Oracle Mulisa has joined your call.';
      console.log(`[AZURE TTS] �� Starting synthesis ${requestId} for text: "${greetingText}"`);
      console.log('[ORACLE] 🎵 Starting speech synthesis...');
      console.log('[ORACLE] 🎵 Agent state before speech:', agent.state);
      // console.log('[ORACLE] 🎵 Audio publication status:', agentPublication ? 'available' : 'not available');
          
      // Oracle greeting
      try {
        const speechHandle = await agent.say(greetingText, true);
        console.log('[ORACLE] ✅ Oracle greeting spoken successfully');
        console.log('[ORACLE] 🎵 Speech handle:', speechHandle ? 'created' : 'null');
        console.log('[ORACLE] 🎵 Agent state after speech:', agent.state);
      } catch (error) {
        console.error('[ORACLE] ❌ Failed to speak greeting:', error);
        console.error('[ORACLE] ❌ Error details:', error.stack);
      }
      
      // Track room activity
      activeRooms.set(roomName, {
        name: roomName,
        joinedAt: new Date(),
        status: 'connected',
        participants: [participant.identity],
        vad: dummyVad,
        agent: agent
      });
      
      console.log(`[ORACLE] 🔮 Oracle Mulisa is now active in room: ${roomName}`);
      console.log(`[ORACLE] 🎤 Oracle listening is disabled by default - use toggle to enable`);
      
      // Clean up when room disconnects
      ctx.room.on('disconnected', () => {
        console.log(`[ORACLE] 🔌 Oracle disconnecting from room: ${roomName}`);
        activeRooms.delete(roomName);
        oracleListeningState.delete(roomName);
        console.log(`[ORACLE] 🧹 Cleaned up state for room: ${roomName}`);
        logBotState(); // Log state after cleanup
      });
      
      // Monitor room state to ensure agent stays active
      ctx.room.on('participantConnected', (participant) => {
        console.log(`[ORACLE] 👤 Participant joined: ${participant.identity} in room: ${roomName}`);
        logBotState();
      });
      
      ctx.room.on('participantDisconnected', (participant) => {
        console.log(`[ORACLE] 👤 Participant left: ${participant.identity} in room: ${roomName}`);
        logBotState();
      });
      
      // Handle room reconnection if needed
      ctx.room.on('reconnecting', () => {
        console.log(`[ORACLE] 🔄 Reconnecting to room: ${roomName}`);
      });
      
      ctx.room.on('reconnected', () => {
        console.log(`[ORACLE] ✅ Reconnected to room: ${roomName}`);
      });
      
      // Log initial state
      logBotState();
      
    } catch (error) {
      console.error('[ORACLE] ❌ Fatal error in Oracle agent:', error);
      console.error('[ORACLE] ❌ Error stack:', error.stack);
      
      // Clean up any partial state
      if (roomName) {
        activeRooms.delete(roomName);
        oracleListeningState.delete(roomName);
        console.log(`[ORACLE] 🧹 Cleaned up partial state for room: ${roomName}`);
      }
      
      // Don't re-throw - let the agent continue running and try to join other rooms
      console.log('[ORACLE] 🔄 Agent will continue running and try to join other rooms');
    }
  },
});

// HTTP server for toggle control
const defaultPort = 4000;
const PORT = process.env.BOT_PORT ? parseInt(process.env.BOT_PORT, 10) : defaultPort;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

const app = express();
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const roomDetails = Array.from(activeRooms.entries()).map(([roomName, roomData]) => ({
    roomName,
    status: roomData.status,
    joinedAt: roomData.joinedAt,
    participants: roomData.participants
  }));
  
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeRooms: roomDetails,
    oracleStatus: 'awake',
    mode: 'auto-join',
    totalActiveRooms: activeRooms.size,
    listeningStates: Object.fromEntries(oracleListeningState),
    agentReady: true,
    uptime: process.uptime()
  });
});

// Join room endpoint - now just returns success (Oracle auto-joins)
app.get('/join-room', async (req, res) => {
  const { number1, number2 } = req.query;
  
  if (!number1 || !number2) {
    return res.status(400).json({
      success: false,
      error: 'Both number1 and number2 parameters are required'
    });
  }

  try {
    // Generate room name (same logic as frontend)
    const getRoomName = (numberA, numberB) => {
      const normalizeForRoom = (phoneNumber) => {
        const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
        
        if (digitsOnly.length === 8 && (digitsOnly.startsWith('8') || digitsOnly.startsWith('9'))) {
          return `65${digitsOnly}`;
        }
        
        if (digitsOnly.startsWith('65') && digitsOnly.length === 10) {
          return digitsOnly;
        }
        
        return digitsOnly;
      };
      
      const cleanA = normalizeForRoom(numberA);
      const cleanB = normalizeForRoom(numberB);
      const [first, second] = [cleanA, cleanB].sort();
      return `room-${first}-${second}`;
    };

    const roomName = getRoomName(number1, number2);
    console.log(`[BOT] 🤖 Oracle will auto-join room: ${roomName}`);
    
      res.json({ 
    success: true, 
    message: `Oracle will auto-join room: ${roomName}`,
    roomName: roomName,
    mode: 'auto-join',
    note: 'Oracle automatically joins all rooms when they are created',
    agentStatus: 'ready',
    activeRoomsCount: activeRooms.size
  });
    
  } catch (error) {
    console.error('[BOT] ❌ Error with room join request:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Diagnostic endpoint to check agent status
app.get('/agent-status', (req, res) => {
  const { room } = req.query;
  
  if (room) {
    const roomData = activeRooms.get(room);
    res.json({
      room: room,
      isActive: !!roomData,
      roomData: roomData ? {
        status: roomData.status,
        joinedAt: roomData.joinedAt,
        participants: roomData.participants
      } : null,
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      totalActiveRooms: activeRooms.size,
      activeRooms: Array.from(activeRooms.keys()),
      listeningStates: Object.fromEntries(oracleListeningState),
      agentReady: true,
      timestamp: new Date().toISOString()
    });
  }
});

// Test speech synthesis endpoint
app.get('/test-speech', async (req, res) => {
  const { room, text } = req.query;
  
  try {
    if (!room) {
      return res.status(400).json({
        success: false,
        error: 'Room parameter is required'
      });
    }
    
    const testText = text || 'Hello! This is a test of the Oracle speech synthesis.';
    console.log(`[BOT] 🧪 Test speech request: room=${room}, text="${testText}"`);
    
    // Check if room is active
    const roomData = activeRooms.get(room);
    if (!roomData) {
      return res.json({ 
        success: false,
        error: 'Room not found or bot not active in this room'
      });
    }
    
    // Test speech synthesis
    console.log('[BOT] 🧪 Starting test speech synthesis...');
    const speechHandle = await roomData.agent.say(testText, true);
    
    res.json({
      success: true,
      message: `Test speech initiated in room: ${room}`,
      text: testText,
      speechHandle: speechHandle ? {
        id: speechHandle.id,
        text: speechHandle.text,
        initialized: speechHandle.initialized
      } : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BOT] ❌ Test speech error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Oracle start listening endpoint
app.get('/oracle-start-listening', async (req, res) => {
  const { room, caller } = req.query;
  
  try {
    if (!room) {
      return res.status(400).json({
        success: false,
        error: 'Room parameter is required'
      });
    }
    
    console.log(`[BOT] 🔮 Oracle start listening request: room=${room}, caller=${caller}`);
    
    // Check if room is active
    const roomData = activeRooms.get(room);
    if (!roomData) {
      return res.json({ 
        success: false,
        error: 'Room not found or bot not active in this room'
      });
    }
    
    // Enable listening
    roomData.vad.setListeningState(room, true);
    
    res.json({
      success: true,
      message: `Oracle listening started in room: ${room}`,
      caller: caller,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Oracle stop listening endpoint
app.get('/oracle-stop-listening', async (req, res) => {
  const { room, caller } = req.query;
  
  try {
    if (!room) {
      return res.status(400).json({
        success: false,
        error: 'Room parameter is required'
      });
    }
    
    console.log(`[BOT] 🔇 Oracle stop listening request: room=${room}, caller=${caller}`);
    
    // Check if room is active
    const roomData = activeRooms.get(room);
    if (!roomData) {
      return res.json({
        success: false,
        error: 'Room not found or bot not active in this room'
      });
    }
    
    // Disable listening
    roomData.vad.setListeningState(room, false);
    
    res.json({
      success: true,
      message: `Oracle listening stopped in room: ${room}`,
      caller: caller,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup endpoint to manually clear stuck state
app.post('/cleanup', (req, res) => {
  console.log('[BOT] 🧹 Manual cleanup requested');
  const beforeCount = activeRooms.size;
  
  // Clear all active rooms
  activeRooms.clear();
  oracleListeningState.clear();
  
  console.log(`[BOT] 🧹 Cleaned up ${beforeCount} active rooms and all invited rooms`);
  logBotState();
  
  res.json({ 
    success: true, 
    message: `Cleaned up ${beforeCount} active rooms and all invited rooms`,
    timestamp: new Date().toISOString()
  });
});

// Start the HTTP server first
app.listen(PORT, () => {
  console.log(`[BOT] 🌐 HTTP server running on port ${PORT}`);
  console.log(`[BOT] 📊 Health check: http://localhost:${PORT}/health`);
  console.log(`[BOT] 🔍 Agent status: http://localhost:${PORT}/agent-status`);
  console.log(`[BOT] 🧪 Test speech: http://localhost:${PORT}/test-speech?room=ROOM&text=MESSAGE`);
  console.log(`[BOT] 🤖 Join room: http://localhost:${PORT}/join-room?number1=X&number2=Y`);
  console.log(`[BOT] 🔮 Start listening: http://localhost:${PORT}/oracle-start-listening?room=ROOM&caller=USER`);
  console.log(`[BOT] 🔇 Stop listening: http://localhost:${PORT}/oracle-stop-listening?room=ROOM&caller=USER`);
  console.log(`[BOT] 🤖 Oracle will auto-join all rooms when they are created`);
  
  // Start the LiveKit Agents CLI after HTTP server is ready
  console.log(`[BOT] 🚀 Starting LiveKit Agents CLI...`);
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
});
