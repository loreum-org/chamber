// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";
import {MockWallet} from "test/mock/MockWallet.sol";

/// @notice Symbolic verification of Wallet transaction hash storage via Halmos
contract WalletSymTest is Test, SymTest {
    MockWallet internal wallet;

    address internal constant TARGET = address(0x100);

    function setUp() public {
        wallet = new MockWallet();
    }

    /// @dev Submitted transaction stores keccak256(calldata) as dataHash
    function symbolicSubmitPreservesDataHash() public {
        uint256 tokenId = svm.createUint256("tokenId");
        uint256 value = svm.createUint256("value");
        bytes memory data = svm.createBytes(64, "calldata");
        vm.assume(tokenId > 0);

        wallet.submitTransaction(tokenId, TARGET, value, data);

        (, , , , bytes32 dataHash) = wallet.getTransaction(0);
        assertEq(dataHash, keccak256(data));
        assertEq(wallet.getTransactionCount(), 1);
    }

    /// @dev Mismatched calldata at execution time must revert
    function symbolicExecuteRejectsWrongCalldata() public {
        uint256 tokenId = svm.createUint256("tokenId");
        bytes memory data = svm.createBytes(32, "data");
        bytes memory wrongData = svm.createBytes(32, "wrongData");
        vm.assume(tokenId > 0);
        vm.assume(keccak256(data) != keccak256(wrongData));

        wallet.submitTransaction(tokenId, TARGET, 0, data);

        (bool success,) =
            address(wallet).call(abi.encodeCall(MockWallet.executeTransaction, (tokenId, 0, wrongData)));
        assertFalse(success);
    }
}
