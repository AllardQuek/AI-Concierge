# 📐 High-Level Architecture


## Overview
```less
+-----------------------------------------+
|              Mulisa System              |
+----------------+------------------------+
                 |
        +--------v--------+         
        |  React Web App  |  <-- Client (WebRTC)
        +--------+--------+
                 |
        +--------v--------+
        |     SFU/Media    |  <-- LiveKit / mediasoup
        |     Server       |
        +--------+--------+
                 |
   +-------------v-------------+
   |  Real-Time Audio Capture  |
   | +-----------------------+ |
   | | Per-user Audio Streams| |
   | +-----------------------+ |
   +-------------+-------------+
                 |
        +--------v--------+
        |   Mulisa Core    |  <-- Cloud Agent Brain
        | (STT + LLM + TTS)|
        +--------+--------+
                 |
   +-------------v-------------+
   |    External Services      |
   | - Bing / SerpAPI Search   |
   | - Booking / Maps APIs     |
   +---------------------------+
```

## With Clients
```less
Client A (WebRTC)              Client B (WebRTC)
      |                               |
      |                               |
      |------- WebRTC Audio ----------|
                   |
                   ▼
         ┌──────────────────┐
         │      SFU         │ ◄─────── Mulisa joins as 3rd participant
         │ (LiveKit /       │
         │  mediasoup)      │
         └──────────────────┘
                   |
       ┌────────────┴────────────┐
       ▼                         ▼
Audio Stream A           Audio Stream B
       |                         |
       └─────────┬──────────────┘
                 ▼
        ┌─────────────────────┐
        │     STT Module      │ ◄── Azure Speech-to-Text (16kHz audio)
        └─────────────────────┘
                 ▼
        ┌─────────────────────┐
        │    LLM Agent Core   │ ◄── GPT-4o + context memory
        └─────────────────────┘
                 ▼
        ┌─────────────────────┐
        │     TTS Module      │ ◄── Azure Neural TTS (SSML support)
        └─────────────────────┘
                 ▼
        ┌─────────────────────┐
        │  Audio Publisher    │ ──> Injects Mulisa audio into SFU
        └─────────────────────┘
                 ▼
          Speech Response
                 ▼
         ┌──────────────────┐
         │      SFU         │
         └──────────────────┘
        /                      \
       ▼                        ▼
Client A hears Mulisa    Client B hears Mulisa
```

---

## 👥 How Mulisa Joins the Call

### ✅ TL;DR:

Mulisa is implemented as a **virtual WebRTC participant** that:

* Connects to the same SFU as the human users
* Negotiates media tracks like any peer (via ICE/SDP)
* Publishes audio (TTS) and optionally receives audio streams from others (for STT)

---

## 🔁 Detailed Breakdown

### 1. **Mulisa = WebRTC Client**

* Mulisa has her own WebRTC connection, just like a human user.
* She runs a **headless client** (Node.js, Go, or browser-like wrapper) that:

  * Connects to the SFU
  * Performs full **SDP offer/answer exchange**
  * Negotiates ICE candidates
  * Sets up DTLS/SRTP media channels

✅ Yes — **Mulisa needs to do ICE candidate exchange** to establish media transport paths.

---

### 2. **Audio Routing via SFU**

* Once joined, SFU treats Mulisa as a **normal participant**:

  * Other participants publish their audio to the SFU
  * Mulisa subscribes to both audio streams (optionally)
  * When Mulisa responds, she publishes her own audio stream (TTS output)

### 🎧 Inbound:

Mulisa receives streams from A and B for transcription.
These are:

* Optionally mixed by SFU (for simplicity)
* Or kept as individual tracks (for diarization and speaker separation)

### 🔊 Outbound:

Mulisa publishes her synthesized voice (TTS result) as a normal audio track:

* SFU distributes this to A and B as if it's from a third user.

---

### 3. **Authentication & Signaling**

* Mulisa authenticates using API keys or tokens (e.g. JWT for LiveKit)
* She joins rooms via signaling just like other users:

  * Room join → offer/answer → ICE → audio flow
* Can be auto-joined programmatically upon invocation ("Hey, Mulisa")

---

## 🛠 Example: LiveKit Join Flow

1. Mulisa makes a `joinRoom()` call with a server-issued JWT.
2. SFU (LiveKit) sends an SDP offer.
3. Mulisa answers with her capabilities (audio only, maybe no video).
4. ICE negotiation completes (needs STUN/TURN like other clients).
5. Mulisa subscribes to tracks from A and B.
6. On LLM response, Mulisa publishes audio track → SFU sends to A & B.

