/**
 * Deployment script for the on-chain MultisigWallet contracts.
 *
 * Usage with Hardhat:
 *   npx hardhat run contracts/scripts/deploy.ts --network monadTestnet
 *
 * Usage with Foundry (forge script):
 *   forge script contracts/scripts/Deploy.s.sol --rpc-url $RPC_URL --broadcast
 *
 * Environment variables:
 *   DEPLOYER_PRIVATE_KEY - Private key of the deployer account
 *   RPC_URL              - RPC endpoint for the target network
 */

import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // 1. Deploy MultisigFactory
    console.log("\n--- Deploying MultisigFactory ---");
    const MultisigFactory = await ethers.getContractFactory("MultisigFactory");
    const factory = await MultisigFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("MultisigFactory deployed to:", factoryAddress);

    // 2. (Optional) Deploy a sample MultisigWallet via the factory
    const signers = [deployer.address];
    const threshold = 1;
    const proposalTTL = 7 * 24 * 60 * 60; // 7 days

    console.log("\n--- Creating sample MultisigWallet via factory ---");
    const tx = await factory.createWallet(
        "Sample Multisig",
        signers,
        threshold,
        proposalTTL
    );
    const receipt = await tx.wait();

    // Parse the WalletDeployed event to get the wallet address
    const walletDeployedEvent = receipt?.logs.find((log: any) => {
        try {
            const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
            return parsed?.name === "WalletDeployed";
        } catch {
            return false;
        }
    });

    if (walletDeployedEvent) {
        const parsed = factory.interface.parseLog({
            topics: walletDeployedEvent.topics as string[],
            data: walletDeployedEvent.data,
        });
        console.log("Sample MultisigWallet deployed to:", parsed?.args.wallet);
    }

    // Summary
    console.log("\n========================================");
    console.log("Deployment Summary");
    console.log("========================================");
    console.log("MultisigFactory:", factoryAddress);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());
    console.log("========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
