// Example: Using Enhanced WebRTC Service with Mobile Audio Support
import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCService } from '../services/webrtc';

export const MobileWebRTCExample: React.FC = () => {
  const [webrtcService] = useState(() => new WebRTCService());
  const [isConnected, setIsConnected] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);

  // Add timestamped log entries
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log('WebRTC Debug:', logEntry);
    setConnectionLog(prev => [...prev.slice(-9), logEntry]);
  }, []);

  // Handle user interaction for mobile audio
  const handleUserInteraction = useCallback(async () => {
    if (!userInteracted) {
      try {
        await webrtcService.ensureMobileAudioReady();
        setUserInteracted(webrtcService.hasUserInteracted());
        setAudioReady(true);
        console.log('Mobile audio ready');
      } catch (error) {
        console.error('Failed to prepare mobile audio:', error);
      }
    }
  }, [webrtcService, userInteracted]);

  // Setup WebRTC event handlers
  useEffect(() => {
    addLog('Setting up WebRTC event handlers');

    webrtcService.onConnectionStateChange((state) => {
      setIsConnected(state === 'connected');
      addLog(`🔗 Connection state: ${state}`);
      
      // This is the key sequence you're seeing: connecting → connected → disconnected → failed
      if (state === 'connected') {
        addLog('✅ WebRTC connection established - checking ICE state...');
        webrtcService.ensureMobileAudioReady();
      } else if (state === 'disconnected') {
        addLog('⚠️ Connection disconnected - this often precedes failure');
        addLog(`ICE state: ${webrtcService.getIceConnectionState()}`);
      } else if (state === 'failed') {
        addLog('❌ Connection failed - likely NAT/firewall issue');
        addLog('💡 This is the issue from your logs! Consider adding TURN servers');
      }
    });

    webrtcService.onRemoteStream((stream) => {
      addLog(`📺 Received remote stream with ${stream.getTracks().length} tracks`);
      // Remote audio is automatically handled by the service
    });

    return () => {
      addLog('🧹 Cleaning up WebRTC service');
      webrtcService.cleanup();
    };
  }, [webrtcService, addLog]);

  // Start call with mobile audio preparation
  const startCall = async () => {
    try {
      addLog('🚀 Starting call...');
      
      // First ensure mobile audio is ready
      await handleUserInteraction();
      addLog('🎤 Mobile audio interaction handled');
      
      // Get user media (microphone)
      await webrtcService.getUserMedia();
      addLog('📹 User media acquired');
      
      // Create offer and start WebRTC signaling
      const offer = await webrtcService.createOffer();
      addLog('📋 WebRTC offer created');
      
      // TODO: Send offer through your signaling mechanism (e.g., Socket.IO)
      // socket.emit('offer', offer);
      console.log('Offer created:', offer);
      
      addLog('✅ Call started - watch for connection state changes');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to start call: ${errorMessage}`);
      console.error('Failed to start call:', error);
      alert('Failed to start call. Please check microphone permissions.');
    }
  };

  // Recovery function for connection failures
  const attemptRecovery = async () => {
    try {
      addLog('🔄 Attempting connection recovery...');
      const currentState = webrtcService.getConnectionState();
      const iceState = webrtcService.getIceConnectionState();
      
      addLog(`Current states - Connection: ${currentState}, ICE: ${iceState}`);
      
      if (currentState === 'failed') {
        addLog('Trying ICE restart...');
        await webrtcService.restartIce();
      } else {
        addLog('Restarting entire connection...');
        webrtcService.cleanup();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await startCall();
      }
    } catch (error) {
      addLog(`❌ Recovery failed: ${error}`);
    }
  };

  // Handle incoming call (example function - would be called by your signaling)
  const handleIncomingCall = useCallback(async (offer: RTCSessionDescriptionInit) => {
    try {
      // Ensure mobile audio is ready first
      await handleUserInteraction();
      
      // Create answer
      const answer = await webrtcService.createAnswer(offer);
      
      // TODO: Send answer through your signaling mechanism (e.g., Socket.IO)
      // socket.emit('answer', answer);
      console.log('Answer created:', answer);
      
      console.log('Answered call with mobile audio support');
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }, [webrtcService, handleUserInteraction]);

  // Example: This would be called when receiving an offer from signaling
  useEffect(() => {
    // Uncomment below to enable incoming call handling
    // socket.on('offer', handleIncomingCall);
    // return () => socket.off('offer', handleIncomingCall);
    
    // For now, log that the handler is ready
    console.log('Incoming call handler is ready for future implementation');
  }, [handleIncomingCall]);

  return (
    <div className="mobile-webrtc-example">
      <h2>Mobile WebRTC Audio Test</h2>
      
      {/* Audio Status Indicators */}
      <div className="audio-status">
        <div className={`status-indicator ${userInteracted ? 'active' : 'inactive'}`}>
          User Interaction: {userInteracted ? '✅' : '❌'}
        </div>
        <div className={`status-indicator ${audioReady ? 'active' : 'inactive'}`}>
          Audio Ready: {audioReady ? '✅' : '❌'}
        </div>
        <div className={`status-indicator ${isConnected ? 'active' : 'inactive'}`}>
          WebRTC Connected: {isConnected ? '✅' : '❌'}
        </div>
      </div>

      {/* Mobile-Specific Instructions */}
      {!userInteracted && (
        <div className="mobile-instructions">
          <p>📱 <strong>Mobile Users:</strong> Tap anywhere to enable audio</p>
          <button 
            onClick={handleUserInteraction}
            className="btn btn-primary"
          >
            Enable Audio for Mobile
          </button>
        </div>
      )}

      {/* Call Controls */}
      <div className="call-controls">
        <button 
          onClick={startCall}
          disabled={!audioReady}
          className="btn btn-success"
        >
          Start Call
        </button>
        
        <button 
          onClick={() => webrtcService.toggleMute()}
          disabled={!isConnected}
          className="btn btn-warning"
        >
          {webrtcService.isMuted() ? 'Unmute' : 'Mute'}
        </button>
        
        <button 
          onClick={() => webrtcService.cleanup()}
          className="btn btn-danger"
        >
          End Call
        </button>
        
        <button 
          onClick={attemptRecovery}
          disabled={isConnected}
          className="btn btn-warning"
        >
          🔄 Recover Connection
        </button>
      </div>

      {/* Debug Information */}
      <div className="debug-info">
        <h3>Debug Info</h3>
        <p><strong>Connection State:</strong> {webrtcService.getConnectionState()}</p>
        <p><strong>ICE State:</strong> {webrtcService.getIceConnectionState()}</p>
        <p><strong>Muted:</strong> {webrtcService.isMuted() ? 'Yes' : 'No'}</p>
        <p><strong>Local Stream:</strong> {webrtcService.getLocalStream() ? 'Active' : 'None'}</p>
        <p><strong>Remote Stream:</strong> {webrtcService.getRemoteStream() ? 'Active' : 'None'}</p>
      </div>

      {/* Connection Log - This will help diagnose your connection issues */}
      <div className="connection-log">
        <h3>Connection Log</h3>
        <div style={{ 
          maxHeight: '200px', 
          overflowY: 'auto', 
          backgroundColor: '#f5f5f5', 
          padding: '10px', 
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          border: '1px solid #ddd'
        }}>
          {connectionLog.length === 0 ? (
            <p>No log entries yet...</p>
          ) : (
            connectionLog.map((entry, index) => (
              <div key={index} style={{ marginBottom: '2px' }}>
                {entry}
              </div>
            ))
          )}
        </div>
        <button 
          onClick={() => setConnectionLog([])}
          className="btn btn-secondary"
          style={{ marginTop: '10px', fontSize: '12px', padding: '5px 10px' }}
        >
          Clear Log
        </button>
      </div>
    </div>
  );
};

export default MobileWebRTCExample;
