// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {console} from "lib/forge-std/src/console.sol";

contract ChamberSepoliaTest is Test {
    Chamber public chamber;
    IERC20 public token;
    IERC721 public nft;
    uint256 public seats;

    address public user1 = 0xcA5089c112Aac4462c36b437C0bFbf5E527e0092;
    address public user2 = 0xfdCa38fc56BBa4e57A203D1E89bF23BaB3f7B6b3;
    address public user3 = 0x345F273fAE2CeC49e944BFBEf4899fA1625803C5;

    function setUp() public {
        token = IERC20(0xedf2e61ADD8976AC08Df4AFB69faDCD1428555f7);
        nft = IERC721(0xe02A8f23c19280dd828Eb5CA5EC89d64345f06d8);
        seats = 5;
        chamber = Chamber(payable(0x87DfceF6d02700525312A8698a49Bfcf87751494));
    }

    function test_Chamber_Sepolia_Setup() public view {
        assertEq(address(chamber.token()), address(token));
        assertEq(address(chamber.nft()), address(nft));
        assertEq(chamber.getSeats(), seats);
    }

    // NOTE: This test calls functions without tokenId parameter, suggesting it tests against
    // a deployed contract with a different interface. If updating this test, ensure the
    // function signatures match the deployed contract version.
    function test_Chamber_Sepolia_ExecuteTransactionLowConfCount() public {
        uint256 amount = 2;
        address target = address(token);
        // The approve call needs to approve the Chamber contract to spend tokens, not user1
        bytes memory approveData = abi.encodeWithSignature("approve(address,uint256)", address(chamber), amount);
        bytes memory transferData = abi.encodeWithSignature("transferFrom(address,address,uint256)", address(chamber), user1, amount);

        uint256 txIndex;

        // Submit approve transaction
        vm.startPrank(user1);
        chamber.submitTransaction(target, 0, approveData);
        txIndex = chamber.getTransactionCount() - 1;
        vm.stopPrank();

        vm.startPrank(user2);
        chamber.confirmTransaction(txIndex);
        vm.stopPrank();

        vm.startPrank(user3);
        chamber.confirmTransaction(txIndex);
        chamber.executeTransaction(txIndex);
        vm.stopPrank();

        // Submit transfer transaction
        uint256 txIndex2;

        vm.startPrank(user1);
        chamber.submitTransaction(target, 0, transferData);
        txIndex2 = chamber.getTransactionCount() - 1;
        vm.stopPrank();

        vm.startPrank(user2);
        chamber.confirmTransaction(txIndex2);
        vm.stopPrank();

        vm.startPrank(user3);
        chamber.confirmTransaction(txIndex2);
        chamber.executeTransaction(txIndex2);
        vm.stopPrank();

        assertEq(token.balanceOf(user1), amount);
    }    
}
