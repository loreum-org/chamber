// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {ERC4626Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
/**
 * @title Chamber Contract
 * @notice This contract is a smart vault for managing assets with a board of directors
 */
contract Chamber is ERC4626Upgradeable, Board, Wallet {

    /// @notice The implementation version
    string public version;
    /// @notice ERC721 membership token
    IERC721 public nft;

    /// @notice Mapping to track delegated amounts per agent per tokenId
    mapping(address => mapping(uint256 => uint256)) private agentDelegation;

    /// @notice Mapping to track total delegated amount per agent
    mapping(address => uint256) private totalAgentDelegations;

    /**
     * @notice Emitted when the contract receives Ether
     * @param sender The address that sent the Ether
     * @param amount The amount of Ether received
     */
    event Received(address indexed sender, uint256 amount);

    /// Custom Errors
    error InsufficientDelegatedAmount();
    error InsufficientChamberBalance();
    error ExceedsDelegatedAmount();
    error TransferFailed();
    error TransferToZeroAddress();
    error ArrayLengthsMustMatch();
    error NotEnoughConfirmations();
    error NotDirector();
    error ZeroAddress();
    error ZeroAmount();
    error ArrayIndexOutOfBounds();
    error CannotTransfer();
    error NotOnLeaderboard(address);
    error ZeroSeats();
    error TooManySeats();

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
        string memory _name,
        string memory _symbol
    ) external initializer {
        if (erc20Token == address(0) || erc721Token == address(0)) {
            revert ZeroAddress();
        }
        
        __ERC4626_init(IERC20(erc20Token));
        __ERC20_init(_name, _symbol);
        
        nft = IERC721(erc721Token);
        _setSeats(0, seats);

        version = "1.1.3";
    }

    /**
     * @notice Delegates a specified amount of tokens to a tokenId
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens to delegate
     */
    function delegate(uint256 tokenId, uint256 amount) external {
        if (amount == 0 || balanceOf(msg.sender) < amount) {
            revert InsufficientChamberBalance();
        }

        agentDelegation[msg.sender][tokenId] += amount;
        totalAgentDelegations[msg.sender] += amount;

        _delegate(tokenId, amount);
    }

    /**
     * @notice Undelegates a specified amount of tokens from a tokenId
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens to undelegate
     */
    function undelegate(uint256 tokenId, uint256 amount) external {
        // Cache the current delegation amount to minimize storage reads
        uint256 currentDelegation = agentDelegation[msg.sender][tokenId];
        if (currentDelegation < amount || amount == 0) revert InsufficientDelegatedAmount();

        uint256 newDelegation = currentDelegation - amount;

        // Update agent delegation amount
        agentDelegation[msg.sender][tokenId] = newDelegation;
        totalAgentDelegations[msg.sender] -= amount;

        _undelegate(tokenId, amount);
    }

    /// BOARD ///

    /**
     * @notice Retrieves the node information for a given tokenId
     * @param tokenId The tokenId to retrieve information for
     * @return The Node struct containing the node information
     */
    function getMember(uint256 tokenId) public view returns (Node memory) {
        return _getNode(tokenId);
    }

    /**
     * @notice Retrieves the top tokenIds and their amounts
     * @param count The number of top tokenIds to retrieve
     * @return An array of top tokenIds and their corresponding amounts
     */
    function getTop(uint256 count) public view returns (uint256[] memory, uint256[] memory) {
        return _getTop(count);
    }

    /**
     * @notice Returns the total size of the board
     * @return uint256 current size of the board
     */
    function getSize() public view returns (uint256) {
        return size;
    }

    /**
     * @notice Retrieves the current quorum
     * @return The current quorum value
     */
    function getQuorum() public view returns (uint256) {
        return _getQuorum();
    }

    /**
     * @notice Retrieves the current number of seats
     * @return The current number of seats
     */
    function getSeats() public view returns (uint256) {
        return _getSeats();
    }

    /**
     * @notice Retrieves the addresses of the current directors
     * @return An array of addresses representing the current directors
     */
    function getDirectors() public view returns (address[] memory) {
        (uint256[] memory topTokenIds,) = getTop(_getSeats());
        address[] memory topOwners = new address[](topTokenIds.length);

        for (uint256 i = 0; i < topTokenIds.length; i++) {
            try nft.ownerOf(topTokenIds[i]) returns (address owner) {
                topOwners[i] = owner;
            } catch {
                topOwners[i] = address(0); // Default to address(0) if the call fails
            }
        }

        return topOwners;
    }

    /**
     * @notice Returns the list of tokenIds to which the agent has delegated tokens and the corresponding amounts
     * @param agent The address of the agent
     * @return tokenIds The list of tokenIds
     * @return amounts The list of amounts delegated to each tokenId
     */
    function getDelegations(address agent) external view returns (uint256[] memory tokenIds, uint256[] memory amounts) {
        uint256 count = 0;
        uint256 tokenId = head;
        uint256[] memory tempTokenIds = new uint256[](size);
        uint256[] memory tempAmounts = new uint256[](size);

        // Single pass: count delegations and store tokenIds and amounts
        while (tokenId != 0) {
            uint256 amount = agentDelegation[agent][tokenId];
            if (amount > 0) {
                tempTokenIds[count] = tokenId;
                tempAmounts[count] = amount;
                count++;
            }
            tokenId = nodes[tokenId].next;
        }

        // Allocate arrays with the correct size and copy data
        tokenIds = new uint256[](count);
        amounts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tempTokenIds[i];
            amounts[i] = tempAmounts[i];
        }
    }

    /**
     * @notice Returns the amount delegated by a agent to a specific tokenId
     * @param agent The address of the agent
     * @param tokenId The token ID
     * @return amount The amount delegated
     */
    function getAgentDelegation(address agent, uint256 tokenId) external view returns (uint256) {
        return agentDelegation[agent][tokenId];
    }

    /**
     * @notice Returns the total amount delegated by a agent across all tokenIds
     * @param agent The address of the agent
     * @return amount The total amount delegated
     */
    function getTotalAgentDelegations(address agent) external view returns (uint256) {
        return totalAgentDelegations[agent];
    }

    /**
     * @notice Returns the current seat update proposal
     * @return The current SeatUpdate struct containing proposal details
     * @dev This includes the proposed number of seats, proposer, timestamp,
     *      and current support for the proposal
     */
    function getSeatUpdate() public view returns (SeatUpdate memory) {
        return seatUpdate;
    }

    /**
     * @notice Updates the number of seats
     * @param numOfSeats The new number of seats
     * @dev If there's an existing proposal to update seats, calling this
     *     function with a different number of seats will cancel the existing proposal.
     */
    function updateSeats(uint256 tokenId, uint256 numOfSeats) public isDirector(tokenId) {
        if (numOfSeats == 0) revert ZeroSeats();

        uint256 MAX_SEATS = 20;

        if (numOfSeats > MAX_SEATS) revert TooManySeats();
        _setSeats(tokenId, numOfSeats);
    }

    /**
     * @notice Executes a pending seat update proposal if it has enough support and the timelock has expired
     * @dev Can only be called by a director
     * @dev Requires the proposal to exist, have passed the 7-day timelock, and maintain quorum support
     */
    function executeSeatsUpdate(uint256 tokenId) public isDirector(tokenId) {
        _executeSeatsUpdate(tokenId);
    }

    /// WALLET ///

    /**
     * @notice Submits a new transaction for approval
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The data to include in the transaction
     */
    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data)
        public
        isDirector(tokenId)
    {
        _submitTransaction(tokenId, target, value, data);
    }

    /**
     * @notice Confirms a transaction
     * @param transactionId The ID of the transaction to confirm
     */
    function confirmTransaction(uint256 tokenId, uint256 transactionId) public isDirector(tokenId) {
        _confirmTransaction(tokenId, transactionId);
    }

    /**
     * @notice Executes a transaction if it has enough confirmations
     * @param transactionId The ID of the transaction to execute
     */
    function executeTransaction(uint256 tokenId, uint256 transactionId) public isDirector(tokenId) {
        if (getTransaction(transactionId).confirmations < getQuorum()) revert NotEnoughConfirmations();
        _executeTransaction(tokenId, transactionId);
    }

    /**
     * @notice Revokes a confirmation for a transaction
     * @param transactionId The ID of the transaction to revoke confirmation for
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId) public isDirector(tokenId) {
        _revokeConfirmation(tokenId, transactionId);
    }
    /**
     * @notice Submits multiple transactions for approval in a single call
     * @param targets The array of addresses to send the transactions to
     * @param values The array of amounts of Ether to send
     * @param data The array of data to include in each transaction
     */

    function submitBatchTransactions(
        uint256 tokenId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory data
    ) public isDirector(tokenId) {
        if (targets.length != values.length || values.length != data.length) revert ArrayLengthsMustMatch();

        for (uint256 i = 0; i < targets.length; i++) {
            _submitTransaction(tokenId, targets[i], values[i], data[i]);
        }
    }

    /**
     * @notice Confirms multiple transactions in a single call
     * @param transactionIds The array of transaction IDs to confirm
     */
    function confirmBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) public isDirector(tokenId) {
        for (uint256 i = 0; i < transactionIds.length; i++) {
            _confirmTransaction(tokenId, transactionIds[i]);
        }
    }

    /**
     * @notice Executes multiple transactions in a single call if they have enough confirmations
     * @param transactionIds The array of transaction IDs to execute
     */
    function executeBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) public {
        for (uint256 i = 0; i < transactionIds.length; i++) {
            uint256 transactionId = transactionIds[i];
            executeTransaction(tokenId, transactionId);
        }
    }

    /// @notice Fallback function to receive Ether
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /// @notice Modifier to restrict access to only directors
    /// @dev Checks if the caller owns a tokenId that is in the top seats
    /// @param tokenId The NFT token ID to check for directorship
    modifier isDirector(uint256 tokenId) {
        // Prevent zero tokenId
        if (tokenId == 0) revert NotDirector();

        // Check if tokenId exists and is owned by caller
        if (nft.ownerOf(tokenId) != msg.sender) revert NotDirector();

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
        revert NotDirector();
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
        if (to == address(0)) revert TransferToZeroAddress();

        address owner = _msgSender();
        _transfer(owner, to, value);

        if (balanceOf(owner) < totalAgentDelegations[owner]) {
            revert ExceedsDelegatedAmount();
        }

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
        if (to == address(0)) revert TransferToZeroAddress();

        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);

        if (balanceOf(from) < totalAgentDelegations[from]) {
            revert ExceedsDelegatedAmount();
        }

        return true;
    }
}
