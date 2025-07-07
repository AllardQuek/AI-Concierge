# Mulisa Port Configuration Summary

## 🔌 **Current Port Architecture** (Updated July 1, 2025)

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Frontend Application** | `3000` | `http://localhost:3000` | React/Vite client with customer & agent interfaces |
| **Signaling Server** | `3001` | `http://localhost:3001` | Socket.IO WebRTC signaling & call management |

## 🔧 **Port Conflict Resolution Strategy** 

### Ideal Configuration
- **Frontend (Vite)**: Port 3000 (auto-increments if occupied: 3001, 3002, etc.)
- **Backend (Node.js)**: Port 3001 (fixed port, fails clearly if occupied)
- **Socket Connection**: Frontend always connects to backend on port 3001

### Port Conflict Handling
1. **Vite Development Server**: Automatically finds next available port starting from 3000
2. **Node.js Backend**: Uses fixed port 3001, provides clear error if port is occupied
3. **Client Connection**: Always attempts to connect to port 3001 for backend

### Files Updated
- ✅ `/server/index.js` - Server configured for port 3001
- ✅ `/client/src/services/socket.ts` - Client connects to port 3001
- ✅ `/client/vite.config.ts` - Frontend configured for port 3000
- ✅ Enhanced error handling for connection failures

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
# Expected: {"status":"Mulisa AI Service running","version":"1.0.0"}
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
