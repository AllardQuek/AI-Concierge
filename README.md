# Mulisa - WebRTC Voice Calling Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![React](https://img.shields.io/badge/react-18.2.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue)

A modern voice calling platform built with React (TypeScript), Node.js, and WebRTC. Named after the prophetic oracles of ancient Greece, Mulisa provides direct peer-to-peer voice communication using phone number identifiers.

## 🎯 Current Status

- ✅ **Core Voice Platform**: WebRTC P2P communication with ultra-low latency
- ✅ **Phone Number System**: Singapore (+65) number generation and international support
- ✅ **Single-Page Interface**: Streamlined calling experience with all states managed
- ✅ **Mobile-Friendly**: Touch-optimized interface with vibration support
- ✅ **Multi-Tab Support**: Each browser tab gets its own unique phone number

## 🔮 About Mulisa

Named after the prophetic oracles of ancient Greece, Mulisa provides a simple yet powerful voice calling experience. Users get assigned virtual phone numbers and can call each other directly through their browsers using WebRTC technology.

## 🚀 Features

- **Phone Number Based Calling**: Each user gets a virtual Singapore phone number (+65 format)
- **Direct P2P Voice Communication**: Audio streams directly between users (no server relay)
- **WebRTC Technology**: Ultra-low latency voice transmission
- **Modern Single-Page Interface**: All call states managed in one clean interface
- **International Number Support**: Smart formatting for Singapore, US, UK, and other countries
- **Enter Key Support**: Quick calling by pressing Enter in the phone input
- **Real-Time Call Management**: Incoming calls, call duration, mute/unmute functionality
- **Mobile Optimized**: Vibration feedback and touch-friendly controls
- **Multi-Tab Friendly**: Each browser tab gets its own unique number
- **Connection Status**: Real-time connection and availability indicators
- **TypeScript**: Full type safety across the entire application
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🏗️ Architecture

### WebRTC Peer-to-Peer Communication

```
User A Browser ←──── WebRTC Direct ────→ User B Browser
       │                                        │
       └── Socket.IO ──→ Server ←── Socket.IO ──┘
           (Signaling Only)
```

**Key Architecture Points:**
- **Server Role**: Only handles signaling (call setup, ICE candidates, call status)
- **Audio Data**: Flows directly peer-to-peer between browsers (never touches server)
- **Benefits**: Lower latency, better quality, server scalability, enhanced privacy

### What Goes Through the Server (Socket.IO):
- ✅ Call initiation requests
- ✅ WebRTC offer/answer exchange
- ✅ ICE candidates for NAT traversal
- ✅ Call status updates (answered, declined, ended)

### What Goes Peer-to-Peer (WebRTC):
- 🎙️ **Audio data** (real-time voice streams)
- � **All media content**
- 📱 **Direct browser-to-browser communication**

## �🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for modern styling
- **WebRTC API** for peer-to-peer audio
- **Socket.IO Client** for signaling

### Backend
- **Node.js** with Express
- **Socket.IO** for WebRTC signaling only
- **CORS** enabled for cross-origin requests

## 📋 Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Modern browser** with WebRTC support (Chrome, Firefox, Safari, Edge)
- **HTTPS** (required for WebRTC getUserMedia in production)

### Development Mode (Recommended)
Run both server and client simultaneously:
```bash
npm run dev
```

This will start:
- **Server**: http://localhost:3001
- **Client**: http://localhost:3000

### Manual Start
Start server and client separately:

1. **Start the server**:
   ```bash
   npm run server:dev
   ```

2. **Start the client** (in a new terminal):
   ```bash
   npm run client:dev
   ```

## 📱 How to Use

1. **Connect**: Click "Connect" to connect to the voice server
2. **Enter Details**: Provide your name and optionally a room ID
3. **Join Room**: Click "Join Room" to enter a voice room
4. **Grant Permissions**: Allow microphone access when prompted
5. **Wait for Partner**: The app will wait for another user to join
6. **Start Talking**: Once connected, you can start your voice conversation
7. **Controls**: Use the mute button to toggle your microphone, end call button to leave

## 🔧 Configuration

### Server Configuration
The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable:
```bash
PORT=8000 npm run server:dev
```

