// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VaultComposerSync} from "@layerzerolabs/ovault-evm/contracts/VaultComposerSync.sol";

/**
 * @title ChamberOVaultComposer
 * @notice LayerZero oVault composer for a Chamber (ERC-4626 vault).
 * @dev This contract enables cross-chain deposit/redeem flows into/out of the
 *      Chamber vault using LayerZero's Omnichain Vault (oVault) pattern.
 *
 *      The Chamber itself keeps governance + stake-weighted leaderboard logic;
 *      the composer is purely an omnichain vault router.
 */
contract ChamberOVaultComposer is VaultComposerSync {
    constructor(address vault, address assetOFT, address shareOFT) VaultComposerSync(vault, assetOFT, shareOFT) {}
}

