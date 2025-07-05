# Voice Testing Guide for Sybil

## 🎯 Quick Test Checklist

### Prerequisites

- Two browser windows/tabs (or two devices)
- Microphone permissions granted
- Both client (port 3000) and server (port 5000) running

### Basic Voice Test (2 minutes)

1. **Setup Two Sessions**
   ```
   Window 1: http://localhost:3000 → Enter phone number "+65 1234 5678"
   Window 2: http://localhost:3000 → Enter phone number "+65 9876 5432"
   ```

2. **Test Call Flow**
   - User 1: Click "Start Call"
   - User 2: Click "Start Call" 
   - Both should connect automatically
   - **Both should see microphone indicator in browser**

3. **Test Audio**
   - User 1: Speak "Hello, can you hear me?"
   - User 2: Respond "Yes, I can hear you clearly"
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

1. Verify server is running on port 5000
2. Check network/firewall blocking WebSocket
3. Try refreshing both sessions

### Testing Commands

```bash
# Check if services are running
lsof -i :3000  # Client
lsof -i :3001  # Server

# Check servers are running
lsof -i :3000  # Client server
lsof -i :5000  # Backend server

# Check WebRTC in browser console
console.log('WebRTC connection state:', webrtcService.getConnectionState());
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
- Safari (iOS 14.3+)
- Edge

### Network Conditions

- Same network (LAN)
- Different networks (WAN)


### iOS Safari
- Requires user interaction before audio playback
- Use HTTPS in production
- Grant microphone permissions

### Android Chrome
- Better WebRTC support than iOS
- Test in both WiFi and mobile data
- Check audio input/output settings

## ✅ Success Criteria

A successful test should demonstrate:

- Clear audio in both directions
- Low latency (< 500ms noticeable delay)
- Stable connection without dropouts
- Proper mute/unmute functionality
- Clean connection establishment and teardown
- Same network (LAN)
- Different networks (requires TURN server for production)
- Mobile hotspot
- VPN connections
