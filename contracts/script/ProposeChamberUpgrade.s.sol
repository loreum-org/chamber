// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {MainnetDeployGuard} from "script/MainnetDeployGuard.sol";

/// @notice Builds the one supported upgrade call: ProxyAdmin.upgradeAndCall(chamber, impl, data).
library ChamberUpgradeCalldata {
    /// @dev ERC-1967 implementation slot.
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /// @return target The chamber's ProxyAdmin (the quorum tx target).
    /// @return data `upgradeAndCall(chamber, newImplementation, initData)` calldata.
    function build(address chamber, address newImplementation, bytes memory initData)
        internal
        view
        returns (address target, bytes memory data)
    {
        target = IChamber(chamber).getProxyAdmin();
        data = abi.encodeCall(
            ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(chamber), newImplementation, initData)
        );
    }
}

/**
 * @title ProposeChamberUpgrade
 * @notice Step 2 of a chamber upgrade (step 1: `script/DeployChamberImplementation.s.sol`).
 *         Since 1.3.0 the only upgrade path is a quorum transaction from the chamber to its own
 *         ProxyAdmin: `submitTransaction(tokenId, getProxyAdmin(), 0, upgradeAndCall(...), uri, 0)`.
 *         ProxyAdmin has no version or migration checks of its own. This script's preflight is the
 *         only automated check (it refuses an in-place upgrade to 1.3.0+ from a chamber older than
 *         1.2.0, and logs a downgrade); the board is responsible for what it approves.
 *
 * Env:
 *   CHAMBER              chamber proxy (required)
 *   NEW_IMPLEMENTATION   new Chamber implementation (required)
 *   TOKEN_ID             submitter's seat tokenId (required when SUBMIT=true)
 *   UPGRADE_INIT_DATA    optional calldata forwarded to the new implementation (default empty)
 *   METADATA_URI         optional proposal metadata URI (default empty)
 *   SUBMIT               false (default): preflight + print calldata only. true: also submit.
 *
 * Simulate:  forge script script/ProposeChamberUpgrade.s.sol:ProposeChamberUpgrade --rpc-url $RPC -vvv
 * Submit:    SUBMIT=true ... --broadcast --account <director>   (chain id 1: Chad-only gate)
 * Then other directors confirm, and any director runs executeTransaction(tokenId, txId, 0x):
 * the ProxyAdmin calldata is stored onchain (1.3.0+), so execute needs no data.
 */
