// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title WalletTypes
 * @author xhad, Loreum DAO LLC
 * @notice Shared struct matching on-chain `Wallet.Transaction` storage.
 * @dev Uses `bytes32 dataHash` (keccak256 of calldata), not inline `bytes data`.
 *      Matches `Wallet.Transaction` and `IWallet.getTransaction`.
 */
library WalletTypes {
    /**
     * @notice Structure representing a transaction in the wallet
     * @dev Slot packing: executed (bool, 1 byte) + confirmations (uint8, 1 byte) +
     *      target (address, 20 bytes) = 22 bytes in slot 0. value fills slot 1.
     *      dataHash (bytes32) fills slot 2 — hash-only calldata storage.
     * @param executed Whether the transaction has been executed
     * @param confirmations Number of confirmations received for this transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send with the transaction
     * @param dataHash keccak256 of the original calldata; verified at execution time
     */
    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes32 dataHash;
    }
}
