# Cross-Network WebRTC Connection Troubleshooting Guide

This guide helps diagnose and resolve WebRTC connection issues when devices are on different networks (WiFi vs mobile data, different ISPs, etc.).

## Common Cross-Network Scenarios

### 🏠 WiFi to 📱 Mobile Data
- Most common failure scenario
- Requires STUN/TURN servers for NAT traversal
- May need TURN relay if direct connection fails

### 🏢 Corporate to 🏠 Home
- Corporate firewalls often block WebRTC
- May require TURN server with TCP fallback
- Check allowed ports and protocols

### 🌍 International Connections
- Higher latency affects ICE gathering
- Some countries block certain STUN/TURN servers
- Use geographically distributed servers

## Diagnostic Tools

### Browser Developer Console
Use these commands in the browser console to debug connections:

```javascript
// Check WebRTC service diagnostics
await webrtcService.runDiagnostics();

// Get network summary
const summary = webrtcService.getNetworkSummary();
console.log('Network Summary:', summary);

// Check if ready for cross-network calls
console.log('Cross-network ready:', webrtcService.isReadyForCrossNetwork());

// Get detailed connection stats
const stats = await webrtcService.getConnectionStats();
console.log('Connection Stats:', stats);
```

### Network Type Detection
The app automatically detects network type where possible:
- `4g`, `3g`, `2g` - Mobile data
- `wifi` - WiFi connection
- `ethernet` - Wired connection
- `unknown` - Can't determine

## Connection Analysis

### ICE Candidate Types
1. **HOST** (`typ host`) - Direct local IP
   - Works only on same network
   - Always present but limited reach

2. **STUN** (`typ srflx`) - Server Reflexive 
   - Your public IP via STUN server
   - Works through most NATs
   - Required for basic cross-network

3. **TURN** (`typ relay`) - Relayed through TURN server
   - Works through any firewall/NAT
   - Uses server bandwidth
   - Essential for strict networks

### Expected Candidate Patterns

#### ✅ Good Cross-Network Setup
```
Local candidates: HOST=1, STUN=1, TURN=2
Remote candidates: HOST=1, STUN=1, TURN=1
✅ TURN candidates available - cross-network connection should work
```

#### ⚠️ Warning Signs
```
Local candidates: HOST=1, STUN=1, TURN=0
Remote candidates: HOST=1, STUN=0, TURN=0
⚠️ WARNING: No TURN candidates available - may fail with strict NATs
```

#### ❌ Will Likely Fail
```
Local candidates: HOST=1, STUN=0, TURN=0
Remote candidates: HOST=1, STUN=0, TURN=0
❌ CRITICAL: Both sides only have HOST candidates - connection will likely fail across networks
```

## Troubleshooting Steps

### 1. Check STUN/TURN Connectivity
```javascript
// Test if TURN servers are reachable
await webrtcService.testTurnConnectivity();
```

Look for output like:
```
🧪 Testing TURN server connectivity...
🔄 TURN test candidate 1: candidate:1234... typ relay
✅ TURN servers are reachable
```

If no TURN candidates appear:
- Check internet connectivity
- Verify TURN server credentials
- Try different TURN servers
- Check firewall/proxy settings

### 2. Monitor ICE Connection Process
Watch the console during call setup:

```
📍 Local HOST candidate: {type: "host", address: "192.168.1.100"}
📍 Local STUN candidate: {type: "srflx", address: "203.0.113.45"}
📍 Local TURN candidate: {type: "relay", address: "turn.server.com"}
📍 Remote HOST candidate: {type: "host", address: "10.0.0.5"}
📍 Remote STUN candidate: {type: "srflx", address: "198.51.100.67"}
🔍 Network Compatibility Analysis:
  Local candidates: HOST=1, STUN=1, TURN=1
  Remote candidates: HOST=1, STUN=1, TURN=0
⚠️ WARNING: No TURN candidates available - may fail with strict NATs
```

### 3. Connection State Analysis
Monitor ICE connection states:

- `new` → `checking` - Normal progression
- `checking` → `connected` - Success!
- `checking` → `failed` - Network issue
- `connected` → `disconnected` - Temporary loss
- `disconnected` → `connected` - Recovered

### 4. Debug Connection Failures
When connection fails, automatic diagnostics will show:

