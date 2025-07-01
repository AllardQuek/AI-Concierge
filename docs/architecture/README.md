# Architecture Management - Quick Start Guide

## 🎯 **System Overview**

This hybrid approach gives you the best of both worlds:
- ✅ **Interactive HTML** - Beautiful visual exploration  
- ✅ **Version-controlled sources** - Easy maintenance and updates
- ✅ **Automated generation** - No manual sync required

## 📁 **File Structure**

```
docs/
├── architecture-visual.html          # 🌐 Interactive HTML (GENERATED)
├── architecture/
│   └── diagrams/
│       ├── system-overview.mmd       # 📝 System architecture source
│       └── port-configuration.mmd    # 📝 Port/service mapping source
└── (other docs...)

scripts/
└── generate-architecture.js          # 🔧 Generation script
```

## 🔄 **Workflow: Making Updates**

### 1. **Edit Diagram Sources**
```bash
# Edit the Mermaid source files
code docs/architecture/diagrams/system-overview.mmd
code docs/architecture/diagrams/port-configuration.mmd
```

### 2. **Regenerate HTML**
```bash
npm run docs:architecture
```

### 3. **View Results**
The script will output the file path - just open it in your browser!

## ✨ **Benefits**

### ✅ **Easy Updates**
- Port changes? Edit one `.mmd` file, regenerate HTML
- New services? Add to source, rebuild automatically
- Architecture changes? Single source of truth

### ✅ **Version Control Friendly**
- Mermaid files are text-based, perfect for Git diffs
- Generated HTML stays up-to-date
- Clear history of architecture evolution

### ✅ **Developer Experience**
- VS Code Mermaid preview extension for live editing
- Simple npm script integration
- Clear separation of content and presentation

## 🔧 **Adding New Diagrams**

1. **Create new `.mmd` file** in `docs/architecture/diagrams/`
2. **Update generation script** to include the new diagram
3. **Run** `npm run docs:architecture`

## 💡 **Quick Example**

```bash
# Make a change to ports or services
echo "graph TD; A[Frontend:3000] --> B[Server:3001]" > docs/architecture/diagrams/simple-ports.mmd

# Regenerate (could be automated on file save)
npm run docs:architecture

# View the updated interactive HTML
open docs/architecture-visual.html
```

## 🚀 **Next Steps**

Want to enhance this further? Consider:
- VS Code task for auto-regeneration on save
- Git hooks to ensure HTML is always current
- Export to PNG/SVG for presentations
- Integration with documentation sites

---

*This approach maintains your beloved interactive HTML while making updates seamless and version-control friendly!*
