// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/// @dev ERC-20-shaped token that reports failure instead of reverting.
contract FalseReturnToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] = amount;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @dev Successful bool, empty return, and a 32-byte zero word that is not a revert.
contract ReturnShapeTarget {
    function returnsTrue() external pure returns (bool) {
        return true;
    }

    function returnsNothing() external pure {}

    function returnsZeroWord() external pure returns (uint256) {
        return 0;
    }
}

/**
 * @title R-1012-L2: wallet execution treated a `false` return as success
 * @notice `executeTransaction` marked the nonce executed when the callee returned `false`
 *         without reverting, so a token transfer that moved nothing consumed the proposal.
 */
contract FindingR1012FalseReturnSuccessTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public director = makeAddr("director");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));

        nft.mintWithTokenId(director, 1);
        token.mint(director, 1 ether);
        vm.startPrank(director);
        token.approve(address(chamber), 1 ether);
        chamber.deposit(1 ether, director);
        chamber.delegate(1, 1 ether);
        vm.stopPrank();
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
    }

    function _execute(address target, bytes memory data) internal returns (uint256 txId) {
        vm.prank(director);
        chamber.submitTransaction(1, target, 0, data, "", 0);
        txId = chamber.getTransactionCount() - 1;
        vm.prank(director);
        chamber.executeTransaction(1, txId, data);
    }

    function test_falseReturnDoesNotConsumeNonce() public {
        FalseReturnToken asset = new FalseReturnToken();
        asset.mint(address(chamber), 10 ether);
        bytes memory data = abi.encodeCall(asset.transfer, (director, 10 ether));

        vm.prank(director);
        chamber.submitTransaction(1, address(asset), 0, data, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;

        vm.prank(director);
        vm.expectRevert(IWallet.TransactionFailed.selector);
        chamber.executeTransaction(1, txId, data);

        (bool executed,,,,) = chamber.getTransaction(txId);
        assertFalse(executed, "false return consumed the nonce");
        assertEq(asset.balanceOf(address(chamber)), 10 ether);
    }

    function test_trueAndEmptyReturnsStillExecute() public {
        ReturnShapeTarget target = new ReturnShapeTarget();
        _execute(address(target), abi.encodeCall(target.returnsTrue, ()));
        _execute(address(target), abi.encodeCall(target.returnsNothing, ()));
        assertEq(chamber.getTransactionCount(), 2);
    }

    function test_zeroWordReturnIsFailure() public {
        ReturnShapeTarget target = new ReturnShapeTarget();
        bytes memory data = abi.encodeCall(target.returnsZeroWord, ());
        vm.prank(director);
        chamber.submitTransaction(1, address(target), 0, data, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;
        vm.prank(director);
        vm.expectRevert(IWallet.TransactionFailed.selector);
        chamber.executeTransaction(1, txId, data);
    }
}
