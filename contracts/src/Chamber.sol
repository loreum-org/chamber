// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";
import {WalletTypes} from "src/types/WalletTypes.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC4626} from "lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {IERC721Receiver} from "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import {
    ERC4626Upgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {StorageSlot} from "lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol";
import {EnumerableSet} from "lib/openzeppelin-contracts/contracts/utils/structs/EnumerableSet.sol";
import {TransientSlot} from "lib/openzeppelin-contracts/contracts/utils/TransientSlot.sol";

/**
 * @title Chamber Contract
 * @notice This contract is a smart vault for managing assets with a board of directors
 * @author xhad, Loreum DAO LLC
 */
contract Chamber is ERC4626Upgradeable, PausableUpgradeable, Board, Wallet, IChamber, IERC721Receiver {
    using EnumerableSet for EnumerableSet.UintSet;
    using TransientSlot for *;

    /// @dev Retired session-key record (removed in 1.3.0). Kept only so the storage layout does not shift.
    struct DirectorSession {
        address owner;
        uint64 expiry;
        uint32 scope;
        address operator;
        uint64 liveAt;
    }

    /**
     * @notice ERC-7201 namespaced storage layout for Chamber
     * @dev Packing: `nft` (address, 20 bytes) sits alone in its slot; remaining fields are
     *      dynamic types or mappings which each occupy a full slot.
     *      `holderDelegatedTokenIds`, `directorSession`, `confirmOwner`, and `cancelOwner`
     *      are appended so existing ERC-7201 slots stay stable.
     * @custom:storage-location erc7201:loreum.Chamber
     */
    struct ChamberStorage {
        IERC721 nft;
        mapping(address => mapping(uint256 => uint256)) holderDelegation;
        mapping(address => uint256) totalHolderDelegations;
        /// @dev Per-holder set of tokenIds with a positive delegation, including board-evicted ids.
        mapping(address => EnumerableSet.UintSet) holderDelegatedTokenIds;
        /// @dev Unused since 1.3.0 (session keys removed). Kept for layout stability.
        mapping(uint256 tokenId => DirectorSession) directorSession;
        /// @dev `ownerOf` when the confirm bit was last written. Mismatch is ignored for quorum (PMN-H01 A).
        mapping(uint256 nonce => mapping(uint256 tokenId => address)) confirmOwner;
        /// @dev `ownerOf` when the cancel bit was last written. Mismatch is ignored for quorum (PMN-H01 A).
        mapping(uint256 nonce => mapping(uint256 tokenId => address)) cancelOwner;
        /// @dev `nodeEpoch + 1` when `liveDelegation` was last written; 0 = not tracked (pre-upgrade).
        mapping(address => mapping(uint256 => uint256)) holderEpoch;
        /// @dev Part of `holderDelegation` that sits in the current board node for that tokenId.
        ///      The rest was stranded by an eviction or inert cleanup and never touches the board.
        mapping(address => mapping(uint256 => uint256)) liveDelegation;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Chamber")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _CHAMBER_STORAGE_SLOT = 0x6859c8344c1b514e5663b471fb3ef74d69055f0a732aeacba684a8480d92bd00;

    function _getChamberStorage() internal pure returns (ChamberStorage storage $) {
        assembly {
            $.slot := _CHAMBER_STORAGE_SLOT
        }
    }

    /// @dev Events and errors are defined in IChamber interface

    /// Constants
    uint256 private constant MAX_SEATS = 20;

    /**
     * @notice Implementation version stored as a bytes32 constant.
     * @dev Replaces `string version` in ChamberStorage — a dynamic string uses 2+ storage slots
     *      (length word + data word) and incurs an SLOAD on every read. A bytes32 constant is
     *      inlined at compile time: zero runtime gas, zero storage slots.
     */
    bytes32 public constant VERSION = "1.3.0";

    /// @notice Function selector for upgradeImplementation(address,bytes)
    bytes4 private constant UPGRADE_SELECTOR = 0xc89311b6;
    /// @notice Function selector for pause()
    bytes4 private constant PAUSE_SELECTOR = 0x8456cb59;
    /// @notice Function selector for unpause()
    bytes4 private constant UNPAUSE_SELECTOR = 0x3f4ba83a;
    /// @dev OpenZeppelin `ReentrancyGuardTransient` slot, shared with every `nonReentrant` function.
    ///      `test/findings/FindingM02_SharedGuardSlot.t.sol` fails if the two ever drift apart.
    bytes32 private constant _REENTRANCY_GUARD_SLOT =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;
    /// @dev ERC-1967 admin slot
    bytes32 private constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    constructor() {
        _disableInitializers();
    }

    /// EXPLICIT GETTERS for formerly-public state variables ///

    /// @notice ERC721 membership token
    function nft() external view returns (IERC721) {
        return _getChamberStorage().nft;
    }

    /**
     * @notice Initializes the Chamber contract with the given ERC20 and ERC721 tokens and sets the number of seats
     * @dev `seats` must be between 1 and `MAX_SEATS` (20) inclusive; aligns with `Registry` validation.
     *      `erc20Token` must be a standard ERC-20: `transfer`/`transferFrom` move exactly the requested
     *      amount, and `balanceOf` must not rebase independently of transfers. Fee-on-transfer deposits
     *      revert via `_deposit`. Rebasing/elastic tokens remain unsupported.
     * @param erc20Token The address of the standard ERC-20 vault asset
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
        if (seats == 0) revert IChamber.ZeroSeats();
        if (seats > MAX_SEATS) revert IChamber.TooManySeats();

        __ERC4626_init(IERC20(erc20Token));
        __ERC20_init(_name, _symbol);
        __ReentrancyGuardTransient_init();
        __Pausable_init();

        ChamberStorage storage $ = _getChamberStorage();
        $.nft = IERC721(erc721Token);

        _setSeats(0, seats);
    }

    /**
     * @notice Delegates a specified amount of tokens to a tokenId
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens to delegate
     */
    function delegate(uint256 tokenId, uint256 amount) external override nonReentrant {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();

        ChamberStorage storage $ = _getChamberStorage();

        // Chamber-held ids can never act as directors; weight on them only blocks seats (R-1012-G1).
        address tokenOwner = _ownerOfOrZero(tokenId);
        if (tokenOwner == address(0) || tokenOwner == address(this)) revert IChamber.InvalidTokenId();

        // Cache balance to avoid multiple SLOADs
        uint256 senderBalance = balanceOf(msg.sender);
        if (senderBalance < amount) revert IChamber.InsufficientChamberBalance();

        $.holderDelegation[msg.sender][tokenId] += amount;
        $.totalHolderDelegations[msg.sender] += amount;
        $.holderDelegatedTokenIds[msg.sender].add(tokenId);

        // Validate the balance constraint one final time after updates to reduce SLOADs
        if (senderBalance < $.totalHolderDelegations[msg.sender]) {
            revert IChamber.InsufficientChamberBalance();
        }

        _trackLiveDelegation($.holderEpoch, $.liveDelegation, msg.sender, tokenId, amount);
        _delegate(tokenId, amount, $.nft);
        emit IChamber.DelegationUpdated(msg.sender, tokenId, $.holderDelegation[msg.sender][tokenId]);
    }

    /**
     * @notice Undelegates a specified amount of tokens from a tokenId
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens to undelegate
     */
    function undelegate(uint256 tokenId, uint256 amount) external override nonReentrant {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();

        ChamberStorage storage $ = _getChamberStorage();
        uint256 currentDelegation = $.holderDelegation[msg.sender][tokenId];
        if (currentDelegation < amount) revert IChamber.InsufficientDelegatedAmount();

        uint256 newDelegation = currentDelegation - amount;
        $.holderDelegation[msg.sender][tokenId] = newDelegation;
        $.totalHolderDelegations[msg.sender] -= amount;
        if (newDelegation == 0) {
            $.holderDelegatedTokenIds[msg.sender].remove(tokenId);
        }

        // Only take weight the caller holds in the current node: evicted nodes (Finding 11) and
        // weight stranded before a re-insertion never touch the board.
        uint256 boardAmount = _consumeLiveDelegation($.holderEpoch, $.liveDelegation, msg.sender, tokenId, amount);
        if (boardAmount != 0) {
            _undelegate(tokenId, boardAmount, $.nft);
        }

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
        return _getBoardStorage().size;
    }

    /**
     * @notice Retrieves the current quorum (minimum distinct director-token confirmations to execute)
     * @dev Integer formula `1 + (n * 51) / 100` where `n` is `min(seats, size)`: occupied
     *      top seats (PMN-M01 keeps empty seats out). Burned or chamber-held ids still count until
     *      {cleanupInertSeat} drops them, so same-block rank changes cannot lower quorum (R-1012-G1).
     *      One- and two-director boards require all reachable directors. Quorum is token-weighted:
     *      it counts distinct top-seat `tokenId`s, not unique addresses. One owner of `quorum`
     *      membership NFTs in the top seats can submit, self-confirm, and execute — a single-actor
     *      treasury. Confirmations are not capped per owner.
     * @return The current quorum value
     */
    function getQuorum() public view override returns (uint256) {
        return _filledSeatQuorum();
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
            topOwners[i] = _ownerOfOrZero(topTokenIds[i]);
            unchecked {
                ++i;
            }
        }

        return topOwners;
    }

    /**
     * @notice Returns the list of tokenIds to which the holder has delegated tokens and the corresponding amounts
     * @dev Insertion order, including ids evicted from the board.
     * @param holder The address holding Chamber shares that delegated voting weight
     * @return tokenIds The list of tokenIds
     * @return amounts The list of amounts delegated to each tokenId
     */
    function getDelegations(address holder)
        public
        view
        override
        returns (uint256[] memory tokenIds, uint256[] memory amounts)
    {
        if (holder == address(0)) revert IChamber.ZeroAddress();
        ChamberStorage storage $c = _getChamberStorage();
        return _collectDelegations($c.holderDelegation, $c.holderDelegatedTokenIds, holder);
    }

    

    

    

    /**
     * @notice Returns the current seat update proposal
     * @return uint256 proposedSeats
     * @return uint256 timestamp
     * @return uint256 requiredQuorum
     * @return uint256[] memory supporters
     */
    function getSeatUpdate() public view override returns (uint256, uint256, uint256, uint256[] memory) {
        BoardTypes.SeatUpdate storage proposal = _getBoardStorage().seatUpdate;
        return (proposal.proposedSeats, proposal.timestamp, proposal.requiredQuorum, proposal.supporters);
    }

    /**
     * @notice Updates the number of seats
     * @param tokenId The tokenId proposing the update
     * @param numOfSeats The new number of seats
     */
    function updateSeats(uint256 tokenId, uint256 numOfSeats) public override directorCall(tokenId) {
        if (numOfSeats == 0) revert IChamber.ZeroSeats();
        if (numOfSeats > MAX_SEATS) revert IChamber.TooManySeats();
        _setSeats(tokenId, numOfSeats, getQuorum());
    }

    /**
     * @notice Lowers `seats` when filled authorized directors are below the configured-seat quorum.
     * @dev PMN-M01 Solution C. Not a wallet self-call; ordinary spend cannot use this path.
     *      `newSeats` must be in `[1, filled]` and strictly less than the current seat count.
     * @param tokenId Director token authorizing the recovery
     * @param newSeats Seat count after recovery
     */
    function recoverSeats(uint256 tokenId, uint256 newSeats) public override directorCall(tokenId) {
        ChamberStorage storage $ = _getChamberStorage();
        uint256 currentSeats = _getSeats();
        uint256 filled = _countFilledSeats();
        if (filled >= _getQuorum()) revert IChamber.SeatRecoveryUnavailable();
        if (newSeats == 0) revert IChamber.ZeroSeats();
        if (newSeats > MAX_SEATS) revert IChamber.TooManySeats();
        if (newSeats >= currentSeats || newSeats > filled) revert IChamber.SeatRecoveryUnavailable();
        _recoverSeats(tokenId, newSeats, $.nft);
        emit IChamber.SeatsRecovered(tokenId, currentSeats, newSeats);
    }

    /**
     * @notice Executes a pending seat update proposal if it has enough support and the timelock has expired
     * @param tokenId The tokenId executing the update
     */
    function executeSeatsUpdate(uint256 tokenId) public override directorCall(tokenId) {
        _executeSeatsUpdate(tokenId, _getChamberStorage().nft, getQuorum());
    }

    /**
     * @notice Deletes the pending seat-update proposal
     * @param tokenId The tokenId requesting cancellation
     */
    function cancelSeatUpdate(uint256 tokenId) public override directorCall(tokenId) {
        _cancelSeatUpdate(tokenId);
    }

    /// WALLET ///

    /**
     * @notice Submits a new transaction for approval and records the submitter's confirmation
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The data to include in the transaction
     * @param metadataURI URI or content hash describing the proposal; empty stores nothing
     * @param deadline Exclusive-after unix timestamp; `0` applies the 30-day default max age
     */
    function submitTransaction(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline
    ) public override directorCall(tokenId) {
        _submitOne(tokenId, target, value, data, metadataURI, deadline);
    }

    /**
     * @notice Confirms a transaction
     * @param tokenId The tokenId confirming the transaction
     * @param transactionId The ID of the transaction to confirm
     */
    function confirmTransaction(uint256 tokenId, uint256 transactionId)
        public
        override
        directorCall(tokenId)
    {
        _confirmOne(tokenId, transactionId);
    }

    /**
     * @notice Executes a transaction if current directors still meet the required quorum
     * @dev Caller must re-supply the original calldata unless this nonce stored it (self-call /
     *      `upgradeImplementation`). Empty `data` uses the stored bytes. Payload is always
     *      verified against the stored keccak256 hash.
     *      Counts live top-seat flags (H-01) against `max(submitQuorum, liveQuorum)` (M-04).
     *      Deadline `0` is unset and is not expired (M-06).
     * @param tokenId The tokenId executing the transaction
     * @param transactionId The ID of the transaction to execute
     * @param data The original calldata, or empty to use stored self-call bytes
     */
    function executeTransaction(uint256 tokenId, uint256 transactionId, bytes calldata data)
        public
        override
        directorCall(tokenId)
    {
        _executeOne(tokenId, transactionId, data);
    }

    /// @dev Shared by single and batch confirm. WalletLib checks exists / executed / cancelled /
    ///      expired / already confirmed.
    function _confirmOne(uint256 tokenId, uint256 transactionId) private {
        _confirmTransaction(tokenId, transactionId);
        emit IChamber.TransactionConfirmed(transactionId, msg.sender);
    }

    /// @dev Shared by single and batch execute.
    function _executeOne(uint256 tokenId, uint256 transactionId, bytes calldata data) private {
        WalletTypes.WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        WalletTypes.Transaction storage transaction = $w.transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
        if ($w.cancelled[transactionId]) revert IWallet.TransactionAlreadyCancelled();
        _notExpired(transactionId);
        if (_countLiveConfirmFlags(transactionId) < _requiredConfirmations(transactionId)) {
            revert IChamber.NotEnoughConfirmations();
        }
        _requireWalletExecuteAllowed(transaction.target, transactionId, data);

        _executeTransaction(tokenId, transactionId, data);
        emit IChamber.TransactionExecuted(transactionId, msg.sender);
    }

    /**
     * @notice Revokes a confirmation for a transaction
     * @dev The token owner may revoke after leaving the top-seat set, so
     *      outgoing approvals can be withdrawn. No ERC-1271 (M-01). Execute already ignores those flags.
     * @param tokenId The tokenId revoking the confirmation
     * @param transactionId The ID of the transaction to revoke confirmation for
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId) public override nonReentrant {
        _requireTokenAuthorized(tokenId);
        _revokeConfirmation(tokenId, transactionId);
    }

    /**
     * @notice Records a director's vote to cancel a transaction. Requires quorum of current directors.
     * @param tokenId The tokenId voting to cancel
     * @param transactionId The ID of the transaction to cancel
     */
    function cancelTransaction(uint256 tokenId, uint256 transactionId)
        public
        override
        directorCall(tokenId)
    {
        WalletTypes.WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        WalletTypes.Transaction storage transaction = $w.transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();

        _recordCancelVote(tokenId, transactionId);
        emit IChamber.TransactionCancelVoted(transactionId, msg.sender);

        if (_countLiveCancelFlags(transactionId) >= getQuorum()) {
            _cancelTransaction(transactionId);
        }
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
    ) public override directorCall(tokenId) {
        if (targets.length != values.length || values.length != data.length) {
            revert IChamber.ArrayLengthsMustMatch();
        }
        if (targets.length == 0) revert IChamber.ZeroAmount();

        uint256 totalValue = 0;
        for (uint256 i = 0; i < values.length;) {
            totalValue += values[i];
            unchecked {
                ++i;
            }
        }
        if (totalValue > address(this).balance) {
            revert IChamber.InsufficientChamberBalance();
        }

        for (uint256 i = 0; i < targets.length;) {
            _submitOne(tokenId, targets[i], values[i], data[i], "", 0);
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Shared by every submit entry point: validate, record, emit.
    function _submitOne(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline
    ) private {
        _validateTransaction(target, value, data);
        _submitTransactionWithMetadata(tokenId, target, value, data, metadataURI, deadline);
        emit IChamber.TransactionSubmitted(getTransactionCount() - 1, target, value);
    }

    /// @dev Snapshot live quorum onto each newly submitted wallet transaction (M-04).
    function _submitQuorum() internal view override returns (uint256) {
        return getQuorum();
    }

    /**
     * @notice Confirmations required to execute a submitted transaction
     * @dev `max(submitQuorum, liveQuorum)` so a later seat decrease cannot revive an
     *      under-quorum nonce, and a later seat increase cannot weaken the live bar.
     */
    function _requiredConfirmations(uint256 nonce) internal view returns (uint256) {
        uint256 submitQuorum = _getWalletStorage().transactionRequiredQuorum[nonce];
        uint256 liveQuorum = getQuorum();
        return submitQuorum > liveQuorum ? submitQuorum : liveQuorum;
    }

    function _validateTransaction(address target, uint256 value, bytes memory data) internal view {
        if (target == address(0)) revert IChamber.ZeroAddress();

        if (target == address(this)) {
            _requireAllowedSelfCall(data);
        } else {
            _requireNoThirdPartyPull(target, asset(), data);
        }

        if (value > 0 && address(this).balance < value) {
            revert IChamber.InsufficientChamberBalance();
        }
    }

    /// @dev Self-calls are limited to upgrade, pause, and unpause so the board cannot invoke arbitrary internals.
    function _requireAllowedSelfCall(bytes memory data) internal pure {
        if (data.length < 4) revert IChamber.InvalidTransaction();
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes4 selector = bytes4(data);
        if (selector != UPGRADE_SELECTOR && selector != PAUSE_SELECTOR && selector != UNPAUSE_SELECTOR) {
            revert IChamber.InvalidTransaction();
        }
    }

    /// @dev While paused, only a quorum self-call to unpause may execute. This avoids a permanent lock.
    ///      Empty `data` uses L-04 stored self-call bytes (same as execute).
    function _requireWalletExecuteAllowed(address target, uint256 transactionId, bytes calldata data) internal view {
        if (!paused()) return;
        bytes memory payload = data;
        if (payload.length == 0) {
            payload = _getWalletStorage().transactionCalldata[transactionId];
        }
        if (target == address(this) && payload.length >= 4) {
            // forge-lint: disable-next-line(unsafe-typecast)
            if (bytes4(payload) == UNPAUSE_SELECTOR) return;
        }
        _requireNotPaused();
    }

    /**
     * @notice Confirms multiple transactions in a single call
     * @param tokenId The tokenId confirming the transactions
     * @param transactionIds The array of transaction IDs to confirm
     */
    function confirmBatchTransactions(uint256 tokenId, uint256[] memory transactionIds)
        public
        override
        directorCall(tokenId)
    {
        if (transactionIds.length == 0) revert IChamber.ZeroAmount();

        for (uint256 i = 0; i < transactionIds.length;) {
            _confirmOne(tokenId, transactionIds[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Executes multiple transactions in a single call if they have enough current-director confirmations
     * @dev Each nonce must meet live top-seat flags >= `max(submitQuorum, liveQuorum)` (H-01, M-04)
     *      and must not be expired (deadline `0` is unset). Caller must re-supply original calldata
     *      for each hash-only transaction in the same order as transactionIds. Self-call / upgrade
     *      entries may be empty and use the onchain store (L-04). Each payload is verified against
     *      its stored keccak256 hash.
     * @param tokenId The tokenId executing the transactions
     * @param transactionIds The array of transaction IDs to execute
     * @param data The array of original calldata for each transaction (same order as transactionIds)
     */
    function executeBatchTransactions(uint256 tokenId, uint256[] memory transactionIds, bytes[] calldata data)
        public
        override
        directorCall(tokenId)
    {
        if (transactionIds.length == 0) revert IChamber.ZeroAmount();
        if (transactionIds.length != data.length) revert IChamber.ArrayLengthsMustMatch();

        for (uint256 i = 0; i < transactionIds.length;) {
            _executeOne(tokenId, transactionIds[i], data[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Receives native ETH (e.g. send, transfer, or call with empty data)
    receive() external payable {
        emit IChamber.Received(msg.sender, msg.value);
    }

    /// @notice Receives native ETH sent with calldata. Calls with no ETH revert, so unknown
    ///         functions (for example `permit`) never appear to succeed (R-1012-L3).
    fallback() external payable {
        if (msg.value == 0) revert IChamber.InvalidTransaction();
        emit IChamber.Received(msg.sender, msg.value);
    }

    /// @notice Accepts any ERC-721 via `safeTransferFrom` for treasury custody.
    /// @dev Not limited to the membership collection (`nft()`). Receipt does not mint
    ///      shares or change board seats. Directors can transfer received tokens out
    ///      through the wallet. There is no `onERC1155Received`; ERC-1155
    ///      `safeTransferFrom` to this contract reverts.
    function onERC721Received(address, address from, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        emit IChamber.ReceivedERC721(msg.sender, from, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Restricts the call to a director acting with a specific membership `tokenId`.
    /// @dev Directorship and confirmations are token-weighted (per `tokenId`), not 1-address-1-vote.
    ///      `msg.sender` must own `tokenId` and `tokenId` must be
    ///      in the current top seats. Each top-seat token may confirm once per proposal. An address
    ///      that holds `quorum` distinct top-seat membership NFTs can submit, self-confirm, and
    ///      execute — a single-actor treasury. This is intended; confirmations are not capped per owner.
    modifier directorCall(uint256 tokenId) {
        _enterAsDirector(tokenId);
        _;
        _REENTRANCY_GUARD_SLOT.asBoolean().tstore(false);
    }

    /// @dev `nonReentrant` entry plus the director check, kept out of line so every director
    ///      entry point shares one copy. Same transient slot and error as OpenZeppelin's guard.
    function _enterAsDirector(uint256 tokenId) private {
        if (_reentrancyGuardEntered()) revert ReentrancyGuardReentrantCall();
        _REENTRANCY_GUARD_SLOT.asBoolean().tstore(true);
        _syncSeatingControl(_getChamberStorage().nft, tokenId);
        _isDirector(tokenId);
    }

    /// @notice Verifies `msg.sender` controls `tokenId` and that `tokenId` is a current director seat.
    /// @dev Authorization is per token, not per address. See {isDirector} for the token-weighted
    ///      quorum assumption (one owner of `quorum` top-seat NFTs is a single-actor treasury).
    function _isDirector(uint256 tokenId) internal view {
        _requireTokenAuthorized(tokenId);
        if (!_isInTopSeats(tokenId)) revert IChamber.NotDirector();
        if (!_isSeatingMature(_getChamberStorage().nft, tokenId)) revert IChamber.DirectorNotSeated();
    }

    /// @dev `msg.sender` must be the NFT owner of `tokenId`. Never consults ERC-1271 (M-01).
    ///      `ownerOf` reverts if the token is burned. Agents act through the owner's own wallet
    ///      (for example a smart account session key), not through Chamber.
    function _requireTokenAuthorized(uint256 tokenId) internal view {
        if (tokenId == 0 || _ownerOf(tokenId) != msg.sender) revert IChamber.NotDirector();
    }

    /// @dev True when `tokenId` is among the current top `_getSeats()` nodes.
    ///      Inert ids still occupy a slot if weight remains; quorum uses reachable count (PMN-M01).
    function _isInTopSeats(uint256 tokenId) internal view returns (bool) {
        BoardTypes.BoardStorage storage $b = _getBoardStorage();
        uint256 current = $b.head;
        uint256 remaining = _getSeats();

        while (current != 0 && remaining > 0) {
            if (current == tokenId) {
                return true;
            }
            current = $b.nodes[current].next;
            remaining--;
        }
        return false;
    }

    function _countLiveConfirmFlags(uint256 nonce) internal view returns (uint256) {
        ChamberStorage storage $ = _getChamberStorage();
        return _countCurrentDirectorFlags($.nft, _getWalletStorage().isConfirmed, $.confirmOwner, nonce);
    }

    function _countLiveCancelFlags(uint256 nonce) internal view returns (uint256) {
        ChamberStorage storage $ = _getChamberStorage();
        return _countCurrentDirectorFlags($.nft, _getWalletStorage().isCancelConfirmed, $.cancelOwner, nonce);
    }

    function _submitTransactionWithMetadata(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline
    ) internal override {
        super._submitTransactionWithMetadata(tokenId, target, value, data, metadataURI, deadline);
        _getChamberStorage().confirmOwner[getTransactionCount() - 1][tokenId] = msg.sender;
    }

    function _confirmTransaction(uint256 tokenId, uint256 nonce) internal override {
        super._confirmTransaction(tokenId, nonce);
        _getChamberStorage().confirmOwner[nonce][tokenId] = msg.sender;
    }

    function _recordCancelVote(uint256 tokenId, uint256 nonce) internal override {
        super._recordCancelVote(tokenId, nonce);
        _getChamberStorage().cancelOwner[nonce][tokenId] = msg.sender;
    }

    /// @dev `ownerOf` that bubbles the revert for burned ids.
    function _ownerOf(uint256 tokenId) private view returns (address) {
        return _getChamberStorage().nft.ownerOf(tokenId);
    }

    function _ownerOfOrZero(uint256 tokenId) internal view returns (address owner) {
        try _getChamberStorage().nft.ownerOf(tokenId) returns (address o) {
            owner = o;
        } catch {}
    }

    /**
     * @notice First block at which `tokenId` may exercise director rights.
     * @param tokenId The membership token ID
     * @return seatedAtBlock Activation block, or zero if no checkpoint is stored
     */
    function getSeatedAt(uint256 tokenId) public view override returns (uint256 seatedAtBlock) {
        return _effectiveSeatedAt(_getChamberStorage().nft, tokenId);
    }

    /// @inheritdoc IChamber
    function syncSeating(uint256 tokenId) external override {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        _syncSeatingControl(_getChamberStorage().nft, tokenId);
    }

    /// @inheritdoc IChamber
    function cleanupInertSeat(uint256 tokenId) external override nonReentrant {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        _cleanupInertSeat(_getChamberStorage().nft, tokenId);
        emit IChamber.InertSeatCleaned(tokenId);
    }

    /// PROXY UPGRADE FUNCTIONS ///

    /**
     * @notice Returns the ProxyAdmin address for this Chamber proxy
     * @return The ProxyAdmin address stored in ERC1967 admin slot
     */
    function getProxyAdmin() external view override returns (address) {
        return StorageSlot.getAddressSlot(_ADMIN_SLOT).value;
    }

    /**
     * @notice Pauses vault operations and wallet execution after board quorum.
     * @dev `msg.sender` must be this chamber (self-call via `executeTransaction`).
     */
    function pause() external override {
        if (msg.sender != address(this)) revert IChamber.NotAuthorized();
        _pause();
    }

    /**
     * @notice Unpauses vault operations and wallet execution after board quorum.
     * @dev `msg.sender` must be this chamber (self-call via `executeTransaction`).
     */
    function unpause() external override {
        if (msg.sender != address(this)) revert IChamber.NotAuthorized();
        _unpause();
    }

    /// @notice Returns true if vault operations and wallet execution are paused
    function paused() public view override(PausableUpgradeable, IChamber) returns (bool) {
        return PausableUpgradeable.paused();
    }

    /**
     * @notice Upgrades the Chamber implementation via `ProxyAdmin.upgradeAndCall`
     * @dev Reverts with `NotAuthorized` if this contract is not the `ProxyAdmin` owner.
     *      Must not take `nonReentrant`: the only legitimate caller is this contract via
     *      `executeTransaction` (`msg.sender == address(this)`), which already holds the shared
     *      guard. A nested `nonReentrant` would make every upgrade revert. External reentry is
     *      already rejected by the `NotAuthorized` sender check.
     * @param newImplementation The new implementation address
     * @param data Optional initialization data for the new implementation
     */
    function upgradeImplementation(address newImplementation, bytes calldata data) external override {
        if (msg.sender != address(this)) revert IChamber.NotAuthorized();
        address proxyAdminAddress = StorageSlot.getAddressSlot(_ADMIN_SLOT).value;
        if (proxyAdminAddress == address(0)) revert IChamber.ZeroAddress();
        if (newImplementation == address(0)) revert IChamber.ZeroAddress();

        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);

        if (proxyAdmin.owner() != address(this)) {
            revert IChamber.NotAuthorized();
        }

        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(address(this));
        proxyAdmin.upgradeAndCall(proxy, newImplementation, data);
    }

    /// ERC-4626 OVERRIDES ///

    /// @inheritdoc ERC4626Upgradeable
    function deposit(uint256 assets, address receiver)
        public
        override(ERC4626Upgradeable, IERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.deposit(assets, receiver);
    }

    /// @inheritdoc ERC4626Upgradeable
    function mint(uint256 shares, address receiver)
        public
        override(ERC4626Upgradeable, IERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.mint(shares, receiver);
    }

    /// @inheritdoc ERC4626Upgradeable
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override(ERC4626Upgradeable, IERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }

    /// @inheritdoc ERC4626Upgradeable
    function redeem(uint256 shares, address receiver, address owner)
        public
        override(ERC4626Upgradeable, IERC4626)
        nonReentrant
        returns (uint256)
    {
        return super.redeem(shares, receiver, owner);
    }

    /// ERC20 OVERRIDES ///

    /**
     * @notice Internal override to enforce delegation constraints on ALL token movements
     * @dev Fixes Finding 4: ERC4626 withdraw/redeem previously bypassed delegation checks.
     * @param from The sender address (address(0) for mints)
     * @param to The recipient address (address(0) for burns)
     * @param value The amount of tokens being moved
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && value > 0) {
            uint256 fromBalance = balanceOf(from);
            if (fromBalance >= value && fromBalance - value < _getChamberStorage().totalHolderDelegations[from]) {
                revert IChamber.ExceedsDelegatedAmount();
            }
        }
        super._update(from, to, value);
    }

    /**
     * @notice Returns the decimals offset for virtual share protection
     * @dev Fixes Finding 6: Prevents first-depositor inflation/donation attacks
     * @return The decimals offset (3)
     */
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }

    /// @notice ERC-4626 deposits are disabled while paused
    function maxDeposit(address receiver) public view override(ERC4626Upgradeable, IERC4626) returns (uint256) {
        if (paused()) return 0;
        return super.maxDeposit(receiver);
    }

    /// @notice ERC-4626 mints are disabled while paused
    function maxMint(address receiver) public view override(ERC4626Upgradeable, IERC4626) returns (uint256) {
        if (paused()) return 0;
        return super.maxMint(receiver);
    }

    /// @notice ERC-4626 withdrawals are disabled while paused
    function maxWithdraw(address owner) public view override(ERC4626Upgradeable, IERC4626) returns (uint256) {
        if (paused()) return 0;
        return super.maxWithdraw(owner);
    }

    /// @notice ERC-4626 redemptions are disabled while paused
    function maxRedeem(address owner) public view override(ERC4626Upgradeable, IERC4626) returns (uint256) {
        if (paused()) return 0;
        return super.maxRedeem(owner);
    }

    /**
     * @notice Deposit/mint workflow that requires the vault to receive exactly `assets`
     * @dev Hardens M-07: OpenZeppelin ERC-4626 mints shares from the requested amount, not the
     *      observed `balanceOf` delta. Fee-on-transfer tokens would otherwise credit shares for
     *      value the vault never received. Rebasing tokens remain unsupported.
     *      Blocked while paused (L-02).
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        whenNotPaused
    {
        IERC20 vaultAsset = IERC20(asset());
        uint256 balanceBefore = vaultAsset.balanceOf(address(this));
        super._deposit(caller, receiver, assets, shares);
        uint256 balanceAfter = vaultAsset.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != assets) {
            revert IChamber.AssetAmountMismatch();
        }
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        whenNotPaused
    {
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /**
     * @notice Transfers tokens to a specified address
     * @param to The recipient address
     * @param value The amount of tokens to transfer
     * @return true if the transfer is successful
     */
    function transfer(address to, uint256 value) public override(ERC20Upgradeable, IERC20) returns (bool) {
        if (to == address(0)) revert IChamber.TransferToZeroAddress();
        if (value == 0) revert IChamber.ZeroAmount();

        address owner = _msgSender();
        uint256 ownerBalance = balanceOf(owner);

        if (ownerBalance < value) {
            revert IChamber.InsufficientChamberBalance();
        }

        _transfer(owner, to, value);

        return true;
    }

    /**
     * @notice Transfers tokens from one address to another
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

        if (fromBalance < value) {
            revert IChamber.InsufficientChamberBalance();
        }

        _spendAllowance(from, spender, value);
        _transfer(from, to, value);

        return true;
    }

    /// @inheritdoc IWallet
    function getCancelled(uint256 nonce) public view override(IWallet, Wallet) returns (bool) {
        return super.getCancelled(nonce);
    }

    /// @inheritdoc IWallet
    function getTransactionDeadline(uint256 nonce) public view override(IWallet, Wallet) returns (uint256) {
        return super.getTransactionDeadline(nonce);
    }

    /// @inheritdoc IWallet
    function getCancelConfirmation(uint256 tokenId, uint256 nonce)
        public
        view
        override(IWallet, Wallet)
        returns (bool)
    {
        return super.getCancelConfirmation(tokenId, nonce);
    }

    /// @inheritdoc IWallet
    function getCancelConfirmations(uint256 nonce) public view override(IWallet, Wallet) returns (uint8) {
        return super.getCancelConfirmations(nonce);
    }

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     */
    function getTransaction(uint256 nonce)
        public
        view
        override(IWallet, Wallet)
        returns (bool, uint8, address, uint256, bytes32)
    {
        return super.getTransaction(nonce);
    }

    /// @inheritdoc IWallet
    function getTransactionMetadata(uint256 nonce) public view override(IWallet, Wallet) returns (string memory) {
        return super.getTransactionMetadata(nonce);
    }

    /// @inheritdoc IWallet
    function getTransactionCalldata(uint256 nonce) public view override(IWallet, Wallet) returns (bytes memory) {
        return super.getTransactionCalldata(nonce);
    }

    /// @inheritdoc IWallet
    function getTransactionRequiredQuorum(uint256 nonce) public view override(IWallet, Wallet) returns (uint256) {
        return super.getTransactionRequiredQuorum(nonce);
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
}
