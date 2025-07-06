import React from 'react';

interface StatusIndicatorProps {
  isConnected: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isConnected }) => (
  <div className={`flex items-center justify-center p-3 rounded-lg border ${
    isConnected 
      ? 'bg-green-50 border-green-200' 
      : 'bg-orange-50 border-orange-200'
  }`}>
    <div className={`w-2 h-2 rounded-full mr-2 ${
      isConnected 
        ? 'bg-green-500 animate-pulse' 
        : 'bg-orange-500'
    }`}></div>
    <span className={`text-sm font-medium ${
      isConnected 
        ? 'text-green-700' 
        : 'text-orange-700'
    }`}>
      {isConnected 
        ? '📶 Available for calls' 
        : '⏳ Connecting...'}
    </span>
  </div>
);

export default StatusIndicator; 