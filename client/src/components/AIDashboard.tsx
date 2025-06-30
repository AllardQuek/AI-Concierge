import React, { useState, useEffect, useRef } from 'react';
import { SocketService } from '../services/socket';

// AI Dashboard Component for Agent Interface
interface AIInsight {
  id: string;
  timestamp: number;
  speaker: 'customer' | 'agent';
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  entities?: { type: string; value: string; confidence: number }[];
  intent?: { intent: string; confidence: number };
}

interface AgentAction {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  requiresApproval: boolean;
  suggestedResponse?: string;
  payload?: any;
}

interface ConversationContext {
  emotionalState: 'neutral' | 'satisfied' | 'frustrated';
  currentTopic?: string;
  issues: string[];
  resolutionStatus: string;
}

interface AIDashboardProps {
  sessionId: string;
  isCallActive: boolean;
  onActionExecute?: (actionId: string, approved: boolean) => void;
}

const AIDashboard: React.FC<AIDashboardProps> = ({ 
  sessionId, 
  isCallActive, 
  onActionExecute 
}) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [pendingActions, setPendingActions] = useState<AgentAction[]>([]);
  const [context, setContext] = useState<ConversationContext>({
    emotionalState: 'neutral',
    issues: [],
    resolutionStatus: 'in-progress'
  });
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<SocketService | null>(null);

  useEffect(() => {
    if (isCallActive && sessionId) {
      initializeAIService();
    }
    
    return () => {
      cleanup();
    };
  }, [sessionId, isCallActive]);

  const initializeAIService = async () => {
    try {
      socketRef.current = new SocketService('http://localhost:5001'); // AI service port
      await socketRef.current.connect();
      setIsConnected(true);
      
      setupAIListeners();
      
      // Start AI session
      socketRef.current.emit('ai-session-start', {
        sessionId,
        agentId: 'agent-' + Date.now(),
        customerName: 'Customer' // This should come from your app state
      });
      
    } catch (error) {
      console.error('Failed to connect to AI service:', error);
      setIsConnected(false);
    }
  };

  const setupAIListeners = () => {
    if (!socketRef.current) return;

    socketRef.current.on('ai-session-ready', (data) => {
      console.log('AI session ready:', data);
    });

    socketRef.current.on('ai-insight', (data) => {
      const { insight, actions, context: newContext } = data;
      
      setInsights(prev => [...prev, insight].slice(-20)); // Keep last 20 insights
      setContext(newContext);
      
      if (actions && actions.length > 0) {
        setPendingActions(prev => [...prev, ...actions]);
      }
    });

    socketRef.current.on('action-executed', (data) => {
      const { actionId } = data;
      setPendingActions(prev => prev.filter(action => action.id !== actionId));
    });

    socketRef.current.on('action-declined', (data) => {
      const { actionId } = data;
      setPendingActions(prev => prev.filter(action => action.id !== actionId));
    });
  };

  const handleActionResponse = (actionId: string, approved: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('execute-action', {
        sessionId,
        actionId,
        approved
      });
    }
    
    onActionExecute?.(actionId, approved);
  };

  const cleanup = () => {
    if (socketRef.current) {
      socketRef.current.emit('ai-session-end', { sessionId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setInsights([]);
    setPendingActions([]);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getEmotionalStateColor = (state: string) => {
    switch (state) {
      case 'satisfied': return 'bg-green-100 text-green-800';
      case 'frustrated': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  if (!isCallActive) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-gray-500 text-center">AI insights will appear when call is active</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border">
        <h3 className="font-semibold text-gray-800">Sybil AI Assistant</h3>
        <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Conversation Context */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h4 className="font-medium text-gray-800 mb-3">Conversation Context</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Customer State</label>
            <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getEmotionalStateColor(context.emotionalState)}`}>
              {context.emotionalState}
            </div>
          </div>
          {context.currentTopic && (
            <div>
              <label className="text-sm text-gray-600">Current Topic</label>
              <p className="text-sm font-medium text-gray-800">{context.currentTopic}</p>
            </div>
          )}
        </div>
        {context.issues.length > 0 && (
          <div className="mt-3">
            <label className="text-sm text-gray-600">Identified Issues</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {context.issues.map((issue, index) => (
                <span key={index} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                  {issue}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h4 className="font-medium text-gray-800 mb-3">
            Suggested Actions ({pendingActions.length})
          </h4>
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div key={action.id} className={`p-3 border-l-4 rounded ${getPriorityColor(action.priority)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-800">{action.title}</h5>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                    {action.suggestedResponse && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <strong>Suggested response:</strong> "{action.suggestedResponse}"
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleActionResponse(action.id, true)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleActionResponse(action.id, false)}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Insights */}
      <div className="bg-white p-4 rounded-lg shadow-sm border max-h-96 overflow-y-auto">
        <h4 className="font-medium text-gray-800 mb-3">Live Conversation Analysis</h4>
        {insights.length === 0 ? (
          <p className="text-gray-500 text-sm">Listening for conversation...</p>
        ) : (
          <div className="space-y-2">
            {insights.slice(-10).map((insight) => (
              <div key={insight.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                <div className="flex-shrink-0">
                  <span className={`inline-block w-2 h-2 rounded-full mt-2 ${
                    insight.speaker === 'customer' ? 'bg-blue-500' : 'bg-green-500'
                  }`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {insight.speaker}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(insight.timestamp)}
                    </span>
                    <span className={`text-xs ${getSentimentColor(insight.sentiment)}`}>
                      {insight.sentiment}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1">{insight.text}</p>
                  
                  {insight.entities && insight.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {insight.entities.map((entity, index) => (
                        <span key={index} className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          {entity.type}: {entity.value}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {insight.intent && (
                    <div className="mt-1">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                        Intent: {insight.intent.intent}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIDashboard;
