import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('VeridexPaymentGateway', function () {
    async function deployPaymentGatewayFixture() {
        const [owner, merchant, customer, otherAccount] = await ethers.getSigners();

        // Deploy mock ERC20 token
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const mockToken = await MockERC20.deploy('Test USDC', 'USDC', 6);
        await mockToken.waitForDeployment();

        // Mint tokens to customer
        await mockToken.mint(customer.address, ethers.parseUnits('10000', 6));

        // Deploy PaymentGateway
        const PaymentGateway = await ethers.getContractFactory('VeridexPaymentGateway');
        const gateway = await PaymentGateway.deploy(owner.address);
        await gateway.waitForDeployment();

        return { gateway, mockToken, owner, merchant, customer, otherAccount };
    }

    describe('Deployment', function () {
        it('Should set the right owner', async function () {
            const { gateway, owner } = await loadFixture(deployPaymentGatewayFixture);
            expect(await gateway.owner()).to.equal(owner.address);
        });

        it('Should have correct initial protocol fee', async function () {
            const { gateway } = await loadFixture(deployPaymentGatewayFixture);
            expect(await gateway.protocolFeeBps()).to.equal(50); // 0.5%
        });
    });

    describe('Merchant Registration', function () {
        it('Should allow merchant registration', async function () {
            const { gateway, merchant } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant(
                'Test Store',
                merchant.address,
                100 // 1% merchant fee
            );

            const merchantInfo = await gateway.getMerchant(merchant.address);
            expect(merchantInfo.name).to.equal('Test Store');
            expect(merchantInfo.vaultAddress).to.equal(merchant.address);
            expect(merchantInfo.isActive).to.be.true;
        });

        it('Should emit MerchantRegistered event', async function () {
            const { gateway, merchant } = await loadFixture(deployPaymentGatewayFixture);
            
            await expect(gateway.connect(merchant).registerMerchant(
                'Test Store',
                merchant.address,
                100
            ))
                .to.emit(gateway, 'MerchantRegistered')
                .withArgs(merchant.address, 'Test Store', merchant.address);
        });

        it('Should prevent duplicate registration', async function () {
            const { gateway, merchant } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            
            await expect(
                gateway.connect(merchant).registerMerchant('Another Store', merchant.address, 0)
            ).to.be.revertedWith('Merchant already registered');
        });
    });

    describe('Invoice Creation', function () {
        it('Should create invoice with correct parameters', async function () {
            const { gateway, mockToken, merchant, customer } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            
            const amount = ethers.parseUnits('100', 6);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const reference = ethers.encodeBytes32String('INV-001');

            await gateway.connect(merchant).createInvoice(
                customer.address,
                await mockToken.getAddress(),
                amount,
                deadline,
                reference
            );

            const invoice = await gateway.getInvoice(1);
            expect(invoice.merchant).to.equal(merchant.address);
            expect(invoice.customer).to.equal(customer.address);
            expect(invoice.amount).to.equal(amount);
            expect(invoice.isPaid).to.be.false;
        });

        it('Should emit InvoiceCreated event', async function () {
            const { gateway, mockToken, merchant, customer } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            
            const amount = ethers.parseUnits('100', 6);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const reference = ethers.encodeBytes32String('INV-001');

            await expect(gateway.connect(merchant).createInvoice(
                customer.address,
                await mockToken.getAddress(),
                amount,
                deadline,
                reference
            ))
                .to.emit(gateway, 'InvoiceCreated')
                .withArgs(1, merchant.address, customer.address, amount);
        });
    });

    describe('Invoice Payment', function () {
        async function createInvoiceFixture() {
            const { gateway, mockToken, owner, merchant, customer, otherAccount } = 
                await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 100);
            
            const amount = ethers.parseUnits('100', 6);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const reference = ethers.encodeBytes32String('INV-001');

            await gateway.connect(merchant).createInvoice(
                customer.address,
                await mockToken.getAddress(),
                amount,
                deadline,
                reference
            );

            return { gateway, mockToken, owner, merchant, customer, otherAccount, amount };
        }

        it('Should allow customer to pay invoice with ERC20', async function () {
            const { gateway, mockToken, merchant, customer, amount } = 
                await loadFixture(createInvoiceFixture);
            
            // Approve gateway to spend tokens
            await mockToken.connect(customer).approve(await gateway.getAddress(), amount);
            
            // Pay invoice
            await gateway.connect(customer).payInvoice(1);

            const invoice = await gateway.getInvoice(1);
            expect(invoice.isPaid).to.be.true;
        });

        it('Should distribute fees correctly', async function () {
            const { gateway, mockToken, merchant, customer, amount } = 
                await loadFixture(createInvoiceFixture);
            
            const merchantBalanceBefore = await mockToken.balanceOf(merchant.address);
            
            await mockToken.connect(customer).approve(await gateway.getAddress(), amount);
            await gateway.connect(customer).payInvoice(1);

            const merchantBalanceAfter = await mockToken.balanceOf(merchant.address);
            
            // Merchant gets amount minus protocol fee (0.5%) and merchant fee (1%)
            // Protocol fee: 100 * 0.005 = 0.5 USDC
            // Merchant fee: 100 * 0.01 = 1 USDC (goes to owner as extra protocol fee)
            // Merchant receives: 100 - 0.5 - 1 = 98.5 USDC
            const expectedMerchantAmount = ethers.parseUnits('98.5', 6);
            expect(merchantBalanceAfter - merchantBalanceBefore).to.equal(expectedMerchantAmount);
        });

        it('Should prevent double payment', async function () {
            const { gateway, mockToken, customer, amount } = 
                await loadFixture(createInvoiceFixture);
            
            await mockToken.connect(customer).approve(await gateway.getAddress(), amount * 2n);
            await gateway.connect(customer).payInvoice(1);

            await expect(gateway.connect(customer).payInvoice(1))
                .to.be.revertedWith('Invoice already paid');
        });

        it('Should prevent payment after deadline', async function () {
            const { gateway, mockToken, merchant, customer } = 
                await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            
            // Create invoice with past deadline
            const amount = ethers.parseUnits('100', 6);
            const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const reference = ethers.encodeBytes32String('INV-EXPIRED');

            await gateway.connect(merchant).createInvoice(
                customer.address,
                await mockToken.getAddress(),
                amount,
                deadline,
                reference
            );

            await mockToken.connect(customer).approve(await gateway.getAddress(), amount);

            await expect(gateway.connect(customer).payInvoice(1))
                .to.be.revertedWith('Invoice expired');
        });
    });

    describe('Native ETH Payments', function () {
        it('Should allow ETH payments', async function () {
            const { gateway, merchant, customer } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            
            const amount = ethers.parseEther('1');
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const reference = ethers.encodeBytes32String('INV-ETH');

            await gateway.connect(merchant).createInvoice(
                customer.address,
                ethers.ZeroAddress, // ETH
                amount,
                deadline,
                reference
            );

            const merchantBalanceBefore = await ethers.provider.getBalance(merchant.address);
            
            await gateway.connect(customer).payInvoice(1, { value: amount });

            const merchantBalanceAfter = await ethers.provider.getBalance(merchant.address);
            
            // Merchant gets amount minus protocol fee (0.5%)
            const expectedMerchantAmount = amount - (amount * 50n / 10000n);
            expect(merchantBalanceAfter - merchantBalanceBefore).to.equal(expectedMerchantAmount);

            const invoice = await gateway.getInvoice(1);
            expect(invoice.isPaid).to.be.true;
        });
    });

    describe('Admin Functions', function () {
        it('Should allow owner to update protocol fee', async function () {
            const { gateway, owner } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(owner).setProtocolFee(100); // 1%
            expect(await gateway.protocolFeeBps()).to.equal(100);
        });

        it('Should prevent non-owner from updating fee', async function () {
            const { gateway, merchant } = await loadFixture(deployPaymentGatewayFixture);
            
            await expect(gateway.connect(merchant).setProtocolFee(100))
                .to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
        });

        it('Should prevent setting fee too high', async function () {
            const { gateway, owner } = await loadFixture(deployPaymentGatewayFixture);
            
            await expect(gateway.connect(owner).setProtocolFee(1001)) // > 10%
                .to.be.revertedWith('Fee too high');
        });

        it('Should allow owner to withdraw protocol fees', async function () {
            const { gateway, mockToken, owner, merchant, customer } = 
                await loadFixture(deployPaymentGatewayFixture);
            
            // Setup and make a payment
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            
            const amount = ethers.parseUnits('100', 6);
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const reference = ethers.encodeBytes32String('INV-001');

            await gateway.connect(merchant).createInvoice(
                customer.address,
                await mockToken.getAddress(),
                amount,
                deadline,
                reference
            );

            await mockToken.connect(customer).approve(await gateway.getAddress(), amount);
            await gateway.connect(customer).payInvoice(1);

            // Owner withdraws protocol fees
            const ownerBalanceBefore = await mockToken.balanceOf(owner.address);
            await gateway.connect(owner).withdrawFees(await mockToken.getAddress());
            const ownerBalanceAfter = await mockToken.balanceOf(owner.address);

            // Protocol fee was 0.5% of 100 = 0.5 USDC
            const expectedFee = ethers.parseUnits('0.5', 6);
            expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(expectedFee);
        });
    });

    describe('Merchant Management', function () {
        it('Should allow merchant to update vault address', async function () {
            const { gateway, merchant, otherAccount } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            await gateway.connect(merchant).updateMerchantVault(otherAccount.address);

            const merchantInfo = await gateway.getMerchant(merchant.address);
            expect(merchantInfo.vaultAddress).to.equal(otherAccount.address);
        });

        it('Should allow merchant to deactivate account', async function () {
            const { gateway, merchant } = await loadFixture(deployPaymentGatewayFixture);
            
            await gateway.connect(merchant).registerMerchant('Test Store', merchant.address, 0);
            await gateway.connect(merchant).deactivateMerchant();

            const merchantInfo = await gateway.getMerchant(merchant.address);
            expect(merchantInfo.isActive).to.be.false;
        });
    });
});