contract ProposeChamberUpgrade is Script {
    uint256 internal constant NOT_SUBMITTED = type(uint256).max;

    function run() external returns (uint256 txId) {
        address chamber = vm.envAddress("CHAMBER");
        address newImplementation = vm.envAddress("NEW_IMPLEMENTATION");
        bytes memory initData = vm.envOr("UPGRADE_INIT_DATA", bytes(""));
        string memory metadataURI = vm.envOr("METADATA_URI", string(""));
        bool doSubmit = vm.envOr("SUBMIT", false);
        uint256 tokenId = doSubmit ? vm.envUint("TOKEN_ID") : vm.envOr("TOKEN_ID", uint256(0));
        return propose(chamber, newImplementation, initData, tokenId, metadataURI, doSubmit);
    }

    /// @notice Preflight, log the quorum tx, and optionally submit it from the broadcaster.
    function propose(
        address chamber,
        address newImplementation,
        bytes memory initData,
        uint256 tokenId,
        string memory metadataURI,
        bool doSubmit
    ) public returns (uint256 txId) {
        preflight(chamber, newImplementation);
        (address target, bytes memory data) = ChamberUpgradeCalldata.build(chamber, newImplementation, initData);

        console.log("========================================");
        console.log("ProposeChamberUpgrade");
        console.log("========================================");
        console.log("Chamber                ", chamber);
        console.log("Current implementation ", currentImplementation(chamber));
        console.log("New implementation     ", newImplementation);
        (bytes32 currentVersion, bytes32 newVersion) = versions(chamber, newImplementation);
        console.log("Current VERSION        ", string(abi.encodePacked(currentVersion)));
        console.log("New VERSION            ", string(abi.encodePacked(newVersion)));
        if (parseVersion(newVersion) < parseVersion(currentVersion)) {
            console.log("WARNING: this is a DOWNGRADE. Check the storage layout before the board approves it.");
        }
        console.log("Target (ProxyAdmin)    ", target);
        console.log("Value                  ", uint256(0));
        console.log("Data (upgradeAndCall)");
        console.logBytes(data);
        console.log("submitTransaction calldata (send to the chamber):");
        console.logBytes(submitCalldata(tokenId, target, data, metadataURI));

        if (!doSubmit) {
            console.log("SUBMIT not set: nothing sent.");
            return NOT_SUBMITTED;
        }

        if (block.chainid == 1) MainnetDeployGuard.revertIfBroadcastBlocked();
        vm.startBroadcast();
        IChamber(chamber).submitTransaction(tokenId, target, 0, data, metadataURI, 0);
        vm.stopBroadcast();
        txId = IChamber(chamber).getTransactionCount() - 1;
        console.log("Submitted transactionId", txId);
        console.log("Next: directors confirmTransaction(tokenId, txId), then executeTransaction(tokenId, txId, 0x)");
    }

    /// @notice The checks the removed pre-1.3.0 chamber upgrade function did onchain, plus sanity checks.
    function preflight(address chamber, address newImplementation) public view returns (address proxyAdmin) {
        require(chamber.code.length > 0, "chamber has no code");
        require(newImplementation != address(0), "zero implementation");
        require(newImplementation.code.length > 0, "implementation has no code");
        proxyAdmin = IChamber(chamber).getProxyAdmin();
        require(proxyAdmin != address(0), "chamber has no ProxyAdmin");
        require(
            ProxyAdmin(proxyAdmin).owner() == chamber,
            "ProxyAdmin is not owned by the chamber; the board cannot upgrade it (not a Factory-created chamber?)"
        );
        require(newImplementation != currentImplementation(chamber), "chamber already runs this implementation");
        (uint256 current, uint256 next) = _parsedVersions(chamber, newImplementation);
        // 1.3.0 removed the pre-1.2.0 delegation backfill: an in-place upgrade from < 1.2.0 leaves
        // legacy delegation rows that revert `LegacyDelegation` and keep those shares locked.
        require(
            next < MIGRATION_REMOVED_VERSION || current >= MIN_IN_PLACE_VERSION,
            "chamber is older than 1.2.0: redeploy it on 1.3.0+ instead of upgrading in place"
        );
    }

    uint256 internal constant MIN_IN_PLACE_VERSION = (1 << 32) | (2 << 16); // 1.2.0
    uint256 internal constant MIGRATION_REMOVED_VERSION = (1 << 32) | (3 << 16); // 1.3.0

    /// @notice Raw `VERSION()` labels of the chamber and the new implementation (reverts if unreadable).
    function versions(address chamber, address newImplementation)
        public
        view
        returns (bytes32 currentVersion, bytes32 newVersion)
    {
        try Chamber(payable(newImplementation)).VERSION() returns (bytes32 v) {
            newVersion = v;
        } catch {
            revert("implementation has no VERSION(); not a Chamber build?");
        }
        try Chamber(payable(chamber)).VERSION() returns (bytes32 v) {
            currentVersion = v;
        } catch {
            revert("could not read the chamber's VERSION(); refusing to upgrade");
        }
    }

    function _parsedVersions(address chamber, address newImplementation)
        internal
        view
        returns (uint256 current, uint256 next)
    {
        (bytes32 currentVersion, bytes32 newVersion) = versions(chamber, newImplementation);
        next = parseVersion(newVersion);
        require(next != 0, "implementation VERSION() is not major.minor.patch");
        current = parseVersion(currentVersion);
        require(current != 0, "chamber VERSION() is not major.minor.patch; refusing to upgrade");
    }

    /// @notice Packs a `major.minor.patch` label (optional leading `v`) as major<<32 | minor<<16 | patch.
    ///         Returns 0 when the label is not in that form.
    function parseVersion(bytes32 label) public pure returns (uint256 packed) {
        uint256[3] memory parts;
        uint256 part;
        bool digit;
        uint256 i = label[0] == "v" ? 1 : 0;
        for (; i < 32; i++) {
            bytes1 c = label[i];
            if (c == 0) break;
            if (c == ".") {
                if (!digit || part == 2) return 0;
                part++;
                digit = false;
            } else if (c >= "0" && c <= "9") {
                parts[part] = parts[part] * 10 + uint8(c) - 48;
                if (parts[part] > type(uint16).max) return 0;
                digit = true;
            } else {
                return 0;
            }
        }
        if (part != 2 || !digit) return 0;
        return (parts[0] << 32) | (parts[1] << 16) | parts[2];
    }

    function currentImplementation(address chamber) public view returns (address) {
        return address(uint160(uint256(vm.load(chamber, ChamberUpgradeCalldata.IMPLEMENTATION_SLOT))));
    }

    /// @notice Calldata for `chamber.submitTransaction(...)`, for a Safe / cast / app submitter.
    function submitCalldata(uint256 tokenId, address target, bytes memory data, string memory metadataURI)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSignature(
            "submitTransaction(uint256,address,uint256,bytes,string,uint256)",
            tokenId,
            target,
            uint256(0),
            data,
            metadataURI,
            uint256(0)
        );
    }
}
