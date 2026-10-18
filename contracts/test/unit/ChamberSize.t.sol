// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";

/// @notice Fails CI if the Chamber implementation no longer deploys under EIP-170.
/// @dev `forge build --sizes` exits non-zero on test harnesses, so it can't gate this.
contract ChamberSizeTest is Test {
    uint256 internal constant EIP170_LIMIT = 24_576;

    function test_ChamberRuntimeFitsEip170() public {
        uint256 size = address(new Chamber()).code.length;
        emit log_named_uint("Chamber runtime bytes", size);
        assertLe(size, EIP170_LIMIT, "Chamber runtime exceeds EIP-170");
    }
}
