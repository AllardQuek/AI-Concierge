# Mulisa Architecture Diagrams - WebRTC Voice Calling App

## 🖼️ Mermaid Diagrams (GitHub/VS Code Compatible)

### Current System Architecture
```mermaid
graph TD
    U1[User 1<br/>Phone: +65 1234 5678] -->|WebRTC Audio| U2[User 2<br/>Phone: +65 8765 4321]
    U2 -->|WebRTC Audio| U1
    
    U1 -->|Socket.IO Signaling| S[Signaling Server<br/>Port 5000]
    U2 -->|Socket.IO Signaling| S
    
    subgraph "WebRTC P2P"
        direction TB
        ICE[ICE Negotiation]
        SDP[SDP Exchange]
        AUDIO[Direct Audio Stream]
    end
    
    S -->|Facilitates| ICE
    ICE --> SDP
    SDP --> AUDIO
    
    style U1 fill:#e1f5fe
    style U2 fill:#e1f5fe
    style S fill:#fff3e0
    style AUDIO fill:#e8f5e8
```

### Component Architecture
```mermaid
graph TB
    subgraph "Frontend (React + TypeScript)"
        LP[LandingPage.tsx<br/>• Phone number input<br/>• Call state management<br/>• Audio controls]
        
        subgraph "Services"
            SOC[socket.ts<br/>Socket.IO client]
            WEB[webrtc.ts<br/>WebRTC peer connection]
        end
        
        subgraph "UI Components"
            BTN[Button.tsx]
            TXT[TextInput.tsx]
            STAT[ConnectionStatus.tsx]
            ICO[Icons.tsx]
        end
    end
    
    subgraph "Backend (Node.js)"
        SIG[Express + Socket.IO Server<br/>Port 5000<br/>• WebRTC signaling only<br/>• No audio processing]
    end
    
    LP --> SOC
    LP --> WEB
    SOC --> SIG
    WEB -.->|P2P Audio| WEB
    
    style LP fill:#e3f2fd
    style SIG fill:#fff8e1
    style WEB fill:#e8f5e8
```

### Call Flow Sequence
```mermaid
sequenceDiagram
    participant U1 as User 1 (Caller)
    participant S as Signaling Server
    participant U2 as User 2 (Callee)

    U1->>S: Enter phone number & initiate call
    S->>U2: Incoming call notification
    Note over U2: Phone rings, user can accept/decline

    alt User accepts call
        U2->>S: Accept call
        S->>U1: Call accepted

        Note over U1,U2: WebRTC ICE/SDP Exchange via Server
        U1->>S: ICE candidates & SDP offer
        S->>U2: Forward ICE/SDP
        U2->>S: ICE candidates & SDP answer
        S->>U1: Forward ICE/SDP

        Note over U1,U2: Direct P2P Audio Connection Established
        U1->>U2: WebRTC Audio Stream
        U2->>U1: WebRTC Audio Stream

        Note over U1,U2: Call duration tracking, mute/unmute controls

        alt Either user ends call
            U1->>S: End call
            S->>U2: Call ended
        end

    else User declines call
        U2->>S: Decline call
        S->>U1: Call declined
    end
```


## 🎯 Key Architecture Principles

### WebRTC Peer-to-Peer Design
![alt text](images/image.png)
*https://www.metered.ca/tools/openrelay/stun-servers-and-friends/*

![alt text](images/image-1.png)
*https://www.metered.ca/tools/openrelay/*

```mermaid
graph LR
    subgraph "Traditional Server-Based"
        U1A[User 1] --> SA[Server] --> U2A[User 2]
        SA --> U1A
        note1[Audio travels through server<br/>Higher latency, server load]
    end
    
    subgraph "Mulisa WebRTC P2P"
        U1B[User 1] -.->|Direct Audio| U2B[User 2]
        U1B --> SB[Signaling Server]
        SB --> U2B
        U2B -.->|Direct Audio| U1B
        note2[Server only for setup<br/>Audio bypasses server]
    end
    
    style SA fill:#ffcdd2
    style SB fill:#c8e6c9
    style note1 fill:#ffebee
    style note2 fill:#e8f5e8
```

### Phone Number Processing Flow
```mermaid
graph TD
    INPUT[User enters phone number]
    --> NORMALIZE[Normalize international format]
    --> VALIDATE[Validate number format]
    --> FORMAT[Format for display<br/>+65 XXXX XXXX]
    --> STORE[Store in call state]
    --> SIGNAL[Use for Socket.IO room/identity]
    
    NORMALIZE -.-> SG[Singapore +65<br/>Special formatting]
    NORMALIZE -.-> INTL[Other countries<br/>Standard formatting]
    
    style INPUT fill:#e3f2fd
    style FORMAT fill:#e8f5e8
    style SIGNAL fill:#fff3e0
```

## 📱 Mobile Compatibility Architecture

### Audio Stream Handling
- **getUserMedia()**: Works on mobile browsers (Chrome, Safari, Firefox)
- **WebRTC MediaStream**: Direct audio transmission
- **No Server Processing**: Audio never touches the server
- **Low Latency**: Direct peer-to-peer connection

