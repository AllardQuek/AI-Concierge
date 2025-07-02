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

    // Ensure we have a local stream
    if (!this.localStream) {
      console.log('No local stream, getting user media...');
      await this.getUserMedia();
    }

    if (!this.peerConnection) {
      throw new Error('Failed to initialize peer connection');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // Create answer for responding to offer
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Ensure we have a local stream before creating answer
    if (!this.localStream) {
      console.log('No local stream when creating answer, getting user media...');
      await this.getUserMedia();
    }

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    console.log('Created answer with local tracks:', this.localStream?.getTracks().length || 0);
    return answer;
  }

  // Set remote answer
  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(answer);
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
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
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
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    
    // Reinitialize for next call
    this.initializePeerConnection();
  }

  // Get connection state
  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'disconnected';
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
}
