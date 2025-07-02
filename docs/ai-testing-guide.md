# AI Analysis Testing Guide

## 🧪 **Quick Testing Scenarios**

### **Scenario 1: Positive Sentiment Detection**
1. Start a call in the Agent Interface
2. Speak or type: *"This is absolutely wonderful! I'm so happy with the service!"*
3. **Expected Result**: Green sentiment insight appears in Oracle Insights panel

### **Scenario 2: Negative Sentiment Detection**
1. Continue the call
2. Add customer input: *"I'm really frustrated and angry about this terrible experience"*
3. **Expected Result**: Red sentiment warning with empathy recommendations

### **Scenario 3: Escalation Trigger**
1. Add customer input: *"I want to speak to your supervisor right now!"*
2. **Expected Result**: High-severity escalation warning with transfer recommendation

### **Scenario 4: Intent Recognition**
1. Add customer input: *"I need help with my order and want to cancel it"*
2. **Expected Result**: Intent insights for "support_request" and "cancellation"

### **Scenario 5: Action Required Detection**
1. Add customer input: *"Can you please send me the documentation?"*
2. **Expected Result**: Action required insight with follow-up suggestions

### **Scenario 6: Conversation Analytics**
1. Continue adding various inputs from both agent and customer
2. **Expected Result**: 
   - Duration timer updates
   - Word count increases
   - Speaker balance visualization changes
   - Average response time calculation

## 📊 **Metrics to Observe**

- **Real-time Duration**: Should update every second
- **Word Count**: Increases with each transcription
- **Speaker Balance**: Visual bar showing agent vs customer distribution
- **Sentiment Trend**: Overall conversation mood (positive/neutral/negative)
- **Key Topics**: Extracted keywords from conversation content

## 🎯 **AI Recommendations**

Watch for contextual recommendations like:
- "🎯 Address customer concerns with empathy and active listening"
- "⚠️ Consider transferring to a supervisor or specialist"
- "🗣️ Allow more customer input - ask open-ended questions"

## ✅ **Next Actions**

Look for suggested actions such as:
- "📋 Document customer request for follow-up"
- "💳 Guide customer through purchase process"
- "🛠️ Provide technical assistance or troubleshooting"

## 🔮 **Oracle Insights Features**

- **Confidence Scoring**: Each insight shows percentage confidence
- **Timestamp Tracking**: When each insight was generated
- **Severity Indicators**: Color-coded importance levels
- **Update Frequency**: "Updated Xs ago" timestamp

## 🚀 **Performance Notes**

- Insights appear within 500ms of transcription updates
- System maintains last 10 insights to prevent UI clutter
- Analytics update in real-time without lag
- Memory usage remains stable during long conversations
