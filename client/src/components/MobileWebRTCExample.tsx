// Example: Using Enhanced WebRTC Service with Mobile Audio Support
import React, { useState, useEffect, useCallback } from 'react';
import { WebRTCService } from '../services/webrtc';

export const MobileWebRTCExample: React.FC = () => {
  const [webrtcService] = useState(() => new WebRTCService());
  const [isConnected, setIsConnected] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

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
    webrtcService.onConnectionStateChange((state) => {
      setIsConnected(state === 'connected');
      
      // Ensure audio is ready when connected
      if (state === 'connected') {
        webrtcService.ensureMobileAudioReady();
      }
    });

    webrtcService.onRemoteStream((stream) => {
      console.log('Received remote stream with tracks:', stream.getTracks().length);
      // Remote audio is automatically handled by the service
    });

    return () => {
      webrtcService.cleanup();
    };
  }, [webrtcService]);

  // Start call with mobile audio preparation
  const startCall = async () => {
    try {
      // First ensure mobile audio is ready
      await handleUserInteraction();
      
      // Get user media (microphone)
      await webrtcService.getUserMedia();
      
      // Create offer and start WebRTC signaling
      const offer = await webrtcService.createOffer();
      
      // TODO: Send offer through your signaling mechanism (e.g., Socket.IO)
      // socket.emit('offer', offer);
      console.log('Offer created:', offer);
      
      console.log('Call started with mobile audio support');
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call. Please check microphone permissions.');
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
  // useEffect(() => {
  //   socket.on('offer', handleIncomingCall);
  //   return () => socket.off('offer', handleIncomingCall);
  // }, [handleIncomingCall]);

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
      </div>

      {/* Debug Information */}
      <div className="debug-info">
        <h3>Debug Info</h3>
        <p><strong>Connection State:</strong> {webrtcService.getConnectionState()}</p>
        <p><strong>Muted:</strong> {webrtcService.isMuted() ? 'Yes' : 'No'}</p>
        <p><strong>Local Stream:</strong> {webrtcService.getLocalStream() ? 'Active' : 'None'}</p>
        <p><strong>Remote Stream:</strong> {webrtcService.getRemoteStream() ? 'Active' : 'None'}</p>
      </div>
    </div>
  );
};

export default MobileWebRTCExample;
