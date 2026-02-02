// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {ERC4626Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import {ReentrancyGuardUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {StorageSlot} from "lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol";

/**
 * @title Chamber Contract
 * @notice This contract is a smart vault for managing assets with a board of directors
 * @author xhad, Loreum DAO LLC
 */
contract Chamber is ERC4626Upgradeable, ReentrancyGuardUpgradeable, Board, Wallet, IChamber {
    /// @notice The implementation version
    string public version;

    /// @notice ERC721 membership token
    IERC721 public nft;

    /// @notice Mapping to track delegated amounts per agent per tokenId
    mapping(address => mapping(uint256 => uint256)) private agentDelegation;

    /// @notice Mapping to track total delegated amount per agent
    mapping(address => uint256) private totalAgentDelegations;

    /// @dev Events and errors are defined in IChamber interface

    /// Constants
    uint256 private constant MAX_SEATS = 20;
    
    /// @notice Function selector for upgradeImplementation(address,bytes)
    bytes4 private constant UPGRADE_SELECTOR = 0xc89311b6;

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the Chamber contract with the given ERC20 and ERC721 tokens and sets the number of seats
     * @param erc20Token The address of the ERC20 token
     * @param erc721Token The address of the ERC721 token
     * @param seats The initial number of seats
     * @param _name The name of the chamber's ERC20 token
     * @param _symbol The symbol of the chamber's ERC20 token
     */
    function initialize(
        address erc20Token,
        address erc721Token,
        uint256 seats,
        string calldata _name,
        string calldata _symbol
    ) external initializer {
        if (erc20Token == address(0) || erc721Token == address(0)) {
            revert IChamber.ZeroAddress();
        }
        
        __ERC4626_init(IERC20(erc20Token));
        __ERC20_init(_name, _symbol);
        __ReentrancyGuard_init();
        
        nft = IERC721(erc721Token);
        _setSeats(0, seats);

        version = "1.1.3";
    }

    /**
     * @notice Delegates a specified amount of tokens to a tokenId
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens to delegate
     */
    function delegate(uint256 tokenId, uint256 amount) external override {
        // Input validation
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();
        if (balanceOf(msg.sender) < amount) revert IChamber.InsufficientChamberBalance();

        // Verify NFT exists (ownerOf reverts if token doesn't exist)
        try nft.ownerOf(tokenId) returns (address) {
            // Token exists, continue
        } catch {
            revert IChamber.InvalidTokenId();
        }

        // Update delegation state
        agentDelegation[msg.sender][tokenId] += amount;
        totalAgentDelegations[msg.sender] += amount;

        // Update board state
        _delegate(tokenId, amount);

        emit IChamber.DelegationUpdated(msg.sender, tokenId, agentDelegation[msg.sender][tokenId]);
    }

    /**
     * @notice Undelegates a specified amount of tokens from a tokenId
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens to undelegate
     */
    function undelegate(uint256 tokenId, uint256 amount) external override {
        // Input validation
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();

        // Cache current delegation amount
        uint256 currentDelegation = agentDelegation[msg.sender][tokenId];
        if (currentDelegation < amount) revert IChamber.InsufficientDelegatedAmount();

        // Update delegation state
        uint256 newDelegation = currentDelegation - amount;
        agentDelegation[msg.sender][tokenId] = newDelegation;
        totalAgentDelegations[msg.sender] -= amount;

        // Update board state
        _undelegate(tokenId, amount);

        emit IChamber.DelegationUpdated(msg.sender, tokenId, newDelegation);
    }

    /// BOARD ///

    /**
     * @notice Retrieves the node information for a given tokenId
     * @param tokenId The tokenId to retrieve information for
     * @return The Node struct containing the node information
     */
    function getMember(uint256 tokenId) public view override returns (uint256, uint256, uint256, uint256) {
        Node memory node = _getNode(tokenId);
        return (node.tokenId, node.amount, node.next, node.prev);
    }

    /**
     * @notice Retrieves the top tokenIds and their amounts
     * @param count The number of top tokenIds to retrieve
     * @return uint256[] memory topTokenIds
     * @return uint256[] memory topAmounts
     */
    function getTop(uint256 count) public view override returns (uint256[] memory, uint256[] memory) {
        return _getTop(count);
    }

    /**
     * @notice Returns the total size of the board
     * @return uint256 current size of the board
     */
    function getSize() public view override returns (uint256) {
        return size;
    }

    /**
     * @notice Retrieves the current quorum
     * @return The current quorum value
     */
    function getQuorum() public view override returns (uint256) {
        return _getQuorum();
    }

    /**
     * @notice Retrieves the current number of seats
     * @return The current number of seats
     */
    function getSeats() public view override returns (uint256) {
        return _getSeats();
    }

    /**
     * @notice Retrieves the addresses of the current directors
     * @return An array of addresses representing the current directors
     * @dev Returns address(0) for tokenIds where NFT ownership check fails (burned/transferred)
     */
    function getDirectors() public view override returns (address[] memory) {
        (uint256[] memory topTokenIds,) = getTop(_getSeats());
        address[] memory topOwners = new address[](topTokenIds.length);

        for (uint256 i = 0; i < topTokenIds.length;) {
            try nft.ownerOf(topTokenIds[i]) returns (address owner) {
                topOwners[i] = owner;
            } catch {
                // NFT may have been burned or transferred
                // Return address(0) to indicate invalid director
                topOwners[i] = address(0);
            }
            unchecked { ++i; }
        }

        return topOwners;
    }

    /**
     * @notice Returns the list of tokenIds to which the agent has delegated tokens and the corresponding amounts
     * @param agent The address of the agent
     * @return tokenIds The list of tokenIds
     * @return amounts The list of amounts delegated to each tokenId
     */
    function getDelegations(address agent) public view override returns (uint256[] memory tokenIds, uint256[] memory amounts) {
        if (agent == address(0)) revert IChamber.ZeroAddress();

        uint256 count = 0;
        uint256 tokenId = head;
        uint256[] memory tempTokenIds = new uint256[](size);
        uint256[] memory tempAmounts = new uint256[](size);

        while (tokenId != 0) {
            uint256 amount = agentDelegation[agent][tokenId];
            if (amount > 0) {
                tempTokenIds[count] = tokenId;
                tempAmounts[count] = amount;
                unchecked { ++count; }
            }
            tokenId = nodes[tokenId].next;
        }

        tokenIds = new uint256[](count);
        amounts = new uint256[](count);
        for (uint256 i = 0; i < count;) {
            tokenIds[i] = tempTokenIds[i];
            amounts[i] = tempAmounts[i];
            unchecked { ++i; }
        }
    }

    /**
     * @notice Returns the amount delegated by a agent to a specific tokenId
     * @param agent The address of the agent
     * @param tokenId The token ID
     * @return amount The amount delegated
     */
    function getAgentDelegation(address agent, uint256 tokenId) external view override returns (uint256) {
        return agentDelegation[agent][tokenId];
    }

    /**
     * @notice Returns the total amount delegated by a agent across all tokenIds
     * @param agent The address of the agent
     * @return amount The total amount delegated
     */
    function getTotalAgentDelegations(address agent) external view override returns (uint256) {
        return totalAgentDelegations[agent];
    }

    /**
     * @notice Returns the current seat update proposal
     * @return uint256 proposedSeats
     * @return uint256 timestamp
     * @return uint256 requiredQuorum
     * @return uint256[] memory supporters
     * @dev This includes the proposed number of seats, proposer, timestamp,
     *      required quorum at proposal time, and current support for the proposal
     */
    function getSeatUpdate() public view override returns (uint256, uint256, uint256, uint256[] memory) {
        SeatUpdate storage proposal = seatUpdate;
        return (proposal.proposedSeats, proposal.timestamp, proposal.requiredQuorum, proposal.supporters);
    }

    /**
     * @notice Updates the number of seats
     * @param tokenId The tokenId proposing the update
     * @param numOfSeats The new number of seats
     * @dev If there's an existing proposal to update seats, calling this
     *     function with a different number of seats will cancel the existing proposal.
     */
    function updateSeats(uint256 tokenId, uint256 numOfSeats) public override isDirector(tokenId) {
        if (numOfSeats == 0) revert IChamber.ZeroSeats();

        if (numOfSeats > MAX_SEATS) revert IChamber.TooManySeats();
        _setSeats(tokenId, numOfSeats);
    }

    /**
     * @notice Executes a pending seat update proposal if it has enough support and the timelock has expired
     * @dev Can only be called by a director
     * @dev Requires the proposal to exist, have passed the 7-day timelock, and maintain quorum support
     * @param tokenId The tokenId executing the update
     */
    function executeSeatsUpdate(uint256 tokenId) public override isDirector(tokenId) {
        _executeSeatsUpdate(tokenId);
    }

    /// WALLET ///

    /**
     * @notice Submits a new transaction for approval
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The data to include in the transaction
     */
    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data)
        public
        override
        isDirector(tokenId)
    {
        if (target == address(0)) revert IChamber.ZeroAddress();
        
        // Allow address(this) only for upgradeImplementation calls
        if (target == address(this)) {
            // Check if this is an upgrade call by checking the function selector
            if (data.length < 4) revert IChamber.InvalidTransaction();
            bytes4 selector = bytes4(data);
            if (selector != UPGRADE_SELECTOR) {
                revert IChamber.InvalidTransaction();
            }
        }
        
        // Check if contract has sufficient balance for ETH transfers
        if (value > 0 && address(this).balance < value) {
            revert IChamber.InsufficientChamberBalance();
        }

        _submitTransaction(tokenId, target, value, data);
        emit IChamber.TransactionSubmitted(getNextTransactionId() - 1, target, value);
    }

    /**
     * @notice Confirms a transaction
     * @param tokenId The tokenId confirming the transaction
     * @param transactionId The ID of the transaction to confirm
     */
    function confirmTransaction(uint256 tokenId, uint256 transactionId) 
        public 
        override
        isDirector(tokenId) 
    {
        if (transactionId >= transactions.length) revert IWallet.TransactionDoesNotExist();
        Transaction storage transaction = transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
        if (isConfirmed[transactionId][tokenId]) revert IWallet.TransactionAlreadyConfirmed();

        _confirmTransaction(tokenId, transactionId);
        emit IChamber.TransactionConfirmed(transactionId, msg.sender);
    }

    /**
     * @notice Executes a transaction if it has enough confirmations
     * @param tokenId The tokenId executing the transaction
     * @param transactionId The ID of the transaction to execute
     */
    function executeTransaction(uint256 tokenId, uint256 transactionId) 
        public 
        override
        nonReentrant
        isDirector(tokenId) 
    {
        if (transactionId >= transactions.length) revert IWallet.TransactionDoesNotExist();
        Transaction storage transaction = transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
        if (transaction.confirmations < getQuorum()) revert IChamber.NotEnoughConfirmations();

        // Execute the transaction
        _executeTransaction(tokenId, transactionId);
        emit IChamber.TransactionExecuted(transactionId, msg.sender);
    }

    /**
     * @notice Revokes a confirmation for a transaction
     * @param tokenId The tokenId revoking the confirmation
     * @param transactionId The ID of the transaction to revoke confirmation for
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId) public override isDirector(tokenId) {
        _revokeConfirmation(tokenId, transactionId);
    }

    /**
     * @notice Submits multiple transactions for approval in a single call
     * @param tokenId The tokenId submitting the transactions
     * @param targets The array of addresses to send the transactions to
     * @param values The array of amounts of Ether to send
     * @param data The array of data to include in each transaction
     */

    function submitBatchTransactions(
        uint256 tokenId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory data
    ) public override isDirector(tokenId) {
        if (targets.length != values.length || values.length != data.length) revert IChamber.ArrayLengthsMustMatch();
        if (targets.length == 0) revert IChamber.ZeroAmount();

        // Check total ETH balance requirement
        uint256 totalValue = 0;
        for (uint256 i = 0; i < values.length;) {
            totalValue += values[i];
            unchecked { ++i; }
        }
        if (totalValue > address(this).balance) {
            revert IChamber.InsufficientChamberBalance();
        }

        for (uint256 i = 0; i < targets.length;) {
            if (targets[i] == address(0)) revert IChamber.ZeroAddress();
            
            // Allow address(this) only for upgradeImplementation calls
            if (targets[i] == address(this)) {
                if (data[i].length < 4) revert IChamber.InvalidTransaction();
                bytes4 selector = bytes4(data[i]);
                if (selector != UPGRADE_SELECTOR) {
                    revert IChamber.InvalidTransaction();
                }
            }
            
            _submitTransaction(tokenId, targets[i], values[i], data[i]);
            emit IChamber.TransactionSubmitted(getNextTransactionId() - 1, targets[i], values[i]);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Confirms multiple transactions in a single call
     * @param tokenId The tokenId confirming the transactions
     * @param transactionIds The array of transaction IDs to confirm
     */
    function confirmBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) 
        public 
        override
        isDirector(tokenId) 
    {
        if (transactionIds.length == 0) revert IChamber.ZeroAmount();

        for (uint256 i = 0; i < transactionIds.length;) {
            uint256 transactionId = transactionIds[i];
            if (transactionId >= transactions.length) revert IWallet.TransactionDoesNotExist();
            Transaction storage transaction = transactions[transactionId];
            
            if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
            if (isConfirmed[transactionId][tokenId]) revert IWallet.TransactionAlreadyConfirmed();

            _confirmTransaction(tokenId, transactionId);
            emit IChamber.TransactionConfirmed(transactionId, msg.sender);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Executes multiple transactions in a single call if they have enough confirmations
     * @param tokenId The tokenId executing the transactions
     * @param transactionIds The array of transaction IDs to execute
     */
    function executeBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) 
        public 
        override
        nonReentrant
        isDirector(tokenId) 
    {
        if (transactionIds.length == 0) revert IChamber.ZeroAmount();

        for (uint256 i = 0; i < transactionIds.length;) {
            uint256 transactionId = transactionIds[i];
            if (transactionId >= transactions.length) revert IWallet.TransactionDoesNotExist();
            Transaction storage transaction = transactions[transactionId];
            
            if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
            if (transaction.confirmations < getQuorum()) revert IChamber.NotEnoughConfirmations();

            _executeTransaction(tokenId, transactionId);
            emit IChamber.TransactionExecuted(transactionId, msg.sender);
            unchecked { ++i; }
        }
    }

    /// @notice Fallback function to receive Ether
    receive() external payable {
        emit IChamber.Received(msg.sender, msg.value);
    }

    /// @notice Modifier to restrict access to only directors
    /// @dev Checks if the caller owns a tokenId that is in the top seats
    /// @param tokenId The NFT token ID to check for directorship
    modifier isDirector(uint256 tokenId) {
        // Prevent zero tokenId
        if (tokenId == 0) revert IChamber.NotDirector();

        // Check if tokenId exists and is owned by caller
        if (nft.ownerOf(tokenId) != msg.sender) revert IChamber.NotDirector();

        // Check if tokenId is in top seats
        uint256 current = head;
        uint256 remaining = _getSeats();

        while (current != 0 && remaining > 0) {
            if (current == tokenId) {
                _;
                return;
            }
            current = nodes[current].next;
            remaining--;
        }
        revert IChamber.NotDirector();
    }

    /// PROXY UPGRADE FUNCTIONS ///

    /**
     * @notice Returns the ProxyAdmin address for this Chamber proxy
     * @return The ProxyAdmin address stored in ERC1967 admin slot
     */
    function getProxyAdmin() external view override returns (address) {
        // ERC1967 admin slot: keccak256("eip1967.proxy.admin") - 1
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        return StorageSlot.getAddressSlot(adminSlot).value;
    }

    /**
     * @notice Accepts admin ownership of the ProxyAdmin (called by Registry after deployment)
     * @dev This is a no-op since Registry transfers ownership directly
     * @dev Kept for interface compatibility
     */
    function acceptAdmin() external override {
        // No-op: Registry transfers ProxyAdmin ownership directly
        // This function exists for interface compatibility
    }

    /**
     * @notice Upgrades the Chamber implementation
     * @dev This function can be called via executeTransaction with proper governance
     * @dev When called via executeTransaction, the transaction target should be this contract
     * @dev and the data should be the encoded upgradeImplementation call
     * @param newImplementation The new implementation address
     * @param data Optional initialization data for the new implementation
     */
    function upgradeImplementation(address newImplementation, bytes calldata data) external override {
        // Only the ProxyAdmin owner (this Chamber) can call this
        address proxyAdminAddress = this.getProxyAdmin();
        if (proxyAdminAddress == address(0)) revert IChamber.ZeroAddress();
        if (newImplementation == address(0)) revert IChamber.ZeroAddress();
        
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        
        // Verify this Chamber is the owner of ProxyAdmin
        if (proxyAdmin.owner() != address(this)) {
            revert IChamber.NotDirector(); // Reuse error for unauthorized
        }
        
        // Perform the upgrade via ProxyAdmin
        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(address(this));
        proxyAdmin.upgradeAndCall(proxy, newImplementation, data);
    }

    /// ERC20 OVERRIDES ///

    /**
     * @notice Transfers tokens to a specified address
     * @dev Overrides the ERC20 transfer function to include delegation checks
     * @param to The recipient address
     * @param value The amount of tokens to transfer
     * @return true if the transfer is successful
     */
    function transfer(address to, uint256 value) public override(ERC20Upgradeable, IERC20) returns (bool) {
        if (to == address(0)) revert IChamber.TransferToZeroAddress();
        if (value == 0) revert IChamber.ZeroAmount();

        address owner = _msgSender();
        uint256 ownerBalance = balanceOf(owner);
        
        // Check sufficient balance first
        if (ownerBalance < value) {
            revert IChamber.InsufficientChamberBalance();
        }
        
        // Check delegation before transfer
        if (ownerBalance - value < totalAgentDelegations[owner]) {
            revert IChamber.ExceedsDelegatedAmount();
        }

        // Perform transfer
        _transfer(owner, to, value);

        return true;
    }

    /**
     * @notice Transfers tokens from one address to another
     * @dev Overrides the ERC20 transferFrom function to include delegation checks
     * @param from The address to transfer tokens from
     * @param to The address to transfer tokens to
     * @param value The amount of tokens to transfer
     * @return true if the transfer is successful
     */
    function transferFrom(address from, address to, uint256 value)
        public
        override(ERC20Upgradeable, IERC20)
        returns (bool)
    {
        if (to == address(0)) revert IChamber.TransferToZeroAddress();
        if (value == 0) revert IChamber.ZeroAmount();

        address spender = _msgSender();
        uint256 fromBalance = balanceOf(from);
        
        // Check sufficient balance first
        if (fromBalance < value) {
            revert IChamber.InsufficientChamberBalance();
        }
        
        // Check delegation before transfer
        if (fromBalance - value < totalAgentDelegations[from]) {
            revert IChamber.ExceedsDelegatedAmount();
        }

        _spendAllowance(from, spender, value);
        _transfer(from, to, value);

        return true;
    }

    /**
     * @notice Returns the next transaction ID (current nonce)
     * @return uint256 The next transaction ID that will be assigned
     */
    function getNextTransactionId() public view override(IWallet, Wallet) returns (uint256) {
        return getTransactionCount();
    }

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     * @return executed Whether the transaction has been executed
     * @return confirmations Number of confirmations
     * @return target The target address
     * @return value The ETH value
     * @return data The calldata
     */
    function getTransaction(uint256 nonce) public view override(IWallet, Wallet) returns (bool, uint8, address, uint256, bytes memory) {
        return super.getTransaction(nonce);
    }

    /**
     * @notice Returns the total number of transactions
     * @return The total number of transactions
     */
    function getTransactionCount() public view override(IWallet, Wallet) returns (uint256) {
        return super.getTransactionCount();
    }

    /**
     * @notice Checks if a transaction is confirmed by a specific director
     * @param tokenId The tokenId of the director to check confirmation for
     * @param nonce The index of the transaction to check
     * @return True if the transaction is confirmed by the director, false otherwise
     */
    function getConfirmation(uint256 tokenId, uint256 nonce) public view override(IWallet, Wallet) returns (bool) {
        return super.getConfirmation(tokenId, nonce);
    }

    /// @dev Storage gap for future upgrades
    uint256[50] private __gap;
}
