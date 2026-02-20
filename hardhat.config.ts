import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    networks: {
        hardhat: {
            type: "edr-simulated",
            chainType: "l1",
            forking: {
                url: process.env.ALCHEMY_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/your-api-key",
                // Pin to a specific block for consistent tests
                blockNumber: 21000000,
            },
        },
    },
};

export default config;
