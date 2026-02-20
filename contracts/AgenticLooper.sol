// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {
    IFlashLoanSimpleReceiver
} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {
    IPoolAddressesProvider
} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {
    IMorpho,
    MarketParams
} from "@morpho-org/morpho-blue/src/interfaces/IMorpho.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AgenticLooper is IFlashLoanSimpleReceiver {
    using SafeERC20 for IERC20;

    IPool public immutable pool;
    IMorpho public immutable morpho;
    address public owner;

    event LoopExecuted(address indexed asset, uint256 amount);
    event UnwindExecuted(address indexed asset, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _pool, address _morpho) {
        pool = IPool(_pool);
        morpho = IMorpho(_morpho);
        owner = msg.sender;
    }

    // For interacting with Aave
    function ADDRESSES_PROVIDER()
        external
        view
        returns (IPoolAddressesProvider)
    {
        return IPoolAddressesProvider(pool.ADDRESSES_PROVIDER());
    }
    function POOL() external view override returns (IPool) {
        return pool;
    }

    function requestLoop(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external onlyOwner {
        pool.flashLoanSimple(address(this), asset, amount, params, 0);
    }

    function requestUnwind(
        address asset,
        uint256 amountToRepay,
        bytes calldata params
    ) external onlyOwner {
        pool.flashLoanSimple(address(this), asset, amountToRepay, params, 0);
    }

    // Called by Aave after sending the flash loan
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(pool), "Untrusted lender");
        require(initiator == address(this), "Untrusted initiator");

        (bool isUnwind, MarketParams memory marketParams) = abi.decode(
            params,
            (bool, MarketParams)
        );

        if (isUnwind) {
            // --- UNWIND LOGIC ---
            // 1. Repay the debt on Morpho using the flash loaned funds
            IERC20(asset).safeIncreaseAllowance(address(morpho), amount);
            morpho.repay(marketParams, amount, 0, address(this), "");

            // 2. Withdraw the newly 'freed' collateral
            // Calculate equivalent collateral to withdraw based on repaid debt (simplified here for 1:1 correlated assets like wstETH/ETH)
            // In a real scenario, Oracle price must be factored to determine exactly how much collateral represents this debt piece.
            // For now, withdraw all collateral to close out (if amount was full debt)
            // This assumes we loop with homogeneous or highly correlated assets.

            // To be precise, you should decode how much collateral to withdraw from the params or calculate it dynamically.
            // This requires additional math depending on the Morpho oracle. We leave it simple for the template.
            uint256 collateralAvailable = 0; // morpho position details would be fetched here
            morpho.withdrawCollateral(
                marketParams,
                collateralAvailable,
                address(this),
                address(this)
            );

            // 3. Repay Aave Flash Loan (Original Amount + Premium)
            uint256 amountToRepay = amount + premium;
            IERC20(asset).safeIncreaseAllowance(address(pool), amountToRepay);
            emit UnwindExecuted(asset, amount);
        } else {
            // --- LOOP LOGIC ---
            // 1. Supply the Flash Loaned asset to Morpho Blue as collateral
            IERC20(asset).safeIncreaseAllowance(address(morpho), amount);
            morpho.supplyCollateral(marketParams, amount, address(this), "");

            // 2. Borrow back the same amount (plus premium) from Morpho
            uint256 amountToRepay = amount + premium;
            morpho.borrow(
                marketParams,
                amountToRepay,
                0,
                address(this),
                address(this)
            );

            // 3. Approve Aave to take the repayment
            IERC20(asset).safeIncreaseAllowance(address(pool), amountToRepay);
            emit LoopExecuted(asset, amount);
        }

        return true;
    }

    // Fallback for receiving ETH if needed
    receive() external payable {}
}
