# 🚀 Deploy Sybil NOW - Step by Step

Your Sybil voice platform is **READY FOR DEPLOYMENT**! Follow these steps to get it live:

## 📋 Quick Deployment Checklist

### Step 1: Deploy Backend to Railway ⚡

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login** with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. **Select:** `AllardQuek/AI-Concierge` repository
5. **Root Directory:** `/server` (important!)
6. **Add Environment Variables:**
   ```
   NODE_ENV=production
   PORT=8080
   ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
   ```
7. **Deploy** and **note the Railway URL** (e.g., `https://your-app.railway.app`)

### Step 2: Deploy Frontend to Vercel 🌐

1. **Go to [Vercel.com](https://vercel.com)**
2. **Sign up/Login** with GitHub
3. **Import Project** → Select `AllardQuek/AI-Concierge`
4. **Framework Preset:** Vite
5. **Root Directory:** `/client`
6. **Build Command:** `npm run build`
7. **Output Directory:** `dist`
8. **Add Environment Variable:**
   ```
   VITE_SERVER_URL=https://your-railway-url.railway.app
   ```
9. **Deploy** and **note the Vercel URL**

### Step 3: Update CORS Settings 🔄

1. **Go back to Railway**
2. **Update Environment Variables:**
   ```
   ALLOWED_ORIGINS=https://your-actual-vercel-url.vercel.app
   ```
3. **Redeploy** the Railway service

## 🧪 Test Your Deployment

1. **Open your Vercel URL** in two different browsers/devices
2. **Test voice calls:**
   - One browser: Customer interface
   - Other browser: Agent interface
   - Click "Start Call" and test voice communication
3. **Test features:**
   - ✅ Microphone access
   - ✅ Voice transmission
   - ✅ Mute/unmute
   - ✅ Local audio monitoring (🎧)
   - ✅ Call end/cleanup

## 📝 Current URLs

After deployment, update these in your notes:

- **Frontend (Vercel):** `https://_____.vercel.app`
- **Backend (Railway):** `https://_____.railway.app`
- **GitHub Repo:** `https://github.com/AllardQuek/AI-Concierge`

## 🔧 Troubleshooting

**Build fails on Vercel?**
- Ensure root directory is `/client`
- Ensure build command is `npm run build`
- Check environment variables are set

**WebRTC not working?**
- Test on HTTPS only (required for microphone access)
- Try different browsers (Chrome/Edge recommended)
- Check browser console for errors

**Backend connection issues?**
- Verify Railway URL in Vercel environment variables
- Check CORS settings on Railway
- Ensure both services are deployed

## 🎯 Next Steps After Deployment

1. **Cross-device testing** - Test on phones, tablets, different networks
2. **Performance monitoring** - Check Railway and Vercel dashboards
3. **Re-enable AI features** - Once deployment is stable
4. **Add TURN servers** - For better NAT traversal if needed

---

## 💡 Quick Commands Reference

**Test build locally:**
```bash
cd client && npm run build
```

**Test server locally:**
```bash
cd server && npm start
```

**Check environment:**
```bash
# In client/
cat .env.production

# In server/
echo $ALLOWED_ORIGINS
```

---

🎉 **You're ready to deploy!** Both Railway and Vercel have excellent GitHub integration and will auto-deploy on future commits.
