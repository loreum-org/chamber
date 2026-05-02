// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC4626} from "lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {IBoard} from "./IBoard.sol";
import {IWallet} from "./IWallet.sol";

/**
 * @title IChamber
 * @author xhad, Loreum DAO LLC
 * @notice Interface for the Chamber: ERC-4626 vault, delegation-weighted board, and director multisig wallet.
 * @dev Combines {IERC4626}, {IBoard}, and {IWallet}. Errors and events from those parents apply unless
 *      overridden or extended below. Share token transfers enforce that delegated weight cannot be stranded.
 */
interface IChamber is IERC4626, IBoard, IWallet {
    /**
     * @notice Initializes the proxy; callable once by the proxy during deployment.
     * @param erc20Token Underlying ERC-20 asset for the ERC-4626 vault
     * @param erc721Token Membership ERC-721 whose holders may be directors when in top seats
     * @param seats Initial board seat count (must be 1..20 inclusive)
     * @param name ERC-20 name for chamber share tokens
     * @param symbol ERC-20 symbol for chamber share tokens
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
     * @notice Returns the list of tokenIds to which the holder has delegated tokens and the corresponding amounts
     * @param holder The address holding Chamber shares that delegated voting weight
     * @return tokenIds The list of tokenIds
     * @return amounts The list of amounts delegated to each tokenId
     */
    function getDelegations(address holder) external view returns (uint256[] memory tokenIds, uint256[] memory amounts);

    /**
     * @notice Returns the amount delegated by a holder to a specific membership tokenId
     * @param holder The delegating holder address
     * @param tokenId The token ID
     * @return amount The amount delegated
     */
    function getHolderDelegation(address holder, uint256 tokenId) external view returns (uint256);

    /**
     * @notice Returns the total amount delegated by a holder across all tokenIds
     * @param holder The delegating holder address
     * @return amount The total amount delegated
     */
    function getTotalHolderDelegations(address holder) external view returns (uint256);

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
     * @notice Optional hook reserved for registry flows; current implementation is a no-op.
     * @dev The registry transfers `ProxyAdmin` ownership to the chamber directly after deployment.
     */
    function acceptAdmin() external;

    /**
     * @notice Returns the `ProxyAdmin` contract address for this transparent proxy (ERC-1967 admin slot).
     * @return adminContract The OpenZeppelin `ProxyAdmin` instance controlling upgrades for this chamber
     */
    function getProxyAdmin() external view returns (address adminContract);

    /**
     * @notice Performs an implementation upgrade via the chamber-owned `ProxyAdmin`.
     * @dev Must be called with `msg.sender == address(this)` (e.g. via `executeTransaction`). Requires
     *      `ProxyAdmin.owner() == address(this)` and non-zero `newImplementation`.
     * @param newImplementation Address of the new implementation contract
     * @param data Optional data forwarded to `upgradeAndCall` (e.g. initializer on the new implementation)
     */
    function upgradeImplementation(address newImplementation, bytes calldata data) external;

    /// Events
    /**
     * @notice Emitted when delegation is updated
     * @param holder The address delegating Chamber shares
     * @param tokenId The tokenId being delegated to
     * @param amount The amount delegated
     */
    event DelegationUpdated(address indexed holder, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Reserved event for directorship transitions (not emitted by the current Chamber implementation).
     * @param account The account whose directorship changed
     * @param tokenId The membership token ID associated with the directorship
     * @param isDirector Whether the account is now a director
     */
    event DirectorshipChanged(address indexed account, uint256 indexed tokenId, bool isDirector);

    /**
     * @notice Reserved event for quorum changes (not emitted by the current Chamber implementation).
     * @param oldQuorum Previous wallet confirmation threshold
     * @param newQuorum New wallet confirmation threshold
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
     * @notice Emitted when a director votes to cancel a transaction
     * @param transactionId The ID of the transaction
     * @param voter The address of the director voting to cancel
     */
    event TransactionCancelVoted(uint256 indexed transactionId, address indexed voter);

    /**
     * @notice Emitted when the contract receives Ether
     * @param sender The address that sent the Ether
     * @param amount The amount of Ether received
     */
    event Received(address indexed sender, uint256 amount);

    /**
     * @notice Emitted when the contract receives an ERC721 token via safeTransferFrom
     * @param token The ERC721 contract address
     * @param from The address that sent the token
     * @param tokenId The token ID received
     */
    event ReceivedERC721(address indexed token, address indexed from, uint256 indexed tokenId);

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

    /// @notice Reserved error (not reverted by current Chamber source); kept for ABI compatibility.
    /// @param account The account that would not be on the leaderboard
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

    /// @notice Thrown when upgrade is unauthorized
    error NotAuthorized();

    /// @notice Thrown when signature is invalid
    error InvalidSignature();
}
