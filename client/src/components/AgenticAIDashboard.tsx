import React, { useState, useEffect } from 'react';
import { Card } from './shared';
import ConversationHistory from './ConversationHistory';
import { transcriptionService } from '../services/transcription';
import { aiAnalysisService, type AIAnalysisResult } from '../services/ai-analysis';
import { agenticAIService, type AgenticContext, type AgenticAction } from '../services/agentic-ai';

interface AIDashboardProps {
  sessionId: string;
  isCallActive: boolean;
  customerName?: string;
  onActionExecute?: (actionId: string, approved: boolean) => void;
}

const AgenticAIDashboard: React.FC<AIDashboardProps> = ({ 
  sessionId, 
  isCallActive 
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [agenticContext, setAgenticContext] = useState<AgenticContext | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());

  // Listen for transcription updates and run AI analysis + agentic processing
  useEffect(() => {
    if (!isCallActive || !sessionId) {
      setAiAnalysis(null);
      setAgenticContext(null);
      aiAnalysisService.reset();
      agenticAIService.reset();
      return;
    }

    const handleTranscriptionUpdate = async () => {
      const conversation = transcriptionService.getConversationHistory(sessionId);
      if (conversation && conversation.segments.length > 0) {
        // Run traditional AI analysis
        const analysis = aiAnalysisService.analyzeConversation(conversation);
        setAiAnalysis(analysis);

        // Run agentic AI analysis for actionable insights
        const agenticAnalysis = await agenticAIService.analyzeForActions(conversation, analysis.insights);
        setAgenticContext(agenticAnalysis);
        
        setLastUpdate(Date.now());
      }
    };

    // Initial analysis if conversation already exists
    handleTranscriptionUpdate();

    // Listen for new transcription updates
    window.addEventListener('transcription-update', handleTranscriptionUpdate);

    return () => {
      window.removeEventListener('transcription-update', handleTranscriptionUpdate);
    };
  }, [sessionId, isCallActive]);

  const handleActionApproval = async (action: AgenticAction, approved: boolean) => {
    if (!approved) {
      agenticAIService.rejectAction(action.id, 'Agent rejected');
      // Refresh context
      const updatedContext = agenticAIService.getContext();
      setAgenticContext(updatedContext);
      return;
    }

    setExecutingActions(prev => new Set([...prev, action.id]));
    
    try {
      await agenticAIService.approveAction(action.id);
      // Refresh context after execution
      const updatedContext = agenticAIService.getContext();
      setAgenticContext(updatedContext);
    } catch (error) {
      console.error('Failed to execute action:', error);
    } finally {
      setExecutingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(action.id);
        return newSet;
      });
    }
  };

  const getActionIcon = (action: AgenticAction) => {
    switch (action.type) {
      case 'lookup': return '🔍';
      case 'modify': return '✏️';
      case 'create': return '➕';
      case 'communicate': return '📧';
      case 'escalate': return '⬆️';
      case 'recommend': return '💡';
      default: return '⚡';
    }
  };

  const getActionColor = (action: AgenticAction) => {
    switch (action.impact) {
      case 'high': return 'border-red-400 bg-red-50';
      case 'medium': return 'border-yellow-400 bg-yellow-50';
      case 'low': return 'border-green-400 bg-green-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };

  const getStatusColor = (status: AgenticAction['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isCallActive) {
    return (
      <div className="space-y-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">🤖 Agentic AI Ready</h2>
          <p className="text-gray-500">
            AI agents will assist with real-time actions during active calls
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agentic Actions Panel */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          🤖 AI Agent Actions
          {lastUpdate > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago
            </span>
          )}
        </h3>

        {/* Customer Context */}
        {agenticContext?.customerProfile && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">👤 Customer Profile</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>Name:</strong> {agenticContext.customerProfile.name}</div>
              <div><strong>Tier:</strong> {agenticContext.customerProfile.tierLevel}</div>
              <div><strong>Status:</strong> {agenticContext.customerProfile.accountStatus}</div>
              <div><strong>LTV:</strong> ${agenticContext.customerProfile.lifetimeValue}</div>
            </div>
          </div>
        )}

        {/* Active Orders */}
        {agenticContext?.activeOrders && agenticContext.activeOrders.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-900 mb-2">📦 Recent Orders</h4>
            {agenticContext.activeOrders.map((order) => (
              <div key={order.id} className="text-sm mb-2 last:mb-0">
                <div className="flex justify-between">
                  <span><strong>#{order.id}</strong> - {order.status}</span>
                  <span>${order.total}</span>
                </div>
                <div className="text-gray-600">
                  {order.items.map(item => item.name).join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suggested Actions */}
        {agenticContext?.suggestedActions && agenticContext.suggestedActions.length > 0 ? (
          <div className="space-y-3">
            {agenticContext.suggestedActions.slice(-5).map((action) => (
              <div 
                key={action.id}
                className={`p-3 rounded-lg border-2 ${getActionColor(action)}`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-xl">{getActionIcon(action)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{action.description}</h5>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <span>Tool: {action.tool}</span>
                      <span>Confidence: {Math.round(action.confidence * 100)}%</span>
                      <span>Impact: {action.impact}</span>
                    </div>

                    {/* Action Results */}
                    {action.result && action.status === 'completed' && (
                      <div className="mb-3 p-2 bg-white rounded border">
                        <div className="text-sm font-medium text-gray-700 mb-1">Result:</div>
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(action.result, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {action.status === 'pending' && action.requiresAgentApproval && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleActionApproval(action, true)}
                          disabled={executingActions.has(action.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {executingActions.has(action.id) ? 'Executing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleActionApproval(action, false)}
                          disabled={executingActions.has(action.id)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {action.status === 'completed' && (
                      <div className="text-green-600 text-sm font-medium">
                        ✅ Action completed successfully
                      </div>
                    )}

                    {action.status === 'failed' && (
                      <div className="text-red-600 text-sm font-medium">
                        ❌ Action failed: {action.result?.error || 'Unknown error'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No agentic actions suggested yet - continue the conversation</p>
        )}
      </Card>

      {/* Traditional AI Insights (condensed) */}
      {aiAnalysis?.insights && aiAnalysis.insights.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔮 Oracle Insights</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {aiAnalysis.insights.slice(-3).map((insight, index) => (
              <div key={`${insight.timestamp}-${index}`} className="text-sm p-2 bg-gray-50 rounded">
                <span className="font-medium">{insight.type}:</span> {insight.message}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Conversation Metrics (condensed) */}
      {aiAnalysis?.metrics && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Metrics</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="font-bold text-blue-600">
                {Math.floor(aiAnalysis.metrics.duration / 60000)}:{String(Math.floor((aiAnalysis.metrics.duration % 60000) / 1000)).padStart(2, '0')}
              </div>
              <div className="text-blue-600">Duration</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="font-bold text-green-600">{aiAnalysis.metrics.wordCount}</div>
              <div className="text-green-600">Words</div>
            </div>
          </div>
        </Card>
      )}

      {/* Conversation History */}
      <ConversationHistory 
        sessionId={sessionId}
        isActive={isCallActive}
        className="border-t pt-6"
      />
    </div>
  );
};

export default AgenticAIDashboard;
