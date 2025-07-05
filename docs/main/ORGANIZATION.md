# 📁 Repository Organization

## Root Directory Files

### Core Files
- **`README.md`** - Main project documentation and getting started guide
- **`package.json`** - Root package.json for workspace management
- **`.gitignore`** - Git ignore rules
- **`Dockerfile`** - Container deployment option

### Configuration Files
- **`vercel.json`** - Vercel frontend deployment config
- **`railway.json`** - Railway backend deployment config  
- **`render.yaml`** - Render.com deployment config

### Directories
- **`client/`** - React frontend application
- **`server/`** - Node.js backend application
- **`docs/`** - Comprehensive documentation
- **`scripts/`** - Utility scripts

## Documentation Structure

### `/docs` Directory
- **`DEPLOYMENT.md`** - Complete deployment guide (free + paid options)
- **`deployment-checklist.md`** - Step-by-step deployment checklist
- **`voice-testing-guide.md`** - Voice communication testing procedures
- **`architecture/`** - Technical architecture documents
- **`decisions/`** - Architecture Decision Records (ADRs)

## Best Practices Applied

✅ **Clean Root**: Only essential config files in root directory  
✅ **Organized Docs**: All documentation in `/docs`  
✅ **Single Deployment Guide**: Consolidated deployment instructions  
✅ **Clear Structure**: Logical organization by purpose  
✅ **Reduced Clutter**: Removed redundant markdown files  

## Previous Cleanup

Removed from root directory:
- `DEPLOY-FREE-RENDER.md` (consolidated into `docs/DEPLOYMENT.md`)
- `DEPLOY-NOW.md` (consolidated)
- `DEPLOY.md` (consolidated)  
- `DEPLOYMENT-STATUS.md` (consolidated)
- `DEPLOYMENT.md` (moved to `docs/`)
- `DEVELOPMENT-STATUS.md` (merged into README)
- `FREE-DEPLOYMENT-GUIDE.md` (consolidated)
- `FREE-DEPLOYMENT-OPTIONS.md` (consolidated)
- `READY-TO-DEPLOY.md` (consolidated)

Now the repository follows standard practices with a clean root directory and organized documentation structure.
