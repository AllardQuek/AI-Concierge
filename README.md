# Sybil - AI-Powered Voice Conversation Platform

![Version](https://img.shields.io/badge/version-1.0.0--beta-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![React](https://img.shields.io/badge/react-18.2.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue)

An intelligent voice conversation platform featuring agentic AI assistance, built with React (TypeScript), Node.js, and Socket.IO. Named after the prophetic oracles of ancient Greece, Sybil provides AI-enhanced voice conversations with real-time insights and intelligent assistance.

## 🎯 Current Status

- ✅ **Core Voice Platform**: WebRTC P2P communication (30-50ms latency)
- ✅ **AI Architecture**: Complete AI service framework with OpenAI GPT-4o integration
- ✅ **Frontend Components**: Customer & Agent interfaces with AI dashboard
- ✅ **Real-time Processing**: AudioWorklet for audio chunking and analysis
- ⚠️ **Activation Pending**: API key configuration and pipeline connection needed

## 🔮 About Sybil

Named after the prophetic oracles of ancient Greece, Sybil listens to conversations and provides wise guidance. Our AI assistant offers prophetic insights to help facilitate better communication between customers and agents.

## 🚀 Features

- **Oracle-Enhanced Conversations**: AI assistant with prophetic insights and guidance
- **Real-time Voice Communication**: High-quality peer-to-peer voice chat using WebRTC
- **Prophetic Understanding**: AI that listens and anticipates conversation needs
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- **Smart Call Management**: AI-powered routing with oracle wisdom
- **Audio Controls**: Mute/unmute functionality with visual indicators
- **Connection Status**: Real-time connection and call state monitoring
- **TypeScript**: Full type safety across the entire application
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for modern styling
- **Socket.IO Client** for real-time communication

### Backend
- **Node.js** with Express
- **Socket.IO** for WebRTC signaling
- **CORS** enabled for cross-origin requests
- **UUID** for unique room generation

## 📋 Prerequisites

- **Node.js** 18+ (your current version is too old)
- **npm** or **yarn**
- **Modern browser** with WebRTC support (Chrome, Firefox, Safari, Edge)

## 🚨 Important: Update Node.js

Your current Node.js version (12.11.1) is too old. Please update to Node.js 18 or higher:

### Using NVM (Recommended)
```bash
# Install the latest LTS version
nvm install --lts
nvm use --lts

# Or install a specific version
nvm install 18
nvm use 18
```

### Using Official Installer
Download from [nodejs.org](https://nodejs.org/) and install Node.js 18 LTS or higher.

## 🔧 Installation

After updating Node.js, follow these steps:

1. **Clone and navigate to the project**:
   ```bash
   cd /Users/allard/Local-Projects/voice-bot
   ```

2. **Install all dependencies**:
   ```bash
   npm run install:all
   ```
   
   Or install manually:
   ```bash
   # Root dependencies
   npm install
   
   # Server dependencies
   cd server && npm install
   
   # Client dependencies
   cd ../client && npm install
   ```

## 🚀 Running the Application

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

## 🌐 Deployment

Ready to deploy your Sybil voice platform? We support both free and paid hosting options.

### 🆓 Quick Deploy (Free)
**Backend:** Render.com | **Frontend:** Vercel

```bash
# Ensure everything is ready
npm run deploy:prep
```

**📖 Complete Guide:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

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
- **[Port Configuration](docs/port-configuration.md)** - Service ports and networking setup
- **[Architecture Decision Records (ADRs)](docs/decisions/README.md)** - Documented design decisions and rationale

### Key Design Decisions
- **[ADR-001: Persistent Socket Connections](docs/decisions/001-persistent-socket-connections.md)** - Why we maintain idle connections
- **[ADR-002: WebRTC Signaling Architecture](docs/decisions/002-webrtc-signaling-architecture.md)** - Socket.IO for WebRTC signaling
- **[ADR-003: Port Configuration Strategy](docs/decisions/003-port-configuration-strategy.md)** - Service port allocation and conflicts

### Development Documentation  
- **[Project Summary](docs/project-summary.md)** - High-level project overview
- **[Development Status](DEVELOPMENT-STATUS.md)** - Current status and next steps
- **[Git Workflow](docs/git-workflow.md)** - Development and deployment workflow

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
