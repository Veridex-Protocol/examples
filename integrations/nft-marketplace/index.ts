/**
 * NFT Marketplace Integration
 * 
 * Example of building an NFT marketplace where users authenticate
 * and trade using Veridex passkeys.
 * 
 * Run: npx ts-node integrations/nft-marketplace/index.ts
 */

import { createSDK } from '@veridex/sdk';
import { parseEther, formatEther, ethers, Wallet, JsonRpcProvider } from 'ethers';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// NFT Marketplace contract ABI (simplified)
const MARKETPLACE_ABI = [
    'function listNFT(address nftContract, uint256 tokenId, uint256 price) external',
    'function buyNFT(uint256 listingId) external payable',
    'function cancelListing(uint256 listingId) external',
    'function makeOffer(uint256 listingId, uint256 amount) external payable',
    'function acceptOffer(uint256 listingId, uint256 offerId) external',
    'function getListing(uint256 listingId) external view returns (tuple(uint256 id, address seller, address nftContract, uint256 tokenId, uint256 price, uint8 status, uint256 createdAt))',
    'function getActiveListings() external view returns (uint256[])',
    'event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price)',
    'event Sold(uint256 indexed listingId, address indexed buyer, uint256 price)',
];

// ERC721 ABI
const ERC721_ABI = [
    'function approve(address to, uint256 tokenId) external',
    'function setApprovalForAll(address operator, bool approved) external',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'function balanceOf(address owner) external view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
];

const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '0x...';
const NFT_CONTRACT = '0x1234567890123456789012345678901234567890'; // Example NFT

