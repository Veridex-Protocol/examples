/**
 * Gaming Integration
 * 
 * Example of integrating Veridex for in-game asset management and payments.
 * Uses session keys for seamless gameplay without repeated biometric prompts.
 * 
 * Run: npx ts-node integrations/gaming/index.ts
 */

import { createSDK, SessionManager, EVMHubClientAdapter } from '@veridex/sdk';
import { parseEther, formatEther, ethers, Wallet, JsonRpcProvider, getBytes } from 'ethers';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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
    console.log(' Veridex Gaming Integration\n');
    console.log('='.repeat(60));

    // =========================================================================
    // Player Setup
    // =========================================================================
    
    console.log('\nPACKAGE PLAYER SETUP');
    console.log('='.repeat(60));

    const sdk = createSDK('base', {
        relayerUrl: process.env.RELAYER_URL, // Gasless for better UX
    });

    console.log('\nSECURITY Creating game account with passkey...');
    await sdk.passkey.register('player@game.com', 'GamePlayer123');
    
    const playerWallet = sdk.getVaultAddress();
    console.log(`OK Wallet created: ${playerWallet}`);

    // Create player in game
    const gameIface = new ethers.Interface(GAME_ABI);
    
    console.log('\n Creating in-game character...');
    const createPlayerData = gameIface.encodeFunctionData('createPlayer', ['DragonSlayer']);
    
    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    const chainConfig = sdk.getChainConfig();

    const createResult = await sdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: GAME_CONTRACT,
        data: createPlayerData,
        value: parseEther('0.01'), // Registration fee
    }, signer);

    console.log('OK Character created: DragonSlayer');
    console.log(`   TX: ${createResult.transactionHash}`);

    // =========================================================================
    // Game Session (Session Keys for Gameplay)
    // =========================================================================
    
    console.log('\nPACKAGE GAME SESSION');
    console.log('='.repeat(60));

    const credential = sdk.getCredential();
    if (!credential) {
        throw new Error('No credential set.');
    }

    const hubClient = new EVMHubClientAdapter(sdk.getChainClient() as any, signer as any);
    const sessionManager = new SessionManager(
        credential,
        hubClient,
        (challenge) => sdk.passkey.sign(challenge),
        { duration: 4 * 3600, maxValue: parseEther('0.5') },
    );

    console.log('\n Creating game session...');
    console.log('   (One passkey sign = hours of uninterrupted gameplay)\n');

    const gameSession = await sessionManager.createSession();

    console.log('OK Game session created!');
    console.log(`   Duration: 4 hours`);
    console.log(`   Max per TX: 0.5 ETH`);
    console.log(`   Session Key: ${gameSession.keyHash.slice(0, 16)}...`);

    // =========================================================================
    // Gameplay Actions (No Biometric Prompts!)
    // =========================================================================
    
    console.log('\nPACKAGE GAMEPLAY ACTIONS');
    console.log('='.repeat(60));

    console.log('\n Playing the game...\n');

    // Helper to sign a game action with the session
    async function signGameAction(data: string, value: bigint) {
        return sessionManager.signAction({
            action: 'execute',
            targetChain: chainConfig.wormholeChainId,
            payload: getBytes(data),
            nonce: Number(await sdk.getNonce()),
            value,
        });
    }

    // Action 1: Buy health potions
    console.log('    Buying 10 health potions...');
    await signGameAction(
        gameIface.encodeFunctionData('buyItem', [1, 10]),
        parseEther('0.01'),
    );
    console.log('   OK 10x Health Potion acquired!');

    // Action 2: Buy a sword
    console.log('    Buying legendary sword...');
    await signGameAction(
        gameIface.encodeFunctionData('buyItem', [42, 1]),
        parseEther('0.1'),
    );
    console.log('   OK Legendary Sword acquired!');

    // Action 3: Equip the sword
    console.log('    Equipping sword...');
    await signGameAction(
        gameIface.encodeFunctionData('equipItem', [42]),
        0n,
    );
    console.log('   OK Sword equipped!');

    // Action 4: Start a mission
    console.log('    Starting Dragon\'s Lair mission...');
    await signGameAction(
        gameIface.encodeFunctionData('startMission', [5]),
        0n,
    );
    console.log('   OK Mission started!');

    // Simulate gameplay...
    console.log('   WAIT Playing mission...');
    await sleep(2000);

    // Action 5: Complete mission
    console.log('    Completing mission...');
    const missionProof = '0x' + '00'.repeat(64); // Mock proof
    await signGameAction(
        gameIface.encodeFunctionData('completeMission', [5, missionProof]),
        0n,
    );
    console.log('   OK Mission completed! +500 XP, +0.05 ETH');

    // Action 6: Claim rewards
    console.log('   BALANCE Claiming rewards...');
    await signGameAction(
        gameIface.encodeFunctionData('claimRewards', []),
        0n,
    );
    console.log('   OK Rewards claimed!');

    console.log('\nDONE 6 game actions executed without ANY additional prompts!');

    // =========================================================================
    // Tournament Entry
    // =========================================================================
    
    console.log('\nPACKAGE TOURNAMENT');
    console.log('='.repeat(60));

    console.log('\n Joining weekend tournament...');
    
    await signGameAction(
        gameIface.encodeFunctionData('joinTournament', [1]),
        parseEther('0.1'),
    );

    console.log('OK Tournament entry confirmed!');
    console.log('   Entry Fee: 0.1 ETH');
    console.log('   Prize Pool: 10 ETH');
    console.log('   Starts: Tomorrow 9:00 UTC');

    // =========================================================================
    // Session Summary
    // =========================================================================
    
    console.log('\nPACKAGE SESSION SUMMARY');
    console.log('='.repeat(60));

    const timeRemaining = sessionManager.getTimeRemaining();
    console.log(`\n Game Session Stats:`);
    console.log(`   Session active: ${sessionManager.isActive() ? 'Yes' : 'No'}`);
    console.log(`   Time remaining: ${Math.floor(timeRemaining / 60)} minutes`);
    console.log(`   Max value per TX: ${formatEther(gameSession.maxValue)} ETH`);
}

