// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";

contract ChamberTest is Test {
    Chamber public chamber;
    IERC20 public token;
    IERC721 public nft;
    uint256 public seats;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    function setUp() public {
        token = new MockERC20();
        nft = new MockERC721();
        seats = 5;
        chamber = new Chamber(address(token), address(nft), seats);
    }

    function test_Chamber_delegate_success() public {
        uint256 tokenId = 1;
        uint256 amount = 100;

        // Mint tokens to user1
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        token.approve(address(chamber), amount);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();

        // Check user delegation amount
        assertEq(chamber.getDelegation(user1, tokenId), amount);

        // Check node amount
        Board.Node memory node = chamber.getMember(tokenId);
        assertEq(node.tokenId, tokenId);
        assertEq(node.amount, amount);
    }

    function test_Chamber_Undelegate_success(uint256 tokenId, uint256 amount) public {
        if (tokenId == 0) return;
        if (amount < 1 || amount > 1_000_000_000 ether) return;
        // Mint tokens to user1
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        token.approve(address(chamber), amount);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();

        // Undelegate tokens
        vm.startPrank(user1);
        chamber.undelegate(tokenId, amount);
        vm.stopPrank();

        // Check user delegation amount
        assertEq(chamber.getDelegation(user1, tokenId), 0);

        // Check node amount
        Board.Node memory node = chamber.getMember(tokenId);
        assertEq(node.amount, 0);
    }

    function test_Chamber_getLeaderboard_success() public {
        uint256 num = 5000;
        uint256[] memory tokenIds = new uint256[](num);
        uint256[] memory amounts = new uint256[](num);
        address[] memory users = new address[](num);

        // Initialize tokenIds, amounts, and users
        for (uint256 i = 0; i < num; i++) {
            tokenIds[i] = i + 1;
            amounts[i] = (i + 1) * 100;
            users[i] = address(uint160(i + 1));
        }

        // Mint tokens to users
        for (uint256 i = 0; i < num; i++) {
            MockERC20(address(token)).mint(users[i], amounts[i]);
        }

        // Approve and delegate tokens
        for (uint256 i = 0; i < num; i++) {
            vm.startPrank(users[i]);
            token.approve(address(chamber), amounts[i]);
            chamber.delegate(tokenIds[i], amounts[i]);
            vm.stopPrank();
        }

        // Get top num nodes
        (uint256[] memory topTokenIds, uint256[] memory topAmounts) = chamber.getTop(num);

        // Check top nodes
        for (uint256 i = 0; i < num; i++) {
            assertEq(topTokenIds[i], tokenIds[(num - 1) - i]);
            assertEq(topAmounts[i], amounts[(num - 1) - i]);
        }
    }

    function test_Chamber_SubmitTransaction() public {
        address target = address(0x3);
        uint256 value = 0;
        bytes memory data = "";
        // Mint an NFT to user1

        uint256 tokenId = 1;
        uint256 amount = 1 ether;
        MockERC721(address(nft)).mint(user1, tokenId);
        MockERC20(address(token)).mint(user1, amount);

        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId, 1);

        chamber.submitTransaction(target, value, data);
        vm.stopPrank();

        Wallet.Transaction memory trx = chamber.getTransaction(0);

        assertEq(target, trx.target);
        assertEq(value, trx.value);
        assertEq(data, trx.data);
        assertEq(false, trx.executed);
        assertEq(1, trx.confirmations);
    }

    function test_Chamber_ConfirmTransaction() public {
        address target = address(0x3);
        uint256 value = 0;
        bytes memory data = "";

        uint256 tokenId = 1;
        uint256 amount = 1 ether;
        MockERC721(address(nft)).mint(user1, tokenId);
        MockERC20(address(token)).mint(user1, amount);

        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId, 1);

        chamber.submitTransaction(target, value, data);
        vm.stopPrank();

        assertEq(chamber.getTransaction(0).confirmations, 1);
    }

    function test_Chamber_RevokeConfirmation() public {
        address target = address(0x3);
        uint256 value = 0;
        bytes memory data = "";

        uint256 tokenId = 1;
        uint256 amount = 1 ether;
        MockERC721(address(nft)).mint(user1, tokenId);
        MockERC20(address(token)).mint(user1, amount);

        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId, 1);

        chamber.submitTransaction(target, value, data);
        chamber.revokeConfirmation(0);
        vm.stopPrank();

        assertEq(chamber.getTransaction(0).confirmations, 0);
    }

    function test_Chamber_ExecuteTransaction() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        deal(address(chamber), value);

        uint256 tokenId = 1;
        uint256 amount = 1 ether;

        MockERC721(address(nft)).mint(user1, tokenId);
        MockERC20(address(token)).mint(user1, amount);

        MockERC721(address(nft)).mint(user2, tokenId + 2);
        MockERC20(address(token)).mint(user2, amount);

        MockERC721(address(nft)).mint(user3, tokenId + 3);
        MockERC20(address(token)).mint(user3, amount);

        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId, 1);
        chamber.submitTransaction(target, value, data);
        vm.stopPrank();

        vm.startPrank(user2);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId + 2, 1);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        vm.startPrank(user3);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId + 3, 1);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        vm.startPrank(user1);
        chamber.executeTransaction(0);
        vm.stopPrank();

        assertEq(chamber.getTransaction(0).executed, true);
        assertEq(address(0x3).balance, 1 ether);
        assertEq(address(chamber).balance, 0);
    }

    function test_Chamber_GetTransactionCount() public {
        address target = address(0x3);
        uint256 value = 0;
        bytes memory data = "";

        uint256 tokenId = 1;
        uint256 amount = 1 ether;
        MockERC721(address(nft)).mint(user1, tokenId);
        MockERC20(address(token)).mint(user1, amount);

        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId, 1);

        chamber.submitTransaction(target, value, data);
        vm.stopPrank();

        uint256 count = chamber.getTransactionCount();

        assertEq(count, 1);
    }

    function test_Chamber_GetQuorum() public view {
        uint256 expectedQuorum = 1 + (seats * 51) / 100;
        uint256 actualQuorum = chamber.getQuorum();

        assertEq(expectedQuorum, actualQuorum);
    }

    function test_Chamber_UpdateSeats() public {
        uint256 amount = 100;
        uint256 tokenId1 = 1;
        uint256 tokenId2 = 2;
        uint256 tokenId3 = 3;

        // Mint NFTs to users
        MockERC721(address(nft)).mint(user1, tokenId1);
        MockERC721(address(nft)).mint(user2, tokenId2);
        MockERC721(address(nft)).mint(user3, tokenId3);

        // Mint tokens to users
        MockERC20(address(token)).mint(user1, amount);
        MockERC20(address(token)).mint(user2, amount);
        MockERC20(address(token)).mint(user3, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);
        vm.stopPrank();

        vm.startPrank(user2);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId2, amount);
        vm.stopPrank();

        vm.startPrank(user3);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId3, amount);
        vm.stopPrank();

        // Attempt to update seats by a non-leader
        address target = address(chamber);
        uint256 value = 0;
        bytes memory data = abi.encodeWithSignature("_setSeats(uint256)", 5);

        vm.prank(user1);
        chamber.submitTransaction(target, value, data);

        vm.prank(user1);
        chamber.updateNumSeats(6);

        vm.prank(user2);
        chamber.updateNumSeats(6);

        vm.prank(user3);
        chamber.updateNumSeats(6);
    }

    function test_Chamber_ZeroAmountDelegation() public {
        uint256 amount = 0;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        vm.expectRevert();
        chamber.delegate(tokenId1, amount);
        vm.stopPrank();
    }

    function test_Chamber_DelegateFunction_NodeTokenIdCheck() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount / 2);
        chamber.delegate(tokenId1, amount / 2);
        vm.stopPrank();
    }

    function test_Chamber_DelegateFunction_BadTransfer() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);

        vm.expectRevert();
        chamber.delegate(tokenId1, amount + 1);
        vm.stopPrank();
    }

    function test_Chamber_UndelegateRevertsWithZeroAmount() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);
        // Attempt to undelegate with zero amount
        vm.expectRevert();
        chamber.undelegate(tokenId1, 0);
        vm.stopPrank();
    }

    function test_Chamber_UndelegateRevertsWithExcessAmount() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);

        // Attempt to undelegate more than the delegated amount
        vm.expectRevert();
        chamber.undelegate(tokenId1, amount + 1);
        vm.stopPrank();
    }

    function test_Chamber_DelegateAndUndelegate() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);

        // Check delegation
        assertEq(chamber.getDelegation(user1, tokenId1), amount);

        // Undelegate tokens
        chamber.undelegate(tokenId1, amount);

        // Check undelegation
        assertEq(chamber.getDelegation(user1, tokenId1), 0);
        vm.stopPrank();
    }

    function test_Chamber_UndelegateUpdatesNodeAmount() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);

        // Check delegation
        assertEq(chamber.getDelegation(user1, tokenId1), amount);

        // Undelegate part of the tokens
        uint256 undelegateAmount = 500;
        chamber.undelegate(tokenId1, undelegateAmount);

        // Check updated delegation
        assertEq(chamber.getDelegation(user1, tokenId1), amount - undelegateAmount);

        // Check node amount
        Board.Node memory node = chamber.getMember(tokenId1);
        assertEq(node.amount, amount - undelegateAmount);
        vm.stopPrank();
    }

    function test_Chamber_UndelegateRemovesNodeIfAmountIsZero() public {
        uint256 amount = 1000;
        uint256 tokenId1 = 1;

        // Mint NFT to user
        MockERC721(address(nft)).mint(user1, tokenId1);

        // Mint tokens to user
        MockERC20(address(token)).mint(user1, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);

        // Check delegation
        assertEq(chamber.getDelegation(user1, tokenId1), amount);

        // Undelegate all tokens
        chamber.undelegate(tokenId1, amount);

        // Check updated delegation
        assertEq(chamber.getDelegation(user1, tokenId1), 0);
        vm.stopPrank();
    }

    function test_Chamber_GetSeats() public view {
        uint256 _seats = chamber.getSeats();
        assertEq(_seats, 5);
    }

    function test_Chamber_GetDirectors() public {
        addDirectors();

        // Get directors
        address[] memory directors = chamber.getDirectors();

        // Check directors
        assertEq(directors.length, 3);
        assertEq(directors[0], user1);
        assertEq(directors[1], user2);
        assertEq(directors[2], user3);
    }

    function test_Chamber_GetSeatUpdates() public view {
        address[] memory updaters = chamber.getSeatUpdate();
        assertEq(updaters.length, 0);
    }

    function test_Chamber_ExecuteTransaction_NotDirector() public {
        // Submit a transaction first
        address target = address(0x3);
        uint256 value = 0;
        bytes memory data = "";

        vm.startPrank(user1);
        vm.expectRevert(Chamber.CallerIsNotADirector.selector);
        chamber.submitTransaction(target, value, data);
        vm.stopPrank();
    }

    function test_Chamber_getUserDelegations() public {
        uint256 tokenId1 = 1;
        uint256 tokenId2 = 2;
        uint256 tokenId3 = 3;

        // Mint tokens to users
        uint256 amount1 = 100;
        uint256 amount2 = 200;
        uint256 amount3 = 300;
        MockERC20(address(token)).mint(user1, amount1);
        MockERC20(address(token)).mint(user1, amount2);
        MockERC20(address(token)).mint(user1, amount3);

        // Approve and delegate tokens
        vm.startPrank(user1);
        token.approve(address(chamber), amount1);
        chamber.delegate(tokenId1, amount1);
        token.approve(address(chamber), amount2);
        chamber.delegate(tokenId2, amount2);
        token.approve(address(chamber), amount3);
        chamber.delegate(tokenId3, amount3);
        vm.stopPrank();

        // Get user delegations
        (uint256[] memory tokenIds, uint256[] memory amounts) = chamber.getDelegations(user1);

        // Check user delegations
        assertEq(tokenIds.length, 3);
        assertEq(amounts.length, 3);

        assertEq(tokenIds[0], tokenId3);
        assertEq(amounts[0], amount3);
        assertEq(tokenIds[1], tokenId2);
        assertEq(amounts[1], amount2);
        assertEq(tokenIds[2], tokenId1);
        assertEq(amounts[2], amount1);
    }

    function test_Chamber_ExecuteTransaction_ERC20() public {
        address target = address(token);

        uint256 value = 100 ether;
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", user1, value);

        addDirectors();

        // Mint tokens to the wallet
        MockERC20(address(token)).mint(address(chamber), value);

        // Submit and confirm the transaction
        vm.startPrank(user1);
        chamber.submitTransaction(target, 0, data);
        vm.stopPrank();

        vm.startPrank(user2);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        vm.startPrank(user3);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        // Execute the transaction
        vm.startPrank(user1);
        vm.expectRevert();
        chamber.executeTransaction(0);
        vm.stopPrank();
    }

    function test_Chamber_ExecuteTransaction_MockERC20() public {


        uint256 value = 100 ether;
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", user1, value);

        addDirectors();

        // Create a new mock token and send balance to chamber
        MockERC20 mockToken = new MockERC20();
        mockToken.mint(address(chamber), value);

        address target = address(mockToken);

        // Submit and confirm the transaction
        vm.startPrank(user1);
        chamber.submitTransaction(target, 0, data);
        vm.stopPrank();

        vm.startPrank(user2);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        vm.startPrank(user3);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        // Execute the transaction
        vm.startPrank(user1);
        chamber.executeTransaction(0);
        vm.stopPrank();

        // Check the transaction execution
        assertEq(MockERC20(target).balanceOf(user1), value);
    }
    
    function addDirectors() public {
        // Mint NFTs to users
        uint256 tokenId1 = 1;
        uint256 tokenId2 = 2;
        uint256 tokenId3 = 3;
        MockERC721(address(nft)).mint(user1, tokenId1);
        MockERC721(address(nft)).mint(user2, tokenId2);
        MockERC721(address(nft)).mint(user3, tokenId3);

        // Mint tokens to users
        uint256 amount = 1000;
        MockERC20(address(token)).mint(user1, amount);
        MockERC20(address(token)).mint(user2, amount);
        MockERC20(address(token)).mint(user3, amount);

        // Approve and delegate tokens
        vm.startPrank(user1);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId1, amount);
        vm.stopPrank();

        vm.startPrank(user2);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId2, amount);
        vm.stopPrank();

        vm.startPrank(user3);
        MockERC20(address(token)).approve(address(chamber), amount);
        chamber.delegate(tokenId3, amount);
        vm.stopPrank();
    }

    function test_Chamber_ExecuteBatchTransactions() public {
        address target1 = address(0x3);
        address target2 = address(0x4);
        uint256 value1 = 1 ether;
        uint256 value2 = 2 ether;
        bytes memory data1 = "";
        bytes memory data2 = "";
        deal(address(chamber), 3 ether);

        address[] memory targets = new address[](2);
        targets[0] = target1;
        targets[1] = target2;

        uint256[] memory values = new uint256[](2);
        values[0] = value1;
        values[1] = value2;

        bytes[] memory data = new bytes[](2);
        data[0] = data1;
        data[1] = data2;

        addDirectors();

        vm.startPrank(user1);
        chamber.submitBatchTransactions(targets, values, data);
        uint256[] memory batch = new uint256[](2);
        batch[0] = 0;
        batch[1] = 1;
        vm.stopPrank();

        vm.startPrank(user2);
        chamber.confirmBatchTransactions(batch);
        vm.stopPrank();

        vm.startPrank(user3);
        chamber.confirmBatchTransactions(batch);
        vm.stopPrank();

        vm.startPrank(user1);
        chamber.executeBatchTransactions(batch);
        vm.stopPrank();

        assertEq(chamber.getTransaction(0).executed, true);
        assertEq(chamber.getTransaction(1).executed, true);
        assertEq(address(0x3).balance, 1 ether);
        assertEq(address(0x4).balance, 2 ether);
        assertEq(address(chamber).balance, 0);
    }

    function test_Chamber_ExecuteTransactionLowConfCount() public {
        uint256 amount = 1000;
        address target = address(token);
        bytes memory approveData = abi.encodeWithSignature("approve(address,uint256)", address(0x5), amount);
        bytes memory transferData = abi.encodeWithSignature("transfer(address,uint256)", address(0x5), amount);

        // Mint tokens to chamber
        MockERC20(address(token)).mint(address(chamber), amount);

        addDirectors();

        // Submit approve transaction
        vm.startPrank(user1);
        chamber.submitTransaction(target, 0, approveData);
        vm.stopPrank();

        vm.startPrank(user2);
        chamber.confirmTransaction(0);
        vm.stopPrank();

        vm.startPrank(user3);
        chamber.confirmTransaction(0);
        chamber.executeTransaction(0);
        vm.stopPrank();

        // Submit transfer transaction
        vm.startPrank(user1);
        chamber.submitTransaction(target, 0, transferData);
        vm.stopPrank();

        // Only one confirmation, should revert on execute
        vm.startPrank(user1);

        vm.expectRevert();
        chamber.executeTransaction(1);
        vm.stopPrank();
    }
}
