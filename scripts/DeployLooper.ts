import hre from "hardhat";

async function main() {
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Deploying AgenticLooper with account:", deployer.account.address);

    // Aave V3 Pool addresses on Ethereum Mainnet
    const AAVE_V3_POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Ethereum Mainnet
    // Morpho Blue address on Ethereum Mainnet
    const MORPHO_BLUE_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"; // Ethereum Mainnet

    const looper = await hre.viem.deployContract("AgenticLooper", [AAVE_V3_POOL_ADDRESS, MORPHO_BLUE_ADDRESS]);

    console.log("AgenticLooper deployed to:", looper.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

