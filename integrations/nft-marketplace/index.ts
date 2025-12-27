/**
 * NFT Marketplace Integration
 * 
 * Example of building an NFT marketplace where users authenticate
 * and trade using Veridex passkeys.
 * 
 * Run: npx ts-node integrations/nft-marketplace/index.ts
 */

import { createSDK, SessionManager } from 'veridex-sdk';
import { parseEther, formatEther, ethers } from 'ethers';

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
    console.log('🖼️ Veridex NFT Marketplace Integration\n');
    console.log('='.repeat(60));

    // =========================================================================
    // Setup Seller and Buyer
    // =========================================================================
    
    const sellerSdk = createSDK('base', { relayerUrl: process.env.RELAYER_URL });
    const buyerSdk = createSDK('base', { relayerUrl: process.env.RELAYER_URL });

    console.log('\n👤 Setting up users...');
    
    await sellerSdk.passkey.register('seller@nft.com', 'NFT Seller');
    await buyerSdk.passkey.register('buyer@nft.com', 'NFT Buyer');

    const sellerVault = sellerSdk.getVaultAddress();
    const buyerVault = buyerSdk.getVaultAddress();

    console.log(`   Seller vault: ${sellerVault}`);
    console.log(`   Buyer vault: ${buyerVault}`);

    // =========================================================================
    // Part 1: List NFT for Sale
    // =========================================================================
    
    console.log('\n📦 PART 1: LIST NFT FOR SALE');
    console.log('='.repeat(60));

    const marketplaceIface = new ethers.Interface(MARKETPLACE_ABI);
    const nftIface = new ethers.Interface(ERC721_ABI);
    const tokenId = 42;
    const listPrice = parseEther('0.5');

    console.log('\n🎨 Seller listing NFT #42...');
    console.log(`   Collection: ${NFT_CONTRACT}`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Price: ${formatEther(listPrice)} ETH`);

    // First, approve marketplace to transfer NFT
    console.log('\n   Step 1: Approving marketplace...');
    
    const approveData = nftIface.encodeFunctionData('approve', [
        MARKETPLACE_ADDRESS,
        tokenId,
    ]);

    await sellerSdk.execute({
        target: NFT_CONTRACT,
        data: approveData,
        value: 0n,
    });
    console.log('   ✅ Marketplace approved');

    // List the NFT
    console.log('   Step 2: Creating listing...');
    
    const listData = marketplaceIface.encodeFunctionData('listNFT', [
        NFT_CONTRACT,
        tokenId,
        listPrice,
    ]);

    const listResult = await sellerSdk.execute({
        target: MARKETPLACE_ADDRESS,
        data: listData,
        value: 0n,
    });

    const listingId = parseListedEvent(listResult.logs);
    console.log(`   ✅ NFT listed! Listing ID: ${listingId}`);

    // =========================================================================
    // Part 2: Browse and Buy NFT
    // =========================================================================
    
    console.log('\n📦 PART 2: BUY NFT');
    console.log('='.repeat(60));

    // Check buyer balance
    const buyerBalance = await buyerSdk.getBalance('native');
    console.log(`\n💰 Buyer balance: ${formatEther(buyerBalance)} ETH`);

    if (buyerBalance < listPrice) {
        console.log('⚠️  Insufficient balance to buy NFT');
        return;
    }

    console.log('\n🛒 Buying NFT #42...');

    const buyData = marketplaceIface.encodeFunctionData('buyNFT', [listingId]);

    const buyResult = await buyerSdk.execute({
        target: MARKETPLACE_ADDRESS,
        data: buyData,
        value: listPrice,
    });

    console.log(`✅ NFT purchased!`);
    console.log(`   TX: ${buyResult.transactionHash}`);

    // Verify ownership transfer
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const nftContract = new ethers.Contract(NFT_CONTRACT, ERC721_ABI, provider);
    const newOwner = await nftContract.ownerOf(tokenId);
    
    console.log(`\n🔍 Verifying ownership...`);
    console.log(`   New owner: ${newOwner}`);
    console.log(`   Expected: ${buyerVault}`);
    console.log(`   Match: ${newOwner.toLowerCase() === buyerVault.toLowerCase() ? '✅' : '❌'}`);

    // =========================================================================
    // Part 3: Offer System
    // =========================================================================
    
    console.log('\n📦 PART 3: MAKE AND ACCEPT OFFERS');
    console.log('='.repeat(60));

    // Seller lists another NFT
    const tokenId2 = 43;
    const listPrice2 = parseEther('1.0');

    console.log('\n📄 Seller lists NFT #43 for 1 ETH...');
    
    await sellerSdk.execute({
        target: NFT_CONTRACT,
        data: nftIface.encodeFunctionData('approve', [MARKETPLACE_ADDRESS, tokenId2]),
        value: 0n,
    });

    const list2Result = await sellerSdk.execute({
        target: MARKETPLACE_ADDRESS,
        data: marketplaceIface.encodeFunctionData('listNFT', [NFT_CONTRACT, tokenId2, listPrice2]),
        value: 0n,
    });
    const listingId2 = parseListedEvent(list2Result.logs);
    console.log(`   ✅ Listed with ID: ${listingId2}`);

    // Buyer makes an offer below asking price
    const offerAmount = parseEther('0.8');
    console.log(`\n💬 Buyer makes offer of ${formatEther(offerAmount)} ETH...`);

    const offerData = marketplaceIface.encodeFunctionData('makeOffer', [
        listingId2,
        offerAmount,
    ]);

    await buyerSdk.execute({
        target: MARKETPLACE_ADDRESS,
        data: offerData,
        value: offerAmount, // Offer is escrowed
    });
    console.log('   ✅ Offer submitted');

    // Seller accepts the offer
    console.log('\n✅ Seller accepts offer...');
    
    const acceptData = marketplaceIface.encodeFunctionData('acceptOffer', [
        listingId2,
        0, // First offer
    ]);

    await sellerSdk.execute({
        target: MARKETPLACE_ADDRESS,
        data: acceptData,
        value: 0n,
    });
    console.log('   ✅ Offer accepted! NFT transferred.');

    console.log('\n🎉 Marketplace flow complete!');
}

// ============================================================================
// Batch Listing with Session Keys
// ============================================================================

async function batchListingExample() {
    console.log('\n' + '='.repeat(60));
    console.log('📦 BATCH LISTING WITH SESSION KEYS');
    console.log('='.repeat(60));

    const sdk = createSDK('base');
    const sessionManager = new SessionManager({ sdk });

    // Create session for listing multiple NFTs
    const session = await sessionManager.createSession({
        duration: 3600,
        maxValue: 0n, // No value transfers needed for listing
        allowedActions: ['execute'],
    });

    console.log('\n🎨 Batch listing 5 NFTs with single passkey signature...\n');

    const nftIface = new ethers.Interface(ERC721_ABI);
    const marketplaceIface = new ethers.Interface(MARKETPLACE_ABI);
    
    const nftsToList = [
        { tokenId: 100, price: parseEther('0.1') },
        { tokenId: 101, price: parseEther('0.2') },
        { tokenId: 102, price: parseEther('0.15') },
        { tokenId: 103, price: parseEther('0.3') },
        { tokenId: 104, price: parseEther('0.25') },
    ];

    // Create batch operations
    const operations = [];
    for (const nft of nftsToList) {
        // Approve
        operations.push({
            action: 'execute' as const,
            target: NFT_CONTRACT,
            data: nftIface.encodeFunctionData('approve', [MARKETPLACE_ADDRESS, nft.tokenId]),
            value: 0n,
        });
        // List
        operations.push({
            action: 'execute' as const,
            target: MARKETPLACE_ADDRESS,
            data: marketplaceIface.encodeFunctionData('listNFT', [NFT_CONTRACT, nft.tokenId, nft.price]),
            value: 0n,
        });
    }

    const result = await sessionManager.executeBatchWithSession(operations, session);

    console.log(`✅ All ${nftsToList.length} NFTs listed in single transaction!`);
    console.log(`   TX: ${result.transactionHash}`);
    console.log(`   Gas saved: ~80% vs individual transactions`);
}

// ============================================================================
// NFT Collection View
// ============================================================================

async function viewCollection() {
    console.log('\n' + '='.repeat(60));
    console.log('🖼️ VIEW NFT COLLECTION');
    console.log('='.repeat(60));

    const sdk = createSDK('base');
    const vaultAddress = sdk.getVaultAddress();

    console.log(`\n📍 Vault: ${vaultAddress}`);
    console.log('\n🔍 Fetching owned NFTs...\n');

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

function parseListedEvent(logs: ethers.Log[]): string {
    const iface = new ethers.Interface(MARKETPLACE_ABI);
    for (const log of logs) {
        try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (parsed?.name === 'Listed') {
                return parsed.args.listingId.toString();
            }
        } catch {
            continue;
        }
    }
    throw new Error('Listed event not found');
}

// Run examples
main()
    .then(() => batchListingExample())
    .then(() => viewCollection())
    .catch(console.error);
