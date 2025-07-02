import React, { useState, useEffect, useRef } from 'react';
import { type ConversationHistory as ConversationData, transcriptionService } from '../services/transcription';
import { Card } from './shared';

interface ConversationHistoryProps {
  sessionId: string;
  isActive: boolean;
  className?: string;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  sessionId,
  isActive,
  className = ''
}) => {
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<'agent' | 'customer'>('agent');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    setSpeechSupported(transcriptionService.isSpeechRecognitionSupported());

    if (!sessionId || !isActive) {
      setConversation(null);
      return;
    }

    // Start transcription session
    transcriptionService.startSession(sessionId);

    // Subscribe to transcription updates
    const unsubscribe = transcriptionService.onTranscriptionUpdate(({ sessionId: updateSessionId, conversation: updatedConversation }) => {
      if (updateSessionId === sessionId) {
        setConversation(updatedConversation);
      }
    });

    return () => {
      unsubscribe();
      transcriptionService.endSession(sessionId);
    };
  }, [sessionId, isActive]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [conversation?.segments]);

  const handleManualInput = () => {
    if (manualInput.trim() && sessionId) {
      transcriptionService.addManualTranscription(sessionId, selectedSpeaker, manualInput.trim());
      setManualInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualInput();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getSpeakerColor = (speaker: 'agent' | 'customer') => {
    return speaker === 'agent' 
      ? 'bg-blue-50 border-l-4 border-l-blue-400' 
      : 'bg-green-50 border-l-4 border-l-green-400';
  };

  const getSpeakerIcon = (speaker: 'agent' | 'customer') => {
    return speaker === 'agent' ? '🎧' : '👤';
  };

  if (!isActive || !sessionId) {
    return (
      <Card className={className}>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">💬</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Conversation History</h3>
          <p className="text-gray-500 text-sm">Start a call to see real-time transcription</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="border-b border-gray-200 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Live Conversation</h3>
          <div className="flex items-center space-x-2">
            {speechSupported && isActive ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-600">Agent Mic Active</span>
              </div>
            ) : speechSupported ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Speech Recognition Ready</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Manual Input Mode</span>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Session: {sessionId.substring(0, 8)}...
        </p>
        {speechSupported && (
          <div className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded">
            🎙️ <strong>Agent speech:</strong> Auto-captured via microphone<br/>
            👤 <strong>Customer speech:</strong> Use manual input below (browser limitation)
          </div>
        )}
      </div>

      <div 
        ref={scrollContainerRef}
        className="h-64 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {conversation?.segments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">🎙️</div>
            <p className="text-gray-500 text-sm">Waiting for conversation to start...</p>
          </div>
        ) : (
          conversation?.segments.map((segment: any) => (
            <div
              key={segment.id}
              className={`p-3 rounded-lg ${getSpeakerColor(segment.speaker)} ${
                segment.isPartial ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-start space-x-2">
                <span className="text-lg">{getSpeakerIcon(segment.speaker)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {segment.speaker}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(segment.timestamp)}
                    </span>
                  </div>
                  <p className={`text-sm text-gray-800 ${segment.isPartial ? 'italic' : ''}`}>
                    {segment.text}
                    {segment.isPartial && <span className="animate-pulse">...</span>}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-blue-400 h-1 rounded-full" 
                          style={{ width: `${segment.confidence * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(segment.confidence * 100)}%
                      </span>
                    </div>
                    {segment.isPartial && (
                      <span className="text-xs text-orange-500 font-medium">Partial</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {conversation && conversation.segments.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mt-4">
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {conversation.segments.filter((s: any) => s.speaker === 'customer' && !s.isPartial).length} customer messages
            </span>
            <span>
              {conversation.segments.filter((s: any) => s.speaker === 'agent' && !s.isPartial).length} agent responses
            </span>
          </div>
        </div>
      )}

      {/* Manual input section */}
      <div className="mt-4">
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={() => setSelectedSpeaker('agent')}
            className={`px-3 py-1 text-xs rounded-full font-medium ${
              selectedSpeaker === 'agent' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Agent
          </button>
          <button
            onClick={() => setSelectedSpeaker('customer')}
            className={`px-3 py-1 text-xs rounded-full font-medium ${
              selectedSpeaker === 'customer' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Customer
          </button>
        </div>
        <div className="flex">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-3 py-2 text-sm border rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Type your message here..."
          />
          <button
            onClick={handleManualInput}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-r-md hover:bg-blue-600 transition"
          >
            Send
          </button>
        </div>
        {!speechSupported && (
          <p className="text-xs text-red-500 mt-2">
            Speech recognition is not supported in this browser. Please use manual input.
          </p>
        )}
      </div>
    </Card>
  );
};

export default ConversationHistory;
