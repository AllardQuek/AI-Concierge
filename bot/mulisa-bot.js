// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.local';
dotenv.config({ path: envFile });

const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
const { Room } = require('livekit-client'); // FIXED: Added missing import
const express = require('express');
const cors = require('cors');

// AI Dependencies
const OpenAI = require('openai');

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const BOT_IDENTITY = process.env.LIVEKIT_BOT_IDENTITY || 'mulisa-oracle';

// FIXED: Declare missing global variables
const activeRooms = {};
const livekitRooms = {}; // FIXED: Was undefined, causing crashes
const roomMonitoringIntervals = {};

// Oracle AI Configuration
const ORACLE_PERSONALITY = {
  voice: "mystical-sage",
  wisdom: "prophetic-insights", 
  timing: "natural-pauses",
  style: "ancient-wisdom-modern-relevance",
  triggers: ["help", "advice", "wisdom", "oracle", "mulisa", "guidance"]
};

// Initialize AI services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Room cleanup configuration
const ROOM_CHECK_INTERVAL = 30000; // Check every 30 seconds
const EMPTY_ROOM_TIMEOUT = 60000; // Wait 1 minute before leaving empty room

// Debug environment variables
console.log(`[BOT] LIVEKIT_URL: ${LIVEKIT_URL}`);
console.log(`[BOT] LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}`);
console.log(`[BOT] LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET ? 'SET (' + LIVEKIT_API_SECRET.length + ' chars)' : 'NOT SET'}`);
console.log(`[ORACLE] 🔮 Bot Identity: ${BOT_IDENTITY}`);
console.log(`[ORACLE] 🤖 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'SET (' + process.env.OPENAI_API_KEY.length + ' chars)' : 'NOT SET'}`);
console.log(`[ORACLE] 🎭 Personality: ${ORACLE_PERSONALITY.style}`);
console.log(`[ORACLE] 🗣️ TTS Enabled: ${process.env.ENABLE_TTS || 'false'}`);

// Initialize room service client
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

function getRoomName(numberA, numberB) {
  const cleanA = numberA.replace(/\D/g, '');
  const cleanB = numberB.replace(/\D/g, '');
  const [first, second] = [cleanA, cleanB].sort();
  return `room-${first}-${second}`;
}

async function createBotToken(room, identity) {
  try {
    console.log(`[BOT] Creating token for room: ${room}, identity: ${identity}`);
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: identity,
      ttl: '10m',
    });
    at.addGrant({ 
      room: room, 
      roomJoin: true, 
      canPublish: true, 
      canSubscribe: true 
    });
    const token = at.toJwt();
    console.log(`[BOT] Token type: ${typeof token}, value:`, token);
    
    // Handle both string and Buffer/Uint8Array responses
    const tokenString = typeof token === 'string' ? token : token.toString();
    console.log(`[BOT] Token created successfully: ${tokenString.substring(0, 50)}...`);
    return tokenString;
  } catch (err) {
    console.error(`[BOT] Error creating token:`, err);
    throw err;
  }
}

