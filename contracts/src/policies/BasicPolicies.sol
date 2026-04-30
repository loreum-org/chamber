// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAgentPolicy} from "src/Agent.sol";
import {IChamber} from "src/interfaces/IChamber.sol";

/**
 * @title BasePolicy
 * @notice Abstract base class for governance policies
 */
abstract contract BasePolicy is IAgentPolicy {
    // Common helpers for decoding transactions can go here

    }

/**
 * @title AllowAllPolicy
 * @notice A policy that approves EVERYTHING (Degen mode)
 */
contract AllowAllPolicy is BasePolicy {
    function canApprove(address, uint256) external pure override returns (bool) {
        return true;
    }
}

/**
 * @title ConservativeYieldPolicy
 * @notice A sample policy that restricts transactions to a whitelist of "safe" protocols
 *         and limits the transaction value.
 */
contract ConservativeYieldPolicy is BasePolicy {
    uint256 public constant MAX_VALUE = 10 ether;
    mapping(address => bool) public allowedTargets;

    constructor(address[] memory _allowed) {
        for (uint256 i = 0; i < _allowed.length; i++) {
            allowedTargets[_allowed[i]] = true;
        }
    }

    function canApprove(address chamber, uint256 transactionId) external view override returns (bool) {
        // 1. Get transaction details from Chamber
        (,, address target, uint256 value,) = IChamber(chamber).getTransaction(transactionId);

        // 2. Check Value Limit
        if (value > MAX_VALUE) return false;

        // 3. Check Target Whitelist
        if (!allowedTargets[target]) return false;

        return true;
    }
}
