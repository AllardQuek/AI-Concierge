# Bot Troubleshooting Guide

## Common Issues & Solutions

### 1. Module Not Found Errors

**Error**: `Cannot find module 'openai'` (or any other module)

**Solution**: Install dependencies
```bash
cd bot
npm install
```

**Prevention**: Always run `npm install` after cloning or pulling changes

### 2. Environment Variables Missing

**Error**: Bot starts but shows "NOT SET" for API keys

**Solution**: Create environment file
```bash
# Copy example (if available)
cp .env.example .env.local

# Or create manually
touch .env.local
```

**Required Variables**:
```bash
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

### 3. Port Already in Use

**Error**: `EADDRINUSE: address already in use :::4000`

**Solution**: 
```bash
# Kill process using port 4000
lsof -ti:4000 | xargs kill -9

# Or use different port
BOT_PORT=4001 npm run dev
```

### 4. LiveKit Connection Issues

**Error**: Bot can't connect to LiveKit

**Check**:
- `LIVEKIT_URL` is correct and accessible
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are valid
- Network connectivity to LiveKit server

### 5. OpenAI API Errors

**Error**: OpenAI API calls failing

**Check**:
- `OPENAI_API_KEY` is valid and has credits
- API key has proper permissions
- Rate limits not exceeded

### 6. Storage Issues

**Error**: Audio storage failing

**Check**:
- `AUDIO_STORAGE_TYPE` is set correctly
- For filesystem: directory is writable
- For memory: sufficient RAM available

## Development Commands

### Start Bot
```bash
npm run dev
```

### Install Dependencies
```bash
npm install
```

### Check Dependencies
```bash
npm list --depth=0
```

### Test Health Endpoint
```bash
curl http://localhost:4000/health
```

## Log Analysis

### Bot Startup Logs
Look for:
- ✅ Environment variables loaded
- ✅ LiveKit credentials set
- ✅ OpenAI API key set
- ✅ Server listening on port

### Runtime Logs
Look for:
- 🔮 Oracle wisdom generation
- 🎧 Audio processing
- 👋 Room join/leave events
- ❌ Error messages

## Performance Issues

### High Memory Usage
- Check `AUDIO_CLEANUP_DELAY` setting
- Monitor memory storage size
- Consider shorter cleanup intervals

### Slow Response Times
- Check OpenAI API response times
- Monitor LiveKit connection latency
- Review wisdom generation frequency

## Railway Deployment Issues

### Build Failures
- Ensure `railway.json` is in bot directory
- Check `package.json` has correct scripts
- Verify all dependencies are listed

### Runtime Errors
- Check Railway logs for detailed errors
- Verify environment variables are set
- Test locally before deploying

## Getting Help

1. **Check Logs**: Look for error messages in console output
2. **Test Endpoints**: Use health check and analytics endpoints
3. **Verify Environment**: Ensure all required variables are set
4. **Check Dependencies**: Run `npm install` and verify packages
5. **Review Documentation**: Check `DEPLOYMENT.md` and `STORAGE_STRATEGY.md` 