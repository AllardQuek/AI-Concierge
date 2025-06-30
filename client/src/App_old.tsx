import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import CustomerInterface from './components/CustomerInterface';
import AgentInterface from './components/AgentInterface';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/customer" element={<CustomerInterface />} />
          <Route path="/agent" element={<AgentInterface />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;

// Icons (simplified versions)
const MicrophoneIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const MicrophoneSlashIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 5.586l12.828 12.828M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const PhoneIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';
type CallState = 'idle' | 'joining' | 'calling' | 'in-call' | 'ended';

const App: React.FC = () => {
  // State management
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUserMuted, setRemoteUserMuted] = useState(false);
  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  const [error, setError] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');

  // Services
  const socketService = useRef<SocketService | null>(null);
  const webrtcService = useRef<WebRTCService | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize services
  useEffect(() => {
    socketService.current = new SocketService();
    webrtcService.current = new WebRTCService();

    return () => {
      cleanup();
    };
  }, []);

  // Setup socket event listeners
  useEffect(() => {
    if (!socketService.current) return;

    const socket = socketService.current;

    // Connection events
    socket.on('connect', () => {
      setConnectionState('connected');
      setError('');
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      setCallState('ended');
    });

    // Room events
    socket.on('room-joined', ({ roomId, user, roomUsers }) => {
      setCurrentRoomId(roomId);
      setRoomUsers(roomUsers);
      setCallState('calling');
      console.log('Joined room:', roomId);
    });

    socket.on('room-ready', ({ roomUsers }) => {
      setRoomUsers(roomUsers);
      if (roomUsers.length === 2) {
        initiateCall();
      }
    });

    socket.on('room-full', () => {
      setError('Room is full. Please try another room.');
      setCallState('idle');
    });

    socket.on('user-joined', ({ user, roomUsers }) => {
      setRoomUsers(roomUsers);
      console.log('User joined:', user.username);
    });

    socket.on('user-left', ({ userId, username, roomUsers }) => {
      setRoomUsers(roomUsers);
      setCallState('ended');
      console.log('User left:', username);
    });

    // WebRTC signaling events
    socket.on('offer', async ({ offer, fromUserId }) => {
      if (webrtcService.current) {
        try {
          const answer = await webrtcService.current.createAnswer(offer);
          socket.sendAnswer(answer, fromUserId);
        } catch (error) {
          console.error('Error creating answer:', error);
        }
      }
    });

    socket.on('answer', async ({ answer, fromUserId }) => {
      if (webrtcService.current) {
        try {
          await webrtcService.current.setRemoteAnswer(answer);
          setCallState('in-call');
        } catch (error) {
          console.error('Error setting remote answer:', error);
        }
      }
    });

    socket.on('ice-candidate', async ({ candidate, fromUserId }) => {
      if (webrtcService.current) {
        try {
          await webrtcService.current.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    socket.on('user-audio-status', ({ userId, isMuted }) => {
      setRemoteUserMuted(isMuted);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    return () => {
      // Cleanup listeners
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-joined');
      socket.off('room-ready');
      socket.off('room-full');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-audio-status');
      socket.off('error');
    };
  }, []);

  // Setup WebRTC event listeners
  useEffect(() => {
    if (!webrtcService.current || !socketService.current) return;

    const webrtc = webrtcService.current;
    const socket = socketService.current;

    // Handle remote stream
    webrtc.onRemoteStream((stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });

    // Handle ICE candidates
    webrtc.onIceCandidate((candidate) => {
      const remoteUser = roomUsers.find(user => user.id !== socket.getSocketId());
      if (remoteUser) {
        socket.sendIceCandidate(candidate, remoteUser.id);
      }
    });

    // Handle connection state changes
    webrtc.onConnectionStateChange((state) => {
      console.log('WebRTC connection state:', state);
      if (state === 'connected') {
        setCallState('in-call');
      } else if (state === 'failed' || state === 'disconnected') {
        setCallState('ended');
      }
    });
  }, [roomUsers]);

  const connectToServer = async () => {
    if (!socketService.current) return;

    try {
      setConnectionState('connecting');
      await socketService.current.connect();
    } catch (error) {
      setConnectionState('disconnected');
      setError('Failed to connect to server. Please try again.');
    }
  };

  const joinRoom = async () => {
    if (!socketService.current || !webrtcService.current || !username.trim()) {
      setError('Please enter a username');
      return;
    }

    try {
      setError('');
      setCallState('joining');
      
      // Get user media first
      await webrtcService.current.getUserMedia();
      
      // Join room
      socketService.current.joinRoom(username.trim(), roomId.trim() || undefined);
      
    } catch (error) {
      setError('Could not access microphone. Please check permissions.');
      setCallState('idle');
    }
  };

  const initiateCall = async () => {
    if (!webrtcService.current || !socketService.current) return;

    try {
      const offer = await webrtcService.current.createOffer();
      const remoteUser = roomUsers.find(user => user.id !== socketService.current?.getSocketId());
      
      if (remoteUser) {
        socketService.current.sendOffer(offer, remoteUser.id);
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      setError('Failed to initiate call');
    }
  };

  const toggleMute = () => {
    if (webrtcService.current && socketService.current) {
      const muted = webrtcService.current.toggleMute();
      setIsMuted(muted);
      socketService.current.sendAudioStatus(muted);
    }
  };

  const endCall = () => {
    if (socketService.current) {
      socketService.current.leaveRoom();
    }
    cleanup();
    setCallState('idle');
    setCurrentRoomId('');
    setRoomUsers([]);
  };

  const cleanup = () => {
    webrtcService.current?.cleanup();
    socketService.current?.disconnect();
    setConnectionState('disconnected');
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCallStateText = () => {
    switch (callState) {
      case 'joining': return 'Joining room...';
      case 'calling': return 'Waiting for another user...';
      case 'in-call': return 'In call';
      case 'ended': return 'Call ended';
      default: return 'Ready to start';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🎙️ Voice Bot</h1>
          <p className="text-gray-600">Modern voice chat for seamless conversations</p>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center mt-4 space-x-2">
            <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()}`}></div>
            <span className="text-sm text-gray-600">
              {connectionState === 'connected' ? 'Connected' : 
               connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          {connectionState !== 'connected' ? (
            /* Connection Screen */
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Connect to Voice Server</h2>
              <button
                onClick={connectToServer}
                disabled={connectionState === 'connecting'}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-8 rounded-lg transition-colors"
              >
                {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          ) : callState === 'idle' ? (
            /* Join Room Screen */
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-semibold text-center mb-6">Join Voice Room</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room ID (optional)
                  </label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Leave empty for random room"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                
                <button
                  onClick={joinRoom}
                  disabled={!username.trim() || callState === 'joining'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  {callState === 'joining' ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </div>
          ) : (
            /* Call Interface */
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Voice Room</h2>
              <p className="text-gray-600 mb-1">Room ID: {currentRoomId}</p>
              <p className="text-sm text-gray-500 mb-6">{getCallStateText()}</p>
              
              {/* Users */}
              <div className="flex justify-center space-x-8 mb-8">
                {roomUsers.map((user) => (
                  <div key={user.id} className="text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2 ${
                      user.id === socketService.current?.getSocketId() ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-gray-500">
                      {user.id === socketService.current?.getSocketId() ? 
                        (isMuted ? 'Muted' : 'Speaking') : 
                        (remoteUserMuted ? 'Muted' : 'Speaking')
                      }
                    </p>
                  </div>
                ))}
              </div>
              
              {/* Call Controls */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-colors ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {isMuted ? (
                    <MicrophoneSlashIcon className="w-6 h-6" />
                  ) : (
                    <MicrophoneIcon className="w-6 h-6" />
                  )}
                </button>
                
                <button
                  onClick={endCall}
                  className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                >
                  <PhoneIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audio Elements */}
        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default App;
