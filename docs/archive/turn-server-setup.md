# TURN Server Options for WebRTC

## When do you need TURN servers?
- When both users are behind restrictive NATs (corporate firewalls, some mobile networks)
- STUN servers work for ~80% of connections
- TURN servers are needed for the remaining ~20% where direct P2P fails

## Free/Low-cost TURN Server Options:

### 1. **Metered.ca** (Recommended - Pay-as-you-go)
- **Cost**: $0.0004 per GB of relayed traffic
- **Setup**: 5 minutes
- **URL**: https://www.metered.ca/stun-turn
- **Why it's good**: Very affordable, reliable, global infrastructure

### 2. **Twilio TURN**
- **Cost**: ~$0.001-$0.002 per minute
- **Setup**: Through Twilio API
- **Why it's good**: Enterprise-grade, part of Twilio ecosystem

### 3. **Self-hosted TURN server**
- **Cost**: VPS hosting (~$5-20/month)
- **Software**: coturn (open source)
- **Setup**: 30-60 minutes
- **Why it's good**: Full control, predictable costs

### 4. **Xirsys** 
- **Cost**: Free tier available, then paid plans
- **Setup**: Quick signup
- **Why it's good**: WebRTC-focused service

## Example Setup with Metered.ca:

```typescript
// After signing up at metered.ca, you get:
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { 
    urls: 'turn:a.relay.metered.ca:80',
    username: 'your-username-from-metered',
    credential: 'your-password-from-metered'
  },
  { 
    urls: 'turn:a.relay.metered.ca:443',
    username: 'your-username-from-metered',
    credential: 'your-password-from-metered'
  }
];
```

## Current Recommendation:
**Start without TURN servers** - most iPhone-to-iPhone calls will work fine with just STUN. Add TURN only if you get user reports of connection failures.

## Testing Connection Success:
```typescript
// Add this to see connection stats
this.peerConnection.oniceconnectionstatechange = () => {
  const state = this.peerConnection?.iceConnectionState;
  console.log('ICE state:', state);
  if (state === 'failed') {
    console.log('Connection failed - TURN servers might help');
  }
};
```
