// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface ILiquidityLauncher {
    struct Distribution {
        address strategy;
        uint128 amount;
        bytes configData;
    }

    function distributeToken(address token, Distribution calldata distribution, bool payerIsUser, bytes32 salt)
        external
        returns (address);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

struct MigratorParameters {
    uint64 migrationBlock; // block number when the migration can begin
    address currency; // the currency that the token will be paired with in the v4 pool (currency that the initializer raised funds in)
    uint24 poolLPFee; // the LP fee that the v4 pool will use
    int24 poolTickSpacing; // the tick spacing that the v4 pool will use
    uint24 tokenSplit; // the percentage of the total supply of the token that will be sent to the initializer, expressed in mps (1e7 = 100%)
    address initializerFactory; // the initializer factory that will be used to create the initializer
    address positionRecipient; // the address that will receive the position
    uint64 sweepBlock; // the block number when the operator can sweep currency and tokens from the pool
    address operator; // the address that is able to sweep currency and tokens from the pool
    uint128 maxCurrencyAmountForLP; // the maximum amount of currency that can be used for LP
}

contract TestLaunch is Script {
    address LIQUIDITY_LAUNCHER = 0x00000008412db3394C91A5CbD01635c6d140637C;
    address STRATEGY = 0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff;

    function run() public {
        address mockToken = 0xD4aA8Dc4B38673142C9b082b57c193eBB3690C37; // User's deployed token

        uint128 amount = 100 * 1e18;

        vm.startBroadcast();

        // 1. Transfer tokens directly to LiquidityLauncher
        IERC20(mockToken).transfer(LIQUIDITY_LAUNCHER, amount);

        MigratorParameters memory params = MigratorParameters({
            migrationBlock: 0,
            currency: address(0),
            poolLPFee: 3000,
            poolTickSpacing: 60,
            tokenSplit: 10000000,
            initializerFactory: 0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5,
            positionRecipient: msg.sender,
            sweepBlock: 0,
            operator: msg.sender,
            maxCurrencyAmountForLP: 0
        });

        bytes memory configData = abi.encode(params, new bytes(0));

        ILiquidityLauncher.Distribution memory dist =
            ILiquidityLauncher.Distribution({strategy: STRATEGY, amount: amount, configData: configData});

        ILiquidityLauncher(LIQUIDITY_LAUNCHER)
            .distributeToken(
                mockToken,
                dist,
                false, // payerIsUser = false
                bytes32(0)
            );
        vm.stopBroadcast();
    }
}
