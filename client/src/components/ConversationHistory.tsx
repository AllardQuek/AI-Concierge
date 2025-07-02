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
  const [isListening, setIsListening] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId || !isActive) {
      setConversation(null);
      setIsListening(false);
      return;
    }

    // Start transcription session
    transcriptionService.startSession(sessionId);
    setIsListening(true);

    // Subscribe to transcription updates
    const unsubscribe = transcriptionService.onTranscriptionUpdate(({ sessionId: updateSessionId, conversation: updatedConversation }) => {
      if (updateSessionId === sessionId) {
        setConversation(updatedConversation);
      }
    });

    // Start mock simulation for demo
    setTimeout(() => {
      transcriptionService.startMockSimulation(sessionId);
    }, 2000);

    return () => {
      unsubscribe();
      transcriptionService.endSession(sessionId);
      setIsListening(false);
    };
  }, [sessionId, isActive]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [conversation?.segments]);

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
            {isListening && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-600">Recording</span>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Session: {sessionId.substring(0, 8)}...
        </p>
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
    </Card>
  );
};

export default ConversationHistory;
