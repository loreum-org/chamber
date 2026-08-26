// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "lib/forge-std/src/Test.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";
import {WalletTypes} from "src/types/WalletTypes.sol";
import {MockBoard} from "test/mock/MockBoard.sol";
import {MockWallet} from "test/mock/MockWallet.sol";

/// @dev Stores a `BoardTypes.Node` so tests can inspect packed slot layout.
contract BoardTypesStorageProbe {
    BoardTypes.Node public node;

    function write(uint256 tokenId, uint256 amount, uint128 next, uint128 prev) external {
        node = BoardTypes.Node({tokenId: tokenId, amount: amount, next: next, prev: prev});
    }
}

/// @dev Stores a `WalletTypes.Transaction` so tests can inspect hash-only slot layout.
contract WalletTypesStorageProbe {
    WalletTypes.Transaction public transaction;

    function write(bool executed, uint8 confirmations, address target, uint256 value, bytes32 dataHash) external {
        transaction = WalletTypes.Transaction({
            executed: executed,
            confirmations: confirmations,
            target: target,
            value: value,
            dataHash: dataHash
        });
    }
}

/**
 * @notice Compile + layout checks that helper types match on-chain Board/Wallet storage.
 * @dev Assigning helper fields into `MockBoard.Node` / `MockWallet.Transaction` fails to
 *      compile if `next`/`prev` are still `uint256` or if `data` is still dynamic `bytes`.
 */
contract TypesLayoutTest is Test {
    function test_BoardTypesNodeAssignableToOnchainNode() public pure {
        BoardTypes.Node memory helper = BoardTypes.Node({tokenId: 1, amount: 2, next: uint128(3), prev: uint128(4)});
        MockBoard.Node memory onchain = _copyBoardNodeToOnchain(helper);
        assertEq(onchain.tokenId, 1);
        assertEq(onchain.amount, 2);
        assertEq(onchain.next, 3);
        assertEq(onchain.prev, 4);
    }

    function test_BoardTypesSeatUpdateAssignableToOnchainSeatUpdate() public pure {
        uint256[] memory supporters = new uint256[](1);
        supporters[0] = 7;
        BoardTypes.SeatUpdate memory helper =
            BoardTypes.SeatUpdate({proposedSeats: 5, timestamp: 11, requiredQuorum: 3, supporters: supporters});
        MockBoard.SeatUpdate memory onchain = _copySeatUpdateToOnchain(helper);
        assertEq(onchain.proposedSeats, 5);
        assertEq(onchain.timestamp, 11);
        assertEq(onchain.requiredQuorum, 3);
        assertEq(onchain.supporters.length, 1);
        assertEq(onchain.supporters[0], 7);
    }

    function test_WalletTypesTransactionAssignableToOnchainTransaction() public pure {
        bytes32 dataHash = keccak256("calldata");
        WalletTypes.Transaction memory helper = WalletTypes.Transaction({
            executed: true,
            confirmations: 2,
            target: address(0xBEEF),
            value: 99,
            dataHash: dataHash
        });
        MockWallet.Transaction memory onchain = _copyWalletTransactionToOnchain(helper);
        assertTrue(onchain.executed);
        assertEq(onchain.confirmations, 2);
        assertEq(onchain.target, address(0xBEEF));
        assertEq(onchain.value, 99);
        assertEq(onchain.dataHash, dataHash);
    }

    function test_BoardTypesNodePacksNextPrevInOneSlot() public {
        BoardTypesStorageProbe probe = new BoardTypesStorageProbe();
        probe.write(1, 2, uint128(3), uint128(4));

        assertEq(uint256(vm.load(address(probe), bytes32(uint256(0)))), 1);
        assertEq(uint256(vm.load(address(probe), bytes32(uint256(1)))), 2);

        uint256 packed = uint256(vm.load(address(probe), bytes32(uint256(2))));
        assertEq(uint256(uint128(packed)), 3);
        assertEq(packed >> 128, 4);
    }

    function test_WalletTypesTransactionStoresDataHashInSlot2() public {
        WalletTypesStorageProbe probe = new WalletTypesStorageProbe();
        bytes32 dataHash = keccak256("calldata");
        address target = address(0xBEEF);
        probe.write(true, 2, target, 99, dataHash);

        uint256 slot0 = uint256(vm.load(address(probe), bytes32(uint256(0))));
        assertEq(slot0 & 0xff, 1);
        assertEq((slot0 >> 8) & 0xff, 2);
        assertEq(address(uint160(slot0 >> 16)), target);

        assertEq(uint256(vm.load(address(probe), bytes32(uint256(1)))), 99);
        assertEq(vm.load(address(probe), bytes32(uint256(2))), dataHash);
    }

    /// @dev uint256 helper.next/prev would not implicitly assign into packed uint128 on-chain fields.
    function _copyBoardNodeToOnchain(BoardTypes.Node memory helper) private pure returns (MockBoard.Node memory onchain) {
        onchain = MockBoard.Node({tokenId: helper.tokenId, amount: helper.amount, next: helper.next, prev: helper.prev});
    }

    function _copySeatUpdateToOnchain(BoardTypes.SeatUpdate memory helper)
        private
        pure
        returns (MockBoard.SeatUpdate memory onchain)
    {
        onchain = MockBoard.SeatUpdate({
            proposedSeats: helper.proposedSeats,
            timestamp: helper.timestamp,
            requiredQuorum: helper.requiredQuorum,
            supporters: helper.supporters
        });
    }

    /// @dev A leftover `bytes data` field would not populate `dataHash` here.
    function _copyWalletTransactionToOnchain(WalletTypes.Transaction memory helper)
        private
        pure
        returns (MockWallet.Transaction memory onchain)
    {
        onchain = MockWallet.Transaction({
            executed: helper.executed,
            confirmations: helper.confirmations,
            target: helper.target,
            value: helper.value,
            dataHash: helper.dataHash
        });
    }
}
