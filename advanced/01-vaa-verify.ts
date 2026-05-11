/**
 * Advanced Example 01: VAA Verification
 * 
 * This example demonstrates how to verify Wormhole VAAs (Verifiable Action Approvals)
 * for cross-chain message validation.
 * 
 * Run: npm run advanced:vaa
 */

import { createSDK } from '@veridex/sdk';
import { parseVAA, hasQuorum, normalizeEmitterAddress } from '@veridex/sdk';
import { Wallet, JsonRpcProvider, parseEther } from 'ethers';

if (!process.env.PRIVATE_KEY) {
  console.error('✖ PRIVATE_KEY is not set. Export it before running this example.');
  process.exit(1);
}
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
    console.log('🔐 Wormhole VAA Verification Example\n');
    console.log('='.repeat(50));

    // =========================================================================
    // Step 1: Create a Transaction to Get a VAA
    // =========================================================================
    
    const sdk = createSDK('base');
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    
    console.log('\n📡 SDK initialized for Base testnet');
    
    try {
        const vaultAddress = sdk.getVaultAddress();
        console.log(`📍 Vault address: ${vaultAddress}`);

        // Check balance
        const balance = await sdk.getVaultNativeBalance();
        console.log(`💰 Balance: ${balance.formatted} ETH`);

        if (balance.balance < parseEther('0.001')) {
            console.log('\n⚠️  Insufficient balance. Skipping transaction creation.');
            console.log('   This example will show VAA verification concepts instead.');
            await demonstrateVAAStructure();
            return;
        }

        // =====================================================================
        // Step 2: Execute a Cross-Chain Action
        // =====================================================================
        
        console.log('\n📝 Executing cross-chain action...');
        
        const chainConfig = sdk.getChainConfig();
        const prepared = await sdk.prepareTransfer({
            token: 'native',
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5b0e7',
            amount: parseEther('0.0001'),
            targetChain: 10005, // Optimism Sepolia
        });

        const result = await sdk.executeTransfer(prepared, signer);

        console.log('✅ Transaction submitted!');
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Sequence: ${result.sequence}`);

        // =====================================================================
        // Step 3: Fetch the VAA
        // =====================================================================
        
        console.log('\n⏳ Waiting for VAA finalization...');
        console.log('   (This takes ~15 seconds for Guardian signatures)');

        // Wait a bit for the VAA to be available
        await new Promise(resolve => setTimeout(resolve, 20000));

        console.log('\n📥 Fetching VAA...');
        
        try {
            const vaaBytes = await sdk.fetchVAAForTransaction(result.transactionHash);
            
            console.log('✅ VAA fetched successfully!');
            console.log(`   VAA length: ${vaaBytes.length} bytes`);

            // =====================================================================
            // Step 4: Parse the VAA
            // =====================================================================
            
            console.log('\n🔍 Parsing VAA...');
            
            const vaa = parseVAA(vaaBytes);
            
            console.log('\n📋 VAA Structure:');
            console.log(`   Version: ${vaa.version}`);
            console.log(`   Guardian Set: ${vaa.guardianSetIndex}`);
            console.log(`   Signatures: ${vaa.signatures.length}/19`);
            console.log(`   Timestamp: ${new Date(vaa.timestamp * 1000).toISOString()}`);
            console.log(`   Nonce: ${vaa.nonce}`);
            console.log(`   Emitter Chain: ${vaa.emitterChain}`);
            console.log(`   Emitter Address: ${vaa.emitterAddress}`);
            console.log(`   Sequence: ${vaa.sequence}`);
            console.log(`   Consistency Level: ${vaa.consistencyLevel}`);

            // =====================================================================
            // Step 5: Verify VAA Signatures
            // =====================================================================
            
            console.log('\n🔐 Verifying Guardian signatures...');
            
            const isValid = hasQuorum(vaa, true);
            
            if (isValid) {
                console.log('✅ VAA signatures are valid!');
                console.log(`   Verified ${vaa.signatures.length} Guardian signatures`);
                console.log(`   Quorum: ${vaa.signatures.length}/19 (minimum 13 required)`);
            } else {
                console.log('❌ VAA signatures are invalid!');
            }

            // =====================================================================
            // Step 6: Verify Emitter (Security Best Practice)
            // =====================================================================
            
            console.log('\n🛡️  Verifying emitter address...');
            
            const hubContract = chainConfig.contracts?.hub || '';
            const normalizedEmitter = normalizeEmitterAddress(vaa.emitterAddress);
            const normalizedHub = normalizeEmitterAddress(hubContract);
            
            if (normalizedEmitter === normalizedHub) {
                console.log('✅ Emitter is the expected Hub contract');
                console.log(`   Emitter: ${normalizedEmitter}`);
            } else {
                console.log('⚠️  Emitter mismatch!');
                console.log(`   Expected: ${normalizedHub}`);
                console.log(`   Got: ${normalizedEmitter}`);
            }

            // =====================================================================
            // Step 7: Parse Veridex Payload
            // =====================================================================
            
            console.log('\n📦 Parsing Veridex payload...');
            
            // The payload contains the actual action data
            console.log(`   Payload length: ${vaa.payload.length} bytes`);
            console.log(`   Payload (hex): ${vaa.payload.slice(0, 100)}...`);
            
            // In a real application, you would decode the payload
            // to extract the action details (transfer, bridge, etc.)

        } catch (vaaError) {
            console.log('⚠️  VAA not yet available or error fetching');
            console.log('   VAAs typically take 15-30 seconds to finalize');
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error('\n❌ Error:', error.message);
            
            if (error.message.includes('No credential')) {
                console.log('\n💡 Run 01-create-wallet.ts first to register a passkey.');
            }
        }
    }
}

// ============================================================================
// Demonstrate VAA Structure
// ============================================================================

async function demonstrateVAAStructure() {
    console.log('\n' + '='.repeat(50));
    console.log('📚 VAA Structure Overview');
    console.log('='.repeat(50));

    console.log(`
A Wormhole VAA (Verifiable Action Approval) contains:

1. Header:
   • Version (1 byte)
   • Guardian Set Index (4 bytes)
   • Number of Signatures (1 byte)

2. Signatures:
   • Guardian Index (1 byte)
   • Signature (65 bytes)
   • Repeated for each Guardian (minimum 13/19 required)

3. Body:
   • Timestamp (4 bytes)
   • Nonce (4 bytes)
   • Emitter Chain ID (2 bytes)
   • Emitter Address (32 bytes)
   • Sequence Number (8 bytes)
   • Consistency Level (1 byte)
   • Payload (variable length)

4. Security Properties:
   • 13/19 Guardian quorum required
   • ECDSA signatures over keccak256 hash
   • Replay protection via sequence numbers
   • Emitter verification prevents spoofing
    `);

    console.log('🔐 Security Best Practices:');
    console.log('   1. Always verify Guardian signatures');
    console.log('   2. Check emitter address matches expected contract');
    console.log('   3. Validate sequence numbers for replay protection');
    console.log('   4. Verify target chain matches intended destination');
    console.log('   5. Parse and validate payload before execution');
}

// ============================================================================
// VAA Verification Checklist
// ============================================================================

async function showVerificationChecklist() {
    console.log('\n' + '='.repeat(50));
    console.log('✅ VAA Verification Checklist');
    console.log('='.repeat(50));

    console.log(`
Before accepting a VAA, verify:

□ Signature Verification
  • At least 13/19 Guardian signatures present
  • All signatures are valid ECDSA signatures
  • Signatures are from current Guardian set

□ Emitter Verification
  • Emitter chain ID matches expected source
  • Emitter address matches expected contract
  • Normalized address comparison (32-byte format)

□ Sequence Verification
  • Sequence number is greater than last processed
  • No gaps in sequence (for ordered processing)
  • Sequence hasn't been processed before (replay protection)

□ Payload Verification
  • Payload format matches expected schema
  • Action type is supported
  • Parameters are within acceptable ranges
  • Target addresses are valid

□ Chain Verification
  • Target chain matches current chain
  • Chain ID is in supported chains list
  • Chain-specific validation passes
    `);
}

// ============================================================================
// Common VAA Errors
// ============================================================================

async function showCommonErrors() {
    console.log('\n' + '='.repeat(50));
    console.log('⚠️  Common VAA Errors');
    console.log('='.repeat(50));

    console.log(`
1. "VAA not found"
   • VAA hasn't been finalized yet (wait 15-30 seconds)
   • Transaction didn't emit a Wormhole message
   • Wrong sequence number or emitter address

2. "Invalid signatures"
   • VAA was tampered with
   • Using wrong Guardian set
   • Corrupted VAA data

3. "Emitter mismatch"
   • VAA is from wrong contract
   • Potential spoofing attempt
   • Wrong chain configuration

4. "Sequence already processed"
   • Replay attack attempt
   • Duplicate VAA submission
   • Out-of-order processing

5. "Invalid payload"
   • Corrupted action data
   • Unsupported action type
   • Malformed parameters
    `);
}

// Run examples
main()
    .then(() => showVerificationChecklist())
    .then(() => showCommonErrors())
    .catch(console.error);
