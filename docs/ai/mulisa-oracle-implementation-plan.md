# 🔮 Mulisa Oracle Implementation Plan - Same-Day Sprint

**Date**: July 9, 2025  
**Goal**: Transform existing LiveKit bot into AI-powered Oracle that provides mystical wisdom during human conversations  
**Timeline**: 6-8 hours total implementation

---

## 📋 **Current State Analysis**

### ✅ **Solid Foundation Available**
- **LiveKit Integration**: Room management, token generation, participant monitoring
- **HTTP Server**: CORS setup, endpoint structure, graceful shutdown
- **Room Management**: Active room tracking, cleanup logic, monitoring intervals
- **Error Handling**: Comprehensive error recovery and logging

### ⚠️ **Critical Issues Identified**
1. **Missing LiveKit Client Import**: `const room = new Room();` fails - needs `livekit-client` import
2. **Undefined Variable**: `livekitRooms[roomName]` not declared globally
3. **Environment Variables**: Missing AI service keys (OpenAI, TTS services)
4. **Audio Processing**: No actual audio subscription or processing logic

### 🎯 **Target Architecture**
```
Human A ←──── LiveKit Room ────→ Human B
                │
                ▼
         Mulisa Oracle Bot
         • Subscribes to all audio
         • AI wisdom generation  
         • TTS voice responses
         • Context-aware timing
```

---

## 🚀 **Phase-by-Phase Implementation**

### **Phase 1: Fix Foundation & Add AI Core (30 minutes)**

#### **Critical Fixes Needed:**
```javascript
// 1. Add missing imports
const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
const { Room } = require('livekit-client'); // MISSING - causes crash

// 2. Declare missing global variable
const livekitRooms = {}; // MISSING - causes undefined reference

// 3. Add AI dependencies
const OpenAI = require('openai');
```

#### **Environment Variables to Add:**
```bash
# AI Configuration
OPENAI_API_KEY=your-openai-key-here
LIVEKIT_BOT_IDENTITY=mulisa-oracle
ORACLE_PERSONALITY=mystical-sage
WISDOM_FREQUENCY=moderate

# Optional TTS Services
ELEVENLABS_API_KEY=your-elevenlabs-key
AZURE_SPEECH_KEY=your-azure-speech-key
AZURE_SPEECH_REGION=your-region
```

#### **Oracle Personality Configuration:**
```javascript
const ORACLE_PERSONALITY = {
  voice: "mystical-sage",
  wisdom: "prophetic-insights", 
  timing: "natural-pauses",
  style: "ancient-wisdom-modern-relevance",
  triggers: ["help", "advice", "wisdom", "oracle", "mulisa", "guidance"]
};
```

### **Phase 2: Implement Core Oracle Logic (45 minutes)**

#### **Audio Subscription Manager:**
```javascript
class AudioSubscriptionManager {
  constructor(roomName) {
    this.roomName = roomName;
    this.subscribedTracks = new Map();
  }
  
  async subscribeToParticipants(room) {
    room.on('trackPublished', async (publication, participant) => {
      if (publication.kind === 'audio' && participant.identity !== BOT_IDENTITY) {
        console.log(`[ORACLE] 👂 Subscribing to ${participant.identity}`);
        await publication.setSubscribed(true);
        this.processParticipantAudio(publication.track, participant);
      }
    });
  }
  
  processParticipantAudio(audioTrack, participant) {
    // For demo: trigger wisdom on conversation activity
    // Future: Real-time STT integration
    console.log(`[ORACLE] 🎧 Processing audio from ${participant.identity}`);
    
    // Simple demo trigger after 3-5 seconds of activity
    setTimeout(() => {
      this.triggerOracleWisdom(participant.identity, "conversation-activity");
    }, Math.random() * 2000 + 3000); // 3-5 second delay
  }
}
```

