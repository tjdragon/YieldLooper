# Description of DFNS YieldLooper

## Intro

The intersection of LLMs and digital assets has shifted from "chatbots about crypto" to Agentic Finance—where AI doesn't just talk, but possesses a wallet and executes on-chain.

## Architecture

To build a production-grade DeFi Agent, you need a decoupled architecture to ensure the AI can't "hallucinate" your funds into a void.

### 1. The Reasoning Layer (The Brain)

- Use a high-reasoning model (like Gemini Pro) specialized via RAG (Retrieval-Augmented Generation).
- Input: Real-time price feeds (Pyth/Chainlink), social sentiment (X/Farcaster), and protocol docs
- Function: It doesn't write code; it outputs Intents.
- Example: "I want to move 50% of our USDC from Aave to Morpho because the spread is > 2% and the risk score is stable."

### 2. The Verification Layer (The Filter)

- This is where you prevent the AI from making mistakes. You implement a Policy Engine.
- Guardrails: Hardcoded rules that the Agent cannot break.
- Rule A: Max slippage 1%.
- Rule B: Never interact with unverified contracts.
- Rule C: Daily spend limit of X ETH.

### 3. The Execution Layer (The Wallet)

- Use DFNS API Service Account to sign and broadcast transactions

## Business Strategy: The "Morpho-Aave" Delta

Instead of looping within one protocol, the agent exploits the efficiency gap between Aave V3 (generalized) and Morpho (P2P-optimized).

The Loop: 
- 1.  Supply $wstETH$ to Aave V3 as collateral.
- 2.  Borrow $ETH$ at Aave’s variable rate.
- 3.  Bridge/Swap that $ETH$ to a Morpho Blue vault where the borrow rate is lower due to P2P matching.
- 4.  Repeat until the desired leverage (e.g., 3x) is reached.

The AI's Job: The LLM monitors the "P2P Match Rate" on Morpho. If the match breaks (reverting to Aave rates), the agent realizes the loop is no longer profitable and autonomously unwinds it to a cheaper stablecoin farm.

### How to use Gemini

To implement the Yield Looper in TypeScript using the Gemini API, we’ll focus on the "Brain" and "Verification" layers.

In this setup, Gemini acts as the Analyst. It evaluates the delta between Aave and Morpho, determines the optimal leverage, and outputs a structured "Intent" that your TypeScript execution layer (using viem or ethers.js) can process.

The Logic Flow:
- Fetch Data: Get current Supply/Borrow rates from Aave and Morpho Blue.
- Consult Gemini: Pass rates, risk tolerance, and gas costs to Gemini to calculate the "Looping Profitability."
- Guardrail Check: Ensure the AI's suggested leverage doesn't exceed the protocol's liquidation threshold.
- Execution: Bundle the transactions (Supply -> Borrow -> Swap -> Supply).

## Implementation Steps

For server-side TypeScript

### Dependencies

```shell
npm install @google/generative-ai viem dotenv
```

### Looping Agent Script Template

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import 'dotenv/config';

// 1. Setup Gemini & Blockchain Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const client = createPublicClient({ 
  chain: mainnet, 
  transport: http(process.env.RPC_URL) 
});

// 2. Mock Function to fetch DeFi Rates (Replace with actual Protocol Lens calls)
async function getMarketData() {
  return {
    aave: { supplyAPY: 3.5, borrowAPY: 4.2, ltv: 0.82 },
    morpho: { supplyAPY: 4.1, borrowAPY: 3.8, matchRate: 0.85 },
    ethPrice: 2800,
    gasPriceGwei: 15
  };
}

// 3. The Agentic Reasoning Function
async function analyzeLoopStrategy() {
  const data = await getMarketData();

  const prompt = `
    You are a DeFi Yield Strategist. Analyze the following Ethereum market data:
    - Aave V3 ETH Supply APY: ${data.aave.supplyAPY}%
    - Aave V3 ETH Borrow APY: ${data.aave.borrowAPY}%
    - Morpho Blue Match Rate: ${data.morpho.matchRate * 100}%
    
    Goal: Create a recursive loop by borrowing ETH on Aave and supplying to Morpho.
    Constraints: 
    - Max Leverage: 3x.
    - Liquidation Buffer: Must stay 10% below Aave's LTV of ${data.aave.ltv}.
    
    Return a JSON object only:
    {
      "shouldLoop": boolean,
      "targetLeverage": number,
      "expectedNetYield": number,
      "reasoning": string
    }
  `;

  const result = await model.generateContent(prompt);
  const response = JSON.parse(result.response.text());
  
  return response;
}

// 4. Verification & Execution Guard
async function main() {
  console.log("🚀 Agent starting yield analysis...");
  const decision = await analyzeLoopStrategy();

  if (decision.shouldLoop) {
    console.log(`✅ Strategy Approved: ${decision.reasoning}`);
    
    // GUARDRAIL: Hardcoded check against AI hallucinations
    if (decision.targetLeverage > 3.5) {
      throw new Error("AI attempted to exceed safe leverage limits!");
    }

    console.log(`🛠️ Executing ${decision.targetLeverage}x loop on-chain...`);
    // Here you would trigger your smart contract's 'loop' function
  } else {
    console.log("❌ Strategy Rejected: Market conditions not favorable.");
  }
}

