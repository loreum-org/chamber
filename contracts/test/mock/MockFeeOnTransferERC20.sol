// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Test ERC-20 that withholds a basis-point fee on every user-to-user transfer.
 * @dev Mints and burns are fee-free so setup can fund accounts at face value.
 */
contract MockFeeOnTransferERC20 is ERC20 {
    uint256 public immutable feeBps;

    constructor(string memory name_, string memory symbol_, uint256 initialSupply, uint256 feeBps_)
        ERC20(name_, symbol_)
    {
        feeBps = feeBps_;
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 0 && feeBps > 0) {
            uint256 fee = (value * feeBps) / 10_000;
            super._update(from, to, value - fee);
            if (fee > 0) {
                super._update(from, address(0), fee);
            }
            return;
        }
        super._update(from, to, value);
    }
}
