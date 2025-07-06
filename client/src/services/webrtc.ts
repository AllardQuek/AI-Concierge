// WebRTC Service for handling peer-to-peer voice connections
import { TranscriptionService, TranscriptionResult } from './transcription';

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateChangeCallback?: (state: string) => void;
  private userInteractionOccurred: boolean = false;
  
  // Transcription service
  private transcriptionService: TranscriptionService | null = null;
  private conversationId: string | null = null;
  private participantId: string | null = null;
  private existingSocket: any = null;
  private onTranscriptionCallback?: (result: TranscriptionResult) => void;

  // ICE servers configuration for NAT traversal (enhanced for mobile)
  private iceServers = [
    // Primary Google STUN servers (most reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // { urls: "stun:stun.relay.metered.ca:80" },

    // // OpenRelay TURN servers
    // {
    //   urls: "turn:global.relay.metered.ca:80",
    //   username: "59f8df0859fbdb98eb74c743",
    //   credential: "+V+v/RakNOJB5308",
    // },
    // {
    //   urls: "turn:global.relay.metered.ca:80?transport=tcp",
    //   username: "59f8df0859fbdb98eb74c743",
    //   credential: "+V+v/RakNOJB5308",
    // },
    // {
    //   urls: "turn:global.relay.metered.ca:443",
    //   username: "59f8df0859fbdb98eb74c743",
    //   credential: "+V+v/RakNOJB5308",
    // },
    // {
    //   urls: "turns:global.relay.metered.ca:443?transport=tcp",
    //   username: "59f8df0859fbdb98eb74c743",
    //   credential: "+V+v/RakNOJB5308",
    // }
  ];

  // Enhanced network diagnostics for cross-network debugging
  private networkDiagnostics = {
    localCandidates: new Map<string, RTCIceCandidate>(),
    remoteCandidates: new Map<string, RTCIceCandidate>(),
    candidatePairs: new Array<RTCIceCandidatePair>(),
    connectionAttempts: 0,
    lastFailureReason: '',
    networkType: 'unknown'
  };

  // State tracking to prevent duplicate operations
  private operationState = {
    isCreatingOffer: false,
    isCreatingAnswer: false,
    isSettingRemoteAnswer: false,
    lastOfferTimestamp: 0,
    lastAnswerTimestamp: 0
  };

  // Pending ICE candidates queue (for candidates that arrive before remote description)
  private pendingCandidates: RTCIceCandidateInit[] = [];

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
      console.log('WebRTC: Received remote track', event.track.kind);
      const [remoteStream] = event.streams;
      this.remoteStream = remoteStream;
      
      // Enhanced iOS Safari audio track handling
      if (event.track.kind === 'audio') {
        // iOS Safari specific audio track setup
        if (this.isIOSSafari()) {
          console.log('WebRTC: Applying iOS Safari audio track fixes');
          event.track.enabled = true;
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
    };

    // Handle ICE connection state changes - crucial for diagnosing connection failures
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState || 'new';
      console.log(`🧊 ICE connection state: ${iceState}`);
      
      if (iceState === 'checking') {
        console.log('🔄 ICE checking - testing network connectivity paths...');
        this.networkDiagnostics.connectionAttempts++;
      } else if (iceState === 'connected') {
        console.log('🟢 ICE connected - direct connection established!');
      } else if (iceState === 'completed') {
        console.log('✅ ICE completed - optimal connection path found');
      } else if (iceState === 'failed') {
        console.log('🔴 ICE connection failed - network issues detected');
        this.networkDiagnostics.lastFailureReason = 'ICE connection failed';
        
        // Log detailed diagnostics on failure
        this.logConnectionDiagnostics().catch(console.error);
        
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

    // Enhanced candidate tracking for cross-network analysis
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.trackIceCandidate(event.candidate, true);
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
      console.log('WebRTC: Got local stream with', stream.getTracks().length, 'tracks');
      
      // Force-enable audio tracks for iOS Safari (critical fix)
      stream.getAudioTracks().forEach(track => {
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
        }
      });
      
      // Add tracks to peer connection
      if (this.peerConnection) {
        stream.getTracks().forEach(track => {
          console.log('WebRTC: Adding local track to peer connection:', track.kind);
          this.peerConnection!.addTrack(track, stream);
        });
      }
      
      // Start transcription if enabled
      if (this.conversationId && this.participantId) {
        await this.startTranscription(stream);
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Could not access microphone. Please check permissions.');
    }
  }

  // Create offer for initiating connection
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    try {
      // Validate state and prevent duplicate operations
      this.validateStateForOperation('offer');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid state')) {
        // Reset and retry once
        console.log('WebRTC: Resetting connection for offer creation...');
        await this.resetPeerConnection();
      } else {
        throw error;
      }
    }

    if (!this.peerConnection) {
      console.log('Peer connection not initialized, reinitializing...');
      this.initializePeerConnection();
    }

    // Set operation in progress flag
    this.operationState.isCreatingOffer = true;
    this.operationState.lastOfferTimestamp = Date.now();

    // Ensure we have a local stream
    if (!this.localStream) {
      console.log('No local stream, getting user media...');
      await this.getUserMedia();
    }

    if (!this.peerConnection) {
      throw new Error('Failed to initialize peer connection');
    }

    try {
      console.log('🔄 Creating WebRTC offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        iceRestart: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('WebRTC: Created offer, signaling state:', this.peerConnection.signalingState);
      
      // Wait for ICE gathering to complete or timeout (crucial for mobile)
      console.log('🧊 Waiting for ICE candidates...');
      await this.waitForIceGathering(15000); // 15 second timeout for mobile networks
      
      // Return the complete offer with all ICE candidates
      const completeOffer = this.peerConnection.localDescription;
      if (!completeOffer) {
        throw new Error('Failed to get complete offer after ICE gathering');
      }
      
      console.log('✅ Offer created with ICE candidates');
      return completeOffer;
    } catch (error) {
      console.error('WebRTC: Error creating offer:', error);
      throw error;
    } finally {
      // Clear operation flag
      this.operationState.isCreatingOffer = false;
    }
  }

  // Create answer for responding to offer
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    try {
      // Validate state and prevent duplicate operations
      this.validateStateForOperation('answer');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid state')) {
        // Reset and retry once
        console.log('WebRTC: Resetting connection for answer creation...');
        await this.resetPeerConnection();
      } else {
        throw error;
      }
    }

    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Set operation in progress flag
    this.operationState.isCreatingAnswer = true;
    this.operationState.lastAnswerTimestamp = Date.now();

    // Ensure we have a local stream before creating answer
    if (!this.localStream) {
      console.log('No local stream when creating answer, getting user media...');
      await this.getUserMedia();
    }

    try {
      // Verify signaling state before setting remote description
      const preSetState = this.peerConnection.signalingState;
      console.log('WebRTC: Signaling state before setRemoteDescription:', preSetState);
      
      // Only set remote description if we're in stable state
      if (preSetState !== 'stable') {
        throw new Error(`Invalid signaling state for setRemoteDescription: ${preSetState}`);
      }
      
      // Set remote description
      console.log('WebRTC: Setting remote offer description...');
      await this.peerConnection.setRemoteDescription(offer);
      
      // Verify state after setting remote description
      const postSetState = this.peerConnection.signalingState;
      console.log('WebRTC: Signaling state after setRemoteDescription:', postSetState);
      
      // Process any pending ICE candidates now that remote description is set
      await this.processPendingCandidates();
      
      // Create and set local answer
      console.log('🔄 Creating WebRTC answer...');
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('WebRTC: Created answer with', this.localStream?.getTracks().length || 0, 'local tracks');
      console.log('WebRTC: Signaling state after createAnswer:', this.peerConnection.signalingState);
      
      // Wait for ICE gathering to complete (crucial for mobile)
      console.log('🧊 Waiting for ICE candidates for answer...');
      await this.waitForIceGathering(15000); // 15 second timeout for mobile networks
      
      // Return the complete answer with all ICE candidates
      const completeAnswer = this.peerConnection.localDescription;
      if (!completeAnswer) {
        throw new Error('Failed to get complete answer after ICE gathering');
      }
      
      console.log('✅ Answer created with ICE candidates');
      return completeAnswer;
    } catch (error) {
      console.error('WebRTC: Error in createAnswer:', error);
      
      // Enhanced error handling for different types of WebRTC errors
      if (error instanceof Error) {
        if (error.message.includes('InvalidStateError') || error.message.includes('wrong state')) {
          console.log('WebRTC: State error detected, attempting full recovery...');
          await this.resetPeerConnection();
          
          // Retry once with completely fresh peer connection
          await this.getUserMedia();
          await this.peerConnection!.setRemoteDescription(offer);
          
          // Process any pending ICE candidates after setting remote description
          await this.processPendingCandidates();
          
          const retryAnswer = await this.peerConnection!.createAnswer();
          await this.peerConnection!.setLocalDescription(retryAnswer);
          return retryAnswer;
        } else if (error.message.includes('m-lines')) {
          console.log('WebRTC: SDP m-lines error detected, attempting recovery...');
          await this.resetPeerConnection();
          
          // Retry once with fresh peer connection
          await this.getUserMedia();
          await this.peerConnection!.setRemoteDescription(offer);
          
          // Process any pending ICE candidates after setting remote description
          await this.processPendingCandidates();
          
          const retryAnswer = await this.peerConnection!.createAnswer();
          await this.peerConnection!.setLocalDescription(retryAnswer);
          return retryAnswer;
        }
      }
      
      throw error;
    } finally {
      // Clear operation flag
      this.operationState.isCreatingAnswer = false;
    }
  }

  // Set remote answer
  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Check signaling state and prevent duplicate operations
    try {
      this.validateStateForOperation('setRemoteAnswer');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Connection already established')) {
        console.log('WebRTC: Connection already established, skipping setRemoteAnswer');
        return;
      }
      throw error;
    }

    // Set operation in progress flag
    this.operationState.isSettingRemoteAnswer = true;

    try {
      await this.peerConnection.setRemoteDescription(answer);
      const finalState = this.peerConnection.signalingState;
      console.log('WebRTC: Remote answer set successfully, final state:', finalState);
      
      // Process any pending ICE candidates now that remote description is set
      await this.processPendingCandidates();
      
      // Verify we reached stable state
      if (finalState !== 'stable') {
        console.warn(`WebRTC: Expected stable state after setRemoteAnswer, got: ${finalState}`);
      }
    } catch (error) {
      console.error('WebRTC: Error setting remote answer:', error);
      
      // Enhanced error handling for InvalidStateError
      if (error instanceof Error && error.message.includes('InvalidStateError')) {
        console.log('WebRTC: InvalidStateError detected - connection may already be established');
        
        // Check if we're actually already connected
        const connectionState = this.peerConnection.connectionState;
        if (connectionState === 'connected') {
          console.log('WebRTC: Connection is already established, ignoring setRemoteAnswer error');
          return;
        }
        
        throw new Error('Connection state error - please retry the call');
      }
      
      throw error;
    } finally {
      // Clear operation flag
      this.operationState.isSettingRemoteAnswer = false;
    }
  }

  // Reset peer connection to clean state
  private async resetPeerConnection(): Promise<void> {
    console.log('WebRTC: Resetting peer connection to clean state...');
    
    // Store current stream reference
    const currentStream = this.localStream;
    
    // Reset operation state
    this.operationState = {
      isCreatingOffer: false,
      isCreatingAnswer: false,
      isSettingRemoteAnswer: false,
      lastOfferTimestamp: 0,
      lastAnswerTimestamp: 0
    };
    
    // Clear pending candidates queue
    this.pendingCandidates = [];
    console.log('WebRTC: Cleared pending candidates queue');
    
    // Close current peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // Create new peer connection
    this.initializePeerConnection();
    
    // Re-add tracks if we had a stream
    if (currentStream && this.peerConnection) {
      currentStream.getTracks().forEach(track => {
        console.log('WebRTC: Re-adding track to fresh peer connection:', track.kind);
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

    console.log('📥 Received remote ICE candidate');
    
    // Check if remote description is set
    if (!this.peerConnection.remoteDescription) {
      console.log('⏳ Remote description not set yet, queuing ICE candidate');
      this.pendingCandidates.push(candidate);
      return;
    }

    // Check if peer connection is in a valid state for adding candidates
    const signalingState = this.peerConnection.signalingState;
    if (signalingState === 'closed') {
      console.log('⚠️ Cannot add ICE candidate - peer connection is closed');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('✅ ICE candidate added successfully');
      
      // Track remote candidate for network analysis
      if (candidate.candidate) {
        const rtcCandidate = new RTCIceCandidate(candidate);
        this.trackIceCandidate(rtcCandidate, false);
      }
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
      
      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          remoteDescription: this.peerConnection.remoteDescription ? 'set' : 'null',
          signalingState: this.peerConnection.signalingState,
          connectionState: this.peerConnection.connectionState,
          candidate: candidate.candidate
        });
      }
      
      // Don't throw - this is non-critical for established connections
      // Just log the error and continue
    }
  }

  // Get ICE candidates
  onIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate generated:', event.candidate.type);
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
    
    // Stop transcription
    this.stopTranscription();
    
    // Clear any pending operations
    if (this.peerConnection) {
      console.log('WebRTC: Cleanup - signaling state:', this.peerConnection.signalingState);
      console.log('WebRTC: Cleanup - connection state:', this.peerConnection.connectionState);
    }
    
    // Clear pending candidates queue
    this.pendingCandidates = [];
    console.log('WebRTC: Cleared pending candidates queue during cleanup');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('WebRTC: Stopping local track:', track.kind);
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

  // Transcription methods
  async enableTranscription(conversationId: string, participantId: string, existingSocket?: any): Promise<void> {
    this.conversationId = conversationId;
    this.participantId = participantId;
    
    // Initialize transcription service
    this.transcriptionService = new TranscriptionService();
    
    // Set up transcription callbacks
    this.transcriptionService.onTranscription((result) => {
      if (this.onTranscriptionCallback) {
        this.onTranscriptionCallback(result);
      }
    });
    
    this.transcriptionService.onError((error) => {
      console.error('Transcription error:', error);
    });
    
    // Store the existing socket for use when starting transcription
    this.existingSocket = existingSocket;
    
    console.log('🎤 Transcription enabled for conversation:', conversationId, 'participant:', participantId);
  }

  private async startTranscription(stream: MediaStream): Promise<void> {
    if (!this.transcriptionService || !this.conversationId || !this.participantId) {
      return;
    }
    
    try {
      await this.transcriptionService.startTranscription(
        stream,
        this.conversationId,
        this.participantId,
        this.existingSocket
      );
      console.log('🎤 Transcription started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  }

  private stopTranscription(): void {
    if (this.transcriptionService) {
      this.transcriptionService.stopTranscription();
      this.transcriptionService = null;
    }
  }

  onTranscription(callback: (result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
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

    // Handle audio play promise for mobile
    this.playRemoteAudio();
  }

  // Handle audio playback with mobile-specific considerations
  private async playRemoteAudio() {
    if (!this.remoteAudioElement) return;

    try {
      // Always try to resume audio context first (crucial for iOS)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('🔊 Resuming suspended audio context...');
        await this.audioContext.resume();
      }

      // Force play the audio element
      console.log('🔊 Attempting to play audio element...');
      const playPromise = this.remoteAudioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Remote audio started playing successfully');
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

  // Detect network type for better diagnostics
  private detectNetworkType(): string {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      const type = connection.effectiveType || connection.type || 'unknown';
      console.log('🌐 Network type detected:', type);
      return type;
    }
    return 'unknown';
  }

  // Validate signaling state and prevent duplicate operations
  private validateStateForOperation(operation: 'offer' | 'answer' | 'setRemoteAnswer'): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const currentState = this.peerConnection.signalingState;
    const now = Date.now();

    switch (operation) {
      case 'offer':
        if (this.operationState.isCreatingOffer) {
          throw new Error('Offer creation already in progress');
        }
        if (now - this.operationState.lastOfferTimestamp < 1000) {
          throw new Error('Too soon after last offer attempt');
        }
        if (currentState !== 'stable') {
          console.log(`WebRTC: Invalid state for offer creation: ${currentState}, resetting...`);
          throw new Error('Invalid state for offer creation, connection needs reset');
        }
        break;

      case 'answer':
        if (this.operationState.isCreatingAnswer) {
          throw new Error('Answer creation already in progress');
        }
        if (now - this.operationState.lastAnswerTimestamp < 1000) {
          throw new Error('Too soon after last answer attempt');
        }
        if (currentState !== 'stable') {
          console.log(`WebRTC: Invalid state for answer creation: ${currentState}, resetting...`);
          throw new Error('Invalid state for answer creation, connection needs reset');
        }
        break;

      case 'setRemoteAnswer':
        if (this.operationState.isSettingRemoteAnswer) {
          throw new Error('Setting remote answer already in progress');
        }
        if (currentState === 'stable') {
          console.log('WebRTC: Already in stable state, remote answer may have been set already');
          throw new Error('Connection already established');
        }
        if (currentState !== 'have-local-offer') {
          throw new Error(`Invalid state for setting remote answer: ${currentState}`);
        }
        break;
    }
  }

  // Enhanced candidate tracking for cross-network analysis
  private trackIceCandidate(candidate: RTCIceCandidate, isLocal: boolean = true): void {
    const candidateInfo = this.parseCandidateInfo(candidate);
    const key = `${candidateInfo.type}-${candidateInfo.protocol}-${candidateInfo.address}`;
    
    if (isLocal) {
      this.networkDiagnostics.localCandidates.set(key, candidate);
      console.log(`📍 Local ${candidateInfo.type.toUpperCase()} candidate:`, candidateInfo);
    } else {
      this.networkDiagnostics.remoteCandidates.set(key, candidate);
      console.log(`📍 Remote ${candidateInfo.type.toUpperCase()} candidate:`, candidateInfo);
    }
    
    // Log network compatibility analysis
    if (this.networkDiagnostics.localCandidates.size > 0 && this.networkDiagnostics.remoteCandidates.size > 0) {
      this.analyzeNetworkCompatibility();
    }
  }

  // Parse candidate information for analysis
  private parseCandidateInfo(candidate: RTCIceCandidate): {
    type: string;
    protocol: string;
    address: string;
    port: string;
    foundation: string;
  } {
    const parts = candidate.candidate.split(' ');
    return {
      foundation: parts[0] || '',
      type: parts[7] || 'unknown',
      protocol: parts[2] || 'unknown',
      address: parts[4] || 'unknown',
      port: parts[5] || 'unknown'
    };
  }

  // Analyze network compatibility between local and remote candidates
  private analyzeNetworkCompatibility(): void {
    const localTypes = Array.from(this.networkDiagnostics.localCandidates.values())
      .map(c => this.parseCandidateInfo(c).type);
    const remoteTypes = Array.from(this.networkDiagnostics.remoteCandidates.values())
      .map(c => this.parseCandidateInfo(c).type);
    
    const hasLocalTurn = localTypes.includes('relay');
    const hasRemoteTurn = remoteTypes.includes('relay');
    const hasLocalStun = localTypes.includes('srflx');
    const hasRemoteStun = remoteTypes.includes('srflx');
    
    console.log('🔍 Network Compatibility Analysis:');
    console.log(`  Local candidates: HOST=${localTypes.filter(t => t === 'host').length}, STUN=${localTypes.filter(t => t === 'srflx').length}, TURN=${localTypes.filter(t => t === 'relay').length}`);
    console.log(`  Remote candidates: HOST=${remoteTypes.filter(t => t === 'host').length}, STUN=${remoteTypes.filter(t => t === 'srflx').length}, TURN=${remoteTypes.filter(t => t === 'relay').length}`);
    
    if (!hasLocalTurn && !hasRemoteTurn && !hasLocalStun && !hasRemoteStun) {
      console.log('⚠️  CRITICAL: Both sides only have HOST candidates - connection will likely fail across networks');
      console.log('💡 Recommendation: Check STUN/TURN server connectivity');
    } else if (!hasLocalTurn && !hasRemoteTurn) {
      console.log('⚠️  WARNING: No TURN candidates available - may fail with strict NATs');
      console.log('💡 Recommendation: Verify TURN server credentials and reachability');
    } else if (hasLocalTurn || hasRemoteTurn) {
      console.log('✅ TURN candidates available - cross-network connection should work');
    }
  }

  // Get comprehensive connection statistics
  async getConnectionStats(): Promise<any> {
    if (!this.peerConnection) {
      return null;
    }

    try {
      const stats = await this.peerConnection.getStats();
      const connectionInfo = {
        candidates: { 
          local: [] as any[], 
          remote: [] as any[], 
          pairs: [] as any[] 
        },
        transport: null as any,
        inbound: null as any,
        outbound: null as any
      };

      stats.forEach((report) => {
        switch (report.type) {
          case 'local-candidate':
            connectionInfo.candidates.local.push({
              type: report.candidateType,
              protocol: report.protocol,
              address: report.address,
              port: report.port,
              networkType: report.networkType
            });
            break;
          case 'remote-candidate':
            connectionInfo.candidates.remote.push({
              type: report.candidateType,
              protocol: report.protocol,
              address: report.address,
              port: report.port
            });
            break;
          case 'candidate-pair':
            if (report.state === 'succeeded') {
              connectionInfo.candidates.pairs.push({
                localType: report.localCandidateId,
                remoteType: report.remoteCandidateId,
                state: report.state,
                nominated: report.nominated,
                bytesReceived: report.bytesReceived,
                bytesSent: report.bytesSent
              });
            }
            break;
          case 'transport':
            connectionInfo.transport = {
              selectedCandidatePairId: report.selectedCandidatePairId,
              state: report.dtlsState
            };
            break;
          case 'inbound-rtp':
            if (report.mediaType === 'audio') {
              connectionInfo.inbound = {
                packetsReceived: report.packetsReceived,
                packetsLost: report.packetsLost,
                jitter: report.jitter
              };
            }
            break;
          case 'outbound-rtp':
            if (report.mediaType === 'audio') {
              connectionInfo.outbound = {
                packetsSent: report.packetsSent,
                bytesSent: report.bytesSent
              };
            }
            break;
        }
      });

      return connectionInfo;
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      return null;
    }
  }

  // Log detailed connection diagnostics (call this when connection fails)
  async logConnectionDiagnostics(): Promise<void> {
    console.log('🔍 DETAILED CONNECTION DIAGNOSTICS');
    console.log('=====================================');
    
    // Basic state info
    console.log('WebRTC States:');
    console.log(`  Signaling: ${this.peerConnection?.signalingState}`);
    console.log(`  Connection: ${this.peerConnection?.connectionState}`);
    console.log(`  ICE Connection: ${this.peerConnection?.iceConnectionState}`);
    console.log(`  ICE Gathering: ${this.peerConnection?.iceGatheringState}`);
    
    // Network info
    this.networkDiagnostics.networkType = this.detectNetworkType();
    console.log(`  Network Type: ${this.networkDiagnostics.networkType}`);
    
    // Candidate summary
    console.log('\nCandidate Summary:');
    console.log(`  Local candidates: ${this.networkDiagnostics.localCandidates.size}`);
    console.log(`  Remote candidates: ${this.networkDiagnostics.remoteCandidates.size}`);
    
    // Detailed stats
    const stats = await this.getConnectionStats();
    if (stats) {
      console.log('\nDetailed Connection Stats:');
      console.log('  Local candidates:', stats.candidates.local);
      console.log('  Remote candidates:', stats.candidates.remote);
      console.log('  Active pairs:', stats.candidates.pairs);
      
      if (stats.candidates.pairs.length === 0) {
        console.log('❌ No successful candidate pairs - connection establishment failed');
        console.log('💡 This typically means:');
        console.log('   - Firewall blocking connection');
        console.log('   - No compatible network paths');
        console.log('   - TURN servers not working');
      }
    }
    
    console.log('=====================================');
  }

  // Test TURN server connectivity
  async testTurnConnectivity(): Promise<void> {
    console.log('🧪 Testing TURN server connectivity...');
    
    // Create a temporary peer connection to test TURN servers
    const testPC = new RTCPeerConnection({
      iceServers: this.iceServers.filter(server => server.urls.toString().startsWith('turn:')),
      iceCandidatePoolSize: 5
    });

    let turnCandidatesFound = 0;
    
    const testPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`🧪 TURN test completed: ${turnCandidatesFound} TURN candidates found`);
        if (turnCandidatesFound === 0) {
          console.log('❌ No TURN candidates generated - TURN servers may be unreachable');
          console.log('💡 Check:');
          console.log('   - Internet connectivity');
          console.log('   - TURN server credentials');
          console.log('   - Firewall blocking TURN ports');
        } else {
          console.log('✅ TURN servers are reachable');
        }
        testPC.close();
        resolve();
      }, 10000);

      testPC.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate.includes('typ relay')) {
          turnCandidatesFound++;
          console.log(`🔄 TURN test candidate ${turnCandidatesFound}:`, event.candidate.candidate);
        }
      };

      // Create offer to start ICE gathering
      testPC.createOffer({ offerToReceiveAudio: true }).then(offer => {
        return testPC.setLocalDescription(offer);
      }).catch(error => {
        console.error('TURN test failed:', error);
        clearTimeout(timeout);
        testPC.close();
        resolve();
      });
    });

    await testPromise;
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
            console.log(`🌐 STUN candidate found (#${stunCandidatesFound})`);
          } else if (candidate.includes('typ relay')) {
            turnCandidatesFound++;
            console.log(`🔄 TURN candidate found (#${turnCandidatesFound})`);
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

  // Public diagnostic methods for UI integration

  /**
   * Run comprehensive connection diagnostics - useful when calls fail
   */
  async runDiagnostics(): Promise<void> {
    console.log('🔍 Running WebRTC diagnostics...');
    
    // Test TURN connectivity first
    await this.testTurnConnectivity();
    
    // Log current connection state
    await this.logConnectionDiagnostics();
  }

  /**
   * Get network diagnostic summary for display in UI
   */
  getNetworkSummary(): {
    networkType: string;
    localCandidates: number;
    remoteCandidates: number;
    connectionAttempts: number;
    lastFailure: string;
    hasRelayCandidates: boolean;
  } {
    const hasLocalRelay = Array.from(this.networkDiagnostics.localCandidates.values())
      .some(c => this.parseCandidateInfo(c).type === 'relay');
    const hasRemoteRelay = Array.from(this.networkDiagnostics.remoteCandidates.values())
      .some(c => this.parseCandidateInfo(c).type === 'relay');

    return {
      networkType: this.networkDiagnostics.networkType,
      localCandidates: this.networkDiagnostics.localCandidates.size,
      remoteCandidates: this.networkDiagnostics.remoteCandidates.size,
      connectionAttempts: this.networkDiagnostics.connectionAttempts,
      lastFailure: this.networkDiagnostics.lastFailureReason,
      hasRelayCandidates: hasLocalRelay || hasRemoteRelay
    };
  }

  /**
   * Check if connection is likely to work across networks
   */
  isReadyForCrossNetwork(): boolean {
    const summary = this.getNetworkSummary();
    return summary.hasRelayCandidates || summary.localCandidates > 1;
  }

  /**
   * Reset diagnostic counters (call at start of new call attempt)
   */
  resetDiagnostics(): void {
    this.networkDiagnostics = {
      localCandidates: new Map(),
      remoteCandidates: new Map(),
      candidatePairs: [],
      connectionAttempts: 0,
      lastFailureReason: '',
      networkType: this.detectNetworkType()
    };
  }

  // Process pending ICE candidates after remote description is set
  private async processPendingCandidates(): Promise<void> {
    if (this.pendingCandidates.length === 0) {
      return;
    }

    console.log(`🔄 Processing ${this.pendingCandidates.length} pending ICE candidates...`);
    
    // Process all pending candidates
    for (const candidate of this.pendingCandidates) {
      try {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(candidate);
          console.log('✅ Processed pending ICE candidate');
          
          // Track remote candidate for network analysis
          if (candidate.candidate) {
            const rtcCandidate = new RTCIceCandidate(candidate);
            this.trackIceCandidate(rtcCandidate, false);
          }
        }
      } catch (error) {
        console.error('❌ Failed to process pending ICE candidate:', error);
        // Continue processing other candidates even if one fails
      }
    }
    
    // Clear the pending candidates queue
    this.pendingCandidates = [];
    console.log('✅ Finished processing pending ICE candidates');
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();
