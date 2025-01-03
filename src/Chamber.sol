// SPDX-License-Identifier: MIT
// Loreum Chamber v1

pragma solidity 0.8.24;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";

/// @title Chamber Contract
/// @notice This contract manages a multisig wallet with governance and delegation features using ERC20 and ERC721 tokens.
contract Chamber is Board, Wallet, ReentrancyGuard {
    /// @notice The version of this implementation.
    string public version = "1.1.0";
    /// @notice ERC20 governance token
    IERC20 public token;
    /// @notice ERC721 membership token
    IERC721 public nft;

    /// @notice Mapping to track delegated amounts per user per tokenId
    mapping(address => mapping(uint256 => uint256)) private _userDelegations;

    /// @notice Emitted when the contract receives Ether
    /// @param sender The address that sent the Ether
    /// @param amount The amount of Ether received
    event Received(address indexed sender, uint256 amount);

    /// Custom Errors
    error InsufficientDelegatedAmount();
    error TransferFailed();
    error ArrayLengthsMustMatch();
    error NotEnoughConfirmations();
    error CallerIsNotADirector();
    error ZeroAddress();
    error ZeroAmount();
    error ArrayIndexOutOfBounds();
    error CannotTransfer();
    
    /// @notice Initializes the Chamber contract with the given ERC20 and ERC721 tokens and sets the number of seats
    /// @param erc20Token The address of the ERC20 token
    /// @param erc721Token The address of the ERC721 token
    /// @param seats The initial number of seats
    constructor(address erc20Token, address erc721Token, uint256 seats) {
        if (erc20Token == address(0) || erc721Token == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(erc20Token);
        nft = IERC721(erc721Token);
        _setSeats(seats);
    }

    /// @notice Delegates a specified amount of tokens to a tokenId
    /// @param tokenId The tokenId to which tokens are delegated
    /// @param amount The amount of tokens to delegate
    function delegate(uint256 tokenId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Cache the current delegation amount to minimize storage reads
        uint256 currentDelegation = _userDelegations[msg.sender][tokenId];
        uint256 newDelegation = currentDelegation + amount;

        // Update user delegation amount
        _userDelegations[msg.sender][tokenId] = newDelegation;

        _delegate(tokenId, amount);

        // Transfer tokens from user
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
    }

    /// @notice Undelegates a specified amount of tokens from a tokenId
    /// @param tokenId The tokenId from which tokens are undelegated
    /// @param amount The amount of tokens to undelegate
    function undelegate(uint256 tokenId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Cache the current delegation amount to minimize storage reads
        uint256 currentDelegation = _userDelegations[msg.sender][tokenId];
        if (currentDelegation < amount) revert InsufficientDelegatedAmount();

        uint256 newDelegation = currentDelegation - amount;

        // Update user delegation amount
        _userDelegations[msg.sender][tokenId] = newDelegation;

        _undelegate(tokenId, amount);

        // Transfer tokens back to user
        if (!token.transfer(msg.sender, amount)) revert TransferFailed();
    }

    /// BOARD ///

    /// @notice Retrieves the node information for a given tokenId
    /// @param tokenId The tokenId to retrieve information for
    /// @return The Node struct containing the node information
    function getMember(uint256 tokenId) public view returns (Node memory) {
        return _getNode(tokenId);
    }

    /// @notice Retrieves the top tokenIds and their amounts
    /// @param count The number of top tokenIds to retrieve
    /// @return An array of top tokenIds and their corresponding amounts
    function getTop(uint256 count) public view returns (uint256[] memory, uint256[] memory) {
        return _getTop(count);
    }

    /// @notice Retrieves the delegation amount for a user and tokenId
    /// @param user The address of the user
    /// @param tokenId The tokenId to check
    /// @return The amount of tokens delegated by the user to the tokenId
    function getDelegation(address user, uint256 tokenId) public view returns (uint256) {
        return _userDelegations[user][tokenId];
    }

    /// @notice Retrieves the current quorum
    /// @return The current quorum value
    function getQuorum() public view returns (uint256) {
        return _getQuorum();
    }

    /// @notice Retrieves the current number of seats
    /// @return The current number of seats
    function getSeats() public view returns (uint256) {
        return _getSeats();
    }

    /// @notice Retrieves the addresses of the current directors
    /// @return An array of addresses representing the current directors
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

    /// @notice Returns the list of tokenIds to which the user has delegated tokens and the corresponding amounts
    /// @param user The address of the user
    /// @return tokenIds The list of tokenIds
    /// @return amounts The list of amounts delegated to each tokenId
    function getDelegations(address user) external view returns (uint256[] memory tokenIds, uint256[] memory amounts) {
        uint256 count = 0;
        uint256 tokenId = head;

        // First pass: count the number of delegations
        while (tokenId != 0) {
            if (_userDelegations[user][tokenId] > 0) {
                count++;
            }
            tokenId = nodes[tokenId].next;
        }

        // Allocate arrays with the correct size
        tokenIds = new uint256[](count);
        amounts = new uint256[](count);

        // Second pass: populate the arrays
        count = 0;
        tokenId = head;
        while (tokenId != 0) {
            if (_userDelegations[user][tokenId] > 0) {
                tokenIds[count] = tokenId;
                amounts[count] = _userDelegations[user][tokenId];
                count++;
            }
            tokenId = nodes[tokenId].next;
        }
    }

    /// @notice Retrieves the list of addresses that have requested a seat update
    /// @return An array of addresses that have requested a seat update
    function getSeatUpdate() public view returns (address[] memory) {
        return _getSeatUpdateList();
    }

    /// @notice Updates the number of seats
    /// @param numOfSeats The new number of seats
    function updateNumSeats(uint256 numOfSeats) public onlyDirector {
        _setSeats(numOfSeats);
    }

    /// WALLET ///

    /// @notice Submits a new transaction for approval
    /// @param target The address to send the transaction to
    /// @param value The amount of Ether to send
    /// @param data The data to include in the transaction
    function submitTransaction(address target, uint256 value, bytes memory data) public onlyDirector {
        _submitTransaction(target, value, data);
    }

    /// @notice Confirms a transaction
    /// @param transactionId The ID of the transaction to confirm
    function confirmTransaction(uint256 transactionId) public onlyDirector {
        _confirmTransaction(transactionId);
    }

    /// @notice Executes a transaction if it has enough confirmations
    /// @param transactionId The ID of the transaction to execute
    function executeTransaction(uint256 transactionId) public onlyDirector {
        if (getTransaction(transactionId).confirmations < getQuorum()) revert NotEnoughConfirmations();

        // Cache token balance before execution
        uint256 balanceBefore = token.balanceOf(address(this));

        // Execute the transaction
        _executeTransaction(transactionId);

        // Ensure token balance hasn't decreased
        if (token.balanceOf(address(this)) < balanceBefore) revert CannotTransfer();
    }

    /// @notice Revokes a confirmation for a transaction
    /// @param transactionId The ID of the transaction to revoke confirmation for
    function revokeConfirmation(uint256 transactionId) public onlyDirector {
        _revokeConfirmation(transactionId);
    }

    /// @notice Submits multiple transactions for approval in a single call
    /// @param targets The array of addresses to send the transactions to
    /// @param values The array of amounts of Ether to send
    /// @param data The array of data to include in each transaction
    function submitBatchTransactions(address[] memory targets, uint256[] memory values, bytes[] memory data)
        public
        onlyDirector
    {
        if (targets.length != values.length || values.length != data.length) revert ArrayLengthsMustMatch();

        for (uint256 i = 0; i < targets.length; i++) {
            _submitTransaction(targets[i], values[i], data[i]);
        }
    }

    /// @notice Confirms multiple transactions in a single call
    /// @param transactionIds The array of transaction IDs to confirm
    function confirmBatchTransactions(uint256[] memory transactionIds) public onlyDirector {
        for (uint256 i = 0; i < transactionIds.length; i++) {
            _confirmTransaction(transactionIds[i]);
        }
    }

    /// @notice Executes multiple transactions in a single call if they have enough confirmations
    /// @param transactionIds The array of transaction IDs to execute
    function executeBatchTransactions(uint256[] memory transactionIds) public onlyDirector {
        for (uint256 i = 0; i < transactionIds.length; i++) {
            uint256 transactionId = transactionIds[i];
            if (getTransaction(transactionId).confirmations < getQuorum()) revert NotEnoughConfirmations();
            _executeTransaction(transactionId);
        }
    }

    /// @notice Fallback function to receive Ether
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /// @notice Modifier to restrict access to only directors
    modifier onlyDirector() {
        uint256 seats = _getSeats();
        uint256 current = head;

        // Iterate through linked list directly rather than creating array
        for (uint256 i; i < seats;) {
            if (current == 0) break; // Exit if we reach end of list

            if (nft.ownerOf(current) == msg.sender) {
                _;
                return;
            }

            current = nodes[current].next;
            unchecked {
                ++i;
            }
        }

        revert CallerIsNotADirector();
    }
}
