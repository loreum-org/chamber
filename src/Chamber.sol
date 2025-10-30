// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Chamber Contract
 * @notice This contract manages a multisig wallet with governance and delegation features using ERC20 and ERC721 tokens.
 */
contract Chamber is ERC4626, Board, Wallet, ReentrancyGuard {
    /// @notice The Chamber version
    string public version = "1.1.0";

    /// @notice ERC721 membership token
    IERC721 public nft;

    /// @notice Mapping to track delegated amounts per user per tokenId
    mapping(address => mapping(uint256 => uint256)) public userDelegation;

    /// @notice Mapping to track total delegated amount per user
    mapping(address => uint256) public totalUserDelegations;

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

    /**
     * @notice Initializes the Chamber contract with the given ERC20 and ERC721 tokens and sets the number of seats
     * @param erc20Token The address of the ERC20 token
     * @param erc721Token The address of the ERC721 token
     * @param seats The initial number of seats
     */
    constructor(address erc20Token, address erc721Token, uint256 seats, string memory _name, string memory _symbol)
        ERC4626(IERC20(erc20Token))
        ERC20(_name, _symbol)
    {
        if (erc20Token == address(0) || erc721Token == address(0)) {
            revert ZeroAddress();
        }
        nft = IERC721(erc721Token);
        _setSeats(0, seats);
    }

    /**
     * @notice Delegates a specified amount of tokens to a tokenId
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens to delegate
     */
    function delegate(uint256 tokenId, uint256 amount) external nonReentrant {
        if (amount == 0 || balanceOf(msg.sender) < amount) {
            revert InsufficientChamberBalance();
        }

        userDelegation[msg.sender][tokenId] += amount;
        totalUserDelegations[msg.sender] += amount;

        _delegate(tokenId, amount);
    }

    /**
     * @notice Undelegates a specified amount of tokens from a tokenId
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens to undelegate
     */
    function undelegate(uint256 tokenId, uint256 amount) external nonReentrant {
        // Cache the current delegation amount to minimize storage reads
        uint256 currentDelegation = userDelegation[msg.sender][tokenId];
        if (currentDelegation < amount || amount == 0) revert InsufficientDelegatedAmount();

        uint256 newDelegation = currentDelegation - amount;

        // Update user delegation amount
        userDelegation[msg.sender][tokenId] = newDelegation;
        totalUserDelegations[msg.sender] -= amount;

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
     * @notice Returns the list of tokenIds to which the user has delegated tokens and the corresponding amounts
     * @param user The address of the user
     * @return tokenIds The list of tokenIds
     * @return amounts The list of amounts delegated to each tokenId
     * @dev This function iterates through the entire linked list. For very large lists, consider adding pagination.
     */
    function getDelegations(address user) external view returns (uint256[] memory tokenIds, uint256[] memory amounts) {
        // Prevent excessive gas consumption by limiting iteration
        // In production, consider implementing pagination for very large lists
        uint256 maxIterations = 1000; // Reasonable limit to prevent DoS
        uint256 count = 0;
        uint256 tokenId = head;
        uint256 iterations = 0;

        // First pass: count the number of delegations
        while (tokenId != 0 && iterations < maxIterations) {
            if (userDelegation[user][tokenId] > 0) {
                count++;
            }
            tokenId = nodes[tokenId].next;
            unchecked {
                ++iterations;
            }
        }

        // Allocate arrays with the correct size
        tokenIds = new uint256[](count);
        amounts = new uint256[](count);

        // Second pass: populate the arrays
        count = 0;
        tokenId = head;
        iterations = 0;
        while (tokenId != 0 && iterations < maxIterations) {
            if (userDelegation[user][tokenId] > 0) {
                tokenIds[count] = tokenId;
                amounts[count] = userDelegation[user][tokenId];
                count++;
            }
            tokenId = nodes[tokenId].next;
            unchecked {
                ++iterations;
            }
        }
    }

    /**
     * @notice Retrieves the current seat update proposal information
     * @return SeatUpdate struct containing proposal details
     */
    function getSeatUpdate() public view returns (SeatUpdate memory) {
        return seatUpdate;
    }

    /**
     * @notice Updates the number of board seats
     * @dev Creates a proposal if seats are already set, or sets immediately if initial setup.
     *      If a different number is proposed, cancels existing proposal.
     * @param tokenId The tokenId making the proposal (must be a director)
     * @param numOfSeats The new number of seats to propose
     * @custom:security Requires director status via isDirector modifier
     */
    function updateSeats(uint256 tokenId, uint256 numOfSeats) public isDirector(tokenId) {
        _setSeats(tokenId, numOfSeats);
    }

    /**
     * @notice Executes a pending seat update proposal after timelock expires
     * @dev Requires proposal exists, timelock expired, and quorum support maintained
     * @param tokenId The tokenId executing the proposal (must be a director)
     * @custom:security Requires director status, timelock expiration, and quorum support
     */
    function executeSeatsUpdate(uint256 tokenId) public isDirector(tokenId) {
        _executeSeatsUpdate(tokenId);
    }

    /// WALLET ///

    /**
     * @notice Submits a new transaction for approval by directors
     * @param tokenId The tokenId submitting the transaction (must be a director)
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The calldata to include in the transaction
     * @custom:security Requires director status, automatically confirms with submitter's tokenId
     */
    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data)
        public
        isDirector(tokenId)
    {
        _submitTransaction(tokenId, target, value, data);
    }

    /**
     * @notice Confirms a transaction with a director's tokenId
     * @param tokenId The tokenId confirming the transaction (must be a director)
     * @param transactionId The ID of the transaction to confirm
     * @custom:security Requires director status, prevents duplicate confirmations
     */
    function confirmTransaction(uint256 tokenId, uint256 transactionId) public isDirector(tokenId) {
        _confirmTransaction(tokenId, transactionId);
    }

    /**
     * @notice Executes a transaction if it has enough confirmations
     * @param tokenId The tokenId executing the transaction (must be a director)
     * @param transactionId The ID of the transaction to execute
     * @custom:security Requires director status and quorum confirmations
     * @custom:error NotEnoughConfirmations Reverts if quorum not met
     */
    function executeTransaction(uint256 tokenId, uint256 transactionId) public isDirector(tokenId) {
        if (getTransaction(transactionId).confirmations < getQuorum()) revert NotEnoughConfirmations();
        _executeTransaction(tokenId, transactionId);
    }

    /**
     * @notice Revokes a confirmation for a transaction
     * @param tokenId The tokenId revoking the confirmation (must be a director)
     * @param transactionId The ID of the transaction to revoke confirmation for
     * @custom:security Requires director status
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId) public isDirector(tokenId) {
        _revokeConfirmation(tokenId, transactionId);
    }
    /**
     * @notice Submits multiple transactions for approval in a single call
     * @param tokenId The tokenId submitting the transactions (must be a director)
     * @param targets The array of addresses to send the transactions to
     * @param values The array of amounts of Ether to send
     * @param data The array of data to include in each transaction
     * @custom:error ArrayLengthsMustMatch Reverts if array lengths don't match
     * @custom:security Requires director status for all transactions
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
     * @param tokenId The tokenId confirming the transactions (must be a director)
     * @param transactionIds The array of transaction IDs to confirm
     * @custom:security Requires director status for all confirmations
     */
    function confirmBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) public isDirector(tokenId) {
        for (uint256 i = 0; i < transactionIds.length; i++) {
            _confirmTransaction(tokenId, transactionIds[i]);
        }
    }

    /**
     * @notice Executes multiple transactions in a single call if they have enough confirmations
     * @param tokenId The tokenId executing the transactions (must be a director)
     * @param transactionIds The array of transaction IDs to execute
     * @dev Each transaction must individually meet quorum requirements
     * @custom:security Requires director status and quorum for each transaction
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

    /**
     * @notice Modifier to restrict access to only directors
     * @dev Checks if the tokenId is in the top N seats and verifies the caller owns the NFT
     * @param tokenId The tokenId to check director status for
     * @custom:error NotDirector Reverts if tokenId is not a director or caller doesn't own the NFT
     */
    modifier isDirector(uint256 tokenId) {
        // Check if tokenId is in top seats
        uint256 seats = _getSeats();
        uint256 current = head;

        // Iterate through linked list directly rather than creating array
        for (uint256 i; i < seats;) {
            if (current == 0) break; // Exit if we reach end of list

            if (current == tokenId) {
                // Found tokenId in top seats, now verify caller owns it
                if (nft.ownerOf(tokenId) == msg.sender) {
                    _;
                    return;
                }
                revert NotDirector();
            }

            current = nodes[current].next;
            unchecked {
                ++i;
            }
        }
        revert NotDirector();
    }

    /// ERC20 OVERRIDES ///

    /**
     * @notice Transfers tokens to a specified address
     * @dev Overrides the ERC20 transfer function to include delegation checks.
     *      Ensures users cannot transfer more tokens than they have available (excluding delegations).
     * @param to The recipient address
     * @param value The amount of tokens to transfer
     * @return true if the transfer is successful
     * @custom:error TransferToZeroAddress Reverts if recipient is zero address
     * @custom:error ExceedsDelegatedAmount Reverts if transfer would leave insufficient balance for delegations
     */
    function transfer(address to, uint256 value) public override(ERC20, IERC20) nonReentrant returns (bool) {
        if (to == address(0)) revert TransferToZeroAddress();

        address owner = _msgSender();
        _transfer(owner, to, value);

        if (balanceOf(owner) < totalUserDelegations[owner]) {
            revert ExceedsDelegatedAmount();
        }

        return true;
    }

    /**
     * @notice Transfers tokens from one address to another
     * @dev Overrides the ERC20 transferFrom function to include delegation checks.
     *      Ensures users cannot transfer more tokens than they have available (excluding delegations).
     * @param from The address to transfer tokens from
     * @param to The address to transfer tokens to
     * @param value The amount of tokens to transfer
     * @return true if the transfer is successful
     * @custom:error TransferToZeroAddress Reverts if recipient is zero address
     * @custom:error ExceedsDelegatedAmount Reverts if transfer would leave insufficient balance for delegations
     */
    function transferFrom(address from, address to, uint256 value)
        public
        override(ERC20, IERC20)
        nonReentrant
        returns (bool)
    {
        if (to == address(0)) revert TransferToZeroAddress();

        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);

        if (balanceOf(from) < totalUserDelegations[from]) {
            revert ExceedsDelegatedAmount();
        }

        return true;
    }
}
