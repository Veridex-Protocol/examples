/**
 * DeFi Yield Vault Integration Example
 * 
 * This example demonstrates how to integrate Veridex vaults with
 * DeFi protocols for automated yield farming.
 * 
 * Use cases:
 * - Automated yield optimization
 * - Multi-protocol DeFi strategies
 * - Gasless DeFi operations via session keys
 */

import { createSDK, createSessionSDK } from '@veridex/sdk';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface YieldVault {
    address: string;
    name: string;
    apy: number;
    tvl: bigint;
    token: string;
    protocol: string;
}

interface Position {
    vault: YieldVault;
    deposited: bigint;
    earned: bigint;
    entryTime: Date;
}

interface Strategy {
    name: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    targetApy: number;
    protocols: string[];
}

class DeFiVaultManager {
    private sdk: ReturnType<typeof createSDK>;
    private sessionSdk: ReturnType<typeof createSessionSDK> | null = null;
    private positions: Map<string, Position> = new Map();
    private availableVaults: YieldVault[] = [];
    private chain: string;

    constructor(chain: string) {
        this.chain = chain;
        this.sdk = createSDK(chain);
        this.initializeVaults();
    }

    /**
     * Initialize with known yield vaults
     */
    private initializeVaults(): void {
        // Simulated yield vaults (in production, fetch from protocol)
        this.availableVaults = [
            {
                address: '0x' + 'a1'.repeat(20),
                name: 'Aave USDC',
                apy: 4.5,
                tvl: ethers.parseUnits('50000000', 6),
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
                protocol: 'Aave',
            },
            {
                address: '0x' + 'b2'.repeat(20),
                name: 'Compound ETH',
                apy: 3.2,
                tvl: ethers.parseEther('25000'),
                token: ethers.ZeroAddress, // ETH
                protocol: 'Compound',
            },
            {
                address: '0x' + 'c3'.repeat(20),
                name: 'Yearn USDC',
                apy: 7.8,
                tvl: ethers.parseUnits('30000000', 6),
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                protocol: 'Yearn',
            },
            {
                address: '0x' + 'd4'.repeat(20),
                name: 'Lido stETH',
                apy: 4.0,
                tvl: ethers.parseEther('1000000'),
                token: ethers.ZeroAddress,
                protocol: 'Lido',
            },
        ];
    }

    /**
     * Create a session key for automated DeFi operations
     */
    async createDeFiSession(
        vaultAddress: string,
        allowedProtocols: string[],
        maxDailyVolume: bigint,
        durationDays: number
    ): Promise<string> {
        console.log(' Creating DeFi session key...');

        // Get vault addresses for allowed protocols
        const allowedContracts = this.availableVaults
            .filter(v => allowedProtocols.includes(v.protocol))
            .map(v => v.address);

        const sessionId = ethers.id(`defi-session:${vaultAddress}:${Date.now()}`).slice(0, 18);

        // In production, create actual session via SDK
        // this.sessionSdk = await createSessionSDK(this.chain, {
        //     sessionKey: sessionId,
        //     constraints: {
        //         allowedContracts,
        //         maxValue: maxDailyVolume,
        //         allowedMethods: ['deposit', 'withdraw', 'claim'],
        //     },
        // });

        console.log(`   OK Session created: ${sessionId}`);
        console.log(`   Allowed protocols: ${allowedProtocols.join(', ')}`);
        console.log(`   Max daily volume: ${ethers.formatEther(maxDailyVolume)} ETH`);
        console.log(`   Expires in: ${durationDays} days`);

        return sessionId;
    }

    /**
     * Get available yield vaults
     */
    getAvailableVaults(
        minApy?: number,
        maxRisk?: 'low' | 'medium' | 'high'
    ): YieldVault[] {
        let vaults = [...this.availableVaults];

        if (minApy !== undefined) {
            vaults = vaults.filter(v => v.apy >= minApy);
        }

        // Sort by APY descending
        vaults.sort((a, b) => b.apy - a.apy);

        return vaults;
    }

    /**
     * Deposit into a yield vault
     */
    async deposit(
        vaultAddress: string,
        amount: bigint
    ): Promise<string> {
        const vault = this.availableVaults.find(v => v.address === vaultAddress);
        if (!vault) throw new Error('Vault not found');

        console.log(`\n Depositing into ${vault.name}...`);
        console.log(`   Amount: ${ethers.formatEther(amount)} ${vault.token === ethers.ZeroAddress ? 'ETH' : 'tokens'}`);
        console.log(`   Current APY: ${vault.apy}%`);

        // In production, call the actual vault contract
        const txHash = ethers.id(`deposit:${vaultAddress}:${amount}:${Date.now()}`);

        // Track position
        const positionId = `${vaultAddress}:${Date.now()}`;
        this.positions.set(positionId, {
            vault,
            deposited: amount,
            earned: 0n,
            entryTime: new Date(),
        });

        console.log(`   OK Deposited! TX: ${txHash.slice(0, 20)}...`);
        console.log(`   Position ID: ${positionId.slice(0, 20)}...`);

        return txHash;
    }

