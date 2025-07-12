const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');
const BotWebRTCService = require('./bot-webrtc');
const path = require('path');

class BotClient {
  constructor(config = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'http://localhost:3001',
      phoneNumber: config.phoneNumber || '+65 8000 0000',
      botName: config.botName || 'AI Assistant',
      voice: config.voice || 'en-US-Neural2-F',
      language: config.language || 'en-US',
      wakeword: config.wakeword || 'hey sybil', // Added wakeword
      responses: config.responses || {}, // Added responses config
      ...config
    };

    this.socket = null;
    this.webrtcService = null;
    this.currentCall = null;
    this.ttsQueue = [];
    this.isProcessingTTS = false;
    this.audioAnalyzer = null;

    console.log(`🤖 Bot initialized: ${this.config.botName} (${this.config.phoneNumber})`);
  }

  async start() {
    try {
      console.log(`🔗 Connecting to server: ${this.config.serverUrl}`);
      await this.connectToServer();
      await this.registerWithPhoneNumber();
      this.initializeWebRTCService();
      console.log(`✅ Bot ${this.config.botName} is ready to receive calls`);
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  async connectToServer() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.config.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log(`✅ Bot connected to server with socket ID: ${this.socket.id}`);
        this.setupEventHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Bot connection error:', error.message);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`🔌 Bot disconnected from server: ${reason}`);
      });
    });
  }

  async registerWithPhoneNumber() {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    console.log(`📱 Registering with phone number: ${this.config.phoneNumber}`);
    this.socket.emit('join-room', { username: this.config.phoneNumber });
  }

  initializeWebRTCService() {
    this.webrtcService = new BotWebRTCService({
      recordingsDir: path.join(__dirname, 'recordings')
    });

    // Set up WebRTC callbacks
    this.webrtcService.onRemoteStream((stream, callerCode) => {
      console.log(`📡 Bot remote stream received from ${callerCode}, setting up audio processing`);
      this.setupAudioProcessing(callerCode);
    });

    this.webrtcService.onConnectionStateChange((state, callerCode) => {
      console.log(`🔗 Bot WebRTC connection state changed with ${callerCode}: ${state}`);
      if (state === 'connected') {
        console.log(`✅ Bot WebRTC connection established with ${callerCode}`);
      }
    });

    this.webrtcService.onIceCandidate((signalData, callerCode) => {
      if (this.currentCall) {
        if (signalData.type === 'answer') {
          console.log(`📡 Bot sending answer to ${callerCode}`);
          this.socket.emit('bot-answer-call', { 
            callerCode: callerCode,
            answer: signalData
          });
        } else if (signalData.type === 'candidate') {
          console.log(`🧊 Bot sending ICE candidate to ${callerCode}`);
          this.socket.emit('bot-ice-candidate', { 
            candidate: signalData, 
            targetUserId: callerCode 
          });
        }
      }
    });
  }

  setupEventHandlers() {
    // Handle incoming calls (bot can receive calls from users)
    this.socket.on('user-calling', async (data) => {
      console.log(`📞 Bot received incoming call from: ${data.callerCode}`);
      await this.handleIncomingCall(data);
    });

    // Handle WebRTC signaling
    this.socket.on('offer', async (data) => {
      console.log('📡 Bot received WebRTC offer');
      await this.handleOffer(data.offer, data.fromUserId);
    });

    this.socket.on('answer', async (data) => {
      console.log('📡 Bot received WebRTC answer');
      await this.handleAnswer(data.answer, data.fromUserId);
    });

    this.socket.on('ice-candidate', async (data) => {
      console.log('🧊 Bot received ICE candidate');
      await this.handleIceCandidate(data.candidate, data.fromUserId);
    });

    // Handle call end
    this.socket.on('call-ended', (data) => {
      console.log(`📞 Call ended by: ${data.fromCode}`);
      this.handleCallEnd(data.fromCode);
    });
  }

  async handleIncomingCall(data) {
    try {
      this.currentCall = {
        callerCode: data.callerCode,
        startTime: new Date(),
        id: uuidv4(),
        isDirectCall: data.isDirectCall || false // Use the flag from data
      };

      console.log(`🤖 ${this.config.botName} handling ${data.isDirectCall ? 'direct' : 'injected'} call from ${data.callerCode}`);
      
      // Automatically answer the call (transparent)
      this.socket.emit('answer-call', { 
        callerCode: data.callerCode, 
        answer: 'accepted' 
      });

      // Initialize WebRTC if offer is provided
      if (data.offer) {
        await this.handleOffer(data.offer, data.callerCode);
      }

      // Start recording
      await this.startRecording();

      // Play welcome message for direct calls
      if (data.isDirectCall) {
        await this.playTTSMessage(this.config.responses?.precall || `Hello! I'm ${this.config.botName}. How can I help you today?`);
      } else {
        // For injected calls, be more subtle or silent
        console.log(`🤖 Bot silently joined call from ${data.callerCode}`);
      }

    } catch (error) {
      console.error('❌ Error handling incoming call:', error);
      this.declineCall(data.callerCode);
    }
  }

  async handleOffer(offer, fromUserId) {
    try {
      await this.webrtcService.handleOffer(offer, fromUserId);
      
      // simple-peer automatically creates and signals the answer
      // The answer will be sent through the onIceCandidate callback
      console.log(`📡 Offer handled from ${fromUserId}, waiting for answer to be signaled`);

    } catch (error) {
      console.error(`❌ Error handling offer from ${fromUserId}:`, error);
      throw error;
    }
  }

  async handleAnswer(answer, fromUserId) {
    try {
      await this.webrtcService.handleAnswer(answer, fromUserId);
    } catch (error) {
      console.error(`❌ Error handling answer from ${fromUserId}:`, error);
    }
  }

  async handleIceCandidate(candidate, fromUserId) {
    try {
      await this.webrtcService.handleIceCandidate(candidate, fromUserId);
    } catch (error) {
      console.error(`❌ Error handling ICE candidate from ${fromUserId}:`, error);
    }
  }

  setupAudioProcessing(callerCode) {
    try {
      this.audioAnalyzer = this.webrtcService.setupAudioProcessing(callerCode);
      
      if (this.audioAnalyzer) {
        this.webrtcService.monitorAudioLevels(this.audioAnalyzer, () => {
          this.onSpeechDetected(callerCode);
        });
      }
      
    } catch (error) {
      console.error('❌ Error setting up audio processing:', error);
    }
  }

  onSpeechDetected(callerCode) {
    console.log(`🎤 Speech activity detected from ${callerCode}`);
    // This could trigger speech-to-text processing
    // For now, just log the detection
  }

  async startRecording() {
    try {
      await this.webrtcService.startRecording();
    } catch (error) {
      console.error('❌ Error starting recording:', error);
    }
  }

  async stopRecording() {
    try {
      await this.webrtcService.stopRecording();
      
      // Save the recording with call ID
      if (this.currentCall) {
        const filepath = await this.webrtcService.saveRecording(this.currentCall.id);
        if (filepath) {
          await this.processRecordingForSTT(filepath);
        }
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  }

  async processRecordingForSTT(filepath) {
    try {
      console.log('🔍 Processing recording for speech-to-text');
      
      // Here you would integrate with a speech-to-text service
      // For now, we'll simulate processing
      const transcription = await this.simulateSTT(filepath);
      
      if (transcription) {
        console.log(`📝 Transcription: "${transcription}"`);
        await this.generateResponse(transcription);
      }
      
    } catch (error) {
      console.error('❌ Error processing recording for STT:', error);
    }
  }

  async simulateSTT(filepath) {
    // Simulate speech-to-text processing
    // In a real implementation, you would use:
    // - Google Speech-to-Text API
    // - OpenAI Whisper API
    // - Azure Speech Services
    // - Amazon Transcribe
    
    const responses = [
      "Hello, how can I help you today?",
      "I need information about your services",
      "Can you tell me about your pricing?",
      "I have a question about my account",
      "Thank you for your help"
    ];
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return a random response for demo purposes
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async generateResponse(userInput) {
    try {
      console.log(`🤖 Generating response to: "${userInput}"`);
      
      // Here you would integrate with an AI service
      // For now, we'll use simple response logic
      const response = this.getBotResponse(userInput);
      
      console.log(`🤖 Bot response: "${response}"`);
      
      // Add to TTS queue
      this.ttsQueue.push(response);
      this.processTTSQueue();
      
    } catch (error) {
      console.error('❌ Error generating response:', error);
    }
  }

  getBotResponse(userInput) {
    const input = userInput.toLowerCase();
    
    // Check for wake word
    if (this.config.wakeword && input.includes(this.config.wakeword.toLowerCase())) {
      return "Yes, I'm here to help. What do you need?";
    }
    
    if (input.includes('hello') || input.includes('hi')) {
      return "Hello! I'm here to help you. What can I assist you with today?";
    }
    
    if (input.includes('service') || input.includes('help')) {
      return "I can help you with various services including account management, billing inquiries, and technical support. What specific assistance do you need?";
    }
    
    if (input.includes('price') || input.includes('cost') || input.includes('billing')) {
      return "Our pricing varies depending on your needs. I'd be happy to connect you with our billing department for detailed information. Would you like me to do that?";
    }
    
    if (input.includes('account') || input.includes('profile')) {
      return "I can help you with account-related questions. Please provide your account number or email address so I can assist you better.";
    }
    
    if (input.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    }
    
    return "I understand you're asking about that. Let me connect you with a human representative who can better assist you with your specific needs.";
  }

  async processTTSQueue() {
    if (this.isProcessingTTS || this.ttsQueue.length === 0) return;
    
    this.isProcessingTTS = true;
    
    while (this.ttsQueue.length > 0) {
      const message = this.ttsQueue.shift();
      await this.playTTSMessage(message);
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.isProcessingTTS = false;
  }

  async playTTSMessage(message) {
    try {
      console.log(`🔊 Playing TTS message: "${message}"`);
      
      // Here you would integrate with a TTS service
      // For now, we'll simulate TTS playback
      await this.simulateTTS(message);
      
    } catch (error) {
      console.error('❌ Error playing TTS message:', error);
    }
  }

  async simulateTTS(message) {
    // Simulate TTS processing and playback
    // In a real implementation, you would use:
    // - Google Text-to-Speech API
    // - Amazon Polly
    // - Azure Speech Services
    // - OpenAI TTS API
    
    console.log(`🔊 TTS: "${message}"`);
    
    // Simulate audio playback duration
    const duration = message.length * 100; // Rough estimate
    await new Promise(resolve => setTimeout(resolve, duration));
    
    console.log('🔊 TTS playback completed');
  }

  declineCall(callerCode) {
    console.log(`❌ Declining call from ${callerCode}`);
    this.socket.emit('decline-call', { callerCode });
    this.currentCall = null;
  }

  async handleCallEnd(fromCode) {
    try {
      console.log(`🤖 Bot handling call end from ${fromCode}`);
      
      // Clean up WebRTC connections
      if (this.webrtcService) {
        this.webrtcService.cleanup(fromCode);
      }
      
      // Stop recording if active
      await this.stopRecording();
      
      // Reset call state
      this.currentCall = null;
      
      console.log(`✅ Bot call cleanup completed for ${fromCode}`);
      
    } catch (error) {
      console.error('❌ Error handling call end:', error);
    }
  }

  // Handle server-initiated call end (when server detects call termination)
  async handleServerCallEnd(fromCode) {
    try {
      console.log(`🤖 Bot handling server-initiated call end from ${fromCode}`);
      
      // Clean up all connections since the call is completely terminated
      if (this.webrtcService) {
        this.webrtcService.cleanup(); // Clean up all connections
      }
      
      // Stop recording if active
      await this.stopRecording();
      
      // Reset call state
      this.currentCall = null;
      
      // Notify server that bot cleanup is complete
      this.socket.emit('bot-call-ended', { 
        callerCode: fromCode, 
        targetCode: this.config.phoneNumber 
      });
      
      console.log(`✅ Bot server call cleanup completed for ${fromCode}`);
      
    } catch (error) {
      console.error('❌ Error handling server call end:', error);
    }
  }

  endCall() {
    try {
      console.log('📞 Bot ending call');
      
      if (this.currentCall) {
        this.socket.emit('end-call', { 
          targetCode: this.currentCall.callerCode, 
          callerCode: this.config.phoneNumber 
        });
      }
      
      this.stopRecording();
      this.cleanup();
      this.currentCall = null;
      
    } catch (error) {
      console.error('❌ Error ending call:', error);
    }
  }

  cleanup() {
    try {
      if (this.webrtcService) {
        this.webrtcService.cleanup(); // Clean up all connections
      }
      
      this.audioAnalyzer = null;
      this.ttsQueue = [];
      this.isProcessingTTS = false;
      
      console.log('🧹 Bot cleanup completed');
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  async stop() {
    console.log('🛑 Stopping bot client');
    
    this.endCall();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    console.log('✅ Bot client stopped');
  }

  // Debug methods
  debugState() {
    console.log('🔍 Bot Client Debug State:');
    console.log('  - Socket Connected:', this.socket?.connected || false);
    console.log('  - Current Call:', this.currentCall ? `Active (${this.currentCall.callerCode})` : 'None');
    console.log('  - TTS Queue Length:', this.ttsQueue.length);
    console.log('  - Is Processing TTS:', this.isProcessingTTS);
    console.log('  - Audio Analyzer:', this.audioAnalyzer ? 'Active' : 'None');
    
    if (this.webrtcService) {
      this.webrtcService.debugState();
    }
  }
}

// Export the BotClient class
module.exports = BotClient;

// If running directly, start the bot
if (require.main === module) {
  const bot = new BotClient({
    serverUrl: process.env.BOT_SERVER_URL || 'http://localhost:3001',
    phoneNumber: process.env.BOT_PHONE_NUMBER || '+65 8000 0000',
    botName: process.env.BOT_NAME || 'AI Assistant',
    voice: process.env.BOT_VOICE || 'en-US-Neural2-F',
    language: process.env.BOT_LANGUAGE || 'en-US'
  });

  bot.start().catch(console.error);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });
} 