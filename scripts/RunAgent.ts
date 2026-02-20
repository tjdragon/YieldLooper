import { getMarketData } from '../src/MarketData.js';
import { Brain } from '../src/Brain.js';
import { Filter } from '../src/Filter.js';
import { Wallet } from '../src/Wallet.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Usually, the contract is deployed already. For the demo:
const AGENTIC_LOOPER_ADDRESS = "0x1234567890123456789012345678901234567890";

async function main() {
    console.log("🚀 Initializing YieldLooper Agent...");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY must be provided in .env");
    }

    try {
        // 1. Fetch real-time market data
        console.log("📊 Fetching market data...");
        const marketData = await getMarketData();
        console.log(`- Aave APY: ${marketData.aave.supplyAPY}% Supply / ${marketData.aave.borrowAPY}% Borrow`);
        console.log(`- Morpho Match: ${marketData.morpho.matchRate * 100}%`);

        // 2. Pass to Gemini for Reasoning
        console.log("🧠 Sending data to Gemini for reasoning...");
        const brain = new Brain(apiKey);
        const intent = await brain.analyzeLoopStrategy(marketData);

        console.log("AI Intent Received:", JSON.stringify(intent, null, 2));

        // 3. Verify Guardrails via Policy Engine
        console.log("🛡️ Running Intent through Policy Engine...");
        const filter = new Filter();
        filter.validateIntent(intent);

        // 4. Execute approved Intent on-chain using DFNS Wallet
        if (intent.shouldLoop) {
            console.log("🔐 Triggering DFNS Wallet execution...");
            const wallet = new Wallet();
            await wallet.executeLoop(intent, AGENTIC_LOOPER_ADDRESS);
            console.log("✅ Loop Strategy Successfully Initiated.");
        } else {
            console.log("🛑 Agent decided not to loop based on current market conditions. Waiting for better yield spread.");
        }

    } catch (error: any) {
        console.error("❌ Agent execution failed:", error.message);
        process.exitCode = 1;
    }
}

main();
