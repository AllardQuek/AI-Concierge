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
  }
});

// Store active rooms, users, agents, and customers
const rooms = new Map();
const users = new Map();
const agents = new Map(); // Available agents
const customers = new Map(); // Waiting customers
const activeCalls = new Map(); // Active customer-agent calls

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    rooms: rooms.size, 
    users: users.size,
    timestamp: new Date().toISOString(),
    corsOrigins: allowedOrigins
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Agent login
  socket.on('agent-login', ({ agentName }) => {
    try {
      const agent = {
        id: socket.id,
        name: agentName,
        status: 'available',
        loginTime: new Date()
      };
      
      agents.set(socket.id, agent);
      users.set(socket.id, { ...agent, type: 'agent' });
      
      console.log(`Agent ${agentName} logged in: ${socket.id}`);
      
      socket.emit('agent-logged-in', { agent });
      
    } catch (error) {
      console.error('Error in agent login:', error);
      socket.emit('error', { message: 'Failed to login as agent' });
    }
  });

  // Agent status change
  socket.on('agent-status-change', ({ status }) => {
    try {
      const agent = agents.get(socket.id);
      if (agent) {
        agent.status = status;
        console.log(`Agent ${agent.name} status changed to: ${status}`);
      }
    } catch (error) {
      console.error('Error changing agent status:', error);
    }
  });

  // Customer request call
  socket.on('customer-request-call', ({ customerName }) => {
    try {
      const customer = {
        id: socket.id,
        name: customerName,
        requestTime: new Date()
      };
      
      customers.set(socket.id, customer);
      users.set(socket.id, { ...customer, type: 'customer' });
      
      console.log(`Customer ${customerName} requesting call: ${socket.id}`);
      
      // Find available agent
      const availableAgent = Array.from(agents.values())
        .find(agent => agent.status === 'available');
      
      if (availableAgent) {
        // Notify agent of incoming call
        io.to(availableAgent.id).emit('incoming-call', {
          customerName: customer.name,
          customerId: customer.id
        });
        
        socket.emit('agent-available');
        console.log(`Notified agent ${availableAgent.name} of incoming call from ${customerName}`);
      } else {
        socket.emit('no-agents-available');
        console.log(`No agents available for customer ${customerName}`);
      }
      
    } catch (error) {
      console.error('Error in customer call request:', error);
      socket.emit('error', { message: 'Failed to request call' });
    }
  });

  // Agent accept call
  socket.on('agent-accept-call', ({ customerId }) => {
    try {
      const agent = agents.get(socket.id);
      const customer = customers.get(customerId);
      
      if (agent && customer) {
        // Create active call
        const call = {
          customerId: customer.id,
          agentId: agent.id,
          startTime: new Date()
        };
        
        activeCalls.set(customer.id, call);
        
        // Update agent status
        agent.status = 'busy';
        
        // Notify customer that call was accepted
        io.to(customer.id).emit('call-accepted');
        
        console.log(`Agent ${agent.name} accepted call from ${customer.name}`);
      }
      
    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit('error', { message: 'Failed to accept call' });
    }
  });

  // Agent decline call
  socket.on('agent-decline-call', ({ customerId }) => {
    try {
      const agent = agents.get(socket.id);
      const customer = customers.get(customerId);
      
      if (agent && customer) {
        // Notify customer that call was declined
        io.to(customer.id).emit('call-declined');
        
        console.log(`Agent ${agent.name} declined call from ${customer.name}`);
        
        // Try to find another available agent
        const anotherAgent = Array.from(agents.values())
          .find(a => a.status === 'available' && a.id !== agent.id);
        
        if (anotherAgent) {
          io.to(anotherAgent.id).emit('incoming-call', {
            customerName: customer.name,
            customerId: customer.id
          });
        } else {
          io.to(customer.id).emit('no-agents-available');
        }
      }
      
    } catch (error) {
      console.error('Error declining call:', error);
    }
  });

  // Customer end call
  socket.on('customer-end-call', () => {
    try {
      const customer = customers.get(socket.id);
      if (customer) {
        const call = activeCalls.get(customer.id);
        if (call) {
          // Notify agent
          io.to(call.agentId).emit('customer-disconnected');
          
          // Update agent status back to available
          const agent = agents.get(call.agentId);
          if (agent) {
            agent.status = 'available';
          }
          
          activeCalls.delete(customer.id);
          console.log(`Customer ${customer.name} ended call`);
        }
      }
    } catch (error) {
      console.error('Error ending customer call:', error);
    }
  });

  // Agent end call
  socket.on('agent-end-call', ({ customerId }) => {
    try {
      const agent = agents.get(socket.id);
      const call = activeCalls.get(customerId);
      
      if (agent && call) {
        // Notify customer
        io.to(customerId).emit('agent-disconnected');
        
        // Update agent status back to available
        agent.status = 'available';
        
        activeCalls.delete(customerId);
        console.log(`Agent ${agent.name} ended call`);
      }
    } catch (error) {
      console.error('Error ending agent call:', error);
    }
  });

  // Handle user joining a room
  socket.on('join-room', ({ username, roomId }) => {
    try {
      // Generate room ID if not provided
      const finalRoomId = roomId || uuidv4();
      
      // Check if room exists and has space
      if (rooms.has(finalRoomId) && rooms.get(finalRoomId).users.length >= 2) {
        socket.emit('room-full');
        return;
      }

      // Create room if it doesn't exist
      if (!rooms.has(finalRoomId)) {
        rooms.set(finalRoomId, {
          id: finalRoomId,
          users: [],
          createdAt: new Date()
        });
      }

      const room = rooms.get(finalRoomId);
      const user = {
        id: socket.id,
        username: username || `User-${socket.id.substring(0, 6)}`,
        joinedAt: new Date()
      };

      // Add user to room and socket room
      room.users.push(user);
      users.set(socket.id, { ...user, roomId: finalRoomId });
      socket.join(finalRoomId);

      console.log(`User ${user.username} joined room ${finalRoomId}`);

      // Notify user of successful join
      socket.emit('room-joined', {
        roomId: finalRoomId,
        user: user,
        roomUsers: room.users
      });

      // Notify other users in the room
      socket.to(finalRoomId).emit('user-joined', {
        user: user,
        roomUsers: room.users
      });

      // If this is the second user, both can start the call
      if (room.users.length === 2) {
        io.to(finalRoomId).emit('room-ready', {
          roomUsers: room.users
        });
      }

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle WebRTC signaling (updated for role-based system)
  socket.on('offer', ({ offer, targetUserId }) => {
    console.log(`Offer from ${socket.id} to ${targetUserId || 'auto-detect'}`);
    console.log('Current active calls:', Array.from(activeCalls.entries()));
    console.log('Current users:', Array.from(users.entries()));
    
    // Auto-detect target based on active call relationship
    const user = users.get(socket.id);
    let actualTargetId = null;
    
    console.log(`User sending offer: ${user?.type} (${socket.id})`);
    
    if (user && user.type === 'agent') {
      // Agent sending offer to customer
      const call = Array.from(activeCalls.values())
        .find(call => call.agentId === socket.id);
      if (call) {
        actualTargetId = call.customerId;
        console.log(`Found call for agent, target customer: ${actualTargetId}`);
      } else {
        console.log('No active call found for agent');
      }
    } else if (user && user.type === 'customer') {
      // Customer sending offer to agent
      const call = activeCalls.get(socket.id);
      if (call) {
        actualTargetId = call.agentId;
        console.log(`Found call for customer, target agent: ${actualTargetId}`);
      } else {
        console.log('No active call found for customer');
      }
    }
    
    if (actualTargetId) {
      console.log(`Routing offer from ${socket.id} to ${actualTargetId}`);
      socket.to(actualTargetId).emit('offer', {
        offer,
        fromUserId: socket.id
      });
    } else {
      console.log(`No active call found for offer from ${socket.id}`);
    }
  });

  socket.on('answer', ({ answer, targetUserId }) => {
    console.log(`Answer from ${socket.id} to ${targetUserId || 'auto-detect'}`);
    
    // Auto-detect target based on active call relationship
    const user = users.get(socket.id);
    let actualTargetId = null;
    
    if (user && user.type === 'agent') {
      // Agent sending answer to customer
      const call = Array.from(activeCalls.values())
        .find(call => call.agentId === socket.id);
      if (call) {
        actualTargetId = call.customerId;
      }
    } else if (user && user.type === 'customer') {
      // Customer sending answer to agent
      const call = activeCalls.get(socket.id);
      if (call) {
        actualTargetId = call.agentId;
      }
    }
    
    if (actualTargetId) {
      console.log(`Routing answer from ${socket.id} to ${actualTargetId}`);
      socket.to(actualTargetId).emit('answer', {
        answer,
        fromUserId: socket.id
      });
    } else {
      console.log(`No active call found for answer from ${socket.id}`);
    }
  });

  socket.on('ice-candidate', ({ candidate, targetUserId }) => {
    console.log(`ICE candidate from ${socket.id} to ${targetUserId || 'auto-detect'}`);
    
    // Auto-detect target based on active call relationship
    const user = users.get(socket.id);
    let actualTargetId = null;
    
    if (user && user.type === 'agent') {
      // Agent sending ICE candidate to customer
      const call = Array.from(activeCalls.values())
        .find(call => call.agentId === socket.id);
      if (call) {
        actualTargetId = call.customerId;
      }
    } else if (user && user.type === 'customer') {
      // Customer sending ICE candidate to agent
      const call = activeCalls.get(socket.id);
      if (call) {
        actualTargetId = call.agentId;
      }
    }
    
    if (actualTargetId) {
      console.log(`Routing ICE candidate from ${socket.id} to ${actualTargetId}`);
      socket.to(actualTargetId).emit('ice-candidate', {
        candidate,
        fromUserId: socket.id
      });
    } else {
      console.log(`No active call found for ICE candidate from ${socket.id}`);
    }
  });

  // Handle mute/unmute status
  socket.on('audio-status', ({ isMuted }) => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        socket.to(user.roomId).emit('user-audio-status', {
          userId: socket.id,
          isMuted
        });
      }
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const user = users.get(socket.id);
    if (user) {
      if (user.type === 'agent') {
        // Agent disconnected
        const agent = agents.get(socket.id);
        if (agent) {
          console.log(`Agent ${agent.name} disconnected`);
          
          // Find any active calls with this agent
          const activeCalls_array = Array.from(activeCalls.entries());
          for (const [customerId, call] of activeCalls_array) {
            if (call.agentId === socket.id) {
              // Notify customer that agent disconnected
              io.to(customerId).emit('agent-disconnected');
              activeCalls.delete(customerId);
            }
          }
          
          agents.delete(socket.id);
        }
      } else if (user.type === 'customer') {
        // Customer disconnected
        const customer = customers.get(socket.id);
        if (customer) {
          console.log(`Customer ${customer.name} disconnected`);
          
          // Find active call
          const call = activeCalls.get(socket.id);
          if (call) {
            // Notify agent that customer disconnected
            io.to(call.agentId).emit('customer-disconnected');
            
            // Update agent status back to available
            const agent = agents.get(call.agentId);
            if (agent) {
              agent.status = 'available';
            }
            
            activeCalls.delete(socket.id);
          }
          
          customers.delete(socket.id);
        }
      } else {
        // Legacy room-based system
        const room = rooms.get(user.roomId);
        if (room) {
          room.users = room.users.filter(u => u.id !== socket.id);
          
          socket.to(user.roomId).emit('user-left', {
            userId: socket.id,
            username: user.username,
            roomUsers: room.users
          });

          if (room.users.length === 0) {
            rooms.delete(user.roomId);
            console.log(`Room ${user.roomId} deleted - no users remaining`);
          }
        }
      }
      
      users.delete(socket.id);
    }
  });

  // Handle manual leave room
  socket.on('leave-room', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.leave(user.roomId);
      const room = rooms.get(user.roomId);
      if (room) {
        room.users = room.users.filter(u => u.id !== socket.id);
        socket.to(user.roomId).emit('user-left', {
          userId: socket.id,
          username: user.username,
          roomUsers: room.users
        });
        
        if (room.users.length === 0) {
          rooms.delete(user.roomId);
        }
      }
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
