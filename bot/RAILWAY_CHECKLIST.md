# Railway Deployment Checklist

## ✅ Pre-Deployment Checklist

### Code Ready
- [x] `mulisa-bot.js` - Main bot file complete
- [x] `package.json` - Dependencies and scripts configured
- [x] `railway.json` - Railway configuration created
- [x] Filesystem operations removed (Railway-compatible)
- [x] In-memory audio storage implemented
- [x] `getMockWisdom()` function added

### Environment Variables Required
- [ ] `LIVEKIT_URL` - Your LiveKit server URL
- [ ] `LIVEKIT_API_KEY` - LiveKit API key
- [ ] `LIVEKIT_API_SECRET` - LiveKit API secret
- [ ] `OPENAI_API_KEY` - OpenAI API key
- [ ] `NODE_ENV=production`
- [ ] `BOT_PORT=4000` (optional, Railway sets PORT)
- [ ] `ALLOWED_ORIGINS` - Comma-separated frontend URLs
- [ ] `ENABLE_TTS=false` (optional)

### Railway Setup
- [ ] Create new Railway project
- [ ] Connect GitHub repository
- [ ] Set root directory to `/bot`
- [ ] Configure all environment variables
- [ ] Deploy and test

## 🚀 Deployment Steps

1. **Create Railway Project**
   ```bash
   # Go to railway.app and create new project
   # Select "Deploy from GitHub repo"
   # Choose your repository
   # Set root directory to: /bot
   ```

2. **Set Environment Variables**
   - Go to Variables tab in Railway
   - Add all required environment variables
   - Set `NODE_ENV=production`

3. **Deploy**
   - Railway will automatically build and deploy
   - Check logs for any errors

4. **Test Deployment**
   ```bash
   # Test health endpoint
   curl https://your-railway-url.railway.app/health
   
   # Expected response:
   {
     "status": "Oracle bot server running",
     "rooms": [],
     "timestamp": "2024-01-01T00:00:00.000Z",
     "oracle": "Mulisa awakened"
   }
   ```

## 🔧 Post-Deployment

1. **Update Frontend**
   - Set `VITE_BOT_SERVER_URL` to your Railway URL
   - Test bot integration

2. **Monitor Logs**
   - Check Railway logs for bot activity
   - Verify room joining/leaving works

3. **Test Oracle Features**
   - Join a room with the bot
   - Verify wisdom generation works
   - Test audio serving (if TTS enabled)

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port binding error | Railway sets `PORT` env var automatically |
| CORS errors | Add frontend URL to `ALLOWED_ORIGINS` |
| LiveKit connection fails | Verify `LIVEKIT_URL` and credentials |
| OpenAI errors | Check API key and billing status |
| Audio not working | TTS is disabled by default, set `ENABLE_TTS=true` |

## 📊 Health Monitoring

Monitor these endpoints:
- `GET /health` - Basic health check
- `GET /active-rooms` - List active rooms
- `GET /room-status?room=room-name` - Specific room status

## 🔄 Updates

To update the bot:
1. Push changes to GitHub
2. Railway will automatically redeploy
3. Check logs for any issues
4. Test functionality 