### Client Configuration
The client connects to `http://localhost:3001` by default. To change the server URL, modify the `SocketService` constructor in `client/src/services/socket.ts`.

## ⚙️ Environment Variables

### Client Environment Variables

The client uses Vite environment variables (prefixed with `VITE_`):

**Development (`.env.local`):**
```bash
VITE_SERVER_URL=http://localhost:3001
VITE_BOT_SERVER_URL=http://localhost:4000
VITE_LIVEKIT_URL=wss://your-livekit-url
VITE_LIVEKIT_API_KEY=your-api-key
VITE_LIVEKIT_API_SECRET=your-api-secret
VITE_LIVEKIT_TOKEN_URL=${VITE_SERVER_URL}/api/get-livekit-token
```

**Production (`.env.production`):**
```bash
VITE_SERVER_URL=https://your-production-server.com
VITE_BOT_SERVER_URL=https://your-bot-server.com
VITE_LIVEKIT_URL=wss://your-livekit-url
VITE_LIVEKIT_API_KEY=your-api-key
VITE_LIVEKIT_API_SECRET=your-api-secret
VITE_LIVEKIT_TOKEN_URL=https://your-production-server.com/api/get-livekit-token
```

**Key Variables:**
- `VITE_SERVER_URL`: Main backend server URL for signaling and API calls
- `VITE_BOT_SERVER_URL`: Oracle bot server URL for AI oracle invitations and management
- `VITE_LIVEKIT_*`: LiveKit configuration for advanced voice features

### Server Environment Variables

The server can be configured via environment variables:

```bash
PORT=3001                           # Server port (default: 3001)
NODE_ENV=development                # Environment mode
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com  # CORS origins
```

### Oracle Bot Environment Variables

The Oracle AI bot requires additional configuration:

