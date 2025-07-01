import { io, Socket } from 'socket.io-client';

export interface User {
  id: string;
  username: string;
  joinedAt: Date;
}

export interface Room {
  id: string;
  users: User[];
  createdAt: Date;
}

export interface SocketEvents {
  // Room events (legacy)
  'room-joined': (data: { roomId: string; user: User; roomUsers: User[] }) => void;
  'room-ready': (data: { roomUsers: User[] }) => void;
  'room-full': () => void;
  'user-joined': (data: { user: User; roomUsers: User[] }) => void;
  'user-left': (data: { userId: string; username: string; roomUsers: User[] }) => void;
  'left-room': () => void;
  
  // Customer events
  'agent-available': () => void;
  'call-accepted': () => void;
  'call-declined': () => void;
  'agent-disconnected': () => void;
  'no-agents-available': () => void;
  
  // Agent events
  'incoming-call': (data: { customerName: string; customerId: string }) => void;
  'customer-disconnected': () => void;
  
  // WebRTC signaling events
  'offer': (data: { offer: RTCSessionDescriptionInit; fromUserId: string }) => void;
  'answer': (data: { answer: RTCSessionDescriptionInit; fromUserId: string }) => void;
  'ice-candidate': (data: { candidate: RTCIceCandidateInit; fromUserId: string }) => void;
  
  // Audio status events
  'user-audio-status': (data: { userId: string; isMuted: boolean }) => void;
  
  // Error events
  'error': (data: { message: string }) => void;
  'connect': () => void;
  'disconnect': () => void;
}

export class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  // Connect to the socket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
        });

        this.socket.on('connect', () => {
          console.log('Connected to server:', this.socket?.id);
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Disconnect from the socket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Join a room
  joinRoom(username: string, roomId?: string): void {
    if (this.socket) {
      this.socket.emit('join-room', { username, roomId });
    }
  }

  // Leave the current room
  leaveRoom(): void {
    if (this.socket) {
      this.socket.emit('leave-room');
    }
  }

  // Send WebRTC offer
  sendOffer(offer: RTCSessionDescriptionInit, targetUserId: string): void {
    if (this.socket) {
      this.socket.emit('offer', { offer, targetUserId });
    }
  }

  // Send WebRTC answer
  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId: string): void {
    if (this.socket) {
      this.socket.emit('answer', { answer, targetUserId });
    }
  }

  // Send ICE candidate
  sendIceCandidate(candidate: RTCIceCandidateInit, targetUserId: string): void {
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
}
