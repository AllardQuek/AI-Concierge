# Voice Testing Guide for Sybil

## 🎯 Quick Test Checklist

### Prerequisites
- Two browser windows/tabs (or two devices)
- Microphone permissions granted
- Both client (3000) and server (3001) running

### Basic Voice Test (2 minutes)

1. **Setup Two Sessions**
   ```
   Window 1: http://localhost:3000/agent  → Login as "Test Agent"
   Window 2: http://localhost:3000/customer → Enter name "Test Customer"
   ```

2. **Test Call Flow**
   - Agent: Set status to "Available" 
   - Customer: Click "Call Customer Service"
   - Agent: Accept incoming call
   - **Both should see microphone indicator in browser**

3. **Test Audio**
   - Customer: Speak "Hello Agent, can you hear me?"
   - Agent: Respond "Yes, I can hear you clearly"
   - Test mute/unmute on both sides
   - End call from either side

### Expected Indicators
- ✅ Browser shows microphone icon in address bar during call
- ✅ Call timer shows on both sides
- ✅ Mute button toggles correctly
- ✅ No console errors about WebRTC

## 🔧 Troubleshooting

### No Audio Issues
1. Check browser console for WebRTC errors
2. Verify microphone permissions
3. Try Chrome/Firefox (best WebRTC support)
4. Check if other applications are using microphone

### Connection Issues  
1. Verify server is running on port 3001
2. Check network/firewall blocking WebSocket
3. Try refreshing both sessions

### Testing Commands
```bash
# Check if services are running
lsof -i :3000  # Client
lsof -i :3001  # Server

# Check WebRTC in browser console
// Customer side:
console.log('Customer WebRTC state:', webrtcService.current?.getConnectionState());

// Agent side:  
console.log('Agent WebRTC state:', webrtcService.current?.getConnectionState());
```

## 📊 Advanced Testing

### Audio Quality Test
- Test in quiet environment
- Test with background noise
- Test mute/unmute during conversation
- Test ending/restarting calls

### Browser Compatibility
- Chrome (recommended)
- Firefox  
- Safari (limited support)
- Edge

### Network Conditions
- Same network (LAN)
- Different networks (requires TURN server for production)
- Mobile hotspot
- VPN connections
