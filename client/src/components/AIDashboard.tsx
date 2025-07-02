import React, { useState, useEffect } from 'react';
import { Card } from './shared';
import ConversationHistory from './ConversationHistory';
import { transcriptionService } from '../services/transcription';
import { aiAnalysisService, type AIAnalysisResult, type ConversationInsight } from '../services/ai-analysis';

interface AIDashboardProps {
  sessionId: string;
  isCallActive: boolean;
  customerName?: string; // Reserved for future customer personalization
  onActionExecute?: (actionId: string, approved: boolean) => void;
}

const AIDashboard: React.FC<AIDashboardProps> = ({ 
  sessionId, 
  isCallActive 
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Listen for transcription updates and run AI analysis
  useEffect(() => {
    if (!isCallActive || !sessionId) {
      setAiAnalysis(null);
      aiAnalysisService.reset();
      return;
    }

    const handleTranscriptionUpdate = () => {
      const conversation = transcriptionService.getConversationHistory(sessionId);
      if (conversation && conversation.segments.length > 0) {
        const analysis = aiAnalysisService.analyzeConversation(conversation);
        setAiAnalysis(analysis);
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

  const getInsightIcon = (type: ConversationInsight['type']) => {
    switch (type) {
      case 'sentiment': return '😊';
      case 'intent': return '🎯';
      case 'action_required': return '📋';
      case 'escalation': return '⚠️';
      case 'summary': return '📝';
      default: return '💡';
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!isCallActive) {
    return (
      <div className="space-y-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">AI Assistant Ready</h2>
          <p className="text-gray-500">
            Oracle insights will appear here during active calls
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          🔮 Oracle Insights
          {lastUpdate > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago
            </span>
          )}
        </h3>
        
        {aiAnalysis?.insights && aiAnalysis.insights.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {aiAnalysis.insights.slice(-5).map((insight, index) => (
              <div 
                key={`${insight.timestamp}-${index}`}
                className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-lg">{getInsightIcon(insight.type)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{insight.message}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs opacity-75">
                        Confidence: {Math.round(insight.confidence * 100)}%
                      </span>
                      <span className="text-xs opacity-75">
                        {new Date(insight.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No insights yet - start the conversation to see AI analysis</p>
        )}
      </Card>

      {/* Conversation Metrics */}
      {aiAnalysis?.metrics && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Conversation Analytics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatDuration(aiAnalysis.metrics.duration)}
              </div>
              <div className="text-sm text-blue-600">Duration</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {aiAnalysis.metrics.wordCount}
              </div>
              <div className="text-sm text-green-600">Words</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600 capitalize">
                {aiAnalysis.metrics.sentimentTrend}
              </div>
              <div className="text-sm text-purple-600">Sentiment</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                {aiAnalysis.metrics.averageResponseTime > 0 
                  ? `${Math.round(aiAnalysis.metrics.averageResponseTime / 1000)}s`
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-orange-600">Avg Response</div>
            </div>
          </div>
          
          {/* Speaker Balance */}
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Speaker Balance</div>
            <div className="flex space-x-2">
              <div className="flex-1 bg-blue-200 h-4 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ 
                    width: `${(aiAnalysis.metrics.speakerBalance.agent / 
                      (aiAnalysis.metrics.speakerBalance.agent + aiAnalysis.metrics.speakerBalance.customer)) * 100}%` 
                  }}
                />
              </div>
              <div className="text-xs text-gray-600">
                Agent: {aiAnalysis.metrics.speakerBalance.agent} | 
                Customer: {aiAnalysis.metrics.speakerBalance.customer}
              </div>
            </div>
          </div>

          {/* Key Topics */}
          {aiAnalysis.metrics.keyTopics.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Key Topics</div>
              <div className="flex flex-wrap gap-2">
                {aiAnalysis.metrics.keyTopics.map((topic, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* AI Recommendations */}
      {aiAnalysis?.recommendations && aiAnalysis.recommendations.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 AI Recommendations</h3>
          <div className="space-y-2">
            {aiAnalysis.recommendations.map((rec, index) => (
              <div key={index} className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm text-blue-800">{rec}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next Actions */}
      {aiAnalysis?.nextActions && aiAnalysis.nextActions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">✅ Suggested Next Actions</h3>
          <div className="space-y-2">
            {aiAnalysis.nextActions.map((action, index) => (
              <div key={index} className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                <p className="text-sm text-green-800">{action}</p>
              </div>
            ))}
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

export default AIDashboard;
