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
 * @notice Lean Board+Wallet+session-key surface for Halmos.
 * @dev Foundry rewrites `new Chamber()` to `vm.deployCode` (unsupported in Halmos 0.3.3)
 *      because embedding Chamber initcode would blow the test-contract size limit.
 *      This harness mirrors Chamber director auth, seating, session keys (PMN-M04),
 *      reachable quorum (PMN-M01), seating-control sync (PMN-H01), holder delegation,
 *      and the wallet queue — not ERC-4626, pause, or proxy upgrade.
 *      Keep the copied checks aligned with `Chamber.sol`.
 */
contract ChamberAuthHarness is Board, Wallet {
    struct DirectorSession {
        address owner;
        uint64 expiry;
        uint32 scope;
        address operator;
        uint64 liveAt;
    }

    uint32 public constant SESSION_SCOPE_SUBMIT = 1 << 0;
    uint32 public constant SESSION_SCOPE_CONFIRM = 1 << 1;
    uint32 public constant SESSION_SCOPE_EXECUTE = 1 << 2;
    uint32 public constant SESSION_SCOPE_UPDATE_SEATS = 1 << 3;
    uint32 public constant SESSION_SCOPE_REVOKE = 1 << 4;
    uint32 public constant SESSION_SCOPE_CANCEL = 1 << 5;
    uint32 public constant SESSION_SCOPE_UNSCOPED = type(uint32).max;

    IERC721 public nft;
    mapping(address => mapping(uint256 => uint256)) public holderDelegation;
    mapping(address => uint256) public totalHolderDelegations;
    mapping(address => uint256) public shareBalance;
    mapping(uint256 => DirectorSession) public directorSession;
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
        try nft.ownerOf(tokenId) returns (address) {}
        catch {
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

    function setDirectorOperator(uint256 tokenId, address operator, uint256 expiry, uint32 scope)
        external
        nonReentrant
    {
        if (tokenId == 0) revert IChamber.NotDirector();
        address owner = nft.ownerOf(tokenId);
        if (owner != msg.sender) revert IChamber.NotDirector();
        if (owner.code.length == 0) revert IChamber.NotDirector();

        if (operator == address(0)) {
            delete directorSession[tokenId];
            return;
        }

        if (expiry == 0 || expiry > type(uint64).max || expiry <= block.timestamp) {
            revert IChamber.InvalidSessionExpiry();
        }
        if (scope == 0) revert IChamber.InvalidSessionScope();

        uint256 liveAt = block.number + BoardTypes.SEATING_DELAY;
        directorSession[tokenId] = DirectorSession({
            owner: owner, expiry: uint64(expiry), scope: scope, operator: operator, liveAt: uint64(liveAt)
        });
    }

    function getDirectorOperator(uint256 tokenId) public view returns (address) {
        (bool authorized, address operator) = _liveSessionKey(tokenId);
        return authorized ? operator : address(0);
    }

    function getDirectorOperatorScope(uint256 tokenId) public view returns (uint32) {
        (bool live,) = _liveSessionKey(tokenId);
        if (!live) return 0;
        return directorSession[tokenId].scope;
    }

    function getDirectorOperatorLiveAt(uint256 tokenId) public view returns (uint256) {
        (bool live,) = _liveSessionKey(tokenId);
        if (!live) return 0;
        return directorSession[tokenId].liveAt;
    }

    function getDirectorSession(uint256 tokenId)
        public
        view
        returns (address sessionOwner, address operator, uint256 expiry, uint32 scope, uint256 liveAt)
    {
        DirectorSession storage session = directorSession[tokenId];
        return (session.owner, session.operator, session.expiry, session.scope, session.liveAt);
    }

    function isTokenAuthorized(uint256 tokenId, address account) public view returns (bool) {
        if (tokenId == 0 || account == address(0)) return false;
        try nft.ownerOf(tokenId) returns (address owner) {
            if (account == owner) return true;
            return _isLiveSessionKey(tokenId, owner, account);
        } catch {
            return false;
        }
    }

    function getMember(uint256 tokenId) external view returns (uint256, uint256, uint256, uint256) {
        Node memory node = _getNode(tokenId);
        return (node.tokenId, node.amount, node.next, node.prev);
    }

    function getQuorum() public view returns (uint256) {
        return _liveQuorum(nft, address(this));
    }

    function getReachableDirectorCount() public view returns (uint256) {
        return _countReachableAuthorized(nft, address(this));
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
        _submitTransaction(tokenId, target, value, data);
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
        confirmOwner[getNextTransactionId() - 1][tokenId] = _ownerOfOrZero(tokenId);
    }

    function _confirmTransaction(uint256 tokenId, uint256 nonce) internal override {
        super._confirmTransaction(tokenId, nonce);
        confirmOwner[nonce][tokenId] = _ownerOfOrZero(tokenId);
    }

    function _recordCancelVote(uint256 tokenId, uint256 nonce) internal override {
        super._recordCancelVote(tokenId, nonce);
        cancelOwner[nonce][tokenId] = _ownerOfOrZero(tokenId);
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
        if (tokenId == 0) revert IChamber.NotDirector();
        address owner = nft.ownerOf(tokenId);
        if (owner == msg.sender) return;
        if (_isLiveSessionKey(tokenId, owner, msg.sender) && _sessionMayAct(tokenId, msg.sig)) return;
        revert IChamber.NotDirector();
    }

    function _isLiveSessionKey(uint256 tokenId, address owner, address account) internal view returns (bool) {
        if (account == address(0) || owner.code.length == 0) return false;
        DirectorSession storage session = directorSession[tokenId];
        if (session.owner != owner || session.operator != account) return false;
        if (session.expiry == 0 || block.timestamp > session.expiry) return false;
        return true;
    }

    function _sessionMayAct(uint256 tokenId, bytes4 selector) internal view returns (bool) {
        DirectorSession storage session = directorSession[tokenId];
        (uint32 bit, bool delayed) = _sessionScopeForSelector(selector);
        if (delayed && block.number < session.liveAt) return false;
        if (session.scope == SESSION_SCOPE_UNSCOPED) return true;
        return bit != 0 && (session.scope & bit) != 0;
    }

    function _sessionScopeForSelector(bytes4 selector) internal pure returns (uint32 bit, bool delayed) {
        if (
            selector == bytes4(keccak256("submitTransaction(uint256,address,uint256,bytes)"))
                || selector == bytes4(keccak256("submitTransaction(uint256,address,uint256,bytes,uint256)"))
                || selector == bytes4(keccak256("submitTransactionWithMetadata(uint256,address,uint256,bytes,string)"))
                || selector
                    == bytes4(keccak256("submitTransactionWithMetadata(uint256,address,uint256,bytes,string,uint256)"))
                || selector == bytes4(keccak256("submitBatchTransactions(uint256,address[],uint256[],bytes[])"))
        ) {
            return (SESSION_SCOPE_SUBMIT, false);
        }
        if (selector == IWallet.confirmTransaction.selector || selector == IWallet.confirmBatchTransactions.selector) {
            return (SESSION_SCOPE_CONFIRM, true);
        }
        if (selector == IWallet.executeTransaction.selector || selector == IWallet.executeBatchTransactions.selector) {
            return (SESSION_SCOPE_EXECUTE, true);
        }
        if (selector == IChamber.executeSeatsUpdate.selector) {
            return (SESSION_SCOPE_UPDATE_SEATS, true);
        }
        if (selector == IChamber.updateSeats.selector || selector == IChamber.cancelSeatUpdate.selector) {
            return (SESSION_SCOPE_UPDATE_SEATS, false);
        }
        if (selector == IWallet.revokeConfirmation.selector) {
            return (SESSION_SCOPE_REVOKE, false);
        }
        if (selector == IWallet.cancelTransaction.selector) {
            return (SESSION_SCOPE_CANCEL, false);
        }
        return (0, false);
    }

    function _liveSessionKey(uint256 tokenId) internal view returns (bool, address) {
        if (tokenId == 0) return (false, address(0));
        try nft.ownerOf(tokenId) returns (address owner) {
            DirectorSession storage session = directorSession[tokenId];
            if (!_isLiveSessionKey(tokenId, owner, session.operator)) return (false, address(0));
            return (true, session.operator);
        } catch {
            return (false, address(0));
        }
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

    function _ownerOfOrZero(uint256 tokenId) internal view returns (address owner) {
        try nft.ownerOf(tokenId) returns (address o) {
            owner = o;
        } catch {}
    }
}
