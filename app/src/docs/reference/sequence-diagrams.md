# Sequence Diagrams

This document contains Mermaid sequence diagrams and swimlane diagrams illustrating key workflows in the Chamber system.

## Table of Contents

1. [System Overview Swimlane](#system-overview-swimlane)
2. [Chamber Deployment](#chamber-deployment)
3. [Delegation Flow](#delegation-flow)
4. [Transaction Submission and Execution](#transaction-submission-and-execution)
5. [Seat Update Proposal](#seat-update-proposal)
6. [Director Selection](#director-selection)
7. [Deposit and Withdrawal](#deposit-and-withdrawal)

---

## System Overview Swimlane

This swimlane diagram shows the complete transaction flow across all system components.

### Sequence Diagram View

This sequence diagram shows the complete flow with all participants:

```mermaid
sequenceDiagram
    participant User as Token Holder
    participant Chamber as Chamber Contract
    participant Board as Board Module
    participant Wallet as Wallet Module
    participant NFT as ERC721 Contract
    participant ERC20 as ERC20 Contract
    participant External as External Contract

    Note over User,External: Complete System Flow

    rect rgb(240, 248, 255)
        Note over User,ERC20: Phase 1: Asset Management
        User->>ERC20: approve(Chamber, amount)
        ERC20-->>User: Approval
        User->>Chamber: deposit(amount, receiver)
        Chamber->>ERC20: transferFrom(user, Chamber, amount)
        ERC20-->>Chamber: Tokens received
        Chamber->>Chamber: Mint shares to receiver
        Chamber-->>User: Shares minted
    end

    rect rgb(255, 248, 240)
        Note over User,Board: Phase 2: Governance Setup
        User->>Chamber: delegate(tokenId, amount)
        Chamber->>NFT: ownerOf(tokenId)
        NFT-->>Chamber: Owner address
        Chamber->>Board: _delegate(tokenId, amount)
        Board->>Board: Update sorted linked list
        Board-->>Chamber: Delegation recorded
        Chamber-->>User: DelegationUpdated event
    end

    rect rgb(240, 255, 240)
        Note over User,External: Phase 3: Transaction Execution
        User->>Chamber: submitTransaction(tokenId, target, value, data)
        Chamber->>Chamber: Verify isDirector(tokenId)
        Chamber->>Wallet: _submitTransaction(...)
        Wallet->>Wallet: Create transaction, auto-confirm
        Wallet-->>Chamber: Transaction created
        
        Note over User,Wallet: Directors confirm
        User->>Chamber: confirmTransaction(tokenId2, txId)
        Chamber->>Wallet: _confirmTransaction(...)
        Wallet->>Wallet: Increment confirmations
        
        User->>Chamber: confirmTransaction(tokenId3, txId)
        Chamber->>Wallet: _confirmTransaction(...)
        Wallet->>Wallet: Quorum reached!
        
        User->>Chamber: executeTransaction(tokenId, txId)
        Chamber->>Wallet: _executeTransaction(...)
        Wallet->>External: call{value: value}(data)
        External-->>Wallet: Execution result
        Wallet-->>Chamber: Transaction executed
        Chamber-->>User: TransactionExecuted event
    end
```

### Flowchart Swimlane View

This flowchart swimlane diagram shows the system architecture and data flow:

```mermaid
flowchart TB
    subgraph "User Layer"
        U1[Token Holder]
        U2[Director]
        U3[Admin]
    end

    subgraph "Chamber Contract"
        C1[ERC4626 Vault]
        C2[Delegation Manager]
        C3[Director Verifier]
    end

    subgraph "Board Module"
        B1[Sorted Linked List]
        B2[Quorum Calculator]
        B3[Seat Manager]
    end

    subgraph "Wallet Module"
        W1[Transaction Queue]
        W2[Confirmation Tracker]
        W3[Execution Engine]
    end

    subgraph "External Contracts"
        E1[ERC20 Token]
        E2[ERC721 NFT]
        E3[Target Contract]
    end

    U1 -->|deposit| C1
    C1 -->|transferFrom| E1
    E1 -->|tokens| C1
    C1 -->|mint shares| U1

    U1 -->|delegate| C2
    C2 -->|update| B1
    B1 -->|query| E2
    E2 -->|owner| B1
    B1 -->|top N| C3
    C3 -->|directors| U2

    U2 -->|submitTransaction| W1
    W1 -->|validate| C3
    C3 -->|isDirector| B1
    B1 -->|verify| C3
    C3 -->|approved| W1

    U2 -->|confirmTransaction| W2
    W2 -->|check quorum| B2
    B2 -->|quorum met| W3
    W3 -->|execute| E3
    E3 -->|result| W3

    U3 -->|createChamber| C1
    C1 -->|initialize| B3
    B3 -->|set seats| B2
```

### Process Swimlane Diagram

This diagram shows the process flow with swimlanes for each component:

```mermaid
flowchart LR
    subgraph User["👤 User Actions"]
        D1[Deposit Assets]
        D2[Delegate Tokens]
        D3[Submit Transaction]
        D4[Confirm Transaction]
        D5[Execute Transaction]
    end

    subgraph Chamber["🏛️ Chamber Contract"]
        C1[Validate Input]
        C2[Check Balance]
        C3[Verify Director]
        C4[Update State]
        C5[Emit Events]
    end

    subgraph Board["📊 Board Module"]
        B1[Update Linked List]
        B2[Calculate Quorum]
        B3[Select Directors]
        B4[Manage Seats]
    end

    subgraph Wallet["💼 Wallet Module"]
        W1[Create Transaction]
        W2[Track Confirmations]
        W3[Check Quorum]
        W4[Execute Call]
    end

    subgraph External["🌐 External Contracts"]
        E1[ERC20 Transfer]
        E2[NFT Ownership]
        E3[Target Execution]
    end

    D1 --> C1
    C1 --> C2
    C2 --> E1
    E1 --> C4
    C4 --> C5

    D2 --> C1
    C1 --> C3
    C3 --> B1
    B1 --> B3
    B3 --> C4
    C4 --> C5

    D3 --> C3
    C3 --> B3
    B3 --> W1
    W1 --> C4
    C4 --> C5

    D4 --> C3
    C3 --> W2
    W2 --> W3
    W3 --> B2
    B2 --> W2

    D5 --> C3
    C3 --> W3
    W3 --> W4
    W4 --> E3
    E3 --> C4
    C4 --> C5

    style User fill:#e1f5ff
    style Chamber fill:#fff4e1
    style Board fill:#e8f5e9
    style Wallet fill:#f3e5f5
    style External fill:#fce4ec
```

---

## Chamber Deployment

This diagram shows how a new Chamber is deployed through the Registry.

```mermaid
sequenceDiagram
    participant User
    participant Registry
    participant Clones
    participant ChamberImpl
    participant ChamberProxy

    Note over User,ChamberProxy: Chamber Deployment Flow

    User->>Registry: createChamber(erc20Token, erc721Token, seats, name, symbol)
    
    Registry->>Registry: Validate inputs (tokens != 0, seats 1-20)
    
    Registry->>Clones: clone(implementation)
    Clones-->>Registry: chamberProxy (minimal proxy address)
    
    Registry->>ChamberProxy: initialize(erc20Token, erc721Token, seats, name, symbol)
    
    ChamberProxy->>ChamberImpl: delegatecall initialize(...)
    ChamberImpl->>ChamberProxy: Initialize storage
    Note over ChamberProxy: Set ERC4626, Board, Wallet state
    
    ChamberProxy-->>Registry: Initialization complete
    
    Registry->>Registry: _chambers.push(chamber)
    Registry->>Registry: _isChamber[chamber] = true
    
    Registry-->>User: emit ChamberCreated(...)
    Registry-->>User: return chamber address
```

---

## Delegation Flow

This diagram shows how token holders delegate voting power to NFT token IDs.

```mermaid
sequenceDiagram
    participant TokenHolder
    participant Chamber
    participant Board
    participant NFT

    Note over TokenHolder,NFT: Delegation Flow

    TokenHolder->>Chamber: delegate(tokenId, amount)
    
    Chamber->>Chamber: Check balance >= amount
    Chamber->>NFT: ownerOf(tokenId)
    NFT-->>Chamber: owner address (or revert)
    
    alt NFT exists
        Chamber->>Chamber: agentDelegation[holder][tokenId] += amount
        Chamber->>Chamber: totalAgentDelegations[holder] += amount
        
        Chamber->>Board: _delegate(tokenId, amount)
        
        Board->>Board: Get node for tokenId
        
        alt Node exists
            Board->>Board: node.amount += amount
            Board->>Board: _reposition(tokenId)
            Note over Board: Remove and re-insert in sorted order
        else Node doesn't exist
            Board->>Board: _insert(tokenId, amount)
            Note over Board: Insert in sorted position
        end
        
        Board-->>Chamber: Delegate complete
        Chamber-->>TokenHolder: emit DelegationUpdated(holder, tokenId, newAmount)
    else NFT doesn't exist
        Chamber-->>TokenHolder: revert InvalidTokenId
    end
```

---

## Transaction Submission and Execution

This diagram shows the complete flow of submitting, confirming, and executing a multisig transaction.

```mermaid
sequenceDiagram
    participant Director1
    participant Director2
    participant Director3
    participant Chamber
    participant Wallet
    participant ExternalContract

    Note over Director1,ExternalContract: Transaction Flow (Quorum = 3)

    Director1->>Chamber: submitTransaction(tokenId1, target, value, data)
    
    Chamber->>Chamber: Check isDirector(tokenId1)
    Note over Chamber: Verify tokenId1 in top seats
    
    Chamber->>Wallet: _submitTransaction(tokenId1, target, value, data)
    
    Wallet->>Wallet: Create Transaction struct
    Wallet->>Wallet: Auto-confirm for tokenId1
    Note over Wallet: confirmations = 1
    
    Wallet-->>Chamber: Transaction created
    Chamber-->>Director1: emit TransactionSubmitted(transactionId, target, value)
    
    Note over Director1,Director3: Directors confirm transaction
    
    Director2->>Chamber: confirmTransaction(tokenId2, transactionId)
    Chamber->>Chamber: Check isDirector(tokenId2)
    Chamber->>Wallet: _confirmTransaction(tokenId2, transactionId)
    Wallet->>Wallet: confirmations++
    Note over Wallet: confirmations = 2
    Wallet-->>Chamber: Confirmed
    Chamber-->>Director2: emit TransactionConfirmed(transactionId, director2)
    
    Director3->>Chamber: confirmTransaction(tokenId3, transactionId)
    Chamber->>Chamber: Check isDirector(tokenId3)
    Chamber->>Wallet: _confirmTransaction(tokenId3, transactionId)
    Wallet->>Wallet: confirmations++
    Note over Wallet: confirmations = 3 (quorum reached!)
    Wallet-->>Chamber: Confirmed
    Chamber-->>Director3: emit TransactionConfirmed(transactionId, director3)
    
    Note over Director1,ExternalContract: Execute transaction
    
    Director1->>Chamber: executeTransaction(tokenId1, transactionId)
    
    Chamber->>Chamber: Check isDirector(tokenId1)
    Chamber->>Wallet: Check confirmations >= quorum
    
    Chamber->>Wallet: _executeTransaction(tokenId1, transactionId)
    
    Wallet->>Wallet: transaction.executed = true
    Wallet->>ExternalContract: call{value: value}(data)
    
    alt Execution succeeds
        ExternalContract-->>Wallet: success
        Wallet-->>Chamber: Execution complete
        Chamber-->>Director1: emit TransactionExecuted(transactionId, director1)
    else Execution fails
        ExternalContract-->>Wallet: revert(reason)
        Wallet->>Wallet: transaction.executed = false
        Wallet-->>Chamber: revert TransactionFailed(reason)
        Chamber-->>Director1: Transaction failed
    end
```

---

## Seat Update Proposal

This diagram shows how directors propose and execute seat updates with timelock and quorum requirements.

```mermaid
sequenceDiagram
    participant Director1
    participant Director2
    participant Director3
    participant Chamber
    participant Board

    Note over Director1,Board: Seat Update Proposal Flow

    Director1->>Chamber: updateSeats(tokenId1, newSeats)
    
    Chamber->>Chamber: Check isDirector(tokenId1)
    Chamber->>Board: _setSeats(tokenId1, newSeats)
    
    Board->>Board: Check if proposal exists
    
    alt No existing proposal
        Board->>Board: Create new SeatUpdate proposal
        Note over Board: proposedSeats = newSeats<br/>timestamp = now<br/>requiredQuorum = current quorum
        Board->>Board: supporters.push(tokenId1)
        Board-->>Chamber: Proposal created
        Chamber-->>Director1: emit SetSeats(tokenId1, newSeats)
    else Existing proposal with different seats
        Board->>Board: Delete existing proposal
        Board->>Board: Create new proposal
        Board-->>Chamber: emit SeatUpdateCancelled(tokenId1)
        Chamber-->>Director1: Proposal cancelled and recreated
    else Existing proposal with same seats
        Board->>Board: Check if tokenId1 already supported
        alt Already supported
            Board-->>Chamber: revert AlreadySentUpdateRequest
            Chamber-->>Director1: Error: Already supported
        else Not yet supported
            Board->>Board: supporters.push(tokenId1)
            Board-->>Chamber: Support added
            Chamber-->>Director1: emit SetSeats(tokenId1, newSeats)
        end
    end
    
    Note over Director1,Director3: Other directors support proposal
    
    Director2->>Chamber: updateSeats(tokenId2, newSeats)
    Chamber->>Board: _setSeats(tokenId2, newSeats)
    Board->>Board: supporters.push(tokenId2)
    Board-->>Chamber: Support added
    
    Director3->>Chamber: updateSeats(tokenId3, newSeats)
    Chamber->>Board: _setSeats(tokenId3, newSeats)
    Board->>Board: supporters.push(tokenId3)
    Board-->>Chamber: Support added
    
    Note over Director1,Board: Wait 7 days timelock
    
    Note over Director1,Board: After 7 days, execute proposal
    
    Director1->>Chamber: executeSeatsUpdate(tokenId1)
    
    Chamber->>Chamber: Check isDirector(tokenId1)
    Chamber->>Board: _executeSeatsUpdate(tokenId1)
    
    Board->>Board: Check timestamp + 7 days <= now
    Board->>Board: Check supporters.length >= requiredQuorum
    
    alt Timelock expired and quorum met
        Board->>Board: seats = proposedSeats
        Board->>Board: delete seatUpdate
        Board-->>Chamber: Seats updated
        Chamber-->>Director1: emit ExecuteSetSeats(tokenId1, newSeats)
    else Timelock not expired
        Board-->>Chamber: revert TimelockNotExpired
        Chamber-->>Director1: Error: Timelock not expired
    else Quorum not met
        Board-->>Chamber: revert InsufficientVotes
        Chamber-->>Director1: Error: Insufficient votes
    end
```

---

## Director Selection

This diagram shows how directors are selected from the top delegations.

```mermaid
sequenceDiagram
    participant User
    participant Chamber
    participant Board
    participant NFT

    Note over User,NFT: Director Selection Flow

    User->>Chamber: getDirectors()
    
    Chamber->>Board: getTop(seats)
    
    Board->>Board: Traverse sorted linked list from head
    Note over Board: Collect top N nodes by amount
    
    Board-->>Chamber: topTokenIds[], topAmounts[]
    
    Chamber->>Chamber: Create address[] array
    
    loop For each tokenId in topTokenIds
        Chamber->>NFT: ownerOf(tokenId)
        
        alt NFT exists and owned
            NFT-->>Chamber: owner address
            Chamber->>Chamber: directors[i] = owner
        else NFT burned or transferred
            NFT-->>Chamber: revert (or return address(0))
            Chamber->>Chamber: directors[i] = address(0)
        end
    end
    
    Chamber-->>User: directors[] array
    Note over User: Array contains director addresses<br/>(address(0) for invalid NFTs)
```

---

## Deposit and Withdrawal

This diagram shows ERC4626 deposit and withdrawal flows with delegation checks.

```mermaid
sequenceDiagram
    participant User
    participant Chamber
    participant ERC20Token
    participant Board

    Note over User,Board: Deposit Flow

    User->>ERC20Token: approve(Chamber, amount)
    ERC20Token-->>User: Approval confirmed
    
    User->>Chamber: deposit(amount, receiver)
    
    Chamber->>ERC20Token: transferFrom(user, Chamber, amount)
    ERC20Token-->>Chamber: Tokens transferred
    
    Chamber->>Chamber: Calculate shares to mint
    Chamber->>Chamber: Mint shares to receiver
    Chamber->>Chamber: Update totalAssets
    
    Chamber-->>User: emit Deposit(user, receiver, amount, shares)
    Chamber-->>User: return shares

    Note over User,Board: Withdrawal Flow

    User->>Chamber: withdraw(amount, receiver, owner)
    
    Chamber->>Chamber: Calculate shares to burn
    Chamber->>Chamber: Check owner balance >= shares
    
    Chamber->>Chamber: Check available balance
    Note over Chamber: balance - totalAgentDelegations[owner]
    
    alt Available balance >= amount
        Chamber->>Chamber: Burn shares from owner
        Chamber->>Chamber: Update totalAssets
        
        Chamber->>ERC20Token: transfer(receiver, amount)
        ERC20Token-->>Chamber: Tokens transferred
        
        Chamber-->>User: emit Withdraw(owner, receiver, owner, amount, shares)
        Chamber-->>User: return shares
    else Available balance < amount
        Chamber-->>User: revert ExceedsDelegatedAmount
        Note over User: Cannot withdraw more than available<br/>after accounting for delegations
    end
```

---

## Batch Transaction Flow

This diagram shows how batch operations work for multiple transactions.

```mermaid
sequenceDiagram
    participant Director
    participant Chamber
    participant Wallet

    Note over Director,Wallet: Batch Transaction Submission

    Director->>Chamber: submitBatchTransactions(tokenId, targets[], values[], data[])
    
    Chamber->>Chamber: Validate array lengths match
    Chamber->>Chamber: Calculate totalValue
    Chamber->>Chamber: Check balance >= totalValue
    
    loop For each transaction
        Chamber->>Chamber: Validate target != 0 and != Chamber
        Chamber->>Wallet: _submitTransaction(tokenId, target[i], value[i], data[i])
        Wallet->>Wallet: Create Transaction
        Wallet->>Wallet: Auto-confirm tokenId
        Wallet-->>Chamber: Transaction created
        Chamber-->>Director: emit TransactionSubmitted(transactionId, target[i], value[i])
    end
    
    Chamber-->>Director: All transactions submitted

    Note over Director,Wallet: Batch Confirmation

    Director->>Chamber: confirmBatchTransactions(tokenId, transactionIds[])
    
    loop For each transactionId
        Chamber->>Chamber: Validate transaction exists
        Chamber->>Chamber: Check not executed
        Chamber->>Chamber: Check not already confirmed
        Chamber->>Wallet: _confirmTransaction(tokenId, transactionId[i])
        Wallet->>Wallet: Increment confirmations
        Wallet-->>Chamber: Confirmed
        Chamber-->>Director: emit TransactionConfirmed(transactionId[i], director)
    end
    
    Chamber-->>Director: All transactions confirmed

    Note over Director,Wallet: Batch Execution

    Director->>Chamber: executeBatchTransactions(tokenId, transactionIds[])
    
    loop For each transactionId
        Chamber->>Chamber: Validate transaction exists
        Chamber->>Chamber: Check not executed
        Chamber->>Chamber: Check confirmations >= quorum
        
        Chamber->>Wallet: _executeTransaction(tokenId, transactionId[i])
        Wallet->>Wallet: Mark executed
        Wallet->>Wallet: Execute external call
        
        alt Success
            Wallet-->>Chamber: Execution successful
            Chamber-->>Director: emit TransactionExecuted(transactionId[i], director)
        else Failure
            Wallet->>Wallet: Revert executed flag
            Wallet-->>Chamber: revert TransactionFailed
            Chamber-->>Director: Transaction failed, batch stops
        end
    end
```

---

## Undelegation Flow

This diagram shows how token holders undelegate voting power.

```mermaid
sequenceDiagram
    participant TokenHolder
    participant Chamber
    participant Board

    Note over TokenHolder,Board: Undelegation Flow

    TokenHolder->>Chamber: undelegate(tokenId, amount)
    
    Chamber->>Chamber: Check agentDelegation[holder][tokenId] >= amount
    
    alt Sufficient delegation
        Chamber->>Chamber: agentDelegation[holder][tokenId] -= amount
        Chamber->>Chamber: totalAgentDelegations[holder] -= amount
        
        Chamber->>Board: _undelegate(tokenId, amount)
        
        Board->>Board: Get node for tokenId
        Board->>Board: node.amount -= amount
        
        alt Node amount > 0
            Board->>Board: _reposition(tokenId)
            Note over Board: Re-sort node in linked list
        else Node amount == 0
            Board->>Board: _remove(tokenId)
            Note over Board: Remove node from list
        end
        
        Board-->>Chamber: Undelegate complete
        Chamber-->>TokenHolder: emit DelegationUpdated(holder, tokenId, newAmount)
    else Insufficient delegation
        Chamber-->>TokenHolder: revert InsufficientDelegatedAmount
    end
```

---

## Notes on Diagrams

### Swimlane Format

These diagrams use standard sequence diagrams rather than swimlanes. For swimlane format, you can convert them using Mermaid's `participant` grouping or by using a different diagram type.

### Key Patterns Illustrated

1. **Delegation**: Shows how delegations update the sorted linked list
2. **Multisig**: Demonstrates quorum-based transaction approval
3. **Timelock**: Shows seat update proposal with 7-day delay
4. **Director Selection**: Illustrates how top delegations determine directors
5. **Batch Operations**: Shows efficient batch processing
6. **Error Handling**: Includes error paths and validation checks

### Diagram Usage

These diagrams can be:
- Rendered in Markdown viewers that support Mermaid
- Exported to PNG/SVG using Mermaid CLI
- Embedded in documentation websites
- Used for code reviews and architecture discussions