    /**
     * Withdraw from a yield vault
     */
    async withdraw(
        positionId: string,
        amount?: bigint
    ): Promise<string> {
        const position = this.positions.get(positionId);
        if (!position) throw new Error('Position not found');

        const withdrawAmount = amount || position.deposited;

        console.log(`\nSEND Withdrawing from ${position.vault.name}...`);
        console.log(`   Amount: ${ethers.formatEther(withdrawAmount)}`);

        // Calculate simulated earnings
        const daysHeld = (Date.now() - position.entryTime.getTime()) / (1000 * 60 * 60 * 24);
        const earned = (position.deposited * BigInt(Math.floor(position.vault.apy * 100))) / 10000n / 365n * BigInt(Math.floor(daysHeld));

        console.log(`   Earned: ~${ethers.formatEther(earned)} (${daysHeld.toFixed(1)} days @ ${position.vault.apy}% APY)`);

        // In production, call the actual vault contract
        const txHash = ethers.id(`withdraw:${positionId}:${withdrawAmount}:${Date.now()}`);

        if (!amount || amount >= position.deposited) {
            this.positions.delete(positionId);
        } else {
            position.deposited -= amount;
        }

        console.log(`   OK Withdrawn! TX: ${txHash.slice(0, 20)}...`);

        return txHash;
    }

    /**
     * Claim rewards from a position
     */
    async claimRewards(positionId: string): Promise<string> {
        const position = this.positions.get(positionId);
        if (!position) throw new Error('Position not found');

        console.log(`\nREWARD Claiming rewards from ${position.vault.name}...`);

        // In production, call the actual vault contract
        const txHash = ethers.id(`claim:${positionId}:${Date.now()}`);

        console.log(`   OK Rewards claimed! TX: ${txHash.slice(0, 20)}...`);

        return txHash;
    }

    /**
     * Execute a yield optimization strategy
     */
    async executeStrategy(
        strategy: Strategy,
        totalAmount: bigint
    ): Promise<void> {
        console.log(`\n Executing Strategy: ${strategy.name}`);
        console.log(`   Description: ${strategy.description}`);
        console.log(`   Risk Level: ${strategy.riskLevel}`);
        console.log(`   Target APY: ${strategy.targetApy}%`);
        console.log('='.repeat(50));

        // Filter vaults by strategy protocols
        const eligibleVaults = this.availableVaults
            .filter(v => strategy.protocols.includes(v.protocol))
            .sort((a, b) => b.apy - a.apy);

        if (eligibleVaults.length === 0) {
            throw new Error('No vaults match strategy criteria');
        }

        // Allocate funds across vaults
        const allocation = this.calculateAllocation(eligibleVaults, strategy);

        console.log(`\n Allocation:`);
        for (const [vault, percentage] of allocation) {
            const amount = (totalAmount * BigInt(percentage)) / 100n;
            console.log(`   ${vault.name}: ${percentage}% (${ethers.formatEther(amount)})`);
            
            if (amount > 0n) {
                await this.deposit(vault.address, amount);
            }
        }

        console.log(`\nOK Strategy executed successfully!`);
    }

    /**
     * Get portfolio summary
     */
    getPortfolioSummary(): {
        totalDeposited: bigint;
        totalEarned: bigint;
        weightedApy: number;
        positions: Position[];
    } {
        let totalDeposited = 0n;
        let totalEarned = 0n;
        let weightedApySum = 0n;

        for (const position of this.positions.values()) {
            totalDeposited += position.deposited;
            
            // Calculate earnings
            const daysHeld = (Date.now() - position.entryTime.getTime()) / (1000 * 60 * 60 * 24);
            const earned = (position.deposited * BigInt(Math.floor(position.vault.apy * 100))) / 10000n / 365n * BigInt(Math.floor(daysHeld));
            totalEarned += earned;
            
            weightedApySum += BigInt(Math.floor(position.vault.apy * 100)) * position.deposited;
        }

        const weightedApy = totalDeposited > 0n 
            ? Number(weightedApySum / totalDeposited) / 100
            : 0;

        return {
            totalDeposited,
            totalEarned,
            weightedApy,
            positions: Array.from(this.positions.values()),
        };
    }

