import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AgenticLooper", function () {
    async function deployLooperFixture() {
        const [owner] = await hre.viem.getWalletClients();

        const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
        const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

        const looper = await hre.viem.deployContract("AgenticLooper", [AAVE_POOL, MORPHO_BLUE]);
        return { looper, owner, AAVE_POOL, MORPHO_BLUE };
    }

    it("Should set the correct owner", async function () {
        const { looper, owner } = await loadFixture(deployLooperFixture);
        expect((await looper.read.owner() as string).toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("Should set the correct Aave Pool address", async function () {
        const { looper, AAVE_POOL } = await loadFixture(deployLooperFixture);
        expect((await looper.read.pool() as string).toLowerCase()).to.equal(AAVE_POOL.toLowerCase());
    });
});

