// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title WalletTypes
 * @author xhad, Loreum DAO LLC
 * @notice Legacy reference struct for documentation and off-chain tooling.
 * @dev Canonical on-chain layout is `Wallet.Transaction` with `bytes32 dataHash`, not inline `bytes data`.
 */
library WalletTypes {
    /**
     * @notice Structure representing a transaction in the wallet
     * @param executed Whether the transaction has been executed
     * @param confirmations Number of confirmations received for this transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send with the transaction
     * @param data The calldata to be executed
     */
    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes data;
    }
}
