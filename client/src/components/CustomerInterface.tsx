import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketService } from '../services/socket';
import { WebRTCService } from '../services/webrtc';
import { PhoneIcon, MicrophoneIcon, MicrophoneSlashIcon, ConnectionStatus, ErrorMessage, Card, IconCircle, Button, TextInput } from './shared';

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

    // Monitor socket connection state
    socket.on('connect', () => {
      setConnectionState('connected');
      setError('');
    });

    socket.on('disconnect', (reason) => {
      console.log('Customer: Disconnected, reason:', reason);
      setConnectionState('disconnected');
      // Only reset call state for unexpected disconnects
      if (reason !== 'io client disconnect' && callState !== 'idle') {
        setCallState('idle');
        setError('Connection lost. Attempting to reconnect...');
        webrtcService.current?.cleanup();
        setCallDuration(0);
        callStartTime.current = null;
      }
    });

    socket.on('reconnect', () => {
      console.log('Customer: Reconnected to server');
      setConnectionState('connected');
      setError('');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Customer: Reconnection attempt', attemptNumber);
      setConnectionState('connecting');
    });

    socket.on('reconnect_error', (error) => {
      console.log('Customer: Reconnection error:', error);
      setError('Reconnection failed. Please refresh the page.');
    });

    socket.on('agent-available', () => {
      setCallState('ringing');
    });

    socket.on('call-accepted', () => {
      setCallState('connected');
      callStartTime.current = Date.now();
      initiateWebRTCCall();
    });

    socket.on('call-declined', () => {
      setCallState('idle');
      setError('Call was declined. Please try again later.');
      // Clean up WebRTC but keep connection for retry
      webrtcService.current?.cleanup();
    });

    socket.on('agent-disconnected', () => {
      setCallState('idle');
      setError('Agent disconnected. Call ended.');
      // Clean up WebRTC but keep connection for retry
      webrtcService.current?.cleanup();
      setCallDuration(0);
      callStartTime.current = null;
    });

    socket.on('no-agents-available', () => {
      setCallState('waiting');
    });

    // WebRTC signaling
    socket.on('offer', async ({ offer }) => {
      if (webrtcService.current) {
        try {
          const answer = await webrtcService.current.createAnswer(offer);
          socket.sendAnswer(answer, null); // Let server auto-detect target
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
      
      // Prepare mobile audio BEFORE getting user media
      if (webrtcService.current) {
        await webrtcService.current.ensureMobileAudioReady();
      }
      
      // Get user media first
      await webrtcService.current?.getUserMedia();
      
      // Setup WebRTC listeners immediately after getting media
      setupWebRTCListeners();
      
      // Request call from agent
      socketService.current.emit('customer-request-call', {
        customerName: customerName.trim()
      });
      
    } catch (error) {
      setError('Could not access microphone. Please check permissions.');
      setCallState('idle');
    }
  };

  const setupWebRTCListeners = () => {
    if (!webrtcService.current || !socketService.current) return;

    // Setup WebRTC listeners
    webrtcService.current.onRemoteStream((stream) => {
      console.log('Customer: Received remote stream from agent');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(e => console.log('Audio play failed:', e));
      }
    });

    webrtcService.current.onIceCandidate((candidate) => {
      console.log('Customer: Sending ICE candidate to agent');
      socketService.current!.sendIceCandidate(candidate, null); // Let server auto-detect target
    });
  };

  const initiateWebRTCCall = async () => {
    if (!webrtcService.current || !socketService.current) return;

    // Create and send offer to start WebRTC connection
    try {
      const offer = await webrtcService.current.createOffer();
      socketService.current.sendOffer(offer, null); // Let server auto-detect target
      console.log('Customer: Sent WebRTC offer to agent');
    } catch (error) {
      console.error('Error creating WebRTC offer:', error);
      setError('Failed to establish voice connection');
    }
  };

  const endCall = () => {
    if (socketService.current) {
      socketService.current.emit('customer-end-call');
    }
    // Clean up WebRTC but keep socket connection alive for future calls
    webrtcService.current?.cleanup();
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

  // Add local audio monitoring for testing
  const [localMonitoring, setLocalMonitoring] = useState<HTMLAudioElement | null>(null);
  
  const toggleLocalMonitoring = () => {
    if (localMonitoring) {
      // Stop monitoring
      localMonitoring.pause();
      localMonitoring.srcObject = null;
      setLocalMonitoring(null);
      console.log('Local audio monitoring disabled');
    } else {
      // Start monitoring
      if (webrtcService.current?.getLocalStream()) {
        const localAudio = document.createElement('audio');
        localAudio.srcObject = webrtcService.current.getLocalStream();
        localAudio.volume = 0.1; // Low volume to prevent feedback
        localAudio.play();
        setLocalMonitoring(localAudio);
        console.log('Local audio monitoring enabled - you should hear yourself at low volume');
      } else {
        console.log('No local stream available for monitoring');
      }
    }
  };

  const cleanup = () => {
    // Stop local monitoring if active
    if (localMonitoring) {
      localMonitoring.pause();
      localMonitoring.srcObject = null;
      setLocalMonitoring(null);
    }
    
    // Full cleanup - disconnect socket and clean WebRTC
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
          <ConnectionStatus connectionState={connectionState} className="inline-flex" />
        </div>

        {/* Error Display */}
        <ErrorMessage message={error} className="mb-6" />

        {/* Main Interface */}
        <Card>
          {callState === 'idle' ? (
            /* Initial State */
            <div className="text-center">
              <IconCircle color="blue" size="large" className="mx-auto mb-6">
                <PhoneIcon className="w-10 h-10 text-blue-600" />
              </IconCircle>
              
              <div className="mb-6">
                <TextInput
                  label="Your Name"
                  value={customerName}
                  onChange={setCustomerName}
                  onEnter={requestCall}
                  placeholder="Enter your name"
                />
              </div>
              
              <Button
                onClick={requestCall}
                disabled={!customerName.trim() || connectionState !== 'connected'}
                variant="primary"
                size="large"
                fullWidth
              >
                Call Customer Service
              </Button>
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
                  
                  {/* Test button for local audio monitoring */}
                  <button
                    onClick={toggleLocalMonitoring}
                    className={`p-3 rounded-full transition-colors ${
                      localMonitoring 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                    title={localMonitoring ? "Stop local microphone test" : "Test local microphone (you'll hear yourself)"}
                  >
                    🎧
                  </button>
                </div>
              )}
              
              <Button
                onClick={endCall}
                variant="danger"
                size="medium"
                fullWidth
              >
                {callState === 'connected' ? 'End Call' : 'Cancel'}
              </Button>
            </div>
          )}
        </Card>

        {/* Audio Elements */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default CustomerInterface;
