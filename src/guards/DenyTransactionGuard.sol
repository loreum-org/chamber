// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../GuardManager.sol";
import "../interfaces/IChamber.sol";

contract DenyTransactionGuard is BaseGuard {
    fallback() external {}

    modifier onlychamber() {
        require(msg.sender == chamberAddress, "Not the chamber");
        _;
    }

    address public immutable chamberAddress; // WILL ONLY WORK IF chamber IS THE OWNER
    mapping (address => bool) public blacklisted;

    constructor(address[] memory _blacklisted, address _chamberAddress){
        require(_chamberAddress != address(0), "The address is zero");
        chamberAddress = _chamberAddress;
        for (uint i = 0; i < _blacklisted.length; i++) {
            blacklisted[_blacklisted[i]] = true;
        }
    }

    function addAddress(address _newAddress) external onlychamber{
        blacklisted[_newAddress] = true;
    }

    function removeAddress(address _prevAddress) external onlychamber{
        blacklisted[_prevAddress] = false;
    }

    function checkAddressBlacklisted(address[] memory to)internal view returns(bool){
        for (uint i=0; i <to.length;i++){
            if (blacklisted[to[i]]){
                return true;
            }
        }
        return false;
    }

    function checkTransaction(
        address[] memory to,
        uint256[] memory,
        bytes[] memory,
        uint256[5] memory ,
        IChamber.State,
        bytes memory ,
        address,
        uint256,
        uint256
    ) external view override {
        require(!checkAddressBlacklisted(to), "You are sending the transaction to an unallowed address");
    }

    function checkAfterExecution(bytes32 txHash, bool success) external override {
    }
}