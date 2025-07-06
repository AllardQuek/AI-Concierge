# Azure Speech-to-Text Integration Setup

This guide explains how to set up Azure Speech-to-Text for real-time transcription in your voice bot.

## Prerequisites

1. **Azure Account**: You need an Azure account with a Speech resource
2. **Speech Resource**: Create a Speech resource in the Azure portal
3. **API Key & Region**: Get your subscription key and region from the Speech resource

## Setup Steps

### 1. Create Azure Speech Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Speech" and select "Speech service"
3. Click "Create"
4. Fill in the required details:
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new or use existing
   - **Region**: Choose a region close to your users
   - **Name**: Give it a descriptive name (e.g., "voice-bot-speech")
   - **Pricing tier**: Select "Free (F0)" for 5 hours/month
5. Click "Review + create" then "Create"

### 2. Get Your Credentials

1. Go to your Speech resource in Azure Portal
2. In the left menu, click "Keys and Endpoint"
3. Copy **Key 1** and **Region** (e.g., "eastus", "westeurope")

### 3. Set Environment Variables

Add these to your environment or `.env` file:

```bash
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here
```

### 4. Install Dependencies

The Azure Speech SDK is already added to `package.json`. Run:

```bash
npm install
```

## Usage Tracking

The service automatically tracks usage to stay within the free tier limit:

- **Free Tier**: 5 hours/month (18,000 seconds)
- **Tracking**: In-memory counter (resets on server restart)
- **Protection**: Stops accepting new transcriptions when limit is reached
- **Notification**: Clients receive error messages when limit is exceeded

## API Events

### Client to Server
- `start-transcription`: Start a new transcription session
- `audio-chunk`: Send audio data (Uint8Array)
- `stop-transcription`: Stop the current session

### Server to Client
- `transcript-partial`: Partial transcription results
- `transcript-final`: Final transcription results
- `transcription-error`: Error messages (including limit reached)
- `transcription-ended`: Session ended notification

## Testing

1. Start your server: `npm start`
2. Connect a client and start a call
3. Click the transcription button
4. Speak and watch for transcript events in the browser console

## Troubleshooting

### Common Issues

1. **"Invalid subscription key"**: Check your `AZURE_SPEECH_KEY`
2. **"Invalid region"**: Verify your `AZURE_SPEECH_REGION`
3. **"Free tier limit reached"**: Wait until next month or upgrade to paid tier
4. **No audio received**: Check that audio chunks are being sent correctly

### Debug Logs

The service logs detailed information with the `🔊` prefix. Check your server console for:
- Connection events
- Transcription start/stop
- Partial and final transcripts
- Usage tracking
- Error messages

## Cost Management

- **Free Tier**: 5 hours/month included
- **Paid Tier**: Pay per hour after free tier
- **Monitoring**: Check Azure portal for usage analytics
- **Alerts**: Set up spending alerts in Azure to avoid unexpected charges 