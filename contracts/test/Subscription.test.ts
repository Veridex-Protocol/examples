import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('VeridexSubscriptionManager', function () {
    async function deploySubscriptionFixture() {
        const [owner, serviceProvider, subscriber, otherAccount] = await ethers.getSigners();

        // Deploy mock ERC20 token
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const mockToken = await MockERC20.deploy('Test USDC', 'USDC', 6);
        await mockToken.waitForDeployment();

        // Mint tokens to subscriber
        await mockToken.mint(subscriber.address, ethers.parseUnits('10000', 6));

        // Deploy SubscriptionManager
        const SubscriptionManager = await ethers.getContractFactory('VeridexSubscriptionManager');
        const subscription = await SubscriptionManager.deploy();
        await subscription.waitForDeployment();

        return { subscription, mockToken, owner, serviceProvider, subscriber, otherAccount };
    }

    describe('Plan Creation', function () {
        it('Should create a subscription plan', async function () {
            const { subscription, mockToken, serviceProvider } = await loadFixture(deploySubscriptionFixture);
            
            await subscription.connect(serviceProvider).createPlan(
                'Basic Plan',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6), // 10 USDC
                30 * 24 * 60 * 60, // 30 days
                7 * 24 * 60 * 60, // 7 day trial
                3 * 24 * 60 * 60 // 3 day grace period
            );

            const plan = await subscription.getPlan(1);
            expect(plan.name).to.equal('Basic Plan');
            expect(plan.provider).to.equal(serviceProvider.address);
            expect(plan.price).to.equal(ethers.parseUnits('10', 6));
            expect(plan.isActive).to.be.true;
        });

        it('Should emit PlanCreated event', async function () {
            const { subscription, mockToken, serviceProvider } = await loadFixture(deploySubscriptionFixture);
            
            await expect(subscription.connect(serviceProvider).createPlan(
                'Basic Plan',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6),
                30 * 24 * 60 * 60,
                0,
                0
            ))
                .to.emit(subscription, 'PlanCreated')
                .withArgs(1, serviceProvider.address, 'Basic Plan', ethers.parseUnits('10', 6));
        });

        it('Should allow creating ETH-based plans', async function () {
            const { subscription, serviceProvider } = await loadFixture(deploySubscriptionFixture);
            
            await subscription.connect(serviceProvider).createPlan(
                'ETH Plan',
                ethers.ZeroAddress, // ETH
                ethers.parseEther('0.01'),
                30 * 24 * 60 * 60,
                0,
                0
            );

            const plan = await subscription.getPlan(1);
            expect(plan.token).to.equal(ethers.ZeroAddress);
        });
    });

    describe('Subscription Lifecycle', function () {
        async function setupPlanFixture() {
            const { subscription, mockToken, owner, serviceProvider, subscriber, otherAccount } = 
                await loadFixture(deploySubscriptionFixture);
            
            // Create a plan
            await subscription.connect(serviceProvider).createPlan(
                'Basic Plan',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6),
                30 * 24 * 60 * 60, // 30 days
                7 * 24 * 60 * 60, // 7 day trial
                3 * 24 * 60 * 60 // 3 day grace period
            );

            return { subscription, mockToken, owner, serviceProvider, subscriber, otherAccount };
        }

        it('Should allow user to subscribe with trial', async function () {
            const { subscription, mockToken, serviceProvider, subscriber } = 
                await loadFixture(setupPlanFixture);
            
            await subscription.connect(subscriber).subscribe(1);

            const sub = await subscription.getSubscription(subscriber.address, 1);
            expect(sub.isActive).to.be.true;
            expect(sub.planId).to.equal(1);
        });

        it('Should emit Subscribed event', async function () {
            const { subscription, subscriber } = await loadFixture(setupPlanFixture);
            
            await expect(subscription.connect(subscriber).subscribe(1))
                .to.emit(subscription, 'Subscribed')
                .withArgs(subscriber.address, 1);
        });

        it('Should correctly handle trial period', async function () {
            const { subscription, subscriber } = await loadFixture(setupPlanFixture);
            
            await subscription.connect(subscriber).subscribe(1);
            
            // During trial, subscription should be active
            let isActive = await subscription.isSubscriptionActive(subscriber.address, 1);
            expect(isActive).to.be.true;

            // After trial + period + grace, should be inactive
            await time.increase(7 * 24 * 60 * 60 + 30 * 24 * 60 * 60 + 4 * 24 * 60 * 60);
            isActive = await subscription.isSubscriptionActive(subscriber.address, 1);
            expect(isActive).to.be.false;
        });

        it('Should allow renewal payment', async function () {
            const { subscription, mockToken, serviceProvider, subscriber } = 
                await loadFixture(setupPlanFixture);
            
            await subscription.connect(subscriber).subscribe(1);
            
            // Approve tokens for renewal
            await mockToken.connect(subscriber).approve(
                await subscription.getAddress(), 
                ethers.parseUnits('10', 6)
            );

            // Fast forward past trial
            await time.increase(8 * 24 * 60 * 60);
            
            // Renew
            await subscription.connect(subscriber).renewSubscription(subscriber.address, 1);

            const sub = await subscription.getSubscription(subscriber.address, 1);
            expect(sub.isActive).to.be.true;
        });

        it('Should transfer funds to provider on renewal', async function () {
            const { subscription, mockToken, serviceProvider, subscriber } = 
                await loadFixture(setupPlanFixture);
            
            await subscription.connect(subscriber).subscribe(1);
            await mockToken.connect(subscriber).approve(
                await subscription.getAddress(), 
                ethers.parseUnits('10', 6)
            );

            const providerBalanceBefore = await mockToken.balanceOf(serviceProvider.address);
            
            await time.increase(8 * 24 * 60 * 60);
            await subscription.connect(subscriber).renewSubscription(subscriber.address, 1);

            const providerBalanceAfter = await mockToken.balanceOf(serviceProvider.address);
            expect(providerBalanceAfter - providerBalanceBefore).to.equal(ethers.parseUnits('10', 6));
        });

        it('Should allow user to cancel subscription', async function () {
            const { subscription, subscriber } = await loadFixture(setupPlanFixture);
            
            await subscription.connect(subscriber).subscribe(1);
            await subscription.connect(subscriber).cancelSubscription(1);

            const sub = await subscription.getSubscription(subscriber.address, 1);
            expect(sub.isActive).to.be.false;
        });

        it('Should emit SubscriptionCancelled event', async function () {
            const { subscription, subscriber } = await loadFixture(setupPlanFixture);
            
            await subscription.connect(subscriber).subscribe(1);
            
            await expect(subscription.connect(subscriber).cancelSubscription(1))
                .to.emit(subscription, 'SubscriptionCancelled')
                .withArgs(subscriber.address, 1);
        });
    });

    describe('Plan Management', function () {
        it('Should allow provider to deactivate plan', async function () {
            const { subscription, mockToken, serviceProvider } = await loadFixture(deploySubscriptionFixture);
            
            await subscription.connect(serviceProvider).createPlan(
                'Basic Plan',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6),
                30 * 24 * 60 * 60,
                0,
                0
            );

            await subscription.connect(serviceProvider).deactivatePlan(1);

            const plan = await subscription.getPlan(1);
            expect(plan.isActive).to.be.false;
        });

        it('Should prevent non-provider from deactivating plan', async function () {
            const { subscription, mockToken, serviceProvider, otherAccount } = 
                await loadFixture(deploySubscriptionFixture);
            
            await subscription.connect(serviceProvider).createPlan(
                'Basic Plan',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6),
                30 * 24 * 60 * 60,
                0,
                0
            );

            await expect(subscription.connect(otherAccount).deactivatePlan(1))
                .to.be.revertedWith('Not plan provider');
        });

        it('Should prevent subscribing to inactive plan', async function () {
            const { subscription, mockToken, serviceProvider, subscriber } = 
                await loadFixture(deploySubscriptionFixture);
            
            await subscription.connect(serviceProvider).createPlan(
                'Basic Plan',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6),
                30 * 24 * 60 * 60,
                0,
                0
            );

            await subscription.connect(serviceProvider).deactivatePlan(1);

            await expect(subscription.connect(subscriber).subscribe(1))
                .to.be.revertedWith('Plan not active');
        });
    });

    describe('ETH Subscriptions', function () {
        it('Should handle ETH-based subscriptions', async function () {
            const { subscription, serviceProvider, subscriber } = 
                await loadFixture(deploySubscriptionFixture);
            
            // Create ETH plan
            await subscription.connect(serviceProvider).createPlan(
                'ETH Plan',
                ethers.ZeroAddress,
                ethers.parseEther('0.01'),
                30 * 24 * 60 * 60,
                0,
                0
            );

            // Subscribe (free for first period if no trial requirement)
            await subscription.connect(subscriber).subscribe(1);

            // Renew with ETH
            const providerBalanceBefore = await ethers.provider.getBalance(serviceProvider.address);
            
            await subscription.connect(subscriber).renewSubscription(
                subscriber.address, 
                1,
                { value: ethers.parseEther('0.01') }
            );

            const providerBalanceAfter = await ethers.provider.getBalance(serviceProvider.address);
            expect(providerBalanceAfter - providerBalanceBefore).to.equal(ethers.parseEther('0.01'));
        });
    });

    describe('Multiple Subscriptions', function () {
        it('Should allow user to have multiple subscriptions', async function () {
            const { subscription, mockToken, serviceProvider, subscriber } = 
                await loadFixture(deploySubscriptionFixture);
            
            // Create multiple plans
            await subscription.connect(serviceProvider).createPlan(
                'Basic',
                await mockToken.getAddress(),
                ethers.parseUnits('10', 6),
                30 * 24 * 60 * 60,
                0,
                0
            );
            
            await subscription.connect(serviceProvider).createPlan(
                'Premium',
                await mockToken.getAddress(),
                ethers.parseUnits('50', 6),
                30 * 24 * 60 * 60,
                0,
                0
            );

            await subscription.connect(subscriber).subscribe(1);
            await subscription.connect(subscriber).subscribe(2);

            expect(await subscription.isSubscriptionActive(subscriber.address, 1)).to.be.true;
            expect(await subscription.isSubscriptionActive(subscriber.address, 2)).to.be.true;
        });
    });
});
