import { ethers } from 'hardhat';

async function main() {
    console.log('🚀 Deploying Veridex Payment Gateway\n');

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Deploy PaymentGateway with deployer as initial owner
    console.log('📦 Deploying PaymentGateway contract...');
    const PaymentGateway = await ethers.getContractFactory('VeridexPaymentGateway');
    const gateway = await PaymentGateway.deploy(deployer.address);
    
    await gateway.waitForDeployment();
    const address = await gateway.getAddress();
    
    console.log(`✅ PaymentGateway deployed to: ${address}`);

    // Verify initial state
    const protocolFee = await gateway.protocolFeeBps();
    const owner = await gateway.owner();
    
    console.log(`\n📊 Contract State:`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Protocol Fee: ${protocolFee} bps (${Number(protocolFee) / 100}%)`);

    // Example: Register a test merchant
    console.log('\n🏪 Registering test merchant...');
    
    const testMerchant = {
        name: 'Test Store',
        vaultAddress: deployer.address, // Using deployer as vault for testing
        feeBps: 0, // No additional merchant fee
    };

    const tx = await gateway.registerMerchant(
        testMerchant.name,
        testMerchant.vaultAddress,
        testMerchant.feeBps
    );
    await tx.wait();

    const merchantInfo = await gateway.getMerchant(deployer.address);
    console.log(`   ✅ Merchant registered: ${merchantInfo.name}`);
    console.log(`   Vault: ${merchantInfo.vaultAddress}`);
    console.log(`   Total Volume: ${ethers.formatEther(merchantInfo.totalVolume)} ETH`);

    // Save deployment info
    const network = await ethers.provider.getNetwork();
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        contract: 'PaymentGateway',
        address: address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };

    console.log('\n📋 Deployment Info:');
    console.log(JSON.stringify(deploymentInfo, null, 2));

    return address;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
