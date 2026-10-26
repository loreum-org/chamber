// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/// @dev DAI-style allowance aliases (Dai.sol `move` / `pull`) and ERC-1363 `transferFromAndCall`.
contract DaiLikeToken is ERC20 {
    constructor() ERC20("D", "D") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function move(address src, address dst, uint256 wad) external {
        transferFrom(src, dst, wad);
    }

    function pull(address usr, uint256 wad) external {
        transferFrom(usr, msg.sender, wad);
    }

    function transferFromAndCall(address src, address dst, uint256 wad) external returns (bool) {
        return transferFrom(src, dst, wad);
    }
}

/**
 * @title R-1012-M3b: pull aliases bypassed the selector denylist
 * @notice The first M3 fix blocked six pull selectors. DAI `move` / `pull` and ERC-1363
 *         `transferFromAndCall` also spend the chamber's allowance, so a quorum could still take
 *         a depositor's approved, undeposited funds. Calls to the vault asset are now limited to
 *         `transfer` / `approve`, and the aliases are denied on other targets.
 */
contract FindingR1012ApprovalPullAliasesTest is Test {
    Chamber public chamber;
    DaiLikeToken public token;
    MockERC721 public nft;
    address public victim = makeAddr("victim");
    address public director = address(0x1);

    function setUp() public {
        token = new DaiLikeToken();
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

        token.mint(victim, 500 ether);
        vm.prank(victim);
        token.approve(address(chamber), type(uint256).max);
    }

    function _expectBlocked(address target, bytes memory d) internal {
        vm.prank(director);
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, target, 0, d, "", 0);
    }

    function test_assetAliasesBlocked() public {
        _expectBlocked(address(token), abi.encodeCall(DaiLikeToken.move, (victim, director, 100 ether)));
        _expectBlocked(address(token), abi.encodeCall(DaiLikeToken.pull, (victim, 100 ether)));
        _expectBlocked(address(token), abi.encodeCall(DaiLikeToken.transferFromAndCall, (victim, director, 100 ether)));
        assertEq(token.balanceOf(victim), 500 ether);
    }

    /// Same aliases on a token that is not the vault asset (a depositor may have approved it too).
    function test_otherTokenAliasesBlocked() public {
        DaiLikeToken other = new DaiLikeToken();
        _expectBlocked(address(other), abi.encodeCall(DaiLikeToken.move, (victim, director, 1)));
        _expectBlocked(address(other), abi.encodeCall(DaiLikeToken.pull, (victim, 1)));
        _expectBlocked(address(other), abi.encodeCall(DaiLikeToken.transferFromAndCall, (victim, director, 1)));
        _expectBlocked(
            address(other), abi.encodeWithSelector(bytes4(0xc1d34b89), victim, director, uint256(1), bytes(""))
        );
        _expectBlocked(
            address(other), abi.encodeWithSelector(bytes4(0x62ad1b83), victim, director, uint256(1), bytes(""), bytes(""))
        );
    }

    function test_plainValueSendToAssetAllowed() public {
        vm.prank(director);
        chamber.submitTransaction(1, address(token), 0, "", "", 0);
    }
}
