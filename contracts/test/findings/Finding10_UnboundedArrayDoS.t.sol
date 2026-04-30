// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {ValidationRegistry} from "src/ValidationRegistry.sol";
import {ReputationRegistry} from "src/ReputationRegistry.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title Finding 10: Unbounded Array Growth in Registries [LOW] — FIXED
 * @notice Verifies that:
 *         - hasValidAttestation is now O(1) via mapping lookup
 *         - getAverageScore is now O(1) via running totals
 *         - Pagination functions are available
 */
contract UnboundedArrayDoSTest is Test {
    ValidationRegistry public validationRegistry;
    ReputationRegistry public reputationRegistry;
    address public admin = makeAddr("admin");
    address public validator = makeAddr("validator");
    uint256 public constant AGENT_ID = 1;

    function setUp() public {
        ValidationRegistry validationImpl = new ValidationRegistry();
        TransparentUpgradeableProxy validationProxy = new TransparentUpgradeableProxy(
            address(validationImpl), admin, abi.encodeWithSelector(ValidationRegistry.initialize.selector, admin)
        );
        validationRegistry = ValidationRegistry(address(validationProxy));

        ReputationRegistry reputationImpl = new ReputationRegistry();
        TransparentUpgradeableProxy reputationProxy = new TransparentUpgradeableProxy(
            address(reputationImpl), admin, abi.encodeWithSelector(ReputationRegistry.initialize.selector, admin)
        );
        reputationRegistry = ReputationRegistry(address(reputationProxy));

        vm.startPrank(admin);
        validationRegistry.grantRole(validationRegistry.VALIDATOR_ROLE(), validator);
        reputationRegistry.grantRole(reputationRegistry.REPUTATION_MANAGER_ROLE(), validator);
        vm.stopPrank();
    }

    /**
     * @notice FIXED: hasValidAttestation is now O(1) regardless of array size.
     */
    function test_Fixed_HasValidAttestationIsConstantTime() public {
        vm.startPrank(validator);
        for (uint256 i = 0; i < 500; i++) {
            validationRegistry.postValidation(AGENT_ID, "TEE_VERIFICATION", true, "proof", 1 days);
        }
        vm.stopPrank();

        // O(1) lookup via mapping — gas should be constant
        uint256 gasBefore = gasleft();
        bool hasValid = validationRegistry.hasValidAttestation(AGENT_ID, "TEE_VERIFICATION");
        uint256 gasUsed = gasBefore - gasleft();

        assertTrue(hasValid, "Should have valid attestation");
        // O(1) lookup should use much less gas than iterating 500 entries
        assertLt(gasUsed, 10000, "FIXED: O(1) lookup uses minimal gas");
        console.log("hasValidAttestation gas (O(1)):", gasUsed);
    }

    /**
     * @notice FIXED: getAverageScore is now O(1) via running totals.
     */
    function test_Fixed_GetAverageScoreIsConstantTime() public {
        vm.startPrank(validator);
        for (uint256 i = 0; i < 500; i++) {
            reputationRegistry.postSignal(AGENT_ID, 80, "good agent");
        }
        vm.stopPrank();

        // O(1) calculation via running totals
        uint256 gasBefore = gasleft();
        uint256 avg = reputationRegistry.getAverageScore(AGENT_ID);
        uint256 gasUsed = gasBefore - gasleft();

        assertEq(avg, 80, "Average should be 80");
        assertLt(gasUsed, 15000, "FIXED: O(1) average uses minimal gas");
        console.log("getAverageScore gas (O(1)):", gasUsed);
    }

    /**
     * @notice Verify pagination works for ValidationRegistry.
     */
    function test_Fixed_ValidationPagination() public {
        vm.startPrank(validator);
        for (uint256 i = 0; i < 100; i++) {
            validationRegistry.postValidation(AGENT_ID, "KYC", true, "proof", 1 days);
        }
        vm.stopPrank();

        assertEq(validationRegistry.getValidationCount(AGENT_ID), 100);

        // Get first page
        ValidationRegistry.Validation[] memory page1 = validationRegistry.getValidations(AGENT_ID, 0, 10);
        assertEq(page1.length, 10, "First page has 10 entries");

        // Get second page
        ValidationRegistry.Validation[] memory page2 = validationRegistry.getValidations(AGENT_ID, 10, 10);
        assertEq(page2.length, 10, "Second page has 10 entries");

        // Get past end
        ValidationRegistry.Validation[] memory empty = validationRegistry.getValidations(AGENT_ID, 200, 10);
        assertEq(empty.length, 0, "Past end returns empty");
    }

    /**
     * @notice Verify pagination works for ReputationRegistry.
     */
    function test_Fixed_ReputationPagination() public {
        vm.startPrank(validator);
        for (uint256 i = 0; i < 100; i++) {
            reputationRegistry.postSignal(AGENT_ID, 80, "good agent");
        }
        vm.stopPrank();

        assertEq(reputationRegistry.getSignalCount(AGENT_ID), 100);

        ReputationRegistry.Signal[] memory page1 = reputationRegistry.getSignals(AGENT_ID, 0, 10);
        assertEq(page1.length, 10, "First page has 10 entries");

        ReputationRegistry.Signal[] memory page2 = reputationRegistry.getSignals(AGENT_ID, 10, 10);
        assertEq(page2.length, 10, "Second page has 10 entries");
    }

    /**
     * @notice FIXED: Expired validations no longer waste gas in hasValidAttestation.
     */
    function test_Fixed_ExpiredValidationsNoWaste() public {
        vm.startPrank(validator);
        for (uint256 i = 0; i < 100; i++) {
            validationRegistry.postValidation(AGENT_ID, "KYC", true, "proof", 1);
        }
        vm.stopPrank();

        vm.warp(block.timestamp + 100);

        // O(1) — just checks the mapping
        uint256 gasBefore = gasleft();
        bool hasValid = validationRegistry.hasValidAttestation(AGENT_ID, "KYC");
        uint256 gasUsed = gasBefore - gasleft();

        assertFalse(hasValid, "All validations are expired");
        assertLt(gasUsed, 10000, "FIXED: No iteration through expired entries");
        console.log("Expired check gas (O(1)):", gasUsed);
    }
}