main();
```

### Execution Contract Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFlashLoanSimpleReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IMorpho, MarketParams} from "@morpho-blue/interfaces/IMorpho.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AgenticLooper is IFlashLoanSimpleReceiver {
    IPool public immutable pool;
    IMorpho public immutable morpho;

    constructor(address _pool, address _morpho) {
        pool = IPool(_pool);
        morpho = IMorpho(_morpho);
    }

    // This is called by Aave after it sends us the funds
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // 1. Decode params sent by your Gemini Agent (e.g., Morpho Market ID)
        MarketParams memory marketParams = abi.decode(params, (MarketParams));

        // 2. Supply the Flash Loaned ETH to Morpho Blue
        IERC20(asset).approve(address(morpho), amount);
        morpho.supplyCollateral(marketParams, amount, address(this), "");

        // 3. Borrow back the same amount (plus premium) from Morpho
        // This is where the 'loop' closes
        uint256 amountToRepay = amount + premium;
        morpho.borrow(marketParams, amountToRepay, 0, address(this), address(this));

        // 4. Approve Aave to take the repayment
        IERC20(asset).approve(address(pool), amountToRepay);

        return true;
    }

    function requestLoop(address asset, uint256 amount, bytes calldata params) external {
        pool.flashLoanSimple(address(this), asset, amount, params, 0);
    }
}
```

### Agent Bridge Template

To call the contract:

```typescript
import { encodeAbiParameters, parseAbiParameters } from 'viem';

// ... inside your main() function after Gemini says "shouldLoop: true" ...

async function executeLoopOnChain(decision: any) {
  const marketParams = {
    loanToken: "0xC02aa... (WETH)",
    collateralToken: "0xae7ab... (stETH)",
    oracle: "...",
    irm: "...",
    lltv: 945000000000000000n // 94.5%
  };

  // 1. Encode the market parameters to pass to the Flash Loan
  const encodedParams = encodeAbiParameters(
    parseAbiParameters('address, address, address, address, uint256'),
    [marketParams.loanToken, marketParams.collateralToken, marketParams.oracle, marketParams.irm, marketParams.lltv]
  );

  // 2. Call the contract
  const hash = await walletClient.writeContract({
    address: AGENTIC_LOOPER_ADDRESS,
    abi: AGENTIC_LOOPER_ABI,
    functionName: 'requestLoop',
    args: [marketParams.loanToken, parseEther("10"), encodedParams]
  });

  console.log(`Transaction Sent: ${hash}`);
}
```

### Unwind logic Template

```solidity
// Add this function to your existing AgenticLooper contract
function requestUnwind(address asset, uint256 amountToRepay, bytes calldata params) external {
    // 1. Flash borrow the amount of debt you owe on Morpho
    // This allows you to repay the debt before you've even sold your collateral
    pool.flashLoanSimple(address(this), asset, amountToRepay, params, 0);
}

// Update executeOperation to handle both 'Loop' and 'Unwind' modes
function executeOperation(
    address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params
) external override returns (bool) {
    (bool isUnwind, MarketParams memory marketParams) = abi.decode(params, (bool, MarketParams));

    if (isUnwind) {
        // --- UNWIND LOGIC ---
        // 1. Repay the debt on Morpho using the flash loaned funds
        IERC20(asset).approve(address(morpho), amount);
        morpho.repay(marketParams, amount, 0, address(this), "");

        // 2. Withdraw the newly 'freed' collateral
        // Note: You'd typically swap this collateral back to 'asset' via Uniswap here
        uint256 collateralToWithdraw = // calculate based on debt repaid
        morpho.withdrawCollateral(marketParams, collateralToWithdraw, address(this), address(this));

        // 3. Repay Aave Flash Loan (Original Amount + Premium)
        IERC20(asset).approve(address(pool), amount + premium);
    } else {
        // ... Previous Loop Logic ...
    }
    return true;
}
```

### Gemini Exit Sentinel

For a Gemini agent to monitor the health of the system - and unwind the position

```typescript
async function checkExitConditions(currentPosition: any) {
  const data = await getMarketData();
  
  const prompt = `
    Analyze this active DeFi Looping position:
    - Current Leverage: ${currentPosition.leverage}x
    - Health Factor: ${currentPosition.healthFactor}
    - Net APY: ${currentPosition.netAPY}%
    - Market Volatility (24h): ${data.volatility}%

    Should we unwind this position? 
    Consider: If Health Factor < 1.15 OR Net APY < 0.5%, we must exit.
    
    Return JSON: { "action": "UNWIND" | "HOLD", "reason": "string" }
  `;

  const result = await model.generateContent(prompt);
  const decision = JSON.parse(result.response.text());

  if (decision.action === "UNWIND") {
    await triggerUnwindOnChain(currentPosition.debtAmount);
  }
}
```

