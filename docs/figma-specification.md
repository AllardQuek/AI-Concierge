# Sybil Architecture Diagram - Figma Design Specification

## 🎨 **Canvas Setup**

### **Document Settings**
- **Canvas Size**: 1920 × 1080px (16:9 aspect ratio)
- **Grid**: 8px base unit grid
- **Background**: Linear gradient from #f8f9fa to #e9ecef

### **Color Palette**
```
Primary Colors:
- Sybil Blue: #1976d2
- Oracle Purple: #7c4dff  
- AI Orange: #ff9800
- Success Green: #4caf50

Secondary Colors:
- Light Blue: #e3f2fd
- Light Purple: #f3e5f5
- Light Orange: #fff8e1
- Light Green: #e8f5e8

Neutral Colors:
- Dark Gray: #424242
- Medium Gray: #757575
- Light Gray: #e0e0e0
- White: #ffffff
```

## 📐 **Layout Grid & Positioning**

### **Main Components Layout**
```
Grid System: 12 columns, 80px gutters

Customer Interface:
- Position: X=160, Y=200
- Size: 280×180px
- Grid: Columns 1-3

Agent Interface:  
- Position: X=1480, Y=200
- Size: 280×180px
- Grid: Columns 10-12

AI Processing Hub:
- Position: X=720, Y=600
- Size: 480×300px
- Grid: Columns 5-8 (centered)

WebRTC Connection:
- Arrow from (440,290) to (1480,290)
- Stroke: 4px, #1976d2
- Style: Double-ended arrow

Audio Taps:
- Customer to AI: Curved path from (300,380) to (800,600)
- Agent to AI: Curved path from (1620,380) to (1120,600)
- Stroke: 3px, #4caf50, dashed (8px dash, 4px gap)
```

## 🎯 **Component Specifications**

### **Customer Interface Box**
```
Container:
- Background: Linear gradient #e3f2fd to #bbdefb
- Border: 3px solid #1976d2
- Border Radius: 12px
- Drop Shadow: 0 4px 12px rgba(25,118,210,0.2)

Header:
- Text: "Customer Interface"
- Font: Inter Bold, 18px, #1565c0
- Position: Top center, 16px padding

Content:
- Font: Inter Regular, 14px, #1976d2
- Line Height: 1.5
- Items with bullet points:
  • Call Request
  • Audio Controls  
  • Status View

Icon:
- Phone icon (Material Design)
- Size: 24×24px
- Color: #1976d2
- Position: Top left corner
```

### **Agent Interface Box**
```
Container:
- Background: Linear gradient #f3e5f5 to #e1bee7
- Border: 3px solid #7c4dff
- Border Radius: 12px
- Drop Shadow: 0 4px 12px rgba(124,77,255,0.2)

Header:
- Text: "Agent Interface + AI Dashboard"
- Font: Inter Bold, 18px, #6a1b9a
- Position: Top center, 16px padding

Content:
- Font: Inter Regular, 14px, #7c4dff
- Items:
  • Call Management
  • AI Dashboard
  • Live Insights
  • Transcription

Icon:
- Headset icon (Material Design)
- Size: 24×24px
- Color: #7c4dff
- Position: Top left corner
```

### **AI Processing Hub**
```
Main Container:
- Background: Linear gradient #fff8e1 to #ffecb3
- Border: 4px solid #ff9800
- Border Radius: 16px
- Drop Shadow: 0 6px 20px rgba(255,152,0,0.3)

Header:
- Text: "AI Processing Hub"
- Subtitle: "Port 5001 - Node.js"
- Font: Inter Bold, 22px, #e65100
- Position: Top center, 20px padding

Sub-components (4 rounded rectangles inside):
1. OpenAI GPT-4o Integration
   - Background: #fff3e0
   - Border: 2px solid #ff9800
   - Icon: 🤖

2. Azure Speech STT
   - Background: #f3e5f5
   - Border: 2px solid #7c4dff  
   - Icon: 🎤

3. Real-time LLM Analysis
   - Background: #e8f5e8
   - Border: 2px solid #4caf50
   - Icon: 🧠

4. Action Recommendation Engine
   - Background: #e3f2fd
   - Border: 2px solid #1976d2
   - Icon: ⚡
```

### **Connection Lines & Arrows**

#### **WebRTC P2P Connection**
```
Path: Straight line with slight curve
Start: Customer Interface (right edge center)
End: Agent Interface (left edge center)
Style:
- Stroke: 4px solid #1976d2
- Arrow heads: Both ends, 12px
- Label: "WebRTC P2P Voice\n~30-50ms latency"
- Label style: Inter Medium, 12px, #1565c0
- Label background: White with border
```

#### **Audio Tap Lines**
```
Customer to AI:
- Path: Bezier curve, subtle arc
- Stroke: 3px dashed #4caf50
- Dash pattern: 8px dash, 4px gap
- Arrow: Single end (toward AI)
- Label: "Audio Chunks (250ms)"

Agent to AI:
- Mirror of customer line
- Same styling
- Label: "Audio Chunks (250ms)"
```

