const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const BotClient = require('./bot-client');

const app = express();
const server = http.createServer(app);

// Bot configuration
const BOT_CONFIG = {
  serverUrl: process.env.BOT_SERVER_URL || 'http://localhost:3001',
  phoneNumber: process.env.BOT_PHONE_NUMBER || '+65 8000 0000',
  botName: process.env.BOT_NAME || 'AI Assistant',
  voice: process.env.BOT_VOICE || 'en-US-Neural2-F',
  language: process.env.BOT_LANGUAGE || 'en-US',
  wakeword: process.env.BOT_WAKEWORD || 'hey sybil',
  responses: {
    precall: "Hello! I'm your AI assistant. I'm here to help facilitate this conversation.",
    greeting: "Hi there! I'm joining this call to assist you both.",
    farewell: "Thank you for the conversation. I'm here if you need anything else!"
  }
};

// Bot instance
let botClient = null;

// Initialize bot
async function initializeBot() {
  try {
    console.log('🤖 Initializing AI Assistant bot...');
    botClient = new BotClient(BOT_CONFIG);
    await botClient.start();
    console.log('✅ Bot initialized and ready to join calls');
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
  }
}

// Configure CORS for both Express and Socket.IO
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://ai-concierge-sybil.vercel.app',
      'https://ai-concierge-tgjt.vercel.app',
      'https://ai-concierge-tgjt-allardqueks-projects.vercel.app',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ]
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]; //hardcode local ip address for development; pick this up from env in future

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  // Connection stability improvements
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  transports: ['websocket', 'polling']
});

// Store peer-to-peer connections globally
const peerCodeMap = new Map(); // Map<userCode, socketId>
const activeP2PCalls = new Map(); // Map<callerCode, { targetCode, callId, botIncluded }>
const users = new Map(); // For peer connections tracking
const botSocketId = 'bot-' + uuidv4(); // Virtual socket ID for bot

// Register bot in peer code map
peerCodeMap.set(BOT_CONFIG.phoneNumber, botSocketId);
users.set(botSocketId, {
  id: botSocketId,
  username: BOT_CONFIG.phoneNumber,
  code: BOT_CONFIG.phoneNumber,
  type: 'bot',
  joinTime: new Date()
});

console.log(`🤖 Bot registered with code: ${BOT_CONFIG.phoneNumber}`);

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    users: users.size,
    timestamp: new Date().toISOString(),
    corsOrigins: allowedOrigins
  });
});

