# Chamber Documentation Index

Welcome to the Chamber documentation! This index helps you navigate all available documentation.

## 📚 Documentation Structure

### Getting Started

- **[README.md](./README.md)** - Start here! Overview, quick start guide, and key concepts
  - System overview
  - Key features
  - Quick start guide
  - Core concepts

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into system architecture
  - Contract hierarchy
  - Data structures
  - Security patterns
  - Design decisions
  - Gas optimization
  - Limitations and future enhancements

### API Reference

- **[API.md](./API.md)** - Complete API reference
  - Registry functions
  - Chamber functions
  - Board functions
  - Wallet functions
  - Events and errors
  - Parameter descriptions

### Visual Documentation

- **[SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md)** - Mermaid diagrams and flowcharts
  - System overview swimlane
  - Chamber deployment flow
  - Delegation flow
  - Transaction execution flow
  - Seat update proposal flow
  - Director selection flow
  - Deposit/withdrawal flow
  - Batch operations

### Deployment

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
  - Prerequisites
  - Local development
  - Testnet deployment
  - Mainnet deployment
  - Verification
  - Post-deployment steps
  - Upgrade procedures

## 🎯 Quick Navigation by Use Case

### I want to...

**Understand the system**
→ Start with [README.md](./README.md), then read [ARCHITECTURE.md](./ARCHITECTURE.md)

**See how it works visually**
→ Check [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md) for flowcharts and sequence diagrams

**Integrate with the contracts**
→ Use [API.md](./API.md) for function signatures and parameters

**Deploy to a network**
→ Follow [DEPLOYMENT.md](./DEPLOYMENT.md) step-by-step

**Understand security**
→ See [ARCHITECTURE.md](./ARCHITECTURE.md) Security Patterns section

**Learn about governance**
→ See [ARCHITECTURE.md](./ARCHITECTURE.md) Board Contract section and [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md) Delegation Flow

## 📖 Document Details

### README.md
- **Length**: ~150 lines
- **Sections**: Overview, Features, Architecture, Quick Start, Concepts
- **Best for**: First-time readers, quick reference

### ARCHITECTURE.md
- **Length**: ~500 lines
- **Sections**: Overview, Components, Data Flow, Security, Upgrades, Optimization
- **Best for**: Developers, architects, security reviewers

### API.md
- **Length**: ~800 lines
- **Sections**: Registry API, Chamber API, Events, Errors
- **Best for**: Integration developers, API consumers

### SEQUENCE_DIAGRAMS.md
- **Length**: ~600 lines
- **Sections**: 8+ diagrams covering all major flows
- **Best for**: Visual learners, system understanding, presentations

### DEPLOYMENT.md
- **Length**: ~400 lines
- **Sections**: Prerequisites, Local, Testnet, Mainnet, Verification, Post-Deployment
- **Best for**: DevOps, deployment engineers

## 🔍 Finding Information

### By Component

**Registry**
- Overview: [README.md](./README.md#registry-contract)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md#1-registry-contract)
- API: [API.md](./API.md#registry-contract)
- Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md#chamber-deployment)

**Chamber**
- Overview: [README.md](./README.md#chamber-contract)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md#2-chamber-contract)
- API: [API.md](./API.md#chamber-contract)
- Diagrams: [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md)

**Board**
- Overview: [README.md](./README.md#board-contract)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md#3-board-contract)
- API: [API.md](./API.md#board-functions)
- Diagrams: [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md#delegation-flow)

**Wallet**
- Overview: [README.md](./README.md#wallet-contract)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md#4-wallet-contract)
- API: [API.md](./API.md#wallet-functions)
- Diagrams: [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md#transaction-submission-and-execution)

### By Topic

**Delegation**
- Concept: [README.md](./README.md#delegation)
- Flow: [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md#delegation-flow)
- Implementation: [ARCHITECTURE.md](./ARCHITECTURE.md#delegation-flow)
- API: [API.md](./API.md#delegation-functions)

**Transactions**
- Concept: [README.md](./README.md#transactions)
- Flow: [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md#transaction-submission-and-execution)
- Implementation: [ARCHITECTURE.md](./ARCHITECTURE.md#transaction-flow)
- API: [API.md](./API.md#wallet-functions)

**Directors**
- Concept: [README.md](./README.md#directors)
- Selection: [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md#director-selection)
- Implementation: [ARCHITECTURE.md](./ARCHITECTURE.md#director-selection-flow)
- API: [API.md](./API.md#board-functions)

**Security**
- Patterns: [ARCHITECTURE.md](./ARCHITECTURE.md#security-patterns)
- Considerations: [DEPLOYMENT.md](./DEPLOYMENT.md#security-considerations)
- Best Practices: [DEPLOYMENT.md](./DEPLOYMENT.md#best-practices)

## 🎨 Diagram Types

The documentation includes several types of Mermaid diagrams:

1. **Sequence Diagrams** - Show message flow between components
2. **Swimlane Diagrams** - Show process flow across different actors
3. **Flowchart Diagrams** - Show decision flows and system architecture

All diagrams are rendered using Mermaid and can be viewed in:
- GitHub (native support)
- GitLab (native support)
- VS Code (with Mermaid extension)
- Documentation sites (with Mermaid plugin)

## 📝 Contributing

When updating documentation:

1. Update the relevant section
2. Update this index if structure changes
3. Keep diagrams synchronized with code
4. Test Mermaid syntax before committing

## 🔗 External Resources

- [Mermaid Documentation](https://mermaid.js.org/)
- [OpenZeppelin Documentation](https://docs.openzeppelin.com/)
- [ERC4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Foundry Documentation](https://book.getfoundry.sh/)

## 📧 Support

For questions about the documentation:
- Open an issue on GitHub
- Check existing documentation first
- Review code comments for implementation details

---

**Last Updated**: January 2026
**Version**: 1.1.3
