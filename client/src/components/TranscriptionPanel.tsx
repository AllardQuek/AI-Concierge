import React, { useState, useEffect } from 'react';
import { TranscriptionResult } from '../services/types';

interface TranscriptionPanelProps {
  isVisible: boolean;
  onClose: () => void;
  transcripts?: TranscriptionResult[];
  inline?: boolean;
}

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ isVisible, onClose, transcripts: propTranscripts = [], inline = false }) => {
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const transcripts = propTranscripts || [];

  useEffect(() => {
    if (isAutoScroll && transcripts.length > 0) {
      const transcriptContainer = document.getElementById('transcript-container');
      if (transcriptContainer) {
        transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
      }
    }
  }, [transcripts, isAutoScroll]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getSpeakerColor = (speaker: string): string => {
    // Use a hash of the speaker string to get consistent colors
    const hash = speaker.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colors = [
      'text-blue-600',
      'text-green-600', 
      'text-purple-600',
      'text-orange-600',
      'text-red-600',
      'text-indigo-600'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.8) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!isVisible) return null;

  // Inline mode: render as a card/section
  if (inline) {
    return (
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            📝 Live Transcription
          </h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span>Auto-scroll</span>
            </label>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Transcript Container */}
        <div 
          id="transcript-container"
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 max-h-64"
        >
          {transcripts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">🎤</div>
              <p>Waiting for speech...</p>
              <p className="text-sm">Start talking to see live transcription</p>
            </div>
          ) : (
            transcripts.map((transcript) => (
              <div
                key={transcript.id}
                className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`font-semibold ${getSpeakerColor(transcript.speaker)}`}>
                        {transcript.speaker}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(transcript.timestamp)}
                      </span>
                      <span className={`text-xs ${getConfidenceColor(transcript.confidence)}`}>
                        {Math.round(transcript.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-gray-800 leading-relaxed">
                      {transcript.text}
                    </p>
                  </div>
                  {!transcript.isFinal && (
                    <div className="ml-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              {/* Dynamic speaker labels will be shown based on actual participants */}
            </div>
            <div className="text-right">
              <p>{transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}</p>
              <p className="text-xs">
                {transcripts.length > 0 && formatTimestamp(transcripts[0].timestamp)} - {transcripts.length > 0 && formatTimestamp(transcripts[transcripts.length - 1].timestamp)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal overlay (default)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            📝 Live Transcription
          </h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span>Auto-scroll</span>
            </label>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Transcript Container */}
        <div 
          id="transcript-container"
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
        >
          {transcripts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">🎤</div>
              <p>Waiting for speech...</p>
              <p className="text-sm">Start talking to see live transcription</p>
            </div>
          ) : (
            transcripts.map((transcript) => (
              <div
                key={transcript.id}
                className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`font-semibold ${getSpeakerColor(transcript.speaker)}`}>
                        {transcript.speaker}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(transcript.timestamp)}
                      </span>
                      <span className={`text-xs ${getConfidenceColor(transcript.confidence)}`}>
                        {Math.round(transcript.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-gray-800 leading-relaxed">
                      {transcript.text}
                    </p>
                  </div>
                  {!transcript.isFinal && (
                    <div className="ml-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              {/* Dynamic speaker labels will be shown based on actual participants */}
            </div>
            <div className="text-right">
              <p>{transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}</p>
              <p className="text-xs">
                {transcripts.length > 0 && formatTimestamp(transcripts[0].timestamp)} - {transcripts.length > 0 && formatTimestamp(transcripts[transcripts.length - 1].timestamp)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranscriptionPanel; 