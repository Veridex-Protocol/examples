/**
 * Gaming Integration
 * 
 * Example of integrating Veridex for in-game asset management and payments.
 * Uses session keys for seamless gameplay without repeated biometric prompts.
 * 
 * Run: npx ts-node integrations/gaming/index.ts
 */

import { createSDK, SessionManager } from 'veridex-sdk';
import { parseEther, formatEther, ethers } from 'ethers';

// Game contract ABIs (simplified)
const GAME_ABI = [
    // Player management
    'function createPlayer(string name) external payable returns (uint256)',
    'function getPlayer(address wallet) external view returns (tuple(uint256 id, string name, uint256 level, uint256 xp, uint256[] inventory, uint256 balance))',
    
    // In-game economy
    'function buyItem(uint256 itemId, uint256 quantity) external payable',
    'function sellItem(uint256 itemId, uint256 quantity) external',
    'function equipItem(uint256 itemId) external',
    'function unequipItem(uint256 slot) external',
    
    // Gameplay
    'function startMission(uint256 missionId) external',
    'function completeMission(uint256 missionId, bytes proof) external',
    'function claimRewards() external',
    
    // Trading
    'function createTrade(uint256[] offerItems, uint256[] wantItems) external',
    'function acceptTrade(uint256 tradeId) external',
    
    // Tournaments
    'function joinTournament(uint256 tournamentId) external payable',
    'function submitScore(uint256 tournamentId, uint256 score, bytes proof) external',
    'function claimTournamentReward(uint256 tournamentId) external',
    
    // Events
    'event PlayerCreated(uint256 indexed playerId, address indexed wallet, string name)',
    'event ItemPurchased(address indexed player, uint256 itemId, uint256 quantity, uint256 cost)',
    'event MissionCompleted(address indexed player, uint256 missionId, uint256 reward)',
    'event TournamentJoined(address indexed player, uint256 tournamentId)',
];

const GAME_CONTRACT = process.env.GAME_CONTRACT || '0x...';

async function main() {
    console.log('🎮 Veridex Gaming Integration\n');
    console.log('='.repeat(60));

    // =========================================================================
    // Player Setup
    // =========================================================================
    
    console.log('\n📦 PLAYER SETUP');
    console.log('='.repeat(60));

    const sdk = createSDK('base', {
        relayerUrl: process.env.RELAYER_URL, // Gasless for better UX
    });

    console.log('\n🔐 Creating game account with passkey...');
    await sdk.passkey.register('player@game.com', 'GamePlayer123');
    
    const playerWallet = sdk.getVaultAddress();
    console.log(`✅ Wallet created: ${playerWallet}`);

    // Create player in game
    const gameIface = new ethers.Interface(GAME_ABI);
    
    console.log('\n👤 Creating in-game character...');
    const createPlayerData = gameIface.encodeFunctionData('createPlayer', ['DragonSlayer']);
    
    const createResult = await sdk.execute({
        target: GAME_CONTRACT,
        data: createPlayerData,
        value: parseEther('0.01'), // Registration fee
    });

    console.log('✅ Character created: DragonSlayer');
    console.log(`   TX: ${createResult.transactionHash}`);

    // =========================================================================
    // Game Session (Session Keys for Gameplay)
    // =========================================================================
    
    console.log('\n📦 GAME SESSION');
    console.log('='.repeat(60));

    const sessionManager = new SessionManager({ sdk });

    console.log('\n🎯 Creating game session...');
    console.log('   (One passkey sign = hours of uninterrupted gameplay)\n');

    // Create session for gameplay
    const gameSession = await sessionManager.createSession({
        duration: 4 * 3600, // 4 hours
        maxValue: parseEther('0.5'), // Max 0.5 ETH for in-game purchases
        maxTotalValue: parseEther('2.0'), // Total session limit
        allowedActions: ['execute'],
        // Optional: restrict to game contract only
        // allowedTargets: [GAME_CONTRACT],
    });

    console.log('✅ Game session created!');
    console.log(`   Duration: 4 hours`);
    console.log(`   Max per TX: 0.5 ETH`);
    console.log(`   Session total: 2 ETH`);

    // =========================================================================
    // Gameplay Actions (No Biometric Prompts!)
    // =========================================================================
    
    console.log('\n📦 GAMEPLAY ACTIONS');
    console.log('='.repeat(60));

    console.log('\n🎮 Playing the game...\n');

    // Action 1: Buy health potions
    console.log('   🧪 Buying 10 health potions...');
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('buyItem', [1, 10]), // Item ID 1 = health potion
        value: parseEther('0.01'),
    }, gameSession);
    console.log('   ✅ 10x Health Potion acquired!');

    // Action 2: Buy a sword
    console.log('   ⚔️ Buying legendary sword...');
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('buyItem', [42, 1]), // Item ID 42 = legendary sword
        value: parseEther('0.1'),
    }, gameSession);
    console.log('   ✅ Legendary Sword acquired!');

    // Action 3: Equip the sword
    console.log('   🛡️ Equipping sword...');
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('equipItem', [42]),
        value: 0n,
    }, gameSession);
    console.log('   ✅ Sword equipped!');

    // Action 4: Start a mission
    console.log('   🗺️ Starting Dragon\'s Lair mission...');
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('startMission', [5]), // Mission ID 5
        value: 0n,
    }, gameSession);
    console.log('   ✅ Mission started!');

    // Simulate gameplay...
    console.log('   ⏳ Playing mission...');
    await sleep(2000);

    // Action 5: Complete mission
    console.log('   🏆 Completing mission...');
    const missionProof = '0x' + '00'.repeat(64); // Mock proof
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('completeMission', [5, missionProof]),
        value: 0n,
    }, gameSession);
    console.log('   ✅ Mission completed! +500 XP, +0.05 ETH');

    // Action 6: Claim rewards
    console.log('   💰 Claiming rewards...');
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('claimRewards', []),
        value: 0n,
    }, gameSession);
    console.log('   ✅ Rewards claimed!');

    console.log('\n🎉 6 game actions executed without ANY additional prompts!');

    // =========================================================================
    // Tournament Entry
    // =========================================================================
    
    console.log('\n📦 TOURNAMENT');
    console.log('='.repeat(60));

    console.log('\n🏆 Joining weekend tournament...');
    
    await sessionManager.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('joinTournament', [1]), // Tournament ID 1
        value: parseEther('0.1'), // Entry fee
    }, gameSession);

    console.log('✅ Tournament entry confirmed!');
    console.log('   Entry Fee: 0.1 ETH');
    console.log('   Prize Pool: 10 ETH');
    console.log('   Starts: Tomorrow 9:00 UTC');

    // =========================================================================
    // Session Summary
    // =========================================================================
    
    console.log('\n📦 SESSION SUMMARY');
    console.log('='.repeat(60));

    const status = await sessionManager.getSessionStatus(gameSession.id);
    console.log(`\n📊 Game Session Stats:`);
    console.log(`   Actions executed: ${status.transactionCount}`);
    console.log(`   ETH spent: ${formatEther(status.totalValueSpent)}`);
    console.log(`   Time remaining: ${Math.floor(status.timeRemaining / 60)} minutes`);
    console.log(`   Spending remaining: ${formatEther(status.remainingValue)} ETH`);
}

