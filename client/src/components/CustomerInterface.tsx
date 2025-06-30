import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketService } from '../services/socket';
import { WebRTCService } from '../services/webrtc';

// Icons
const PhoneIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

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

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type CallState = 'idle' | 'requesting' | 'waiting' | 'ringing' | 'connected' | 'ended';

const CustomerInterface: React.FC = () => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);

  // Services
  const socketService = useRef<SocketService | null>(null);
  const webrtcService = useRef<WebRTCService | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStartTime = useRef<number | null>(null);

  // Initialize services
  useEffect(() => {
    socketService.current = new SocketService();
    webrtcService.current = new WebRTCService();

    connectToServer();

    return () => {
      cleanup();
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    let interval: number;
    if (callState === 'connected' && callStartTime.current) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.current!) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  const connectToServer = async () => {
    if (!socketService.current) return;

    try {
      setConnectionState('connecting');
      await socketService.current.connect();
      setupSocketListeners();
      setConnectionState('connected');
    } catch (error) {
      setConnectionState('disconnected');
      setError('Failed to connect to server. Please try again.');
    }
  };

  const setupSocketListeners = () => {
    if (!socketService.current) return;

    const socket = socketService.current;

    socket.on('agent-available', () => {
      setCallState('ringing');
    });

    socket.on('call-accepted', () => {
      setCallState('connected');
      callStartTime.current = Date.now();
      initiateWebRTCCall();
    });

    socket.on('call-declined', () => {
      setCallState('ended');
      setError('Call was declined. Please try again later.');
    });

    socket.on('agent-disconnected', () => {
      setCallState('ended');
      setError('Agent disconnected. Call ended.');
    });

    socket.on('no-agents-available', () => {
      setCallState('waiting');
    });

    // WebRTC signaling
    socket.on('offer', async ({ offer }) => {
      if (webrtcService.current) {
        try {
          const answer = await webrtcService.current.createAnswer(offer);
          socket.sendAnswer(answer, 'agent');
        } catch (error) {
          console.error('Error creating answer:', error);
        }
      }
    });

    socket.on('answer', async ({ answer }) => {
      if (webrtcService.current) {
        try {
          await webrtcService.current.setRemoteAnswer(answer);
        } catch (error) {
          console.error('Error setting remote answer:', error);
        }
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (webrtcService.current) {
        try {
          await webrtcService.current.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });
  };

  const requestCall = async () => {
    if (!socketService.current || !customerName.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      setError('');
      setCallState('requesting');
      
      // Get user media first
      await webrtcService.current?.getUserMedia();
      
      // Request call from agent
      socketService.current.emit('customer-request-call', {
        customerName: customerName.trim()
      });
      
    } catch (error) {
      setError('Could not access microphone. Please check permissions.');
      setCallState('idle');
    }
  };

  const initiateWebRTCCall = async () => {
    if (!webrtcService.current || !socketService.current) return;

    // Setup WebRTC listeners
    webrtcService.current.onRemoteStream((stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });

    webrtcService.current.onIceCandidate((candidate) => {
      socketService.current!.sendIceCandidate(candidate, 'agent');
    });
  };

  const endCall = () => {
    if (socketService.current) {
      socketService.current.emit('customer-end-call');
    }
    cleanup();
    setCallState('idle');
    setCallDuration(0);
    callStartTime.current = null;
  };

  const toggleMute = () => {
    if (webrtcService.current) {
      const muted = webrtcService.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const cleanup = () => {
    webrtcService.current?.cleanup();
    socketService.current?.disconnect();
    setConnectionState('disconnected');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStatusText = () => {
    switch (callState) {
      case 'requesting': return 'Connecting to customer service...';
      case 'waiting': return 'Waiting for an available agent...';
      case 'ringing': return 'Agent is responding...';
      case 'connected': return 'Connected to agent';
      case 'ended': return 'Call ended';
      default: return 'Ready to connect';
    }
  };

  const getCallStatusColor = () => {
    switch (callState) {
      case 'requesting': return 'text-yellow-600';
      case 'waiting': return 'text-yellow-600';
      case 'ringing': return 'text-blue-600';
      case 'connected': return 'text-green-600';
      case 'ended': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800 mb-4 text-sm"
          >
            ← Back to Home
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Customer Service</h1>
          <p className="text-gray-600">Connect with our support team</p>
        </div>

        {/* Connection Status */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center space-x-2 ${connectionState === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-sm">
              {connectionState === 'connected' ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Main Interface */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          {callState === 'idle' ? (
            /* Initial State */
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <PhoneIcon className="w-10 h-10 text-blue-600" />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <button
                onClick={requestCall}
                disabled={!customerName.trim() || connectionState !== 'connected'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-4 rounded-lg transition-colors text-lg"
              >
                Call Customer Service
              </button>
            </div>
          ) : (
            /* Call State */
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                callState === 'connected' ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <PhoneIcon className={`w-10 h-10 ${
                  callState === 'connected' ? 'text-green-600' : 'text-yellow-600'
                }`} />
              </div>
              
              <h3 className="text-xl font-semibold mb-2">Hello, {customerName}!</h3>
              <p className={`mb-4 ${getCallStatusColor()}`}>{getCallStatusText()}</p>
              
              {callState === 'connected' && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Call Duration</p>
                  <p className="text-2xl font-mono text-gray-800">{formatTime(callDuration)}</p>
                </div>
              )}
              
              {(callState === 'waiting' || callState === 'requesting') && (
                <div className="mb-6">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
              )}
              
              {/* Call Controls */}
              {callState === 'connected' && (
                <div className="flex justify-center space-x-4 mb-6">
                  <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${
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
                </div>
              )}
              
              <button
                onClick={endCall}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                {callState === 'connected' ? 'End Call' : 'Cancel'}
              </button>
            </div>
          )}
        </div>

        {/* Audio Elements */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default CustomerInterface;