---

## 📦 What You Need to Implement Mulisa as a Virtual Participant

| Component               | Notes                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| WebRTC client (Node.js) | [node-webrtc](https://github.com/node-webrtc/node-webrtc), [mediasoup-client](https://mediasoup.org/documentation/v3/mediasoup-client/) |
| SFU (e.g., LiveKit)     | Provides media server infra and APIs                                                                                                    |
| TURN server             | Required in real-world mobile networks                                                                                                  |
| TTS pipeline            | Audio must be encoded (e.g., Opus) and injected into MediaStreamTrack                                                                   |
| Audio bridge/buffer     | Receives streams from SFU → STT pipeline                                                                                                |
| Signaling               | Use LiveKit SDK or custom signaling to manage join/leave                                                                                |

---

## 🔐 Bonus: How Mulisa Knows When to Join

Trigger mechanisms:

* Wake word detection from in-call audio (“Hey Mulisa”)
* UI button click on either participant’s side
* External control (e.g., backend server command)

Once triggered:

* Backend authorizes + spins up Mulisa client
* Client joins via WebRTC into SFU
* Begins subscribing + publishing audio

---

Great follow-up — let’s talk through why using **your current direct WebRTC peer-to-peer setup** (i.e. no SFU, just `RTCPeerConnection` between A and B) is **not ideal** for integrating an agent like Mulisa, and why an SFU is recommended.

---

## 🚫 Why Pure P2P WebRTC Isn't Ideal for Mulisa

### 1. **WebRTC Mesh = Full-Mesh Complexity**

If A ↔ B is a direct P2P call, and you now want to add Mulisa (C), you’ll need:

* A ↔ B
* A ↔ Mulisa
* B ↔ Mulisa

That’s **3 peer connections** and a **mesh topology**, which:

* Doesn’t scale beyond 2–3 users
* Adds complexity for audio routing
* Requires **each participant to encode/send to N peers**
* Has **N×N connections**, vs N with SFU

---

### 2. **Audio Routing Becomes Manual**

In P2P:

* You must explicitly forward audio from A and B to Mulisa
* Then synthesize Mulisa’s voice and forward that separately to A and B
* There is **no central router** to control who hears what

⚠️ This creates:

* Sync issues (you need to carefully align timestamps)
* Potential echo/resends
* Increased bandwidth on each client

---

### 3. **Adding/Removing Participants Dynamically is Painful**

You can’t "join" someone to a P2P call without:

* Negotiating a **new peer connection** from scratch
* Restarting ICE (which is disruptive and often causes brief disconnects)
* Handling re-negotiation logic manually

With SFU:

* Mulisa just **joins the room**
* Audio is routed transparently

---

### 4. **Client Bandwidth & Battery Load**

In P2P:

* Each user must send 2 outgoing audio streams (to other peer and to Mulisa)
* On mobile devices (especially 4G/5G), this can kill battery and fail under NAT

With SFU:

* Each user sends **1 upstream**
* And receives only what’s needed (A, B, Mulisa)

---

## ✅ Why SFU Solves These

| Problem                      | P2P (mesh)         | SFU                   |
| ---------------------------- | ------------------ | --------------------- |
| Dynamic participant joining  | Hard               | Easy                  |
| Audio mixing / sync          | Manual             | Handled centrally     |
| Bandwidth scaling            | Poor               | Excellent             |
| Low latency                  | Depends on network | Consistently low      |
| Transcription from one point | You must route     | SFU streams to Mulisa |
| Third party audio injection  | Hacky              | Publish track to SFU  |

---

## 🔄 Still Want to Stick with P2P?

You *can* hack together something like:

1. A & B both send audio to your backend (via WebRTC insertable streams or Web Audio)
2. Backend does STT + LLM + TTS
3. Backend sends audio back **via a separate `MediaStreamTrack`** (not trivial)
4. Inject that track manually into A & B

⚠️ But:

* You’ll need to handle re-negotiation every time
* You’ll double the work on client side
* It gets **extremely brittle**

---

### ✅ Recommendation

If you're serious about:

* Multi-party audio (even just 2+1 like A, B, Mulisa)
* Scalability
* Minimal latency
* Easy maintenance

**Use an SFU (like LiveKit)**. Even their free tier or local Docker image is easy to prototype with and way more production-suited.
