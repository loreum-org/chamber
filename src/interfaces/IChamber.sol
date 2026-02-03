// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC4626} from "lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {IBoard} from "./IBoard.sol";
import {IWallet} from "./IWallet.sol";

/**
 * @title IChamber
 * @notice Interface for Chamber contract combining ERC4626 vault, Board governance, and Wallet multisig
 */
interface IChamber is IERC4626, IBoard, IWallet {
    /**
     * @notice Initializes the Chamber contract
     * @param erc20Token The address of the ERC20 token
     * @param erc721Token The address of the ERC721 token
     * @param seats The initial number of seats
     * @param name The name of the chamber's ERC20 token
     * @param symbol The symbol of the chamber's ERC20 token
     */
    function initialize(
        address erc20Token,
        address erc721Token,
        uint256 seats,
        string memory name,
        string memory symbol
    ) external;

    /**
     * @notice Delegates a specified amount of tokens to a tokenId
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens to delegate
     */
    function delegate(uint256 tokenId, uint256 amount) external;

    /**
     * @notice Undelegates a specified amount of tokens from a tokenId
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens to undelegate
     */
    function undelegate(uint256 tokenId, uint256 amount) external;

    /**
     * @notice Returns the list of tokenIds to which the agent has delegated tokens and the corresponding amounts
     * @param agent The address of the agent
     * @return tokenIds The list of tokenIds
     * @return amounts The list of amounts delegated to each tokenId
     */
    function getDelegations(address agent) external view returns (uint256[] memory tokenIds, uint256[] memory amounts);

    /**
     * @notice Returns the amount delegated by a agent to a specific tokenId
     * @param agent The address of the agent
     * @param tokenId The token ID
     * @return amount The amount delegated
     */
    function getAgentDelegation(address agent, uint256 tokenId) external view returns (uint256);

    /**
     * @notice Returns the total amount delegated by a agent across all tokenIds
     * @param agent The address of the agent
     * @return amount The total amount delegated
     */
    function getTotalAgentDelegations(address agent) external view returns (uint256);

    /**
     * @notice Returns the first delegation timestamp for an agent
     * @param agent The address of the agent
     * @return The timestamp of the agent's first delegation (0 if never delegated)
     */
    function getAgentFirstDelegationTime(address agent) external view returns (uint256);

    /**
     * @notice Updates the number of seats
     * @param tokenId The tokenId proposing the update
     * @param numOfSeats The new number of seats
     */
    function updateSeats(uint256 tokenId, uint256 numOfSeats) external;

    /**
     * @notice Executes a pending seat update proposal if it has enough support and the timelock has expired
     * @param tokenId The tokenId executing the update
     */
    function executeSeatsUpdate(uint256 tokenId) external;

    /**
     * @notice Accepts admin ownership of the ProxyAdmin (called by Registry after deployment)
     * @dev Transfers ProxyAdmin ownership from Registry to this Chamber
     */
    function acceptAdmin() external;

    /**
     * @notice Returns the ProxyAdmin address for this Chamber proxy
     * @return The ProxyAdmin address
     */
    function getProxyAdmin() external view returns (address);

    /**
     * @notice Upgrades the Chamber implementation (can be called via transaction system)
     * @dev This function should be called via executeTransaction with proper governance
     * @param newImplementation The new implementation address
     * @param data Optional initialization data
     */
    function upgradeImplementation(address newImplementation, bytes calldata data) external;

    /// Events
    /**
     * @notice Emitted when delegation is updated
     * @param agent The address of the agent delegating
     * @param tokenId The tokenId being delegated to
     * @param amount The amount delegated
     */
    event DelegationUpdated(address indexed agent, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when directorship changes
     * @param account The account whose directorship changed
     * @param tokenId The tokenId associated with the directorship
     * @param isDirector Whether the account is now a director
     */
    event DirectorshipChanged(address indexed account, uint256 indexed tokenId, bool isDirector);

    /**
     * @notice Emitted when quorum is updated
     * @param oldQuorum The previous quorum value
     * @param newQuorum The new quorum value
     */
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    /**
     * @notice Emitted when a transaction is submitted (Chamber-specific event)
     * @param transactionId The ID of the submitted transaction
     * @param target The target address
     * @param value The ETH value
     */
    event TransactionSubmitted(uint256 indexed transactionId, address indexed target, uint256 value);

    /**
     * @notice Emitted when a transaction is confirmed (Chamber-specific event)
     * @param transactionId The ID of the confirmed transaction
     * @param confirmer The address of the confirmer
     */
    event TransactionConfirmed(uint256 indexed transactionId, address indexed confirmer);

    /**
     * @notice Emitted when a transaction is executed (Chamber-specific event)
     * @param transactionId The ID of the executed transaction
     * @param executor The address of the executor
     */
    event TransactionExecuted(uint256 indexed transactionId, address indexed executor);

    /**
     * @notice Emitted when the contract receives Ether
     * @param sender The address that sent the Ether
     * @param amount The amount of Ether received
     */
    event Received(address indexed sender, uint256 amount);

    /// Errors
    /// @notice Thrown when there is insufficient delegated amount
    error InsufficientDelegatedAmount();

    /// @notice Thrown when chamber balance is insufficient
    error InsufficientChamberBalance();

    /// @notice Thrown when transfer would exceed delegated amount
    error ExceedsDelegatedAmount();

    /// @notice Thrown when transfer fails
    error TransferFailed();

    /// @notice Thrown when trying to transfer to zero address
    error TransferToZeroAddress();

    /// @notice Thrown when array lengths don't match
    error ArrayLengthsMustMatch();

    /// @notice Thrown when there are not enough confirmations
    error NotEnoughConfirmations();

    /// @notice Thrown when caller is not a director
    error NotDirector();

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when amount is zero
    error ZeroAmount();

    /// @notice Thrown when tokenId is zero
    error ZeroTokenId();

    /// @notice Thrown when tokenId is invalid
    error InvalidTokenId();

    /// @notice Thrown when array index is out of bounds
    error ArrayIndexOutOfBounds();

    /// @notice Thrown when transfer cannot be performed
    error CannotTransfer();

    /// @notice Thrown when address is not on leaderboard
    /// @param account The account that is not on leaderboard
    error NotOnLeaderboard(address account);

    /// @notice Thrown when number of seats is zero
    error ZeroSeats();

    /// @notice Thrown when number of seats exceeds maximum
    error TooManySeats();

    /// @notice Thrown when delegation is invalid
    error InvalidDelegation();

    /// @notice Thrown when NFT owner is invalid
    error InvalidNFTOwner();

    /// @notice Thrown when quorum is invalid
    error InvalidQuorum();

    /// @notice Thrown when transaction is invalid
    error InvalidTransaction();

    /// @notice Thrown when signature is invalid
    error InvalidSignature();

    /// @notice Thrown when delegation is too recent to perform director actions
    error DelegationTooRecent();
}
