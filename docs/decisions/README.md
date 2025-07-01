# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Sybil voice conversation platform. ADRs document important architectural decisions, their context, rationale, and consequences.

## Format

Each ADR follows this structure:

- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Context**: What situation led to this decision?
- **Decision**: What did we decide?
- **Rationale**: Why did we make this choice?
- **Consequences**: What are the positive/negative outcomes?
- **Alternatives**: What other options were considered?

## Current ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./001-persistent-socket-connections.md) | Persistent Socket Connections for Customer Interface | Accepted | 2025-07-01 |
| [ADR-002](./002-webrtc-signaling-architecture.md) | WebRTC Signaling Through Socket.IO | Accepted | 2025-07-01 |
| [ADR-003](./003-port-configuration-strategy.md) | Service Port Configuration Strategy | Accepted | 2025-07-01 |

## Guidelines

### When to Create an ADR

- Architectural choices that affect multiple components
- Performance/scalability decisions
- Technology selections (libraries, protocols, etc.)
- Security or reliability patterns
- API design choices
- Data persistence strategies

### When NOT to Create an ADR

- Obvious implementation details
- Temporary workarounds
- Pure code style decisions
- Feature-specific UI choices

### Naming Convention

- Use `XXX-kebab-case-title.md` format
- Start with sequential numbers (001, 002, etc.)
- Keep titles descriptive but concise