// Debug endpoint to inspect server state
app.get('/debug', (req, res) => {
  const registeredNumbers = Array.from(peerCodeMap.keys());
  const activeCalls = Array.from(activeP2PCalls.entries()).map(([caller, data]) => ({
    caller,
    target: data.targetCode,
    callId: data.callId
  }));
  
  res.json({
    timestamp: new Date().toISOString(),
    registeredNumbers: registeredNumbers,
    registeredCount: registeredNumbers.length,
    activeCalls: activeCalls,
    activeCallsCount: activeCalls.length,
    connectedSockets: io.engine.clientsCount,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Enhanced debug endpoint with detailed socket information
app.get('/debug/sockets', (req, res) => {
  const socketDetails = Array.from(users.entries()).map(([socketId, user]) => ({
    socketId,
    code: user.code,
    type: user.type,
    joinTime: user.joinTime,
    connected: true
  }));
  
  const peerMappings = Array.from(peerCodeMap.entries()).map(([code, socketId]) => ({
    code,
    socketId,
    userExists: users.has(socketId)
  }));
  
  res.json({
    timestamp: new Date().toISOString(),
    totalSockets: io.engine.clientsCount,
    socketDetails,
    peerMappings,
    activeCallsDetailed: Array.from(activeP2PCalls.entries()).map(([caller, data]) => ({
      caller,
      target: data.targetCode,
      callId: data.callId,
      callerSocketId: data.callerSocketId,
      callerExists: users.has(data.callerSocketId),
      targetExists: peerCodeMap.has(data.targetCode)
    }))
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id} at ${new Date().toISOString()}`);
  console.log(`📊 Total connected sockets: ${io.engine.clientsCount}`);

  // ========== PEER-TO-PEER CALL HANDLERS ==========

  // Join room with user code (for P2P calling)
  socket.on('join-room', ({ username }) => {
    try {
      const userCode = username; // username is actually the user's code
      console.log(`📱 User ${socket.id} joining room with code: "${userCode}" at ${new Date().toISOString()}`);
      
      // Check if this code is already registered
      const existingSocketId = peerCodeMap.get(userCode);
      if (existingSocketId && existingSocketId !== socket.id) {
        console.log(`⚠️  Code "${userCode}" was previously registered to socket ${existingSocketId}, overriding with ${socket.id}`);
      }
      
      // Map the user code to socket ID
      peerCodeMap.set(userCode, socket.id);
      
      // Store user info
      users.set(socket.id, {
        id: socket.id,
        username: userCode,
        code: userCode,
        type: 'peer',
        joinTime: new Date()
      });
      
      socket.join(userCode); // Join a room with their code
      
      console.log(`✅ User ${socket.id} successfully joined room "${userCode}"`);
      console.log(`📋 Currently registered users: ${Array.from(peerCodeMap.keys()).join(', ')}`);
      
    } catch (error) {
      console.error('❌ Error joining P2P room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle peer-to-peer call initiation
  socket.on('call-user', ({ targetCode, callerCode, offer }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n📞 === CALL INITIATION DEBUG === ${timestamp}`);
      console.log(`📱 Call request FROM: "${callerCode}" (socket: ${socket.id})`);
      console.log(`📱 Call request TO: "${targetCode}"`);
      console.log(`📋 Offer provided: ${offer ? 'YES' : 'NO'}`);
      console.log(`📊 Currently registered users: [${Array.from(peerCodeMap.keys()).join(', ')}]`);
      
      // Check if this is a direct call to the bot
      if (targetCode === BOT_CONFIG.phoneNumber) {
        console.log(`🤖 Direct call to bot detected from ${callerCode}`);
        
        // Handle as a direct bot call - no injection needed
        if (botClient && botClient.webrtcService) {
          console.log(`🤖 Bot answering direct call from ${callerCode}`);
          
          // Simulate the bot receiving the call directly
          const botCallData = {
            callerCode: callerCode,
            offer: offer,
            isDirectCall: true // Mark as direct call
          };
          
          // Have the bot handle the incoming call
          botClient.handleIncomingCall(botCallData);
          
          console.log(`✅ Bot handling direct call from ${callerCode}`);
        } else {
          console.log(`⚠️ Bot not available for direct call`);
          socket.emit('call-declined');
        }
        
        console.log(`📞 === END DIRECT BOT CALL DEBUG ===\n`);
        return;
      }
      
      const targetSocketId = peerCodeMap.get(targetCode);
      console.log(`🔍 Target socket lookup result: ${targetSocketId ? `FOUND (${targetSocketId})` : 'NOT FOUND'}`);
      
      if (targetSocketId) {
        // Store the active call
        const callId = uuidv4();
        activeP2PCalls.set(callerCode, { 
          targetCode, 
          callId, 
          callerSocketId: socket.id,
          botIncluded: true // Mark that bot is included
        });
        
        console.log(`💾 Stored active call: ${callerCode} -> ${targetCode} (callId: ${callId})`);
        console.log(`🤖 Bot will be automatically included in this call`);
        
        // Notify the target user about incoming call with offer
        io.to(targetSocketId).emit('user-calling', { 
          callerCode, 
          offer: offer // Forward the WebRTC offer
        });
        
        // Automatically inject bot into the call
        setTimeout(async () => {
          try {
            if (botClient && botClient.webrtcService) {
              console.log(`🤖 Bot joining call between ${callerCode} and ${targetCode}`);
              
              // Bot should join the existing call, not create a new one
              // We'll simulate the bot receiving the same offer that was sent to the target
              const botCallData = {
                callerCode: callerCode,
                offer: offer, // Use the same offer that was sent to the target
                isDirectCall: false // Mark as injected call
              };
              
              // Have the bot handle the incoming call automatically
              await botClient.handleIncomingCall(botCallData);
              
              console.log(`✅ Bot successfully joined existing call transparently`);
            } else {
              console.log(`⚠️ Bot not available for call injection`);
            }
          } catch (error) {
            console.error('❌ Error injecting bot into call:', error);
          }
        }, 1000); // Small delay to ensure initial call setup is complete
        
        console.log(`✅ Successfully notified ${targetCode} about incoming call from ${callerCode}`);
        console.log(`📋 Active calls: ${Array.from(activeP2PCalls.keys()).join(', ')}`);
      } else {
        // Target user not found or offline
        console.log(`❌ Target user "${targetCode}" not found in registered users`);
        console.log(`📊 Available users: [${Array.from(peerCodeMap.keys()).join(', ')}]`);
        socket.emit('call-declined');
        console.log(`📡 Sent 'call-declined' to caller ${callerCode}`);
      }
      
      console.log(`📞 === END CALL INITIATION DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling call-user:', error);
      console.error('❌ Error stack:', error.stack);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  // Handle call answer
  socket.on('answer-call', ({ callerCode, answer }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n📞 === CALL ANSWER DEBUG === ${timestamp}`);
      console.log(`📱 Call answered by socket ${socket.id} for caller "${callerCode}"`);
      console.log(`📋 Answer provided: ${answer ? 'YES' : 'NO'}`);
      
      const callerSocketId = peerCodeMap.get(callerCode);
      console.log(`🔍 Caller socket lookup result: ${callerSocketId ? `FOUND (${callerSocketId})` : 'NOT FOUND'}`);
      
      if (callerSocketId) {
        console.log(`📡 Sending answer to caller socket ${callerSocketId}...`);
        // Send the answer back to the caller
        io.to(callerSocketId).emit('call-answered', { answer });
        console.log(`✅ Answer successfully sent to ${callerCode}`);
      } else {
        console.log(`❌ Caller ${callerCode} not found when answering`);
        console.log(`📊 Available users: [${Array.from(peerCodeMap.keys()).join(', ')}]`);
      }
      
      console.log(`📞 === END CALL ANSWER DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling answer-call:', error);
      console.error('❌ Error stack:', error.stack);
    }
  });

  // Handle call decline
  socket.on('decline-call', ({ callerCode }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n📞 === CALL DECLINE DEBUG === ${timestamp}`);
      console.log(`📱 Call declined by socket ${socket.id} for caller "${callerCode}"`);
      
      const callerSocketId = peerCodeMap.get(callerCode);
      console.log(`🔍 Caller socket lookup result: ${callerSocketId ? `FOUND (${callerSocketId})` : 'NOT FOUND'}`);
      
      if (callerSocketId) {
        console.log(`📡 Sending 'call-declined' to caller socket ${callerSocketId}...`);
        io.to(callerSocketId).emit('call-declined');
        console.log(`✅ Decline notification sent to ${callerCode}`);
      }
      
      // Clean up the call record
      activeP2PCalls.delete(callerCode);
      console.log(`🧹 Cleaned up call record for ${callerCode}`);
      console.log(`📞 === END CALL DECLINE DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling decline-call:', error);
      console.error('❌ Error stack:', error.stack);
    }
  });

  // Handle call end
  socket.on('end-call', ({ targetCode, callerCode }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n📞 === CALL END DEBUG === ${timestamp}`);
      console.log(`📱 Call ended between "${callerCode}" and "${targetCode}"`);
      console.log(`📱 End initiated by socket: ${socket.id}`);
      
      // Notify the other party that the call ended
      const targetSocketId = peerCodeMap.get(targetCode);
      console.log(`🔍 Target socket lookup result: ${targetSocketId ? `FOUND (${targetSocketId})` : 'NOT FOUND'}`);
      
      if (targetSocketId) {
        console.log(`📡 Sending 'call-ended' to target socket ${targetSocketId}...`);
        io.to(targetSocketId).emit('call-ended', { fromCode: callerCode });
        console.log(`✅ Call end notification sent to ${targetCode}`);
      }
      
      // Notify the bot that the call ended (if bot is available)
      if (botClient && botClient.webrtcService) {
        console.log(`🤖 Notifying bot that call ended between ${callerCode} and ${targetCode}`);
        
        // Clean up bot's connections to both parties
        botClient.webrtcService.cleanup(callerCode);
        botClient.webrtcService.cleanup(targetCode);
        
        // Reset bot's current call state
        if (botClient.currentCall && 
            (botClient.currentCall.callerCode === callerCode || 
             botClient.currentCall.callerCode === targetCode)) {
          console.log(`🤖 Bot cleaning up call state`);
          botClient.currentCall = null;
          botClient.stopRecording();
        }
        
        console.log(`✅ Bot connections cleaned up for ended call`);
      }
      
      // Clean up the call record
      activeP2PCalls.delete(callerCode);
      activeP2PCalls.delete(targetCode); // Clean up both directions
      console.log(`🧹 Cleaned up call records for ${callerCode} and ${targetCode}`);
      console.log(`📋 Remaining active calls: ${Array.from(activeP2PCalls.keys()).join(', ') || 'NONE'}`);
      console.log(`📞 === END CALL END DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling end-call:', error);
      console.error('❌ Error stack:', error.stack);
    }
  });

  // Handle ICE candidate exchange (CRITICAL for WebRTC connections)
  socket.on('ice-candidate', ({ candidate, targetUserId }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n🧊 === ICE CANDIDATE DEBUG === ${timestamp}`);
      console.log(`🧊 ICE candidate FROM socket: ${socket.id}`);
      console.log(`🧊 ICE candidate TO user: "${targetUserId}"`);
      console.log(`🧊 Candidate data: ${candidate ? 'PROVIDED' : 'MISSING'}`);
      if (candidate && candidate.candidate) {
        console.log(`🧊 Candidate type: ${candidate.candidate.includes('typ srflx') ? 'STUN' : candidate.candidate.includes('typ relay') ? 'TURN' : 'HOST'}`);
      }
      
      const targetSocketId = peerCodeMap.get(targetUserId);
      console.log(`🔍 Target socket lookup result: ${targetSocketId ? `FOUND (${targetSocketId})` : 'NOT FOUND'}`);
      
      if (targetSocketId) {
        console.log(`📡 Forwarding ICE candidate to socket ${targetSocketId}...`);
        // Forward the ICE candidate to the target user
        io.to(targetSocketId).emit('ice-candidate', { candidate });
        console.log(`✅ ICE candidate successfully forwarded to ${targetUserId}`);
      } else {
        console.log(`❌ Target user ${targetUserId} not found for ICE candidate`);
        console.log(`📊 Available users: [${Array.from(peerCodeMap.keys()).join(', ')}]`);
      }
      
      console.log(`🧊 === END ICE CANDIDATE DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling ice-candidate:', error);
      console.error('❌ Error stack:', error.stack);
    }
  });

  // Handle bot-specific events
  socket.on('bot-answer-call', ({ callerCode, answer }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n🤖 === BOT ANSWER DEBUG === ${timestamp}`);
      console.log(`🤖 Bot answering call from "${callerCode}"`);
      
      const callerSocketId = peerCodeMap.get(callerCode);
      if (callerSocketId) {
        console.log(`📡 Bot sending answer to ${callerCode}`);
        io.to(callerSocketId).emit('call-answered', { answer });
        console.log(`✅ Bot answer sent successfully`);
      }
      
      console.log(`🤖 === END BOT ANSWER DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling bot answer:', error);
    }
  });

  socket.on('bot-ice-candidate', ({ candidate, targetUserId }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n🤖 === BOT ICE CANDIDATE DEBUG === ${timestamp}`);
      console.log(`🤖 Bot ICE candidate TO: "${targetUserId}"`);
      
      const targetSocketId = peerCodeMap.get(targetUserId);
      if (targetSocketId) {
        console.log(`📡 Bot forwarding ICE candidate to ${targetUserId}`);
        io.to(targetSocketId).emit('ice-candidate', { candidate });
        console.log(`✅ Bot ICE candidate forwarded successfully`);
      }
      
      console.log(`🤖 === END BOT ICE CANDIDATE DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling bot ICE candidate:', error);
    }
  });

  // Handle bot call end notification
  socket.on('bot-call-ended', ({ callerCode, targetCode }) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n🤖 === BOT CALL END DEBUG === ${timestamp}`);
      console.log(`🤖 Bot call ended between "${callerCode}" and "${targetCode}"`);
      
      // Bot has already cleaned up its connections, just log the event
      console.log(`✅ Bot call cleanup completed`);
      console.log(`🤖 === END BOT CALL END DEBUG ===\n`);
      
    } catch (error) {
      console.error('❌ Error handling bot call end:', error);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const timestamp = new Date().toISOString();
    console.log(`\n🔌 === USER DISCONNECT DEBUG === ${timestamp}`);
    console.log(`🔌 User disconnected: ${socket.id}`);
    console.log(`📊 Remaining connected sockets: ${io.engine.clientsCount - 1}`);
    
    const user = users.get(socket.id);
    if (user) {
      console.log(`👤 Disconnected user info: code="${user.code}", type="${user.type}", joined=${user.joinTime}`);
      
      // Handle peer-to-peer disconnection cleanup
      if (user.type === 'peer' && user.code) {
        console.log(`🧹 Cleaning up peer "${user.code}" (socket: ${socket.id})`);
        
        // Remove from peer code map
        peerCodeMap.delete(user.code);
        console.log(`🗑️  Removed "${user.code}" from peer code map`);
        
        // Clean up any active P2P calls involving this user
        let cleanedCalls = 0;
        for (const [callerCode, call] of activeP2PCalls.entries()) {
          if (call.targetCode === user.code || callerCode === user.code) {
            console.log(`📞 Found active call involving disconnected user: ${callerCode} -> ${call.targetCode}`);
            
            // Notify the other party that the call ended
            const otherCode = call.targetCode === user.code ? callerCode : call.targetCode;
            const otherSocketId = peerCodeMap.get(otherCode);
            console.log(`🔍 Other party: "${otherCode}", socket: ${otherSocketId ? `FOUND (${otherSocketId})` : 'NOT FOUND'}`);
            
            if (otherSocketId) {
              console.log(`📡 Sending 'call-ended' to ${otherCode} (socket: ${otherSocketId})`);
              io.to(otherSocketId).emit('call-ended', { fromCode: user.code });
            }
            
            // Clean up bot connections for this call
            if (botClient && botClient.webrtcService) {
              console.log(`🤖 Cleaning up bot connections for disconnected user ${user.code}`);
              botClient.webrtcService.cleanup(callerCode);
              botClient.webrtcService.cleanup(call.targetCode);
              
              // Reset bot's current call state if it was involved
              if (botClient.currentCall && 
                  (botClient.currentCall.callerCode === callerCode || 
                   botClient.currentCall.callerCode === call.targetCode)) {
                console.log(`🤖 Bot cleaning up call state due to user disconnect`);
                botClient.currentCall = null;
                botClient.stopRecording();
              }
            }
            
            activeP2PCalls.delete(callerCode);
            cleanedCalls++;
          }
        }
        
        console.log(`🧹 Cleaned up ${cleanedCalls} active calls`);
        console.log(`📋 Remaining registered users: [${Array.from(peerCodeMap.keys()).join(', ') || 'NONE'}]`);
        console.log(`📋 Remaining active calls: [${Array.from(activeP2PCalls.keys()).join(', ') || 'NONE'}]`);
      }
      
      users.delete(socket.id);
      console.log(`🗑️  Removed user from users map`);
    } else {
      console.log(`⚠️  No user info found for disconnected socket ${socket.id}`);
    }
    
    console.log(`🔌 === END USER DISCONNECT DEBUG ===\n`);
  });

  // Handle manual leave room (legacy - can be removed if not needed)
  socket.on('leave-room', () => {
    const user = users.get(socket.id);
    if (user && user.type === 'peer') {
      users.delete(socket.id);
      socket.emit('left-room');
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Voice Chat Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS origins: ${allowedOrigins.join(', ')}`);
  
  // Initialize the bot after server is ready
  await initializeBot();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
