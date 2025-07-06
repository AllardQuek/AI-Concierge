import React from 'react';
import { Button, ConnectionStatus, ErrorMessage } from './shared';
import TranscriptionPanel from './TranscriptionPanel';
import { TranscriptionResult } from '../services/types';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected';

interface CallInterfaceProps {
  callState: CallState;
  error?: string;
  isMuted: boolean;
  callDuration: number;
  currentCallPartner: string;
  isRinging?: boolean;
  onMute: () => void;
  onEndCall: () => void;
  onAnswer: () => void;
  onDecline: () => void;
  onRetry: () => void;
  // Transcription
  showTranscription: boolean;
  onToggleTranscription: () => void;
  transcripts: TranscriptionResult[];
  isTranscriptionLoading?: boolean;
  transcriptionError?: string;
}

const CallInterface: React.FC<CallInterfaceProps> = ({
  callState,
  error,
  isMuted,
  callDuration,
  currentCallPartner,
  isRinging,
  onMute,
  onEndCall,
  onAnswer,
  onDecline,
  onRetry,
  showTranscription,
  onToggleTranscription,
  transcripts,
  isTranscriptionLoading = false,
  transcriptionError,
}) => {
  // Format call duration as MM:SS
  const formatCallDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 max-w-md mx-4">
        {/* Connection Status */}
        <div className="text-center mb-6">
          <ConnectionStatus connectionState={
            callState === 'connected' ? 'connected' : 
            callState === 'outgoing' || callState === 'incoming' ? 'connecting' : 
            'disconnected'
          } />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 space-y-3">
            <ErrorMessage message={error} />
            <Button onClick={onRetry} variant="secondary" size="small" className="mx-auto">
              🔄 Try Again
            </Button>
          </div>
        )}

        {/* Incoming Call Interface */}
        {callState === 'incoming' && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center mb-4">
              <div className={`w-16 h-16 bg-green-100 rounded-full flex items-center justify-center ${isRinging ? 'animate-bounce' : ''}`}>
                <span className="text-3xl">📞</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                {isRinging ? '📳 Incoming Call' : '📞 Incoming Call'}
              </h3>
              <p className="text-lg text-gray-600 mb-2">From:</p>
              <p className="text-xl font-mono font-bold text-blue-600 break-all">
                {currentCallPartner}
              </p>
              {isRinging && (
                <p className="text-sm text-gray-500 mt-2 animate-pulse">
                  📳 Ring ring...
                </p>
              )}
            </div>
            <div className="flex gap-4">
              <Button
                onClick={onDecline}
                variant="danger"
                size="large"
                fullWidth
                className="flex items-center justify-center gap-2"
              >
                ❌ Decline
              </Button>
              <Button
                onClick={onAnswer}
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

        {/* Outgoing Call Interface */}
        {callState === 'outgoing' && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-3xl">📞</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">📞 Calling...</h3>
              <p className="text-lg text-gray-600 mb-2">Calling:</p>
              <p className="text-xl font-mono font-bold text-blue-600 break-all">
                {currentCallPartner}
              </p>
              <p className="text-sm text-gray-500 mt-2 animate-pulse">
                Waiting for them to answer...
              </p>
            </div>
            <Button
              onClick={onEndCall}
              variant="secondary"
              size="large"
              fullWidth
              className="flex items-center justify-center gap-2"
            >
              ❌ Cancel Call
            </Button>
          </div>
        )}

        {/* Active Call Interface */}
        {callState === 'connected' && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔊</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-green-800 mb-2">🔊 Active Call</h3>
              <p className="text-lg text-gray-600 mb-2">Connected to:</p>
              <p className="text-xl font-mono font-bold text-green-600 break-all mb-3">
                {currentCallPartner}
              </p>
              {/* Call Duration */}
              <div className="inline-flex items-center px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                <span className="text-sm font-mono text-green-700">
                  ⏱️ {formatCallDuration(callDuration)}
                </span>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={onMute}
                variant={isMuted ? "danger" : "secondary"}
                size="large"
                fullWidth
                className="flex items-center justify-center gap-2"
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </Button>
              <Button
                onClick={onToggleTranscription}
                variant={showTranscription ? "primary" : "secondary"}
                size="large"
                fullWidth
                disabled={isTranscriptionLoading}
                className="flex items-center justify-center gap-2"
              >
                {isTranscriptionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {showTranscription ? 'Stopping...' : 'Starting...'}
                  </>
                ) : (
                  <>
                    📝 {showTranscription ? 'Hide' : 'Show'} Transcription
                  </>
                )}
              </Button>
              <Button
                onClick={onEndCall}
                variant="danger"
                size="large"
                fullWidth
                className="flex items-center justify-center gap-2"
              >
                📞 End Call
              </Button>
            </div>
            {/* Transcription Error */}
            {transcriptionError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  ⚠️ {transcriptionError}
                </p>
              </div>
            )}
            
            {/* Inline Transcription Panel */}
            {showTranscription && (
              <div className="mt-6">
                <TranscriptionPanel
                  isVisible={true}
                  onClose={onToggleTranscription}
                  transcripts={transcripts}
                  inline={true}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallInterface;
