// WebRTC Service for handling peer-to-peer voice connections
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateChangeCallback?: (state: string) => void;
  private userInteractionOccurred: boolean = false;

  // ICE servers configuration for NAT traversal (enhanced for mobile)
  private iceServers = [
    // Primary Google STUN servers (most reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    
    // Additional STUN servers for redundancy
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.ekiga.net' },
    
    // Free public TURN servers for mobile NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject', 
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  constructor() {
    this.initializePeerConnection();
    this.setupMobileAudioSupport();
  }

  // Setup mobile audio support and user interaction handling
  private setupMobileAudioSupport() {
    // Create audio context for mobile compatibility
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Setup user interaction handler for mobile
    const enableAudioOnInteraction = () => {
      this.userInteractionOccurred = true;
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      // Remove listeners after first interaction
      document.removeEventListener('touchstart', enableAudioOnInteraction);
      document.removeEventListener('click', enableAudioOnInteraction);
    };

    document.addEventListener('touchstart', enableAudioOnInteraction, { once: true });
    document.addEventListener('click', enableAudioOnInteraction, { once: true });
  }

  private initializePeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      // Enhanced configuration for mobile networks
      iceCandidatePoolSize: 10, // Generate more ICE candidates
      iceTransportPolicy: 'all', // Use both STUN and TURN
      bundlePolicy: 'max-bundle', // Better for mobile networks
      rtcpMuxPolicy: 'require' // Reduce port usage
    });

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('WebRTC: Received remote track', event.track.kind, event.track.id);
      const [remoteStream] = event.streams;
      this.remoteStream = remoteStream;
      console.log('WebRTC: Remote stream tracks:', remoteStream.getTracks().length);
      
      // Enhanced iOS Safari audio track handling
      if (event.track.kind === 'audio') {
        console.log('WebRTC: Audio track received - readyState:', event.track.readyState, 'enabled:', event.track.enabled);
        
        // iOS Safari specific audio track setup
        if (this.isIOSSafari()) {
          console.log('WebRTC: Applying iOS Safari remote audio track fixes');
          
          // Ensure the track is enabled
          event.track.enabled = true;
          
          // Add iOS-specific event listeners for debugging
          event.track.addEventListener('ended', () => {
            console.log('WebRTC: Remote audio track ended on iOS Safari');
          });
          
          event.track.addEventListener('mute', () => {
            console.log('WebRTC: Remote audio track muted on iOS Safari');
          });
          
          event.track.addEventListener('unmute', () => {
            console.log('WebRTC: Remote audio track unmuted on iOS Safari');
          });
        }
      }
      
      // Create and configure audio element for mobile compatibility
      this.setupRemoteAudio(remoteStream);
      
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteStream);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'disconnected';
      console.log('Connection state:', state);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(state);
      }
    };

    // Handle ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      const gatheringState = this.peerConnection?.iceGatheringState;
      console.log('🧊 ICE gathering state:', gatheringState);
      
      if (gatheringState === 'complete') {
        console.log('✅ ICE gathering completed - all candidates found');
      } else if (gatheringState === 'gathering') {
        console.log('🔄 ICE gathering in progress - finding network paths...');
      }
    };

    // Handle ICE connection state changes - crucial for diagnosing connection failures
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState || 'new';
      console.log(`🧊 ICE connection state: ${iceState}`);
      
      if (iceState === 'checking') {
        console.log('🔄 ICE checking - testing network connectivity paths...');
      } else if (iceState === 'connected') {
        console.log('🟢 ICE connected - direct connection established!');
      } else if (iceState === 'completed') {
        console.log('✅ ICE completed - optimal connection path found');
      } else if (iceState === 'failed') {
        console.log('🔴 ICE connection failed - network issues detected');
        console.log('💡 Possible causes:');
        console.log('   - Strict firewall/NAT blocking connection');
        console.log('   - STUN servers unreachable');
        console.log('   - Need TURN server for this network');
        console.log('   - Different network types (cellular vs WiFi)');
        
        // Attempt ICE restart if available
        if (this.peerConnection && this.peerConnection.restartIce) {
          console.log('🔄 Attempting automatic ICE restart...');
          this.peerConnection.restartIce();
        }
      } else if (iceState === 'disconnected') {
        console.log('🟡 ICE disconnected - connection lost, may recover...');
      } else if (iceState === 'closed') {
        console.log('⚫ ICE connection closed');
      }
    };
  }

  // Get user media (microphone access)
  async getUserMedia(): Promise<MediaStream> {
    try {
      // Use mobile-optimized constraints
      const audioConstraints = this.getMobileAudioConstraints();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });
      
      this.localStream = stream;
      console.log('WebRTC: Got local stream with tracks:', stream.getTracks().length);
      
      // Force-enable audio tracks for iOS Safari (critical fix)
      stream.getAudioTracks().forEach(track => {
        console.log('WebRTC: Audio track state before enabling:', track.readyState, track.enabled);
        track.enabled = true;
        
        // iOS Safari-specific audio track handling
        if (this.isIOSSafari()) {
          console.log('WebRTC: Applying iOS Safari audio track fixes');
          
          // Force track constraints for iOS
          track.applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }).catch(err => console.warn('WebRTC: iOS constraint application failed:', err));
          
          // Add iOS-specific event listeners
          track.addEventListener('ended', () => {
            console.log('WebRTC: iOS audio track ended unexpectedly');
          });
          
          track.addEventListener('mute', () => {
            console.log('WebRTC: iOS audio track muted');
          });
          
          track.addEventListener('unmute', () => {
            console.log('WebRTC: iOS audio track unmuted');
          });
        }
        
        console.log('WebRTC: Audio track state after enabling:', track.readyState, track.enabled);
      });
      
      // Add tracks to peer connection
      if (this.peerConnection) {
        stream.getTracks().forEach(track => {
          console.log('WebRTC: Adding local track to peer connection:', track.kind, track.id);
          this.peerConnection!.addTrack(track, stream);
        });
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Could not access microphone. Please check permissions.');
    }
  }

  // Create offer for initiating connection
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      console.log('Peer connection not initialized, reinitializing...');
      this.initializePeerConnection();
    }

    // Check signaling state
    const currentState = this.peerConnection!.signalingState;
    console.log('WebRTC: Current signaling state before createOffer:', currentState);
    
    // If we're not in a stable state, reset the connection
    if (currentState !== 'stable') {
      console.log('WebRTC: Non-stable state detected, resetting peer connection...');
      await this.resetPeerConnection();
    }

    // Ensure we have a local stream
    if (!this.localStream) {
      console.log('No local stream, getting user media...');
      await this.getUserMedia();
    }

    if (!this.peerConnection) {
      throw new Error('Failed to initialize peer connection');
    }

    try {
      console.log('🔄 Creating WebRTC offer with enhanced mobile support...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        iceRestart: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('WebRTC: Created offer, signaling state:', this.peerConnection.signalingState);
      
      // Wait for ICE gathering to complete or timeout (crucial for mobile)
      console.log('🧊 Waiting for ICE candidates to be gathered...');
      await this.waitForIceGathering(15000); // 15 second timeout for mobile networks
      
      // Return the complete offer with all ICE candidates
      const completeOffer = this.peerConnection.localDescription;
      if (!completeOffer) {
        throw new Error('Failed to get complete offer after ICE gathering');
      }
      
      console.log('✅ Offer created with ICE candidates, SDP length:', completeOffer.sdp?.length || 0);
      return completeOffer;
    } catch (error) {
      console.error('WebRTC: Error creating offer:', error);
      throw error;
    }
  }

  // Create answer for responding to offer
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Check if we're in a valid state for setting remote description
    const currentState = this.peerConnection.signalingState;
    console.log('WebRTC: Current signaling state before setRemoteDescription:', currentState);
    
    // If we're not in 'stable' or 'have-local-offer' state, we need to reset
    if (currentState !== 'stable' && currentState !== 'have-local-offer') {
      console.log('WebRTC: Invalid state for setRemoteDescription, resetting peer connection...');
      await this.resetPeerConnection();
    }

    // Ensure we have a local stream before creating answer
    if (!this.localStream) {
      console.log('No local stream when creating answer, getting user media...');
      await this.getUserMedia();
    }

    try {
      // Set remote description
      console.log('WebRTC: Setting remote offer description...');
      await this.peerConnection.setRemoteDescription(offer);
      
      // Create and set local answer
      console.log('🔄 Creating WebRTC answer with enhanced mobile support...');
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('WebRTC: Created answer with local tracks:', this.localStream?.getTracks().length || 0);
      console.log('WebRTC: Signaling state after createAnswer:', this.peerConnection.signalingState);
      
      // Wait for ICE gathering to complete (crucial for mobile)
      console.log('🧊 Waiting for ICE candidates to be gathered for answer...');
      await this.waitForIceGathering(15000); // 15 second timeout for mobile networks
      
      // Return the complete answer with all ICE candidates
      const completeAnswer = this.peerConnection.localDescription;
      if (!completeAnswer) {
        throw new Error('Failed to get complete answer after ICE gathering');
      }
      
      console.log('✅ Answer created with ICE candidates, SDP length:', completeAnswer.sdp?.length || 0);
      return completeAnswer;
    } catch (error) {
      console.error('WebRTC: Error in createAnswer:', error);
      // If we get an SDP error, try resetting and retrying once
      if (error instanceof Error && error.message.includes('m-lines')) {
        console.log('WebRTC: SDP m-lines error detected, attempting recovery...');
        await this.resetPeerConnection();
        // Retry once with fresh peer connection
        await this.getUserMedia();
        await this.peerConnection!.setRemoteDescription(offer);
        const retryAnswer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(retryAnswer);
        return retryAnswer;
      }
      throw error;
    }
  }

  // Set remote answer
  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Check signaling state before setting remote description
    const currentState = this.peerConnection.signalingState;
    console.log('WebRTC: Current signaling state before setRemoteAnswer:', currentState);
    
    if (currentState !== 'have-local-offer') {
      console.warn('WebRTC: Unexpected signaling state for setRemoteAnswer:', currentState);
      // Don't throw error, but log for debugging
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('WebRTC: Remote answer set successfully, final state:', this.peerConnection.signalingState);
    } catch (error) {
      console.error('WebRTC: Error setting remote answer:', error);
      throw error;
    }
  }

  // Reset peer connection to clean state
  private async resetPeerConnection(): Promise<void> {
    console.log('WebRTC: Resetting peer connection to clean state...');
    
    // Store current stream reference
    const currentStream = this.localStream;
    
    // Close current peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // Create new peer connection
    this.initializePeerConnection();
    
    // Re-add tracks if we had a stream
    if (currentStream && this.peerConnection) {
      currentStream.getTracks().forEach(track => {
        console.log('WebRTC: Re-adding track to fresh peer connection:', track.kind, track.id);
        this.peerConnection!.addTrack(track, currentStream);
      });
    }
    
    console.log('WebRTC: Peer connection reset complete');
  }

  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  // Get ICE candidates
  onIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate generated:', event.candidate.type, event.candidate.candidate);
          callback(event.candidate);
        } else {
          console.log('🧊 ICE candidate gathering complete');
        }
      };
    }
  }

  // Set callback for remote stream
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  // Set callback for connection state changes
  onConnectionStateChange(callback: (state: string) => void): void {
    this.onConnectionStateChangeCallback = callback;
  }

  // Mute/unmute local audio
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // Return muted state
      }
    }
    return false;
  }

  // Check if local audio is muted
  isMuted(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? !audioTrack.enabled : true;
    }
    return true;
  }

  // Get audio level for visualization
  getAudioLevel(): number {
    // This is a simplified version - in a real app you'd use Web Audio API
    // for proper audio level detection
    return Math.random() * 0.5 + 0.1; // Placeholder
  }

  // Clean up resources
  cleanup(): void {
    console.log('WebRTC: Starting cleanup...');
    
    // Clear any pending operations
    if (this.peerConnection) {
      console.log('WebRTC: Cleanup - signaling state:', this.peerConnection.signalingState);
      console.log('WebRTC: Cleanup - connection state:', this.peerConnection.connectionState);
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('WebRTC: Stopping local track:', track.kind, track.id);
        track.stop();
      });
      this.localStream = null;
    }

    // Clean up remote audio element
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause();
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement.remove();
      this.remoteAudioElement = null;
    }

    if (this.peerConnection) {
      // Remove all event listeners to prevent callbacks after cleanup
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    
    console.log('WebRTC: Cleanup complete');
  }

  // Get connection state
  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'disconnected';
  }

  // Get ICE connection state
  getIceConnectionState(): string {
    return this.peerConnection?.iceConnectionState || 'new';
  }

  // Attempt to restart ICE connection (useful for recovering from connection failures)
  async restartIce(): Promise<void> {
    if (this.peerConnection && this.peerConnection.connectionState === 'failed') {
      console.log('🔄 Attempting ICE restart to recover connection...');
      try {
        this.peerConnection.restartIce();
        console.log('✅ ICE restart initiated');
      } catch (error) {
        console.error('❌ ICE restart failed:', error);
        throw error;
      }
    } else {
      console.log('⚠️ ICE restart not needed or not available');
    }
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Setup remote audio element for mobile compatibility
  private setupRemoteAudio(stream: MediaStream) {
    console.log('WebRTC: Setting up remote audio for mobile compatibility');
    
    // Remove existing audio element if any
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause();
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement.remove();
    }

    // Create new audio element with enhanced mobile support
    this.remoteAudioElement = document.createElement('audio');
    this.remoteAudioElement.srcObject = stream;
    this.remoteAudioElement.autoplay = true;
    this.remoteAudioElement.muted = false;
    this.remoteAudioElement.volume = 1.0;
    
    // Essential iOS Safari properties
    (this.remoteAudioElement as any).playsInline = true;
    (this.remoteAudioElement as any)['webkit-playsinline'] = true;
    this.remoteAudioElement.controls = false;
    this.remoteAudioElement.style.display = 'none';
    
    // Set audio attributes for better iOS compatibility
    this.remoteAudioElement.setAttribute('playsinline', 'true');
    this.remoteAudioElement.setAttribute('webkit-playsinline', 'true');
    this.remoteAudioElement.setAttribute('x-webkit-airplay', 'allow');
    
    // Add to DOM for mobile compatibility
    document.body.appendChild(this.remoteAudioElement);

    // Add event listeners for debugging
    this.remoteAudioElement.addEventListener('loadstart', () => console.log('WebRTC: Remote audio loadstart'));
    this.remoteAudioElement.addEventListener('loadeddata', () => console.log('WebRTC: Remote audio loadeddata'));
    this.remoteAudioElement.addEventListener('canplay', () => console.log('WebRTC: Remote audio canplay'));
    this.remoteAudioElement.addEventListener('play', () => console.log('WebRTC: Remote audio play'));
    this.remoteAudioElement.addEventListener('playing', () => console.log('WebRTC: Remote audio playing'));
    this.remoteAudioElement.addEventListener('pause', () => console.log('WebRTC: Remote audio pause'));
    this.remoteAudioElement.addEventListener('error', (e) => console.error('WebRTC: Remote audio error:', e));

    // Handle audio play promise for mobile
    this.playRemoteAudio();
  }

  // Handle audio playback with mobile-specific considerations
  private async playRemoteAudio() {
    if (!this.remoteAudioElement) return;

    console.log('WebRTC: Attempting to play remote audio...');
    console.log('WebRTC: User interaction occurred:', this.userInteractionOccurred);
    console.log('WebRTC: Audio context state:', this.audioContext?.state || 'None');

    try {
      // Always try to resume audio context first (crucial for iOS)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('WebRTC: Resuming suspended audio context...');
        await this.audioContext.resume();
      }

      // Force play the audio element
      console.log('WebRTC: Attempting to play audio element...');
      const playPromise = this.remoteAudioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('WebRTC: Remote audio started playing successfully');
        return;
      }
      
    } catch (error) {
      console.warn('WebRTC: Initial audio play failed:', error);
      
      // If autoplay is blocked, set up listeners for user interaction
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        console.log('WebRTC: Setting up user interaction listeners for audio playback');
        this.setupUserInteractionAudioPlayback();
      }
    }
  }

  // Setup user interaction handlers for audio playback (iOS Safari fix)
  private setupUserInteractionAudioPlayback() {
    const playOnInteraction = async () => {
      try {
        console.log('WebRTC: User interaction detected, attempting audio playback...');
        
        // Resume audio context if needed
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log('WebRTC: Audio context resumed on user interaction');
        }
        
        // Try to play the audio
        if (this.remoteAudioElement && this.remoteAudioElement.paused) {
          await this.remoteAudioElement.play();
          console.log('WebRTC: Remote audio started after user interaction');
        }
        
        // Remove listeners after successful play
        document.removeEventListener('touchstart', playOnInteraction);
        document.removeEventListener('touchend', playOnInteraction);
        document.removeEventListener('click', playOnInteraction);
        document.removeEventListener('keydown', playOnInteraction);
        
      } catch (playError) {
        console.error('WebRTC: Failed to play audio after interaction:', playError);
      }
    };

    // Add multiple event listeners to catch any user interaction
    document.addEventListener('touchstart', playOnInteraction, { once: true, passive: true });
    document.addEventListener('touchend', playOnInteraction, { once: true, passive: true });
    document.addEventListener('click', playOnInteraction, { once: true, passive: true });
    document.addEventListener('keydown', playOnInteraction, { once: true, passive: true });
  }

  // Force audio context resume for mobile (call this on user interaction)
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('WebRTC: Audio context resumed');
      } catch (error) {
        console.warn('WebRTC: Failed to resume audio context:', error);
      }
    }
  }

  // Ensure audio is ready for mobile devices
  async ensureMobileAudioReady(): Promise<void> {
    // Resume audio context if suspended
    await this.resumeAudioContext();
    
    // Try to play remote audio if it exists
    if (this.remoteAudioElement && this.remoteAudioElement.paused) {
      try {
        await this.remoteAudioElement.play();
      } catch (error) {
        console.warn('WebRTC: Could not auto-play remote audio:', error);
      }
    }
  }

  // iOS Safari-specific call preparation (call before making/answering calls)
  async prepareForIOSCall(): Promise<void> {
    if (!this.isIOSSafari()) return;
    
    console.log('WebRTC: Preparing iOS Safari for call...');
    
    try {
      // Ensure audio context is created and ready
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Try to resume audio context immediately if possible
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('WebRTC: iOS audio context pre-resumed');
      }
      
      // Pre-create a silent audio element to "unlock" audio on iOS
      const silentAudio = document.createElement('audio');
      silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OD//////////////////8AAAAATGF2YzU4LjU1AAAAAAAAAAAAAAAAJAAAAAAAAAAAASDb3AgAAAAAAPf/w4QAAAAAAAAAAAAAAAAAAAAAAAAASVREAAAAAAAfxJeaAAABkklEQVR4nGNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyC/w0AcJhjAAAQAAAAA//8Q==';
      silentAudio.volume = 0.01;
      silentAudio.muted = true;
      
      try {
        await silentAudio.play();
        console.log('WebRTC: iOS silent audio played successfully');
      } catch (error) {
        console.warn('WebRTC: iOS silent audio play failed:', error);
      }
      
      // Clean up silent audio
      silentAudio.remove();
      
    } catch (error) {
      console.warn('WebRTC: iOS call preparation failed:', error);
    }
  }

  // Check if running on iOS Safari
  private isIOSSafari(): boolean {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    return isIOS && isSafari;
  }

  // Get mobile-optimized audio constraints
  private getMobileAudioConstraints(): MediaTrackConstraints {
    if (this.isIOSSafari()) {
      // iOS Safari specific constraints
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1, // Mono for mobile
      };
    }

    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  }

  // Check if user interaction has occurred (useful for UI feedback)
  hasUserInteracted(): boolean {
    return this.userInteractionOccurred;
  }

  // Debug method to check current WebRTC state
  debugState(): void {
    if (this.peerConnection) {
      console.log('🔍 WebRTC Debug State:');
      console.log('  - Signaling State:', this.peerConnection.signalingState);
      console.log('  - Connection State:', this.peerConnection.connectionState);
      console.log('  - ICE Connection State:', this.peerConnection.iceConnectionState);
      console.log('  - ICE Gathering State:', this.peerConnection.iceGatheringState);
      console.log('  - Local Stream:', this.localStream ? `${this.localStream.getTracks().length} tracks` : 'None');
      console.log('  - Remote Stream:', this.remoteStream ? `${this.remoteStream.getTracks().length} tracks` : 'None');
      console.log('  - Audio Context State:', this.audioContext?.state || 'None');
      console.log('  - Remote Audio Element:', this.remoteAudioElement ? 
        `paused: ${this.remoteAudioElement.paused}, muted: ${this.remoteAudioElement.muted}, volume: ${this.remoteAudioElement.volume}` : 'None');
      console.log('  - User Interaction Occurred:', this.userInteractionOccurred);
    } else {
      console.log('🔍 WebRTC Debug State: No peer connection');
    }
  }

  // Gracefully terminate call
  async terminateCall(): Promise<void> {
    console.log('WebRTC: Terminating call gracefully...');
    
    if (this.peerConnection) {
      const currentState = this.peerConnection.signalingState;
      console.log('WebRTC: Terminating call in state:', currentState);
      
      // If we're in the middle of negotiation, wait briefly before cleanup
      if (currentState === 'have-local-offer' || currentState === 'have-remote-offer') {
        console.log('WebRTC: Waiting for negotiation to complete before termination...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.cleanup();
  }

  // Wait for ICE gathering to complete (crucial for mobile networks)
  private async waitForIceGathering(timeoutMs: number = 10000): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    return new Promise((resolve) => {
      let stunCandidatesFound = 0;
      let hostCandidatesFound = 0;
      let turnCandidatesFound = 0;
      
      const timeout = setTimeout(() => {
        console.log(`⏰ ICE gathering timeout (${timeoutMs}ms) reached`);
        console.log(`📊 Candidates found: HOST=${hostCandidatesFound}, STUN=${stunCandidatesFound}, TURN=${turnCandidatesFound}`);
        
        if (stunCandidatesFound === 0 && turnCandidatesFound === 0) {
          console.log('⚠️  No STUN/TURN candidates found - connection may fail on different networks');
          console.log('💡 Consider checking STUN server connectivity or network restrictions');
        }
        
        resolve(); // Don't reject, just proceed with available candidates
      }, timeoutMs);

      // Track ICE candidates as they're generated
      const originalOnIceCandidate = this.peerConnection?.onicecandidate || null;
      
      const candidateTracker = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate && event.candidate.candidate) {
          const candidate = event.candidate.candidate;
          
          if (candidate.includes('typ host')) {
            hostCandidatesFound++;
            console.log(`🏠 HOST candidate found (#${hostCandidatesFound})`);
          } else if (candidate.includes('typ srflx')) {
            stunCandidatesFound++;
            console.log(`🌐 STUN candidate found (#${stunCandidatesFound}) - good for NAT traversal!`);
          } else if (candidate.includes('typ relay')) {
            turnCandidatesFound++;
            console.log(`🔄 TURN candidate found (#${turnCandidatesFound}) - excellent for restrictive networks!`);
          }
        }
        
        // Call original handler if it exists
        if (originalOnIceCandidate && this.peerConnection) {
          originalOnIceCandidate.call(this.peerConnection, event);
        }
      };

      // Set our tracking handler
      if (this.peerConnection) {
        this.peerConnection.onicecandidate = candidateTracker;
      }

      const checkGatheringState = () => {
        const state = this.peerConnection?.iceGatheringState;
        console.log('🧊 ICE gathering state check:', state);
        
        if (state === 'complete') {
          clearTimeout(timeout);
          console.log('✅ ICE gathering completed successfully');
          console.log(`📊 Final candidates: HOST=${hostCandidatesFound}, STUN=${stunCandidatesFound}, TURN=${turnCandidatesFound}`);
          
          // Restore original handler
          if (this.peerConnection) {
            this.peerConnection.onicecandidate = originalOnIceCandidate;
          }
          
          resolve();
        }
      };

      // Check current state
      checkGatheringState();

      // Listen for state changes
      if (this.peerConnection) {
        this.peerConnection.addEventListener('icegatheringstatechange', checkGatheringState);
        
        // Cleanup listener when done
        timeout && setTimeout(() => {
          this.peerConnection?.removeEventListener('icegatheringstatechange', checkGatheringState);
          // Restore original handler
          if (this.peerConnection) {
            this.peerConnection.onicecandidate = originalOnIceCandidate;
          }
        }, timeoutMs + 1000);
      }
    });
  }
}
