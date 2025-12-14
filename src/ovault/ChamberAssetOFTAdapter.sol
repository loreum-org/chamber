// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OFTAdapter} from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

/**
 * @title ChamberAssetOFTAdapter
 * @notice LayerZero OFT adapter (lockbox) for an existing ERC20 vault asset.
 * @dev Use this when the underlying governance token already exists and you
 *      want to connect it into an Omnichain Vault (oVault) mesh.
 */
contract ChamberAssetOFTAdapter is OFTAdapter {
    constructor(
        address assetToken,
        address lzEndpoint,
        address delegate
    ) OFTAdapter(assetToken, lzEndpoint, delegate) Ownable(delegate) {}
}

