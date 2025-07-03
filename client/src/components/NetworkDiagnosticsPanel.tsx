import React, { useState, useEffect } from 'react';
import { webrtcService } from '../services/webrtc';

interface NetworkDiagnosticsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

interface NetworkSummary {
  networkType: string;
  localCandidates: number;
  remoteCandidates: number;
  connectionAttempts: number;
  lastFailure: string;
  hasRelayCandidates: boolean;
}

export const NetworkDiagnosticsPanel: React.FC<NetworkDiagnosticsPanelProps> = ({ 
  isVisible, 
  onClose 
}) => {
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [connectionStats, setConnectionStats] = useState<any>(null);

  useEffect(() => {
    if (isVisible) {
      updateSummary();
      const interval = setInterval(updateSummary, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const updateSummary = () => {
    const networkSummary = webrtcService.getNetworkSummary();
    setSummary(networkSummary);
  };

  const runFullDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      await webrtcService.runDiagnostics();
      const stats = await webrtcService.getConnectionStats();
      setConnectionStats(stats);
      updateSummary();
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const getStatusColor = (hasRelay: boolean, localCount: number): string => {
    if (hasRelay) return 'text-green-600';
    if (localCount > 1) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (hasRelay: boolean, localCount: number): string => {
    if (hasRelay) return '✅';
    if (localCount > 1) return '⚠️';
    return '❌';
  };

  const getNetworkTypeIcon = (type: string): string => {
    switch (type) {
      case '4g':
      case '3g':
      case '2g': return '📱';
      case 'wifi': return '📶';
      case 'ethernet': return '🔌';
      default: return '🌐';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              🔍
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Network Diagnostics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Network Overview */}
          {summary && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Connection Status</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Network Type */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getNetworkTypeIcon(summary.networkType)}</span>
                    <span className="font-medium">Network Type</span>
                  </div>
                  <p className="text-lg capitalize text-gray-700">
                    {summary.networkType || 'Unknown'}
                  </p>
                </div>

                {/* Connection Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {getStatusIcon(summary.hasRelayCandidates, summary.localCandidates)}
                    </span>
                    <span className="font-medium">Cross-Network Ready</span>
                  </div>
                  <p className={`text-lg font-medium ${getStatusColor(summary.hasRelayCandidates, summary.localCandidates)}`}>
                    {summary.hasRelayCandidates ? 'Yes (TURN Available)' : 
                     summary.localCandidates > 1 ? 'Maybe (STUN Only)' : 
                     'No (HOST Only)'}
                  </p>
                </div>

                {/* Local Candidates */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📍</span>
                    <span className="font-medium">Local Candidates</span>
                  </div>
                  <p className="text-lg text-gray-700">{summary.localCandidates}</p>
                </div>

                {/* Remote Candidates */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📡</span>
                    <span className="font-medium">Remote Candidates</span>
                  </div>
                  <p className="text-lg text-gray-700">{summary.remoteCandidates}</p>
                </div>
              </div>

              {/* Connection Attempts & Failures */}
              {(summary.connectionAttempts > 0 || summary.lastFailure) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Connection History</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Connection attempts: {summary.connectionAttempts}</p>
                    {summary.lastFailure && (
                      <p className="text-red-600">Last failure: {summary.lastFailure}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Stats */}
          {connectionStats && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Connection Details</h3>
              
              {connectionStats.candidates && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">ICE Candidates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Local:</p>
                      {connectionStats.candidates.local.map((candidate: any, idx: number) => (
                        <div key={idx} className="mb-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {candidate.type.toUpperCase()}
                          </span>
                          <span className="ml-2 text-gray-600">
                            {candidate.protocol} {candidate.address}:{candidate.port}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Remote:</p>
                      {connectionStats.candidates.remote.map((candidate: any, idx: number) => (
                        <div key={idx} className="mb-1">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            {candidate.type.toUpperCase()}
                          </span>
                          <span className="ml-2 text-gray-600">
                            {candidate.protocol} {candidate.address}:{candidate.port}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Active Connection Pairs */}
              {connectionStats.candidates?.pairs?.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">✅ Active Connection Pairs</h4>
                  <p className="text-sm text-green-700">
                    {connectionStats.candidates.pairs.length} successful connection(s) established
                  </p>
                </div>
              )}

              {/* Connection Quality */}
              {(connectionStats.inbound || connectionStats.outbound) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Connection Quality</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {connectionStats.inbound && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Incoming Audio:</p>
                        <p>Packets received: {connectionStats.inbound.packetsReceived || 0}</p>
                        <p>Packets lost: {connectionStats.inbound.packetsLost || 0}</p>
                        <p>Jitter: {(connectionStats.inbound.jitter || 0).toFixed(3)}s</p>
                      </div>
                    )}
                    {connectionStats.outbound && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Outgoing Audio:</p>
                        <p>Packets sent: {connectionStats.outbound.packetsSent || 0}</p>
                        <p>Bytes sent: {connectionStats.outbound.bytesSent || 0}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={runFullDiagnostics}
              disabled={isRunningDiagnostics}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunningDiagnostics ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Running Diagnostics...
                </span>
              ) : (
                'Run Full Diagnostics'
              )}
            </button>
            
            <button
              onClick={() => {
                webrtcService.resetDiagnostics();
                updateSummary();
                setConnectionStats(null);
              }}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset Counters
            </button>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 Troubleshooting Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Green status:</strong> TURN servers available - calls should work across any network</li>
              <li>• <strong>Yellow status:</strong> Only STUN available - may fail with strict firewalls</li>
              <li>• <strong>Red status:</strong> Only local candidates - will fail across different networks</li>
              <li>• Check the browser console for detailed WebRTC logs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
