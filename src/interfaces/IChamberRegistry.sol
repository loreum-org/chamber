// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IChamberRegistry {
    function agentIdentityRegistry() external view returns (address);
    function getParentChamber(address chamber) external view returns (address);
    function getChildChambers(address chamber) external view returns (address[] memory);
}
