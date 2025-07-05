# 🚀 Sybil Deployment Checklist

## Pre-Deployment Setup

### 1. Repository Setup
- [ ] Push all code to GitHub
- [ ] Ensure all environment files are gitignored
- [ ] Verify package.json scripts are correct

### 2. Frontend Deployment (Vercel)

#### Vercel Setup
- [ ] Create Vercel account and connect GitHub repo
- [ ] Import project and select root directory
- [ ] Configure build settings:
  - **Build Command**: `npm run deploy:prep && cd client && npm run build`
  - **Output Directory**: `client/dist`
  - **Install Command**: `npm run install:all`

#### Environment Variables (Vercel Dashboard)
- [ ] `VITE_SERVER_URL` = `https://your-backend-url.railway.app`

### 3. Backend Deployment (Railway)

#### Railway Setup
- [ ] Create Railway account and connect GitHub repo
- [ ] Deploy from `server/` directory
- [ ] Note the generated Railway URL

#### Environment Variables (Railway Dashboard)
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3001` (or leave empty for Railway auto-config)
- [ ] `CORS_ORIGIN` = `https://your-vercel-app.vercel.app`

## Post-Deployment Configuration

### 4. Update Environment URLs
- [ ] Copy Railway backend URL
- [ ] Update `VITE_SERVER_URL` in Vercel environment variables
- [ ] Copy Vercel frontend URL
- [ ] Update `CORS_ORIGIN` in Railway environment variables
- [ ] Redeploy both services

### 5. Testing Checklist

#### Basic Functionality
- [ ] Frontend loads without errors
- [ ] Backend health check works: `{backend-url}/health`
- [ ] WebSocket connection establishes successfully

#### Voice Features
- [ ] Microphone permission works (HTTPS required)
- [ ] Agent can login and go available
- [ ] Customer can request a call
- [ ] Call connection works between agent and customer
- [ ] Audio flows both directions
- [ ] Call can be ended from both sides
- [ ] Mute/unmute functionality works
- [ ] Local audio monitoring works (🎧 button)

#### Cross-Device Testing
- [ ] Test on different devices (phone, tablet, desktop)
- [ ] Test on different networks (WiFi, mobile data)
- [ ] Test with different browsers (Chrome, Safari, Firefox)
- [ ] Test across different locations/NAT configurations

## Troubleshooting

### Common Issues
- **CORS errors**: Check CORS_ORIGIN matches exact Vercel URL
- **WebSocket connection fails**: Verify Railway backend is running
- **Microphone access denied**: Ensure HTTPS is working
- **No audio**: Check WebRTC ICE server configuration
- **Cross-device connection fails**: May need TURN server for NAT traversal

### Debug URLs
- Frontend: `https://your-app.vercel.app`
- Backend health: `https://your-backend.railway.app/health`
- Agent interface: `https://your-app.vercel.app/agent`
- Customer interface: `https://your-app.vercel.app/customer`

## Production Considerations

### Performance
- [ ] Enable gzip compression
- [ ] Configure CDN for static assets
- [ ] Monitor WebSocket connection stability

### Security
- [ ] Review CORS settings
- [ ] Implement rate limiting
- [ ] Add authentication if needed
- [ ] Configure proper STUN/TURN servers

### Monitoring
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Monitor uptime (Railway/Vercel dashboards)
- [ ] Track WebRTC connection success rates

## Advanced: TURN Server Setup

For production WebRTC across NAT/firewalls, consider:
- [ ] Twilio TURN service
- [ ] Xirsys TURN servers
- [ ] Self-hosted coturn server

Add to WebRTC configuration:
```javascript
{
  urls: 'turn:your-turn-server.com:3478',
  username: 'your-username',
  credential: 'your-password'
}
```