async function joinExistingRoom(numberA, numberB) {
  const roomName = getRoomName(numberA, numberB);
  
  if (activeRooms[roomName]) {
    console.log(`[BOT] Already joined room: ${roomName}`);
    return roomName;
  }

  try {
    // Check if the room exists first
    console.log(`[BOT] Checking if room exists: ${roomName}`);
    const rooms = await roomService.listRooms();
    const roomExists = rooms.some(room => room.name === roomName);
    
    if (!roomExists) {
      throw new Error(`Room ${roomName} does not exist yet. Users need to start the call first.`);
    }

    // Create bot token
    const botToken = await createBotToken(roomName, BOT_IDENTITY);
    
    // Create LiveKit Room instance and connect
    const room = new Room();
    livekitRooms[roomName] = room;
      // Set up room event handlers
    room.on('connected', () => {
      console.log(`[BOT] 🟢 Connected to LiveKit room: ${roomName}`);
      console.log(`[ORACLE] 🔮 Mulisa Oracle awakens in room: ${roomName}`);
      
      // Initialize Oracle functionality
      initializeOracleWisdom(roomName);
    });
    
    room.on('disconnected', () => {
      console.log(`[BOT] 🔴 Disconnected from LiveKit room: ${roomName}`);
      console.log(`[ORACLE] 😴 Oracle Mulisa slumbers, leaving room: ${roomName}`);
    });
    
    room.on('participantConnected', (participant) => {
      console.log(`[BOT] 👋 Participant joined: ${participant.identity}`);
      console.log(`[ORACLE] 👁️ Oracle senses new presence: ${participant.identity}`);
    });
    
    room.on('participantDisconnected', (participant) => {
      console.log(`[BOT] 👋 Participant left: ${participant.identity}`);
      console.log(`[ORACLE] 🌫️ Oracle feels departure: ${participant.identity}`);
    });
    
    // Connect to the room
    console.log(`[BOT] Connecting to LiveKit room: ${roomName} with identity: ${BOT_IDENTITY}`);
    await room.connect(LIVEKIT_URL, botToken);
    
    // Mark the room as joined in our internal state
    activeRooms[roomName] = {
      name: roomName,
      joinedAt: new Date(),
      status: 'connected'
    };

    console.log(`[BOT] Successfully joined existing room: ${roomName}`);
      // Start monitoring the room for participants leaving
    startRoomMonitoring(roomName);
    
    // ORACLE: Set up audio processing and Oracle wisdom
    await setupOracleForRoom(room, roomName);
    
    return roomName;
    
  } catch (err) {
    console.error(`[BOT] Failed to join room: ${roomName} - ${err.message}`);
    // Clean up on error
    if (livekitRooms[roomName]) {
      try {
        await livekitRooms[roomName].disconnect();
      } catch (disconnectErr) {
        console.error(`[BOT] Error disconnecting from room during cleanup:`, disconnectErr);
      }
      delete livekitRooms[roomName];
    }
    throw err;
  }
}

// Room monitoring and cleanup functions
async function checkRoomStatus(roomName) {
  try {
    const participants = await roomService.listParticipants(roomName);
    
    // Filter out the bot itself from participant count
    const humanParticipants = participants.filter(p => p.identity !== BOT_IDENTITY);
    
    console.log(`[BOT] Room ${roomName} has ${humanParticipants.length} human participants`);
    
    if (humanParticipants.length === 0) {
      // Room is empty, start countdown to leave
      if (!activeRooms[roomName].emptyStartTime) {
        activeRooms[roomName].emptyStartTime = new Date();
        console.log(`[BOT] Room ${roomName} is now empty. Starting exit countdown...`);
      } else {
        const emptyDuration = Date.now() - activeRooms[roomName].emptyStartTime.getTime();
        if (emptyDuration >= EMPTY_ROOM_TIMEOUT) {
          console.log(`[BOT] Room ${roomName} has been empty for ${emptyDuration}ms. Leaving room.`);
          await leaveRoom(roomName);
        }
      }
    } else {
      // Room has participants, reset empty timer
      if (activeRooms[roomName].emptyStartTime) {
        console.log(`[BOT] Room ${roomName} has participants again. Canceling exit countdown.`);
        delete activeRooms[roomName].emptyStartTime;
      }
    }
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('does not exist')) {
      console.log(`[BOT] Room ${roomName} no longer exists. Cleaning up.`);
      await leaveRoom(roomName);
    } else {
      console.error(`[BOT] Error checking room status for ${roomName}:`, err.message);
    }
  }
}

async function leaveRoom(roomName) {
  console.log(`[BOT] Leaving room: ${roomName}`);
  
  // Stop monitoring the room
  if (roomMonitoringIntervals[roomName]) {
    clearInterval(roomMonitoringIntervals[roomName]);
    delete roomMonitoringIntervals[roomName];
  }
  
  // ORACLE: Clean up Oracle data before leaving
  await cleanupOracleForRoom(roomName);
  
  // Disconnect from LiveKit room
  if (livekitRooms[roomName]) {
    try {
      console.log(`[BOT] Disconnecting from LiveKit room: ${roomName}`);
      await livekitRooms[roomName].disconnect();
    } catch (err) {
      console.error(`[BOT] Error disconnecting from LiveKit room:`, err);
    }
    delete livekitRooms[roomName];
  }
  
  // Clean up room data
  delete activeRooms[roomName];
  
  console.log(`[BOT] Successfully left room: ${roomName}`);
  console.log(`[ORACLE] 🌙 Oracle returns to the mystical realm`);
}

