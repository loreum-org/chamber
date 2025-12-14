// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OFTAdapter} from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

/**
 * @title ChamberShareOFTAdapter
 * @notice LayerZero OFT adapter (lockbox) for a Chamber's ERC20 share token.
 * @dev For oVault (ERC-4626) compatibility, the share token on the hub chain
 *      must be adapted via a lockbox-style adapter so `totalSupply()` remains
 *      the vault share supply (not a mint/burn shadow supply).
 */
contract ChamberShareOFTAdapter is OFTAdapter {
    constructor(
        address shareToken,
        address lzEndpoint,
        address delegate
    ) OFTAdapter(shareToken, lzEndpoint, delegate) Ownable(delegate) {}
}

