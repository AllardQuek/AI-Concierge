/// <reference types="vite/client" />
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
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

// Deterministic room name for 1:1 calls (digits only, no + or spaces)
function getRoomName(numberA: string, numberB: string): string {
  // Normalize both numbers to ensure consistent room naming
  const normalizeForRoom = (phoneNumber: string): string => {
    const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    
    // Handle 8-digit Singapore mobile numbers (without country code)
    if (digitsOnly.length === 8 && (digitsOnly.startsWith('8') || digitsOnly.startsWith('9'))) {
      return `65${digitsOnly}`; // Add 65 prefix for consistency
    }
    
    // Handle numbers that already have 65 prefix
    if (digitsOnly.startsWith('65') && digitsOnly.length === 10) {
      return digitsOnly;
    }
    
    // Return as-is if we can't normalize
    return digitsOnly;
  };
  
  const cleanA = normalizeForRoom(numberA);
  const cleanB = normalizeForRoom(numberB);
  const [first, second] = [cleanA, cleanB].sort();
  return `room-${first}-${second}`;
}

// Test audio levels to ensure microphone is working before joining LiveKit
async function testAudioLevelsBeforeJoining(stream: MediaStream): Promise<void> {
  return new Promise((resolve) => {
    console.log('🔊 Testing audio levels from microphone...');
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let testCount = 0;
      let audioDetected = false;
      const maxTests = 20; // Test for 2 seconds (20 * 100ms)
      
      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        
        console.log(`🎤 Audio level test ${testCount + 1}: ${average.toFixed(2)}`);
        
        if (average > 2) { // Very low threshold to detect any audio
          audioDetected = true;
          console.log('✅ Audio detected from microphone!');
          clearInterval(testInterval);
          audioContext.close();
          resolve();
          return;
        }
        
        testCount++;
        if (testCount >= maxTests) {
          clearInterval(testInterval);
          audioContext.close();
          if (!audioDetected) {
            console.warn('⚠️ No audio detected from microphone - please check microphone settings');
          }
          resolve();
        }
      }, 100);
      
    } catch (error) {
      console.warn('⚠️ Could not test audio levels:', error);
      resolve();
    }
  });
}

