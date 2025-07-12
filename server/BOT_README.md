# 🤖 Bot Client for Voice Calling Platform

This bot client mimics the behavior of a web client and can automatically answer calls, record conversations, and generate responses using text-to-speech (TTS).

## 🚀 Features

- **Automatic Call Answering**: Bots automatically answer incoming calls
- **Audio Recording**: Records all conversations for analysis
- **Speech-to-Text**: Processes audio to extract user input (simulated)
- **Text-to-Speech**: Generates and plays audio responses
- **Wake Word Detection**: Responds to wake words like "Sybil"
- **WebRTC Support**: Full WebRTC peer-to-peer voice communication
- **Modular Architecture**: Separated WebRTC and bot logic for better maintainability

## 📋 Prerequisites

- Node.js 18+ installed
- The main server running (see main README)
- Microphone and speakers for testing

## 🔧 Installation

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Start the main server** (in a separate terminal):
   ```bash
   npm run server:dev
   ```

## 🎯 Quick Start

### Start the Sybil Bot
```bash
# From project root
npm run bot

# Or directly
cd server
node start-bot.js sybil
```

### Start with Debug Logging
```bash
npm run bot:debug
```

## 🤖 Available Bot Types

| Bot Type | Phone Number | Description |
|----------|--------------|-------------|
| `sybil` | +65 8000 0000 | Sybil In-Call Assistant |

## ⚙️ Configuration

### Environment Variables

You can override bot settings using environment variables:

```bash
export BOT_SERVER_URL="http://localhost:3001"
export BOT_PHONE_NUMBER="+65 1234 5678"
export BOT_NAME="My Custom Bot"
export BOT_VOICE="en-US-Neural2-F"
export BOT_LANGUAGE="en-US"
```

### Custom Bot Configuration

Create a custom bot by modifying `bot-config.js`:

```javascript
const customBot = {
  phoneNumber: '+65 9999 9999',
  botName: 'Custom Assistant',
  voice: 'en-US-Neural2-D',
  language: 'en-US',
  personality: 'friendly',
  wakeword: 'hey assistant',
  responses: {
    precall: "Hi! I'm your custom assistant. How can I help?",
    postcall: "Thank you for using our service!"
  }
};
```

## 🎤 Testing the Bot

1. **Start the bot**:
   ```bash
   npm run bot
   ```

2. **Start the web client** (in another terminal):
   ```bash
   cd client
   npm run dev
   ```

3. **Make a call**:
   - Open the web client in your browser
   - Enter the bot's phone number (e.g., +65 8000 0000)
   - Click "Start Call"
   - The bot will automatically answer and respond

## 📁 File Structure

```
server/
├── bot-client.js      # Main bot logic and conversation handling
├── bot-webrtc.js      # WebRTC service for voice communication
├── bot-config.js      # Bot configurations and personalities
├── start-bot.js       # Bot launcher script
├── recordings/        # Directory for saved call recordings
└── BOT_README.md      # This file
```

## 🏗️ Architecture

The bot system is now separated into two main components:

### BotWebRTCService (`bot-webrtc.js`)
- Handles all WebRTC peer-to-peer communication
- Manages audio streams and recording
- Provides audio processing and analysis
- Similar to the `webrtc.ts` service in the client

### BotClient (`bot-client.js`)
- Manages bot conversation logic
- Handles socket.io communication
- Processes speech-to-text and text-to-speech
- Manages bot responses and personality

## 🔍 Debugging

### Enable Debug Logging
```bash
npm run bot:debug
```

### Check Bot Status
The bot will log its status to the console:
- Connection status
- Call events
- Audio processing
- TTS generation

### View Recordings
Call recordings are saved in the `recordings/` directory:
```bash
ls -la recordings/
```

## 🔧 Advanced Configuration

### Custom Response Logic

Modify the `getBotResponse()` method in `bot-client.js` to implement custom conversation logic:

```javascript
getBotResponse(userInput) {
  const input = userInput.toLowerCase();
  
  // Check for wake word
  if (this.config.wakeword && input.includes(this.config.wakeword.toLowerCase())) {
    return "Yes, I'm here to help. What do you need?";
  }
  
  // Add your custom response logic here
  if (input.includes('custom keyword')) {
    return "Your custom response here";
  }
  
  return this.config.responses.fallback;
}
```

### Integration with AI Services

Replace the simulated functions with real AI services:

#### Speech-to-Text Integration
```javascript
async processRecordingForSTT(filepath) {
  // Replace with OpenAI Whisper, Google Speech-to-Text, etc.
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filepath),
    model: "whisper-1"
  });
  
  return transcription.text;
}
```

#### Text-to-Speech Integration
```javascript
async playTTSMessage(message) {
  // Replace with Google TTS, Amazon Polly, etc.
  const audioBuffer = await googleTTS.synthesize({
    text: message,
    voice: this.config.voice
  });
  
  // Play the audio
  await this.playAudio(audioBuffer);
}
```

## 🚨 Troubleshooting

### Bot Won't Connect
- Ensure the main server is running
- Check the `BOT_SERVER_URL` environment variable
- Verify network connectivity

### No Audio in Calls
- Check microphone permissions
- Ensure WebRTC is supported in your environment
- Verify ICE server connectivity

### Bot Not Responding
- Check console logs for errors
- Verify the bot is registered with the correct phone number
- Ensure the bot configuration is correct

### Recording Issues
- Check file permissions for the `recordings/` directory
- Verify sufficient disk space
- Check audio format compatibility

## 🔄 API Reference

### BotClient Class

#### Constructor
```javascript
const bot = new BotClient({
  serverUrl: 'http://localhost:3001',
  phoneNumber: '+65 1234 5678',
  botName: 'My Bot',
  voice: 'en-US-Neural2-F',
  language: 'en-US',
  wakeword: 'hey assistant',
  responses: {
    precall: "Hello! How can I help?",
    postcall: "Thank you for calling!"
  }
});
```

#### Methods
- `start()` - Connect to server and register bot
- `stop()` - Disconnect and cleanup resources
- `endCall()` - End current call
- `declineCall(callerCode)` - Decline incoming call
- `debugState()` - Show current bot state

### BotWebRTCService Class

#### Methods
- `initializePeerConnection()` - Set up WebRTC connection
- `handleOffer(offer, fromUserId)` - Handle incoming WebRTC offer
- `handleAnswer(answer)` - Handle WebRTC answer
- `handleIceCandidate(candidate)` - Handle ICE candidate
- `startRecording()` - Begin audio recording
- `stopRecording()` - Stop audio recording
- `saveRecording(callId)` - Save recording to file
- `cleanup()` - Clean up WebRTC resources

### Events
The bot handles these WebRTC events:
- `user-calling` - Incoming call notification
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange
- `call-ended` - Call termination

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your bot personality or improvements
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the main LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the console logs
3. Open an issue on GitHub
4. Check the main project documentation 