#### **Oracle Wisdom Engine:**
```javascript
class OracleWisdomEngine {
  constructor() {
    this.conversationContexts = new Map();
    this.wisdomHistory = new Map();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  async generateWisdom(roomName, seekerIdentity, context) {
    const conversationHistory = this.conversationContexts.get(roomName) || [];
    const previousWisdom = this.wisdomHistory.get(roomName) || [];
    
    const oraclePrompt = `
    You are Mulisa, an ancient oracle with mystical wisdom. You are listening to a conversation in room ${roomName}.
    
    Seeker: ${seekerIdentity}
    Context: ${context}
    Previous wisdom shared: ${previousWisdom.slice(-2).join('; ')}
    
    Provide brief (25-35 words), mystical yet practical insight. Use metaphors from nature, time, or ancient wisdom.
    Avoid repeating previous wisdom. Speak as an oracle would - mysterious but helpful.
    
    Begin with phrases like:
    - "The winds whisper..."
    - "Ancient wisdom reveals..." 
    - "I see in the cosmic patterns..."
    - "The Oracle speaks..."
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: oraclePrompt }],
        max_tokens: 80,
        temperature: 0.8
      });

      const wisdom = completion.choices[0].message.content.trim();
      
      // Store wisdom to avoid repetition
      if (!this.wisdomHistory.has(roomName)) {
        this.wisdomHistory.set(roomName, []);
      }
      this.wisdomHistory.get(roomName).push(wisdom);
      
      return wisdom;
    } catch (error) {
      console.error(`[ORACLE] ❌ Error generating wisdom:`, error);
      return "The Oracle's voice grows distant... mystical energies are disrupted.";
    }
  }
  
  updateConversationContext(roomName, event) {
    if (!this.conversationContexts.has(roomName)) {
      this.conversationContexts.set(roomName, []);
    }
    
    const context = this.conversationContexts.get(roomName);
    context.push({
      timestamp: new Date(),
      event: event,
      type: 'conversation-activity'
    });
    
    // Keep only last 10 events
    if (context.length > 10) {
      context.splice(0, context.length - 10);
    }
  }
}
```

#### **Oracle Voice Manager:**
```javascript
class OracleVoiceManager {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  async speakWisdom(roomName, wisdom) {
    try {
      console.log(`[ORACLE] 🗣️ Speaking to ${roomName}: "${wisdom}"`);
      
      // Phase 2: Text-based wisdom (immediate implementation)
      this.updateRoomWithWisdom(roomName, wisdom);
      
      // Phase 3: Add TTS audio (stretch goal)
      if (process.env.ENABLE_TTS === 'true') {
        await this.generateAndPublishAudio(roomName, wisdom);
      }
      
    } catch (error) {
      console.error(`[ORACLE] ❌ Error speaking wisdom:`, error);
    }
  }
  
  updateRoomWithWisdom(roomName, wisdom) {
    if (activeRooms[roomName]) {
      activeRooms[roomName].lastWisdom = {
        text: wisdom,
        timestamp: new Date(),
        type: 'prophetic-insight',
        oracleActive: true
      };
    }
  }
  
  async generateAndPublishAudio(roomName, wisdom) {
    try {
      // OpenAI TTS for quick implementation
      const mp3Response = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "nova", // Mystical-sounding voice
        input: wisdom,
        speed: 0.85 // Slower for oracle effect
      });

      const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
      console.log(`[ORACLE] 🎵 Generated ${audioBuffer.length} bytes of oracle speech`);
      