function startRoomMonitoring(roomName) {
  if (roomMonitoringIntervals[roomName]) {
    console.log(`[BOT] Already monitoring room: ${roomName}`);
    return;
  }
  
  console.log(`[BOT] Starting monitoring for room: ${roomName}`);
  roomMonitoringIntervals[roomName] = setInterval(() => {
    checkRoomStatus(roomName);
  }, ROOM_CHECK_INTERVAL);
}

// Oracle setup and initialization functions
async function setupOracleForRoom(room, roomName) {
  try {
    console.log(`[ORACLE] 🔮 Initializing Mulisa Oracle for room: ${roomName}`);
    
    // Create audio subscription manager for this room
    const audioManager = new AudioSubscriptionManager(roomName, oracleWisdomEngine, oracleVoiceManager);
    
    // Subscribe to participant audio tracks
    await audioManager.subscribeToParticipants(room);
    
    // Store audio manager reference for cleanup
    if (!activeRooms[roomName].oracleData) {
      activeRooms[roomName].oracleData = {};
    }
    activeRooms[roomName].oracleData.audioManager = audioManager;
    
    console.log(`[ORACLE] ✨ Oracle successfully initialized for room: ${roomName}`);
    
  } catch (error) {
    console.error(`[ORACLE] ❌ Error setting up Oracle for room ${roomName}:`, error);
  }
}

async function initializeOracleWisdom(roomName) {
  console.log(`[ORACLE] 🌟 Oracle Mulisa awakens in room: ${roomName}`);
  
  // Send initial greeting after 3 seconds
  setTimeout(async () => {
    const greeting = "The Oracle Mulisa awakens... I sense seeking souls. Speak, and wisdom shall flow like ancient rivers.";
    await oracleVoiceManager.speakWisdom(roomName, greeting);
  }, 3000);
}

async function cleanupOracleForRoom(roomName) {
  console.log(`[ORACLE] 🧹 Cleaning up Oracle data for room: ${roomName}`);
  
  try {
    // Clean up wisdom context
    oracleWisdomEngine.cleanupRoom(roomName);
    
    // Clean up room oracle data
    if (activeRooms[roomName] && activeRooms[roomName].oracleData) {
      delete activeRooms[roomName].oracleData;
    }
    
    console.log(`[ORACLE] ✅ Oracle cleanup completed for room: ${roomName}`);
  } catch (error) {
    console.error(`[ORACLE] ❌ Error during Oracle cleanup:`, error);
  }
}

// Oracle Wisdom Engine - Core AI Logic
class OracleWisdomEngine {
  constructor() {
    this.conversationContexts = new Map();
    this.wisdomHistory = new Map();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  async generateWisdom(roomName, seekerIdentity, context) {
    const conversationHistory = this.conversationContexts.get(roomName) || [];
    const previousWisdom = this.wisdomHistory.get(roomName) || [];
    
    const oraclePrompt = `You are Mulisa, an ancient oracle with mystical wisdom. You are listening to a conversation in room ${roomName}.
    
Seeker: ${seekerIdentity}
Context: ${context}
Previous wisdom shared: ${previousWisdom.slice(-2).join('; ')}

Provide brief (25-35 words), mystical yet practical insight. Use metaphors from nature, time, or ancient wisdom.
Avoid repeating previous wisdom. Speak as an oracle would - mysterious but helpful.

Begin with phrases like:
- "The winds whisper..."
- "Ancient wisdom reveals..." 
- "I see in the cosmic patterns..."
- "The Oracle speaks..."`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: oraclePrompt }],
        max_tokens: 80,
        temperature: 0.8
      });

      const wisdom = completion.choices[0].message.content.trim();
      
      // Store wisdom to avoid repetition
      if (!this.wisdomHistory.has(roomName)) {
        this.wisdomHistory.set(roomName, []);
      }
      this.wisdomHistory.get(roomName).push(wisdom);
      
      return wisdom;
    } catch (error) {
      console.error(`[ORACLE] ❌ Error generating wisdom:`, error);
      return "The Oracle's voice grows distant... mystical energies are disrupted.";
    }
  }
  
  updateConversationContext(roomName, event) {
    if (!this.conversationContexts.has(roomName)) {
      this.conversationContexts.set(roomName, []);
    }
    
    const context = this.conversationContexts.get(roomName);
    context.push({
      timestamp: new Date(),
      event: event,
      type: 'conversation-activity'
    });
    
    // Keep only last 10 events
    if (context.length > 10) {
      context.splice(0, context.length - 10);
    }
  }
  
  cleanupRoom(roomName) {
    this.conversationContexts.delete(roomName);
    this.wisdomHistory.delete(roomName);
    console.log(`[ORACLE] 🧹 Cleaned up wisdom context for room: ${roomName}`);
  }
}

