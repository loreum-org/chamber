// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Factory} from "src/Factory.sol";
import {Chamber} from "src/Chamber.sol";

/// @notice Deploys BoardLib, WalletLib, the Chamber implementation and the Factory through
/// the standard CREATE2 deployer, so the same code, salt and ADMIN give the same Factory
/// address on every chain. Already-deployed contracts are skipped, so a re-run is a no-op.
/// @dev Do not pass `--libraries`: it changes every contract's metadata hash and so every
/// address. The script links Chamber to the CREATE2 library addresses itself, the same
/// way forge links after compiling.
contract DeployFactoryCreate2 is Script {
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 internal constant DEFAULT_SALT = "loreum.chamber.factory.v1";
    address internal constant DEFAULT_ADMIN = 0x5d45A213B2B6259F0b3c116a8907B56AB5E22095;

    function run() external returns (Factory factory) {
        bytes32 salt = vm.envOr("SALT", DEFAULT_SALT);
        address admin = vm.envOr("ADMIN", DEFAULT_ADMIN);
        require(CREATE2_DEPLOYER.code.length > 0, "CREATE2 deployer missing on this chain");

        address boardLib = _deployRaw(salt, vm.getCode("BoardLib.sol:BoardLib"), "BoardLib");
        address walletLib = _deployRaw(salt, vm.getCode("WalletLib.sol:WalletLib"), "WalletLib");

        string memory unlinked = vm.parseJsonString(vm.readFile("out/Chamber.sol/Chamber.json"), ".bytecode.object");
        string memory linked = _link(unlinked, "src/libraries/BoardLib.sol:BoardLib", boardLib);
        linked = _link(linked, "src/libraries/WalletLib.sol:WalletLib", walletLib);
        address chamberImpl = _deployRaw(salt, vm.parseBytes(linked), "Chamber");
        require(Chamber(payable(chamberImpl)).VERSION() != bytes32(0), "Chamber implementation has no VERSION");

        bytes memory factoryCode = abi.encodePacked(type(Factory).creationCode, abi.encode(chamberImpl, admin));
        address factoryAddr = vm.computeCreate2Address(salt, keccak256(factoryCode));
        if (factoryAddr.code.length == 0) {
            vm.broadcast();
            require(address(new Factory{salt: salt}(chamberImpl, admin)) == factoryAddr, "Factory address mismatch");
        }
        factory = Factory(factoryAddr);

        console.log("========================================");
        console.log("DeployFactoryCreate2");
        console.log("========================================");
        console.log("ADMIN                  ", admin);
        console.log("BOARD_LIB_ADDRESS      ", boardLib);
        console.log("WALLET_LIB_ADDRESS     ", walletLib);
        console.log("CHAMBER_IMPL_ADDRESS   ", chamberImpl);
        console.log("FACTORY_ADDRESS        ", factoryAddr);
        console.log("========================================");
    }

    /// @dev Replace solc's `__$<34 hex of keccak(fqName)>$__` placeholder with `lib`.
    function _link(string memory code, string memory fqName, address lib) internal pure returns (string memory) {
        bytes memory hash = bytes(vm.toString(keccak256(bytes(fqName))));
        bytes memory placeholder = new bytes(40);
        placeholder[0] = "_";
        placeholder[1] = "_";
        placeholder[2] = "$";
        for (uint256 i = 0; i < 34; i++) {
            placeholder[3 + i] = hash[2 + i];
        }
        placeholder[37] = "$";
        placeholder[38] = "_";
        placeholder[39] = "_";
        bytes memory addr = bytes(vm.toString(lib));
        bytes memory bare = new bytes(40);
        for (uint256 i = 0; i < 40; i++) {
            bare[i] = addr[2 + i];
        }
        return vm.replace(code, string(placeholder), vm.toLowercase(string(bare)));
    }

    /// @dev Libraries (and linked Chamber code) cannot be created with `new`, so call the CREATE2 deployer directly.
    function _deployRaw(bytes32 salt, bytes memory initCode, string memory name) internal returns (address addr) {
        addr = vm.computeCreate2Address(salt, keccak256(initCode));
        if (addr.code.length > 0) return addr;
        vm.broadcast();
        (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initCode));
        require(ok && addr.code.length > 0, string.concat(name, " CREATE2 deploy failed"));
    }
}
