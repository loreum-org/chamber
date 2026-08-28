// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

/// @dev Guards the committed Sepolia demo-token lines that the app parses.
contract SepoliaDeploymentsTest is Test {
    function testSepoliaTxtRecordsDemoMocks() public view {
        string memory raw = vm.readFile("deployments/sepolia.txt");
        assertTrue(_contains(raw, "MockERC20"), "sepolia.txt missing MockERC20 label");
        assertTrue(_contains(raw, "MockERC721"), "sepolia.txt missing MockERC721 label");
        assertTrue(
            _containsInsensitive(raw, "486d69bcaf1e07e4f90edda9fa7e09de50cd01a2"),
            "sepolia.txt missing committed MockERC20"
        );
        assertTrue(
            _containsInsensitive(raw, "03cbb0bb72aeb043b0dc8b299facfe77f9159688"),
            "sepolia.txt missing committed MockERC721"
        );
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }

    function _containsInsensitive(string memory haystack, string memory needle) internal pure returns (bool) {
        return _contains(_lower(haystack), _lower(needle));
    }

    function _lower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) b[i] = bytes1(c + 32);
        }
        return string(b);
    }
}