// Oracle Voice Manager - Text and Audio Output
class OracleVoiceManager {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  async speakWisdom(roomName, wisdom) {
    try {
      console.log(`[ORACLE] 🗣️ Speaking to ${roomName}: "${wisdom}"`);
      
      // Phase 2: Text-based wisdom (immediate implementation)
      this.updateRoomWithWisdom(roomName, wisdom);
      
      // Phase 3: Add TTS audio (stretch goal)
      if (process.env.ENABLE_TTS === 'true') {
        await this.generateAndPublishAudio(roomName, wisdom);
      }
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error speaking wisdom:`, error);
    }
  }
  
  updateRoomWithWisdom(roomName, wisdom) {
    if (activeRooms[roomName]) {
      activeRooms[roomName].lastWisdom = {
        text: wisdom,
        timestamp: new Date(),
        type: 'prophetic-insight',
        oracleActive: true
      };
      console.log(`[ORACLE] 💫 Wisdom updated in room ${roomName}`);
    }
  }
    async generateAndPublishAudio(roomName, wisdom) {
    try {
      // OpenAI TTS for quick implementation
      const mp3Response = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "nova", // Mystical-sounding voice
        input: wisdom,
        speed: 0.85 // Slower for oracle effect
      });

      const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
      console.log(`[ORACLE] 🎵 Generated ${audioBuffer.length} bytes of oracle speech`);
      
      // Publish to LiveKit room
      await this.publishAudioToRoom(roomName, audioBuffer);
      
    } catch (error) {
      console.error(`[ORACLE] ❌ TTS error:`, error);
    }
  }
  async publishAudioToRoom(roomName, audioBuffer) {
    try {
      const room = livekitRooms[roomName];
      if (!room || !room.isConnected()) {
        console.error(`[ORACLE] ❌ Room ${roomName} not connected for audio publishing`);
        return;
      }

      console.log(`[ORACLE] 🎵 Publishing oracle voice to room ${roomName}`);

      // Use a more practical approach: Stream audio via WebRTC data channel or file serving
      // For immediate implementation, we'll use a hybrid approach
      
      // Method 1: Try direct audio track publishing (if supported)
      try {
        const audioTrack = await this.createAudioTrackFromBuffer(audioBuffer);
        
        if (audioTrack && audioTrack.pcmData) {
          // Create a custom audio source for LiveKit
          const audioSource = await this.createLiveKitAudioSource(audioTrack);
          
          if (audioSource) {
            // Publish the custom audio track
            await room.localParticipant.publishTrack(audioSource, {
              name: 'oracle-wisdom-voice',
              source: 'microphone'
            });
            
            console.log(`[ORACLE] ✨ Oracle voice published via audio track to ${roomName}`);
            
            // Auto-unpublish after audio duration
            setTimeout(async () => {
              try {
                await room.localParticipant.unpublishTrack(audioSource);
                console.log(`[ORACLE] 🔇 Oracle voice track unpublished from ${roomName}`);
              } catch (error) {
                console.error(`[ORACLE] ❌ Error unpublishing audio:`, error);
              }
            }, audioTrack.duration * 1000 + 1000);
            
            return; // Success with direct audio publishing
          }
        }
      } catch (directPublishError) {
        console.warn(`[ORACLE] ⚠️ Direct audio publishing failed:`, directPublishError.message);
      }
      
      // Method 2: Fallback to HTTP audio serving + client-side playback
      console.log(`[ORACLE] 🔄 Using fallback HTTP audio serving method`);
      await this.publishAudioViaHttpServing(roomName, audioBuffer);
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error publishing audio to room:`, error);
    }
  }

  async createLiveKitAudioSource(audioTrack) {
    try {
      // This is a conceptual implementation for custom audio source
      // In a production environment, you'd implement a proper audio source
      // that feeds PCM data to LiveKit's audio pipeline
      
      console.log(`[ORACLE] 🔧 Creating LiveKit audio source`);
      
      // Placeholder for custom audio source implementation
      // This would require deeper integration with LiveKit's Node.js APIs
      
      return null; // Returning null to trigger fallback method
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error creating LiveKit audio source:`, error);
      return null;
    }
  }

  async publishAudioViaHttpServing(roomName, audioBuffer) {
    try {
      console.log(`[ORACLE] 📡 Setting up HTTP audio serving for room ${roomName}`);
      
      // Store the audio file temporarily and serve it via HTTP
      const fs = require('fs');
      const path = require('path');
      
      // Create audio serving directory
      const audioDir = path.join(process.cwd(), 'temp', 'oracle-audio');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      // Create unique filename for this oracle message
      const audioFileName = `oracle-${roomName}-${Date.now()}.mp3`;
      const audioFilePath = path.join(audioDir, audioFileName);
      
      // Write audio buffer to file
      fs.writeFileSync(audioFilePath, audioBuffer);
      
      // Update room data with audio file URL for frontend to fetch
      if (activeRooms[roomName]) {
        activeRooms[roomName].lastWisdom = {
          ...activeRooms[roomName].lastWisdom,
          audioUrl: `/oracle-audio/${audioFileName}`,
          hasAudio: true
        };
        console.log(`[ORACLE] 🎵 Audio URL set for room ${roomName}: /oracle-audio/${audioFileName}`);
      }
      
      // Clean up audio file after 30 seconds
      setTimeout(() => {
        try {
          if (fs.existsSync(audioFilePath)) {
            fs.unlinkSync(audioFilePath);
            console.log(`[ORACLE] 🧹 Cleaned up audio file: ${audioFileName}`);
          }
        } catch (error) {
          console.error(`[ORACLE] ❌ Error cleaning up audio file:`, error);
        }
      }, 30000);
      
      console.log(`[ORACLE] ✅ Oracle audio available via HTTP serving`);
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error setting up HTTP audio serving:`, error);
    }
  }
  async createAudioTrackFromBuffer(audioBuffer) {
    try {
      console.log(`[ORACLE] 🔧 Converting ${audioBuffer.length} byte MP3 buffer to audio track`);
      
      // For LiveKit Node.js, we need to convert MP3 to PCM and create a custom audio source
      // This is a production implementation for server-side audio injection
      
      const fs = require('fs');
      const path = require('path');
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Create temporary file for audio processing
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempMp3File = path.join(tempDir, `oracle-${Date.now()}.mp3`);
      const tempPcmFile = path.join(tempDir, `oracle-${Date.now()}.pcm`);
      
      // Write MP3 buffer to temporary file
      fs.writeFileSync(tempMp3File, audioBuffer);
      
      try {
        // Convert MP3 to PCM using ffmpeg (if available) or fallback to simpler approach
        await execAsync(`ffmpeg -i "${tempMp3File}" -f s16le -acodec pcm_s16le -ar 48000 -ac 1 "${tempPcmFile}"`);
        
        // Read the PCM data
        const pcmBuffer = fs.readFileSync(tempPcmFile);
        console.log(`[ORACLE] ✅ Converted to ${pcmBuffer.length} bytes of PCM audio`);
        
        // Clean up temporary files
        fs.unlinkSync(tempMp3File);
        fs.unlinkSync(tempPcmFile);
        
        return {
          kind: 'audio',
          pcmData: pcmBuffer,
          sampleRate: 48000,
          channels: 1,
          duration: pcmBuffer.length / (48000 * 2) // 16-bit samples
        };
        
      } catch (ffmpegError) {
        console.warn(`[ORACLE] ⚠️ FFmpeg not available, using direct MP3 approach:`, ffmpegError.message);
        
        // Fallback: Use the MP3 buffer directly (requires LiveKit to handle MP3)
        fs.unlinkSync(tempMp3File);
        
        return {
          kind: 'audio',
          mp3Data: audioBuffer,
          format: 'mp3',
          estimatedDuration: this.estimateAudioDuration(audioBuffer)
        };
      }
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error creating audio track:`, error);
      return null;
    }
  }

  estimateAudioDuration(audioBuffer) {
    // Rough estimation: MP3 files are typically ~128kbps
    // This is a simplified calculation - more accurate would parse MP3 headers
    const bytesPerSecond = 16000; // Approximate for TTS audio
    const durationMs = (audioBuffer.length / bytesPerSecond) * 1000;
    return Math.max(durationMs, 2000); // Minimum 2 seconds
  }
}

// Audio Subscription Manager - Listens to Participants
class AudioSubscriptionManager {
  constructor(roomName, wisdomEngine, voiceManager) {
    this.roomName = roomName;
    this.subscribedTracks = new Map();
    this.wisdomEngine = wisdomEngine;
    this.voiceManager = voiceManager;
    this.lastWisdomTime = 0;
    this.wisdomCooldown = 15000; // 15 seconds between wisdom
  }
  
  async subscribeToParticipants(room) {
    console.log(`[ORACLE] 🎧 Setting up audio subscriptions for room: ${this.roomName}`);
    
    room.on('trackPublished', async (publication, participant) => {
      if (publication.kind === 'audio' && participant.identity !== BOT_IDENTITY) {
        console.log(`[ORACLE] 👂 Subscribing to ${participant.identity}`);
        await publication.setSubscribed(true);
        this.processParticipantAudio(publication.track, participant);
      }
    });
    
    room.on('trackUnpublished', (publication, participant) => {
      if (publication.kind === 'audio') {
        console.log(`[ORACLE] 👋 ${participant.identity} stopped speaking`);
      }
    });
  }
  
  processParticipantAudio(audioTrack, participant) {
    console.log(`[ORACLE] 🎧 Processing audio from ${participant.identity}`);
    
    // Update conversation context
    this.wisdomEngine.updateConversationContext(this.roomName, {
      participant: participant.identity,
      action: 'speaking',
      timestamp: new Date()
    });
    
    // Check if it's time for wisdom (cooldown logic)
    const now = Date.now();
    if (now - this.lastWisdomTime > this.wisdomCooldown) {
      // Simple demo trigger after 4-6 seconds of activity
      setTimeout(() => {
        this.triggerOracleWisdom(participant.identity, "conversation-activity");
      }, Math.random() * 2000 + 4000); // 4-6 second delay
    }
  }
  
  async triggerOracleWisdom(seekerIdentity, context) {
    try {
      console.log(`[ORACLE] 🔮 Generating wisdom for ${seekerIdentity} in ${this.roomName}`);
      
      const wisdom = await this.wisdomEngine.generateWisdom(this.roomName, seekerIdentity, context);
      await this.voiceManager.speakWisdom(this.roomName, wisdom);
      
      this.lastWisdomTime = Date.now();
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error triggering wisdom:`, error);
    }
  }
}

