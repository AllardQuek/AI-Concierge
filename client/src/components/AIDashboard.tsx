import React, { useState, useEffect } from 'react';
import { Card } from './shared';
import ConversationHistory from './ConversationHistory';
import { transcriptionService } from '../services/transcription';

// Simplified AI Dashboard with mock data for Phase 1
interface AIInsight {
  id: string;
  timestamp: number;
  speaker: 'customer' | 'agent';
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'frustrated';
  confidence: number;
}

interface AgentAction {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  requiresApproval: boolean;
  suggestedResponse?: string;
}

interface ConversationContext {
  emotionalState: 'neutral' | 'satisfied' | 'frustrated';
  currentTopic?: string;
  resolutionStatus: string;
}

interface AIDashboardProps {
  sessionId: string;
  isCallActive: boolean;
  customerName?: string;
  onActionExecute?: (actionId: string, approved: boolean) => void;
}

const AIDashboard: React.FC<AIDashboardProps> = ({ 
  sessionId, 
  isCallActive, 
  customerName = "Customer",
  onActionExecute 
}) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [pendingActions, setPendingActions] = useState<AgentAction[]>([]);
  const [context, setContext] = useState<ConversationContext>({
    emotionalState: 'neutral',
    resolutionStatus: 'in-progress'
  });

  // Enhanced AI insights based on conversation
  useEffect(() => {
    if (!isCallActive || !sessionId) return;

    const updateInsights = () => {
      const summary = transcriptionService.getConversationSummary(sessionId);
      if (summary) {
        // Generate AI insights based on conversation data
        const newInsights: AIInsight[] = [];

        if (summary.lastCustomerMessage) {
          newInsights.push({
            id: `insight-${Date.now()}-1`,
            timestamp: Date.now(),
            speaker: 'customer',
            text: summary.lastCustomerMessage,
            sentiment: summary.customerMessages > 3 ? 'frustrated' : 'neutral',
            confidence: 0.87
          });
        }

        if (summary.lastAgentMessage) {
          newInsights.push({
            id: `insight-${Date.now()}-2`,
            timestamp: Date.now(),
            speaker: 'agent',
            text: summary.lastAgentMessage,
            sentiment: 'positive',
            confidence: 0.92
          });
        }

        setInsights(newInsights);

        // Update context based on conversation
        setContext({
          emotionalState: summary.customerMessages > 5 ? 'frustrated' : 'neutral',
          currentTopic: 'Account Access Issues',
          resolutionStatus: summary.agentMessages > summary.customerMessages ? 'resolving' : 'in-progress'
        });
      }
    };

    // Subscribe to transcription updates
    const unsubscribe = transcriptionService.onTranscriptionUpdate(() => {
      updateInsights();
    });

    // Initial update
    updateInsights();

    return unsubscribe;
  }, [isCallActive, sessionId]);

  const handleActionApproval = (actionId: string, approved: boolean) => {
    if (onActionExecute) {
      onActionExecute(actionId, approved);
    }
    
    // Remove action from pending list
    setPendingActions(prev => prev.filter(action => action.id !== actionId));
  };

  const formatTimestamp = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      case 'frustrated': return 'text-red-600';
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
      <Card className="mt-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🤖</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Sybil AI Assistant</h3>
          <p className="text-gray-500">AI insights will appear when a call is active</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* AI Status Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Sybil AI Assistant</h3>
              <p className="text-sm text-gray-500">Analyzing conversation...</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm">Active</span>
          </div>
        </div>
      </Card>

      {/* Conversation Context */}
      <Card>
        <h4 className="font-medium text-gray-800 mb-3">Conversation Context</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Customer State</label>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getEmotionalStateColor(context.emotionalState)}`}>
              {context.emotionalState}
            </div>
          </div>
          {context.currentTopic && (
            <div>
              <label className="text-sm text-gray-600 block mb-1">Current Topic</label>
              <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {context.currentTopic}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <Card>
          <h4 className="font-medium text-gray-800 mb-3">Suggested Actions</h4>
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div key={action.id} className={`border-l-4 p-3 rounded-r-lg ${getPriorityColor(action.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-800">{action.title}</h5>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                    {action.suggestedResponse && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm italic">
                        "{action.suggestedResponse}"
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleActionApproval(action.id, true)}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleActionApproval(action.id, false)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Real-time Insights */}
      <Card>
        <h4 className="font-medium text-gray-800 mb-3">Live Conversation Analysis</h4>
        {insights.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Listening for conversation...</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {insights.map((insight) => (
              <div key={insight.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                <div className="flex-shrink-0">
                  <span className={`inline-block w-3 h-3 rounded-full mt-1 ${
                    insight.speaker === 'customer' ? 'bg-blue-500' : 'bg-green-500'
                  }`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {insight.speaker}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(insight.timestamp)}
                    </span>
                    <span className={`text-xs font-medium ${getSentimentColor(insight.sentiment)}`}>
                      {insight.sentiment}
                    </span>
                    <span className="text-xs text-gray-400">
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Conversation History - Phase 2 Feature */}
      <ConversationHistory 
        sessionId={sessionId} 
        isActive={isCallActive}
        className="mb-6"
      />
    </div>
  );
};

export default AIDashboard;
