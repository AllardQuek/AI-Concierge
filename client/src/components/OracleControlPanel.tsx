import React, { useState, useEffect } from 'react';
import { MulisaOracleService, OracleWisdom } from '../services/mulisa-oracle-service';

interface OracleControlPanelProps {
  isVisible: boolean;
  onClose: () => void;
  roomId: string;
  participantName: string;
  inline?: boolean;
  className?: string;
}

const OracleControlPanel: React.FC<OracleControlPanelProps> = ({
  isVisible,
  onClose,
  roomId,
  participantName,
  inline = false,
  className = '',
}) => {
  const [oracleService] = useState(() => new MulisaOracleService());
  const [isOracleActive, setIsOracleActive] = useState(false);
  const [currentWisdom, setCurrentWisdom] = useState<OracleWisdom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wisdomHistory, setWisdomHistory] = useState<OracleWisdom[]>([]);

  useEffect(() => {
    if (!isVisible) return;

    const handleWisdomUpdate = (event: CustomEvent<OracleWisdom>) => {
      const wisdom = event.detail;
      setCurrentWisdom(wisdom);
      setWisdomHistory(prev => [...prev, wisdom].slice(-5)); // Keep last 5 wisdom messages
    };

    window.addEventListener('oracle-wisdom-update', handleWisdomUpdate as EventListener);
    
    return () => {
      window.removeEventListener('oracle-wisdom-update', handleWisdomUpdate as EventListener);
    };
  }, [isVisible]);

  const handleSummonOracle = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await oracleService.inviteOracle(roomId, participantName);
      
      if (result.success) {
        setIsOracleActive(true);
        // Start polling for wisdom
        oracleService.startWisdomPolling(roomId);
      } else {
        setError(result.error || 'Failed to summon Oracle');
      }
    } catch (err) {
      setError('Connection error while summoning Oracle');
      console.error('Oracle summoning error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissOracle = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await oracleService.dismissOracle(roomId);
      setIsOracleActive(false);
      setCurrentWisdom(null);
      oracleService.stopWisdomPolling();
    } catch (err) {
      setError('Failed to dismiss Oracle');
      console.error('Oracle dismissal error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getWisdomTypeIcon = (type: string): string => {
    switch (type) {
      case 'insight': return '🔮';
      case 'guidance': return '🌟';
      case 'prophecy': return '✨';
      case 'warning': return '⚠️';
      default: return '🔮';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isVisible) return null;

  const content = (
    <div className="bg-gradient-to-b from-purple-900 to-indigo-900 text-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔮</span>
          <h3 className="text-lg font-bold">Oracle of Mulisa</h3>
          {isOracleActive && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-300">Active</span>
            </div>
          )}
        </div>
        {!inline && (
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white p-1 rounded"
          >
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Oracle Status and Controls */}
        <div className="text-center space-y-3">
          {!isOracleActive ? (
            <div>
              <p className="text-purple-200 text-sm mb-3">
                Summon the Oracle for mystical wisdom and insights during your conversation.
              </p>
              <button
                onClick={handleSummonOracle}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Summoning Oracle...
                  </>
                ) : (
                  <>
                    ✨ Summon Oracle
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-purple-200 text-sm mb-3">
                The Oracle is listening and will provide wisdom as your conversation unfolds.
              </p>
              <button
                onClick={handleDismissOracle}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Dismissing...
                  </>
                ) : (
                  <>
                    🌙 Dismiss Oracle
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Current Wisdom Display */}
        {currentWisdom && (
          <div className="bg-purple-800/50 border border-purple-600/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">
                {getWisdomTypeIcon(currentWisdom.type)}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-300 text-sm font-medium capitalize">
                    {currentWisdom.type}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${getConfidenceColor(currentWisdom.confidence)}`}>
                      {Math.round(currentWisdom.confidence * 100)}% confidence
                    </span>
                    <span className="text-purple-400">
                      {formatTimestamp(currentWisdom.timestamp)}
                    </span>
                  </div>
                </div>
                <p className="text-white text-sm leading-relaxed">
                  {currentWisdom.content}
                </p>
                {currentWisdom.context && (
                  <div className="mt-2 text-xs text-purple-300">
                    <span className="italic">Context: {currentWisdom.context}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wisdom History */}
        {wisdomHistory.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-purple-300">Recent Oracle Insights</h4>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {wisdomHistory.slice(-4, -1).reverse().map((wisdom, index) => (
                <div
                  key={`${wisdom.timestamp}-${index}`}
                  className="bg-purple-800/30 border border-purple-700/30 rounded p-2 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getWisdomTypeIcon(wisdom.type)}</span>
                    <span className="text-purple-300 capitalize">{wisdom.type}</span>
                    <span className="text-purple-400 ml-auto">
                      {formatTimestamp(wisdom.timestamp)}
                    </span>
                  </div>
                  <p className="text-purple-100 leading-relaxed">
                    {wisdom.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Oracle Status Info */}
        {isOracleActive && !currentWisdom && (
          <div className="text-center py-4">
            <div className="w-8 h-8 mx-auto mb-2 relative">
              <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-lg">🔮</span>
              </div>
            </div>
            <p className="text-purple-300 text-sm">
              Oracle is listening... wisdom will appear as your conversation develops.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full max-h-screen overflow-y-auto">
        {content}
      </div>
    </div>
  );
};

export default OracleControlPanel;
