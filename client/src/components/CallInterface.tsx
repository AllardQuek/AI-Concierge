import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WebRTCService } from '../services/webrtc';
import { SocketService } from '../services/socket';
import { Button, ConnectionStatus, ErrorMessage } from './shared';

type CallState = 'connecting' | 'ringing' | 'connected' | 'disconnected' | 'waiting' | 'incoming';

const CallInterface: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [callState, setCallState] = useState<CallState>('connecting');
  const [error, setError] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [myNumber, setMyNumber] = useState('');
  const [friendNumber, setFriendNumber] = useState('');
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallerNumber, setIncomingCallerNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0); // Call duration in seconds
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [webrtcListenersSetup, setWebrtcListenersSetup] = useState(false);
  
  const webrtcRef = useRef<WebRTCService | null>(null);
  const socketRef = useRef<SocketService | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const callTimerRef = useRef<number | null>(null);

  // Get params from URL
  const toNumber = searchParams.get('to');
  const incomingFromNumber = searchParams.get('incoming');

  // Generate a unique international phone number for this user session
  const generateMyNumber = () => {
    // Generate a unique session ID for this tab/window
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if we have a session-specific number
    const sessionKey = `sybil-user-number-${sessionId}`;
    const globalKey = 'sybil-user-number';
    
    // First, try to get existing number for this session
    let existingNumber = sessionStorage.getItem(sessionKey);
    
    // If no session-specific number, check if we have a global one and this is the first tab
    if (!existingNumber) {
      const globalNumber = localStorage.getItem(globalKey);
      const activeSessionsKey = 'sybil-active-sessions';
      const activeSessions = JSON.parse(localStorage.getItem(activeSessionsKey) || '[]');
      
      if (globalNumber && activeSessions.length === 0) {
        // This is the first tab, reuse the global number
        existingNumber = globalNumber;
        sessionStorage.setItem(sessionKey, existingNumber);
        // Mark this session as active
        activeSessions.push({ sessionId, number: existingNumber });
        localStorage.setItem(activeSessionsKey, JSON.stringify(activeSessions));
        return existingNumber;
      }
    }
    
    if (existingNumber) {
      return existingNumber;
    }
    
    // Generate a new Singapore phone number for this session
    // Singapore mobile numbers start with 8 or 9 and have 8 digits total
    const prefix = Math.random() > 0.5 ? '8' : '9';
    const remainingDigits = Array.from({length: 7}, () => Math.floor(Math.random() * 10)).join('');
    const number = prefix + remainingDigits;
    const formattedNumber = `+65 ${number.substring(0, 4)} ${number.substring(4)}`;
    
    // Store in session storage for this tab
    sessionStorage.setItem(sessionKey, formattedNumber);
    
    // Also store as global backup
    if (!localStorage.getItem(globalKey)) {
      localStorage.setItem(globalKey, formattedNumber);
    }
    
    // Track this session
    const activeSessionsKey = 'sybil-active-sessions';
    const activeSessions = JSON.parse(localStorage.getItem(activeSessionsKey) || '[]');
    activeSessions.push({ sessionId, number: formattedNumber });
    localStorage.setItem(activeSessionsKey, JSON.stringify(activeSessions));
    
    return formattedNumber;
  };

  // Format call duration as MM:SS
  const formatCallDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    initializeCall();
    return () => {
      cleanup();
    };
  }, []);

  // Effect to handle call duration timer
  useEffect(() => {
    if (callState === 'connected' && !callStartTime) {
      // Call just connected, start the timer
      const startTime = Date.now();
      setCallStartTime(startTime);
      
      callTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    } else if (callState !== 'connected' && callTimerRef.current) {
      // Call ended or not connected, stop the timer
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
      setCallStartTime(null);
      setCallDuration(0);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [callState, callStartTime]);

  const initializeCall = async () => {
    try {
      // Get user number from session storage (session-specific) or localStorage (fallback)
      let savedNumber = null;
      
      // Try session storage first (for session-specific numbers)
      const sessionKeys = Object.keys(sessionStorage).filter(key => key.startsWith('sybil-user-number-'));
      if (sessionKeys.length > 0) {
        savedNumber = sessionStorage.getItem(sessionKeys[0]);
      }
      
      // Fallback to localStorage
      if (!savedNumber) {
        savedNumber = localStorage.getItem('sybil-user-number');
      }
      
      // If still no number, generate one (for users who navigate directly to /call)
      if (!savedNumber || savedNumber.trim() === '') {
        console.log('No existing number found, generating new number for this call session');
        savedNumber = generateMyNumber();
      }
      
      setMyNumber(savedNumber);
      console.log('CallInterface: Using number:', `"${savedNumber}"`);

      // Initialize services
      webrtcRef.current = new WebRTCService();
      socketRef.current = new SocketService();
      
      // Connect to signaling server
      await socketRef.current.connect();
      
      // Join room with user number
      socketRef.current.joinRoom(savedNumber);

      if (toNumber) {
        // Outgoing call
        setFriendNumber(toNumber);
        setCallState('ringing');
        // Set up listeners for call responses (answer, decline, etc.)
        setupIncomingCallListeners();
        await initiateCall(toNumber, savedNumber); // Pass the savedNumber as callerNumber
      } else if (incomingFromNumber) {
        // Incoming call - from URL parameter (offer should already be stored by LandingPage)
        setFriendNumber(incomingFromNumber);
        setIncomingCallerNumber(incomingFromNumber);
        setIsIncomingCall(true);
        setCallState('incoming');
        // Set up listeners for call responses, but NOT user-calling since we're already in a call
        setupCallResponseListeners();
      } else {
        // Waiting for calls
        setCallState('waiting');
        setupIncomingCallListeners();
      }

    } catch (err) {
      setError(`Failed to initialize call: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCallState('disconnected');
    }
  };

  const initiateCall = async (targetNumber: string, callerNumber?: string) => {
    try {
      if (!webrtcRef.current || !socketRef.current) throw new Error('Services not initialized');
      
      // Use provided callerNumber or fallback to myNumber state
      const actualCallerNumber = callerNumber || myNumber;
      
      console.log(`🔄 Starting call to ${targetNumber} from ${actualCallerNumber}`);
      console.log('🔍 Debug - callerNumber param:', `"${callerNumber}"`);
      console.log('🔍 Debug - myNumber state:', `"${myNumber}"`);
      console.log('🔍 Debug - actualCallerNumber:', `"${actualCallerNumber}"`);
      
      // Validate caller number before proceeding
      if (!actualCallerNumber || actualCallerNumber.trim() === '') {
        console.error('❌ Caller number validation failed:');
        console.error('  - callerNumber param:', `"${callerNumber}"`);
        console.error('  - myNumber state:', `"${myNumber}"`);
        console.error('  - actualCallerNumber:', `"${actualCallerNumber}"`);
        throw new Error('Caller number is empty - cannot initiate call');
      }
      
      // Setup WebRTC event listeners first
      setupWebRTCListeners();
      
      // Set a timeout for the call connection
      callTimeoutRef.current = window.setTimeout(() => {
        console.log('⏰ Call connection timeout');
        setError('Connection timeout - please try again');
        setCallState('disconnected');
      }, 30000); // 30 second timeout
      
      // Get user media and create offer
      console.log('🎤 Getting user media...');
      await webrtcRef.current.getUserMedia();
      
      // Debug WebRTC state before creating offer
      webrtcRef.current.debugState();
      
      console.log('📝 Creating WebRTC offer...');
      const offer = await webrtcRef.current.createOffer();
      
      // Send call request with offer
      console.log('📡 Sending call-user event to server...');
      
      socketRef.current.emit('call-user', {
        targetCode: targetNumber,
        callerCode: actualCallerNumber,
        offer: offer
      });

      console.log(`✅ Call initiated to ${targetNumber} from ${actualCallerNumber} with offer`);
      
    } catch (err) {
      setError(`Failed to initiate call: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCallState('disconnected');
    }
  };

  const setupCallResponseListeners = () => {
    if (!socketRef.current) return;

    // Only set up response listeners, not the initial call listener
    socketRef.current.on('call-answered', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log('📞 Call was answered - processing answer...');
      console.log('📞 Current call state before processing answer:', callState);
      
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.setRemoteAnswer(answer);
          console.log('📞 Remote answer set successfully, updating UI to connected state');
          setCallState('connected');
          setError(''); // Clear any errors
          clearTimeout(callTimeoutRef.current!); // Clear connection timeout
          
          // Debug WebRTC state after setting answer
          webrtcRef.current.debugState();
        } catch (error) {
          console.error('📞 Error setting remote answer:', error);
          setError('Failed to establish connection');
        }
      }
    });

    socketRef.current.on('call-declined', () => {
      console.log('📞 Call was declined');
      setCallState('disconnected');
      setError('Call was declined');
      clearTimeout(callTimeoutRef.current!); // Clear connection timeout
    });

    socketRef.current.on('call-ended', ({ fromCode }: { fromCode: string }) => {
      console.log(`📞 Call ended by ${fromCode}`);
      setCallState('disconnected');
      setError('Call ended by other party');
      clearTimeout(callTimeoutRef.current!); // Clear connection timeout
    });

    setupWebRTCListeners();
  };

  const setupIncomingCallListeners = () => {
    if (!socketRef.current) return;

    socketRef.current.on('user-calling', ({ callerCode, offer }: { callerCode: string; offer?: RTCSessionDescriptionInit }) => {
      console.log(`📞 Incoming call from ${callerCode}`);
      setIncomingCallerNumber(callerCode);
      setIsIncomingCall(true);
      setCallState('incoming');
      
      // Store the offer for when we answer
      if (offer) {
        (window as any).incomingOffer = offer;
      }
    });

    socketRef.current.on('call-answered', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log('📞 Call was answered - processing answer...');
      console.log('📞 Current call state before processing answer:', callState);
      
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.setRemoteAnswer(answer);
          console.log('📞 Remote answer set successfully, updating UI to connected state');
          setCallState('connected');
          setError(''); // Clear any errors
          clearTimeout(callTimeoutRef.current!); // Clear connection timeout
          
          // Debug WebRTC state after setting answer
          webrtcRef.current.debugState();
        } catch (error) {
          console.error('📞 Error setting remote answer:', error);
          setError('Failed to establish connection');
        }
      }
    });

    socketRef.current.on('call-declined', () => {
      console.log('📞 Call was declined');
      setCallState('disconnected');
      setError('Call was declined');
      clearTimeout(callTimeoutRef.current!); // Clear connection timeout
    });

    socketRef.current.on('call-ended', ({ fromCode }: { fromCode: string }) => {
      console.log(`📞 Call ended by ${fromCode}`);
      setCallState('disconnected');
      setError('Call ended by other party');
      clearTimeout(callTimeoutRef.current!); // Clear connection timeout
    });

    setupWebRTCListeners();
  };

  const setupWebRTCListeners = () => {
    if (!webrtcRef.current) return;
    
    // Prevent setting up listeners multiple times
    if (webrtcListenersSetup) {
      console.log('🔗 WebRTC listeners already set up, skipping...');
      return;
    }
    
    console.log('🔗 Setting up WebRTC listeners...');
    setWebrtcListenersSetup(true);

    // Handle remote stream when it arrives
    webrtcRef.current.onRemoteStream((stream: MediaStream) => {
      console.log('🔊 Remote stream received:', stream.getTracks().length, 'tracks');
      stream.getTracks().forEach(track => {
        console.log(`🔊 Remote track received: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
      });
      
      // The WebRTC service handles audio element creation and playback internally
      // Just ensure audio context is ready for mobile
      webrtcRef.current?.ensureMobileAudioReady().catch(error => {
        console.warn('🔇 Failed to ensure mobile audio ready:', error);
      });
    });

    webrtcRef.current.onConnectionStateChange((state: string) => {
      console.log('🔗 WebRTC connection state changed to:', state);
      console.log('🔗 Current call state:', callState);
      
      if (state === 'connected') {
        // Only update to connected if we're not already connected
        // This prevents overriding the socket-driven state changes
        if (callState !== 'connected') {
          console.log('🔗 WebRTC connected - updating call state to connected');
          setCallState('connected');
        } else {
          console.log('🔗 WebRTC connected - call state already connected, no change needed');
        }
        setError(''); // Clear any previous errors
        // Clear connection timeout since we're now connected
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
      } else if (state === 'disconnected' || state === 'failed') {
        if (callState !== 'disconnected') { // Avoid duplicate disconnect handling
          console.log('🔗 WebRTC connection lost');
          setCallState('disconnected');
          setError('Connection lost');
        }
      } else if (state === 'connecting') {
        // Only set to connecting if we're not already connected or in the process of connecting
        if (callState !== 'connected' && callState !== 'connecting') {
          console.log('🔗 WebRTC connecting - updating call state');
          setCallState('connecting');
        } else {
          console.log('🔗 WebRTC connecting - but call state is', callState, '- not changing');
        }
      }
    });

    // Handle ICE candidates
    webrtcRef.current.onIceCandidate((candidate: RTCIceCandidate) => {
      if (socketRef.current && candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: candidate.toJSON(),
          targetUserId: friendNumber || incomingCallerNumber
        });
      }
    });

    // Listen for remote ICE candidates
    if (socketRef.current) {
      socketRef.current.on('ice-candidate', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (webrtcRef.current) {
          webrtcRef.current.addIceCandidate(candidate);
        }
      });
    }
  };

  const answerCall = async () => {
    try {
      if (!webrtcRef.current || !socketRef.current) throw new Error('Services not initialized');
      
      console.log('📞 Attempting to answer call...');
      
      // Debug current WebRTC state
      webrtcRef.current.debugState();
      
      // Get the stored offer
      const offer = (window as any).incomingOffer;
      console.log('🔍 Looking for stored offer:', offer ? 'Found' : 'Not found');
      
      if (!offer) {
        console.error('❌ No offer found in window.incomingOffer');
        throw new Error('No offer received - the call may have expired or been cancelled');
      }
      
      console.log('🎤 Getting user media...');
      // Get user media and create answer
      await webrtcRef.current.getUserMedia();
      
      console.log('📝 Creating answer for offer...');
      const answer = await webrtcRef.current.createAnswer(offer);
      
      console.log('📡 Sending answer to caller:', incomingCallerNumber);
      socketRef.current.emit('answer-call', {
        callerCode: incomingCallerNumber,
        answer
      });
      
      console.log('✅ Call answered successfully');
      setIsIncomingCall(false);
      setCallState('connected');
      setFriendNumber(incomingCallerNumber);
      
      // Ensure audio is ready for mobile after answering
      setTimeout(() => {
        if (webrtcRef.current) {
          webrtcRef.current.ensureMobileAudioReady();
        }
      }, 1000);
      
      // Clean up the stored offer
      delete (window as any).incomingOffer;
      
    } catch (err) {
      console.error('❌ Failed to answer call:', err);
      
      // Provide more specific error messages for SDP issues
      let errorMessage = 'Failed to answer call';
      if (err instanceof Error) {
        if (err.message.includes('m-lines')) {
          errorMessage = 'Call connection issue - please try calling again';
          // Also debug the WebRTC state for troubleshooting
          if (webrtcRef.current) {
            webrtcRef.current.debugState();
          }
        } else {
          errorMessage = `Failed to answer call: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      
      // Reset to waiting state so user can try again
      setIsIncomingCall(false);
      setCallState('waiting');
      
      // Clean up the stored offer on error
      delete (window as any).incomingOffer;
    }
  };

  const declineCall = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('decline-call', { callerCode: incomingCallerNumber });
    setIsIncomingCall(false);
    setCallState('waiting');
  };

  const endCall = () => {
    // Notify the other party that we're ending the call
    if (socketRef.current && (friendNumber || incomingCallerNumber)) {
      const targetCode = friendNumber || incomingCallerNumber;
      socketRef.current.emit('end-call', {
        targetCode: targetCode,
        callerCode: myNumber
      });
      console.log(`📞 Ending call with ${targetCode}`);
    }
    
    // Clear any timeouts
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Clean up and navigate home
    cleanup();
    navigate('/');
  };

  const toggleMute = () => {
    if (webrtcRef.current) {
      // Ensure audio context is ready on user interaction
      webrtcRef.current.ensureMobileAudioReady();
      webrtcRef.current.toggleMute();
      setIsMuted(!isMuted);
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up call interface...');
    
    // Clear any timeouts
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Clear call duration timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // Reset timer state
    setCallDuration(0);
    setCallStartTime(null);
    
    // Reset WebRTC listeners flag
    setWebrtcListenersSetup(false);
    
    // Clean up WebRTC
    if (webrtcRef.current) {
      webrtcRef.current.terminateCall();
      webrtcRef.current = null;
    }
    
    // Clean up socket connection and remove event listeners
    if (socketRef.current) {
      socketRef.current.off('user-calling');
      socketRef.current.off('call-answered');
      socketRef.current.off('call-declined');
      socketRef.current.off('call-ended');
      socketRef.current.off('ice-candidate');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Clear any stored offers
    if ((window as any).incomingOffer) {
      delete (window as any).incomingOffer;
    }
    
    console.log('✅ Cleanup completed');
  };

  const getStatusMessage = () => {
    switch (callState) {
      case 'connecting': return 'Connecting...';
      case 'ringing': return `Calling ${friendNumber}...`;
      case 'connected': return `Connected to ${friendNumber}`;
      case 'waiting': return `Waiting for calls (${myNumber})`;
      case 'incoming': return `Incoming call from ${incomingCallerNumber}`;
      case 'disconnected': return 'Call ended';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🔮 Sybil</h1>
          <p className="text-lg text-gray-600">{getStatusMessage()}</p>
        </div>

        {/* Call Interface Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          
          {/* Connection Status */}
          <div className="text-center mb-8">
            <ConnectionStatus connectionState={
              callState === 'connected' ? 'connected' : 
              callState === 'connecting' || callState === 'ringing' || callState === 'incoming' ? 'connecting' : 
              'disconnected'
            } />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6">
              <ErrorMessage message={error} />
            </div>
          )}

          {/* Incoming Call Interface */}
          {isIncomingCall && (
            <div className="text-center space-y-6">
              <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-2">📞 Incoming Call</h3>
                <p className="text-green-700">From: <span className="font-mono font-bold">{incomingCallerNumber}</span></p>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={declineCall}
                  variant="danger"
                  size="large"
                  fullWidth
                  className="flex items-center justify-center gap-2"
                >
                  ❌ Decline
                </Button>
                <Button
                  onClick={() => {
                    // Ensure audio is ready on user interaction
                    if (webrtcRef.current) {
                      webrtcRef.current.ensureMobileAudioReady();
                    }
                    answerCall();
                  }}
                  variant="success"
                  size="large"
                  fullWidth
                  className="flex items-center justify-center gap-2"
                >
                  ✅ Answer
                </Button>
              </div>
            </div>
          )}

          {/* Active Call Controls */}
          {callState === 'connected' && (
            <div className="text-center space-y-6">
              <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-2">🔊 Active Call</h3>
                <p className="text-green-700 mb-3">Connected to: <span className="font-mono font-bold">{friendNumber}</span></p>
                <div className="text-2xl font-mono font-bold text-green-800 bg-green-100 py-2 px-4 rounded-lg inline-block mb-2">
                  ⏱️ {formatCallDuration(callDuration)}
                </div>
                <p className="text-sm text-green-600">Call duration</p>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={toggleMute}
                  variant={isMuted ? "danger" : "secondary"}
                  size="large"
                  fullWidth
                  className="flex items-center justify-center gap-2"
                >
                  {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                </Button>
                <Button
                  onClick={endCall}
                  variant="danger"
                  size="large"
                  fullWidth
                  className="flex items-center justify-center gap-2"
                >
                  📞 End Call
                </Button>
              </div>
            </div>
          )}

          {/* Waiting/Ringing Interface */}
          {(callState === 'waiting' || callState === 'ringing') && (
            <div className="text-center space-y-6">
              <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                {callState === 'waiting' ? (
                  <>
                    <h3 className="text-xl font-semibold text-blue-800 mb-2">⏳ Waiting for Calls</h3>
                    <p className="text-blue-700">Your number: <span className="font-mono font-bold">{myNumber}</span></p>
                    <p className="text-sm text-blue-600 mt-2">Share this number with friends so they can call you</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold text-blue-800 mb-2">📞 Calling...</h3>
                    <p className="text-blue-700">Calling: <span className="font-mono font-bold">{friendNumber}</span></p>
                    <p className="text-sm text-blue-600 mt-2">Waiting for them to answer...</p>
                  </>
                )}
              </div>
              <Button
                onClick={endCall}
                variant="secondary"
                size="large"
                fullWidth
                className="flex items-center justify-center gap-2"
              >
                ← Back to Home
              </Button>
            </div>
          )}

          {/* Disconnected Interface */}
          {callState === 'disconnected' && (
            <div className="text-center space-y-6">
              <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">📵 Call Ended</h3>
                <p className="text-gray-700">The call has been disconnected</p>
              </div>
              <Button
                onClick={() => navigate('/')}
                variant="primary"
                size="large"
                fullWidth
                className="flex items-center justify-center gap-2"
              >
                🏠 Return Home
              </Button>
            </div>
          )}
        </div>

        {/* Audio Elements - Only local audio needed, remote audio handled by WebRTC service */}
        <audio ref={localAudioRef} muted />
      </div>
    </div>
  );
};

export default CallInterface;
