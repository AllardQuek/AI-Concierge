# Mulisa Oracle Bot - Railway Deployment Guide

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Environment Variables**: Gather all required API keys and configuration

## Required Environment Variables

Set these in Railway's environment variables section:

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
LIVEKIT_BOT_IDENTITY=mulisa-oracle

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
BOT_PORT=4000
NODE_ENV=production

# CORS Configuration (comma-separated URLs)
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://your-client-app.com

# Optional Features
ENABLE_TTS=false

# Audio Storage Configuration
AUDIO_STORAGE_TYPE=memory
AUDIO_CLEANUP_DELAY=30000
AUDIO_FILESYSTEM_PATH=/tmp/oracle-audio

# Future Cloud Storage (not implemented yet)
# CLOUD_STORAGE_PROVIDER=s3
# CLOUD_STORAGE_BUCKET=your-bucket-name
# CLOUD_STORAGE_REGION=us-east-1
```

## Deployment Steps

### 1. Create New Railway Project
1. Go to Railway dashboard
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Set the root directory to `/bot`

### 2. Configure Environment Variables
1. In your Railway project, go to "Variables" tab
2. Add all the environment variables listed above
3. Set `NODE_ENV=production`

### 3. Deploy
1. Railway will automatically detect the `package.json` and `railway.json`
2. It will install dependencies and start the bot
3. The bot will be available at your Railway URL

## Health Check

Once deployed, test the bot with:
```
GET https://your-railway-url.railway.app/health
```

Expected response:
```json
{
  "status": "Oracle bot server running",
  "rooms": [],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "oracle": "Mulisa awakened"
}
```

## Bot Endpoints

### Core Endpoints
- `GET /health` - Health check
- `GET /join-room?number1=123&number2=456` - Join a room
- `GET /leave-room?number1=123&number2=456` - Leave a room
- `GET /active-rooms` - List active rooms
- `GET /room-status?room=room-name` - Get room status

### Audio Endpoints
- `GET /oracle-audio/:filename` - Get audio file
- `GET /oracle-audio/:filename/metadata` - Get audio metadata
- `GET /oracle-audio-list` - List all stored audio files

### Analytics Endpoints
- `GET /oracle-analytics` - Get storage and system analytics

## Troubleshooting

### Common Issues:

1. **Port Issues**: Railway automatically sets `PORT` environment variable
2. **CORS Errors**: Ensure `ALLOWED_ORIGINS` includes your frontend URL
3. **LiveKit Connection**: Verify `LIVEKIT_URL` is correct and accessible
4. **OpenAI Errors**: Check API key and billing status
5. **Audio Serving**: Audio files are served from memory (no filesystem required)

### Railway-Specific Notes:

- **Flexible Storage**: Supports memory (default), filesystem, and future cloud storage
- **Memory Storage**: Default for Railway (no filesystem required)
- **Filesystem Storage**: Available for development and persistent storage
- **Cloud Storage**: Framework ready for future AWS S3, Google Cloud Storage integration
- **Analytics**: Built-in metadata tracking and review capabilities
- **Configurable Cleanup**: Adjustable audio retention periods

### Logs:
Check Railway logs for detailed error messages and bot activity.

## Integration with Frontend

Update your frontend's bot server URL to point to your Railway deployment:

```typescript
// In your frontend environment
VITE_BOT_SERVER_URL=https://your-railway-url.railway.app
``` 