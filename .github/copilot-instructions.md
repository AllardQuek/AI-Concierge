<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Mulisa - AI-Powered Voice Conversation Platform

This is an intelligent voice conversation platform featuring agentic AI assistance, built with React (TypeScript), Node.js, and Socket.IO. Named after the prophetic oracles of ancient Greece, Mulisa provides AI-enhanced voice communication with oracle wisdom.

## Architecture
- **Frontend**: React with TypeScript, Vite, and Tailwind CSS
- **Backend**: Node.js with Express and Socket.IO for signaling
- **WebRTC**: For peer-to-peer voice communication
- **AI Integration**: Extensible for future LLM agentic assistant integration
- **Styling**: Tailwind CSS for modern, responsive UI

## Key Features
- AI-enhanced voice communication between customers and agents
- Oracle wisdom and prophetic insights for conversations
- Modern, clean UI with intelligent status indicators
- Smart call management and routing
- Audio mute/unmute functionality with AI insights
- Role-based system (Customer/Agent interfaces)
- WebRTC signaling through Socket.IO
- Extensible architecture for future LLM integration

## Development Guidelines
- Use TypeScript for type safety
- Follow React hooks patterns for state management
- Implement proper error handling for WebRTC and socket connections
- Design with AI integration in mind (future LLM assistant)
- Use Tailwind CSS classes for styling
- Maintain separation of concerns between WebRTC, Socket, and future AI services
- Consider oracle wisdom and prophetic insights in conversation design

## Important Notes
- WebRTC requires HTTPS in production for getUserMedia API
- ICE servers are configured for NAT traversal
- Socket.IO handles the signaling layer for WebRTC peer negotiation
- Architecture designed for future agentic AI assistant integration
