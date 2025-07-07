# Mulisa - Simple WebRTC Voice Calling Platform

## Current Architecture

Mulisa is a streamlined WebRTC-based voice calling platform that enables direct peer-to-peer audio communication between users through phone number matching.

## Core Architecture

### 1. Single-Page Application
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO for signaling
- **Audio**: WebRTC for direct peer-to-peer voice communication

### 2. Voice Communication Flow
```
User A ←→ WebRTC P2P Audio ←→ User B
         (Direct Connection)
              ↑
    Socket.IO Signaling Server
    (Connection establishment only)
```

### 3. Key Features
- **Phone Number Based**: Users enter Singapore (+65) phone numbers to initiate calls
- **Direct Audio**: WebRTC provides sub-50ms latency direct peer-to-peer audio
- **Automatic Matching**: Random demo number generation for testing
- **Mobile Compatible**: Optimized for mobile browsers with proper audio handling
- **Clean Interface**: Modern, minimal UI focused on core calling functionality

## Technical Components

### A. Frontend (Client)
- **React Components**: Single landing page with call interface
- **WebRTC Service**: Handles peer connection establishment and audio streaming
- **Socket Service**: Manages signaling for connection setup
- **Phone Number Handling**: Singapore format validation and formatting

### B. Backend (Server)
- **Socket.IO Server**: WebRTC signaling and room management
- **Express Server**: Static file serving and API endpoints
- **No AI Components**: Removed complex AI/agent features for simplicity

### C. Audio Pipeline
- **Direct P2P**: No server-side audio processing
- **Low Latency**: Typical 30-50ms audio latency
- **Mobile Optimized**: Proper AudioContext handling for mobile browsers

## Future Considerations

This simplified architecture provides a solid foundation for:

- Adding AI-powered features when needed
- Scaling to handle more complex call routing
- Integrating with real phone systems
- Adding recording or analytics capabilities

The current focus is on delivering a reliable, fast, and user-friendly voice calling experience.