## Maths example

### Set-Up

- Initial Capital: 50 ETH.
- Flash Loan Amount: 100 ETH.
- Total Collateral to Deposit: 150 ETH (Initial 50 + Flash 100).
- Asset: $wstETH$ (Yield-bearing staked ETH).

#### Current Market Rates (2026 Estimates)

- $wstETH$ Staking Yield: 3.8% APY.
- Morpho Blue Borrow Rate ($ETH$): 2.2% APY.
- Aave Flash Loan Fee: 0.05% (One-time).
- LTV (Loan to Value) on Morpho: 94.5% (Very efficient).

#### Step 1: The Flash Loan Cost

Aave takes its cut the moment you borrow.

$$Cost_{flash} = 100\text{ ETH} \times 0.0005 = 0.05\text{ ETH}$$

(At $2,800/ETH, this is roughly $140).

#### Step 2: The Morpho Position

You deposit 150 ETH into Morpho Blue. You now owe Aave 100.05 ETH.To repay Aave, you borrow against your 150 ETH collateral on Morpho.

- Debt Created: 100.05 ETH.
- Health Factor Calculation:

$$HF = \frac{\text{Collateral} \times \text{LLTV}}{\text{Debt}} = \frac{150 \times 0.945}{100.05} \approx 1.41$$

(A Health Factor of 1.41 is very safe in ETH/ETH pairs where price correlation is near 1:1).


#### Net APY on Initial Capital

You only put in 50 ETH to get 3.499 ETH in profit.

$$\text{Return on Equity (ROE)} = \frac{3.499}{50} = 6.99\% \text{ APY}$$

(By looping, you increased your staking yield from 3.8% to ~7.0%).

## Risk Analysis

### 1. Smart Contract Risk (High)

**The Threat:** The code is unaudited. A bug in `executeOperation` could lead to a "Locked Position" (unable to withdraw collateral) or a "Flash Loan Leak" (losing the entire 100 ETH).

**Mitigation:**
- **Audit:** Use only audited Looper contracts (e.g., from Morpho Blue's official examples or audited third-party vaults).
- **Small Bets:** Start with 1 ETH until you trust the contract.

### 2. Oracle Risk (Medium)

**The Threat:** If the price of $wstETH$ suddenly drops (e.g., "de-pegs" from ETH), your Health Factor will crash instantly.

**Mitigation:**
- **Correlation:** Only loop assets with >99% correlation (ETH/wstETH, WBTC/renBTC).
- **Circuit Breakers:** Implement a hard stop if the price difference between the asset and its wrapped version exceeds 2%.

### 3. Liquidation Risk (Medium)

**The Threat:** If the price of $wstETH$ drops 5% against ETH, your Health Factor drops to ~1.34. If it drops 10%, you are liquidated.

**Mitigation:**
- **Safety Buffer:** Maintain a Health Factor > 1.5 (not 1.1). This gives you a 50% buffer against price drops.
- **Auto-Unwind:** Use the Gemini Sentinel to monitor and automatically unwind the position before it hits 1.1.

### Break-even logic

| Expense Item | Cost (ETH) | Cost (USD) |
| :--- | :--- | :--- |
| Flash Loan Fee | 0.05 ETH | $140 |
| Gas (Looping Contract) | ~0.02 ETH | $56 |
| **Total Entry Cost** | **0.07 ETH** | **$196** |


The Breakeven Math:
- Daily Profit: $3.499 \text{ ETH} / 365 = 0.00958 \text{ ETH/day}$.
- Days to Breakeven: $0.07 / 0.00958 \approx \mathbf{7.3 \text{ days}}$.

Agent Logic: If Gemini predicts that the yield spread between $wstETH$ and $ETH$ borrowing will collapse within the next 7 days, it should REJECT the trade because you won't recover the gas and flash fees.

## Testing

### Anvil

The best way to test this is to fork mainnet:

```bash
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY \
      --fork-block-number 21000000 \
      --chain-id 1
```

Funding:

```bash
cast rpc anvil_setBalance 0xYourAgentAddress 0x3635c9adc5dea000000 # Sets balance to 1000 ETH
```

### Hardhat

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 21000000, // Always pin for reproducibility!
      },
    },
  },
};

export default config;
```

```typescript
import { helpers } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function setupTestFunds(agentAddress: string) {
  const WHALE_ADDRESS = "0x0000... (find a big ETH holder)";
  
  // 1. Impersonate the account
  await helpers.impersonateAccount(WHALE_ADDRESS);
  const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);

  // 2. Send 50 ETH to your Agent
  await whaleSigner.sendTransaction({
    to: agentAddress,
    value: ethers.parseEther("50"),
  });
  
  console.log("💰 Agent funded with 50 test ETH from Whale!");
}
```