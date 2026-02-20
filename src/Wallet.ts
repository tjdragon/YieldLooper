import { DfnsApiClient } from '@dfns/sdk';
import { AsymmetricKeySigner } from '@dfns/sdk-keysigner';
import { createPublicClient, http, encodeFunctionData, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import * as dotenv from 'dotenv';
import { Intent } from './Filter.js';

dotenv.config();

export class Wallet {
    private dfnsApi: DfnsApiClient;
    private walletId: string;
    private client: any;

    constructor() {
        if (!process.env.DFNS_CRED_ID || !process.env.DFNS_PRIVATE_KEY || !process.env.DFNS_ORG_ID || !process.env.DFNS_AUTH_TOKEN) {
            throw new Error("DFNS credentials not fully configured in .env");
        }

        const signer = new AsymmetricKeySigner({
            credId: process.env.DFNS_CRED_ID,
            privateKey: process.env.DFNS_PRIVATE_KEY,
        });

        this.dfnsApi = new DfnsApiClient({
            orgId: process.env.DFNS_ORG_ID,
            authToken: process.env.DFNS_AUTH_TOKEN,
            baseUrl: process.env.DFNS_API_URL || 'https://api.dfns.io',
            signer,
        });

        // Use environment variable, fallback to user's requested ID
        this.walletId = process.env.DFNS_WALLET_ID || 'wa-01jfg-blq4o-e2goi75iorinhv3q';

        this.client = createPublicClient({
            chain: mainnet,
            transport: http(process.env.ALCHEMY_RPC_URL)
        });
    }

    async executeLoop(intent: Intent, contractAddress: string) {
        console.log(`[Wallet] Preparing execution for AgenticLooper at ${contractAddress}...`);

        // ABI for AgenticLooper 
        const abi = parseAbi([
            'function requestLoop(address asset, uint256 amount, bytes calldata params) external',
            'function requestUnwind(address asset, uint256 amountToRepay, bytes calldata params) external'
        ]);

        // For the demo, we construct the mock arguments
        // WETH on Mainnet
        const asset = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        // Example 10 WETH
        const amount = 10000000000000000000n;

        // The "params" would be the encodeAbiParameters of a Morpho MarketParams + boolean for Unwind.
        // For this simple template, passing empty bytes as a placeholder.
        const params = "0x" as `0x${string}`;

        const functionName = intent.shouldLoop ? 'requestLoop' : 'requestUnwind';

        console.log(`[Wallet] Encoding function data for ${functionName}...`);

        const data = encodeFunctionData({
            abi,
            functionName,
            args: [asset, amount, params],
        });

        const transaction = {
            kind: "Eip1559",
            to: contractAddress,
            data,
        };

        console.log(`[Wallet] Broadcasting transaction through DFNS Vault (${this.walletId})... payload:`, JSON.stringify(transaction));

        // Only perform the broadcast on the actual mainnet if we want to risk real funds. 
        // In Hardhat forking, we would use local viem/ethers.

        try {
            const result = await this.dfnsApi.wallets.broadcastTransaction({
                walletId: this.walletId,
                body: transaction as any
            });

            console.log("[Wallet] Transaction broadcast request sent. Tracking ID:", result.id);

            if (result.txHash) {
                console.log("[Wallet] Transaction Hash:", result.txHash);
                return result.txHash;
            }

            return result.id;
        } catch (e: any) {
            console.error("[Wallet] Transaction failed via DFNS:", e?.message || e);
            throw e;
        }
    }
}