**Development (`.env.local`):**
```bash
# Core LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-server-url
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Oracle AI Configuration
OPENAI_API_KEY=your-openai-api-key-here
LIVEKIT_BOT_IDENTITY=mulisa-oracle
ORACLE_PERSONALITY=mystical-sage
WISDOM_FREQUENCY=moderate
ENABLE_TTS=false

# Bot Server Configuration
BOT_PORT=4000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Key Oracle Variables:**
- `OPENAI_API_KEY`: Required for Oracle AI wisdom generation
- `LIVEKIT_BOT_IDENTITY`: Bot identity in LiveKit rooms (default: mulisa-oracle)
- `ORACLE_PERSONALITY`: Oracle personality style (default: mystical-sage)
- `ENABLE_TTS`: Enable text-to-speech audio injection (requires OpenAI API)

## 🌐 Deployment

Ready to deploy your Mulisa voice platform? We support both free and paid hosting options.

### 🆓 Quick Deploy (Free)
**Backend:** Render.com | **Frontend:** Vercel

```bash
# Ensure everything is ready
npm run deploy:prep
```

**📖 Complete Guide:** [`docs/main/DEPLOYMENT.md`](docs/main/DEPLOYMENT.md)

### Deployment Options
- **Free Tier**: Render + Vercel (perfect for POCs)
- **Premium**: Railway + Vercel (no cold starts)
- **Enterprise**: AWS/GCP + CDN

### Security Requirements
- **HTTPS Required**: WebRTC requires HTTPS for microphone access
- **CORS Configured**: Environment-based origin control
- **Environment Variables**: Secure configuration management

## 📚 Documentation

### Architecture Documentation
- **[Architecture Overview](docs/architecture-visual.html)** - Interactive visual architecture diagrams
- **[Port Configuration](docs/main/port-configuration.md)** - Service ports and networking setup
- **[Architecture Decision Records (ADRs)](docs/decisions/README.md)** - Documented design decisions and rationale

### Key Design Decisions
- **[ADR-001: Persistent Socket Connections](docs/decisions/001-persistent-socket-connections.md)** - Why we maintain idle connections
- **[ADR-002: WebRTC Signaling Architecture](docs/decisions/002-webrtc-signaling-architecture.md)** - Socket.IO for WebRTC signaling
- **[ADR-003: Port Configuration Strategy](docs/decisions/003-port-configuration-strategy.md)** - Service port allocation and conflicts

### Development Documentation  
- **[Project Summary](docs/main/project-summary.md)** - High-level project overview
- **[Development Status](docs/main/development-status.md)** - Current status and next steps
- **[Git Workflow](docs/main/git-workflow.md)** - Development and deployment workflow

## 🧩 Project Structure

```
voice-bot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── services/      # WebRTC and Socket services
│   │   ├── App.tsx        # Main application component
│   │   └── main.tsx       # Application entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                # Node.js backend
│   ├── index.js          # Server entry point
│   └── package.json
├── .github/
│   └── copilot-instructions.md
├── package.json          # Root package.json
└── README.md
```

## 🔍 Troubleshooting

### Common Issues

1. **Node.js Version Error**:
   - Update to Node.js 18+ using NVM or official installer

2. **Microphone Access Denied**:
   - Check browser permissions
   - Ensure HTTPS in production
   - Try refreshing the page

3. **Connection Failed**:
   - Ensure server is running on port 3001
   - Check firewall settings
   - Verify CORS configuration

4. **WebRTC Connection Issues**:
   - Check if STUN servers are accessible
   - Verify network connectivity
   - Try using different browsers

### Browser Compatibility
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ✅ Edge 80+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WebRTC for peer-to-peer communication
- Socket.IO for real-time signaling
- React and TypeScript for robust frontend development
- Tailwind CSS for modern styling

## 🔮 Oracle AI Features

Mulisa includes an AI-powered Oracle system that provides mystical wisdom and guidance during conversations:

### Oracle Capabilities
- **Real-time Wisdom Generation**: GPT-4 powered prophetic insights based on conversation context
- **Voice Injection**: Text-to-speech audio that plays directly in the voice call
- **Natural Conversation Flow**: Oracle listens and provides guidance at appropriate moments
- **Mystical Personality**: Ancient wisdom with modern relevance and oracular speech patterns

### Oracle Integration
- **Frontend Controls**: Dedicated Oracle panel with summon/dismiss functionality
- **Audio Playback**: Automatic TTS audio playback when Oracle speaks
- **Status Indicators**: Real-time Oracle active/inactive status
- **Wisdom History**: Display of latest Oracle guidance and insights

### Technical Architecture
- **LiveKit Integration**: Oracle joins as a bot participant with audio publishing capabilities
- **OpenAI GPT-4**: Powers wisdom generation with conversation context awareness
- **TTS Audio Pipeline**: OpenAI text-to-speech with mystical voice configuration
- **Hybrid Audio Delivery**: Direct LiveKit tracks + HTTP serving fallback for maximum compatibility

### Getting Started with Oracle
1. Set up OpenAI API key in bot environment configuration
2. Start the Oracle bot server (`npm start` in `/bot` directory)
3. Use the Oracle controls in the call interface to summon wisdom
4. Oracle will listen to conversation and provide guidance when appropriate

## 🚀 Quick Start

### 1. **Install Dependencies**
```bash
# Install all dependencies (client, server, and Oracle bot)
npm run install:all
```

### 2. **Environment Setup**

#### Client Environment (`.env.local` in `/client/`)
```bash
VITE_SERVER_URL=http://localhost:3001
VITE_BOT_SERVER_URL=http://localhost:4000
```

#### Oracle Bot Environment (`.env.local` in `/bot/`)
```bash
# Copy from template
cp bot/.env.example bot/.env.local

# Edit with your OpenAI API key
OPENAI_API_KEY=your-openai-api-key-here
LIVEKIT_URL=wss://your-livekit-server-url
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

### 3. **Start the Application**
```bash
# Option 1: Start everything together
npm run dev

# Option 2: Start components individually
npm run server:dev    # Signaling server (port 3001)
npm run client:dev     # React app (port 3000)
cd bot && npm start    # Oracle bot (port 4000)
```

### 4. **Test Voice + Oracle Features**
1. **Open browser** to `http://localhost:3000`
2. **Grant microphone permissions** when prompted
3. **Start a voice call** between two browser windows/devices
4. **Summon the Oracle** using the Oracle control panel
5. **Experience AI-powered mystical guidance** during your conversation
