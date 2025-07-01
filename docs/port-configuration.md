# Sybil Port Configuration Summary

## 🔌 **Current Port Architecture** (Updated July 1, 2025)

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Frontend Application** | `3000` | `http://localhost:3000` | React/Vite client with customer & agent interfaces |
| **Signaling Server** | `3001` | `http://localhost:3001` | Socket.IO WebRTC signaling & call management |
| **AI Service** | `5001` | `http://localhost:5001` | LLM processing pipeline & voice analysis |

## 🔧 **Port Change Resolution** 

### Issue
- **Original Configuration**: Server on port `5000`
- **Problem**: macOS AirPlay Receiver occupies port `5000` by default
- **Solution**: Moved signaling server to port `3001`

### Files Updated
- ✅ `/server/index.js` - Server port changed from 5000 → 3001
- ✅ `/client/src/services/socket.ts` - Client connection URL updated
- ✅ `/README.md` - Documentation updated with new ports
- ✅ `/docs/visual-architecture.md` - Architecture diagrams updated

## 🚀 **Development Environment**

### Start All Services
```bash
npm run dev
```
This automatically starts:
- Frontend on `http://localhost:3000`
- Signaling server on `http://localhost:3001`

### AI Service (Manual Start)
```bash
cd server
node ai-service.js
```
This starts the AI processing hub on `http://localhost:5001`

## 🌐 **Service Communication Flow**

```
Frontend (3000) ←→ Signaling Server (3001) ←→ AI Service (5001)
     │                      │                        │
     ├─ Customer Interface  ├─ WebRTC Signaling     ├─ OpenAI GPT-4o
     ├─ Agent Interface     ├─ Call Management      ├─ Speech-to-Text
     └─ Landing Page        └─ Room Management      └─ Voice Analysis
```

## 🔍 **Testing Connectivity**

### Signaling Server Health Check
```bash
curl http://localhost:3001/health
# Expected: {"status":"Server is running","rooms":0,"users":0}
```

### AI Service Health Check  
```bash
curl http://localhost:5001/health
# Expected: {"status":"Sybil AI Service running","version":"1.0.0"}
```

### Frontend Access
- Navigate to `http://localhost:3000`
- Connection status should show green "Connected" indicator

## 📝 **Configuration Notes**

### CORS Settings
- Signaling server allows connections from ports `3000` and `3001`
- AI service allows connections from `http://localhost:3000`

### Environment Variables
```bash
# Override default ports if needed
PORT=3001                # Signaling server
AI_PORT=5001            # AI service  
CLIENT_URL=http://localhost:3000  # Frontend URL
```

### macOS Compatibility
- ✅ **Resolved**: Port 5000 conflict with AirPlay
- ✅ **Current**: All services use available ports
- ✅ **Tested**: Full connectivity verified

---

*Last updated: July 1, 2025*
*Status: All services operational with correct port configuration*