// ============================================================================
// Mobile Game Integration Pattern
// ============================================================================

async function mobileGamePattern() {
    console.log('\n' + '='.repeat(60));
    console.log(' MOBILE GAME INTEGRATION PATTERN');
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
    console.log('IN PROGRESS PLAYER-TO-PLAYER TRADING');
    console.log('='.repeat(60));

    const player1Sdk = createSDK('base');
    const player2Sdk = createSDK('base');

    const provider = new JsonRpcProvider('https://sepolia.base.org');
    const signer = new Wallet(PRIVATE_KEY, provider);
    const chainConfig = player1Sdk.getChainConfig();
    const gameIface = new ethers.Interface(GAME_ABI);

    console.log('\n Setting up trade...');
    console.log('   Player 1 offers: Legendary Sword, 5 Gems');
    console.log('   Player 2 offers: Dragon Shield, 10 Gold Bars');

    // Player 1 creates trade offer
    console.log('\nNOTE Player 1 creating trade offer...');
    
    await player1Sdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('createTrade', [
            [42, 100, 100, 100, 100, 100], // Offering items
            [55, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200], // Wanting items
        ]),
        value: 0n,
    }, signer);
    console.log('   OK Trade offer created');

    // Player 2 accepts trade
    console.log('\nOK Player 2 accepting trade...');
    
    await player2Sdk.execute({
        targetChain: chainConfig.wormholeChainId,
        target: GAME_CONTRACT,
        data: gameIface.encodeFunctionData('acceptTrade', [123]), // Trade ID
        value: 0n,
    }, signer);
    console.log('   OK Trade completed!');

    console.log('\nDONE Items swapped atomically!');
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
