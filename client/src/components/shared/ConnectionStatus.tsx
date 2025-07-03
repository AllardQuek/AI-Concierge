import React from 'react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  connectionState, 
  className = "" 
}) => {
  return (
    <div className={`flex items-center space-x-2 ${
      connectionState === 'connected' ? 'text-green-600' : 
      connectionState === 'connecting' ? 'text-yellow-600' : 'text-red-600'
    } ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionState === 'connected' ? 'bg-green-500' : 
        connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500 animate-pulse'
      }`}></div>
      <span className="text-sm">
        {connectionState === 'connected' ? 'Connected' : 
         connectionState === 'connecting' ? 'Connecting...' : 'Connection Lost'}
      </span>
    </div>
  );
};
