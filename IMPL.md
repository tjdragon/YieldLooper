# YieldLooper Implementation Plan

The YieldLooper architecture is decoupled into three main layers: **Reasoning**, **Verification**, and **Execution**. To build this, you should follow these implementation steps:

1. **Deploy the Smart Contract (Execution Layer)**
   * Deploy the `AgenticLooper` Solidity contract to Ethereum mainnet (or a testnet).
   * This contract implements the actual looping logic: it takes a flash loan from Aave, supplies it as collateral to Morpho Blue, borrows against it on Morpho, and repays the Aave flash loan, effectively creating leveraged yield.
   * It also needs an unwind function to reverse the process when market conditions degrade.

2. **Build the Reasoning Engine (The Brain)**
   * Develop a Node.js/TypeScript service and integrate the Google Gemini API.
   * Build a mechanism to fetch live APY rates, match rates, and volatility data from Aave V3 and Morpho.
   * Construct a prompt that feeds this real-time market data to Gemini. The model will analyze the data, determine if the yield spread is profitable, calculate the optimal leverage (e.g., up to 3x), and output a structured JSON "Intent" (e.g., `{"shouldLoop": true, "targetLeverage": 2.5}`).

3. **Implement the Verification Guardrails (The Filter)**
   * In your TypeScript service, add a hardcoded Policy Engine that intercepts Gemini's intent before execution.
   * Enforce strict rules to prevent AI hallucinations: check that the target leverage doesn't exceed 3.0x, ensure the Health Factor remains above a safe threshold (e.g., > 1.15), and ensure the transaction break-even time makes sense considering gas and flash loan fees.

4. **Construct the Execution Script (The Wallet)**
   * Use a library like `viem` to take the verified "Intent" and encode the transaction parameters.
   * Use an execution wallet (like a DFNS API Service Account) to sign and broadcast the transaction to the deployed `AgenticLooper` contract, triggering the `requestLoop` or `requestUnwind` functions.

5. **Local Testing & Simulation**
   * Before risking real funds, use tools like Hardhat or Foundry (Anvil) to fork the Ethereum mainnet state.
   * Simulate the entire flow locally to ensure the AI's logic, the guardrails, and the smart contract all behave safely under realistic conditions.

---

## Required External Services & API Keys

To bring this architecture to life, you will need the following API keys and external services:

1. **`GEMINI_API_KEY` (Google AI Studio)**
   * **Purpose**: Powers the Reasoning Layer. Used to call `gemini-2.5-flash` so the AI can compute the "Looping Profitability" and decide whether to enter or unwind a position.

2. **`RPC_URL` / `ALCHEMY_KEY` (Alchemy, Infura, etc.)**
   * **Purpose**: Essential for the Execution Layer and Testing.
   * **Usage**: Required to fetch real-time market rates directly from the blockchain (if you aren't using an off-chain API), to broadcast actual transactions, and to fork the Ethereum Mainnet during your Hardhat/Anvil testing phase.

3. **DFNS API Credentials**
   * **Purpose**: Mentioned in the Architecture section ("Use DFNS API Service Account to sign and broadcast transactions").
   * **Usage**: You will need DFNS API keys/credentials to securely manage the private keys and sign the execution transactions in a production environment rather than relying on local raw private keys.

4. **(Implied) Market Data Providers**
   * While the mock code uses a fake `getMarketData()` function, a production agent requires accurate data. You may need API access to data providers (or rely heavily on your RPC node) to fetch real-time ETH prices, Gas prices (Gwei), Aave V3 rates, and Morpho Blue's P2P Match rates.
