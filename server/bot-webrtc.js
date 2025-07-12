// WebRTC Service for bot client using simple-peer library
const fs = require('fs');
const path = require('path');
const SimplePeer = require('simple-peer');
const wrtc = require('wrtc');

class BotWebRTCService {
  constructor(config = {}) {
    this.config = {
      recordingsDir: config.recordingsDir || path.join(__dirname, 'recordings'),
      ...config
    };

    this.peers = new Map(); // Map<callerCode, peer>
    this.remoteStreams = new Map(); // Map<callerCode, stream>
    this.isRecording = false;
    this.onRemoteStreamCallback = null;
    this.onConnectionStateChangeCallback = null;
    this.onIceCandidateCallback = null;
    this.connectionState = 'disconnected';

    // Create recordings directory
    if (!fs.existsSync(this.config.recordingsDir)) {
      fs.mkdirSync(this.config.recordingsDir, { recursive: true });
    }

    console.log('🔧 Bot WebRTC Service initialized with simple-peer');
  }

  // Initialize peer connection using simple-peer
  initializePeerConnection(callerCode, isInitiator = false) {
    try {
      console.log(`🔧 Initializing WebRTC peer connection for ${callerCode} with simple-peer`);
      
      // Create simple-peer instance with wrtc polyfill
      const peer = new SimplePeer({
        initiator: isInitiator,
        wrtc: wrtc,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      });

      // Set up event handlers for this specific peer
      this.setupPeerEventHandlers(peer, callerCode);

      // Store the peer
      this.peers.set(callerCode, peer);

      console.log(`✅ WebRTC peer connection initialized for ${callerCode} with simple-peer`);

    } catch (error) {
      console.error(`❌ Error initializing WebRTC for ${callerCode}:`, error);
      throw error;
    }
  }

  // Set up simple-peer event handlers for a specific peer
  setupPeerEventHandlers(peer, callerCode) {
    if (!peer) return;

    // Handle signal events (offers, answers, ICE candidates)
    peer.on('signal', (data) => {
      console.log(`📡 Signal event from ${callerCode}:`, data.type);
      
      // Emit ICE candidates
      if (data.type === 'candidate' && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(data, callerCode);
      }
    });

    // Handle connection state changes
    peer.on('connect', () => {
      console.log(`✅ WebRTC connection established with ${callerCode}`);
      this.connectionState = 'connected';
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback('connected', callerCode);
      }
    });

