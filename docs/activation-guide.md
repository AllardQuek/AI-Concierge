# Sybil AI Activation Guide

## 🚀 Quick Start Guide

This guide will help you activate the AI features in Sybil and complete the integration between the voice platform and AI assistance.

## 📋 Prerequisites

- Node.js 18+ installed
- OpenAI API key (for GPT-4o integration)
- Azure Speech Services key (optional, for enhanced STT)

## 🔧 Step 1: Configure API Keys

Create environment configuration files:

### Server Environment (.env)
```bash
# Create server/.env file
cd server
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region
NODE_ENV=development
PORT=5000
AI_SERVICE_PORT=5001
EOF
```

### Client Environment (.env)
```bash
# Create client/.env file
cd client
cat > .env << EOF
VITE_SERVER_URL=http://localhost:5000
VITE_AI_SERVICE_URL=http://localhost:5001
EOF
```

## 🔌 Step 2: Update Package Scripts

The AI service should start automatically with the development server. Update the root `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server:dev\" \"npm run ai:dev\" \"npm run client:dev\"",
    "ai:dev": "cd server && node ai-service.js",
    "server:dev": "cd server && npm run dev",
    "client:dev": "cd client && npm run dev"
  }
}
```

## 🎤 Step 3: Connect Audio Pipeline

Update `client/src/services/ai.ts` to enable real-time audio streaming:

```typescript
// Enable audio streaming to AI service
export const connectAudioToAI = async (audioStream: MediaStream) => {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(audioStream);
  
  // Connect to AudioWorklet processor
  await audioContext.audioWorklet.addModule('/audio-processor.js');
  const processor = new AudioWorkletNode(audioContext, 'audio-processor');
  
  // Connect processor to AI service
  processor.port.onmessage = (event) => {
    const { audioData } = event.data;
    sendAudioChunkToAI(audioData);
  };
  
  source.connect(processor);
  processor.connect(audioContext.destination);
};
```

## 🏃 Step 4: Start the Application

```bash
# Install all dependencies
npm run install:all

# Start all services (including AI)
npm run dev
```

This will start:
- WebRTC Signaling Server (Port 5000)
- AI Processing Service (Port 5001)
- React Client (Port 3000)

## ✅ Step 5: Test the Integration

1. **Open two browser windows**:
   - Window 1: http://localhost:3000 (Customer)
   - Window 2: http://localhost:3000 (Agent)

2. **Initiate a call**:
   - Customer: Click "Request Agent Call"
   - Agent: Answer the incoming call

3. **Verify AI features**:
   - Speak into the microphone
   - Check agent dashboard for real-time transcription
   - Look for AI insights and action recommendations
   - Verify sentiment analysis updates

## 🔍 Troubleshooting

### AI Service Not Starting
```bash
# Check if AI service is running
curl http://localhost:5001/health

# Check logs
cd server && node ai-service.js
```

### Audio Not Streaming to AI
- Verify microphone permissions
- Check browser console for AudioWorklet errors
- Ensure WebSocket connection to AI service

### No AI Insights Appearing
- Verify OpenAI API key is correct
- Check AI service logs for API errors
- Ensure WebSocket connection between AI service and dashboard

## 📊 Performance Monitoring

Monitor these key metrics:
- Voice latency: <50ms (WebRTC)
- AI response time: <1 second
- Memory usage: <2GB per 100 sessions
- CPU usage: <80% under load

## 🔒 Security Considerations

- Store API keys in environment variables only
- Enable HTTPS in production
- Configure CORS properly for production domains
- Implement rate limiting for API calls

## 📈 Next Steps

Once basic AI integration is working:

1. **Enhance AI Analysis**:
   - Add industry-specific prompts
   - Implement custom action types
   - Add integration with CRM systems

2. **Optimize Performance**:
   - Implement audio streaming
   - Add LLM response caching
   - Deploy edge computing for lower latency

3. **Production Deployment**:
   - Configure Azure/AWS infrastructure
   - Set up monitoring and alerting
   - Implement auto-scaling

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in browser console and server terminal
3. Verify all dependencies are installed correctly
4. Ensure API keys are configured properly

---

*Once activated, Sybil will provide real-time AI assistance during voice conversations, offering insights, action recommendations, and intelligent support to enhance customer service interactions.*
