# WebRTC Connection States Guide

This document explains the different connection states in WebRTC and what they mean for troubleshooting call issues.

## Connection State Flow

WebRTC calls go through several states during establishment and operation:

### Normal Call Flow
1. **new** → **connecting** → **connected** → **disconnected** (when call ends)

### Typical State Sequence
```
🧊 ICE connection state: checking
🔄 ICE checking - testing network connectivity paths...
🧊 ICE connection state: connected  
🟢 ICE connected - direct connection established!
Connection state: connected
```

## Connection States Explained

### ICE Connection States
- **new**: Initial state, no ICE candidates yet
- **checking**: Testing network connectivity paths between peers
- **connected**: Direct connection established successfully
- **completed**: Optimal connection path found (better than connected)
- **failed**: All connection attempts failed - network issues detected
- **disconnected**: Connection lost, may recover automatically
- **closed**: Connection permanently closed

### Peer Connection States
- **new**: Initial state
- **connecting**: Attempting to establish connection
- **connected**: Successfully connected and media can flow
- **disconnected**: Connection lost, attempting recovery
- **failed**: Connection failed permanently
- **closed**: Connection terminated

## Common Issues and Solutions

### Issue: Connected → Disconnected → Failed
This sequence indicates network instability:

```
🧊 ICE connection state: connected
🟢 ICE connected - direct connection established!
Connection state: connected
🧊 ICE connection state: disconnected
🟡 ICE disconnected - connection lost, may recover...
Connection state: failed
```

**Possible Causes:**
- Network switching (WiFi ↔ Cellular)
- Firewall/NAT blocking sustained connection
- STUN/TURN server issues
- Mobile carrier restrictions
- Poor network quality

**Automatic Recovery:**
- ICE restart is attempted automatically
- Connection timeout triggers recovery attempts
- Multiple STUN/TURN servers provide redundancy

### Issue: No STUN/TURN Candidates
If you see this warning:
```
⚠️ No STUN/TURN candidates found - connection may fail on different networks
```

This means the connection relies only on direct (HOST) candidates, which won't work across different networks.

## Debugging Tools

### Manual State Check
Call `webrtcRef.current.debugState()` to see current connection status:
```
🔍 WebRTC Debug State:
  - Signaling State: stable
  - Connection State: connected
  - ICE Connection State: connected
  - ICE Gathering State: complete
  - Local Stream: 1 tracks
  - Remote Stream: 1 tracks
```

### ICE Candidate Analysis
The system automatically tracks candidate types:
- **HOST**: Direct connection candidates
- **STUN**: NAT traversal candidates  
- **TURN**: Relay candidates for restrictive networks

## Platform-Specific Considerations

### iOS Safari
- Requires user interaction before audio can play
- Audio context must be resumed manually
- Special audio constraints needed for optimal quality

### Android Chrome
- Different audio handling requirements
- May need manual audio element manipulation

### Mobile Networks
- Higher latency for ICE gathering (15s timeout)
- More prone to connection instability
- Cellular network switching can cause disconnections

## Configuration

### ICE Servers
The system uses multiple ICE servers for redundancy:
- Google STUN servers (primary)
- Backup STUN servers
- Free TURN servers for NAT traversal

### Connection Timeouts
- ICE gathering: 15 seconds (mobile-optimized)
- Call connection: 30 seconds
- Automatic recovery attempts on failure

## Monitoring and Logs

Key log messages to watch for:
- ✅ Success indicators (green checkmarks)
- ⚠️ Warnings (yellow triangles) 
- ❌ Errors (red X marks)
- 🔄 Recovery attempts
- 📊 Statistics and metrics

This logging system helps identify connection issues and track recovery attempts automatically.
