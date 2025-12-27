import { ethers } from 'hardhat';

async function main() {
    console.log('START Deploying Veridex Example Contracts\n');
    console.log('='.repeat(50));

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

    const deployments: Record<string, string> = {};

    // =========================================================================
    // 1. Deploy Payment Gateway
    // =========================================================================
    
    console.log('PACKAGE Deploying PaymentGateway...');
    const PaymentGateway = await ethers.getContractFactory('VeridexPaymentGateway');
    const gateway = await PaymentGateway.deploy(deployer.address);
    await gateway.waitForDeployment();
    deployments['PaymentGateway'] = await gateway.getAddress();
    console.log(`   OK PaymentGateway: ${deployments['PaymentGateway']}`);

    // =========================================================================
    // 2. Deploy NFT Gated Access
    // =========================================================================
    
    console.log('PACKAGE Deploying NFTGatedAccess...');
    const NFTGatedAccess = await ethers.getContractFactory('VeridexNFTGatedAccess');
    const nftAccess = await NFTGatedAccess.deploy();
    await nftAccess.waitForDeployment();
    deployments['NFTGatedAccess'] = await nftAccess.getAddress();
    console.log(`   OK NFTGatedAccess: ${deployments['NFTGatedAccess']}`);

    // =========================================================================
    // 3. Deploy Subscription Manager
    // =========================================================================
    
    console.log('PACKAGE Deploying SubscriptionManager...');
    const SubscriptionManager = await ethers.getContractFactory('VeridexSubscriptionManager');
    const subscription = await SubscriptionManager.deploy();
    await subscription.waitForDeployment();
    deployments['SubscriptionManager'] = await subscription.getAddress();
    console.log(`   OK SubscriptionManager: ${deployments['SubscriptionManager']}`);

    // =========================================================================
    // 4. Deploy Cross-Chain Escrow
    // =========================================================================
    
    console.log('PACKAGE Deploying CrossChainEscrow...');
    
    // Wormhole Core Bridge addresses
    const wormholeAddresses: Record<string, string> = {
        '84532': '0x79A1027a6A159502049F10906D333EC57E95F083', // Base Sepolia
        '11155420': '0x31377888146f3253211EFEf5c676D41ECe7D58Fe', // Optimism Sepolia
        '421614': '0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35', // Arbitrum Sepolia
    };
    
    const chainIds: Record<string, number> = {
        '84532': 10004,
        '11155420': 10005,
        '421614': 10003,
    };

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId.toString();
    const wormholeAddress = wormholeAddresses[chainId] || ethers.ZeroAddress;
    const wormholeChainId = chainIds[chainId] || 0;

    const CrossChainEscrow = await ethers.getContractFactory('VeridexCrossChainEscrow');
    const escrow = await CrossChainEscrow.deploy(
        wormholeAddress,
        wormholeChainId,
        deployer.address
    );
    await escrow.waitForDeployment();
    deployments['CrossChainEscrow'] = await escrow.getAddress();
    console.log(`   OK CrossChainEscrow: ${deployments['CrossChainEscrow']}`);

    // =========================================================================
    // Summary
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE DEPLOYMENT SUMMARY');
    console.log('='.repeat(50));
    console.log(`\nNetwork: ${network.name} (Chain ID: ${chainId})`);
    console.log('\nContracts:');
    for (const [name, address] of Object.entries(deployments)) {
        console.log(`   ${name}: ${address}`);
    }

    // Save deployment addresses
    const fs = await import('fs');
    const deploymentsPath = `./deployments/${network.name}.json`;
    
    // Ensure directory exists
    const dir = './deployments';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentsPath, JSON.stringify({
        network: network.name,
        chainId: chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: deployments,
    }, null, 2));

    console.log(`\nOK Deployment addresses saved to ${deploymentsPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
