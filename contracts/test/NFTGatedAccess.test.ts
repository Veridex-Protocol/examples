import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('VeridexNFTGatedAccess', function () {
    async function deployNFTGatedFixture() {
        const [owner, ruleCreator, user1, user2] = await ethers.getSigners();

        // Deploy mock NFTs
        const MockERC721 = await ethers.getContractFactory('MockERC721');
        const mockNFT = await MockERC721.deploy('Test NFT', 'TNFT');
        await mockNFT.waitForDeployment();

        const MockERC1155 = await ethers.getContractFactory('MockERC1155');
        const mockMultiToken = await MockERC1155.deploy();
        await mockMultiToken.waitForDeployment();

        // Deploy MockVeridexHub
        const MockHub = await ethers.getContractFactory('MockVeridexHub');
        const mockHub = await MockHub.deploy();
        await mockHub.waitForDeployment();

        // Deploy NFTGatedAccess
        const NFTGatedAccess = await ethers.getContractFactory('VeridexNFTGatedAccess');
        const gatedAccess = await NFTGatedAccess.deploy();
        await gatedAccess.waitForDeployment();

        return { gatedAccess, mockNFT, mockMultiToken, mockHub, owner, ruleCreator, user1, user2 };
    }

    describe('Deployment', function () {
        it('Should deploy successfully', async function () {
            const { gatedAccess } = await loadFixture(deployNFTGatedFixture);
            expect(await gatedAccess.getAddress()).to.be.properAddress;
        });
    });

    describe('Access Rule Creation', function () {
        it('Should create ERC721-based access rule', async function () {
            const { gatedAccess, mockNFT, ruleCreator } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0, // tokenType: ERC721
                0, // any token ID
                1, // minimum 1 NFT
                0, // no expiry
                ethers.ZeroAddress // no vault requirement
            );

            const rule = await gatedAccess.getAccessRule(1);
            expect(rule.name).to.equal('Premium Content');
            expect(rule.creator).to.equal(ruleCreator.address);
            expect(rule.tokenType).to.equal(0);
            expect(rule.isActive).to.be.true;
        });

        it('Should create ERC1155-based access rule', async function () {
            const { gatedAccess, mockMultiToken, ruleCreator } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'VIP Access',
                await mockMultiToken.getAddress(),
                1, // tokenType: ERC1155
                42, // specific token ID
                5, // minimum 5 tokens
                0,
                ethers.ZeroAddress
            );

            const rule = await gatedAccess.getAccessRule(1);
            expect(rule.tokenType).to.equal(1);
            expect(rule.tokenId).to.equal(42);
            expect(rule.minBalance).to.equal(5);
        });

        it('Should emit AccessRuleCreated event', async function () {
            const { gatedAccess, mockNFT, ruleCreator } = await loadFixture(deployNFTGatedFixture);
            
            await expect(gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            ))
                .to.emit(gatedAccess, 'AccessRuleCreated')
                .withArgs(1, ruleCreator.address, 'Premium Content');
        });
    });

    describe('Access Verification', function () {
        async function setupRuleWithNFTFixture() {
            const { gatedAccess, mockNFT, mockMultiToken, mockHub, owner, ruleCreator, user1, user2 } = 
                await loadFixture(deployNFTGatedFixture);
            
            // Create access rule
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            );

            // Mint NFT to user1
            await mockNFT.mint(user1.address);

            return { gatedAccess, mockNFT, mockMultiToken, mockHub, owner, ruleCreator, user1, user2 };
        }

        it('Should grant access to NFT holder', async function () {
            const { gatedAccess, user1 } = await loadFixture(setupRuleWithNFTFixture);
            
            const hasAccess = await gatedAccess.checkAccess(user1.address, 1);
            expect(hasAccess).to.be.true;
        });

        it('Should deny access to non-NFT holder', async function () {
            const { gatedAccess, user2 } = await loadFixture(setupRuleWithNFTFixture);
            
            const hasAccess = await gatedAccess.checkAccess(user2.address, 1);
            expect(hasAccess).to.be.false;
        });

        it('Should respect minimum balance requirement', async function () {
            const { gatedAccess, mockNFT, ruleCreator, user1, user2 } = 
                await loadFixture(deployNFTGatedFixture);
            
            // Create rule requiring 3 NFTs
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Elite Content',
                await mockNFT.getAddress(),
                0,
                0,
                3, // need 3 NFTs
                0,
                ethers.ZeroAddress
            );

            // Mint 2 NFTs to user1
            await mockNFT.mint(user1.address);
            await mockNFT.mint(user1.address);

            // Mint 3 NFTs to user2
            await mockNFT.mint(user2.address);
            await mockNFT.mint(user2.address);
            await mockNFT.mint(user2.address);

            expect(await gatedAccess.checkAccess(user1.address, 1)).to.be.false;
            expect(await gatedAccess.checkAccess(user2.address, 1)).to.be.true;
        });
    });

    describe('ERC1155 Access', function () {
        it('Should verify ERC1155 token balance', async function () {
            const { gatedAccess, mockMultiToken, ruleCreator, user1, user2 } = 
                await loadFixture(deployNFTGatedFixture);
            
            // Create rule for specific token ID
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Badge Access',
                await mockMultiToken.getAddress(),
                1, // ERC1155
                100, // token ID 100
                5, // need 5 tokens
                0,
                ethers.ZeroAddress
            );

            // Mint tokens
            await mockMultiToken.mint(user1.address, 100, 3); // only 3
            await mockMultiToken.mint(user2.address, 100, 10); // 10 tokens

            expect(await gatedAccess.checkAccess(user1.address, 1)).to.be.false;
            expect(await gatedAccess.checkAccess(user2.address, 1)).to.be.true;
        });
    });

    describe('Access Grants', function () {
        it('Should allow granting access manually', async function () {
            const { gatedAccess, mockNFT, ruleCreator, user2 } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            );

            // User2 doesn't have NFT
            expect(await gatedAccess.checkAccess(user2.address, 1)).to.be.false;

            // Grant access manually
            await gatedAccess.connect(ruleCreator).grantAccess(user2.address, 1, 0);

            // Now should have access
            expect(await gatedAccess.checkAccess(user2.address, 1)).to.be.true;
        });

        it('Should emit AccessGranted event', async function () {
            const { gatedAccess, mockNFT, ruleCreator, user2 } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            );

            await expect(gatedAccess.connect(ruleCreator).grantAccess(user2.address, 1, 0))
                .to.emit(gatedAccess, 'AccessGranted')
                .withArgs(user2.address, 1);
        });

        it('Should allow revoking access', async function () {
            const { gatedAccess, mockNFT, ruleCreator, user2 } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            );

            await gatedAccess.connect(ruleCreator).grantAccess(user2.address, 1, 0);
            expect(await gatedAccess.checkAccess(user2.address, 1)).to.be.true;

            await gatedAccess.connect(ruleCreator).revokeAccess(user2.address, 1);
            expect(await gatedAccess.checkAccess(user2.address, 1)).to.be.false;
        });
    });

    describe('Rule Management', function () {
        it('Should allow rule creator to deactivate rule', async function () {
            const { gatedAccess, mockNFT, ruleCreator, user1 } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            );

            await mockNFT.mint(user1.address);
            expect(await gatedAccess.checkAccess(user1.address, 1)).to.be.true;

            await gatedAccess.connect(ruleCreator).deactivateRule(1);

            const rule = await gatedAccess.getAccessRule(1);
            expect(rule.isActive).to.be.false;
        });

        it('Should prevent non-creator from deactivating rule', async function () {
            const { gatedAccess, mockNFT, ruleCreator, user1 } = await loadFixture(deployNFTGatedFixture);
            
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockNFT.getAddress(),
                0,
                0,
                1,
                0,
                ethers.ZeroAddress
            );

            await expect(gatedAccess.connect(user1).deactivateRule(1))
                .to.be.revertedWith('Not rule creator');
        });
    });

    describe('Multiple Rules', function () {
        it('Should handle multiple rules for different content', async function () {
            const { gatedAccess, mockNFT, mockMultiToken, ruleCreator, user1 } = 
                await loadFixture(deployNFTGatedFixture);
            
            // Rule 1: ERC721 requirement
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Basic Content',
                await mockNFT.getAddress(),
                0, 0, 1, 0, ethers.ZeroAddress
            );

            // Rule 2: ERC1155 requirement
            await gatedAccess.connect(ruleCreator).createAccessRule(
                'Premium Content',
                await mockMultiToken.getAddress(),
                1, 50, 10, 0, ethers.ZeroAddress
            );

            // User has ERC721 but not enough ERC1155
            await mockNFT.mint(user1.address);
            await mockMultiToken.mint(user1.address, 50, 5);

            expect(await gatedAccess.checkAccess(user1.address, 1)).to.be.true; // Basic
            expect(await gatedAccess.checkAccess(user1.address, 2)).to.be.false; // Premium
        });
    });
});
