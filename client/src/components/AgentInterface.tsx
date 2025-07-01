import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketService } from '../services/socket';
import { WebRTCService } from '../services/webrtc';
// import AIDashboard from './AIDashboard'; // Temporarily disabled for deployment

// Icons
const HeadsetIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

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
type AgentStatus = 'available' | 'busy' | 'away';
type CallState = 'idle' | 'incoming' | 'connected' | 'ended';

interface IncomingCall {
  customerName: string;
  customerId: string;
  timestamp: number;
}

const AgentInterface: React.FC = () => {
  const navigate = useNavigate();
  const [agentName, setAgentName] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('away');
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<IncomingCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Services
  const socketService = useRef<SocketService | null>(null);
  const webrtcService = useRef<WebRTCService | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStartTime = useRef<number | null>(null);

  // Initialize services
  useEffect(() => {
    socketService.current = new SocketService();
    webrtcService.current = new WebRTCService();

    return () => {
      cleanup();
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    let interval: number;
    if (callState === 'connected' && callStartTime.current) {
      interval = window.setInterval(() => {
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

    // Remove any existing listeners first to prevent duplicates
    socket.off('incoming-call');
    socket.off('customer-disconnected');
    socket.off('offer');
    socket.off('answer');
    socket.off('ice-candidate');

    // Customer call requests
    socket.on('incoming-call', ({ customerName, customerId }) => {
      setCurrentCall({
        customerName,
        customerId,
        timestamp: Date.now()
      });
      setCallState('incoming');
      playRingtone();
    });

    socket.on('customer-disconnected', () => {
      setCallState('idle');
      setCurrentCall(null);
      stopRingtone();
      // Clean up WebRTC resources including microphone
      webrtcService.current?.cleanup();
      setCallDuration(0);
      callStartTime.current = null;
    });

    // WebRTC signaling
    socket.on('offer', async ({ offer }) => {
      if (webrtcService.current) {
        try {
          const answer = await webrtcService.current.createAnswer(offer);
          socket.sendAnswer(answer, currentCall?.customerId || 'customer');
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

  const loginAgent = async () => {
    if (!agentName.trim()) {
      setError('Please enter your agent name');
      return;
    }

    // Prevent double-clicking during login
    if (isLoggingIn) {
      return;
    }

    try {
      setIsLoggingIn(true);
      setError('');
      
      await connectToServer();
      
      // Check if socket is actually connected rather than relying on state
      if (socketService.current?.isConnected()) {
        setIsLoggedIn(true);
        setAgentStatus('available');
        
        // Register as agent
        socketService.current?.emit('agent-login', {
          agentName: agentName.trim()
        });
      } else {
        setError('Failed to connect to server. Please try again.');
      }
    } catch (error) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateAgentStatus = (status: AgentStatus) => {
    setAgentStatus(status);
    socketService.current?.emit('agent-status-change', { status });
  };

  const acceptCall = async () => {
    if (!currentCall || !socketService.current) return;

    try {
      stopRingtone();
      setCallState('connected');
      callStartTime.current = Date.now();
      
      // Get user media
      await webrtcService.current?.getUserMedia();
      
      // Accept the call
      socketService.current.emit('agent-accept-call', {
        customerId: currentCall.customerId
      });
      
      setupWebRTCCall();
      
    } catch (error) {
      setError('Could not access microphone. Please check permissions.');
      // Clean up any resources that might have been allocated
      webrtcService.current?.cleanup();
      declineCall();
    }
  };

  const declineCall = () => {
    if (!currentCall || !socketService.current) return;

    stopRingtone();
    socketService.current.emit('agent-decline-call', {
      customerId: currentCall.customerId
    });
    
    setCallState('idle');
    setCurrentCall(null);
  };

  const setupWebRTCCall = () => {
    if (!webrtcService.current) return;

    // Setup WebRTC listeners
    webrtcService.current.onRemoteStream((stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });

    webrtcService.current.onIceCandidate((candidate) => {
      socketService.current!.sendIceCandidate(candidate, currentCall?.customerId || 'customer');
    });
  };

  const endCall = () => {
    if (socketService.current && currentCall) {
      socketService.current.emit('agent-end-call', {
        customerId: currentCall.customerId
      });
    }
    
    // Clean up WebRTC but keep agent available for more calls
    webrtcService.current?.cleanup();
    setCallState('idle');
    setCurrentCall(null);
    setCallDuration(0);
    callStartTime.current = null;
  };

  const toggleMute = () => {
    if (webrtcService.current) {
      const muted = webrtcService.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const playRingtone = () => {
    // You can implement actual ringtone here
    console.log('Playing ringtone...');
  };

  const stopRingtone = () => {
    console.log('Stopping ringtone...');
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
    
    // Full cleanup - for logout/disconnect scenarios
    webrtcService.current?.cleanup();
    setAgentStatus('away');
  };

  const logout = () => {
    cleanup();
    socketService.current?.disconnect();
    
    // Reset all state to initial values
    setIsLoggedIn(false);
    setIsLoggingIn(false);
    setConnectionState('disconnected');
    setCallState('idle');
    setCurrentCall(null);
    setAgentStatus('away');
    setError('');
    setCallDuration(0);
    setIsMuted(false);
    callStartTime.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-red-500';
      case 'away': return 'bg-gray-500';
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-800 mb-4 text-sm"
            >
              ← Back to Home
            </button>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Agent Login</h1>
            <p className="text-gray-600">Access your agent dashboard</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-xl p-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <HeadsetIcon className="w-10 h-10 text-green-600" />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Enter your agent name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              
              <button
                onClick={loginAgent}
                disabled={!agentName.trim() || connectionState === 'connecting' || isLoggingIn}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-4 rounded-lg transition-colors text-lg"
              >
                {(connectionState === 'connecting' || isLoggingIn) ? 'Connecting...' : 'Login to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Agent Dashboard</h1>
              <p className="text-gray-600">Welcome, {agentName}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(agentStatus)}`}></div>
                <select
                  value={agentStatus}
                  onChange={(e) => updateAgentStatus(e.target.value as AgentStatus)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                  disabled={callState === 'connected'}
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="away">Away</option>
                </select>
              </div>
              
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {callState === 'incoming' && currentCall ? (
          /* Incoming Call */
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <PhoneIcon className="w-10 h-10 text-blue-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Incoming Call</h2>
            <p className="text-xl text-gray-600 mb-2">{currentCall.customerName}</p>
            <p className="text-sm text-gray-500 mb-8">
              Waiting for {Math.floor((Date.now() - currentCall.timestamp) / 1000)}s
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={acceptCall}
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-8 rounded-lg transition-colors"
              >
                Accept Call
              </button>
              <button
                onClick={declineCall}
                className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-8 rounded-lg transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        ) : callState === 'connected' && currentCall ? (
          /* Active Call */
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <PhoneIcon className="w-10 h-10 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Connected</h2>
            <p className="text-xl text-gray-600 mb-2">{currentCall.customerName}</p>
            <p className="text-2xl font-mono text-gray-800 mb-8">{formatTime(callDuration)}</p>
            
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
            
            <button
              onClick={endCall}
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-8 rounded-lg transition-colors"
            >
              End Call
            </button>
          </div>
        ) : (
          /* Waiting for Calls */
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <HeadsetIcon className="w-10 h-10 text-gray-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready for Calls</h2>
            <p className="text-gray-600 mb-8">
              {agentStatus === 'available' 
                ? 'Waiting for incoming customer calls...' 
                : 'Set your status to "Available" to receive calls'
              }
            </p>
            
            {agentStatus !== 'available' && (
              <button
                onClick={() => updateAgentStatus('available')}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Go Available
              </button>
            )}
          </div>
        )}

        {/* Audio Elements */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* AI Dashboard Component - Temporarily disabled for deployment */}
      {/* <div className="mt-8">
        <AIDashboard 
          sessionId={currentCall?.customerId || ''}
          isCallActive={callState === 'connected'}
          onActionExecute={(actionId, approved) => {
            console.log(`Action ${actionId} ${approved ? 'approved' : 'declined'}`);
          }}
        />
      </div> */}
    </div>
  );
};

export default AgentInterface;
