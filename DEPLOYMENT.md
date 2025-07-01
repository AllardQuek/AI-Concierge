# Sybil Deployment Guide

## Frontend Deployment (Vercel)

### Prerequisites
1. Push your code to GitHub
2. Create a Vercel account
3. Connect your GitHub repository

### Environment Variables for Frontend
Set these in your Vercel dashboard:

```
VITE_SERVER_URL=https://your-backend-url.railway.app
```

### Build Settings
- **Build Command**: `cd client && npm run build`
- **Output Directory**: `client/dist`
- **Install Command**: `npm run install:all`

## Backend Deployment (Railway)

### Prerequisites
1. Create a Railway account
2. Connect your GitHub repository

### Environment Variables for Backend
Set these in Railway dashboard:

```
PORT=3001
CORS_ORIGIN=https://your-vercel-app.vercel.app
NODE_ENV=production
```

### Deployment Configuration
Railway will automatically detect the Node.js app in the `server/` directory.

## Alternative: Full Vercel Deployment

If you prefer to deploy everything on Vercel (requires WebSocket service replacement):

### 1. Replace Socket.IO with Pusher
```bash
npm install pusher pusher-js
```

### 2. Environment Variables
```
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=your_cluster
```

## Post-Deployment Steps

1. **Update CORS settings** in server to include your Vercel domain
2. **Test microphone permissions** (requires HTTPS)
3. **Configure STUN/TURN servers** for production WebRTC
4. **Test cross-device connectivity**

## HTTPS Requirement

WebRTC requires HTTPS in production for:
- Microphone access (`getUserMedia`)
- Secure WebRTC connections
- Cross-origin requests

Both Vercel and Railway provide HTTPS by default.

## Testing Cross-Device

Once deployed:
1. Open agent interface: `https://your-app.vercel.app/agent`
2. Open customer interface: `https://your-app.vercel.app/customer`
3. Test on different devices/networks
4. Verify audio works across NAT/firewalls
