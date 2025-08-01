import { io, Socket } from 'socket.io-client';

export interface SocketEvents {
  // Peer-to-peer call events
  'call-user': (data: { targetCode: string; callerCode: string; offer?: RTCSessionDescriptionInit }) => void;
  'user-calling': (data: { callerCode: string; offer?: RTCSessionDescriptionInit }) => void;
  'call-answered': (data: { answer: RTCSessionDescriptionInit }) => void;
  'answer-call': (data: { callerCode: string; answer: RTCSessionDescriptionInit }) => void;
  'call-declined': () => void;  // No data sent from server
  'decline-call': (data: { callerCode: string }) => void;
  'call-ended': (data: { fromCode: string }) => void;
  'end-call': (data: { targetCode: string; callerCode: string }) => void;
  
  // WebRTC signaling events
  'offer': (data: { offer: RTCSessionDescriptionInit; fromUserId: string }) => void;
  'answer': (data: { answer: RTCSessionDescriptionInit; fromUserId: string }) => void;
  'ice-candidate': (data: { candidate: RTCIceCandidateInit; fromUserId: string }) => void;
  
  // Azure transcription events
  'transcript-partial': (data: { text: string }) => void;
  'transcript-final': (data: { text: string }) => void;
  'transcription-error': (data: { message: string }) => void;
  'transcription-ended': () => void;
  
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'reconnect': (attemptNumber: number) => void;
  'reconnect_attempt': (attemptNumber: number) => void;
  'reconnect_error': (error: Error) => void;
  'reconnect_failed': () => void;
  
  // Error events
  'error': (data: { message: string }) => void;
}

export class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor(serverUrl?: string) {
    // Use environment variable or fallback to localhost
    this.serverUrl = serverUrl || 
      (import.meta as any).env?.VITE_SERVER_URL || 
      'http://localhost:3001';
    
    // Debug logging to see what URL is being used
    console.log('SocketService: Connecting to server URL:', this.serverUrl);
    console.log('SocketService: Environment:', (import.meta as any).env?.NODE_ENV);
    console.log('SocketService: VITE_SERVER_URL:', (import.meta as any).env?.VITE_SERVER_URL);
  }

  // Connect to the socket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('SocketService: Attempting to connect to:', this.serverUrl);
        
        // If already connected, resolve immediately
        if (this.socket && this.socket.connected) {
          console.log('SocketService: Already connected, reusing connection');
          resolve();
          return;
        }

        // Clean up existing socket if it exists but is not connected
        if (this.socket) {
          console.log('SocketService: Cleaning up existing disconnected socket');
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          autoConnect: true,
          // Connection stability improvements
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
        });

        this.socket.on('connect', () => {
          console.log('SocketService: Connected to server:', this.socket?.id, 'at URL:', this.serverUrl);
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('SocketService: Disconnected from server at URL:', this.serverUrl, 'Reason:', reason);
          // Don't auto-reconnect on intentional disconnects
          if (reason === 'io client disconnect') {
            console.log('SocketService: Intentional disconnect, not reconnecting');
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log('SocketService: Reconnected after', attemptNumber, 'attempts');
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log('SocketService: Reconnection attempt', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
          console.log('SocketService: Reconnection error:', error.message);
        });

        this.socket.on('reconnect_failed', () => {
          console.log('SocketService: Reconnection failed after maximum attempts');
          reject(new Error('Failed to reconnect to server'));
        });

        this.socket.on('connect_error', (error) => {
          console.error('SocketService: Connection error to', this.serverUrl, ':', error);
          
          // Provide helpful error messages based on error type
          if (error.message.includes('ECONNREFUSED')) {
            console.error('SocketService: Backend server is not running on', this.serverUrl);
            console.error('SocketService: Please start the backend server with: npm run server:dev');
          } else if (error.message.includes('websocket error')) {
            console.error('SocketService: WebSocket connection failed, trying polling...');
          }
          
          reject(error);
        });

      } catch (error) {
        console.error('SocketService: Connect method error:', error);
        reject(error);
      }
    });
  }

  // Disconnect from the socket server
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Join a room
  joinRoom(username: string, roomId?: string): void {
    if (this.socket) {
      if (roomId) {
        // Traditional room join with room ID
        this.socket.emit('join-room', { username, roomId });
      } else {
        // P2P join with just username (user code)
        this.socket.emit('join-room', { username });
      }
    }
  }

  // Leave the current room
  leaveRoom(): void {
    if (this.socket) {
      this.socket.emit('leave-room');
    }
  }

  // Send WebRTC offer
  sendOffer(offer: RTCSessionDescriptionInit, targetUserId?: string | null): void {
    if (this.socket) {
      this.socket.emit('offer', { offer, targetUserId });
    }
  }

  // Send WebRTC answer
  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId?: string | null): void {
    if (this.socket) {
      this.socket.emit('answer', { answer, targetUserId });
    }
  }

  // Send ICE candidate
  sendIceCandidate(candidate: RTCIceCandidateInit, targetUserId?: string | null): void {
    if (this.socket) {
      this.socket.emit('ice-candidate', { candidate, targetUserId });
    }
  }

  // Send audio status (muted/unmuted)
  sendAudioStatus(isMuted: boolean): void {
    if (this.socket) {
      this.socket.emit('audio-status', { isMuted });
    }
  }

  // Azure transcription methods
  startTranscription(): void {
    if (this.socket) {
      this.socket.emit('start-transcription');
    }
  }

  /**
   * Send an audio chunk to the server for transcription.
   * @param payload - Object containing data (Uint8Array), durationSec (number), and sampleRate (number)
   */
  sendAudioChunk(payload: { data: Uint8Array; durationSec: number; sampleRate: number }): void {
    if (this.socket) {
      // console.log(`🔊 SocketService: Emitting audio-chunk event: ${payload.data.length} bytes, ${payload.durationSec}s, sampleRate: ${payload.sampleRate}`);
      this.socket.emit('audio-chunk', payload);
    } else {
      console.warn('🔊 SocketService: No socket available to send audio chunk');
    }
  }

  stopTranscription(): void {
    if (this.socket) {
      this.socket.emit('stop-transcription');
    }
  }

  // Generic emit method for new events
  emit(event: string, data?: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  // Event listeners
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (this.socket) {
      this.socket.on(event as string, callback as any);
    }
  }

  // Remove event listeners
  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event as string, callback as any);
      } else {
        this.socket.off(event as string);
      }
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Get the underlying socket for sharing with other services
  getSocket(): Socket | null {
    return this.socket;
  }
}