// ============================================================================
// Mobile Game Integration Pattern
// ============================================================================

async function mobileGamePattern() {
    console.log('\n' + '='.repeat(60));
    console.log('📱 MOBILE GAME INTEGRATION PATTERN');
    console.log('='.repeat(60));

    console.log(`
1. FIRST LAUNCH (Onboarding)
   \`\`\`javascript
   // User creates account with biometrics
   const sdk = createSDK('base');
   await sdk.passkey.register(email, gamertag);
   
   // Vault is sponsored (user pays nothing)
   await sdk.createVaultSponsored();
   
   // Store credential ID in secure storage
   await SecureStore.set('veridex_credential', credential.id);
   \`\`\`

2. SUBSEQUENT LAUNCHES
   \`\`\`javascript
   // Retrieve stored credential
   const credentialId = await SecureStore.get('veridex_credential');
   
   // Restore SDK with credential
   const sdk = createSDK('base');
   await sdk.passkey.loadCredential(credentialId);
   \`\`\`

3. START PLAY SESSION
   \`\`\`javascript
   // Create session at game start (one biometric prompt)
   const session = await sessionManager.createSession({
       duration: 4 * 3600, // 4 hours
       maxValue: parseEther('1.0'),
   });
   
   // Store session for gameplay
   GameState.session = session;
   \`\`\`

4. IN-GAME PURCHASES (No Prompts!)
   \`\`\`javascript
   // Called from game UI button
   async function buyItem(itemId, price) {
       await sessionManager.executeWithSession({
           action: 'execute',
           target: GAME_CONTRACT,
           data: encodeBuyItem(itemId),
           value: price,
       }, GameState.session);
       
       // Update UI
       showItemAcquired(itemId);
   }
   \`\`\`

5. SESSION EXPIRY HANDLING
   \`\`\`javascript
   sessionManager.on('sessionExpiring', (session) => {
       // Show UI to extend session
       showExtendSessionPrompt();
   });
   
   sessionManager.on('sessionExpired', () => {
       // Require new biometric auth to continue
       showReauthenticatePrompt();
   });
   \`\`\`

6. BACKGROUND SYNC
   \`\`\`javascript
   // When app goes to background
   AppState.addEventListener('change', (state) => {
       if (state === 'background') {
           // Persist session state
           saveSessionState(GameState.session);
       }
   });
   \`\`\`
    `);
}

// ============================================================================
// Player Trading Example
// ============================================================================

async function playerTrading() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 PLAYER-TO-PLAYER TRADING');
    console.log('='.repeat(60));

    const player1Sdk = createSDK('base');
    const player2Sdk = createSDK('base');

    // Both players have existing sessions
    const sessionManager1 = new SessionManager({ sdk: player1Sdk });
    const sessionManager2 = new SessionManager({ sdk: player2Sdk });

    const gameIface = new ethers.Interface(GAME_ABI);

    console.log('\n🤝 Setting up trade...');
    console.log('   Player 1 offers: Legendary Sword, 5 Gems');
    console.log('   Player 2 offers: Dragon Shield, 10 Gold Bars');

    // Player 1 creates trade offer
    console.log('\n📝 Player 1 creating trade offer...');
    
    const session1 = await sessionManager1.createSession({
        duration: 3600,
        maxValue: 0n,
        allowedActions: ['execute'],
    });

    await sessionManager1.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('createTrade', [
            [42, 100, 100, 100, 100, 100], // Offering items
            [55, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200], // Wanting items
        ]),
        value: 0n,
    }, session1);
    console.log('   ✅ Trade offer created');

    // Player 2 accepts trade
    console.log('\n✅ Player 2 accepting trade...');
    
    const session2 = await sessionManager2.createSession({
        duration: 3600,
        maxValue: 0n,
        allowedActions: ['execute'],
    });

    await sessionManager2.executeWithSession({
        action: 'execute',
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('acceptTrade', [123]), // Trade ID
        value: 0n,
    }, session2);
    console.log('   ✅ Trade completed!');

    console.log('\n🎉 Items swapped atomically!');
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run examples
main()
    .then(() => mobileGamePattern())
    .then(() => playerTrading())
    .catch(console.error);
