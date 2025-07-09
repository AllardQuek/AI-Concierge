# Mulisa Production Environment Variables Guide

## 🚀 Overview

Your Mulisa voice calling platform uses a multi-service architecture with specific environment variable requirements for different deployment platforms:

- **Frontend (Client)**: Deployed on Vercel
- **Backend (Server)**: Deployed on Render
- **Bot Service**: Can be deployed on either platform

## 📋 Environment Variables Checklist

### 🎯 Vercel (Frontend) Environment Variables

#### Required Variables

| Variable | Description | Example Value | Status |
|----------|-------------|---------------|---------|
| `VITE_SERVER_URL` | Backend server URL | `https://mulisa-backend.onrender.com` | ⚠️ **UPDATE REQUIRED** |
| `VITE_BOT_SERVER_URL` | Bot server URL | `https://mulisa-bot.onrender.com` | ⚠️ **UPDATE REQUIRED** |
| `VITE_LIVEKIT_URL` | LiveKit WebRTC server | `wss://your-livekit-url` | ❌ **MISSING** |
| `VITE_LIVEKIT_API_KEY` | LiveKit API key | `your-api-key` | ❌ **MISSING** |
| `VITE_LIVEKIT_API_SECRET` | LiveKit API secret | `your-api-secret` | ❌ **MISSING** |
| `VITE_LIVEKIT_TOKEN_URL` | Token endpoint | `${VITE_SERVER_URL}/api/get-livekit-token` | ⚠️ **DEPENDS ON ABOVE** |

#### How to Add/Update in Vercel:

1. **Via Vercel Dashboard:**
   ```
   1. Go to https://vercel.com/dashboard
   2. Select your project
   3. Go to Settings → Environment Variables
   4. Add/Update each variable
   5. Set Environment: Production
   6. Redeploy your application
   ```

2. **Via Vercel CLI:**
   ```bash
   # Set production environment variables
   vercel env add VITE_SERVER_URL production
   vercel env add VITE_BOT_SERVER_URL production
   vercel env add VITE_LIVEKIT_URL production
   vercel env add VITE_LIVEKIT_API_KEY production
   vercel env add VITE_LIVEKIT_API_SECRET production
   vercel env add VITE_LIVEKIT_TOKEN_URL production
   
   # Redeploy
   vercel --prod
   ```

### 🖥️ Render (Backend) Environment Variables

#### Currently Configured (from render.yaml):
- `NODE_ENV=production` ✅
- `PORT=10000` ✅

#### **CRITICAL MISSING VARIABLES:**

| Variable | Description | Required For | Status |
|----------|-------------|--------------|---------|
| `LIVEKIT_API_KEY` | LiveKit authentication | Voice calling features | ❌ **MISSING** |
| `LIVEKIT_API_SECRET` | LiveKit authentication | Voice calling features | ❌ **MISSING** |
| `AZURE_SPEECH_KEY` | Azure Speech Service | Transcription features | ❌ **MISSING** |
| `AZURE_SPEECH_REGION` | Azure region | Transcription features | ❌ **MISSING** |
| `ALLOWED_ORIGINS` | CORS configuration | Security | ⚠️ **SHOULD ADD** |

#### How to Add/Update in Render:

1. **Via Render Dashboard:**
   ```
   1. Go to https://dashboard.render.com
   2. Select your "mulisa-backend" service
   3. Go to Environment tab
   4. Add each missing variable
   5. Click "Save Changes"
   6. Render will auto-redeploy
   ```

2. **Via render.yaml (recommended for your setup):**
   Update your `render.yaml` file:
   ```yaml
   services:
     - type: web
       name: mulisa-backend
       env: node
       plan: free
       buildCommand: npm install
       startCommand: npm start
       rootDir: ./server
       envVars:
         - key: NODE_ENV
           value: production
         - key: PORT
           value: "10000"
         - key: LIVEKIT_API_KEY
           sync: false  # Add manually via dashboard
         - key: LIVEKIT_API_SECRET
           sync: false  # Add manually via dashboard
         - key: AZURE_SPEECH_KEY
           sync: false  # Add manually via dashboard
         - key: AZURE_SPEECH_REGION
           value: eastus  # Or your preferred region
         - key: ALLOWED_ORIGINS
           value: https://ai-concierge-mulisa.vercel.app,https://ai-concierge-tgjt.vercel.app
   ```

## 🔧 Immediate Action Items

### 1. **Get LiveKit Credentials** (Priority: HIGH)
```bash
# You need to:
1. Sign up at https://livekit.io
2. Create a project
3. Get your API Key and Secret
4. Get your WebSocket URL (format: wss://project-xxxxx.livekit.cloud)
```

### 2. **Get Azure Speech Service Credentials** (Priority: MEDIUM)
```bash
# If you want transcription features:
1. Go to https://portal.azure.com
2. Create a Speech Services resource
3. Get your subscription key and region
```

### 3. **Update CORS Origins** (Priority: HIGH)
Based on your current Vercel deployments, add these origins to Render:
```
https://ai-concierge-mulisa.vercel.app
https://ai-concierge-tgjt.vercel.app
https://ai-concierge-tgjt-allardqueks-projects.vercel.app
```

## 📝 Configuration Templates

### Vercel Environment Variables Template
```bash
# Copy and paste these into Vercel dashboard
VITE_SERVER_URL=https://mulisa-backend.onrender.com
VITE_BOT_SERVER_URL=https://mulisa-bot.onrender.com
VITE_LIVEKIT_URL=wss://your-project-xxxxx.livekit.cloud
VITE_LIVEKIT_API_KEY=your_livekit_api_key
VITE_LIVEKIT_API_SECRET=your_livekit_api_secret
VITE_LIVEKIT_TOKEN_URL=https://mulisa-backend.onrender.com/api/get-livekit-token
```

### Render Environment Variables Template
```bash
# Add these to Render dashboard
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastus
ALLOWED_ORIGINS=https://ai-concierge-mulisa.vercel.app,https://ai-concierge-tgjt.vercel.app
```

## 🚨 Critical Issues to Fix

### 1. **LiveKit Not Configured**
**Impact:** Voice calling features will fail
**Error:** "API key/secret not set" in `/api/get-livekit-token` endpoint

### 2. **CORS Issues Potential**
**Impact:** Frontend may be blocked from accessing backend
**Fix:** Add your Vercel URLs to `ALLOWED_ORIGINS`

### 3. **Azure Transcription Optional**
**Impact:** Transcription features won't work
**Note:** Your server gracefully handles missing Azure config in development, but should be added for production

## 📋 Deployment Checklist

- [ ] **Get LiveKit credentials**
- [ ] **Add LiveKit variables to both Vercel and Render**
- [ ] **Update CORS origins in Render**
- [ ] **Test voice calling functionality**
- [ ] **Optional: Add Azure Speech Service for transcription**
- [ ] **Verify all services are communicating correctly**

## 🔍 Testing Your Configuration

### Frontend Test:
1. Open browser console on your Vercel site
2. Check for any environment variable errors
3. Test the calling functionality

### Backend Test:
1. Visit: `https://mulisa-backend.onrender.com/health`
2. Visit: `https://mulisa-backend.onrender.com/debug`
3. Check logs in Render dashboard

## 🆘 Need Help?

If you encounter issues:
1. Check Render service logs
2. Check Vercel function logs
3. Verify environment variables are saved correctly
4. Ensure both services are running

Your project architecture shows you have everything set up correctly - you just need to add the missing environment variables to make the voice calling features work in production!