// Toast context and provider
const ToastContext = createContext<(msg: string) => void>(() => {});

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 4000);
  };

  const handleClose = () => {
    setVisible(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && visible && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in">
            <span>{toast}</span>
            <button onClick={handleClose} className="ml-4 text-white hover:text-gray-300 focus:outline-none">✖️</button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

function useToast() {
  return useContext(ToastContext);
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
  const [participants, setParticipants] = useState<Array<{ identity: string; isBot: boolean }>>([]);
  const [isInvitingBot, setIsInvitingBot] = useState(false);
  const liveKitRoomRef = useRef<Room | null>(null);
  
  // Refs to track current values for event handlers
  const livekitCallPartnerRef = useRef<string>('');
  const myNumberRef = useRef<string>('');
  
  // Update refs when state changes
  useEffect(() => {
    livekitCallPartnerRef.current = livekitCallPartner;
  }, [livekitCallPartner]);
  
  useEffect(() => {
    myNumberRef.current = myNumber;
  }, [myNumber]);

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
    
    console.log(`📝 Phone number input changed: "${friendNumber}" -> "${value}"`);
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

    const handleSocketDisconnect = (reason: string) => {
      console.log('🔌 Socket disconnected, reason:', reason);
      console.log('🔌 Disconnect timestamp:', new Date().toISOString());
      console.log('🔌 Current call state:', callState);
      console.log('🔌 LiveKit call state:', livekitCallState);
      
      cleanup();
      setCallState('idle');
      setError('Connection lost. Please try again.');
      updateCurrentCallPartner('');
    };

    const handleSocketConnect = () => {
      console.log('🔌 Socket reconnected successfully');
      console.log('🔌 Reconnect timestamp:', new Date().toISOString());
      setIsConnected(true);
      setError('');
      
      // Re-register the user number when reconnecting
      if (myNumber && socketRef.current) {
        console.log(`📝 Re-registering user number after reconnect: ${myNumber}`);
        socketRef.current.joinRoom(myNumber);
      }
    };

    const handleSocketReconnectAttempt = (attemptNumber: number) => {
      console.log('🔌 Socket reconnection attempt:', attemptNumber);
    };

    const handleSocketReconnectFailed = () => {
      console.error('🔌 Socket reconnection failed');
      setError('Unable to reconnect to server');
    };

    socketRef.current.on('disconnect', handleSocketDisconnect);
    socketRef.current.on('connect', handleSocketConnect);
    socketRef.current.on('reconnect_attempt', handleSocketReconnectAttempt);
    socketRef.current.on('reconnect_failed', handleSocketReconnectFailed);

    // Clean up listeners on unmount
    return () => {
      socketRef.current?.off('disconnect', handleSocketDisconnect);
      socketRef.current?.off('connect', handleSocketConnect);
      socketRef.current?.off('reconnect_attempt', handleSocketReconnectAttempt);
      socketRef.current?.off('reconnect_failed', handleSocketReconnectFailed);
    };
  }, [socketRef.current, callState, livekitCallState]);

  // Auto-cleanup when call returns to idle after being connected
  useEffect(() => {
    // This effect ensures proper cleanup when transitioning from connected to idle
    if (callState === 'idle' && currentCallPartner) {
      stopCallDurationTimer(); // Stop timer when call ends
      updateCurrentCallPartner('');
      setError('');
    }
  }, [callState, currentCallPartner]);

  // Recovery mechanism for stuck states
  useEffect(() => {
    // If we're stuck in incoming state for too long, auto-cleanup
    if (callState === 'incoming') {
      const stuckTimeout = setTimeout(() => {
        console.log('⚠️ Call stuck in incoming state for 60 seconds, auto-cleaning up');
        cleanup();
        setCallState('idle');
        setError('Call timed out - please try again');
      }, 60000); // 60 seconds

      return () => clearTimeout(stuckTimeout);
    }
  }, [callState]);

  // Update connection stats state when ref changes
  useEffect(() => {
    setConnectionStats(connectionStatsRef.current);
  }, [connectionStatsRef.current]);

  // Debug friendNumber state changes
  useEffect(() => {
    console.log(`📱 friendNumber state changed to: "${friendNumber}"`);
  }, [friendNumber]);

  // LiveKit call signaling handlers
  useEffect(() => {
    if (!socketRef.current) return;
    
    console.log('🔧 Setting up LiveKit event handlers...');
    
    // Incoming LiveKit call
    const onUserCallingLivekit = ({ callerCode }: { callerCode: string }) => {
      console.log(`📞 Received LiveKit call from: "${callerCode}"`);
      
      // Validate callerCode before setting it
      if (!callerCode || callerCode.trim() === '') {
        console.error(`❌ Invalid callerCode received: "${callerCode}"`);
        setError('Received invalid caller information');
        return;
      }
      
      setLivekitCallPartner(callerCode);
      setLivekitCallState('incoming');
      console.log(`✅ LiveKit call partner set to: "${callerCode}"`);
    };
    // Call accepted by callee
    const onCallAcceptedLivekit = () => {
      console.log(`🎵 call-accepted-livekit event received!`);
      console.log(`   Event timestamp: ${new Date().toISOString()}`);
      
      // Get current values from refs (more reliable than closures)
      const currentPartner = livekitCallPartnerRef.current;
      const currentMyNumber = myNumberRef.current;
      
      console.log(`   Current livekitCallPartner: "${currentPartner}"`);
      console.log(`   Current myNumber: "${currentMyNumber}"`);
      
      // Validate livekitCallPartner before joining room
      if (!currentPartner || currentPartner.trim() === '') {
        console.error('❌ Cannot join LiveKit room: livekitCallPartner is empty');
        setError('Invalid call partner information');
        setLivekitCallState('idle');
        return;
      }
      
      // Validate myNumber is available
      if (!currentMyNumber || currentMyNumber.trim() === '') {
        console.error('❌ Cannot join LiveKit room: myNumber is empty');
        setError('Invalid user number information');
        setLivekitCallState('idle');
        return;
      }
      
      console.log(`✅ Validated numbers - My: "${currentMyNumber}", Partner: "${currentPartner}"`);
      console.log(`🚀 Starting room join process...`);
      joinLiveKitRoom(currentPartner);
      setLivekitCallState('connected');
      startCallDurationTimer();
    };
    // Call declined by callee
    const onCallDeclinedLivekit = () => {
      setLivekitCallState('idle');
      setLivekitCallPartner('');
      setError('Call was declined');
      stopCallDurationTimer();
    };
    // Bot invitation state handlers
    const onBotInvitationStarted = () => {
      console.log('🤖 Bot invitation started by other participant');
      setIsInvitingBot(true);
    };
    const onBotInvitationCompleted = () => {
      console.log('🤖 Bot invitation completed');
      setIsInvitingBot(false);
    };
    (socketRef.current as any).on('user-calling-livekit', onUserCallingLivekit);
    (socketRef.current as any).on('call-accepted-livekit', onCallAcceptedLivekit);
    (socketRef.current as any).on('call-declined-livekit', onCallDeclinedLivekit);
    (socketRef.current as any).on('bot-invitation-started', onBotInvitationStarted);
    (socketRef.current as any).on('bot-invitation-completed', onBotInvitationCompleted);
    
    console.log('✅ LiveKit event handlers registered successfully');
    
    return () => {
      console.log('🧹 Cleaning up LiveKit event handlers...');
      (socketRef.current as any)?.off('user-calling-livekit', onUserCallingLivekit);
      (socketRef.current as any)?.off('call-accepted-livekit', onCallAcceptedLivekit);
      (socketRef.current as any)?.off('call-declined-livekit', onCallDeclinedLivekit);
      (socketRef.current as any)?.off('bot-invitation-started', onBotInvitationStarted);
      (socketRef.current as any)?.off('bot-invitation-completed', onBotInvitationCompleted);
    };
  }, [socketRef.current]); // Removed livekitCallPartner and myNumber dependencies

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
      console.log('📱 Current call state before WebRTC state change:', callState);
      
      if (state === 'connected') {
        // Track connection start time for stability monitoring
        connectionStartTimeRef.current = Date.now();
        connectionStatsRef.current.connectionsSucceeded++;
        
        console.log('✅ Transitioning call state from', callState, 'to connected');
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
      console.log('📞 Call was answered by remote peer');
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.setRemoteAnswer(answer);
          console.log('✅ Remote answer set successfully');
          // The WebRTC connection state change handler will set call state to 'connected'
          clearTimeout(callTimeoutRef.current!); // Clear connection timeout
        } catch (error) {
          console.error('❌ Failed to set remote answer:', error);
          cleanup();
          setError('Failed to establish connection - please try again');
          setCallState('idle');
        }
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
      // Instead of setError('Call ended by other party'), show toast
      showToast('Call ended by other party');
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
      
      // Validate current state
      if (callState !== 'incoming') {
        console.warn('⚠️ Attempted to answer call in wrong state:', callState);
        return;
      }
      
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
      
      console.log('✅ Call answer sent successfully');
      // DON'T set call state to 'connected' here - wait for WebRTC connection
      // The WebRTC connection state change handler will set it to 'connected'
      
      // Set a timeout for the recipient as well
      callTimeoutRef.current = window.setTimeout(() => {
        console.log('⏰ Recipient connection timeout after 30 seconds');
        cleanup();
        setError('Connection timeout - please try again');
        setCallState('idle');
      }, 30000); // 30 second timeout
      
      // Clean up the stored offer
      if ((window as any).incomingOffer) {
        delete (window as any).incomingOffer;
      }
      
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
      setError(''); // Clear error before starting call
      
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
    
    try {
      // Normalize the phone number before calling (same as regular calls)
      const normalizedNumber = normalizePhoneNumber(friendNumber.trim());
      console.log(`📞 LiveKit Phone Number Normalization:`);
      console.log(`   Original input: "${friendNumber.trim()}"`);
      console.log(`   Normalized to: "${normalizedNumber}"`);
      
      // Pre-request microphone permissions to ensure user gesture requirement
      console.log('🎤 Pre-requesting microphone permissions for caller...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop test stream
      console.log('✅ Microphone permissions granted for caller');
      
      // Signal B via Socket.IO
      socketRef.current?.emit('call-user-livekit', {
        targetCode: normalizedNumber,
        callerCode: myNumber,
      });
      setLivekitCallPartner(normalizedNumber);
      setLivekitCallState('outgoing');
      console.log('📞 LiveKit call initiated, waiting for callee to accept...');
      // Wait for call-accepted-livekit event before joining room
      setError(''); // Clear error before starting call
    } catch (error) {
      console.error('❌ Failed to initiate LiveKit call:', error);
      setError(`Failed to initiate call: ${error instanceof Error ? error.message : 'Microphone permission required'}`);
    }
  };

  const handleAcceptLiveKitCall = async () => {
    console.log('📞 Callee accepting LiveKit call...');
    console.log(`   Caller code: "${livekitCallPartner}"`);
    console.log(`   Callee code: "${myNumber}"`);
    
    if (!socketRef.current) {
      console.error('❌ Socket not available for accepting call');
      setError('Socket connection not available');
      return;
    }
    
    // Validate numbers before proceeding
    if (!livekitCallPartner || livekitCallPartner.trim() === '') {
      console.error('❌ Cannot accept call: livekitCallPartner is empty');
      setError('Invalid call partner information');
      return;
    }
    
    if (!myNumber || myNumber.trim() === '') {
      console.error('❌ Cannot accept call: myNumber is empty');
      setError('Invalid user number information');
      return;
    }
    
    try {
      console.log('📡 Sending accept call signal to server...');
      socketRef.current.emit('accept-call-livekit', { callerCode: livekitCallPartner, calleeCode: myNumber });
      
      console.log('🚀 Callee joining LiveKit room immediately...');
      
      // Ensure we have user gesture for audio by requesting permissions first
      console.log('🎤 Requesting microphone permissions for callee...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop test stream
      console.log('✅ Microphone permissions granted for callee');
      
      // Join room immediately when accepting - no need to wait for server confirmation
      await joinLiveKitRoom(livekitCallPartner);
      setLivekitCallState('connected');
      startCallDurationTimer();
      
      console.log('✅ Callee successfully joined LiveKit room');
    } catch (error) {
      console.error('❌ Failed to accept LiveKit call:', error);
      setError(`Failed to accept call: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLivekitCallState('idle');
    }
  };

  const handleDeclineLiveKitCall = () => {
    socketRef.current?.emit('decline-call-livekit', { callerCode: livekitCallPartner, calleeCode: myNumber });
    setLivekitCallState('idle');
    setLivekitCallPartner('');
    stopCallDurationTimer();
  };

  const handleEndLiveKitCall = () => {
    liveKitRoomRef.current?.disconnect();
    socketRef.current?.emit('end-call-livekit', {
      targetCode: livekitCallPartner,
      fromCode: myNumber,
    });
    setLivekitCallState('idle');
    setLivekitCallPartner('');
    setParticipants([]);
    setIsInvitingBot(false);
    stopCallDurationTimer();
  };

  useEffect(() => {
    if (!socketRef.current) return;
    const onCallEndedLivekit = () => {
      liveKitRoomRef.current?.disconnect();
      setLivekitCallState('idle');
      setLivekitCallPartner('');
      setParticipants([]);
      setIsInvitingBot(false);
      setError('Call ended by other party');
      stopCallDurationTimer();
    };
    (socketRef.current as any).on('call-ended-livekit', onCallEndedLivekit);
    return () => {
      (socketRef.current as any)?.off('call-ended-livekit', onCallEndedLivekit);
    };
  }, [socketRef.current]);

  const joinLiveKitRoom = async (otherNumber: string) => {
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
    const tokenApiUrl = import.meta.env.VITE_LIVEKIT_TOKEN_URL;
    
    // Validate phone numbers before generating room name
    if (!myNumber || !otherNumber) {
      console.error('❌ Invalid phone numbers for LiveKit room:', { myNumber, otherNumber });
      setError('Invalid phone numbers for LiveKit call');
      return;
    }
    
    console.log('🎵 LiveKit Room Setup:');
    console.log(`   My number: "${myNumber}"`);
    console.log(`   Other number: "${otherNumber}"`);
    
    const roomName = getRoomName(myNumber, otherNumber);
    
    // Normalize identity to match room name format (digits only)
    const normalizeForIdentity = (phoneNumber: string): string => {
      const digitsOnly = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
      
      // Handle 8-digit Singapore mobile numbers (without country code)
      if (digitsOnly.length === 8 && (digitsOnly.startsWith('8') || digitsOnly.startsWith('9'))) {
        return `65${digitsOnly}`; // Add 65 prefix for consistency
      }
      
      // Handle numbers that already have 65 prefix
      if (digitsOnly.startsWith('65') && digitsOnly.length === 10) {
        return digitsOnly;
      }
      
      // Return as-is if we can't normalize
      return digitsOnly;
    };
    
    const identity = normalizeForIdentity(myNumber);
    
    console.log(`   Generated room name: ${roomName}`);
    console.log(`   Original myNumber: "${myNumber}"`);
    console.log(`   Normalized identity: "${identity}"`);
    console.log(`   LiveKit URL: ${livekitUrl}`);
        console.log(`   Token API URL: ${tokenApiUrl}`);
    
    let token;
    try {
      console.log(`🔗 Requesting token from: ${tokenApiUrl}?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`);
      const response = await fetch(`${tokenApiUrl}?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Token request failed: ${response.status} ${response.statusText}`);
        console.error(`❌ Error response: ${errorText}`);
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }
      
      const tokenData = await response.json();
      token = tokenData.token;
      
      if (!token) {
        console.error('❌ No token received from server');
        throw new Error('No token received from server');
      }
      
      console.log(`🎟️ Token received: ${token.substring(0, 50)}...`);
      console.log(`🎟️ Token length: ${token.length} characters`);
    } catch (error) {
      console.error('❌ Failed to get LiveKit token:', error);
      setError(`Failed to get LiveKit token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return;
    }
    
    const room = new Room();
    
    // Add connection event listeners for debugging
    room.on('connected', () => {
      console.log('🟢 LiveKit room connected successfully');
      console.log(`   Room name: ${room.name}`);
      console.log(`   Local participant SID: ${room.localParticipant.sid}`);
      console.log(`   Local participant identity: ${room.localParticipant.identity}`);
    });
    
    room.on('disconnected', (reason) => {
      console.log('🔴 LiveKit room disconnected:', reason);
    });
    
    room.on('reconnecting', () => {
      console.log('🔄 LiveKit room reconnecting...');
    });
    
    room.on('reconnected', () => {
      console.log('🟢 LiveKit room reconnected');
    });
    
    // Add audio level monitoring
    room.on('localTrackPublished', (publication) => {
      console.log('📡 Local track published:', publication.trackSid, publication.kind);
      
      if (publication.kind === 'audio' && publication.track) {
        console.log('🎤 Setting up audio level monitoring for local track');
        
        // Monitor audio levels to detect if microphone is working
        const audioTrack = publication.track as any;
        if (audioTrack.mediaStreamTrack) {
          // Create audio context to monitor levels (if available)
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack.mediaStreamTrack]));
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);
            
            analyser.fftSize = 32;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            let silenceCount = 0;
            const checkAudioLevel = () => {
              analyser.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b) / bufferLength;
              
              if (average < 5) {
                silenceCount++;
                if (silenceCount % 10 === 0) { // Log every 10 silence checks
                  console.log(`🔇 Audio level check: ${average.toFixed(2)} (silence count: ${silenceCount})`);
                }
              } else {
                if (silenceCount > 0) {
                  console.log(`🎤 Audio detected! Level: ${average.toFixed(2)} (ending silence streak of ${silenceCount})`);
                  silenceCount = 0;
                }
              }
            };
            
            const audioLevelInterval = setInterval(checkAudioLevel, 1000);
            
            // Clean up when room disconnects
            room.once('disconnected', () => {
              clearInterval(audioLevelInterval);
              audioContext.close();
            });
            
          } catch (error) {
            console.warn('⚠️ Could not set up audio level monitoring:', error);
          }
        }
      }
    });
    
    // Monitor for silence detection events from LiveKit
    room.on('localTrackUnpublished', (publication) => {
      console.log('📡 Local track unpublished:', publication.trackSid, publication.kind);
    });
    
    // Add error handling for connection issues
    room.on('disconnected', (reason) => {
      console.log('🔴 LiveKit connection error or disconnect:', reason);
    });
    
    console.log('🔌 Connecting to LiveKit room...');
    console.log(`   Room name: ${roomName}`);
    console.log(`   Identity: ${identity}`);
    console.log(`   LiveKit URL: ${livekitUrl}`);
    
    try {
      await room.connect(livekitUrl, token);
      console.log('✅ LiveKit room connection initiated successfully');
    } catch (error) {
      console.error('❌ Failed to connect to LiveKit room:', error);
      setError(`Failed to connect to LiveKit room: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return;
    }
    
    console.log('🎤 Creating local audio track...');
    try {
      // First, test microphone access with getUserMedia to ensure permissions
      console.log('🎤 Testing microphone access...');
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });
      
      // Verify the stream has audio tracks
      const audioTracks = testStream.getAudioTracks();
      console.log(`🎤 Audio tracks available: ${audioTracks.length}`);
      
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available from microphone');
      }
      
      // Test the audio track with a more comprehensive check
      const testTrack = audioTracks[0];
      console.log('🎤 Test track properties:', {
        enabled: testTrack.enabled,
        muted: testTrack.muted,
        readyState: testTrack.readyState,
        label: testTrack.label,
        settings: testTrack.getSettings()
      });
      
      // Test audio levels on the test stream before stopping it
      await testAudioLevelsBeforeJoining(testStream);
      
      // Stop the test stream before creating LiveKit track
      testStream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone test completed successfully');
      
      // Now create the LiveKit audio track with the same constraints
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      });
      
      console.log('✅ Local audio track created successfully:');
      console.log(`   Track SID: ${audioTrack.sid}`);
      console.log(`   Track kind: ${audioTrack.kind}`);
      console.log(`   Track source: ${audioTrack.source}`);
      console.log(`   Track is muted: ${audioTrack.isMuted}`);
      
      // Check MediaStreamTrack properties
      const mediaStreamTrack = audioTrack.mediaStreamTrack;
      if (mediaStreamTrack) {
        console.log('🎤 MediaStreamTrack properties:');
        console.log(`   Ready state: ${mediaStreamTrack.readyState}`);
        console.log(`   Enabled: ${mediaStreamTrack.enabled}`);
        console.log(`   Muted: ${mediaStreamTrack.muted}`);
        console.log(`   Label: ${mediaStreamTrack.label}`);
        console.log(`   Settings:`, mediaStreamTrack.getSettings());
        
        // Force enable the track if it's disabled
        if (!mediaStreamTrack.enabled) {
          console.log('⚠️ Audio track is disabled, enabling...');
          mediaStreamTrack.enabled = true;
        }
        
        // Test if the track is producing audio data
        console.log('🔊 Testing audio data production...');
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        
        analyser.fftSize = 32;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Quick audio level test
        let hasAudio = false;
        for (let i = 0; i < 10; i++) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          if (average > 0) {
            hasAudio = true;
            console.log(`🎤 Audio data detected: level ${average.toFixed(2)}`);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!hasAudio) {
          console.warn('⚠️ No audio data detected - microphone may be muted or disconnected');
        }
        
        audioContext.close();
      }
      
      // Ensure the track is not muted before publishing
      if (audioTrack.isMuted) {
        console.log('🔊 Audio track is muted, unmuting...');
        await audioTrack.unmute();
      }
      
      console.log('📤 Publishing local audio track...');
      const publication = await room.localParticipant.publishTrack(audioTrack, {
        name: 'microphone'
      });
      
      console.log('✅ Local audio track published successfully:');
      console.log(`   Publication SID: ${publication.trackSid}`);
      console.log(`   Publication kind: ${publication.kind}`);
      console.log(`   Publication source: ${publication.source}`);
      console.log(`   Publication subscribed: ${publication.isSubscribed}`);
      console.log(`   Publication enabled: ${publication.isEnabled}`);
      console.log(`   Publication muted: ${publication.isMuted}`);
      
      // Wait a moment and check if the publication is working
      setTimeout(() => {
        console.log('🔊 Post-publish track status check:');
        console.log(`   Track is muted: ${audioTrack.isMuted}`);
        console.log(`   Publication is muted: ${publication.isMuted}`);
        console.log(`   Publication is enabled: ${publication.isEnabled}`);
        console.log(`   MediaStreamTrack enabled: ${mediaStreamTrack?.enabled}`);
        console.log(`   MediaStreamTrack muted: ${mediaStreamTrack?.muted}`);
        console.log(`   MediaStreamTrack readyState: ${mediaStreamTrack?.readyState}`);
        
        // Force unmute if still muted
        if (audioTrack.isMuted || publication.isMuted) {
          console.log('⚠️ Track still muted, forcing unmute...');
          audioTrack.unmute().then(() => {
            console.log('✅ Track unmuted successfully');
          }).catch((error) => {
            console.error('❌ Failed to unmute track:', error);
          });
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to create or publish audio track:', error);
      throw error;
    }
    
    liveKitRoomRef.current = room;
    
    // Initialize participants list with current participants
    const updateParticipantsList = () => {
      const participantsList = Array.from(room.remoteParticipants.values()).map(p => ({
        identity: p.identity,
        isBot: p.identity.includes('bot') || p.identity.includes('mulisa')
      }));
      
      // Add local participant
      participantsList.push({
        identity: room.localParticipant.identity,
        isBot: false
      });
      
      console.log('👥 Participants updated:', participantsList);
      setParticipants(participantsList);
    };
    
    // Track participant events
    room.on('participantConnected', (participant) => {
      console.log('👋 Participant connected:', participant.identity);
      console.log(`   Participant SID: ${participant.sid}`);
      console.log(`   Participant tracks: ${participant.trackPublications.size}`);
      
      // Log existing tracks
      participant.trackPublications.forEach((publication, sid) => {
        console.log(`   📡 Track publication: ${sid} (${publication.kind})`);
      });
      
      updateParticipantsList();
    });
    
    room.on('participantDisconnected', (participant) => {
      console.log('👋 Participant disconnected:', participant.identity);
      updateParticipantsList();
    });
    
    // Add track publication events for debugging
    room.on('trackPublished', (publication, participant) => {
      console.log('📡 Track published:');
      console.log(`   From: ${participant.identity}`);
      console.log(`   Track SID: ${publication.trackSid}`);
      console.log(`   Kind: ${publication.kind}`);
      console.log(`   Source: ${publication.source}`);
    });
    
    room.on('trackUnpublished', (publication, participant) => {
      console.log('📡 Track unpublished:');
      console.log(`   From: ${participant.identity}`);
      console.log(`   Track SID: ${publication.trackSid}`);
    });
    
    // Initial participants update
    updateParticipantsList();
    
    // Check for existing remote tracks when we join
    console.log('🔍 Checking for existing remote participants and tracks...');
    room.remoteParticipants.forEach((participant) => {
      console.log(`👤 Existing participant: ${participant.identity}`);
      console.log(`   Track publications: ${participant.trackPublications.size}`);
      
      participant.trackPublications.forEach((publication) => {
        console.log(`   📡 Existing track: ${publication.trackSid} (${publication.kind}, subscribed: ${publication.isSubscribed})`);
        
        // If track is already subscribed, manually trigger the subscription handler
        if (publication.isSubscribed && publication.track) {
          console.log('🔄 Manually handling existing subscribed track');
          // Trigger track subscription manually
          room.emit('trackSubscribed', publication.track, publication, participant);
        }
      });
    });
    
    // Handle remote audio tracks - using Map to handle multiple participants
    const remoteAudioElements = new Map<string, HTMLAudioElement>();
    
    room.on('trackSubscribed', (track, publication, participant) => {
      console.log('🎵 Track subscribed:');
      console.log(`   From: ${participant.identity}`);
      console.log(`   Track kind: ${track.kind}`);
      console.log(`   Track source: ${track.source}`);
      console.log(`   Track SID: ${track.sid}`);
      console.log(`   Publication SID: ${publication.trackSid}`);
      
      if (track.kind === 'audio') {
        console.log('🎤 Audio track received, setting up playback...');
        
        // Clean up any existing audio element for this participant
        const existingAudio = remoteAudioElements.get(participant.identity);
        if (existingAudio) {
          try { 
            console.log('🔄 Detaching previous audio element for:', participant.identity);
            track.detach(existingAudio);
            existingAudio.remove(); 
            remoteAudioElements.delete(participant.identity);
          } catch (err) {
            console.warn('⚠️ Error detaching previous audio:', err);
          }
        }
        
        try {
          const audioElement = track.attach() as HTMLAudioElement;
          console.log('🔗 Audio element attached for:', participant.identity);
          
          // Configure audio element for optimal playback
          audioElement.autoplay = true;
          audioElement.volume = 1.0;
          audioElement.muted = false;
          audioElement.setAttribute('playsinline', 'true'); // Important for mobile
          audioElement.style.display = 'none'; // Hide the audio element
          
          // Store the audio element
          remoteAudioElements.set(participant.identity, audioElement);
          
          // Add to DOM first, then set up event listeners
          document.body.appendChild(audioElement);
          console.log('✅ Remote audio element added to DOM for:', participant.identity);

          // Handle autoplay policy with user-friendly error handling
          const playAudio = async () => {
            try {
              await audioElement.play();
              console.log('▶️ Audio playback started successfully for', participant.identity);
            } catch (err: any) {
              console.warn('⚠️ Audio playback was blocked by browser autoplay policy for', participant.identity, err);
              
              // Show user-friendly message for autoplay issues
              if (err.name === 'NotAllowedError') {
                console.log('🔊 Requesting user interaction to enable audio playback...');
                setError('Click anywhere to enable audio playback');
                
                // Add a one-time click handler to enable audio
                const enableAudio = () => {
                  audioElement.play().then(() => {
                    console.log('▶️ Audio enabled after user interaction for', participant.identity);
                    setError(''); // Clear the error message
                  }).catch((retryErr) => {
                    console.error('❌ Still failed to play audio after user interaction:', retryErr);
                  });
                  document.removeEventListener('click', enableAudio);
                };
                
                document.addEventListener('click', enableAudio, { once: true });
              }
            }
          };
          
          // Try to play immediately, but handle autoplay gracefully
          playAudio();
          
          // Test audio levels after a short delay
          setTimeout(() => {
            console.log('🔊 Audio element test for', participant.identity, ':', {
              volume: audioElement.volume,
              muted: audioElement.muted,
              paused: audioElement.paused,
              currentTime: audioElement.currentTime,
              duration: audioElement.duration,
              readyState: audioElement.readyState,
              networkState: audioElement.networkState
            });
            
            // Ensure volume is at maximum and not muted
            audioElement.volume = 1.0;
            audioElement.muted = false;
            console.log('🔊 Audio settings optimized for:', participant.identity);
            
            // If audio is still paused, try to resume it
            if (audioElement.paused) {
              console.log('⚠️ Audio is paused, attempting to resume...');
              audioElement.play().catch((err) => {
                console.warn('Could not resume paused audio:', err);
              });
            }
          }, 1000);
          
          // Add event listeners for debugging
          audioElement.onloadedmetadata = () => {
            console.log('✅ Audio metadata loaded for', participant.identity, ', duration:', audioElement.duration);
          };
          
          audioElement.oncanplay = () => {
            console.log('✅ Audio can play for', participant.identity);
          };
          
          audioElement.onplay = () => {
            console.log('🎵 Audio playback started for', participant.identity);
          };
          
          audioElement.onerror = (error) => {
            console.error('❌ Audio playback error for', participant.identity, ':', error);
          };
          
        } catch (error) {
          console.error('❌ Error setting up audio playback for', participant.identity, ':', error);
        }
      }
    });
    
    // Handle track unsubscription
    room.on('trackUnsubscribed', (track, _publication, participant) => {
      console.log('🔇 Track unsubscribed:');
      console.log(`   From: ${participant.identity}`);
      console.log(`   Track kind: ${track.kind}`);
      console.log(`   Track source: ${track.source}`);
      
      if (track.kind === 'audio') {
        const audioElement = remoteAudioElements.get(participant.identity);
        if (audioElement) {
          try {
            track.detach(audioElement);
            audioElement.remove();
            remoteAudioElements.delete(participant.identity);
            console.log('✅ Remote audio element cleaned up for:', participant.identity);
          } catch (err) {
            console.warn('⚠️ Error cleaning up audio element for', participant.identity, ':', err);
          }
        }
      }
    });
    // Clean up remote audio on disconnect
    room.on('disconnected', () => {
      console.log('🔌 Room disconnected, clearing participants');
      setParticipants([]);
      setIsInvitingBot(false);
      
      // Clean up all remote audio elements
      for (const [participantId, audioElement] of remoteAudioElements.entries()) {
        try {
          audioElement.remove();
          console.log('🧹 Cleaned up audio element for:', participantId);
        } catch (err) {
          console.warn('⚠️ Error cleaning up audio element for', participantId, ':', err);
        }
      }
      remoteAudioElements.clear();
    });
    // Optionally: handle remote tracks, update UI, etc.
  };

  // Function to trigger bot to join the room
  const inviteBotToCall = async () => {
    if (livekitCallState !== 'connected' || !livekitCallPartner) {
      console.warn('Cannot invite bot: no active LiveKit call');
      return;
    }

    if (isInvitingBot) {
      console.warn('Bot invite already in progress');
      return;
    }

    // Validate phone numbers before inviting bot
    if (!myNumber || !livekitCallPartner) {
      console.error('❌ Invalid phone numbers for bot invitation:', { myNumber, livekitCallPartner });
      setError('Cannot invite AI Oracle: Invalid phone numbers detected');
      return;
    }

    // Clean and validate phone numbers
    const cleanMyNumber = myNumber.replace(/\D/g, '');
    const cleanPartnerNumber = livekitCallPartner.replace(/\D/g, '');
    
    if (!cleanMyNumber || !cleanPartnerNumber) {
      console.error('❌ Phone numbers contain no digits:', { cleanMyNumber, cleanPartnerNumber });
      setError('Cannot invite AI Oracle: Phone numbers must contain digits');
      return;
    }

    console.log('🤖 Inviting bot with validated numbers:', { myNumber: cleanMyNumber, partner: cleanPartnerNumber });

    // Notify other participants that bot invitation is starting
    socketRef.current?.emit('bot-invitation-started', {
      roomParticipants: [myNumber, livekitCallPartner]
    });
    
    setIsInvitingBot(true);
    
    try {
      const botServerUrl = import.meta.env.VITE_BOT_SERVER_URL || 'http://localhost:4000';
      console.log('🤖 Using bot server URL:', botServerUrl);
      
      const response = await fetch(`${botServerUrl}/join-room?number1=${encodeURIComponent(cleanMyNumber)}&number2=${encodeURIComponent(cleanPartnerNumber)}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('🤖 Bot invited successfully:', result.message);
        // The bot should appear in the participants list automatically via the room events
      } else {
        console.error('❌ Failed to invite bot:', result.error);
        setError(`Failed to invite AI Oracle: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error inviting bot:', error);
      setError('Failed to invite AI Oracle. Please try again.');
    } finally {
      // Notify other participants that bot invitation is completed
      socketRef.current?.emit('bot-invitation-completed', {
        roomParticipants: [myNumber, livekitCallPartner]
      });
      setIsInvitingBot(false);
    }
  };

  // Comprehensive audio diagnostic function (available for debugging: call runAudioDiagnostics() in console)
  const runAudioDiagnostics = async () => {
    console.log('🔍 Running comprehensive audio diagnostics...');
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported in this browser');
        return { success: false, error: 'getUserMedia not supported' };
      }
      
      // Test microphone permissions
      console.log('🎤 Testing microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioTracks = stream.getAudioTracks();
      console.log(`🎤 Available audio tracks: ${audioTracks.length}`);
      
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        return { success: false, error: 'No audio tracks available' };
      }
      
      const track = audioTracks[0];
      console.log('🎤 Primary audio track:', {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
        capabilities: track.getCapabilities()
      });
      
      // Test audio context and analysis
      console.log('🔊 Testing audio analysis...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Test for 3 seconds
      let maxLevel = 0;
      let audioDetected = false;
      
      for (let i = 0; i < 30; i++) {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const max = Math.max(...dataArray);
        
        if (average > maxLevel) maxLevel = average;
        if (average > 1) audioDetected = true;
        
        if (i % 10 === 0) {
          console.log(`🔊 Audio test ${i/10 + 1}/3: avg=${average.toFixed(2)}, max=${max}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Clean up
      audioContext.close();
      stream.getTracks().forEach(track => track.stop());
      
      console.log(`🔊 Audio diagnostic results:`);
      console.log(`   Audio detected: ${audioDetected}`);
      console.log(`   Max level: ${maxLevel.toFixed(2)}`);
      console.log(`   Track enabled: ${track.enabled}`);
      console.log(`   Track muted: ${track.muted}`);
      
      if (!audioDetected) {
        console.warn('⚠️ No audio input detected - microphone may be muted or disconnected');
        return { 
          success: false, 
          error: 'No audio input detected',
          details: {
            trackEnabled: track.enabled,
            trackMuted: track.muted,
            maxLevel: maxLevel,
            label: track.label
          }
        };
      }
      
      console.log('✅ Audio diagnostics passed');
      return { success: true, maxLevel: maxLevel };
      
    } catch (error) {
      console.error('❌ Audio diagnostics failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // Make diagnostics available globally for debugging
  React.useEffect(() => {
    (window as any).runAudioDiagnostics = runAudioDiagnostics;
    return () => {
      delete (window as any).runAudioDiagnostics;
    };
  }, []);

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
    if (livekitCallState === 'connected' && liveKitRoomRef.current) {
      // Handle LiveKit muting
      const audioPublication = liveKitRoomRef.current.localParticipant.audioTrackPublications.values().next().value;
      if (audioPublication && audioPublication.track) {
        const newMutedState = !isMuted;
        if (newMutedState) {
          audioPublication.track.mute();
        } else {
          audioPublication.track.unmute();
        }
        setIsMuted(newMutedState);
        console.log(`🔇 LiveKit audio ${newMutedState ? 'muted' : 'unmuted'}`);
        
        // Debug the track state
        console.log('🎤 Local audio track state:', {
          isMuted: audioPublication.track.isMuted,
          trackSid: audioPublication.trackSid,
          kind: audioPublication.track.kind,
          source: audioPublication.track.source
        });
      } else {
        console.warn('⚠️ No audio track found for LiveKit muting');
      }
    } else if (webrtcRef.current) {
      // Handle WebRTC muting
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

  const showToast = useToast();

  return (
    <ToastProvider>
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
              participants={participants}
              onMute={toggleMute}
              onEndCall={handleEndLiveKitCall}
              onAnswer={handleAcceptLiveKitCall}
              onDecline={handleDeclineLiveKitCall}
              onRetry={recoverFromError}
              onInviteBot={inviteBotToCall}
              isInvitingBot={isInvitingBot}
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
    </ToastProvider>
  );
};

export default LandingPage;