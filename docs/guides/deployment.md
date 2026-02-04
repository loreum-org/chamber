# Deployment Guide

This guide covers deploying the Chamber system to various networks.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Testnet Deployment](#testnet-deployment)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Verification](#verification)
6. [Post-Deployment](#post-deployment)

---

## Prerequisites

### Required Tools

- **Foundry**: For compilation and testing
- **Node.js**: For scripts and dependencies
- **Git**: For version control

### Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Clone repository
git clone <repository-url>
cd chamber

# Install dependencies
forge install
npm install
```

### Environment Setup

Create a `.env` file:

```bash
# Network RPC URLs
RPC_URL_SEPOLIA=https://sepolia.infura.io/v3/YOUR_KEY
RPC_URL_MAINNET=https://mainnet.infura.io/v3/YOUR_KEY

# Private keys (NEVER commit these!)
PRIVATE_KEY=your_private_key_here

# Etherscan API keys (for verification)
ETHERSCAN_API_KEY=your_etherscan_key
```

---

## Local Development

### 1. Start Local Node

```bash
# Start Anvil (local node)
anvil

# Or use Hardhat node
npx hardhat node
```

### 2. Deploy Registry

```bash
# Deploy using Foundry script
forge script script/Registry.s.sol:RegistryScript \
    --rpc-url http://localhost:8545 \
    --broadcast \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Deploy Chamber Implementation

```bash
forge script script/Chamber.s.sol:ChamberScript \
    --rpc-url http://localhost:8545 \
    --broadcast \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 4. Create Chamber Instance

```solidity
// Using Foundry console or script
Registry registry = Registry(registryAddress);
address chamber = registry.createChamber(
    erc20TokenAddress,
    erc721TokenAddress,
    5,  // seats
    "Chamber Token",
    "CHMB"
);
```

---

## Testnet Deployment

### Sepolia Testnet

#### 1. Configure Foundry

Update `foundry.toml`:

```toml
[rpc_endpoints]
sepolia = "${RPC_URL_SEPOLIA}"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
```

#### 2. Deploy Registry

```bash
forge script script/Registry.s.sol:RegistryScript \
    --rpc-url sepolia \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    -vvvv
```

#### 3. Deploy Chamber Implementation

```bash
forge script script/Chamber.s.sol:ChamberScript \
    --rpc-url sepolia \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    -vvvv
```

#### 4. Initialize Registry

```bash
# Using cast or custom script
cast send $REGISTRY_ADDRESS \
    "initialize(address,address)" \
    $CHAMBER_IMPL_ADDRESS \
    $ADMIN_ADDRESS \
    --rpc-url sepolia \
    --private-key $PRIVATE_KEY
```

#### 5. Create Test Chamber

```bash
cast send $REGISTRY_ADDRESS \
    "createChamber(address,address,uint256,string,string)" \
    $ERC20_TOKEN \
    $ERC721_TOKEN \
    5 \
    "Test Chamber" \
    "TEST" \
    --rpc-url sepolia \
    --private-key $PRIVATE_KEY
```

---

## Mainnet Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Gas optimization reviewed
- [ ] Documentation updated
- [ ] Emergency procedures documented
- [ ] Multi-sig wallet configured
- [ ] Backup keys secured

### Deployment Steps

#### 1. Deploy Implementation Contracts

```bash
# Deploy Chamber implementation
forge create src/Chamber.sol:Chamber \
    --rpc-url mainnet \
    --private-key $PRIVATE_KEY \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY

# Deploy Registry implementation
forge create src/Registry.sol:Registry \
    --rpc-url mainnet \
    --private-key $PRIVATE_KEY \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY
```

#### 2. Deploy Proxy Contracts

Using OpenZeppelin's TransparentUpgradeableProxy:

```solidity
// Deploy Registry Proxy
TransparentUpgradeableProxy registryProxy = new TransparentUpgradeableProxy(
    registryImplementation,
    adminAddress,
    abi.encodeWithSelector(
        Registry.initialize.selector,
        chamberImplementation,
        adminAddress
    )
);

// Deploy Chamber Proxy (if needed)
TransparentUpgradeableProxy chamberProxy = new TransparentUpgradeableProxy(
    chamberImplementation,
    adminAddress,
    abi.encodeWithSelector(
        Chamber.initialize.selector,
        erc20Token,
        erc721Token,
        seats,
        name,
        symbol
    )
);
```

#### 3. Verify Contracts

```bash
# Verify Registry
forge verify-contract \
    $REGISTRY_PROXY_ADDRESS \
    src/Registry.sol:Registry \
    --chain-id 1 \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --constructor-args $(cast abi-encode "constructor()")

# Verify Chamber
forge verify-contract \
    $CHAMBER_PROXY_ADDRESS \
    src/Chamber.sol:Chamber \
    --chain-id 1 \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --constructor-args $(cast abi-encode "constructor()")
```

---

## Verification

### Contract Verification

#### Using Foundry

```bash
forge verify-contract \
    <CONTRACT_ADDRESS> \
    <CONTRACT_PATH>:<CONTRACT_NAME> \
    --chain-id <CHAIN_ID> \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --constructor-args <ENCODED_ARGS>
```

#### Using Hardhat

```bash
npx hardhat verify \
    --network mainnet \
    <CONTRACT_ADDRESS> \
    <CONSTRUCTOR_ARGS>
```

### Manual Verification

1. Go to Etherscan
2. Navigate to contract address
3. Click "Contract" tab
4. Click "Verify and Publish"
5. Fill in contract details
6. Submit verification

---

## Post-Deployment

### 1. Initialize Registry

```solidity
Registry registry = Registry(registryProxyAddress);
registry.initialize(chamberImplementation, adminAddress);
```

### 2. Create Initial Chambers

```solidity
address chamber1 = registry.createChamber(
    erc20Token1,
    erc721Token1,
    5,
    "Chamber 1",
    "CHM1"
);

address chamber2 = registry.createChamber(
    erc20Token2,
    erc721Token2,
    7,
    "Chamber 2",
    "CHM2"
);
```

### 3. Configure Access Control

```solidity
// Grant admin role
registry.grantRole(registry.ADMIN_ROLE(), adminAddress);

// Revoke deployer role if needed
registry.revokeRole(registry.DEFAULT_ADMIN_ROLE(), deployerAddress);
```

### 4. Test Critical Functions

```bash
# Test delegation
cast send $CHAMBER_ADDRESS \
    "delegate(uint256,uint256)" \
    1 \
    1000000000000000000 \
    --rpc-url mainnet \
    --private-key $PRIVATE_KEY

# Test transaction submission
cast send $CHAMBER_ADDRESS \
    "submitTransaction(uint256,address,uint256,bytes)" \
    1 \
    $TARGET_ADDRESS \
    0 \
    0x \
    --rpc-url mainnet \
    --private-key $PRIVATE_KEY
```

### 5. Monitor Events

Set up event monitoring:

```javascript
// Using ethers.js
const registry = new ethers.Contract(registryAddress, abi, provider);

registry.on("ChamberCreated", (chamber, seats, name, symbol, erc20, erc721) => {
    console.log("New chamber created:", chamber);
    console.log("Seats:", seats);
    console.log("Name:", name);
});
```

---

## Upgrade Procedures

### Upgrading Chamber Implementation

1. **Deploy New Implementation**:
```bash
forge create src/Chamber.sol:Chamber \
    --rpc-url mainnet \
    --private-key $PRIVATE_KEY \
    --verify
```

2. **Propose Upgrade** (if using governance):
```solidity
chamber.submitTransaction(
    tokenId,
    proxyAdminAddress,
    0,
    abi.encodeWithSelector(
        ProxyAdmin.upgrade.selector,
        chamberProxyAddress,
        newImplementationAddress
    )
);
```

3. **Execute Upgrade** (after quorum):
```solidity
chamber.executeTransaction(tokenId, transactionId);
```

### Upgrading Registry

Similar process, but requires admin role:

```solidity
ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
proxyAdmin.upgrade(registryProxyAddress, newRegistryImplementation);
```

---

## Security Considerations

### Multi-Sig Setup

- Use multi-sig wallet for admin functions
- Require multiple signatures for upgrades
- Document all key holders

### Access Control

- Revoke deployer admin role after setup
- Use role-based access control
- Monitor role changes

### Emergency Procedures

1. **Pause Mechanism**: Implement if needed
2. **Circuit Breaker**: Already implemented in Board
3. **Upgrade Path**: Document upgrade procedures
4. **Key Recovery**: Secure backup keys

### Monitoring

- Set up event monitoring
- Track all transactions
- Monitor for suspicious activity
- Alert on critical events

---

## Gas Optimization

### Deployment Costs

- **Chamber Implementation**: ~2,000,000 gas
- **Registry Implementation**: ~1,500,000 gas
- **Chamber Proxy**: ~45,000 gas (minimal proxy)
- **Registry Proxy**: ~500,000 gas (TransparentUpgradeableProxy)

### Transaction Costs

- **delegate()**: ~80,000 gas (first time), ~60,000 gas (update)
- **submitTransaction()**: ~100,000 gas
- **confirmTransaction()**: ~50,000 gas
- **executeTransaction()**: Variable (depends on external call)

---

## Troubleshooting

### Common Issues

1. **"Initialization failed"**
   - Check constructor is disabled
   - Verify initializer is called correctly
   - Ensure no duplicate initialization

2. **"Not a director"**
   - Verify NFT ownership
   - Check tokenId is in top seats
   - Confirm delegation amount

3. **"Insufficient balance"**
   - Check ERC20 balance
   - Verify delegation amounts
   - Account for locked delegations

4. **"Transaction failed"**
   - Check external call reverted
   - Verify target contract exists
   - Review calldata format

---

## Best Practices

1. **Test Thoroughly**: Test all functions before mainnet
2. **Use Testnets**: Deploy to testnets first
3. **Verify Contracts**: Always verify on Etherscan
4. **Document Everything**: Keep deployment logs
5. **Monitor Closely**: Watch for issues post-deployment
6. **Plan Upgrades**: Have upgrade path ready
7. **Secure Keys**: Never commit private keys
8. **Use Multi-Sig**: For production deployments

---

## Resources

- [Foundry Documentation](https://book.getfoundry.sh/)
- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Etherscan Verification](https://etherscan.io/apis#contracts)
- [Hardhat Deployment](https://hardhat.org/hardhat-runner/docs/guides/deploying)

---

## Support

For issues or questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]
- Discord: [discord-link]
