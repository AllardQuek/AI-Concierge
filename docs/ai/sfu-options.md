It is feasible to build a custom SFU using open-source tools **without paying**, and **mediasoup** is one of the **best** options if you want control without usage-based pricing.

---

## ✅ TL;DR

| Option             | Open Source | Infra Costs    | Self-Host Feasible? | Production-Ready              | Complexity |
| ------------------ | ----------- | -------------- | ------------------- | ----------------------------- | ---------- |
| **LiveKit Cloud**  | ❌ (hosted)  | Paid usage     | ✖️                  | ✅ Yes                         | ⭐⭐⭐ (easy) |
| **LiveKit Server** | ✅ Yes       | Your own infra | ✅ Yes               | ✅ Yes                         | ⭐⭐         |
| **mediasoup**      | ✅ Yes       | Your own infra | ✅ Yes               | ✅ Yes (used by Discord, etc.) | ⭐⭐⭐⭐       |
| **ion-sfu**        | ✅ Yes (Go)  | Your own infra | ✅ Yes               | ✅ Mostly                      | ⭐⭐⭐        |
| **Janus Gateway**  | ✅ Yes       | Your own infra | ✅ Yes               | ✅ Yes                         | ⭐⭐⭐⭐       |

---

## 🥇 Recommendation for DIY, Zero-Usage-Cost SFU

### → **Use mediasoup**

* **Fully open-source, no cloud lock-in**
* **Battle-tested** by companies like Discord and many video platforms
* **Fine-grained control** over media, routing, and subscriptions
* **Node.js or C++ server APIs**
* Works with **React/Next.js + WebRTC** easily

---

## 🏗️ High-Level: How to Use mediasoup

1. **Install mediasoup server**

   * Run it on your VPS, cloud VM (e.g. AWS EC2, Hetzner, Oracle Free Tier)
   * You control signaling, room logic

2. **Use mediasoup-client on frontend**

   * React or plain JS: connect via socket to your signaling server
   * Send/receive tracks via mediasoup SFU

3. **Create router and transports**

   * Senders publish audio/video to the router
   * Receivers subscribe to desired tracks

4. **Inject Mulisa's audio**

   * Create a “bot” server client (like Mulisa) that publishes TTS audio
   * Attach TTS output to an outgoing `Producer` on the SFU

---

## 💰 Zero Cost Infra Tips

| Component                        | Option                                   | Cost          |
| -------------------------------- | ---------------------------------------- | ------------- |
| Server                           | Oracle Cloud Free Tier (ARM VM)          | \$0           |
| STUN                             | `stun:stun.l.google.com:19302`           | Free          |
| TURN (optional for NAT fallback) | OpenRelay (500MB/month) or coturn on VPS | Free / \$5–10 |
| AI APIs                          | Use GPT-4o free tier or your key         | Pay-as-you-go |
| Web hosting                      | Vercel / Netlify (frontend)              | Free tiers    |

You can build and test **fully free**, only paying later as you scale.

---

## ✨ When Would You Need to Pay?

You only pay if:

* You use **LiveKit Cloud** (vs. self-hosted LiveKit or mediasoup)
* You use **more TURN bandwidth** than free plans allow
* You deploy on high-tier VPS instead of free tier

---

## ⚠️ Tradeoffs vs. LiveKit

| Area           | mediasoup (DIY)       | LiveKit (Cloud)           |
| -------------- | --------------------- | ------------------------- |
| Setup time     | Longer                | Instant                   |
| Dev experience | More manual signaling | Great SDKs out-of-the-box |
| Flexibility    | Unlimited             | More opinionated          |
| Hosting        | Self-hosted           | Fully managed             |
| Cost at scale  | Lower long-term       | Higher at scale           |

---

## ✅ Bottom Line

Yes — **you can absolutely build your own SFU** using `mediasoup`, host it cheaply (even free), and keep **full control** over audio routing for Mulisa and all participants.

Would you like:

* A `mediasoup` boilerplate project link?
* A step-by-step guide to deploy it on a free-tier VPS?
* An explanation of how to connect React to your own SFU?