### Mobile Considerations
- **HTTPS Required**: WebRTC getUserMedia requires secure context
- **Permission Handling**: Microphone access permissions
- **Network Adaptation**: ICE servers for NAT traversal
- **UI Responsiveness**: Touch-friendly interface

## 🔧 Technical Implementation Details

### File Structure
```
client/src/
├── components/
│   ├── LandingPage.tsx          # Main UI (all call states)
│   └── shared/                  # Reusable components
├── services/
│   ├── socket.ts               # Socket.IO signaling
│   └── webrtc.ts              # WebRTC peer connections
└── main.tsx                   # App entry point

server/
└── index.js                  # Express + Socket.IO server
```

### Port Configuration
- **Frontend**: Port 5173 (Vite dev server)
- **Backend**: Port 5000 (Socket.IO signaling)
- **Production**: Single port via static file serving

### Environment Support
- **Development**: Separate frontend/backend ports
- **Production**: Backend serves frontend static files
- **Deployment**: Railway, Render, Vercel compatible

## 🌐 International Number Support

### Formatting Examples
```
Input: "81234567"           → Output: "+65 8123 4567" (Singapore)
Input: "+1234567890"        → Output: "+1 234 567 890" (US)
Input: "+442071234567"      → Output: "+44 207 123 4567" (UK)
Input: "+33123456789"       → Output: "+33 1 23 45 67 89" (France)
```

### Singapore Optimization
- **Default Country**: Singapore (+65)
- **Format**: "+65 XXXX XXXX"
- **Validation**: 8-digit local numbers
- **Demo Numbers**: Generated in Singapore format

This architecture provides a clean, scalable, and international-ready voice calling solution with minimal server overhead and maximum audio quality through direct peer-to-peer WebRTC connections.
        <mxCell id="audio2" value="" style="endArrow=classic;html=1;strokeColor=#4caf50;strokeWidth=2;" 
                 edge="1" parent="1" source="agent" target="ai">
        </mxCell>
        
        <!-- AI to Dashboard -->
        <mxCell id="insights" value="" style="endArrow=classic;html=1;strokeColor=#ff9800;strokeWidth=2;" 
                 edge="1" parent="1" source="ai" target="agent">
          <mxGeometry width="50" height="50" relative="1" as="geometry">
            <mxPoint x="400" y="350" as="sourcePoint"/>
            <mxPoint x="500" y="250" as="targetPoint"/>
          </mxGeometry>
        </mxCell>
        <mxCell id="insights-label" value="Live AI Insights" 
                 style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;" 
                 vertex="1" parent="1">
          <mxGeometry x="450" y="290" width="80" height="20" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## 🚀 Figma Design Specifications

### Layout Structure
```
Canvas Size: 1920 x 1080px
Grid: 8px base unit
Color Palette:
- Primary: #1976d2 (Blue)
- Secondary: #7c4dff (Purple) 
- Accent: #ff9800 (Orange)
- Success: #4caf50 (Green)
- Background: #f5f5f5 (Light Gray)

Component Hierarchy:
1. Customer Interface (Left): 300x200px
2. Agent Interface (Right): 300x200px  
3. WebRTC Connection (Center): Arrow, 3px stroke
4. AI Hub (Bottom Center): 400x250px
5. Audio Taps: Dashed arrows, 2px stroke
6. Insight Flow: Curved arrow to dashboard
```

### Component Details
```
Customer Interface Box:
- Background: #e3f2fd
- Border: 2px solid #1976d2
- Border Radius: 8px
- Typography: Inter, 14px, #1565c0
- Icons: Material Design, 20px

Agent Interface Box:
- Background: #f3e5f5  
- Border: 2px solid #7c4dff
- Border Radius: 8px
- Typography: Inter, 14px, #6a1b9a

AI Processing Hub:
- Background: #fff8e1
- Border: 2px solid #ff9800
- Border Radius: 12px
- Typography: Inter, 16px, #e65100
- Sub-components: 4 rounded rectangles inside
```

## 📋 **Recommendations**

### **For Professional Presentation:**
1. **Figma** - Best for stakeholder presentations
2. **Draw.io** - Great balance of professional + easy
3. **Mermaid** - Perfect for technical documentation

### **For Development/Documentation:**
1. **Mermaid** - Integrates with GitHub/GitLab
2. **PlantUML** - Excellent for detailed technical diagrams
3. **ASCII** - Version control friendly

### **Quick Visual Creation:**
1. **Excalidraw** - Hand-drawn style, very quick
2. **Whimsical** - Professional flowcharts
3. **Lucidchart** - Enterprise-grade diagrams

Would you like me to:

1. **Create a detailed Figma specification** with exact measurements and styling?
2. **Generate a Mermaid diagram** you can copy-paste into GitHub?
3. **Create a Draw.io XML file** you can import directly?
4. **Design a custom visual format** for your specific needs?

Let me know which approach interests you most, and I'll provide exactly what you need!
