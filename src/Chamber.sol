// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {IERC721Receiver} from "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import {
    ERC4626Upgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import {IERC1271} from "lib/openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {
    ReentrancyGuardUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {StorageSlot} from "lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol";

/**
 * @title Chamber Contract
 * @notice This contract is a smart vault for managing assets with a board of directors
 * @author xhad, Loreum DAO LLC
 */
contract Chamber is ERC4626Upgradeable, ReentrancyGuardUpgradeable, Board, Wallet, IChamber, IERC721Receiver {
    /**
     * @notice ERC-7201 namespaced storage layout for Chamber
     * @dev Packing: `nft` (address, 20 bytes) sits alone in its slot; remaining fields are
     *      dynamic types or mappings which each occupy a full slot.
     * @custom:storage-location erc7201:loreum.Chamber
     */
    struct ChamberStorage {
        IERC721 nft;
        string version;
        mapping(address => mapping(uint256 => uint256)) agentDelegation;
        mapping(address => uint256) totalAgentDelegations;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Chamber")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _CHAMBER_STORAGE_SLOT =
        0x6859c8344c1b514e5663b471fb3ef74d69055f0a732aeacba684a8480d92bd00;

    function _getChamberStorage() internal pure returns (ChamberStorage storage $) {
        assembly {
            $.slot := _CHAMBER_STORAGE_SLOT
        }
    }

    /// @dev Events and errors are defined in IChamber interface

    /// Constants
    uint256 private constant MAX_SEATS = 20;

    /// @notice Function selector for upgradeImplementation(address,bytes)
    bytes4 private constant UPGRADE_SELECTOR = 0xc89311b6;

    constructor() {
        _disableInitializers();
    }

    /// EXPLICIT GETTERS for formerly-public state variables ///

    /// @notice The implementation version
    function version() external view returns (string memory) {
        return _getChamberStorage().version;
    }

    /// @notice ERC721 membership token
    function nft() external view returns (IERC721) {
        return _getChamberStorage().nft;
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

        ChamberStorage storage $ = _getChamberStorage();
        $.nft = IERC721(erc721Token);
        $.version = "1.1.3";

        _setSeats(0, seats);
    }

    /**
     * @notice Delegates a specified amount of tokens to a tokenId
     * @param tokenId The tokenId to which tokens are delegated
     * @param amount The amount of tokens to delegate
     */
    function delegate(uint256 tokenId, uint256 amount) external override {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();
        
        ChamberStorage storage $ = _getChamberStorage();

        try $.nft.ownerOf(tokenId) returns (address) {
        } catch {
            revert IChamber.InvalidTokenId();
        }

        // Cache balance to avoid multiple SLOADs
        uint256 senderBalance = balanceOf(msg.sender);
        if (senderBalance < amount) revert IChamber.InsufficientChamberBalance();

        $.agentDelegation[msg.sender][tokenId] += amount;
        $.totalAgentDelegations[msg.sender] += amount;

        // Validate the balance constraint one final time after updates to reduce SLOADs 
        if (senderBalance < $.totalAgentDelegations[msg.sender]) {
            revert IChamber.InsufficientChamberBalance();
        }

        _delegate(tokenId, amount);

        emit IChamber.DelegationUpdated(msg.sender, tokenId, $.agentDelegation[msg.sender][tokenId]);
    }

    /**
     * @notice Undelegates a specified amount of tokens from a tokenId
     * @param tokenId The tokenId from which tokens are undelegated
     * @param amount The amount of tokens to undelegate
     */
    function undelegate(uint256 tokenId, uint256 amount) external override {
        if (tokenId == 0) revert IChamber.ZeroTokenId();
        if (amount == 0) revert IChamber.ZeroAmount();

        ChamberStorage storage $ = _getChamberStorage();
        uint256 currentDelegation = $.agentDelegation[msg.sender][tokenId];
        if (currentDelegation < amount) revert IChamber.InsufficientDelegatedAmount();

        uint256 newDelegation = currentDelegation - amount;
        $.agentDelegation[msg.sender][tokenId] = newDelegation;
        $.totalAgentDelegations[msg.sender] -= amount;

        // Only update board if node still exists (handles evicted nodes — Fix Finding 11)
        BoardStorage storage $b = _getBoardStorage();
        if ($b.nodes[tokenId].tokenId == tokenId) {
            _undelegate(tokenId, amount);
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
            try _getChamberStorage().nft.ownerOf(topTokenIds[i]) returns (address owner) {
                topOwners[i] = owner;
            } catch {
                topOwners[i] = address(0);
            }
            unchecked {
                ++i;
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
    function getDelegations(address agent)
        public
        view
        override
        returns (uint256[] memory tokenIds, uint256[] memory amounts)
    {
        if (agent == address(0)) revert IChamber.ZeroAddress();

        BoardStorage storage $b = _getBoardStorage();
        ChamberStorage storage $c = _getChamberStorage();

        uint256 count = 0;
        uint256 tokenId = $b.head;
        uint256[] memory tempTokenIds = new uint256[]($b.size);
        uint256[] memory tempAmounts = new uint256[]($b.size);

        while (tokenId != 0) {
            uint256 amount = $c.agentDelegation[agent][tokenId];
            if (amount > 0) {
                tempTokenIds[count] = tokenId;
                tempAmounts[count] = amount;
                unchecked {
                    ++count;
                }
            }
            tokenId = $b.nodes[tokenId].next;
        }

        tokenIds = new uint256[](count);
        amounts = new uint256[](count);
        // Use unchecked loop for better gas efficiency on the final copy
        for (uint256 i = 0; i < count;) {
            tokenIds[i] = tempTokenIds[i];
            amounts[i] = tempAmounts[i];
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Returns the amount delegated by a agent to a specific tokenId
     * @param agent The address of the agent
     * @param tokenId The token ID
     * @return amount The amount delegated
     */
    function getAgentDelegation(address agent, uint256 tokenId) external view override returns (uint256) {
        return _getChamberStorage().agentDelegation[agent][tokenId];
    }

    /**
     * @notice Returns the total amount delegated by a agent across all tokenIds
     * @param agent The address of the agent
     * @return amount The total amount delegated
     */
    function getTotalAgentDelegations(address agent) external view override returns (uint256) {
        return _getChamberStorage().totalAgentDelegations[agent];
    }

    /**
     * @notice Returns the current seat update proposal
     * @return uint256 proposedSeats
     * @return uint256 timestamp
     * @return uint256 requiredQuorum
     * @return uint256[] memory supporters
     */
    function getSeatUpdate() public view override returns (uint256, uint256, uint256, uint256[] memory) {
        SeatUpdate storage proposal = _getBoardStorage().seatUpdate;
        return (proposal.proposedSeats, proposal.timestamp, proposal.requiredQuorum, proposal.supporters);
    }

    /**
     * @notice Updates the number of seats
     * @param tokenId The tokenId proposing the update
     * @param numOfSeats The new number of seats
     */
    function updateSeats(uint256 tokenId, uint256 numOfSeats) public override isDirector(tokenId) {
        if (numOfSeats == 0) revert IChamber.ZeroSeats();
        if (numOfSeats > MAX_SEATS) revert IChamber.TooManySeats();
        _setSeats(tokenId, numOfSeats);
    }

    /**
     * @notice Executes a pending seat update proposal if it has enough support and the timelock has expired
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
        nonReentrant
        isDirector(tokenId)
    {
        if (target == address(0)) revert IChamber.ZeroAddress();

        if (target == address(this)) {
            if (data.length < 4) revert IChamber.InvalidTransaction();
            // forge-lint: disable-next-line(unsafe-typecast)
            bytes4 selector = bytes4(data);
            if (selector != UPGRADE_SELECTOR) {
                revert IChamber.InvalidTransaction();
            }
        }

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
        nonReentrant
        isDirector(tokenId)
    {
        WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        Transaction storage transaction = $w.transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
        if ($w.isConfirmed[transactionId][tokenId]) revert IWallet.TransactionAlreadyConfirmed();

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
        WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        Transaction storage transaction = $w.transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
        if ($w.cancelled[transactionId]) revert IWallet.TransactionAlreadyCancelled();
        if (transaction.confirmations < getQuorum()) revert IChamber.NotEnoughConfirmations();

        _executeTransaction(tokenId, transactionId);
        emit IChamber.TransactionExecuted(transactionId, msg.sender);
    }

    /**
     * @notice Revokes a confirmation for a transaction
     * @param tokenId The tokenId revoking the confirmation
     * @param transactionId The ID of the transaction to revoke confirmation for
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId)
        public
        override
        nonReentrant
        isDirector(tokenId)
    {
        _revokeConfirmation(tokenId, transactionId);
    }

    /**
     * @notice Records a director's vote to cancel a transaction. Requires quorum of directors to cancel.
     * @param tokenId The tokenId voting to cancel
     * @param transactionId The ID of the transaction to cancel
     */
    function cancelTransaction(uint256 tokenId, uint256 transactionId)
        public
        override
        nonReentrant
        isDirector(tokenId)
    {
        WalletStorage storage $w = _getWalletStorage();
        if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
        Transaction storage transaction = $w.transactions[transactionId];
        if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();

        _recordCancelVote(tokenId, transactionId, getQuorum());
        emit IChamber.TransactionCancelVoted(transactionId, msg.sender);
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
    ) public override nonReentrant isDirector(tokenId) {
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
            if (targets[i] == address(0)) revert IChamber.ZeroAddress();

            if (targets[i] == address(this)) {
                if (data[i].length < 4) revert IChamber.InvalidTransaction();
                // forge-lint: disable-next-line(unsafe-typecast)
                bytes4 selector = bytes4(data[i]);
                if (selector != UPGRADE_SELECTOR) {
                    revert IChamber.InvalidTransaction();
                }
            }

            _submitTransaction(tokenId, targets[i], values[i], data[i]);
            emit IChamber.TransactionSubmitted(getNextTransactionId() - 1, targets[i], values[i]);
            unchecked {
                ++i;
            }
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
        nonReentrant
        isDirector(tokenId)
    {
        if (transactionIds.length == 0) revert IChamber.ZeroAmount();

        WalletStorage storage $w = _getWalletStorage();
        for (uint256 i = 0; i < transactionIds.length;) {
            uint256 transactionId = transactionIds[i];
            if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
            Transaction storage transaction = $w.transactions[transactionId];

            if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
            if ($w.isConfirmed[transactionId][tokenId]) revert IWallet.TransactionAlreadyConfirmed();

            _confirmTransaction(tokenId, transactionId);
            emit IChamber.TransactionConfirmed(transactionId, msg.sender);
            unchecked {
                ++i;
            }
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

        WalletStorage storage $w = _getWalletStorage();
        for (uint256 i = 0; i < transactionIds.length;) {
            uint256 transactionId = transactionIds[i];
            if (transactionId >= $w.transactions.length) revert IWallet.TransactionDoesNotExist();
            Transaction storage transaction = $w.transactions[transactionId];

            if (transaction.executed) revert IWallet.TransactionAlreadyExecuted();
            if (transaction.confirmations < getQuorum()) revert IChamber.NotEnoughConfirmations();

            _executeTransaction(tokenId, transactionId);
            emit IChamber.TransactionExecuted(transactionId, msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Receives native ETH (e.g. send, transfer, or call with empty data)
    receive() external payable {
        emit IChamber.Received(msg.sender, msg.value);
    }

    /// @notice Receives native ETH sent with calldata
    fallback() external payable {
        if (msg.value > 0) {
            emit IChamber.Received(msg.sender, msg.value);
        }
    }

    /// @notice Accepts ERC721 tokens via safeTransferFrom
    /// @dev Returns the magic value required by IERC721Receiver
    function onERC721Received(address, address from, uint256 tokenId, bytes calldata)
        external
        override
        returns (bytes4)
    {
        emit IChamber.ReceivedERC721(msg.sender, from, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Modifier to restrict access to only directors
    modifier isDirector(uint256 tokenId) {
        _isDirector(tokenId);
        _;
    }

    function _isDirector(uint256 tokenId) internal view {
        if (tokenId == 0) revert IChamber.NotDirector();

        address owner = _getChamberStorage().nft.ownerOf(tokenId);

        bool isOwner = (owner == msg.sender);

        if (!isOwner && owner.code.length > 0) {
            bytes32 hash;
            // forge-lint: disable-next-line(asm-keccak256)
            hash = keccak256(abi.encodePacked("DirectorAuth", address(this), tokenId, msg.sender));
            try IERC1271(owner).isValidSignature(hash, abi.encode(msg.sender)) returns (bytes4 magicValue) {
                if (magicValue == IERC1271.isValidSignature.selector) {
                    isOwner = true;
                }
            } catch {
                // Ignore failure, remain isOwner = false
            }
        }

        if (!isOwner) revert IChamber.NotDirector();

        BoardStorage storage $b = _getBoardStorage();
        uint256 current = $b.head;
        uint256 remaining = _getSeats();

        while (current != 0 && remaining > 0) {
            if (current == tokenId) {
                return;
            }
            current = $b.nodes[current].next;
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
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        return StorageSlot.getAddressSlot(adminSlot).value;
    }

    /**
     * @notice Accepts admin ownership of the ProxyAdmin (called by Registry after deployment)
     * @dev This is a no-op since Registry transfers ownership directly
     */
    function acceptAdmin() external override {
        // No-op: Registry transfers ProxyAdmin ownership directly
    }

    /**
     * @notice Upgrades the Chamber implementation
     * @param newImplementation The new implementation address
     * @param data Optional initialization data for the new implementation
     */
    function upgradeImplementation(address newImplementation, bytes calldata data) external override {
        if (msg.sender != address(this)) revert IChamber.NotAuthorized();
        address proxyAdminAddress = this.getProxyAdmin();
        if (proxyAdminAddress == address(0)) revert IChamber.ZeroAddress();
        if (newImplementation == address(0)) revert IChamber.ZeroAddress();

        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);

        if (proxyAdmin.owner() != address(this)) {
            revert IChamber.NotDirector();
        }

        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(address(this));
        proxyAdmin.upgradeAndCall(proxy, newImplementation, data);
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
            if (fromBalance >= value && fromBalance - value < _getChamberStorage().totalAgentDelegations[from]) {
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

    /**
     * @notice Returns the next transaction ID (current nonce)
     * @return uint256 The next transaction ID that will be assigned
     */
    function getNextTransactionId() public view override(IWallet, Wallet) returns (uint256) {
        return getTransactionCount();
    }

    /// @inheritdoc IWallet
    function getCancelled(uint256 nonce) public view override(IWallet, Wallet) returns (bool) {
        return super.getCancelled(nonce);
    }

    /// @inheritdoc IWallet
    function getCancelConfirmation(uint256 tokenId, uint256 nonce) public view override(IWallet, Wallet) returns (bool) {
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
        returns (bool, uint8, address, uint256, bytes memory)
    {
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
}
