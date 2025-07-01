# 🚀 Deployment Guide

## Quick Start

Choose your deployment option:

### 🆓 Free Hosting (Recommended for POCs)

**Backend:** Render.com (750 hours/month free)  
**Frontend:** Vercel (Unlimited for personal projects)

### 💰 Paid Hosting (Production)

**Backend:** Railway ($5/month), DigitalOcean, AWS  
**Frontend:** Vercel Pro, Netlify Pro

---

## Option 1: Free Deployment (Render + Vercel)

### Step 1: Deploy Backend to Render

1. **Go to [render.com](https://render.com)** and sign up with GitHub
2. **New Web Service** → Connect your repository
3. **Configure:**
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
4. **Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=10000
   ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
   ```
5. **Deploy** and note your Render URL

### Step 2: Deploy Frontend to Vercel

1. **Go to [vercel.com](https://vercel.com)** and sign up with GitHub
2. **Import Project** → Select your repository
3. **Configure:**
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables:**
   ```env
   VITE_SERVER_URL=https://your-render-url.onrender.com
   ```
5. **Deploy** and note your Vercel URL

### Step 3: Update CORS

1. **Go back to Render dashboard**
2. **Update environment variable:**
   ```env
   ALLOWED_ORIGINS=https://your-actual-vercel-url.vercel.app
   ```
3. **Redeploy** the service

---

## Option 2: Railway + Vercel (Premium Free Tier)

Railway offers $5/month in free credits, which is usually sufficient for POCs.

### Step 1: Deploy Backend to Railway

1. **Go to [railway.app](https://railway.app)** and sign up
2. **Deploy from GitHub** → Select your repository
3. **Settings:**
   - Railway auto-detects the Node.js app in `/server`
4. **Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=8080
   ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
   ```
5. **Deploy** and note your Railway URL

### Step 2: Deploy Frontend to Vercel

(Same as Option 1, Step 2 above)

---

## Testing Your Deployment

### Basic Health Checks
- [ ] Visit frontend: `https://your-app.vercel.app`
- [ ] Check backend health: `https://your-backend-url/health`
- [ ] Agent interface: `https://your-app.vercel.app/agent`
- [ ] Customer interface: `https://your-app.vercel.app/customer`

### Voice Communication Tests
- [ ] **Cross-Device**: Open agent on one device, customer on another
- [ ] **Microphone Access**: HTTPS enables microphone permissions
- [ ] **Voice Call Flow**: Customer → Agent → Voice both ways
- [ ] **Controls**: Mute/unmute, end call, local monitoring (🎧)

### Local Testing (Same Device)
- **Echo Prevention**: Use headphones to prevent feedback loops
- **Alternative**: Test with one side muted (use mute button)
- **Cross-Browser**: Try different browsers (Chrome/Edge + Firefox)
- **Incognito Mode**: One window normal, one incognito

---

## Troubleshooting

### Connection Issues

- Verify CORS settings match exact URLs (including https://)
- Check if services are running via health endpoints
- Ensure environment variables are set correctly

### WebRTC Issues

- Test on HTTPS only (required for microphone access)
- Use Chrome/Edge for best WebRTC support
- Check browser console for detailed error messages

### Connection Stability Issues

If you see the connection status jumping between connected/disconnected:

- **Browser throttling**: Keep the tab active during calls
- **Network instability**: Check WiFi/cellular signal strength
- **Server overload**: Monitor server logs for high CPU/memory usage
- **CORS issues**: Ensure exact URL matches in environment variables
- **Firewall blocking**: Some corporate networks block WebSocket connections

#### Debugging Connection Issues

1. **Open browser console** and look for reconnection messages
2. **Check server logs** for connection/disconnection patterns
3. **Test with different browsers** (Chrome vs Firefox vs Safari)
4. **Try different networks** (WiFi vs mobile hotspot)
5. **Monitor server health** endpoint during connection issues

### Cold Start Issues (Render)
- Render free tier sleeps after 15min inactivity
- First request after sleep takes 10-30 seconds
- Consider using Railway ($5/month) for no cold starts

#### How to Wake Up Sleeping Service
- **Automatic**: Visit frontend → socket connection wakes backend
- **Manual**: Visit `https://your-backend-url.onrender.com/health`
- **Command line**: `curl https://your-backend-url.onrender.com/health`
- **Dashboard**: Render dashboard → Manual Deploy

#### Keep-Alive Options (Optional)
- **UptimeRobot**: Free service to ping every 5 minutes
- **Cron-job.org**: Schedule health checks
- **GitHub Actions**: Scheduled workflow to ping service
- ⚠️ Note: Excessive pinging may violate Render's fair use policy

---

## Production Considerations

### Security
- All traffic uses HTTPS
- CORS properly configured  
- No sensitive data in client code

### Performance
- WebRTC P2P reduces server load
- CDN delivery via Vercel
- Consider TURN servers for enterprise NAT traversal

### Monitoring
- Check Render/Railway dashboards for uptime
- Monitor Vercel for build/deployment status
- Set up error tracking (Sentry, LogRocket)

---

## URLs After Deployment

Update these with your actual URLs:

- **Frontend:** `https://sybil-voice.vercel.app`
- **Backend:** `https://sybil-backend.onrender.com`
- **Agent:** `https://sybil-voice.vercel.app/agent`  
- **Customer:** `https://sybil-voice.vercel.app/customer`
- **Health:** `https://sybil-backend.onrender.com/health`

🎉 **Success!** Your Sybil voice platform is now live and ready for testing!
