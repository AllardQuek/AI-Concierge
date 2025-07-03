# Sybil - Quick Start Guide

## 🚀 Getting Started

This guide will help you set up and run the Sybil voice calling platform locally.

## 📋 Prerequisites

- Node.js 18+ installed
- Modern web browser (Chrome, Firefox, Safari)
- Microphone access permissions

## 🔧 Step 1: Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd voice-bot

# Install all dependencies
npm run install:all
```

## � Step 2: Start the Application

```bash
# Start both client and server
npm run dev

# Or start individually:
# npm run server:dev  # Starts server on port 5000
# npm run client:dev  # Starts client on port 3000
```

## 🌐 Step 3: Access the Application

1. **Open your browser** to `http://localhost:3000`
2. **Grant microphone permissions** when prompted
3. **Enter a Singapore phone number** (format: +65 XXXX XXXX)
4. **Click "Start Call"** to begin the voice connection

## 📱 Testing Voice Calls

### Single Device Testing
1. Open two browser tabs/windows
2. Enter different phone numbers in each
3. Start calls to test the WebRTC connection

### Multi-Device Testing
1. Ensure both devices are on the same network
2. Access the app from multiple devices
3. Test voice quality and connection stability

## 🔧 Configuration

### Environment Variables (Optional)

#### Server (.env in /server/)
```bash
PORT=5000
NODE_ENV=development
```

#### Client (.env in /client/)
```bash
VITE_SERVER_URL=http://localhost:5000
```

## 🌐 Production Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) for platform-specific instructions.

## 🔍 Troubleshooting

### Common Issues

#### No Audio / Connection Failed
- Check microphone permissions in browser
- Ensure both client and server are running
- Try refreshing the browser
- Check browser console for WebRTC errors

#### WebRTC Connection Issues
- Verify firewall settings
- Test with different browsers
- Check network connectivity
- Try incognito/private browsing mode

#### Mobile Device Issues
- Use HTTPS in production (required for mobile audio)
- Test with Safari on iOS and Chrome on Android
- Ensure mobile browser supports WebRTC

### Debug Commands

```bash
# Check if ports are available
lsof -i :3000
lsof -i :5000

# View server logs
npm run server:dev

# Check client build
npm run client:build
```

## 📊 Browser Compatibility

- ✅ **Chrome 80+**: Full WebRTC support
- ✅ **Firefox 75+**: Full WebRTC support  
- ✅ **Safari 14+**: WebRTC support (iOS 14.3+)
- ✅ **Edge 80+**: Full WebRTC support

## 🔄 Development Workflow

1. **Code Changes**: Edit files in `/client/src/` or `/server/`
2. **Hot Reload**: Client automatically reloads on changes
3. **Server Restart**: Server restarts automatically with nodemon
4. **Testing**: Use browser developer tools for debugging


   - Speak into the microphone
   - Check agent dashboard for real-time transcription
The application is now ready for voice calling between connected users!
