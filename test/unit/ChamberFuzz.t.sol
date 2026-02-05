// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

contract ChamberFuzzTest is Test {
    Chamber public chamber;
    IERC20 public token;
    IERC721 public nft;
    uint256 public seats;

    address public user1 = address(0x100); // Avoid precompile addresses (0x1-0x9)
    address public user2 = address(0x200);
    address public user3 = address(0x300);

    uint256 constant MAX_AMOUNT = 1_000_000_000 ether;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        string memory name = "vERC20";
        string memory symbol = "Vault Token";

        address admin = address(0x9);
        seats = 5;
        chamber = DeployChamber.deploy(address(token), address(nft), seats, name, symbol, admin);
    }

    /// @notice Fuzz test for delegate with random amounts
    function testFuzz_Delegate(uint256 tokenId, uint256 amount) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        amount = bound(amount, 1, MAX_AMOUNT);

        // Setup: mint NFT and tokens
        MockERC721(address(nft)).mintWithTokenId(user1, tokenId);
        MockERC20(address(token)).mint(user1, amount);

        vm.startPrank(user1);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user1);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();

        // Verify delegation
        assertEq(chamber.getAgentDelegation(user1, tokenId), amount);
        (, uint256 nodeAmount,,) = chamber.getMember(tokenId);
        assertEq(nodeAmount, amount);
    }

    /// @notice Fuzz test for undelegate with random amounts
    function testFuzz_Undelegate(
        uint256 tokenId,
        uint256 depositAmount,
        uint256 delegateAmount,
        uint256 undelegateAmount
    ) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        depositAmount = bound(depositAmount, 1, MAX_AMOUNT);
        delegateAmount = bound(delegateAmount, 1, depositAmount);
        undelegateAmount = bound(undelegateAmount, 1, delegateAmount);

        // Setup
        MockERC721(address(nft)).mintWithTokenId(user1, tokenId);
        MockERC20(address(token)).mint(user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);
        chamber.deposit(depositAmount, user1);
        chamber.delegate(tokenId, delegateAmount);
        vm.stopPrank();

        uint256 beforeDelegation = chamber.getAgentDelegation(user1, tokenId);
        (, uint256 beforeNodeAmount,,) = chamber.getMember(tokenId);

        // Undelegate
        vm.startPrank(user1);
        chamber.undelegate(tokenId, undelegateAmount);
        vm.stopPrank();

        // Verify undelegation
        assertEq(chamber.getAgentDelegation(user1, tokenId), beforeDelegation - undelegateAmount);
        (, uint256 afterNodeAmount,,) = chamber.getMember(tokenId);
        assertEq(afterNodeAmount, beforeNodeAmount - undelegateAmount);
    }

    /// @notice Fuzz test for multiple delegations
    function testFuzz_MultipleDelegations(uint256[5] memory tokenIds, uint256[5] memory amounts, uint256 totalDeposit)
        public
    {
        // Bound inputs - ensure totalDeposit is large enough
        totalDeposit = bound(totalDeposit, 5, MAX_AMOUNT); // At least 5 to divide by 5

        uint256 sum = 0;

        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max - 10); // Leave room for uniqueness

            // Ensure unique tokenIds
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    // Avoid overflow when incrementing
                    if (tokenIds[i] < type(uint256).max) {
                        tokenIds[i] = tokenIds[i] + i + 1;
                    } else {
                        // If at max, use a different value based on index
                        tokenIds[i] = (i + 1) % (type(uint256).max - 10);
                        if (tokenIds[i] == 0) tokenIds[i] = i + 1;
                    }
                }
            }
        }

        // Bound amounts to ensure they fit within totalDeposit
        for (uint256 i = 0; i < 5; i++) {
            uint256 maxAmount = totalDeposit / 5;
            if (maxAmount == 0) maxAmount = 1;
            amounts[i] = bound(amounts[i], 1, maxAmount);
            sum += amounts[i];
        }

        // Adjust total deposit to cover all delegations if needed
        if (sum > totalDeposit) {
            totalDeposit = sum;
        }

        // Setup
        MockERC20(address(token)).mint(user1, totalDeposit);
        for (uint256 i = 0; i < 5; i++) {
            MockERC721(address(nft)).mintWithTokenId(user1, tokenIds[i]);
        }

        vm.startPrank(user1);
        token.approve(address(chamber), totalDeposit);
        chamber.deposit(totalDeposit, user1);

        // Delegate to multiple tokenIds
        for (uint256 i = 0; i < 5; i++) {
            chamber.delegate(tokenIds[i], amounts[i]);
        }
        vm.stopPrank();

        // Verify all delegations
        uint256 totalDelegated = 0;
        for (uint256 i = 0; i < 5; i++) {
            uint256 delegation = chamber.getAgentDelegation(user1, tokenIds[i]);
            assertEq(delegation, amounts[i]);
            totalDelegated += delegation;
        }

        assertEq(chamber.getTotalAgentDelegations(user1), totalDelegated);
    }

    /// @notice Fuzz test for deposit and withdraw
    function testFuzz_DepositWithdraw(uint256 depositAmount, uint256 withdrawAmount) public {
        // Bound inputs
        depositAmount = bound(depositAmount, 1, MAX_AMOUNT);
        withdrawAmount = bound(withdrawAmount, 1, depositAmount);

        // Setup
        MockERC20(address(token)).mint(user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);

        uint256 beforeBalance = chamber.balanceOf(user1);
        chamber.deposit(depositAmount, user1);
        uint256 afterDepositBalance = chamber.balanceOf(user1);

        assertEq(afterDepositBalance, beforeBalance + depositAmount);

        // Withdraw
        chamber.withdraw(withdrawAmount, user1, user1);
        uint256 afterWithdrawBalance = chamber.balanceOf(user1);

        assertEq(afterWithdrawBalance, afterDepositBalance - withdrawAmount);
        vm.stopPrank();
    }

    /// @notice Fuzz test for transfer with delegation constraints
    function testFuzz_TransferWithDelegation(uint256 depositAmount, uint256 delegateAmount, uint256 transferAmount)
        public
    {
        // Bound inputs
        depositAmount = bound(depositAmount, 2, MAX_AMOUNT); // At least 2 to allow both delegate and transfer
        delegateAmount = bound(delegateAmount, 1, depositAmount - 1); // Leave at least 1 for transfer
        uint256 availableAmount = depositAmount - delegateAmount;
        if (availableAmount == 0) availableAmount = 1;
        transferAmount = bound(transferAmount, 1, availableAmount); // Can't transfer more than available

        uint256 tokenId = 1;

        // Setup
        MockERC721(address(nft)).mintWithTokenId(user1, tokenId);
        MockERC20(address(token)).mint(user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);
        chamber.deposit(depositAmount, user1);
        chamber.delegate(tokenId, delegateAmount);
        vm.stopPrank();

        uint256 availableBalance = chamber.balanceOf(user1) - delegateAmount;

        if (transferAmount <= availableBalance) {
            // Should succeed
            vm.prank(user1);
            bool success = chamber.transfer(user2, transferAmount);
            assertTrue(success, "Transfer should succeed");
            assertEq(chamber.balanceOf(user2), transferAmount);
        } else {
            // Should revert
            vm.prank(user1);
            vm.expectRevert(IChamber.ExceedsDelegatedAmount.selector);
            bool success = chamber.transfer(user2, transferAmount);
            assertTrue(success, "Transfer call should return true if it doesn't revert (but it should revert here)");
        }
    }

    /// @notice Fuzz test for getTop with various counts
    function testFuzz_GetTop(uint256 count, uint256 numDirectors) public {
        // Bound inputs
        numDirectors = bound(numDirectors, 1, seats);
        count = bound(count, 1, 20); // At least 1 to avoid underflow issues

        // Setup directors
        for (uint256 i = 1; i <= numDirectors; i++) {
            // casting to 'uint160' is safe because we just need a unique address derived from index
            // forge-lint: disable-next-line(unsafe-typecast)
            address user = address(uint160(i));
            MockERC721(address(nft)).mintWithTokenId(user, i);
            MockERC20(address(token)).mint(user, 1 ether);

            vm.startPrank(user);
            token.approve(address(chamber), 1 ether);
            chamber.deposit(1 ether, user);
            chamber.delegate(i, 1 ether);
            vm.stopPrank();
        }

        // Get top
        (uint256[] memory topTokenIds, uint256[] memory topAmounts) = chamber.getTop(count);

        // Verify results
        uint256 expectedCount = count > numDirectors ? numDirectors : count;
        assertEq(topTokenIds.length, expectedCount);
        assertEq(topAmounts.length, expectedCount);

        // Verify sorted order
        for (uint256 i = 0; i < topTokenIds.length - 1; i++) {
            assertGe(topAmounts[i], topAmounts[i + 1], "Results should be sorted");
        }
    }

    /// @notice Fuzz test for getDelegations
    function testFuzz_GetDelegations(uint256[3] memory tokenIds, uint256[3] memory amounts, uint256 totalDeposit)
        public
    {
        // Bound inputs - ensure totalDeposit is large enough
        totalDeposit = bound(totalDeposit, 3, MAX_AMOUNT); // At least 3 to divide by 3

        // Ensure unique tokenIds first
        for (uint256 i = 0; i < 3; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max - 10); // Leave room for uniqueness
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    // Avoid overflow when incrementing
                    if (tokenIds[i] < type(uint256).max) {
                        tokenIds[i] = tokenIds[i] + i + 1;
                    } else {
                        // If at max, use a different value based on index
                        tokenIds[i] = (i + 1) % (type(uint256).max - 10);
                        if (tokenIds[i] == 0) tokenIds[i] = i + 1;
                    }
                }
            }
        }

        uint256 sum = 0;
        // Bound amounts to ensure they fit within totalDeposit
        for (uint256 i = 0; i < 3; i++) {
            uint256 maxAmount = totalDeposit / 3;
            if (maxAmount == 0) maxAmount = 1;
            amounts[i] = bound(amounts[i], 1, maxAmount);
            sum += amounts[i];
        }

        if (sum > totalDeposit) {
            totalDeposit = sum;
        }

        // Setup
        MockERC20(address(token)).mint(user1, totalDeposit);
        for (uint256 i = 0; i < 3; i++) {
            MockERC721(address(nft)).mintWithTokenId(user1, tokenIds[i]);
        }

        vm.startPrank(user1);
        token.approve(address(chamber), totalDeposit);
        chamber.deposit(totalDeposit, user1);

        for (uint256 i = 0; i < 3; i++) {
            chamber.delegate(tokenIds[i], amounts[i]);
        }
        vm.stopPrank();

        // Get delegations
        (uint256[] memory returnedTokenIds, uint256[] memory returnedAmounts) = chamber.getDelegations(user1);

        // Verify
        assertEq(returnedTokenIds.length, 3);
        assertEq(returnedAmounts.length, 3);

        // Verify amounts match (order may differ)
        uint256 totalReturned = 0;
        for (uint256 i = 0; i < returnedAmounts.length; i++) {
            totalReturned += returnedAmounts[i];
        }
        assertEq(totalReturned, sum);
    }

    /// @notice Fuzz test for zero amount delegation (should revert)
    function testFuzz_DelegateZeroAmount(uint256 tokenId) public {
        tokenId = bound(tokenId, 1, type(uint256).max);

        MockERC721(address(nft)).mintWithTokenId(user1, tokenId);
        MockERC20(address(token)).mint(user1, 100);

        vm.startPrank(user1);
        token.approve(address(chamber), 100);
        chamber.deposit(100, user1);

        vm.expectRevert(IChamber.ZeroAmount.selector);
        chamber.delegate(tokenId, 0);
        vm.stopPrank();
    }

    /// @notice Fuzz test for insufficient balance delegation
    function testFuzz_DelegateInsufficientBalance(uint256 tokenId, uint256 depositAmount, uint256 delegateAmount)
        public
    {
        tokenId = bound(tokenId, 1, type(uint256).max);
        depositAmount = bound(depositAmount, 1, MAX_AMOUNT);
        delegateAmount = bound(delegateAmount, depositAmount + 1, type(uint256).max);

        MockERC721(address(nft)).mintWithTokenId(user1, tokenId);
        MockERC20(address(token)).mint(user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);
        chamber.deposit(depositAmount, user1);

        vm.expectRevert(IChamber.InsufficientChamberBalance.selector);
        chamber.delegate(tokenId, delegateAmount);
        vm.stopPrank();
    }

    /// @notice Invariant: Total delegations should never exceed user balance
    function testFuzz_Invariant_DelegationBalance(uint256 depositAmount, uint256[3] memory delegateAmounts) public {
        depositAmount = bound(depositAmount, 3, MAX_AMOUNT); // At least 3 to divide by 3

        uint256 sum = 0;
        // Bound amounts to ensure they fit within depositAmount
        for (uint256 i = 0; i < 3; i++) {
            uint256 maxAmount = depositAmount / 3;
            if (maxAmount == 0) maxAmount = 1;
            delegateAmounts[i] = bound(delegateAmounts[i], 1, maxAmount);
            sum += delegateAmounts[i];
        }

        // Adjust depositAmount if needed
        if (sum > depositAmount) {
            depositAmount = sum;
        }

        uint256 tokenId = 1;
        MockERC721(address(nft)).mintWithTokenId(user1, tokenId);
        MockERC20(address(token)).mint(user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);
        chamber.deposit(depositAmount, user1);

        for (uint256 i = 0; i < 3; i++) {
            chamber.delegate(tokenId, delegateAmounts[i]);
        }
        vm.stopPrank();

        // Invariant: total delegations <= balance
        uint256 totalDelegations = chamber.getTotalAgentDelegations(user1);
        uint256 balance = chamber.balanceOf(user1);
        assertLe(totalDelegations, balance, "Total delegations should never exceed balance");
    }

    /// @notice Invariant: Board size should match number of nodes with non-zero amounts
    function testFuzz_Invariant_BoardSize(uint256[5] memory tokenIds, uint256[5] memory amounts, uint256 totalDeposit)
        public
    {
        // Bound totalDeposit to a reasonable max to avoid overflow issues in setup
        totalDeposit = bound(totalDeposit, 5, MAX_AMOUNT);

        // Ensure unique tokenIds first
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max - 100);
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    unchecked {
                        if (tokenIds[i] < type(uint256).max) {
                            tokenIds[i] = tokenIds[i] + i + 1;
                        } else {
                            tokenIds[i] = i + 1;
                        }
                    }
                }
            }
        }

        uint256 sum = 0;
        // Bound amounts to ensure they fit within totalDeposit
        for (uint256 i = 0; i < 5; i++) {
            uint256 maxAmount = totalDeposit / 5;
            if (maxAmount == 0) maxAmount = 1;
            amounts[i] = bound(amounts[i], 1, maxAmount);
            sum += amounts[i];
        }

        if (sum > totalDeposit) {
            totalDeposit = sum;
        }

        MockERC20(address(token)).mint(user1, totalDeposit);

        // Track unique tokenIds that will actually be delegated to
        uint256[] memory uniqueTokenIds = new uint256[](5);
        uint256[] memory uniqueAmounts = new uint256[](5);
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < 5; i++) {
            // Only process if amount > 0
            if (amounts[i] > 0) {
                // Check if this tokenId is already in our unique list
                bool isDuplicate = false;
                for (uint256 j = 0; j < uniqueCount; j++) {
                    if (uniqueTokenIds[j] == tokenIds[i]) {
                        // Add amount to existing entry
                        uniqueAmounts[j] += amounts[i];
                        isDuplicate = true;
                        break;
                    }
                }

                if (!isDuplicate) {
                    // New unique tokenId
                    uniqueTokenIds[uniqueCount] = tokenIds[i];
                    uniqueAmounts[uniqueCount] = amounts[i];
                    uniqueCount++;

                    // Mint NFT if it doesn't exist
                    try nft.ownerOf(tokenIds[i]) returns (
                        address
                    ) {
                    // Token already exists, skip minting
                    }
                    catch {
                        // Token doesn't exist, mint it
                        MockERC721(address(nft)).mintWithTokenId(user1, tokenIds[i]);
                    }
                }
            }
        }

        vm.startPrank(user1);
        token.approve(address(chamber), totalDeposit);
        chamber.deposit(totalDeposit, user1);

        // Delegate to unique tokenIds
        for (uint256 i = 0; i < uniqueCount; i++) {
            chamber.delegate(uniqueTokenIds[i], uniqueAmounts[i]);
        }
        vm.stopPrank();

        uint256 expectedSize = uniqueCount;

        // Invariant: board size should equal number of nodes
        assertEq(chamber.getSize(), expectedSize, "Board size should match number of nodes");
    }
}
