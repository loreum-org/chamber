// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title IBoard
 * @notice Interface for Board governance functionality
 * @dev Structs are defined in Board.sol - use Board.Node and Board.SeatUpdate types
 */
interface IBoard {

    /**
     * @notice Retrieves node information for a given tokenId
     * @param tokenId The token ID to query
     * @return Node struct containing the node's data (Board.Node)
     */
    /// @dev Returns Node struct (defined in Board.sol)
    function getMember(uint256 tokenId) external view returns (uint256, uint256, uint256, uint256);

    /**
     * @notice Retrieves the top tokenIds and their amounts
     * @param count The number of top tokenIds to retrieve
     * @return An array of top tokenIds and their corresponding amounts
     */
    function getTop(uint256 count) external view returns (uint256[] memory, uint256[] memory);

    /**
     * @notice Returns the total size of the board
     * @return uint256 current size of the board
     */
    function getSize() external view returns (uint256);

    /**
     * @notice Retrieves the current quorum
     * @return The current quorum value
     */
    function getQuorum() external view returns (uint256);

    /**
     * @notice Retrieves the current number of seats
     * @return The current number of seats
     */
    function getSeats() external view returns (uint256);

    /**
     * @notice Retrieves the addresses of the current directors
     * @return An array of addresses representing the current directors
     */
    function getDirectors() external view returns (address[] memory);

    /**
     * @notice Returns the current seat update proposal
     * @return The current SeatUpdate struct containing proposal details (Board.SeatUpdate)
     */
    /// @dev Returns SeatUpdate struct (defined in Board.sol, includes requiredQuorum field)
    function getSeatUpdate() external view returns (uint256 proposedSeats, uint256 timestamp, uint256 requiredQuorum, uint256[] memory supporters);

    /// Events
    /**
     * @notice Emitted when the number of seats is set
     * @param tokenId The tokenId that called the function
     * @param numOfSeats The new number of seats
     */
    event SetSeats(uint256 indexed tokenId, uint256 numOfSeats);

    /**
     * @notice Emitted when a seat update proposal is cancelled
     * @param tokenId The tokenId who cancelled the proposal
     */
    event SeatUpdateCancelled(uint256 indexed tokenId);

    /**
     * @notice Emitted when a call to set the number of seats is made
     * @param tokenId The tokenId that called the function
     * @param seats The number of seats
     */
    event ExecuteSetSeats(uint256 indexed tokenId, uint256 seats);

    /**
     * @notice Emitted when a user delegates tokens to a tokenId
     * @param sender The address of the user delegating tokens
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens delegated
     */
    event Delegate(address indexed sender, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when a user undelegates tokens from a tokenId
     * @param sender The address of the user undelegating tokens
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens undelegated
     */
    event Undelegate(address indexed sender, uint256 indexed tokenId, uint256 amount);

    /// Errors
    /// @notice Thrown when an update request has already been sent by the caller
    error AlreadySentUpdateRequest();

    /// @notice Thrown when the number of seats provided is invalid
    error InvalidNumSeats();

    /// @notice Thrown when the node does not exist
    error NodeDoesNotExist();

    /// @notice Thrown when the amount exceeds the delegation
    error AmountExceedsDelegation();

    /// @notice Thrown when the proposal ID is invalid or does not exist
    error InvalidProposal();

    /// @notice Thrown when attempting to execute a proposal before its timelock period has expired
    error TimelockNotExpired();

    /// @notice Thrown if updateSeats execution call hasn't got enough votes
    error InsufficientVotes();

    /// @notice Thrown when a supporter is not found on the leaderboard
    /// @param supporter The address of the supporter
    error SupporterNotOnLeaderboard(address supporter);

    /// @notice Thrown when the linked list has reached its maximum size
    error MaxNodesReached();

    /// @notice Thrown when circuit breaker is active
    error CircuitBreakerActive();
}