async function main() {
    console.log(' Veridex NFT Marketplace Integration\n');
    console.log('='.repeat(60));

    // =========================================================================
    // Setup Seller and Buyer
    // =========================================================================
    
    const sellerSdk = createSDK('base', { relayerUrl: process.env.RELAYER_URL });
    const buyerSdk = createSDK('base', { relayerUrl: process.env.RELAYER_URL });

    console.log('\n Setting up users...');
    
    await sellerSdk.passkey.register('seller@nft.com', 'NFT Seller');
    await buyerSdk.passkey.register('buyer@nft.com', 'NFT Buyer');

    const sellerVault = sellerSdk.getVaultAddress();
    const buyerVault = buyerSdk.getVaultAddress();

    console.log(`   Seller vault: ${sellerVault}`);
    console.log(`   Buyer vault: ${buyerVault}`);

    // =========================================================================
    // Part 1: List NFT for Sale
    // =========================================================================
    
    console.log('\nPACKAGE PART 1: LIST NFT FOR SALE');
    console.log('='.repeat(60));

    const marketplaceIface = new ethers.Interface(MARKETPLACE_ABI);
    const nftIface = new ethers.Interface(ERC721_ABI);
    const tokenId = 42;
    const listPrice = parseEther('0.5');

    console.log('\n Seller listing NFT #42...');
    console.log(`   Collection: ${NFT_CONTRACT}`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Price: ${formatEther(listPrice)} ETH`);

    // First, approve marketplace to transfer NFT
    console.log('\n   Step 1: Approving marketplace...');
    
    const approveData = nftIface.encodeFunctionData('approve', [
        MARKETPLACE_ADDRESS,
        tokenId,
    ]);

    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    const chainConfig = sellerSdk.getChainConfig();

    await sellerSdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: NFT_CONTRACT,
        data: approveData,
        value: 0n,
    }, signer);
    console.log('   OK Marketplace approved');

    // List the NFT
    console.log('   Step 2: Creating listing...');
    
    const listData = marketplaceIface.encodeFunctionData('listNFT', [
        NFT_CONTRACT,
        tokenId,
        listPrice,
    ]);

    const listResult = await sellerSdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: MARKETPLACE_ADDRESS,
        data: listData,
        value: 0n,
    }, signer);

    const listingId = '1'; // In production, parse from transaction receipt events
    console.log(`   OK NFT listed! TX: ${listResult.transactionHash}`);

    // =========================================================================
    // Part 2: Browse and Buy NFT
    // =========================================================================
    
    console.log('\nPACKAGE PART 2: BUY NFT');
    console.log('='.repeat(60));

    // Check buyer balance
    const buyerBalanceResult = await buyerSdk.getVaultNativeBalance();
    console.log(`\nBALANCE Buyer balance: ${buyerBalanceResult.formatted} ETH`);

    if (buyerBalanceResult.balance < listPrice) {
        console.log('WARN  Insufficient balance to buy NFT');
        return;
    }

    console.log('\n Buying NFT #42...');

    const buyData = marketplaceIface.encodeFunctionData('buyNFT', [listingId]);

    const buyerChainConfig = buyerSdk.getChainConfig();
    const buyResult = await buyerSdk.execute({
        targetChain: buyerChainConfig.wormholeChainId,
        target: MARKETPLACE_ADDRESS,
        data: buyData,
        value: listPrice,
    }, signer);

    console.log(`OK NFT purchased!`);
    console.log(`   TX: ${buyResult.transactionHash}`);

    // Verify ownership transfer
    const nftContract = new ethers.Contract(NFT_CONTRACT, ERC721_ABI, provider);
    const newOwner = await nftContract.ownerOf(tokenId);
    
    console.log(`\nVERIFY Verifying ownership...`);
    console.log(`   New owner: ${newOwner}`);
    console.log(`   Expected: ${buyerVault}`);
    console.log(`   Match: ${newOwner.toLowerCase() === buyerVault.toLowerCase() ? 'OK' : 'ERROR'}`);

    // =========================================================================
    // Part 3: Offer System
    // =========================================================================
    
    console.log('\nPACKAGE PART 3: MAKE AND ACCEPT OFFERS');
    console.log('='.repeat(60));

    // Seller lists another NFT
    const tokenId2 = 43;
    const listPrice2 = parseEther('1.0');

    console.log('\nDOC Seller lists NFT #43 for 1 ETH...');
    
    await sellerSdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: NFT_CONTRACT,
        data: nftIface.encodeFunctionData('approve', [MARKETPLACE_ADDRESS, tokenId2]),
        value: 0n,
    }, signer);

    const list2Result = await sellerSdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: MARKETPLACE_ADDRESS,
        data: marketplaceIface.encodeFunctionData('listNFT', [NFT_CONTRACT, tokenId2, listPrice2]),
        value: 0n,
    }, signer);
    const listingId2 = '2'; // In production, parse from transaction receipt events
    console.log(`   OK Listed TX: ${list2Result.transactionHash}`);

    // Buyer makes an offer below asking price
    const offerAmount = parseEther('0.8');
    console.log(`\nCHAT Buyer makes offer of ${formatEther(offerAmount)} ETH...`);

    const offerData = marketplaceIface.encodeFunctionData('makeOffer', [
        listingId2,
        offerAmount,
    ]);

    await buyerSdk.execute({
        targetChain: buyerChainConfig.wormholeChainId,
        target: MARKETPLACE_ADDRESS,
        data: offerData,
        value: offerAmount, // Offer is escrowed
    }, signer);
    console.log('   OK Offer submitted');

    // Seller accepts the offer
    console.log('\nOK Seller accepts offer...');
    
    const acceptData = marketplaceIface.encodeFunctionData('acceptOffer', [
        listingId2,
        0, // First offer
    ]);

    await sellerSdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: MARKETPLACE_ADDRESS,
        data: acceptData,
        value: 0n,
    }, signer);
    console.log('   OK Offer accepted! NFT transferred.');

    console.log('\nDONE Marketplace flow complete!');
}

// ============================================================================
// Batch Listing with Session Keys
// ============================================================================

async function batchListingExample() {
    console.log('\n' + '='.repeat(60));
    console.log('PACKAGE BATCH LISTING WITH SESSION KEYS');
    console.log('='.repeat(60));

    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    const chainConfig = sdk.getChainConfig();

    console.log('\n Batch listing 5 NFTs...\n');

    const nftIface = new ethers.Interface(ERC721_ABI);
    const marketplaceIface = new ethers.Interface(MARKETPLACE_ABI);
    
    const nftsToList = [
        { tokenId: 100, price: parseEther('0.1') },
        { tokenId: 101, price: parseEther('0.2') },
        { tokenId: 102, price: parseEther('0.15') },
        { tokenId: 103, price: parseEther('0.3') },
        { tokenId: 104, price: parseEther('0.25') },
    ];

    for (const nft of nftsToList) {
        // Approve
        await sdk.execute({
            targetChain: chainConfig.wormholeChainId,
            target: NFT_CONTRACT,
            data: nftIface.encodeFunctionData('approve', [MARKETPLACE_ADDRESS, nft.tokenId]),
            value: 0n,
        }, signer);
        // List
        await sdk.execute({
            targetChain: chainConfig.wormholeChainId,
            target: MARKETPLACE_ADDRESS,
            data: marketplaceIface.encodeFunctionData('listNFT', [NFT_CONTRACT, nft.tokenId, nft.price]),
            value: 0n,
        }, signer);
        console.log(`   OK Listed NFT #${nft.tokenId} for ${formatEther(nft.price)} ETH`);
    }

    console.log(`\nOK All ${nftsToList.length} NFTs listed!`);
}

// ============================================================================
// NFT Collection View
// ============================================================================

async function viewCollection() {
    console.log('\n' + '='.repeat(60));
    console.log(' VIEW NFT COLLECTION');
    console.log('='.repeat(60));

    const sdk = createSDK('base');
    const vaultAddress = sdk.getVaultAddress();

    console.log(`\nLOCATION Vault: ${vaultAddress}`);
    console.log('\nVERIFY Fetching owned NFTs...\n');

    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const nftContract = new ethers.Contract(NFT_CONTRACT, ERC721_ABI, provider);

    const balance = await nftContract.balanceOf(vaultAddress);
    console.log(`   Total NFTs owned: ${balance}`);

    console.log('\n   Token IDs:');
    for (let i = 0; i < Number(balance); i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(vaultAddress, i);
        console.log(`   • #${tokenId}`);
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

// In production, parse listing events from transaction receipts
// The DispatchResult from sdk.execute() returns transactionHash and sequence
// Use a provider to fetch the receipt and parse events

// Run examples
main()
    .then(() => batchListingExample())
    .then(() => viewCollection())
    .catch(console.error);
