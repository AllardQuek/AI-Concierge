# 🚀 Deploy Sybil Voice Platform

## Quick Deployment Guide

### Step 1: Backend Deployment (Railway)

1. **Create Railway Account**: Go to [railway.app](https://railway.app)
2. **Connect GitHub**: Link your GitHub repository
3. **Deploy**: 
   - Select "Deploy from GitHub repo"
   - Choose this repository
   - Railway will auto-detect the Node.js app in `/server` directory
4. **Set Environment Variables** in Railway dashboard:
   ```
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://sybil-voice.vercel.app
   ```
5. **Copy the Railway URL** (e.g., `https://sybil-backend-production.up.railway.app`)

### Step 2: Frontend Deployment (Vercel)

1. **Create Vercel Account**: Go to [vercel.com](https://vercel.com)
2. **Import Project**: Connect your GitHub repository
3. **Configure Build Settings**:
   - **Framework Preset**: Other
   - **Build Command**: `npm run install:all && cd client && npm run build`
   - **Output Directory**: `client/build`
   - **Install Command**: `npm install`
4. **Set Environment Variables** in Vercel dashboard:
   ```
   VITE_SERVER_URL=https://your-railway-url-from-step1.up.railway.app
   ```
5. **Deploy**: Vercel will build and deploy automatically

### Step 3: Update CORS Settings

After both deployments are live:

1. **Get your Vercel URL** (e.g., `https://sybil-voice.vercel.app`)
2. **Update Railway Environment Variable**:
   ```
   CORS_ORIGIN=https://your-actual-vercel-url.vercel.app
   ```
3. **Redeploy** both services to apply changes

## Testing Your Deployment

### Basic Tests
- [ ] Visit your Vercel URL: `https://your-app.vercel.app`
- [ ] Check backend health: `https://your-railway-url.railway.app/health`
- [ ] Test agent login: `https://your-app.vercel.app/agent`
- [ ] Test customer interface: `https://your-app.vercel.app/customer`

### Voice Communication Tests
- [ ] **Cross-Device Test**: Open agent on one device, customer on another
- [ ] **Microphone Access**: Ensure HTTPS enables microphone permissions
- [ ] **Call Flow**: Customer requests call → Agent accepts → Audio flows both ways
- [ ] **Call Controls**: Test mute/unmute, end call from both sides
- [ ] **Local Monitoring**: Test 🎧 button on both interfaces

## Troubleshooting

### Common Issues

**"Connection Failed"**
- Check if Railway backend is running: visit `/health` endpoint
- Verify CORS_ORIGIN matches exact Vercel URL (including https://)

**"Failed to establish voice connection"**
- Ensure microphone permissions are granted (HTTPS required)
- Check browser console for WebRTC errors
- Verify both users are on HTTPS

**"No audio between users"**
- Test with different browsers (Chrome recommended for WebRTC)
- Check if users are behind restrictive firewalls/NAT
- Consider adding TURN servers for production use

### Browser Compatibility
- ✅ **Chrome/Edge**: Full WebRTC support
- ✅ **Firefox**: Good WebRTC support
- ⚠️ **Safari**: Limited WebRTC support (may need polyfills)
- ❌ **Internet Explorer**: Not supported

## Production Considerations

### Security
- All traffic uses HTTPS (required for microphone access)
- CORS properly configured
- No sensitive data in client-side code

### Performance
- CDN delivery via Vercel
- WebRTC peer-to-peer reduces server load
- Socket.IO handles signaling efficiently

### Scaling
- Frontend scales automatically (Vercel)
- Backend may need scaling for high concurrent calls
- Consider WebRTC TURN servers for enterprise use

## Advanced: Adding TURN Servers

For production deployments with users behind NAT/firewalls:

1. **Get TURN service** (Twilio, Xirsys, or self-hosted)
2. **Update WebRTC config** in `client/src/services/webrtc.ts`:
   ```typescript
   private iceServers = [
     { urls: 'stun:stun.l.google.com:19302' },
     {
       urls: 'turn:your-turn-server.com:3478',
       username: 'your-username',
       credential: 'your-password'
     }
   ];
   ```
3. **Set environment variables** for TURN credentials

## URLs After Deployment

- **Frontend**: `https://sybil-voice.vercel.app`
- **Backend**: `https://sybil-backend-production.up.railway.app`
- **Agent Interface**: `https://sybil-voice.vercel.app/agent`
- **Customer Interface**: `https://sybil-voice.vercel.app/customer`
- **Health Check**: `https://sybil-backend-production.up.railway.app/health`

---

🎉 **Congratulations!** Your Sybil voice platform is now live and ready for cross-device testing!
