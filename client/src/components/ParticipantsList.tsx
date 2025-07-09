import React from 'react';

interface Participant {
  identity: string;
  isBot: boolean;
}

interface ParticipantsListProps {
  participants: Participant[];
  className?: string;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ participants, className = '' }) => {
  if (participants.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-700">👥 In Call</span>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          {participants.length}
        </span>
      </div>
      
      <div className="space-y-1">
        {participants.map((participant, index) => (
          <div
            key={`${participant.identity}-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <div className="flex items-center gap-1">
              {participant.isBot ? (
                <span className="text-purple-600">🤖</span>
              ) : (
                <span className="text-green-600">👤</span>
              )}
              <span className={`font-mono text-xs ${
                participant.isBot 
                  ? 'text-purple-700 font-semibold' 
                  : 'text-gray-700'
              }`}>
                {participant.isBot ? (
                  <span className="flex items-center gap-1">
                    <span className="text-purple-600">✨</span>
                    Mulisa AI Oracle
                  </span>
                ) : (
                  participant.identity
                )}
              </span>
            </div>
            
            {/* Connection indicator */}
            <div className="flex items-center ml-auto">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
      
      {participants.some(p => p.isBot) && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-purple-600 italic">
            ✨ AI Oracle is providing wisdom and insights
          </p>
        </div>
      )}
    </div>
  );
};

export default ParticipantsList;