// Initialize Oracle services
const oracleWisdomEngine = new OracleWisdomEngine();
const oracleVoiceManager = new OracleVoiceManager();

// HTTP server to trigger room join
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

// Serve Oracle audio files
const path = require('path');
const fs = require('fs');
app.use(express.json());
app.use('/oracle-audio', express.static(path.join(process.cwd(), 'temp', 'oracle-audio')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Oracle bot server running',
    rooms: Object.keys(activeRooms),
    timestamp: new Date().toISOString(),
    oracle: 'Mulisa awakened'
  });
});
app.get('/join-room', async (req, res) => {
  const { number1, number2 } = req.query;
  if (!number1 || !number2) return res.status(400).send('Missing number1 or number2');
  try {
    const roomName = await joinExistingRoom(number1, number2);
    const botToken = await createBotToken(roomName, BOT_IDENTITY);
    res.json({ 
      success: true, 
      roomName: roomName,
      message: `Bot joined existing room: ${roomName}`,
      botToken: botToken
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to join room: ' + err.message 
    });
  }
});

// Add endpoint to manually leave a room
app.get('/leave-room', async (req, res) => {
  const { number1, number2 } = req.query;
  if (!number1 || !number2) return res.status(400).send('Missing number1 or number2');
  
  const roomName = getRoomName(number1, number2);
  
  if (!activeRooms[roomName]) {
    return res.json({ 
      success: false, 
      message: `Bot is not in room: ${roomName}` 
    });
  }
  
  try {
    await leaveRoom(roomName);
    res.json({ 
      success: true, 
      message: `Bot left room: ${roomName}` 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to leave room: ' + err.message 
    });
  }
});

