// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {
    ReentrancyGuardTransientUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardTransientUpgradeable.sol";

/**
 * @title M-02 follow-up (#394): `directorCall` and `nonReentrant` share one guard slot
 * @notice #394 inlined the director guard with a hard-coded `_REENTRANCY_GUARD_SLOT` that
 *         duplicates OpenZeppelin's private `REENTRANCY_GUARD_STORAGE`. If either drifted,
 *         `directorCall` and `nonReentrant` would silently use different guards. These tests
 *         pin both directions plus the constant itself.
 */

/// @dev OZ-derived slot: keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~0xff
bytes32 constant OZ_REENTRANCY_GUARD_SLOT = 0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

/// @notice Inherits the vendored OZ guard and sets the expected slot by hand.
contract GuardSlotProbe is ReentrancyGuardTransientUpgradeable {
    function enteredAfterManualTstore(bytes32 slot) external returns (bool entered) {
        assembly ("memory-safe") {
            tstore(slot, 1)
        }
        entered = _reentrancyGuardEntered();
        assembly ("memory-safe") {
            tstore(slot, 0)
        }
    }
}

/// @notice Vault asset that re-enters a director-gated Chamber entry point from inside `deposit`
///         (a `nonReentrant` function). Transfers the exact amount so the deposit itself is valid.
contract ReenteringAsset is ERC20 {
    address public chamber;
    bool public armed;
    bytes4 public reenterError;
    bool public reenterAttempted;

    constructor() ERC20("Reentering Asset", "REA") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address _chamber) external {
        chamber = _chamber;
        armed = true;
        reenterAttempted = false;
        reenterError = bytes4(0);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            reenterAttempted = true;
            (bool ok, bytes memory reason) = chamber.call(abi.encodeCall(IChamber.updateSeats, (1, 4)));
            if (!ok && reason.length >= 4) reenterError = bytes4(reason);
        }
        return super.transferFrom(from, to, value);
    }
}

/// @notice Wallet call target that re-enters a `nonReentrant` vault function from inside
///         `executeTransaction` (a `directorCall` function).
contract DelegateReenterTarget {
    address public immutable chamber;
    bool public attempted;
    bytes4 public reenterError;

    constructor(address _chamber) {
        chamber = _chamber;
    }

    receive() external payable {
        if (attempted) return;
        attempted = true;
        (bool ok, bytes memory reason) = chamber.call(abi.encodeCall(IChamber.delegate, (1, 1)));
        if (!ok && reason.length >= 4) reenterError = bytes4(reason);
    }
}

contract FindingM02SharedGuardSlotTest is Test {
    MockERC721 internal nft;
    address internal admin = makeAddr("admin");
    address internal user1 = address(0x1);
    address internal user2 = address(0x2);
    address internal user3 = address(0x3);

    /// Constant: Chamber's hard-coded slot is OZ's derived slot, and the vendored OZ guard reads it.
    function test_GuardSlot_ChamberConstantMatchesOZ() public {
        bytes32 derived = keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1))
            & ~bytes32(uint256(0xff));
        assertEq(derived, OZ_REENTRANCY_GUARD_SLOT, "OZ ERC-7201 derivation");

        GuardSlotProbe probe = new GuardSlotProbe();
        assertTrue(
            probe.enteredAfterManualTstore(OZ_REENTRANCY_GUARD_SLOT),
            "vendored OZ ReentrancyGuardTransient reads a different slot"
        );

        string memory src = vm.readFile("src/Chamber.sol");
        assertTrue(
            vm.indexOf(src, "0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00") != type(uint256).max,
            "Chamber._REENTRANCY_GUARD_SLOT no longer matches the OZ guard slot"
        );
    }

    /// nonReentrant -> directorCall: a director entry point re-entered during `deposit` sees the
    /// guard that `nonReentrant` set and reverts with the reentrancy error (not NotDirector).
    function test_GuardSlot_DirectorCallSeesNonReentrantGuard() public {
        ReenteringAsset asset = new ReenteringAsset();
        nft = new MockERC721("Mock NFT", "MNFT");
        Chamber chamber = DeployChamber.deployViaFactory(address(asset), address(nft), 3, "Chamber", "CHMB", admin);

        _seat(IChamber(address(chamber)), asset, user1, 1);
        _seat(IChamber(address(chamber)), asset, user2, 2);
        vm.roll(block.number + 1);

        asset.mint(user3, 1e18);
        vm.startPrank(user3);
        asset.approve(address(chamber), 1e18);
        asset.arm(address(chamber));
        uint256 shares = chamber.deposit(1e18, user3);
        vm.stopPrank();

        assertGt(shares, 0, "outer deposit completes");
        assertTrue(asset.reenterAttempted(), "asset callback ran inside deposit");
        assertEq(
            asset.reenterError(),
            ReentrancyGuardTransientUpgradeable.ReentrancyGuardReentrantCall.selector,
            "directorCall did not see the nonReentrant guard: slots diverged"
        );
    }

    /// directorCall -> nonReentrant: `delegate` re-entered from a wallet call during
    /// `executeTransaction` reverts with the reentrancy error.
    function test_GuardSlot_NonReentrantSeesDirectorCallGuard() public {
        MockERC20 token = new MockERC20("Test Token", "TEST", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        IChamber chamber = IChamber(
            address(DeployChamber.deployViaFactory(address(token), address(nft), 3, "Chamber", "CHMB", admin))
        );
        _seat(chamber, ERC20Mintable(address(token)), user1, 1);
        _seat(chamber, ERC20Mintable(address(token)), user2, 2);
        _seat(chamber, ERC20Mintable(address(token)), user3, 3);
        vm.roll(block.number + 1);

        DelegateReenterTarget target = new DelegateReenterTarget(address(chamber));
        deal(address(chamber), 1 ether);

        vm.prank(user2);
        chamber.submitTransaction(2, address(target), 0.1 ether, "", "", 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);
        vm.prank(user2);
        chamber.executeTransaction(2, 0, "");

        assertTrue(target.attempted(), "target callback ran inside executeTransaction");
        assertEq(
            target.reenterError(),
            ReentrancyGuardTransientUpgradeable.ReentrancyGuardReentrantCall.selector,
            "nonReentrant did not see the directorCall guard: slots diverged"
        );

        // Guard released after the director call: a fresh nonReentrant call succeeds.
        vm.prank(user1);
        chamber.delegate(1, 1);
    }

    function _seat(IChamber chamber, ERC20Mintable asset, address user, uint256 tokenId) internal {
        asset.mint(user, 100e18);
        nft.mintWithTokenId(user, tokenId);
        vm.startPrank(user);
        asset.approve(address(chamber), 100e18);
        chamber.deposit(100e18, user);
        chamber.delegate(tokenId, 10e18);
        vm.stopPrank();
    }

    function _seat(IChamber chamber, ReenteringAsset asset, address user, uint256 tokenId) internal {
        _seat(chamber, ERC20Mintable(address(asset)), user, tokenId);
    }
}

interface ERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}
