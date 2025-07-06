# Environment Configuration Guide

## Overview

This guide covers the best practices for managing environment variables across development, testing, and production environments. The server environment configuration is standardized with the client approach for consistency.

## Environment File Structure

```
server/
├── env.example           # Template showing available variables
├── .env                  # Default fallback (gitignored)
├── .env.local           # Local development overrides (gitignored)
├── .env.development     # Development environment (gitignored)
├── .env.production      # Production environment (gitignored)
└── .env.test           # Test environment (gitignored)
```

## Loading Priority (Standardized with Client)

Environment variables are loaded in the following order (later files override earlier ones):

1. `.env.${NODE_ENV}` (e.g., `.env.development`, `.env.production`)
2. `.env.local` (always loaded, for local overrides - like client)
3. `.env` (fallback defaults)

## Available Environment Variables

### Server Configuration
- `NODE_ENV`: Environment mode (`development`, `production`, `test`)
- `PORT`: Server port (default: 3001)

### Azure Speech-to-Text
- `AZURE_SPEECH_KEY`: Your Azure Speech service key
- `AZURE_SPEECH_REGION`: Your Azure region (e.g., `eastus`, `westeurope`)

### CORS Configuration
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins

### Feature Flags
- `ENABLE_TRANSCRIPTION`: Enable/disable transcription (default: true)
- `ENABLE_DEBUG`: Enable debug logging (default: false)

### Usage Limits
- `AZURE_FREE_TIER_SECONDS`: Azure free tier limit (default: 18000)

## Setup Instructions

### 1. Development Setup

```bash
# Copy the example file for local development
cp server/env.example server/.env.local

# Edit with your Azure credentials
nano server/.env.local
```

Example `.env.local`:
```env
NODE_ENV=development
AZURE_SPEECH_KEY=your_actual_key_here
AZURE_SPEECH_REGION=eastus
ENABLE_DEBUG=true
```

### 2. Production Setup

Create `.env.production` with production values:
```env
NODE_ENV=production
AZURE_SPEECH_KEY=your_production_key
AZURE_SPEECH_REGION=eastus
ALLOWED_ORIGINS=https://yourdomain.com
ENABLE_DEBUG=false
```

### 3. Testing Setup

Create `.env.test` for testing:
```env
NODE_ENV=test
AZURE_SPEECH_KEY=test_key
AZURE_SPEECH_REGION=test_region
ENABLE_DEBUG=true
```

## Running the Server

### Development
```bash
npm run dev          # Uses NODE_ENV=development
```

### Production
```bash
npm start           # Uses NODE_ENV=production
```

### Testing
```bash
npm test            # Uses NODE_ENV=test
```

### Validation
```bash
npm run validate    # Validates configuration without starting server
```

## Security Best Practices

1. **Never commit environment files** - All `.env*` files are gitignored
2. **Use different keys per environment** - Separate dev/staging/prod keys
3. **Rotate keys regularly** - Update Azure keys periodically
4. **Limit permissions** - Use least-privilege Azure service principals
5. **Monitor usage** - Track Azure Speech service usage

## Troubleshooting

### "Azure not configured" Error
- Check that `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are set
- Verify the environment file is being loaded (check server logs)
- Ensure no typos in variable names

### Environment Variables Not Loading
- Check file permissions on `.env` files
- Verify file paths are correct
- Look for syntax errors in environment files

### Production Deployment Issues
- Ensure all required variables are set in production
- Check that `NODE_ENV=production` is set
- Validate configuration with `npm run validate`

## Azure Speech Service Setup

1. Create an Azure Speech service in the Azure portal
2. Get the key and region from the resource
3. Add them to your environment file
4. Test with a simple speech-to-text call

## Monitoring and Logging

- Server logs show which environment files are loaded
- Azure configuration status is logged on startup
- Debug mode provides detailed logging when `ENABLE_DEBUG=true` 