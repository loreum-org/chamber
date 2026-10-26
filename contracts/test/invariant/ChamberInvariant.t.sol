// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {ChamberReads} from "test/utils/ChamberReads.sol";

/// @notice Bounded actions over vault shares and board delegations for stateful fuzzing.
/// @dev Fewer than MAX_NODES token ids, so no eviction: board amounts must equal the
///      sum of holder delegations exactly.
contract ChamberHandler is Test {
    Chamber public immutable chamber;
    MockERC20 public immutable token;

    address[] public actors;
    uint256 public constant TOKEN_IDS = 5;
    uint256 internal constant MAX_DEPOSIT = 1_000_000 ether;

    constructor(Chamber chamber_, MockERC20 token_, address[] memory actors_) {
        chamber = chamber_;
        token = token_;
        actors = actors_;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _tokenId(uint256 seed) internal pure returns (uint256) {
        return (seed % TOKEN_IDS) + 1;
    }

    function _free(address a) internal view returns (uint256) {
        return chamber.balanceOf(a) - ChamberReads.totalHolderDelegations(chamber, a);
    }

    function deposit(uint256 actorSeed, uint256 assets) external {
        address a = _actor(actorSeed);
        assets = bound(assets, 1, MAX_DEPOSIT);
        token.mint(a, assets);
        vm.startPrank(a);
        token.approve(address(chamber), assets);
        chamber.deposit(assets, a);
        vm.stopPrank();
    }

    function redeemFree(uint256 actorSeed, uint256 shares) external {
        address a = _actor(actorSeed);
        uint256 free = _free(a);
        if (free == 0) return;
        shares = bound(shares, 1, free);
        vm.prank(a);
        chamber.redeem(shares, a, a);
    }

    function transferFree(uint256 fromSeed, uint256 toSeed, uint256 shares) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        uint256 free = _free(from);
        if (free == 0 || from == to) return;
        shares = bound(shares, 1, free);
        vm.prank(from);
        chamber.transfer(to, shares);
    }

    function delegate(uint256 actorSeed, uint256 tokenSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        uint256 free = _free(a);
        if (free == 0) return;
        amount = bound(amount, 1, free);
        vm.prank(a);
        chamber.delegate(_tokenId(tokenSeed), amount);
    }

    function undelegate(uint256 actorSeed, uint256 tokenSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        uint256 tokenId = _tokenId(tokenSeed);
        uint256 current = ChamberReads.holderDelegation(chamber, a, tokenId);
        if (current == 0) return;
        amount = bound(amount, 1, current);
        vm.prank(a);
        chamber.undelegate(tokenId, amount);
    }

    /// @dev Locked shares must not move: a transfer above the free balance has to revert.
    function transferLockedReverts(uint256 fromSeed, uint256 toSeed, uint256 extra) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        if (from == to || ChamberReads.totalHolderDelegations(chamber, from) == 0) return;
        uint256 free = _free(from);
        uint256 locked = chamber.balanceOf(from) - free;
        uint256 shares = free + bound(extra, 1, locked);
        vm.prank(from);
        vm.expectRevert();
        chamber.transfer(to, shares);
    }
}

/// @notice Accounting invariants across arbitrary deposit / redeem / transfer / delegate sequences.
contract ChamberInvariantTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    ChamberHandler public handler;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), 3, "vMCK", "Vault MCK", address(0x9));

        address[] memory actors = new address[](3);
        actors[0] = makeAddr("alice");
        actors[1] = makeAddr("bob");
        actors[2] = makeAddr("carol");
        for (uint256 id = 1; id <= 5; id++) {
            nft.mintWithTokenId(actors[id % actors.length], id);
        }

        handler = new ChamberHandler(chamber, token, actors);
        targetContract(address(handler));
    }

    /// Delegated shares never exceed the holder's share balance.
    function invariant_delegationsBackedByShares() public view {
        for (uint256 i; i < handler.actorCount(); i++) {
            address a = handler.actors(i);
            assertLe(ChamberReads.totalHolderDelegations(chamber, a), chamber.balanceOf(a));
        }
    }

    /// Per-holder total equals the sum of that holder's per-token delegations.
    function invariant_holderTotalsMatchPerToken() public view {
        for (uint256 i; i < handler.actorCount(); i++) {
            address a = handler.actors(i);
            uint256 sum;
            for (uint256 id = 1; id <= handler.TOKEN_IDS(); id++) {
                sum += ChamberReads.holderDelegation(chamber, a, id);
            }
            assertEq(sum, ChamberReads.totalHolderDelegations(chamber, a));
        }
    }

    /// Each board node's amount equals the sum of holder delegations to that token.
    function invariant_boardMatchesHolderDelegations() public view {
        for (uint256 id = 1; id <= handler.TOKEN_IDS(); id++) {
            uint256 sum;
            for (uint256 i; i < handler.actorCount(); i++) {
                sum += ChamberReads.holderDelegation(chamber, handler.actors(i), id);
            }
            (uint256 nodeId, uint256 amount,,) = chamber.getMember(id);
            if (sum == 0) {
                assertEq(nodeId, 0, "empty delegation left a node");
            } else {
                assertEq(nodeId, id, "delegated token missing from board");
                assertEq(amount, sum, "node amount drifted from delegations");
            }
        }
    }

    /// The board list is sorted by amount, descending.
    function invariant_boardSortedDescending() public view {
        (, uint256[] memory amounts) = chamber.getTop(chamber.getSize());
        for (uint256 i = 1; i < amounts.length; i++) {
            assertGe(amounts[i - 1], amounts[i]);
        }
    }

    /// Only actors hold shares, so their balances sum to total supply.
    function invariant_sharesConserved() public view {
        uint256 sum;
        for (uint256 i; i < handler.actorCount(); i++) {
            sum += chamber.balanceOf(handler.actors(i));
        }
        assertEq(sum, chamber.totalSupply());
    }

    /// Redeeming every share never needs more assets than the vault holds.
    function invariant_vaultSolvent() public view {
        assertLe(chamber.previewRedeem(chamber.totalSupply()), token.balanceOf(address(chamber)));
    }
}