#### **AI to Dashboard Flow**
```
Path: Curved arrow from AI Hub to Agent Interface
Stroke: 3px solid #ff9800
Arrow style: Custom arrow head, 14px
Animation hint: Add small pulse/glow effect
Label: "Live AI Insights\nReal-time Updates"
```

## 🔤 **Typography Scale**

```
Heading 1 (Main Title):
- Font: Inter Black, 32px
- Color: #1976d2
- Letter Spacing: -0.5px

Heading 2 (Component Names):
- Font: Inter Bold, 18-22px
- Color: Component-specific
- Line Height: 1.2

Body Text:
- Font: Inter Regular, 14px
- Color: #424242
- Line Height: 1.5

Labels/Captions:
- Font: Inter Medium, 12px
- Color: #757575
- Line Height: 1.4

Technical Details:
- Font: JetBrains Mono, 11px
- Color: #616161
```

## 🎭 **Visual Effects & Styling**

### **Shadows & Depth**
```
Component Shadows:
- Drop Shadow: 0 4px 12px rgba(0,0,0,0.15)
- Inner Shadow: 0 1px 3px rgba(255,255,255,0.8) inside

Connection Glow:
- WebRTC line: 0 0 8px rgba(25,118,210,0.4)
- Audio taps: 0 0 6px rgba(76,175,80,0.3)
- AI insights: 0 0 10px rgba(255,152,0,0.5)
```

### **Interactive States** (if creating clickable prototype)
```
Hover States:
- Scale: 1.02
- Shadow: Increase blur by 4px
- Border: Brighten by 20%

Active States:
- Scale: 0.98
- Shadow: Reduce by 50%
```

## 📊 **Data Overlay Elements**

### **Performance Metrics Callouts**
```
Latency Badges:
- WebRTC: "30-50ms" in green badge
- AI Pipeline: "~800ms" in orange badge
- Position: Near connection lines

Status Indicators:
- Implemented: ✅ Green checkmark
- In Progress: ⚠️ Orange warning
- Pending: 🔄 Blue loading icon
```

### **Component Status Overlay**
```
Small status badges on each component:
- Customer Interface: "✅ Implemented"
- Agent Interface: "✅ Implemented"  
- AI Hub: "⚠️ Ready - Needs Activation"
- Connections: "🔄 Pending Configuration"

Badge Style:
- Background: Semi-transparent overlay
- Border Radius: 20px
- Font: Inter Medium, 10px
- Padding: 4px 8px
```

## 🎬 **Animation Suggestions** (for presentation)

### **Entry Animations**
```
1. Components fade in from center (0.5s ease-out)
2. Connections draw from start to end (1s ease-in-out)
3. Labels appear with slight scale (0.3s ease-out)
4. Status badges pulse in (0.4s ease-out)
```

### **Interactive Animations**
```
Hover Effects:
- Gentle scale (1.02x)
- Subtle glow increase
- Border color transition

Data Flow Animation:
- Animated dots moving along connection lines
- Pulse effect on AI Hub when processing
- Gentle "breathing" effect on active components
```

## 📱 **Responsive Considerations**

### **Tablet Version (1024×768)**
```
- Reduce component sizes by 20%
- Stack Customer and Agent vertically
- Place AI Hub to the side
- Adjust font sizes down by 2px
```

### **Mobile Version (375×812)**
```
- Vertical stack layout
- Simplify connection lines
- Reduce detail in sub-components
- Focus on key information only
```

## 🛠️ **Figma Implementation Steps**

### **Phase 1: Setup** (15 minutes)
1. Create new Figma file "Sybil Architecture"
2. Set canvas to 1920×1080px
3. Create color styles from palette above
4. Set up 8px grid system
5. Import Inter font family

### **Phase 2: Components** (45 minutes)
1. Create Customer Interface box with content
2. Create Agent Interface box with content
3. Create AI Processing Hub with sub-components
4. Add icons using Material Design plugin
5. Apply shadows and gradients

### **Phase 3: Connections** (30 minutes)
1. Draw WebRTC connection line
2. Create audio tap curves
3. Add AI insight flow
4. Apply line styles and arrows
5. Add connection labels

### **Phase 4: Polish** (30 minutes)
1. Add status badges and overlays
2. Fine-tune spacing and alignment
3. Add performance metric callouts
4. Create hover states
5. Export final version

### **Export Settings**
```
PNG: 2x resolution (3840×2160), transparent background
SVG: Optimized, include fonts
PDF: Print quality, preserve vectors
Figma Link: Public view access for sharing
```

---

## 📥 **Assets Needed**

### **Icons** (Material Design recommended)
- phone, headset, memory, speed, security
- check_circle, warning, refresh
- mic, speaker, chat, analytics

### **Fonts**
- Inter (Google Fonts) - Main UI font
- JetBrains Mono (optional) - Code/technical text

This specification gives you everything needed to create a professional, presentation-ready architecture diagram in Figma that clearly communicates the Sybil system design and current implementation status.
