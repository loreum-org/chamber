// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title WalletTypes
 * @author xhad, Loreum DAO LLC
 * @notice Shared struct matching on-chain `Wallet` storage layouts.
 * @dev Uses `bytes32 dataHash` (keccak256 of calldata), not inline `bytes data`.
 */
library WalletTypes {
    /**
     * @notice Structure representing a transaction in the wallet
     */
    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes32 dataHash;
    }

    /**
     * @notice ERC-7201 namespaced storage layout for Wallet
     * @custom:storage-location erc7201:loreum.Wallet
     */
    struct WalletStorage {
        Transaction[] transactions;
        mapping(uint256 nonce => string metadataURI) transactionMetadataURI;
        mapping(uint256 nonce => mapping(uint256 tokenId => bool)) isConfirmed;
        mapping(uint256 nonce => bool) cancelled;
        mapping(uint256 nonce => uint8) cancelConfirmations;
        mapping(uint256 nonce => mapping(uint256 tokenId => bool)) isCancelConfirmed;
        mapping(uint256 nonce => bytes storedCalldata) transactionCalldata;
        mapping(uint256 nonce => uint256 requiredQuorum) transactionRequiredQuorum;
        mapping(uint256 nonce => uint256 deadline) transactionDeadline;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Wallet")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant STORAGE_SLOT = 0x471e5819b63496fc9e7b0c9d30efc265f73588bc9e02c472310feaa7f9bb8000;

    /// @notice Default lifetime for a submitted transaction when no deadline is provided
    uint256 internal constant DEFAULT_TRANSACTION_MAX_AGE = 30 days;
}
