/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { SocketService } from '../services/socket';
import { WebRTCService } from '../services/webrtc';
import CallInterface, { CallState as CallInterfaceState } from './CallInterface';
import { TranscriptionResult } from '../services/types';
import Header from './shared/Header.tsx';
import CallInput from './shared/CallInput.tsx';
import MyNumber from './shared/MyNumber.tsx';
import StatusIndicator from './shared/StatusIndicator.tsx';
import Instructions from './shared/Instructions.tsx';
import Footer from './shared/Footer.tsx';
import { Room, createLocalAudioTrack } from 'livekit-client';

type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected';

// Deterministic room name for 1:1 calls
function getRoomName(numberA: string, numberB: string): string {
  const [first, second] = [numberA.trim(), numberB.trim()].sort();
  return `room-${first}-${second}`;
}

const LandingPage: React.FC = () => {
  const [friendNumber, setFriendNumber] = useState('');
  const [myNumber, setMyNumber] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCallPartner, setCurrentCallPartner] = useState('');
  const [error, setError] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // Enhanced connection stability monitoring
  const [connectionStats, setConnectionStats] = useState({
    connectionsAttempted: 0,
    connectionsSucceeded: 0,
    averageConnectionDuration: 0,
    lastDisconnectReason: '',
    networkQuality: 'unknown' as 'excellent' | 'good' | 'poor' | 'unknown'
  });
  const connectionStartTimeRef = useRef<number | null>(null);
  const connectionStatsRef = useRef(connectionStats);
  
  const socketRef = useRef<SocketService | null>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const currentCallPartnerRef = useRef<string>('');
  const ringIntervalRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const callDurationIntervalRef = useRef<number | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [showTranscription, setShowTranscription] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const [isTranscriptionLoading, setIsTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string>('');

  const [livekitCallState, setLivekitCallState] = useState<'idle' | 'outgoing' | 'incoming' | 'connected'>('idle');
  const [livekitCallPartner, setLivekitCallPartner] = useState('');
  const liveKitRoomRef = useRef<Room | null>(null);

  // Handle phone number input with filtering
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Allow only digits, spaces, dashes, parentheses, and + at the beginning
    value = value.replace(/[^\d\s\-\(\)\+]/g, '');
    
    // Ensure + can only be at the beginning
    if (value.includes('+')) {
      const plusIndex = value.indexOf('+');
      if (plusIndex > 0) {
        // Remove + if it's not at the beginning
        value = value.replace(/\+/g, '');
      } else {
        // Keep only the first + and remove any others
        value = '+' + value.substring(1).replace(/\+/g, '');
      }
    }
    
    setFriendNumber(value);
  };

  // Handle Enter key press to submit call
  const handlePhoneNumberKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Check if number is valid before calling
    if (e.key === 'Enter' && validatePhoneNumber(friendNumber).isValid) {
      handleCallFriend();
    }
  };

  // Normalize and format Singapore phone numbers for consistent storage and display
  const normalizePhoneNumber = (phoneNumber: string): string => {
    // Remove all spaces, dashes, parentheses, and other formatting characters
    const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    
    // Handle 8-digit Singapore mobile numbers (without country code)
    // Singapore mobile numbers start with 8 or 9 and have 8 digits total
    if (digitsOnly.length === 8 && (digitsOnly.startsWith('8') || digitsOnly.startsWith('9'))) {
      return `+65 ${digitsOnly.substring(0, 4)} ${digitsOnly.substring(4)}`;
    }
    
    // Handle 10-digit numbers with 65 prefix (Singapore numbers with country code but no +)
    if (digitsOnly.length === 10 && digitsOnly.startsWith('65')) {
      const phoneNumber = digitsOnly.substring(2); // Remove 65 prefix
      if (phoneNumber.length === 8 && (phoneNumber.startsWith('8') || phoneNumber.startsWith('9'))) {
        return `+65 ${phoneNumber.substring(0, 4)} ${phoneNumber.substring(4)}`;
      }
    }
    
    // Handle numbers that already have + prefix
    if (phoneNumber.trim().startsWith('+')) {
      const countryAndNumber = digitsOnly; // digitsOnly already removed the +
      
      // Singapore (+65): Format as +65 XXXX XXXX
      if (countryAndNumber.startsWith('65') && countryAndNumber.length === 10) {
        const phoneNumber = countryAndNumber.substring(2); // Remove 65
        if (phoneNumber.length === 8 && (phoneNumber.startsWith('8') || phoneNumber.startsWith('9'))) {
          return `+65 ${phoneNumber.substring(0, 4)} ${phoneNumber.substring(4)}`;
        }
      }
    }
    
    // If we can't parse it as a valid Singapore number, return the cleaned digits
    // This allows for error handling in the validation function
    return digitsOnly;
  };

  // Generate a unique international phone number for this user session
  const generateMyNumber = () => {
    // Generate a unique session ID for this tab/window
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if we have a session-specific number
    const sessionKey = `mulisa-user-number-${sessionId}`;
    const globalKey = 'mulisa-user-number';
    
    // First, try to get existing number for this session
    let existingNumber = sessionStorage.getItem(sessionKey);
    
    // If no session-specific number, check if we have a global one and this is the first tab
    if (!existingNumber) {
      const globalNumber = localStorage.getItem(globalKey);
      const activeSessionsKey = 'mulisa-active-sessions';
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
    
    // Generate a new unique Singapore number for this session
    // Singapore mobile numbers start with 8 or 9 and have 8 digits total
    const firstDigit = Math.random() > 0.5 ? '8' : '9';
    const remainingDigits = Array.from({length: 7}, () => Math.floor(Math.random() * 10)).join('');
    const number = firstDigit + remainingDigits;
    
    // Format as +65 XXXX XXXX (Singapore format)
    const formattedNumber = `+65 ${number.substring(0, 4)} ${number.substring(4)}`;
    
    // Store in session storage for this tab
    sessionStorage.setItem(sessionKey, formattedNumber);
    
    // Also store as global backup
    if (!localStorage.getItem(globalKey)) {
      localStorage.setItem(globalKey, formattedNumber);
    }
    
    // Track this session
    const activeSessionsKey = 'mulisa-active-sessions';
    const activeSessions = JSON.parse(localStorage.getItem(activeSessionsKey) || '[]');
    activeSessions.push({ sessionId, number: formattedNumber });
    localStorage.setItem(activeSessionsKey, JSON.stringify(activeSessions));
    
    return formattedNumber;
  };

  // Initialize user's number and socket connection on load
  useEffect(() => {
    const initializeConnection = async () => {
      // Generate or get session-specific number
      const userNumber = generateMyNumber();
      setMyNumber(userNumber);
      
      console.log(`🆔 Session number: ${userNumber}`);

      // Initialize socket connection to be always available for calls
      try {
        console.log(`🌐 Initializing socket connection...`);
        console.log(`📱 Device info: ${navigator.userAgent}`);
        console.log(`🔗 Connecting to server...`);
        
        socketRef.current = new SocketService();
        await socketRef.current.connect();
        
        console.log(`✅ Socket connected successfully`);
        
        // Register this number as available for calls
        console.log(`📝 Registering user number: ${userNumber}`);
        socketRef.current.joinRoom(userNumber);
        setIsConnected(true);
        
        console.log(`✅ User ${userNumber} registered and ready for calls`);
        
        // Listen for incoming calls
        socketRef.current.on('user-calling', ({ callerCode, offer }: { callerCode: string; offer?: RTCSessionDescriptionInit }) => {
          console.log(`\n📞 === INCOMING CALL DEBUG ===`);
          console.log(`📱 Incoming call FROM: "${callerCode}"`);
          console.log(`📱 Incoming call TO: "${userNumber}"`);
          console.log(`📋 Offer provided: ${offer ? 'YES' : 'NO'}`);
          console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
          console.log(`📱 User agent: ${navigator.userAgent}`);
          
          if (offer) {
            console.log(`📋 Offer type: ${offer.type}`);
            console.log(`📋 Offer SDP length: ${offer.sdp ? offer.sdp.length : 0} characters`);
          }
          
          // Add a small delay to ensure the call is properly established
          setTimeout(() => {
            console.log(`⏰ Setting up incoming call state...`);
            updateCurrentCallPartner(callerCode);
            setError(''); // Clear any previous errors when a new call comes in
            setCallState('incoming');
            setIsRinging(true);
            
            // Store the offer for when we answer (if provided)
            if (offer) {
              (window as any).incomingOffer = offer;
              console.log('💾 Stored incoming offer for later use');
            } else {
              console.log('⚠️  No offer provided with incoming call');
            }
            
            // Start ringing sound effect (vibration on mobile)
            startRingingEffect();
            console.log(`✅ Incoming call setup completed for ${callerCode}`);
            console.log(`📞 === END INCOMING CALL DEBUG ===\n`);
          }, 500); // 500ms delay to ensure proper setup
        });
        
        console.log(`📱 Number ${userNumber} is now available for calls`);
        
      } catch (error) {
        console.error('Failed to connect for incoming calls:', error);
        setIsConnected(false);
      }
    };

    initializeConnection();

    // Cleanup on unmount - remove this session from active sessions
    return () => {
      stopRingingEffect();
      stopCallDurationTimer();
      cleanup(); // Clean up WebRTC and call state
      
      if (socketRef.current) {
        socketRef.current.off('user-calling');
        socketRef.current.off('call-answered');
        socketRef.current.off('call-declined');
        socketRef.current.off('call-ended');
        socketRef.current.off('ice-candidate');
        socketRef.current.disconnect();
      }
      
      // Clean up session tracking
      try {
        const activeSessionsKey = 'mulisa-active-sessions';
        const activeSessions = JSON.parse(localStorage.getItem(activeSessionsKey) || '[]');
        const updatedSessions = activeSessions.filter((session: any) => session.number !== myNumber);
        localStorage.setItem(activeSessionsKey, JSON.stringify(updatedSessions));
      } catch (error) {
        console.error('Error cleaning up session:', error);
      }
    };
  }, []);

  useEffect(() => {
    if (!socketRef.current) return;

    const handleSocketDisconnect = () => {
      console.log('🔌 Socket disconnected, cleaning up call state');
      cleanup();
      setCallState('idle');
      setError('Connection lost. Please try again.');
      updateCurrentCallPartner('');
    };

    socketRef.current.on('disconnect', handleSocketDisconnect);

    // Clean up listener on unmount
    return () => {
      socketRef.current?.off('disconnect', handleSocketDisconnect);
    };
  }, []);

  // Auto-cleanup when call returns to idle after being connected
  useEffect(() => {
    // This effect ensures proper cleanup when transitioning from connected to idle
    if (callState === 'idle' && currentCallPartner) {
      stopCallDurationTimer(); // Stop timer when call ends
      updateCurrentCallPartner('');
      setError('');
    }
  }, [callState, currentCallPartner]);

  // Update connection stats state when ref changes
  useEffect(() => {
    setConnectionStats(connectionStatsRef.current);
  }, [connectionStatsRef.current]);

  // LiveKit call signaling handlers
  useEffect(() => {
    if (!socketRef.current) return;
    // Incoming LiveKit call
    const onUserCallingLivekit = ({ callerCode }: { callerCode: string }) => {
      setLivekitCallPartner(callerCode);
      setLivekitCallState('incoming');
    };
    // Call accepted by callee
    const onCallAcceptedLivekit = ({ calleeCode }: { calleeCode: string }) => {
      joinLiveKitRoom(calleeCode);
      setLivekitCallState('connected');
    };
    // Call declined by callee
    const onCallDeclinedLivekit = () => {
      setLivekitCallState('idle');
      setLivekitCallPartner('');
      setError('Call was declined');
    };
    (socketRef.current as any).on('user-calling-livekit', onUserCallingLivekit);
    (socketRef.current as any).on('call-accepted-livekit', onCallAcceptedLivekit);
    (socketRef.current as any).on('call-declined-livekit', onCallDeclinedLivekit);
    return () => {
      (socketRef.current as any)?.off('user-calling-livekit', onUserCallingLivekit);
      (socketRef.current as any)?.off('call-accepted-livekit', onCallAcceptedLivekit);
      (socketRef.current as any)?.off('call-declined-livekit', onCallDeclinedLivekit);
    };
  }, [socketRef.current]);

  const startRingingEffect = () => {
    // Try to vibrate on mobile devices
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
    
    // Visual ringing effect with interval
    ringIntervalRef.current = window.setInterval(() => {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }, 2000);
  };

  const stopRingingEffect = () => {
    setIsRinging(false);
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0); // Stop vibration
    }
  };

  // Start call duration timer
  const startCallDurationTimer = () => {
    console.log('⏱️ Starting call duration timer');
    setCallDuration(0);
    callDurationIntervalRef.current = window.setInterval(() => {
      setCallDuration(prev => {
        const newDuration = prev + 1;
        // console.log('⏱️ Timer tick:', newDuration); // Commented out to reduce log noise
        return newDuration;
      });
    }, 1000);
  };

  // Stop call duration timer
  const stopCallDurationTimer = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    setCallDuration(0);
  };

  // Initialize WebRTC and socket listeners for call handling
  const initializeCallServices = async () => {
    try {
      // Initialize WebRTC service
      webrtcRef.current = new WebRTCService();
      
      // Set up WebRTC listeners
      setupWebRTCListeners();
      
      // Set up additional socket listeners for call responses
      setupCallResponseListeners();
      
    } catch (error) {
      console.error('Failed to initialize call services:', error);
      setError('Failed to initialize call services');
    }
  };

  const setupWebRTCListeners = () => {
    if (!webrtcRef.current) return;

    webrtcRef.current.onConnectionStateChange((state: string) => {
      console.log('🔗 WebRTC connection state:', state);
      
      if (state === 'connected') {
        // Track connection start time for stability monitoring
        connectionStartTimeRef.current = Date.now();
        connectionStatsRef.current.connectionsSucceeded++;
        
        setCallState('connected');
        setError(''); // Clear any previous errors
        startCallDurationTimer(); // Start timing the call
        
        // Clear connection timeout since we're now connected
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        
        // Log connection success details
        console.log('✅ WebRTC Connection Established Successfully');
        console.log(`📊 Connection attempt #${connectionStatsRef.current.connectionsSucceeded}`);
        
        // Check connection quality after a brief delay
        setTimeout(() => {
          if (webrtcRef.current) {
            webrtcRef.current.getConnectionStats().then(stats => {
              console.log('📈 Connection quality stats:', stats);
            }).catch(err => console.warn('Failed to get connection stats:', err));
          }
        }, 2000);
        
      } else if (state === 'disconnected' || state === 'failed') {
        // Calculate connection duration for stability analysis
        let connectionDuration = 0;
        if (connectionStartTimeRef.current) {
          connectionDuration = Date.now() - connectionStartTimeRef.current;
          console.log(`⏱️ Connection lasted: ${connectionDuration}ms`);
          
          // Update average connection duration
          const currentAvg = connectionStatsRef.current.averageConnectionDuration;
          const newAvg = currentAvg === 0 ? connectionDuration : (currentAvg + connectionDuration) / 2;
          connectionStatsRef.current.averageConnectionDuration = newAvg;
          
          // Classify connection quality based on duration
          if (connectionDuration < 5000) { // Less than 5 seconds
            connectionStatsRef.current.networkQuality = 'poor';
            connectionStatsRef.current.lastDisconnectReason = 'Very short connection - likely network issues';
          } else if (connectionDuration < 30000) { // Less than 30 seconds
            connectionStatsRef.current.networkQuality = 'good';
            connectionStatsRef.current.lastDisconnectReason = 'Short connection - possible network instability';
          } else {
            connectionStatsRef.current.networkQuality = 'excellent';
            connectionStatsRef.current.lastDisconnectReason = 'Normal disconnection';
          }
          
          console.log(`📊 Network Quality Assessment: ${connectionStatsRef.current.networkQuality}`);
          console.log(`📊 Disconnect Reason: ${connectionStatsRef.current.lastDisconnectReason}`);
        }
        
        if (callState !== 'idle') { // Avoid duplicate disconnect handling
          console.log('🔗 WebRTC connection lost');
          
          // Provide specific error messages based on connection duration
          if (connectionDuration > 0 && connectionDuration < 5000) {
            setError('⚠️ Quick disconnect detected - network stability issues. Try moving closer to WiFi or check mobile signal.');
          } else if (state === 'failed') {
            setError('❌ Connection failed - network incompatibility detected. This may require TURN servers for your network setup.');
          } else {
            setError('Connection lost');
          }
          
          setCallState('idle');
          // Notify the other participant that the call has ended due to failure
          if (socketRef.current && currentCallPartner) {
            socketRef.current.emit('end-call', {
              targetCode: currentCallPartner,
              callerCode: myNumber
            });
          }
        }
        stopCallDurationTimer(); // Stop timing when disconnected
      } else if (state === 'connecting') {
        connectionStatsRef.current.connectionsAttempted++;
        console.log(`🔄 Connection attempt #${connectionStatsRef.current.connectionsAttempted}`);
      }
    });

    // Handle ICE candidates
    webrtcRef.current.onIceCandidate((candidate: RTCIceCandidate) => {
      if (socketRef.current && candidate) {
        // Use ref to avoid React state closure issues
        const targetPartner = currentCallPartnerRef.current;
        
        console.log('🧊 Sending ICE candidate to:', targetPartner);
        
        if (!targetPartner) {
          console.warn('⚠️ Cannot send ICE candidate - no current call partner set');
          console.warn('This may indicate a timing issue in call setup');
          return;
        }
        
        socketRef.current.emit('ice-candidate', {
          candidate: candidate.toJSON(),
          targetUserId: targetPartner
        });
      }
    });
  };

  const setupCallResponseListeners = () => {
    if (!socketRef.current) return;

    socketRef.current.on('call-answered', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log('📞 Call was answered');
      if (webrtcRef.current) {
        await webrtcRef.current.setRemoteAnswer(answer);
        setCallState('connected');
        startCallDurationTimer(); // Start the timer when call is answered
        clearTimeout(callTimeoutRef.current!); // Clear connection timeout
      }
    });

    socketRef.current.on('call-declined', () => {
      console.log('📞 Call was declined');
      
      // Stop transcription if it's running
      if (webrtcRef.current) {
        console.log('🎤 Stopping transcription due to call declined');
        webrtcRef.current.stopTranscriptionPublic();
      }
      
      setCallState('idle');
      setError('Call was declined');
      clearTimeout(callTimeoutRef.current!); // Clear connection timeout
    });

    socketRef.current.on('call-ended', ({ fromCode }: { fromCode: string }) => {
      console.log(`📞 Call ended by ${fromCode}`);
      
      // Stop transcription if it's running
      if (webrtcRef.current) {
        console.log('🎤 Stopping transcription due to call ended by other party');
        webrtcRef.current.stopTranscriptionPublic();
      }
      
      setCallState('idle');
      setError('Call ended by other party');
      clearTimeout(callTimeoutRef.current!); // Clear connection timeout
    });

    // Listen for remote ICE candidates
    socketRef.current.on('ice-candidate', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      console.log('🧊 Received ICE candidate from remote peer');
      if (webrtcRef.current) {
        webrtcRef.current.addIceCandidate(candidate);
      }
    });
  };

  const handleAnswerCall = async () => {
    try {
      stopRingingEffect();
      
      if (!webrtcRef.current) {
        await initializeCallServices();
      }
      
      if (!webrtcRef.current || !socketRef.current) throw new Error('Services not initialized');
      
      console.log('📞 Attempting to answer call...');
      
      // Get the stored offer
      const offer = (window as any).incomingOffer;
      console.log('🔍 Looking for stored offer:', offer ? 'Found' : 'Not found');
      
      if (!offer) {
        console.error('❌ No offer found in window.incomingOffer');
        cleanup();
        throw new Error('No offer received - the call may have expired or been cancelled');
      }
      
      // Prepare iOS Safari for optimal audio handling
      await webrtcRef.current.prepareForIOSCall();
      
      console.log('🎤 Getting user media...');
      // Get user media and create answer
      await webrtcRef.current.getUserMedia();
      
      console.log('📝 Creating answer for offer...');
      const answer = await webrtcRef.current.createAnswer(offer);
      
      console.log('📡 Sending answer to caller:', currentCallPartner);
      socketRef.current.emit('answer-call', {
        callerCode: currentCallPartner,
        answer
      });
      
      console.log('✅ Call answered successfully');
      setCallState('connected');
      
      // Clean up the stored offer
      if ((window as any).incomingOffer) {
        delete (window as any).incomingOffer;
      }
      
      // Start the call duration timer
      startCallDurationTimer();
      
    } catch (err) {
      console.error('❌ Failed to answer call:', err);
      cleanup();
      setError(`Failed to answer call: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCallState('idle');
      if ((window as any).incomingOffer) {
        delete (window as any).incomingOffer;
      }
    }
  };

  const handleDeclineCall = () => {
    stopRingingEffect();
    if (currentCallPartner && socketRef.current) {
      socketRef.current.emit('decline-call', { callerCode: currentCallPartner });
    }
    setCallState('idle');
    updateCurrentCallPartner('');
    // Clean up stored offer
    if ((window as any).incomingOffer) {
      delete (window as any).incomingOffer;
    }
  };

  const handleCallFriend = async () => {
    if (!friendNumber.trim()) return;
    if (callState !== 'idle') {
      setError('Cannot start a new call while another call is in progress.');
      return;
    }
    
    try {
      // Normalize the phone number before calling
      const normalizedNumber = normalizePhoneNumber(friendNumber.trim());
      console.log(`📞 Phone Number Normalization:`);
      console.log(`   Original input: "${friendNumber.trim()}"`);
      console.log(`   Normalized to: "${normalizedNumber}"`);
      
      updateCurrentCallPartner(normalizedNumber);
      setCallState('outgoing');
      setError('');
      
      if (!webrtcRef.current) {
        await initializeCallServices();
      }
      
      await initiateCall(normalizedNumber);
      
    } catch (err) {
      console.error('Failed to initiate call:', err);
      cleanup();
      setError(`Failed to start call: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCallState('idle');
      if ((window as any).incomingOffer) {
        delete (window as any).incomingOffer;
      }
    }
  };

  const handleCallViaLiveKit = async () => {
    if (!friendNumber.trim()) return;
    if (callState !== 'idle' || livekitCallState !== 'idle') {
      setError('Cannot start a new call while another call is in progress.');
      return;
    }
    // Signal B via Socket.IO
    socketRef.current?.emit('call-user-livekit', {
      targetCode: friendNumber,
      callerCode: myNumber,
    });
    setLivekitCallPartner(friendNumber);
    setLivekitCallState('outgoing');
  };

  const handleAcceptLiveKitCall = async () => {
    socketRef.current?.emit('accept-call-livekit', { callerCode: livekitCallPartner, calleeCode: myNumber });
    await joinLiveKitRoom(livekitCallPartner);
    setLivekitCallState('connected');
  };

  const handleDeclineLiveKitCall = () => {
    socketRef.current?.emit('decline-call-livekit', { callerCode: livekitCallPartner, calleeCode: myNumber });
    setLivekitCallState('idle');
    setLivekitCallPartner('');
  };

  const handleEndLiveKitCall = () => {
    liveKitRoomRef.current?.disconnect();
    socketRef.current?.emit('end-call-livekit', {
      targetCode: livekitCallPartner,
      fromCode: myNumber,
    });
    setLivekitCallState('idle');
    setLivekitCallPartner('');
  };

  useEffect(() => {
    if (!socketRef.current) return;
    const onCallEndedLivekit = () => {
      liveKitRoomRef.current?.disconnect();
      setLivekitCallState('idle');
      setLivekitCallPartner('');
      setError('Call ended by other party');
    };
    (socketRef.current as any).on('call-ended-livekit', onCallEndedLivekit);
    return () => {
      (socketRef.current as any)?.off('call-ended-livekit', onCallEndedLivekit);
    };
  }, [socketRef.current]);

  const joinLiveKitRoom = async (otherNumber: string) => {
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
    const tokenApiUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL;
    const roomName = getRoomName(myNumber, otherNumber);
    const identity = myNumber;
    const response = await fetch(`${tokenApiUrl}?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`);
    const { token } = await response.json();
    const room = new Room();
    await room.connect(livekitUrl, token);
    const audioTrack = await createLocalAudioTrack();
    await room.localParticipant.publishTrack(audioTrack);
    liveKitRoomRef.current = room;
    // Handle remote audio tracks
    let remoteAudioEl: HTMLAudioElement | null = null;
    room.on('trackSubscribed', (track) => {
      if (track.kind === 'audio') {
        // Detach previous audio if any
        if (remoteAudioEl) {
          try { remoteAudioEl.srcObject = null; } catch {}
          remoteAudioEl.remove();
        }
        const audioElement = track.attach();
        audioElement.autoplay = true;
        audioElement.play();
        remoteAudioEl = audioElement;
        document.body.appendChild(audioElement); // For quick testing; you can manage this in the UI if desired
      }
    });
    // Clean up remote audio on disconnect
    room.on('disconnected', () => {
      if (remoteAudioEl) {
        try { remoteAudioEl.srcObject = null; } catch {}
        remoteAudioEl.remove();
        remoteAudioEl = null;
      }
    });
    // Optionally: handle remote tracks, update UI, etc.
  };

  const initiateCall = async (targetNumber: string) => {
    try {
      if (!webrtcRef.current || !socketRef.current) throw new Error('Services not initialized');
      
      console.log(`🔄 Starting call to ${targetNumber} from ${myNumber}`);
      
      // Prepare iOS Safari for optimal audio handling
      await webrtcRef.current.prepareForIOSCall();
      
      // Set a timeout for the call connection
      callTimeoutRef.current = window.setTimeout(() => {
        console.log('⏰ Call connection timeout after 30 seconds');
        console.log('🔍 Attempting connection recovery...');
        
        // Try ICE restart first
        if (webrtcRef.current) {
          webrtcRef.current.restartIce().catch(() => {
            console.log('❌ ICE restart failed, ending call');
            cleanup();
            setError('Connection timeout - network issues detected');
            setCallState('idle');
          });
        } else {
          cleanup();
          setError('Connection timeout - please try again');
          setCallState('idle');
        }
        if ((window as any).incomingOffer) {
          delete (window as any).incomingOffer;
        }
      }, 30000); // 30 second timeout
      
      // Get user media and create offer
      console.log('🎤 Getting user media...');
      await webrtcRef.current.getUserMedia();
      
      console.log('📝 Creating WebRTC offer...');
      const offer = await webrtcRef.current.createOffer();
      
      // Send call request with offer
      console.log('📡 Sending call-user event to server...');
      
      socketRef.current.emit('call-user', {
        targetCode: targetNumber,
        callerCode: myNumber,
        offer: offer
      });

      console.log(`✅ Call initiated to ${targetNumber} from ${myNumber} with offer`);
      
    } catch (err) {
      cleanup();
      setError(`Failed to initiate call: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCallState('idle');
      if ((window as any).incomingOffer) {
        delete (window as any).incomingOffer;
      }
    }
  };

  const endCall = () => {
    // Notify the other party that we're ending the call
    if (socketRef.current && currentCallPartner) {
      socketRef.current.emit('end-call', {
        targetCode: currentCallPartner,
        callerCode: myNumber
      });
      console.log(`📞 Ending call with ${currentCallPartner}`);
    }
    
    // Clear any timeouts and timers
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    stopCallDurationTimer();
    
    // Clean up call state
    cleanup();
    setCallState('idle');
    updateCurrentCallPartner('');
    setError('');
  };

  const toggleMute = () => {
    if (webrtcRef.current) {
      webrtcRef.current.toggleMute();
      setIsMuted(!isMuted);
    }
  };

  const toggleTranscription = async () => {
    if (!showTranscription) {
      // Starting transcription
      if (!webrtcRef.current || !socketRef.current) {
        console.error('WebRTC or Socket service not available');
        setTranscriptionError('WebRTC or Socket service not available');
        return;
      }

      // Check if we're in a call
      if (callState !== 'connected') {
        setTranscriptionError('Transcription is only available during active calls');
        return;
      }

      setIsTranscriptionLoading(true);
      setTranscriptionError('');

      try {
        // Generate a unique conversation ID
        const conversationId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Enable transcription with the socket service
        await webrtcRef.current.enableTranscription(conversationId, myNumber, socketRef.current);
        
        // Set up transcription callback
        webrtcRef.current.onTranscription((result) => {
          setTranscripts(prev => [...prev, result]);
        });

        // Set up error callback
        webrtcRef.current.onTranscriptionError?.((error) => {
          setTranscriptionError(error);
        });

        // Start transcription with the local stream
        const localStream = webrtcRef.current.getLocalStream();
        if (localStream && localStream.active) {
          await webrtcRef.current.startTranscriptionPublic(localStream);
          console.log('🎤 Transcription started successfully');
        } else {
          throw new Error('No active local stream available for transcription');
        }
      } catch (error) {
        console.error('Failed to start transcription:', error);
        setTranscriptionError(`Failed to start transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsTranscriptionLoading(false);
      }
    } else {
      // Stopping transcription
      setIsTranscriptionLoading(true);
      
      try {
        if (webrtcRef.current) {
          webrtcRef.current.stopTranscriptionPublic();
          setTranscriptionError('');
          console.log('🎤 Transcription stopped');
        }
      } catch (error) {
        console.error('Failed to stop transcription:', error);
        setTranscriptionError('Failed to stop transcription');
      } finally {
        setIsTranscriptionLoading(false);
      }
    }

    setShowTranscription(!showTranscription);
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up call services...');
    
    // Clear all timers and timeouts
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    
    // Clean up WebRTC resources
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
      webrtcRef.current = null;
    }
    
    // DON'T remove socket listeners here - they're needed for future calls
    // Socket cleanup should only happen on page unload/component unmount
    
    // Clean up any stored offers
    if ((window as any).incomingOffer) {
      delete (window as any).incomingOffer;
    }
    
    // Reset call-related state
    setCallDuration(0);
    setIsMuted(false);
    setIsRinging(false);
    
    // Extra: reset error and call partner
    setError('');
    updateCurrentCallPartner('');
    
    console.log('✅ Call cleanup completed');
  };

  // Error recovery function - allows recovery without page reload
  const recoverFromError = async () => {
    console.log('🔄 Recovering from error...');
    
    // Clean up everything
    cleanup();
    
    // Reset state
    setCallState('idle');
    updateCurrentCallPartner('');
    setError('');
    
    // Reinitialize services if needed
    try {
      if (!socketRef.current) {
        await initializeCallServices();
      }
      console.log('✅ Recovery completed');
    } catch (err) {
      console.error('❌ Recovery failed:', err);
      setError('Recovery failed - please refresh the page');
    }
  };

  const copyMyNumber = async () => {
    try {
      await navigator.clipboard.writeText(myNumber);
      alert('Number copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = myNumber;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Number copied to clipboard!');
    }
  };

  // Simple phone number validation - just check if we have enough digits
  const validatePhoneNumber = (phoneNumber: string): { isValid: boolean, message: string } => {
    if (!phoneNumber.trim()) {
      return { isValid: false, message: '' };
    }

    const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    const normalized = normalizePhoneNumber(phoneNumber.trim());
    
    // Just check if we have a reasonable number of digits (8-10)
    if (digitsOnly.length >= 8 && digitsOnly.length <= 10) {
      return { 
        isValid: true, 
        message: `Will call: ${normalized}` 
      };
    } else if (digitsOnly.length < 8) {
      return { 
        isValid: false, 
        message: 'Too short - need at least 8 digits' 
      };
    } else {
      return { 
        isValid: false, 
        message: 'Too long - max 10 digits' 
      };
    }
  };

  // Helper function to update current call partner (both state and ref)
  const updateCurrentCallPartner = (partner: string) => {
    setCurrentCallPartner(partner);
    currentCallPartnerRef.current = partner;
    console.log('📱 Updated current call partner to:', partner || '(empty)');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md mx-auto">
        <Header />
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <CallInput
            friendNumber={friendNumber}
            onChange={handlePhoneNumberChange}
            onKeyPress={handlePhoneNumberKeyPress}
            onCall={handleCallFriend}
            onCallLiveKit={handleCallViaLiveKit}
          />
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-400"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500"></span>
            </div>
          </div>
          <MyNumber
            myNumber={myNumber}
            onCopy={copyMyNumber}
          />
          <StatusIndicator isConnected={isConnected} />
          <div className="mt-6">
            <Instructions />
          </div>
        </div>
        <Footer />
        {/* Call Interface Overlay - shows different content based on call state */}
        {callState !== 'idle' && (
          <CallInterface
            callState={callState as CallInterfaceState}
            error={error}
            isMuted={isMuted}
            callDuration={callDuration}
            currentCallPartner={currentCallPartner}
            isRinging={isRinging}
            onMute={toggleMute}
            onEndCall={endCall}
            onAnswer={handleAnswerCall}
            onDecline={handleDeclineCall}
            onRetry={recoverFromError}
                showTranscription={showTranscription}
                onToggleTranscription={toggleTranscription}
                transcripts={transcripts}
                isTranscriptionLoading={isTranscriptionLoading}
                transcriptionError={transcriptionError}
          />
        )}
        {livekitCallState !== 'idle' && (
          <CallInterface
            callState={livekitCallState as CallInterfaceState}
            error={error}
            isMuted={isMuted}
            callDuration={callDuration}
            currentCallPartner={livekitCallPartner}
            isRinging={isRinging}
            onMute={toggleMute}
            onEndCall={handleEndLiveKitCall}
            onAnswer={handleAcceptLiveKitCall}
            onDecline={handleDeclineLiveKitCall}
            onRetry={recoverFromError}
            showTranscription={showTranscription}
            onToggleTranscription={toggleTranscription}
            transcripts={transcripts}
            isTranscriptionLoading={isTranscriptionLoading}
            transcriptionError={transcriptionError}
          />
        )}
        {/* Audio Elements */}
        <audio ref={localAudioRef} muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default LandingPage;