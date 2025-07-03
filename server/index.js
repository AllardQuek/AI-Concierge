const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Configure CORS for both Express and Socket.IO
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://ai-concierge-sybil.vercel.app',
      'https://ai-concierge-tgjt.vercel.app',
      'https://ai-concierge-tgjt-allardqueks-projects.vercel.app',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ]
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

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
const activeP2PCalls = new Map(); // Map<callerCode, { targetCode, callId }>
const users = new Map(); // For peer connections tracking

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
    connectedSockets: io.engine.clientsCount
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ========== PEER-TO-PEER CALL HANDLERS ==========

  // Join room with user code (for P2P calling)
  socket.on('join-room', ({ username }) => {
    try {
      const userCode = username; // username is actually the user's code
      console.log(`User ${socket.id} joining room with code: ${userCode}`);
      
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
      console.log(`User ${socket.id} joined room ${userCode}`);
      
    } catch (error) {
      console.error('Error joining P2P room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle peer-to-peer call initiation
  socket.on('call-user', ({ targetCode, callerCode, offer }) => {
    try {
      console.log(`Call request from ${callerCode} to ${targetCode}`);
      
      const targetSocketId = peerCodeMap.get(targetCode);
      
      if (targetSocketId) {
        // Store the active call
        const callId = uuidv4();
        activeP2PCalls.set(callerCode, { targetCode, callId, callerSocketId: socket.id });
        
        // Notify the target user about incoming call with offer
        io.to(targetSocketId).emit('user-calling', { 
          callerCode, 
          offer: offer // Forward the WebRTC offer
        });
        
        console.log(`Notified ${targetCode} about incoming call from ${callerCode} with offer`);
      } else {
        // Target user not found or offline
        socket.emit('call-declined');
        console.log(`Target user ${targetCode} not found`);
      }
      
    } catch (error) {
      console.error('Error handling call-user:', error);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  // Handle call answer
  socket.on('answer-call', ({ callerCode, answer }) => {
    try {
      console.log(`Call answered by ${socket.id} for caller ${callerCode}`);
      
      const callerSocketId = peerCodeMap.get(callerCode);
      
      if (callerSocketId) {
        // Send the answer back to the caller
        io.to(callerSocketId).emit('call-answered', { answer });
        console.log(`Answer sent to ${callerCode}`);
      } else {
        console.log(`Caller ${callerCode} not found when answering`);
      }
      
    } catch (error) {
      console.error('Error handling answer-call:', error);
    }
  });

  // Handle call decline
  socket.on('decline-call', ({ callerCode }) => {
    try {
      console.log(`Call declined by ${socket.id} for caller ${callerCode}`);
      
      const callerSocketId = peerCodeMap.get(callerCode);
      
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-declined');
        console.log(`Decline notification sent to ${callerCode}`);
      }
      
      // Clean up the call record
      activeP2PCalls.delete(callerCode);
      
    } catch (error) {
      console.error('Error handling decline-call:', error);
    }
  });

  // Handle call end
  socket.on('end-call', ({ targetCode, callerCode }) => {
    try {
      console.log(`Call ended between ${callerCode} and ${targetCode}`);
      
      // Notify the other party that the call ended
      const targetSocketId = peerCodeMap.get(targetCode);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-ended', { fromCode: callerCode });
        console.log(`Call end notification sent to ${targetCode}`);
      }
      
      // Clean up the call record
      activeP2PCalls.delete(callerCode);
      activeP2PCalls.delete(targetCode); // Clean up both directions
      
    } catch (error) {
      console.error('Error handling end-call:', error);
    }
  });

  // Handle ICE candidate exchange (CRITICAL for WebRTC connections)
  socket.on('ice-candidate', ({ candidate, targetUserId }) => {
    try {
      console.log(`ICE candidate from ${socket.id} to ${targetUserId}`);
      
      const targetSocketId = peerCodeMap.get(targetUserId);
      
      if (targetSocketId) {
        // Forward the ICE candidate to the target user
        io.to(targetSocketId).emit('ice-candidate', { candidate });
        console.log(`ICE candidate forwarded to ${targetUserId}`);
      } else {
        console.log(`Target user ${targetUserId} not found for ICE candidate`);
      }
      
    } catch (error) {
      console.error('Error handling ice-candidate:', error);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const user = users.get(socket.id);
    if (user) {
      // Handle peer-to-peer disconnection cleanup
      if (user.type === 'peer' && user.code) {
        console.log(`Peer ${user.code} disconnected`);
        
        // Remove from peer code map
        peerCodeMap.delete(user.code);
        
        // Clean up any active P2P calls involving this user
        for (const [callerCode, call] of activeP2PCalls.entries()) {
          if (call.targetCode === user.code || callerCode === user.code) {
            // Notify the other party that the call ended
            const otherCode = call.targetCode === user.code ? callerCode : call.targetCode;
            const otherSocketId = peerCodeMap.get(otherCode);
            if (otherSocketId) {
              io.to(otherSocketId).emit('call-ended', { fromCode: user.code });
            }
            activeP2PCalls.delete(callerCode);
          }
        }
      }
      
      users.delete(socket.id);
    }
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Voice Chat Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