// Add endpoint to get room status
app.get('/room-status', async (req, res) => {
  const { room } = req.query;
  if (!room) {
    return res.json({ 
      activeRooms: Object.keys(activeRooms),
      totalRooms: Object.keys(activeRooms).length 
    });
  }
  
  if (activeRooms[room]) {
    try {
      const participants = await roomService.listParticipants(room);
      res.json({
        room: room,
        active: true,
        participants: participants.length,
        details: activeRooms[room]
      });
    } catch (err) {
      res.json({
        room: room,
        active: true,
        participants: 'unknown',
        error: err.message
      });
    }
  } else {
    res.json({
      room: room,
      active: false
    });
  }
});

// Add endpoint to list active rooms with participant counts
app.get('/active-rooms', async (req, res) => {
  const roomData = {};
  
  for (const roomName of Object.keys(activeRooms)) {
    try {
      const participants = await roomService.listParticipants(roomName);
      const humanParticipants = participants.filter(p => p.identity !== BOT_IDENTITY);
      
      roomData[roomName] = {
        ...activeRooms[roomName],
        participantCount: humanParticipants.length,
        participants: humanParticipants.map(p => p.identity)
      };
    } catch (err) {
      roomData[roomName] = {
        ...activeRooms[roomName],
        participantCount: 'unknown',
        error: err.message
      };
    }
  }
  
  res.json({
    success: true,
    activeRooms: roomData,
    totalRooms: Object.keys(activeRooms).length
  });
});

