// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";
import {WalletTypes} from "src/types/WalletTypes.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";

/**
 * @title ChamberAuthHarness
 * @notice Lean Board+Wallet surface for Halmos.
 * @dev Foundry rewrites `new Chamber()` to `vm.deployCode` (unsupported in Halmos 0.3.3)
 *      because embedding Chamber initcode would blow the test-contract size limit.
 *      This harness mirrors Chamber director auth (owner only), seating,
 *      reachable quorum (PMN-M01), seating-control sync (PMN-H01), holder delegation,
 *      and the wallet queue — not ERC-4626, pause, or proxy upgrade.
 *      Keep the copied checks aligned with `Chamber.sol`.
 */
contract ChamberAuthHarness is Board, Wallet {
    IERC721 public nft;
    mapping(address => mapping(uint256 => uint256)) public holderDelegation;
    mapping(address => uint256) public totalHolderDelegations;
    mapping(address => uint256) public shareBalance;
    mapping(uint256 => mapping(uint256 => address)) public confirmOwner;
    mapping(uint256 => mapping(uint256 => address)) public cancelOwner;

    constructor(address nft_, uint256 seats) {
        if (nft_ == address(0)) revert IChamber.ZeroAddress();
        if (seats == 0) revert IChamber.ZeroSeats();
        if (seats > 20) revert IChamber.TooManySeats();
        nft = IERC721(nft_);
        _setSeats(0, seats);
    }

    function mintShares(address to, uint256 amount) external {
        shareBalance[to] += amount;
    }

    function delegate(uint256 tokenId, uint256 amount) external nonReentrant {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();
        try nft.ownerOf(tokenId) returns (address owner) {
            if (owner == address(this)) revert IChamber.InvalidTokenId();
        } catch {
            revert IChamber.InvalidTokenId();
        }

        uint256 senderBalance = shareBalance[msg.sender];
        if (senderBalance < amount) revert IChamber.InsufficientChamberBalance();

        holderDelegation[msg.sender][tokenId] += amount;
        totalHolderDelegations[msg.sender] += amount;
        if (senderBalance < totalHolderDelegations[msg.sender]) {
            revert IChamber.InsufficientChamberBalance();
        }

        _delegate(tokenId, amount, nft);
    }

    function undelegate(uint256 tokenId, uint256 amount) external nonReentrant {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();
        uint256 currentDelegation = holderDelegation[msg.sender][tokenId];
        if (currentDelegation < amount) revert IChamber.InsufficientDelegatedAmount();

        holderDelegation[msg.sender][tokenId] = currentDelegation - amount;
        totalHolderDelegations[msg.sender] -= amount;

        BoardTypes.BoardStorage storage $b = _getBoardStorage();
        if ($b.nodes[tokenId].tokenId == tokenId) {
            _undelegate(tokenId, amount, nft);
        }
    }

    function transfer(address to, uint256 value) external returns (bool) {
        if (to == address(0)) revert IChamber.TransferToZeroAddress();
        if (value == 0) revert IChamber.ZeroAmount();
        uint256 fromBalance = shareBalance[msg.sender];
        if (fromBalance < value) revert IChamber.InsufficientChamberBalance();
        if (fromBalance - value < totalHolderDelegations[msg.sender]) {
            revert IChamber.ExceedsDelegatedAmount();
        }
        shareBalance[msg.sender] = fromBalance - value;
        shareBalance[to] += value;
        return true;
    }

    function getMember(uint256 tokenId) external view returns (uint256, uint256, uint256, uint256) {
        Node memory node = _getNode(tokenId);
        return (node.tokenId, node.amount, node.next, node.prev);
    }

    function getQuorum() public view returns (uint256) {
        return _filledSeatQuorum();
    }

    function getReachableDirectorCount() public view returns (uint256) {
        return _countFilledSeats();
    }

    function cleanupInertSeat(uint256 tokenId) external nonReentrant {
        _cleanupInertSeat(nft, tokenId);
    }

    function getSeats() public view returns (uint256) {
        return _getSeats();
    }

    function getSeatedAt(uint256 tokenId) public view returns (uint256) {
        return _effectiveSeatedAt(nft, tokenId);
    }

    function syncSeating(uint256 tokenId) external {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        _syncSeatingControl(nft, tokenId);
    }

    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data)
        public
        nonReentrant
        isDirector(tokenId)
    {
        if (target == address(0)) revert IChamber.ZeroAddress();
        _submitTransactionWithMetadata(tokenId, target, value, data, "", 0);
    }

    function confirmTransaction(uint256 tokenId, uint256 transactionId) public nonReentrant isDirector(tokenId) {
        WalletTypes.WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        if ($w.transactions[transactionId].executed) revert IWallet.TransactionAlreadyExecuted();
        if ($w.isConfirmed[transactionId][tokenId]) revert IWallet.TransactionAlreadyConfirmed();
        _confirmTransaction(tokenId, transactionId);
    }

    function executeTransaction(uint256 tokenId, uint256 transactionId, bytes calldata data)
        public
        nonReentrant
        isDirector(tokenId)
    {
        WalletTypes.WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        WalletTypes.Transaction storage transaction = $w.transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
        if ($w.cancelled[transactionId]) revert IWallet.TransactionAlreadyCancelled();
        _notExpired(transactionId);
        if (_countLiveConfirmFlags(transactionId) < _requiredConfirmations(transactionId)) {
            revert IChamber.NotEnoughConfirmations();
        }
        _executeTransaction(tokenId, transactionId, data);
    }

    function cancelTransaction(uint256 tokenId, uint256 transactionId) public nonReentrant isDirector(tokenId) {
        WalletTypes.WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        if ($w.transactions[transactionId].executed) revert IWallet.TransactionAlreadyExecuted();
        _recordCancelVote(tokenId, transactionId);
        if (_countLiveCancelFlags(transactionId) >= getQuorum()) {
            _cancelTransaction(transactionId);
        }
    }

    function _submitQuorum() internal view override returns (uint256) {
        return getQuorum();
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
        confirmOwner[getTransactionCount() - 1][tokenId] = msg.sender;
    }

    function _confirmTransaction(uint256 tokenId, uint256 nonce) internal override {
        super._confirmTransaction(tokenId, nonce);
        confirmOwner[nonce][tokenId] = msg.sender;
    }

    function _recordCancelVote(uint256 tokenId, uint256 nonce) internal override {
        super._recordCancelVote(tokenId, nonce);
        cancelOwner[nonce][tokenId] = msg.sender;
    }

    function _requiredConfirmations(uint256 nonce) internal view returns (uint256) {
        uint256 submitQuorum = _getWalletStorage().transactionRequiredQuorum[nonce];
        uint256 liveQuorum = getQuorum();
        return submitQuorum > liveQuorum ? submitQuorum : liveQuorum;
    }

    modifier isDirector(uint256 tokenId) {
        _syncSeatingControl(nft, tokenId);
        _requireTokenAuthorized(tokenId);
        if (!_isInTopSeats(tokenId)) revert IChamber.NotDirector();
        if (!_isSeatingMature(nft, tokenId)) revert IChamber.DirectorNotSeated();
        _;
    }

    function _requireTokenAuthorized(uint256 tokenId) internal view {
        if (tokenId == 0 || nft.ownerOf(tokenId) != msg.sender) revert IChamber.NotDirector();
    }

    function _isInTopSeats(uint256 tokenId) internal view returns (bool) {
        BoardTypes.BoardStorage storage $b = _getBoardStorage();
        uint256 current = $b.head;
        uint256 remaining = _getSeats();
        while (current != 0 && remaining > 0) {
            if (current == tokenId) return true;
            current = $b.nodes[current].next;
            remaining--;
        }
        return false;
    }

    function _countLiveConfirmFlags(uint256 nonce) internal view returns (uint256) {
        return _countCurrentDirectorFlags(nft, _getWalletStorage().isConfirmed, confirmOwner, nonce);
    }

    function _countLiveCancelFlags(uint256 nonce) internal view returns (uint256) {
        return _countCurrentDirectorFlags(nft, _getWalletStorage().isCancelConfirmed, cancelOwner, nonce);
    }
}
