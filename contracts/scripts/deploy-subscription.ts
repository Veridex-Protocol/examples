import { ethers } from 'hardhat';

async function main() {
    console.log('START Deploying Veridex Subscription Manager\n');

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Deploy SubscriptionManager
    console.log('PACKAGE Deploying SubscriptionManager contract...');
    const SubscriptionManager = await ethers.getContractFactory('VeridexSubscriptionManager');
    const subscription = await SubscriptionManager.deploy();
    
    await subscription.waitForDeployment();
    const address = await subscription.getAddress();
    
    console.log(`OK SubscriptionManager deployed to: ${address}`);

    // Create some example plans
    console.log('\nNOTE Creating example subscription plans...');

    // Basic Plan - 0.01 ETH/month, 7 day trial
    const basicPlanTx = await subscription.createPlan(
        'Basic Plan',
        ethers.ZeroAddress, // ETH
        ethers.parseEther('0.01'),
        30 * 24 * 60 * 60, // 30 days
        7 * 24 * 60 * 60, // 7 day trial
        3 * 24 * 60 * 60 // 3 day grace period
    );
    await basicPlanTx.wait();
    console.log('   OK Basic Plan created');

    // Pro Plan - 0.05 ETH/month, 14 day trial
    const proPlanTx = await subscription.createPlan(
        'Pro Plan',
        ethers.ZeroAddress, // ETH
        ethers.parseEther('0.05'),
        30 * 24 * 60 * 60, // 30 days
        14 * 24 * 60 * 60, // 14 day trial
        5 * 24 * 60 * 60 // 5 day grace period
    );
    await proPlanTx.wait();
    console.log('   OK Pro Plan created');

    // Enterprise Plan - 0.2 ETH/month, no trial
    const enterprisePlanTx = await subscription.createPlan(
        'Enterprise Plan',
        ethers.ZeroAddress, // ETH
        ethers.parseEther('0.2'),
        30 * 24 * 60 * 60, // 30 days
        0, // No trial
        7 * 24 * 60 * 60 // 7 day grace period
    );
    await enterprisePlanTx.wait();
    console.log('   OK Enterprise Plan created');

    // Verify plans
    const planCount = await subscription.planCount();
    console.log(`\n Total Plans Created: ${planCount}`);

    for (let i = 1; i <= Number(planCount); i++) {
        const plan = await subscription.getPlan(i);
        console.log(`\n   Plan ${i}: ${plan.name}`);
        console.log(`   Price: ${ethers.formatEther(plan.price)} ETH`);
        console.log(`   Period: ${Number(plan.period) / (24 * 60 * 60)} days`);
        console.log(`   Trial: ${Number(plan.trialPeriod) / (24 * 60 * 60)} days`);
    }

    // Save deployment info
    const network = await ethers.provider.getNetwork();
    console.log('\nNOTE Deployment Info:');
    console.log(JSON.stringify({
        network: network.name,
        chainId: network.chainId.toString(),
        contract: 'SubscriptionManager',
        address: address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    }, null, 2));

    return address;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