app.listen(PORT, () => {
  console.log(`[BOT] Mulisa bot HTTP server listening on port ${PORT}`);
  console.log(`[BOT] Available endpoints:`);
  console.log(`[BOT]   GET /join-room?number1=123&number2=456 - Join a room`);
  console.log(`[BOT]   GET /leave-room?number1=123&number2=456 - Leave a room`);
  console.log(`[BOT]   GET /active-rooms - List all active rooms with participants`);
  console.log(`[BOT]   GET /room-status?room=room-name - Get specific room status`);
  console.log(`[BOT] Room monitoring: Checks every ${ROOM_CHECK_INTERVAL/1000}s, leaves after ${EMPTY_ROOM_TIMEOUT/1000}s empty`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n[BOT] Received SIGINT. Gracefully shutting down...');
  // Leave all active rooms
  const roomNames = Object.keys(activeRooms);
  for (const roomName of roomNames) {
    try {
      console.log(`[BOT] Leaving room during shutdown: ${roomName}`);
      await leaveRoom(roomName);
    } catch (err) {
      console.error(`[BOT] Error leaving room ${roomName}:`, err.message);
    }
  }
  console.log('[BOT] Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[BOT] Received SIGTERM. Gracefully shutting down...');
  // Leave all active rooms
  const roomNames = Object.keys(activeRooms);
  for (const roomName of roomNames) {
    try {
      console.log(`[BOT] Leaving room during shutdown: ${roomName}`);
      await leaveRoom(roomName);
    } catch (err) {
      console.error(`[BOT] Error leaving room ${roomName}:`, err.message);
    }
  }
  console.log('[BOT] Shutdown complete');
  process.exit(0);
});