    private calculateAllocation(
        vaults: YieldVault[],
        strategy: Strategy
    ): Map<YieldVault, number> {
        const allocation = new Map<YieldVault, number>();

        // Simple allocation: higher APY = higher allocation (capped)
        const totalApy = vaults.reduce((sum, v) => sum + v.apy, 0);

        let remaining = 100;
        for (let i = 0; i < vaults.length; i++) {
            const vault = vaults[i];
            let percentage: number;

            if (i === vaults.length - 1) {
                percentage = remaining;
            } else {
                percentage = Math.floor((vault.apy / totalApy) * 100);
                percentage = Math.min(percentage, 50); // Max 50% per vault
            }

            allocation.set(vault, percentage);
            remaining -= percentage;
        }

        return allocation;
    }
}

async function main() {
    console.log('BALANCE Veridex DeFi Yield Vault Integration\n');
    console.log('='.repeat(50));

    const defi = new DeFiVaultManager('base-sepolia');

    // =========================================================================
    // Step 1: View available yield vaults
    // =========================================================================
    
    console.log('\nNOTE Step 1: Available Yield Vaults\n');
    
    const vaults = defi.getAvailableVaults();
    console.log('Vault                  Protocol     APY');
    console.log('-'.repeat(45));
    for (const vault of vaults) {
        console.log(`${vault.name.padEnd(22)} ${vault.protocol.padEnd(12)} ${vault.apy}%`);
    }

    // =========================================================================
    // Step 2: Create DeFi session key for automation
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 2: Create DeFi Session Key\n');

    const vaultAddress = '0x' + 'user'.repeat(10);
    await defi.createDeFiSession(
        vaultAddress,
        ['Aave', 'Compound', 'Yearn'],
        ethers.parseEther('10'), // Max 10 ETH daily
        30 // 30 days
    );

    // =========================================================================
    // Step 3: Execute a yield strategy
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 3: Execute Yield Strategy\n');

    const conservativeStrategy: Strategy = {
        name: 'Conservative Yield',
        description: 'Low-risk stablecoin yields across blue-chip protocols',
        riskLevel: 'low',
        targetApy: 5,
        protocols: ['Aave', 'Compound'],
    };

    await defi.executeStrategy(conservativeStrategy, ethers.parseEther('5'));

    // =========================================================================
    // Step 4: View portfolio
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('NOTE Step 4: Portfolio Summary\n');

    const portfolio = defi.getPortfolioSummary();
    console.log(`Total Deposited: ${ethers.formatEther(portfolio.totalDeposited)} ETH`);
    console.log(`Total Earned: ${ethers.formatEther(portfolio.totalEarned)} ETH`);
    console.log(`Weighted APY: ${portfolio.weightedApy.toFixed(2)}%`);
    console.log(`Active Positions: ${portfolio.positions.length}`);

    // =========================================================================
    // Integration Guide
    // =========================================================================
    
    console.log('\n' + '='.repeat(50));
    console.log('DOCS Integration Guide');
    console.log('='.repeat(50));

    console.log(`
    // Using Veridex SDK for DeFi automation:
    
    const sdk = createSDK('base');
    
    // 1. Create a constrained session for DeFi operations
    const defiSession = await sdk.createSessionKey({
        constraints: {
            allowedContracts: [
                AAVE_POOL,
                COMPOUND_COMET,
                YEARN_VAULT,
            ],
            allowedMethods: ['deposit', 'withdraw', 'claim'],
            maxValue: parseEther('10'),
            rateLimitPerDay: 5,
        },
        duration: 30 * 24 * 60 * 60, // 30 days
    });
    
    // 2. Automated rebalancing (can run server-side with session key)
    async function rebalance() {
        const positions = await getPositions();
        const bestVault = await findBestYield(positions.token);
        
        if (bestVault.apy > positions.currentApy + 0.5) {
            // Migrate to better yield
            await sdk.withSession(defiSession).execute([
                { to: currentVault, data: encodeWithdraw(amount) },
                { to: bestVault, data: encodeDeposit(amount) },
            ]);
        }
    }
    
    // 3. Schedule rebalancing (e.g., via cron or keeper)
    setInterval(rebalance, 24 * 60 * 60 * 1000);
    
    // 4. Monitor with events
    sdk.on('sessionUsed', (session, tx) => {
        console.log('DeFi operation executed:', tx.hash);
    });
    
    sdk.on('yieldClaimed', (vault, amount) => {
        console.log('Yield claimed:', formatEther(amount));
    });
    `);

    console.log('\nOK DeFi integration example complete!');
}

main().catch(console.error);
