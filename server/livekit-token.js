const { loadEnvironment } = require('./config/env');
loadEnvironment();

require('dotenv').config();
const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const app = express();

app.get('/api/get-livekit-token', (req, res) => {
  const { room, identity } = req.query;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(500).send('API key/secret not set');
  }
  if (!room || !identity) {
    return res.status(400).send('Missing room or identity');
  }
  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({ roomJoin: true, room });
  res.json({ token: at.toJwt() });
});

const port = process.env.LIVEKIT_TOKEN_PORT || 3002;
app.listen(port, () => console.log(`Token server running on port ${port}`));