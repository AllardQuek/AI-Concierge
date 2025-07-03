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

  // ICE servers configuration for NAT traversal
  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN servers can be added later if needed for users behind restrictive NATs
    // Most iPhone-to-iPhone calls work fine with just STUN servers
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
    });

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('WebRTC: Received remote track', event.track.kind, event.track.id);
      const [remoteStream] = event.streams;
      this.remoteStream = remoteStream;
      console.log('WebRTC: Remote stream tracks:', remoteStream.getTracks().length);
      
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
      console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Handle ICE connection state changes - crucial for diagnosing connection failures
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState || 'new';
      console.log('ICE connection state:', iceState);
      
      // This is the key diagnostic information for your connection issues
      if (iceState === 'failed') {
        console.log('🔴 ICE connection failed - usually indicates NAT/firewall issues');
        console.log('💡 Consider adding TURN servers for better connectivity');
        // Attempt ICE restart if available
        if (this.peerConnection && this.peerConnection.restartIce) {
          console.log('🔄 Attempting ICE restart...');
          this.peerConnection.restartIce();
        }
      } else if (iceState === 'disconnected') {
        console.log('🟡 ICE connection disconnected - connection may recover or fail');
      } else if (iceState === 'connected' || iceState === 'completed') {
        console.log('🟢 ICE connection established successfully');
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
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('WebRTC: Created offer, signaling state:', this.peerConnection.signalingState);
      return offer;
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
      console.log('WebRTC: Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('WebRTC: Created answer with local tracks:', this.localStream?.getTracks().length || 0);
      console.log('WebRTC: Final signaling state:', this.peerConnection.signalingState);
      
      return answer;
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
          callback(event.candidate);
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
    // Remove existing audio element if any
    if (this.remoteAudioElement) {
      this.remoteAudioElement.remove();
    }

    // Create new audio element
    this.remoteAudioElement = document.createElement('audio');
    this.remoteAudioElement.srcObject = stream;
    this.remoteAudioElement.autoplay = true;
    (this.remoteAudioElement as any).playsInline = true; // Essential for iOS
    this.remoteAudioElement.controls = false;
    this.remoteAudioElement.style.display = 'none';
    
    // Add to DOM for mobile compatibility
    document.body.appendChild(this.remoteAudioElement);

    // Handle audio play promise for mobile
    this.playRemoteAudio();
  }

  // Handle audio playback with mobile-specific considerations
  private async playRemoteAudio() {
    if (!this.remoteAudioElement) return;

    try {
      // Try to play immediately if user has interacted
      if (this.userInteractionOccurred) {
        await this.remoteAudioElement.play();
        console.log('WebRTC: Remote audio started playing');
        return;
      }

      // Try autoplay first
      await this.remoteAudioElement.play();
      console.log('WebRTC: Remote audio started playing (autoplay)');
    } catch (error) {
      console.warn('WebRTC: Autoplay blocked, waiting for user interaction:', error);
      
      // If autoplay is blocked, wait for user interaction
      const playOnInteraction = async () => {
        try {
          if (this.remoteAudioElement) {
            await this.remoteAudioElement.play();
            console.log('WebRTC: Remote audio started after user interaction');
          }
        } catch (playError) {
          console.error('WebRTC: Failed to play audio after interaction:', playError);
        }
        document.removeEventListener('touchstart', playOnInteraction);
        document.removeEventListener('click', playOnInteraction);
      };

      document.addEventListener('touchstart', playOnInteraction, { once: true });
      document.addEventListener('click', playOnInteraction, { once: true });
    }
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

  // Get mobile-optimized audio constraints
  private getMobileAudioConstraints(): MediaTrackConstraints {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Mobile-specific optimizations
        sampleRate: 48000,
        sampleSize: 16,
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
}
