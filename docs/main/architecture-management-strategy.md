# Sybil Architecture Management Strategy

## 🎯 **Architecture Documentation Strategy**

### 📁 **Proposed File Structure**
```
docs/architecture/
├── README.md                          # Architecture overview & index
├── diagrams/
│   ├── mermaid-sources/               # Source truth for all diagrams
│   │   ├── system-overview.mmd        # Main architecture
│   │   ├── data-flow.mmd             # Sequence diagrams
│   │   ├── component-map.mmd         # Integration mapping
│   │   ├── port-config.mmd           # Service ports & networking
│   │   └── performance.mmd           # Latency & performance
│   ├── generated/                     # Auto-generated outputs
│   │   ├── architecture-visual.html   # Interactive HTML (generated)
│   │   ├── system-overview.svg       # Static exports
│   │   └── component-map.png         # PNG exports
│   └── templates/
│       └── html-template.html         # Base template for generation
├── specifications/
│   ├── port-configuration.md         # Current: detailed port specs
│   ├── ai-architecture.md            # Current: AI system specs
│   └── performance-requirements.md   # Performance targets
└── visual-architecture.md            # Current: comprehensive overview
```

## 🔄 **Workflow: Single Source Management**

### 1. **Mermaid Files as Source Truth**
- All diagram logic lives in `.mmd` files
- Version controlled, diff-able, easy to edit
- Can be edited in VS Code with Mermaid extension

### 2. **Automated Generation Pipeline**
```bash
# Package.json scripts
"docs:generate": "npm run docs:html && npm run docs:export",
"docs:html": "mermaid-cli -i docs/architecture/diagrams/mermaid-sources/ -o docs/architecture/diagrams/generated/",
"docs:export": "mermaid-cli -i docs/architecture/diagrams/mermaid-sources/ -o docs/architecture/diagrams/generated/ -f svg,png",
"docs:serve": "live-server docs/architecture/diagrams/generated/",
"docs:watch": "chokidar 'docs/architecture/diagrams/mermaid-sources/*.mmd' -c 'npm run docs:generate'"
```

### 3. **VS Code Integration**
- Mermaid preview extension for live editing
- Auto-generate on file save
- Integrated with existing tasks

## 🛠️ **Implementation Plan**

### Phase 1: Restructure (30 minutes)
- [ ] Create new directory structure
- [ ] Extract Mermaid diagrams from HTML into `.mmd` files
- [ ] Create HTML template for generation
- [ ] Set up package.json scripts

### Phase 2: Automation (15 minutes)
- [ ] Install mermaid-cli: `npm install -g @mermaid-js/mermaid-cli`
- [ ] Create VS Code task for auto-generation
- [ ] Test generation pipeline

### Phase 3: Integration (15 minutes)
- [ ] Update existing documentation references
- [ ] Create architecture README with usage guide
- [ ] Add to development workflow

## 📋 **Benefits of This Approach**

### ✅ **Single Source of Truth**
- All diagrams defined in version-controlled `.mmd` files
- No manual sync between formats
- Easy to update ports, services, or architecture changes

### ✅ **Multiple Output Formats**
- Interactive HTML for exploration
- Static SVG/PNG for presentations
- Markdown embedding support

### ✅ **Developer Experience**
- VS Code preview and editing
- Auto-generation on save
- Live reload during development

### ✅ **Maintenance**
- Update one `.mmd` file → all formats regenerate
- Clear separation of content and presentation
- Easy to add new diagram types

## 🎨 **Enhanced Features**

### 1. **Smart Templates**
```html
<!-- Template with placeholders -->
<div class="diagram-container" data-diagram="{{DIAGRAM_NAME}}">
    <h3>{{DIAGRAM_TITLE}}</h3>
    <div class="mermaid">{{DIAGRAM_CONTENT}}</div>
</div>
```

### 2. **Metadata Integration**
```yaml
# In each .mmd file header
---
title: "System Architecture Overview"
description: "High-level view of Sybil's service architecture"
lastUpdated: "2025-07-01"
version: "1.2.0"
---
```

### 3. **Automated Port Updates**
```javascript
// Build script that reads actual port config and updates diagrams
const updatePortsInDiagrams = () => {
  const serverPort = getPortFromFile('server/index.js');
  const aiPort = getPortFromFile('server/ai-service.js');
  // Update .mmd files with actual ports
};
```

## 🚀 **Immediate Action Items**

1. **Keep Current HTML** - It's working well as interactive reference
2. **Add Mermaid Source Files** - Extract diagrams to `.mmd` format
3. **Create Generation Script** - Simple Node.js script to rebuild HTML
4. **Update Workflow** - Add architecture updates to development process

## 💡 **Quick Win Implementation**

Want me to implement this approach? I can:
1. Create the directory structure
2. Extract current diagrams to `.mmd` files  
3. Set up a simple generation script
4. Update the existing HTML with generated content

This would give you the best of both worlds - easy maintenance and beautiful interactive output!
