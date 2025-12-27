/**
 * Example: Batch Operations with Session Keys
 * 
 * Execute multiple operations in a single transaction using session keys.
 * Perfect for complex workflows that would otherwise require many signatures.
 * 
 * Run: npx ts-node sessions/02-execute-batch.ts
 */

import { createSDK, SessionManager } from 'veridex-sdk';
import { parseEther, parseUnits, formatEther } from 'ethers';

// Example contract addresses
const CONTRACTS = {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    DEX: '0x1234567890123456789012345678901234567890', // Example DEX
    STAKING: '0x0987654321098765432109876543210987654321', // Example Staking
};

async function main() {
    console.log('PACKAGE Veridex Batch Operations Example\n');
    console.log('='.repeat(50));

    const sdk = createSDK('base');
    const sessionManager = new SessionManager({ sdk });

    console.log('\nRPC SDK initialized');

    // =========================================================================
    // Create a Session for Batch Operations
    // =========================================================================
    
    console.log('\nSECURITY Creating session for batch operations...');

    const session = await sessionManager.createSession({
        duration: 3600, // 1 hour
        maxValue: parseEther('1.0'),
        maxTotalValue: parseEther('5.0'),
        // Allow multiple action types
        allowedActions: ['transfer', 'execute', 'approve'],
    });

    console.log(`OK Session created: ${session.id}`);

    // =========================================================================
    // Example 1: Multi-Send (Airdrop Pattern)
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log(' Example 1: Multi-Send (Airdrop)');
    console.log('='.repeat(50));

    const recipients = [
        { address: '0x1111111111111111111111111111111111111111', amount: parseEther('0.01') },
        { address: '0x2222222222222222222222222222222222222222', amount: parseEther('0.02') },
        { address: '0x3333333333333333333333333333333333333333', amount: parseEther('0.015') },
        { address: '0x4444444444444444444444444444444444444444', amount: parseEther('0.025') },
        { address: '0x5555555555555555555555555555555555555555', amount: parseEther('0.01') },
    ];

    console.log(`\nNOTE Sending to ${recipients.length} recipients in one transaction...`);

    try {
        const result = await sessionManager.executeBatchWithSession(
            recipients.map((r) => ({
                action: 'transfer',
                token: 'native',
                recipient: r.address,
                amount: r.amount,
            })),
            session
        );

        console.log('OK Multi-send complete!');
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Recipients: ${recipients.length}`);
        console.log(`   Total: ${formatEther(recipients.reduce((s, r) => s + r.amount, 0n))} ETH`);
        console.log(`   Gas Used: ${result.gasUsed}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }

    // =========================================================================
    // Example 2: DeFi Workflow (Approve + Swap + Stake)
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log(' Example 2: DeFi Workflow');
    console.log('='.repeat(50));

    console.log(`
Executing complex DeFi workflow:
1. Approve USDC for DEX
2. Swap USDC → ETH
3. Stake ETH
4. Claim existing rewards
    `);

    try {
        const workflow = await sessionManager.executeBatchWithSession([
            // Step 1: Approve USDC
            {
                action: 'execute',
                target: CONTRACTS.USDC,
                data: encodeApprove(CONTRACTS.DEX, parseUnits('1000', 6)),
                value: 0n,
            },
            // Step 2: Swap USDC for ETH
            {
                action: 'execute',
                target: CONTRACTS.DEX,
                data: encodeSwap(CONTRACTS.USDC, 'native', parseUnits('100', 6)),
                value: 0n,
            },
            // Step 3: Stake ETH
            {
                action: 'execute',
                target: CONTRACTS.STAKING,
                data: encodeStake(),
                value: parseEther('0.5'),
            },
            // Step 4: Claim rewards
            {
                action: 'execute',
                target: CONTRACTS.STAKING,
                data: encodeClaim(),
                value: 0n,
            },
        ], session);

        console.log('OK DeFi workflow complete!');
        console.log(`   TX Hash: ${workflow.transactionHash}`);
        console.log(`   Operations: 4`);
        console.log(`   Gas Saved: ~60% vs individual transactions`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }

    // =========================================================================
    // Example 3: Gaming Actions
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log(' Example 3: Gaming Actions');
    console.log('='.repeat(50));

    console.log(`
Simulating game session:
- Buy items from marketplace
- Equip items to character
- Join tournament (entry fee)
    `);

    const GAME_CONTRACT = '0xGAME000000000000000000000000000000000000';

    try {
        const gameActions = await sessionManager.executeBatchWithSession([
            // Buy sword
            {
                action: 'execute',
                target: GAME_CONTRACT,
                data: encodeBuyItem('sword', 1),
                value: parseEther('0.01'),
            },
            // Buy shield
            {
                action: 'execute',
                target: GAME_CONTRACT,
                data: encodeBuyItem('shield', 1),
                value: parseEther('0.008'),
            },
            // Equip items
            {
                action: 'execute',
                target: GAME_CONTRACT,
                data: encodeEquipItems(['sword', 'shield']),
                value: 0n,
            },
            // Join tournament
            {
                action: 'execute',
                target: GAME_CONTRACT,
                data: encodeJoinTournament(1234),
                value: parseEther('0.05'),
            },
        ], session);

        console.log('OK Game actions complete!');
        console.log(`   All items purchased and equipped`);
        console.log(`   Tournament entry confirmed`);
        console.log(`   TX: ${gameActions.transactionHash}`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`ERROR Error: ${error.message}`);
        }
    }

    // =========================================================================
    // Session Summary
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log(' Session Summary');
    console.log('='.repeat(50));

    const status = await sessionManager.getSessionStatus(session.id);
    console.log(`\n   Session ID: ${session.id}`);
    console.log(`   Transactions: ${status.transactionCount}`);
    console.log(`   Total Value: ${formatEther(status.totalValueSpent)} ETH`);
    console.log(`   Time Used: ${Math.floor((Date.now() - session.createdAt) / 1000)}s`);
    console.log(`   Time Remaining: ${status.timeRemaining}s`);
}

// ============================================================================
// Helper Functions (encoding contract calls)
// ============================================================================

function encodeApprove(spender: string, amount: bigint): string {
    // ERC20 approve(address,uint256)
    const selector = '0x095ea7b3';
    const paddedSpender = spender.slice(2).padStart(64, '0');
    const paddedAmount = amount.toString(16).padStart(64, '0');
    return `${selector}${paddedSpender}${paddedAmount}`;
}

function encodeSwap(tokenIn: string, tokenOut: string, amountIn: bigint): string {
    // Simplified swap encoding
    return `0xswap${tokenIn}${tokenOut}${amountIn}`;
}

function encodeStake(): string {
    // stake()
    return '0x3a4b66f1';
}

function encodeClaim(): string {
    // claim()
    return '0x4e71d92d';
}

function encodeBuyItem(item: string, quantity: number): string {
    // buyItem(string,uint256)
    return `0xbuy${item}${quantity}`;
}

function encodeEquipItems(items: string[]): string {
    // equipItems(string[])
    return `0xequip${items.join('')}`;
}

function encodeJoinTournament(tournamentId: number): string {
    // joinTournament(uint256)
    return `0xjoin${tournamentId}`;
}

// Run the example
main().catch(console.error);
