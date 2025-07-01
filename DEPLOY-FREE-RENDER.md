# 🆓 Deploy Sybil with Render (Free)

## Why Render for POC?

- ✅ **Completely free** for 750 hours/month  
- ✅ **Auto-deploys** from GitHub
- ✅ **HTTPS included** (required for WebRTC)
- ✅ **Environment variables** support
- ⚠️ **Sleeps after 15min** inactivity (cold starts)

Perfect for POC and testing!

## Step 1: Deploy Backend to Render (Free)

### 1.1 Create Render Account
1. Go to [render.com](https://render.com)
2. **Sign up** with GitHub
3. **Connect** your GitHub account

### 1.2 Deploy Backend
1. **New** → **Web Service**
2. **Connect repository:** `AllardQuek/AI-Concierge`
3. **Configure:**
   - **Name:** `sybil-backend`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Free Plan:** Select this

### 1.3 Set Environment Variables
In Render dashboard → Environment:

```bash
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
```

### 1.4 Deploy
- Click **Create Web Service**
- Wait 2-3 minutes for deployment
- **Copy the Render URL** (e.g., `https://sybil-backend.onrender.com`)

## Step 2: Deploy Frontend to Vercel (Free)

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. **Sign up** with GitHub

### 2.2 Import Project
1. **New Project** → **Import Git Repository**
2. Select `AllardQuek/AI-Concierge`
3. **Configure:**
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 2.3 Set Environment Variables
```bash
VITE_SERVER_URL=https://your-render-url.onrender.com
```

### 2.4 Deploy
- Click **Deploy**
- Wait 2-3 minutes
- **Copy the Vercel URL** (e.g., `https://sybil-voice.vercel.app`)

## Step 3: Update CORS Settings

1. **Go back to Render** dashboard
2. **Update Environment Variables:**
   ```bash
   ALLOWED_ORIGINS=https://your-actual-vercel-url.vercel.app
   ```
3. **Manual Deploy** to apply changes

## ⚡ Managing Cold Starts

Since Render free tier sleeps after 15min:

### Option A: Accept Cold Starts
- First request after 15min takes ~30 seconds
- Subsequent requests are fast
- Perfect for demos and testing

### Option B: Keep-Alive Ping (Optional)
Add this to your frontend for demos:

```javascript
// In your React app, ping every 10 minutes
setInterval(() => {
  fetch(import.meta.env.VITE_SERVER_URL + '/health')
    .catch(() => {}) // Ignore errors
}, 10 * 60 * 1000) // 10 minutes
```

## 🧪 Test Your Free Deployment

### URLs to Test
- **Frontend:** `https://your-app.vercel.app`
- **Backend Health:** `https://your-render-url.onrender.com/health`
- **Agent Interface:** `https://your-app.vercel.app/agent`
- **Customer Interface:** `https://your-app.vercel.app/customer`

### Voice Call Test
1. **Open two browser tabs** (or devices)
2. **Tab 1:** Agent interface
3. **Tab 2:** Customer interface  
4. **Customer:** Click "Request Call"
5. **Agent:** Click "Accept Call"
6. **Test voice communication!**

## 📊 Free Tier Limits

**Render Free:**
- 750 hours/month (more than enough)
- 512MB RAM, 0.1 CPU
- Sleeps after 15min inactivity
- No custom domains (use .onrender.com)

**Vercel Free:**
- 100GB bandwidth/month
- 1000 serverless function invocations
- Custom domains supported
- Global CDN included

## 🚀 Production Upgrade Path

When ready to scale:
1. **Render:** $7/month for always-on instances
2. **Railway:** $5/month usage-based pricing
3. **Add TURN servers** for better NAT traversal

---

## 💡 Cost Summary

**Current Setup: $0/month**
- ✅ Render backend (free tier)
- ✅ Vercel frontend (free tier)
- ✅ GitHub repository (free)
- ✅ WebRTC peer-to-peer (no bandwidth costs)

Perfect for POC, demos, and initial testing! 🎉
