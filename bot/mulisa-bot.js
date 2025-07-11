// Load environment variables based on NODE_ENV
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.local';
dotenv.config({ path: envFile });

const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
const { Room } = require('livekit-client');
const express = require('express');
const cors = require('cors');

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const BOT_IDENTITY = process.env.LIVEKIT_BOT_IDENTITY || 'mulisa-bot';

const activeRooms = {};
const roomMonitoringIntervals = {};
const livekitRooms = {};

// Room cleanup configuration
const ROOM_CHECK_INTERVAL = 30000; // Check every 30 seconds
const EMPTY_ROOM_TIMEOUT = 60000; // Wait 1 minute before leaving empty room

// Debug environment variables
console.log(`[BOT] LIVEKIT_URL: ${LIVEKIT_URL}`);
console.log(`[BOT] LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}`);
console.log(`[BOT] LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET ? 'SET (' + LIVEKIT_API_SECRET.length + ' chars)' : 'NOT SET'}`);

// Initialize room service client
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

function getRoomName(numberA, numberB) {
  // Validate that both numbers are provided and non-empty
  if (!numberA || !numberB) {
    throw new Error(`Invalid phone numbers: numberA="${numberA}", numberB="${numberB}". Both numbers must be provided.`);
  }
  
  // Normalize both numbers to ensure consistent room naming (matching client logic)
  const normalizeForRoom = (phoneNumber) => {
    const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    
    // Handle 8-digit Singapore mobile numbers (without country code)
    if (digitsOnly.length === 8 && (digitsOnly.startsWith('8') || digitsOnly.startsWith('9'))) {
      return `65${digitsOnly}`; // Add 65 prefix for consistency
    }
    
    // Handle numbers that already have 65 prefix
    if (digitsOnly.startsWith('65') && digitsOnly.length === 10) {
      return digitsOnly;
    }
    
    // Return as-is if we can't normalize
    return digitsOnly;
  };
  
  const cleanA = normalizeForRoom(numberA);
  const cleanB = normalizeForRoom(numberB);
  
  // Validate that cleaning didn't result in empty strings
  if (!cleanA || !cleanB) {
    throw new Error(`Invalid phone numbers after cleaning: cleanA="${cleanA}", cleanB="${cleanB}". Numbers must contain digits.`);
  }
  
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
  console.log(`[BOT] Attempting to join room with numbers: numberA="${numberA}", numberB="${numberB}"`);
  
  let roomName;
  try {
    roomName = getRoomName(numberA, numberB);
    console.log(`[BOT] Generated room name: ${roomName}`);
  } catch (err) {
    console.error(`[BOT] Error generating room name:`, err.message);
    throw err;
  }
  
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
    });
    
    room.on('disconnected', () => {
      console.log(`[BOT] 🔴 Disconnected from LiveKit room: ${roomName}`);
    });
    
    room.on('participantConnected', (participant) => {
      console.log(`[BOT] 👋 Participant joined: ${participant.identity}`);
    });
    
    room.on('participantDisconnected', (participant) => {
      console.log(`[BOT] 👋 Participant left: ${participant.identity}`);
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
    
    // Here you could add logic to:
    // 1. Set up audio processing for the room
    // 2. Initialize AI transcription services
    // 3. Start oracle wisdom processing
    // 4. Begin conversation analysis
    
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
  
  // Here you could add cleanup logic such as:
  // 1. Stop AI transcription services
  // 2. Save conversation summary
  // 3. Send final oracle insights
  // 4. Clean up any temporary files
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
  
  let roomName;
  try {
    roomName = getRoomName(number1, number2);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone numbers: ' + err.message
    });
  }
  
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