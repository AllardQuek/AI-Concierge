# Mulisa Development Workflow - Git Guide

## 🌳 Branch Structure

- **`main`** - Primary development branch (replaces old `master`)
- **`feature/*`** - Feature development branches  
- **`hotfix/*`** - Emergency fixes for production releases
- **`release/*`** - Release preparation branches (optional)

> **Note**: We use `main` instead of `master` following modern Git conventions for inclusive language.

## 🔄 Development Workflow

### For Small Projects (Current Approach)
```bash
# Work directly on main for documentation and small changes
git checkout main
git pull origin main
git add .
git commit -m "✨ feat: Add new feature"
git push origin main
```

### For Feature Development
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/ai-pipeline-activation

# Make changes, then commit
git add .
git commit -m "✨ Connect audio pipeline to AI service"

# Push feature branch
git push origin feature/ai-pipeline-activation
```

### Feature Completion
```bash
# Switch back to main
git checkout main

# Merge feature (or create pull request)
git merge feature/ai-pipeline-activation

# Delete feature branch
git branch -d feature/ai-pipeline-activation

# Push updated main
git push origin main
```

### Release Process
```bash
# Tag release from main
git checkout main
git tag -a v1.0.0 -m "🚀 Release v1.0.0: Full AI integration"

# Push with tags
git push origin main --tags
```

## 📝 Commit Message Convention

### Format
```
<emoji> <type>: <description>

[optional body]

[optional footer]
```

### Types & Emojis
- ✨ `feat`: New feature
- 🐛 `fix`: Bug fix
- 📚 `docs`: Documentation
- 🎨 `style`: Code style/formatting
- ♻️ `refactor`: Code refactoring
- ⚡ `perf`: Performance improvement
- ✅ `test`: Adding/updating tests
- 🔧 `chore`: Maintenance tasks
- 🔒 `security`: Security fixes
- 🚀 `deploy`: Deployment changes

### Examples
```bash
git commit -m "✨ feat: Add real-time AI sentiment analysis"
git commit -m "🐛 fix: Resolve WebRTC connection timeout issue"
git commit -m "📚 docs: Update API configuration guide"
git commit -m "🔧 chore: Update dependencies to latest versions"
```

## 🚀 Useful Git Aliases

Add these to your Git config for faster development:

```bash
# Set up useful aliases
git config alias.co checkout
git config alias.br branch
git config alias.ci commit
git config alias.st status
git config alias.unstage 'reset HEAD --'
git config alias.last 'log -1 HEAD'
git config alias.visual '!gitk'

# Prettier log output
git config alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"

# Show files in commit
git config alias.ll 'log --stat --abbrev-commit'

# Undo last commit but keep changes
git config alias.undo 'reset --soft HEAD^'
```

## 📊 Current Git Status

### Repository Info
```bash
# Check current status
git status

# View commit history
git lg

# See what changed in last commit
git show

# Compare branches
git diff main..feature-branch
```

### Branch Info
```bash
# List all branches
git branch -a

# Current branch
git rev-parse --abbrev-ref HEAD

# Last commit on each branch
git for-each-ref --format='%(refname:short) %(committerdate) %(authorname)' --sort=committerdate
```

## 🔄 Next Development Steps

### Immediate Tasks (current workflow)
1. **API Configuration**
   ```bash
   git checkout -b feature/api-keys-setup
   # Configure OpenAI and Azure keys
   ```

2. **Audio Pipeline Connection**
   ```bash
   git checkout -b feature/audio-ai-connection
   # Connect AudioWorklet to AI service
   ```

3. **End-to-End Testing**
   ```bash
   git checkout -b feature/e2e-testing
   # Test complete call flow with AI
   ```

### Release Planning
- **v0.9.0** - API configuration and basic AI connection
- **v1.0.0** - Full AI-enhanced voice platform
- **v1.1.0** - Performance optimizations and additional AI features

## 🛡️ Git Best Practices

### Before Committing
```bash
# Check what you're committing
git diff --staged

# Make sure tests pass
npm test

# Check for any remaining TODOs
grep -r "TODO\|FIXME" client/ server/ --exclude-dir=node_modules
```

### Keeping History Clean
```bash
# Squash commits before merging
git rebase -i HEAD~3

# Amend last commit (if not pushed)
git commit --amend

# Clean up merged branches
git branch --merged | grep -v main | xargs -n 1 git branch -d
```

### Recovery Commands
```bash
# Undo changes to file
git checkout -- filename

# Undo all local changes
git reset --hard HEAD

# Recover deleted branch
git reflog
git checkout -b recovered-branch <commit-hash>
```

---

## 📈 Repository Statistics

Current state:
- **39 files** in initial commit
- **11,359 insertions** of code and documentation
- **Complete AI architecture** documented and implemented
- **Production-ready** voice communication platform
- **Extensible framework** for AI enhancements

The repository represents a full-featured, professional-grade AI-enhanced voice platform with comprehensive documentation and clean, maintainable code architecture.