      // TODO: Publish to LiveKit room (Phase 3)
      // await this.publishAudioToRoom(roomName, audioBuffer);
      
    } catch (error) {
      console.error(`[ORACLE] ❌ TTS error:`, error);
    }
  }
}
```

### **Phase 3: TTS Integration (30 minutes)**

#### **Audio Publishing to LiveKit:**
```javascript
// This requires additional LiveKit audio track APIs
async function publishAudioToRoom(roomName, audioBuffer) {
  const room = livekitRooms[roomName];
  if (!room) return;
  
  try {
    // Convert audio buffer to audio track
    // LiveKit specific implementation needed here
    console.log(`[ORACLE] 🎵 Publishing oracle voice to ${roomName}`);
    
    // For now: prepare infrastructure, actual audio publishing in stretch goals
    
  } catch (error) {
    console.error(`[ORACLE] ❌ Error publishing audio:`, error);
  }
}
```

### **Phase 4: Frontend Integration (45 minutes)**

#### **Oracle Service Integration:**
```typescript
// client/src/services/mulisa-oracle-service.ts
export class MulisaOracleService {
  private baseUrl: string;
  private statusPollingInterval: number | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_BOT_SERVER_URL || 'http://localhost:4000';
  }

  async inviteOracle(number1: string, number2: string): Promise<OracleInviteResult> {
    try {
      console.log('🔮 Summoning Mulisa Oracle...');
      
      const response = await fetch(`${this.baseUrl}/join-room?number1=${number1}&number2=${number2}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('✨ Oracle awakened:', result.message);
        this.startStatusPolling(number1, number2);
        return { success: true, roomName: result.roomName };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Failed to summon Oracle:', error);
      return { success: false, error: error.message };
    }
  }

  async getLatestWisdom(number1: string, number2: string): Promise<OracleWisdom | null> {
    try {
      const roomName = this.getRoomName(number1, number2);
      const response = await fetch(`${this.baseUrl}/room-status?room=${roomName}`);
      const status = await response.json();
      
      return status.details?.lastWisdom || null;
    } catch (error) {
      console.error('❌ Error fetching wisdom:', error);
      return null;
    }
  }
  
  startStatusPolling(number1: string, number2: string) {
    if (this.statusPollingInterval) return;
    
    this.statusPollingInterval = setInterval(async () => {
      const wisdom = await this.getLatestWisdom(number1, number2);
      if (wisdom) {
        window.dispatchEvent(new CustomEvent('oracle-wisdom', { detail: wisdom }));
      }
    }, 3000);
  }
}
```

#### **Oracle Control Panel Component:**
```typescript
// client/src/components/OracleControlPanel.tsx
interface OracleControlPanelProps {
  myNumber: string;
  connectedNumber: string;
  isConnected: boolean;
}

export const OracleControlPanel: React.FC<OracleControlPanelProps> = ({
  myNumber, connectedNumber, isConnected
}) => {
  const [oracleService] = useState(new MulisaOracleService());
  const [oracleActive, setOracleActive] = useState(false);
  const [latestWisdom, setLatestWisdom] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const inviteOracle = async () => {
    if (!isConnected) {
      alert('Establish a call first before summoning the Oracle');
      return;
    }

    setIsInviting(true);
    const result = await oracleService.inviteOracle(myNumber, connectedNumber);
    
    if (result.success) {
      setOracleActive(true);
      setLatestWisdom("The Oracle Mulisa awakens and begins listening...");
    }
    setIsInviting(false);
  };

  // Listen for oracle wisdom events
  useEffect(() => {
    const handleOracleWisdom = (event: CustomEvent) => {
      setLatestWisdom(event.detail.text);
    };

    window.addEventListener('oracle-wisdom', handleOracleWisdom);
    return () => window.removeEventListener('oracle-wisdom', handleOracleWisdom);
  }, []);

  return (
    <div className="oracle-panel bg-gradient-to-br from-purple-900/40 to-indigo-900/40 backdrop-blur rounded-lg p-6 border border-purple-500/30">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">🔮 Oracle Mulisa</h3>
        <p className="text-purple-200 text-sm">Ancient wisdom for modern conversations</p>
      </div>

      {!oracleActive ? (
        <button
          onClick={inviteOracle}
          disabled={!isConnected || isInviting}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
            isConnected && !isInviting
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
          }`}
        >
          {isInviting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Summoning Oracle...
            </span>
          ) : (
            '✨ Summon Oracle Wisdom'
          )}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center text-green-400">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-2"></div>
            <span className="text-sm font-medium">Oracle is listening</span>
          </div>
          
          {latestWisdom && (
            <div className="bg-purple-800/30 rounded-lg p-4 border border-purple-400/20">
              <h4 className="text-purple-200 text-xs font-semibold mb-2">ORACLE SPEAKS</h4>
              <p className="text-white text-sm italic">"{latestWisdom}"</p>
              <div className="text-purple-300 text-xs mt-2">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### **Phase 5: Testing & Integration (30 minutes)**

#### **Testing Checklist:**
- [ ] Oracle joins room successfully when invited
- [ ] AI wisdom generation works with OpenAI API
- [ ] Wisdom appears in frontend UI in real-time
- [ ] Multiple rooms can have separate Oracle instances
- [ ] Oracle leaves room when participants disconnect
- [ ] Error handling works for API failures
- [ ] Room cleanup happens properly

---

## 🔍 **Identified Issues & Solutions**

### **Issue 1: LiveKit Audio Publishing Complexity**
**Problem**: Publishing TTS audio requires complex LiveKit audio track creation  
**Solution**: Start with text-based wisdom, add audio as stretch goal  
**Workaround**: Use browser-side speech synthesis as interim solution

### **Issue 2: Real-time STT Integration**
**Problem**: Live speech-to-text might be complex for day-one  
**Solution**: Use conversation timing and activity detection for demo  
**Future**: Integrate OpenAI Whisper or Azure Speech Services

### **Issue 3: Oracle Timing Intelligence**
**Problem**: When should Oracle speak? Too often = annoying, too rare = useless  
**Solution**: Smart triggers based on conversation pauses, keywords, activity levels  
**Configuration**: Adjustable wisdom frequency in environment variables

### **Issue 4: Multi-room Context Isolation**
**Problem**: Oracle wisdom needs to be contextual per room  
**Solution**: Room-based context maps and conversation memory  
**Cleanup**: Automatic context cleanup when rooms become empty

### **Issue 5: API Rate Limits**
**Problem**: OpenAI API limits could break demo during testing  
**Solution**: Implement retry logic, fallback wisdom, rate limiting  
**Monitoring**: Log API usage and implement graceful degradation

---

## 🛠 **Technical Dependencies**

### **New Package Dependencies:**
```json
{
  "livekit-client": "^2.0.0",
  "openai": "^4.0.0",
  "axios": "^1.6.0"
}
```

### **Environment Variables Required:**
```bash
# Core LiveKit (existing)
LIVEKIT_URL=wss://your-livekit-server
LIVEKIT_API_KEY=your-api-key  
LIVEKIT_API_SECRET=your-secret

# Oracle AI Configuration (new)
OPENAI_API_KEY=your-openai-key
LIVEKIT_BOT_IDENTITY=mulisa-oracle
ORACLE_PERSONALITY=mystical-sage
WISDOM_FREQUENCY=moderate
ENABLE_TTS=false

# Optional TTS Services (future)
ELEVENLABS_API_KEY=your-elevenlabs-key
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=eastus
```

---

## 🎯 **Success Criteria**

### **Minimum Viable Oracle (Day 1 Success):**
- ✅ Oracle joins LiveKit rooms when invited via HTTP API
- ✅ Generates mystical wisdom using OpenAI GPT-4
- ✅ Displays wisdom in real-time in frontend UI
- ✅ Handles multiple concurrent rooms with separate contexts
- ✅ Automatically leaves rooms when empty
- ✅ Graceful error handling for API failures

### **Enhanced Oracle (Stretch Goals):**
- 🎵 TTS audio delivery with mystical voice
- 👂 Real-time conversation transcription and analysis
- 🧠 Advanced context awareness and conversation threading
- 🎨 Enhanced mystical UI effects and animations
- 📊 Oracle wisdom analytics and effectiveness tracking

### **Production Readiness Indicators:**
- 🔒 Secure API key management
- 📈 Monitoring and logging for Oracle activities
- ⚡ Performance optimization for multiple concurrent Oracles
- 🛡️ Rate limiting and abuse prevention
- 📱 Mobile-optimized Oracle interface

---

## 🚨 **Risk Assessment & Mitigation**

### **High Risk Items:**
1. **LiveKit Audio Publishing** - Complex API, may need workaround
   - *Mitigation*: Start with text, add audio later
   
2. **OpenAI API Rate Limits** - Could break demo during testing
   - *Mitigation*: Implement fallback wisdom, retry logic

### **Medium Risk Items:**
1. **Oracle Timing Logic** - Interruptions might feel unnatural
   - *Mitigation*: Conservative timing, user feedback integration
   
2. **Multi-room Context Management** - Memory leaks possible
   - *Mitigation*: Aggressive cleanup, memory monitoring

### **Low Risk Items:**
1. **Frontend Integration** - Straightforward React components
2. **Basic AI Logic** - OpenAI integration is well-documented

---

## 📅 **Implementation Timeline**

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| **Phase 1: Foundation Fixes** | 30 min | Critical | None |
| **Phase 2: Oracle Logic** | 45 min | Critical | OpenAI API key |
| **Phase 3: TTS Integration** | 30 min | Medium | Phase 2 complete |
| **Phase 4: Frontend Integration** | 45 min | Critical | Phase 2 complete |
| **Phase 5: Testing & Polish** | 30 min | Critical | All phases |

**Total Time**: 3 hours (core functionality) + 1 hour (polish) = **4 hours minimum viable Oracle**

---

## 🚀 **Ready for Implementation**

This plan provides:
- ✅ **Clear technical roadmap** with specific code implementations
- ✅ **Risk mitigation strategies** for identified issues  
- ✅ **Modular approach** allowing deferrals if components prove challenging
- ✅ **Testable milestones** with clear success criteria
- ✅ **Production pathway** for future enhancements

The existing LiveKit bot foundation is solid. The main work is:
1. **Fix the critical import/variable issues**
2. **Add AI wisdom generation engine** 
3. **Implement audio subscription and processing**
4. **Create frontend Oracle controls**
5. **Test and polish the experience**

**Ready to proceed with Phase 1: Foundation Fixes?** 🔮⚡
