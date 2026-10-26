// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Vm} from "forge-std/Vm.sol";
import {IChamber} from "src/interfaces/IChamber.sol";

interface IWalletDeadline {
    function getTransactionDeadline(uint256 nonce) external view returns (uint256);
}

/// @notice Test-side reads for values Chamber no longer exposes as their own getters.
/// @dev Delegation amounts come straight from ERC-7201 storage so tests still check the
///      tracked mappings, not a sum derived from {IChamber.getDelegations}.
library ChamberReads {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev erc7201:loreum.Chamber; `holderDelegation` is field 1, `totalHolderDelegations` field 2.
    uint256 internal constant CHAMBER_SLOT = 0x6859c8344c1b514e5663b471fb3ef74d69055f0a732aeacba684a8480d92bd00;

    function holderDelegation(IChamber chamber, address holder, uint256 tokenId) internal view returns (uint256) {
        bytes32 inner = keccak256(abi.encode(holder, CHAMBER_SLOT + 1));
        return uint256(vm.load(address(chamber), keccak256(abi.encode(tokenId, inner))));
    }

    function totalHolderDelegations(IChamber chamber, address holder) internal view returns (uint256) {
        return uint256(vm.load(address(chamber), keccak256(abi.encode(holder, CHAMBER_SLOT + 2))));
    }

    /// @dev Occupied top seats: `min(seats, size)`.
    function reachableDirectorCount(IChamber chamber) internal view returns (uint256) {
        uint256 seats = chamber.getSeats();
        uint256 size = chamber.getSize();
        return size < seats ? size : seats;
    }

    /// @dev Same as the removed `isTransactionExpired`: reverts for a missing nonce, `0` never expires.
    function transactionExpired(address wallet, uint256 nonce) internal view returns (bool) {
        uint256 deadline = IWalletDeadline(wallet).getTransactionDeadline(nonce);
        return deadline != 0 && block.timestamp > deadline;
    }
}
