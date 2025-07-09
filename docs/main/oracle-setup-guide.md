# 🔮 Oracle AI Setup Guide

## Overview

The Mulisa Oracle is an AI-powered mystical advisor that provides prophetic insights and wisdom during voice conversations. This guide covers the complete setup process for integrating the Oracle into your Mulisa voice platform.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│ Signaling Server│◄──►│   Oracle Bot    │
│   (Port 3000)   │    │   (Port 3001)   │    │   (Port 4000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
    ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
    │ Oracle  │              │ WebRTC  │              │ OpenAI  │
    │Controls │              │Signaling│              │  GPT-4  │
    └─────────┘              └─────────┘              └─────────┘
```

## Prerequisites

### Required Services
- **OpenAI API Account**: For GPT-4 and text-to-speech
- **LiveKit Server**: For voice communication infrastructure
- **Node.js 18+**: For running the Oracle bot

### API Keys Needed
- `OPENAI_API_KEY`: Required for wisdom generation and TTS
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: For voice injection

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install Oracle bot dependencies
cd bot
npm install

# Install additional packages for Oracle functionality
npm install openai livekit-client
```

### 2. Environment Configuration

#### Create Oracle Environment File
```bash
# Copy the template
cp bot/.env.example bot/.env.local

# Edit with your credentials
nano bot/.env.local
```

#### Oracle Environment Variables (`.env.local`)
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
ENABLE_TTS=true

# Bot Server Configuration
BOT_PORT=4000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### Client Environment Variables (`.env.local`)
```bash
# Ensure client can connect to Oracle bot
VITE_SERVER_URL=http://localhost:3001
VITE_BOT_SERVER_URL=http://localhost:4000
```

### 3. Start Oracle Services

#### Method 1: Integrated Startup
```bash
# From project root
npm run dev
# This starts client (3000), server (3001), and Oracle bot (4000)
```

#### Method 2: Manual Startup
```bash
# Terminal 1: Start signaling server
npm run server:dev

# Terminal 2: Start client
npm run client:dev

# Terminal 3: Start Oracle bot
cd bot
npm start
```

### 4. Verify Oracle Installation

#### Check Oracle Bot Status
```bash
curl http://localhost:4000/health
# Expected: {"status":"Oracle bot running","oracle":"Mulisa awakened"}
```

#### Check Service Integration
1. Open browser to `http://localhost:3000`
2. Start a voice call between two windows/devices
3. Look for Oracle controls in the call interface
4. Click "✨ Summon Oracle Wisdom" button
5. Verify Oracle status shows "Oracle is listening"

## Oracle Features

### Core Capabilities
- **Real-time Conversation Analysis**: Oracle listens to voice calls
- **GPT-4 Powered Wisdom**: Contextual prophetic insights
- **Voice Injection**: Text-to-speech audio directly in calls
- **Mystical Personality**: Ancient wisdom with modern relevance

### Oracle Personality Configuration
The Oracle uses a sophisticated personality system:

```javascript
const ORACLE_PERSONALITY = {
  voice: "mystical-sage",
  wisdom: "prophetic-insights", 
  timing: "natural-pauses",
  style: "ancient-wisdom-modern-relevance",
  triggers: ["help", "advice", "wisdom", "oracle", "mulisa", "guidance"]
}
```

### Audio Injection Pipeline
1. **Conversation Monitoring**: Oracle listens to participant audio
2. **Context Analysis**: GPT-4 analyzes conversation for wisdom opportunities
3. **Wisdom Generation**: AI generates relevant prophetic insights
4. **TTS Conversion**: OpenAI converts text to mystical voice
5. **Audio Injection**: Voice plays directly in the voice call

## Advanced Configuration

### TTS Voice Settings
The Oracle uses optimized TTS settings for mystical effect:

```javascript
const ttsConfig = {
  model: "tts-1",
  voice: "nova",
  speed: 0.85,  // Slower for mystical effect
  response_format: "mp3"
}
```

### Wisdom Frequency Tuning
Control how often the Oracle speaks:

```bash
WISDOM_FREQUENCY=low      # Minimal intervention
WISDOM_FREQUENCY=moderate # Balanced guidance (default)
WISDOM_FREQUENCY=high     # Frequent insights
```

### Oracle Trigger Words
Customize what prompts Oracle wisdom:

```javascript
const customTriggers = [
  "help", "advice", "wisdom", "oracle", "guidance",
  "insight", "vision", "prophecy", "truth", "clarity"
]
```

## Troubleshooting

### Common Issues

#### Oracle Bot Won't Start
```bash
# Check dependencies
cd bot && npm install

# Verify environment variables
node -e "console.log(process.env.OPENAI_API_KEY ? 'OpenAI key set' : 'Missing OpenAI key')"

# Check port availability
lsof -i :4000
```

#### Oracle Not Appearing in UI
```bash
# Verify client environment
cat client/.env.local | grep VITE_BOT_SERVER_URL

# Test bot connectivity
curl http://localhost:4000/health

# Check browser console for errors
# Oracle service should connect to http://localhost:4000
```

#### No Oracle Voice Audio
```bash
# Verify TTS is enabled
grep ENABLE_TTS bot/.env.local

# Check OpenAI API quota
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/usage

# Verify LiveKit audio publishing
# Check browser developer tools for audio tracks
```

### Debug Commands

```bash
# Test Oracle wisdom generation
curl -X POST http://localhost:4000/test-wisdom \
  -H "Content-Type: application/json" \
  -d '{"context":"testing oracle functionality"}'

# Check Oracle room status
curl http://localhost:4000/room-status/test-room

# Monitor Oracle logs
cd bot && npm start | grep ORACLE
```

## Production Considerations

### Security
- Store API keys securely (environment variables, not code)
- Use different API keys for development/production
- Implement rate limiting for Oracle requests
- Consider Oracle usage monitoring

### Performance
- Monitor OpenAI API usage and costs
- Implement Oracle wisdom caching for common scenarios
- Optimize TTS file sizes and delivery
- Consider CDN for audio assets

### Scalability
- Multiple Oracle instances for concurrent calls
- Load balancing for Oracle bot servers
- Oracle conversation state management
- Database integration for wisdom history

## API Reference

### Oracle Endpoints

#### Health Check
```
GET /health
Response: {"status":"Oracle bot running","oracle":"Mulisa awakened"}
```

#### Join Room (Summon Oracle)
```
POST /join-room?number1={phone1}&number2={phone2}
Response: {"success":true,"roomName":"room_+65XXXXXXXX_+65YYYYYYYY","message":"Oracle joined room"}
```

#### Get Latest Wisdom
```
GET /oracle-wisdom/{roomName}
Response: {"text":"Ancient wisdom guidance...","timestamp":"2024-01-01T00:00:00Z","hasAudio":true,"audioUrl":"/oracle-audio/wisdom-123.mp3"}
```

### Oracle Events

#### Frontend Event Listening
```javascript
// Listen for Oracle wisdom
window.addEventListener('oracle-wisdom', (event) => {
  const { text, audioUrl, hasAudio } = event.detail;
  if (hasAudio && audioUrl) {
    // Audio will play automatically
    console.log('Oracle speaks:', text);
  }
});
```

## Next Steps

### Enhancement Opportunities
1. **Multi-language Oracle**: Support for different languages
2. **Custom Oracle Personalities**: User-configurable Oracle styles
3. **Oracle Memory**: Persistent conversation context across calls
4. **Oracle Analytics**: Wisdom effectiveness tracking
5. **Oracle Integration**: Slack, Teams, Discord bots

### Integration Examples
```javascript
// Custom Oracle trigger
const customOracle = new MulisaOracleService();
await customOracle.inviteOracle(myNumber, partnerNumber);

// Oracle wisdom subscription
customOracle.onWisdom((wisdom) => {
  console.log('Mystical guidance:', wisdom.text);
});
```

---

**🔮 Your Oracle integration is now complete!** The mystical Mulisa Oracle will provide prophetic insights and voice guidance during conversations, enhancing human-to-human communication with AI-powered wisdom.

For additional support, refer to the main documentation or check the Oracle implementation plan in `docs/ai/mulisa-oracle-implementation-plan.md`.