```
🔍 DETAILED CONNECTION DIAGNOSTICS
=====================================
WebRTC States:
  Signaling: stable
  Connection: failed
  ICE Connection: failed
  ICE Gathering: complete
  Network Type: 4g

Candidate Summary:
  Local candidates: 2
  Remote candidates: 1

Detailed Connection Stats:
  Local candidates: [{type: "host"}, {type: "srflx"}]
  Remote candidates: [{type: "host"}]
  Active pairs: []
❌ No successful candidate pairs - connection establishment failed
💡 This typically means:
   - Firewall blocking connection
   - No compatible network paths
   - TURN servers not working
```

## Configuration for Cross-Network Reliability

### Current TURN Servers
The app uses multiple TURN servers for redundancy:

1. **OpenRelay.metered.ca** - Free, reliable
2. **Relay.backups.cz** - European backup
3. **Global.relay.metered.ca** - Global network

### Adding More TURN Servers
To add commercial TURN servers (recommended for production):

```typescript
// In webrtc.ts, add to iceServers array:
{
  urls: ['turn:your-turn-server.com:3478'],
  username: 'your-username',
  credential: 'your-password'
}
```

### Recommended Commercial TURN Providers
- **Twilio STUN/TURN** - Reliable, global
- **Xirsys** - WebRTC-focused
- **CoTURN** - Self-hosted option

## Network-Specific Solutions

### Mobile Data Issues
- Use TCP TURN fallback: `turn:server:443?transport=tcp`
- Some carriers block UDP TURN
- Add port 443 TURN servers

### Corporate Firewall
- Use TURN over TCP port 443
- May need proxy/SSL TURN
- Contact IT for whitelist

### Symmetric NAT
- Requires TURN relay
- Cannot use direct connection
- More common on mobile networks

## Performance Optimization

### Reduce Connection Time
1. Enable ICE trickle (already enabled)
2. Use multiple TURN servers
3. Prioritize relay candidates for strict networks

### Monitor Connection Quality
```javascript
// Get real-time connection stats
setInterval(async () => {
  const stats = await webrtcService.getConnectionStats();
  if (stats?.inbound) {
    console.log('Packets lost:', stats.inbound.packetsLost);
    console.log('Jitter:', stats.inbound.jitter);
  }
}, 5000);
```

## Testing Cross-Network Connections

### Manual Testing
1. One device on WiFi, other on mobile data
2. Different locations/ISPs
3. VPN vs no VPN
4. Corporate vs home network

### Automated Testing
```javascript
// Reset diagnostics before each test
webrtcService.resetDiagnostics();

// Start call attempt
// ... call setup code ...

// Check results
const ready = webrtcService.isReadyForCrossNetwork();
const summary = webrtcService.getNetworkSummary();
console.log('Test results:', { ready, summary });
```

## Production Checklist

### TURN Server Requirements
- [ ] Multiple geographic locations
- [ ] TCP and UDP support
- [ ] Port 443 availability
- [ ] Sufficient bandwidth allocation
- [ ] SLA guarantee

### Monitoring
- [ ] Connection success rate metrics
- [ ] TURN usage monitoring
- [ ] Regional failure analysis
- [ ] Fallback server health

### User Experience
- [ ] Clear error messages for connection failures
- [ ] Retry mechanisms
- [ ] Alternative communication methods
- [ ] Network quality indicators

## Common Error Messages and Solutions

### "ICE connection failed"
**Cause**: No network path between devices
**Solution**: 
1. Check TURN server connectivity
2. Try different TURN servers
3. Use TCP TURN on port 443

### "Only HOST candidates available"
**Cause**: STUN/TURN servers unreachable
**Solution**:
1. Check internet connectivity
2. Verify STUN/TURN server URLs
3. Check firewall settings

### "Connection timeout"
**Cause**: Slow ICE gathering or network
**Solution**:
1. Increase timeout values
2. Use faster STUN servers
3. Pre-warm connections

### "Media stream error"
**Cause**: Audio permission or device issues
**Solution**:
1. Check microphone permissions
2. Test with different audio settings
3. Verify HTTPS requirements

---

For additional support, check the browser console for detailed WebRTC logs and use the diagnostic tools provided in this guide.