    peer.on('close', () => {
      console.log(`🔌 WebRTC connection closed with ${callerCode}`);
      this.connectionState = 'closed';
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback('closed', callerCode);
      }
    });

    peer.on('error', (error) => {
      console.error(`❌ WebRTC error with ${callerCode}:`, error);
      this.connectionState = 'failed';
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback('failed', callerCode);
      }
    });

    // Handle incoming streams
    peer.on('stream', (stream) => {
      console.log(`📡 Remote stream received from ${callerCode}`);
      this.remoteStreams.set(callerCode, stream);
      
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(stream, callerCode);
      }
    });

    // Handle data channel (for text messages)
    peer.on('data', (data) => {
      console.log(`📨 Received data from ${callerCode}:`, data.toString());
    });
  }

  // Create WebRTC offer (for bot to initiate calls)
  async createOffer() {
    try {
      if (!this.peer) {
        this.initializePeerConnection(true); // Bot is initiator
      }

      console.log('📡 Bot creating WebRTC offer');
      
      // simple-peer will automatically signal the offer
      // We need to wait for the signal event
      return new Promise((resolve) => {
        const signalHandler = (data) => {
          if (data.type === 'offer') {
            console.log('📡 Bot offer created successfully');
            this.peer.off('signal', signalHandler);
            resolve(data);
          }
        };
        
        this.peer.on('signal', signalHandler);
      });

    } catch (error) {
      console.error('❌ Error creating offer:', error);
      throw error;
    }
  }

  // Handle WebRTC offer
  async handleOffer(offer, fromUserId) {
    try {
      if (!this.peers.has(fromUserId)) {
        this.initializePeerConnection(fromUserId, false); // Not initiator
      }

      const peer = this.peers.get(fromUserId);
      console.log(`📡 Handling WebRTC offer from ${fromUserId}`);
      peer.signal(offer);

      // simple-peer will automatically create and signal the answer
      console.log(`✅ Offer handled for ${fromUserId}, answer will be signaled automatically`);

    } catch (error) {
      console.error(`❌ Error handling offer from ${fromUserId}:`, error);
      throw error;
    }
  }

  // Handle WebRTC answer
  async handleAnswer(answer, fromUserId) {
    try {
      const peer = this.peers.get(fromUserId);
      if (peer) {
        console.log(`📡 Handling WebRTC answer from ${fromUserId}`);
        peer.signal(answer);
        console.log(`✅ Answer handled successfully for ${fromUserId}`);
      }
    } catch (error) {
      console.error(`❌ Error handling answer from ${fromUserId}:`, error);
      throw error;
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate, fromUserId) {
    try {
      const peer = this.peers.get(fromUserId);
      if (peer) {
        console.log(`🧊 Handling ICE candidate from ${fromUserId}`);
        peer.signal(candidate);
        console.log(`✅ ICE candidate handled successfully for ${fromUserId}`);
      }
    } catch (error) {
      console.error(`❌ Error handling ICE candidate from ${fromUserId}:`, error);
      throw error;
    }
  }

  // Setup audio processing (simplified)
  setupAudioProcessing(callerCode = null) {
    console.log('🎵 Setting up audio processing');
    
    if (callerCode) {
      const stream = this.remoteStreams.get(callerCode);
      if (stream) {
        console.log(`✅ Audio processing setup completed for ${callerCode}`);
        return stream; // Return the stream for processing
      }
    } else {
      // Return first available stream
      const firstStream = this.remoteStreams.values().next().value;
      if (firstStream) {
        console.log('✅ Audio processing setup completed with first available stream');
        return firstStream;
      }
    }
    
    console.log('⚠️ No remote stream available for audio processing');
    return null;
  }

  // Monitor audio levels (simplified)
  monitorAudioLevels(stream, onSpeechDetected, callerCode = null) {
    console.log(`🎤 Audio monitoring started for ${callerCode || 'unknown'}`);
    
    // Simulate periodic speech detection
    const interval = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(interval);
        return;
      }
      
      // Randomly trigger speech detection
      if (Math.random() < 0.1) { // 10% chance every 2 seconds
        console.log(`🎤 Speech detected from ${callerCode || 'unknown'} (simulated)`);
        if (onSpeechDetected) {
          onSpeechDetected(callerCode);
        }
      }
    }, 2000);
    
    // Clean up interval when recording stops
    this.cleanupInterval = interval;
  }

  // Start recording (simplified)
  async startRecording() {
    try {
      if (this.isRecording) {
        console.log('⚠️ Recording already in progress');
        return;
      }
      
      console.log('🎙️ Starting audio recording (simplified - no actual recording)');
      this.isRecording = true;
      this.recordedChunks = [];
      
      console.log('✅ Recording started (simplified)');
      
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      console.log('⚠️ Recording setup failed, continuing without recording');
      this.isRecording = false;
    }
  }

  // Stop recording (simplified)
  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.log('⚠️ No recording in progress');
        return;
      }
      
      console.log('🎙️ Stopping audio recording (simplified)');
      this.isRecording = false;
      
      // Clean up monitoring interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      console.log('✅ Recording stopped (simplified)');
      
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  }

  // Save recording (simplified)
  async saveRecording(callId = 'unknown') {
    try {
      console.log('💾 Saving recording (simplified - creating placeholder file)');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `call_${callId}_${timestamp}.txt`;
      const filepath = path.join(this.config.recordingsDir, filename);
      
      // Create a placeholder file instead of actual audio
      const placeholderContent = `Call Recording Placeholder
Call ID: ${callId}
Timestamp: ${new Date().toISOString()}
Duration: Simulated
Note: This is a placeholder file. Actual audio recording requires WebRTC support.`;
      
      fs.writeFileSync(filepath, placeholderContent);
      console.log(`💾 Recording placeholder saved: ${filepath}`);
      
      return filepath;
      
    } catch (error) {
      console.error('❌ Error saving recording:', error);
      console.log('⚠️ Recording save failed, continuing without saved recording');
      return null;
    }
  }

  // Get connection state
  getConnectionState(callerCode = null) {
    if (callerCode) {
      const peer = this.peers.get(callerCode);
      return peer?.connected ? 'connected' : this.connectionState || 'disconnected';
    }
    // Return overall state
    return this.connectionState || 'disconnected';
  }

  // Get ICE connection state
  getIceConnectionState(callerCode = null) {
    if (callerCode) {
      const peer = this.peers.get(callerCode);
      return peer?.connected ? 'connected' : 'new';
    }
    return 'new';
  }

  // Get remote stream
  getRemoteStream(callerCode = null) {
    if (callerCode) {
      return this.remoteStreams.get(callerCode);
    }
    // Return first available stream
    return this.remoteStreams.values().next().value;
  }

  // Check if connected
  isConnected(callerCode = null) {
    if (callerCode) {
      const peer = this.peers.get(callerCode);
      return peer?.connected || false;
    }
    // Check if any peer is connected
    return Array.from(this.peers.values()).some(peer => peer.connected);
  }

  // Set callbacks
  onRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionStateChange(callback) {
    this.onConnectionStateChangeCallback = callback;
  }

  onIceCandidate(callback) {
    this.onIceCandidateCallback = callback;
  }

  // Cleanup WebRTC resources
  cleanup(callerCode = null) {
    try {
      console.log('🧹 Cleaning up WebRTC resources');
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      if (callerCode) {
        // Clean up specific peer
        const peer = this.peers.get(callerCode);
        if (peer) {
          peer.destroy();
          this.peers.delete(callerCode);
          this.remoteStreams.delete(callerCode);
          console.log(`✅ Cleaned up peer connection for ${callerCode}`);
        }
      } else {
        // Clean up all peers
        for (const [code, peer] of this.peers.entries()) {
          peer.destroy();
          console.log(`✅ Cleaned up peer connection for ${code}`);
        }
        this.peers.clear();
        this.remoteStreams.clear();
      }
      
      this.recordedChunks = [];
      this.isRecording = false;
      this.connectionState = 'disconnected';
      
      console.log('✅ WebRTC cleanup completed');
      
    } catch (error) {
      console.error('❌ Error during WebRTC cleanup:', error);
    }
  }

  // Debug state
  debugState() {
    console.log('🔍 Bot WebRTC Debug State (simple-peer):');
    console.log(`  - Active Peers: ${this.peers.size}`);
    console.log(`  - Remote Streams: ${this.remoteStreams.size}`);
    console.log(`  - Overall Connected: ${this.isConnected()}`);
    console.log(`  - Is Recording: ${this.isRecording}`);
    console.log(`  - Recorded Chunks: ${this.recordedChunks?.length || 0}`);
    console.log(`  - Library: simple-peer`);
    
    // Show individual peer states
    for (const [code, peer] of this.peers.entries()) {
      console.log(`  - Peer ${code}: ${peer.connected ? 'Connected' : 'Disconnected'}`);
    }
  }
}

module.exports = BotWebRTCService; 