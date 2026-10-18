// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Vm} from "forge-std/Vm.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";

interface IChamberNft {
    function nft() external view returns (address);
}

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

    /// @dev Live session key: stored owner is the current contract owner and the key is unexpired.
    function directorOperator(IChamber chamber, uint256 tokenId) internal view returns (address) {
        (bool live, address operator,,) = _liveSession(chamber, tokenId);
        return live ? operator : address(0);
    }

    function directorOperatorScope(IChamber chamber, uint256 tokenId) internal view returns (uint32) {
        (bool live,, uint32 scope,) = _liveSession(chamber, tokenId);
        return live ? scope : 0;
    }

    function directorOperatorLiveAt(IChamber chamber, uint256 tokenId) internal view returns (uint256) {
        (bool live,,, uint256 liveAt) = _liveSession(chamber, tokenId);
        return live ? liveAt : 0;
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

    function _liveSession(IChamber chamber, uint256 tokenId)
        private
        view
        returns (bool live, address operator, uint32 scope, uint256 liveAt)
    {
        if (tokenId == 0) return (false, address(0), 0, 0);
        address sessionOwner;
        uint256 expiry;
        (sessionOwner, operator, expiry, scope, liveAt) = chamber.getDirectorSession(tokenId);
        address owner;
        try IERC721(IChamberNft(address(chamber)).nft()).ownerOf(tokenId) returns (address o) {
            owner = o;
        } catch {
            return (false, address(0), 0, 0);
        }
        live = operator != address(0) && owner.code.length != 0 && sessionOwner == owner && expiry != 0
            && block.timestamp <= expiry;
    }
}
