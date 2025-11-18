/**
 * OmegaZoid Burn Tracker
 * Monitors Solana blockchain for $OZOID token burns
 * Tracks burns to incinerator address and stores data
 */

const solanaWeb3 = require('@solana/web3.js');
const { Connection, PublicKey } = solanaWeb3;

// Configuration
const TOKEN_MINT = '3RNx8fsFmumKhypgL8KdiGvvopBkiaWNNMg4zNPLpump';
const BURN_ADDRESS = '1nc1nerator11111111111111111111111111111111';
// Use Helius RPC with API key to avoid 429 rate limits
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '4d9203cb-518a-4cbd-a661-d8e3105a2954';
const RPC_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Initialize connection
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// In-memory storage (replace with database in production)
let burnHistory = [];
let totalBurned = 0;
let lastSignature = null;

/**
 * Get associated token address
 */
async function getAssociatedTokenAddress(ownerPublicKey, mintPublicKey, tokenProgramId) {
    // Support both Token Program and Token-2022
    const TOKEN_PROGRAM_ID = tokenProgramId || new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'); // Token-2022 for pump.fun
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    
    const [address] = await PublicKey.findProgramAddress(
        [
            ownerPublicKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintPublicKey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return address;
}

/**
 * Fetch historical burns from blockchain
 */
async function fetchHistoricalBurns(limit = 100) {
    try {
        console.log('📊 Fetching historical burns...');
        
        const burnPublicKey = new PublicKey(BURN_ADDRESS);
        const mintPublicKey = new PublicKey(TOKEN_MINT);
        
        // Get burn address's token account
        const burnTokenAccount = await getAssociatedTokenAddress(burnPublicKey, mintPublicKey);
        
        // Get transaction signatures for this account
        const signatures = await connection.getSignaturesForAddress(
            burnTokenAccount,
            { limit }
        );
        
        console.log(`Found ${signatures.length} transactions`);
        
        // Process each transaction
        for (const sig of signatures) {
            const tx = await connection.getParsedTransaction(sig.signature, 'confirmed');
            
            if (!tx || !tx.meta) continue;
            
            // Look for SPL token transfers
            const instructions = tx.transaction.message.instructions;
            
            for (const instruction of instructions) {
                if (instruction.program === 'spl-token' && instruction.parsed?.type === 'transfer') {
                    const info = instruction.parsed.info;
                    
                    // Check if destination is burn account
                    if (info.destination === burnTokenAccount.toString()) {
                        const amount = parseFloat(info.amount) / 1000000; // Adjust for decimals
                        const burner = info.authority;
                        const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
                        
                        burnHistory.push({
                            signature: sig.signature,
                            burner,
                            amount,
                            timestamp,
                            reward: determineRewardTier(amount)
                        });
                        
                        totalBurned += amount;
                    }
                }
            }
        }
        
        console.log(`✅ Processed ${burnHistory.length} burns`);
        console.log(`🔥 Total burned: ${totalBurned.toLocaleString()} $OZOID`);
        
        return burnHistory;
    } catch (error) {
        console.error('Error fetching historical burns:', error);
        return [];
    }
}

/**
 * Monitor for new burns in real-time
 */
async function monitorBurns() {
    try {
        console.log('👀 Starting real-time burn monitoring...');
        
        const burnPublicKey = new PublicKey(BURN_ADDRESS);
        const mintPublicKey = new PublicKey(TOKEN_MINT);
        const burnTokenAccount = await getAssociatedTokenAddress(burnPublicKey, mintPublicKey);
        
        // Subscribe to account changes
        const subscriptionId = connection.onLogs(
            burnTokenAccount,
            async (logs) => {
                if (logs.err) {
                    console.log('Transaction failed');
                    return;
                }
                
                console.log('🔥 New burn detected!');
                console.log('Signature:', logs.signature);
                
                // Fetch transaction details
                const tx = await connection.getParsedTransaction(logs.signature, 'confirmed');
                
                if (!tx || !tx.meta) return;
                
                const instructions = tx.transaction.message.instructions;
                
                for (const instruction of instructions) {
                    if (instruction.program === 'spl-token' && instruction.parsed?.type === 'transfer') {
                        const info = instruction.parsed.info;
                        
                        if (info.destination === burnTokenAccount.toString()) {
                            const amount = parseFloat(info.amount) / 1000000;
                            const burner = info.authority;
                            const timestamp = new Date();
                            const reward = determineRewardTier(amount);
                            
                            const burnEvent = {
                                signature: logs.signature,
                                burner,
                                amount,
                                timestamp,
                                reward
                            };
                            
                            burnHistory.unshift(burnEvent);
                            totalBurned += amount;
                            
                            console.log(`💎 Amount: ${amount.toLocaleString()} $OZOID`);
                            console.log(`👤 Burner: ${burner}`);
                            console.log(`🏆 Reward: ${reward}`);
                            
                            // Notify about the burn
                            await notifyBurn(burnEvent);
                        }
                    }
                }
            },
            'confirmed'
        );
        
        console.log(`✅ Monitoring subscription ID: ${subscriptionId}`);
        
        // Keep alive
        process.on('SIGINT', () => {
            console.log('\n🛑 Stopping burn monitor...');
            connection.removeOnLogsListener(subscriptionId);
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Error monitoring burns:', error);
    }
}

/**
 * Determine reward tier based on burn amount
 */
function determineRewardTier(amount) {
    if (amount >= 100000) return 'Whale Status';
    if (amount >= 50000) return 'Governance Rights';
    if (amount >= 10000) return 'Exclusive NFT';
    if (amount >= 1000) return 'Bonus Multiplier';
    return 'None';
}

/**
 * Notify about new burn (can integrate with Telegram/Discord)
 */
async function notifyBurn(burnEvent) {
    // Log to console for now
    console.log('\n🔔 BURN NOTIFICATION');
    console.log('═══════════════════');
    console.log(`Amount: ${burnEvent.amount.toLocaleString()} $OZOID`);
    console.log(`Burner: ${burnEvent.burner.substring(0, 8)}...`);
    console.log(`Reward: ${burnEvent.reward}`);
    console.log(`Time: ${burnEvent.timestamp.toLocaleString()}`);
    console.log('═══════════════════\n');
    
    // TODO: Add Telegram/Discord webhook notification
    // Example:
    // await fetch('YOUR_TELEGRAM_BOT_WEBHOOK', {
    //     method: 'POST',
    //     body: JSON.stringify({
    //         text: `🔥 New burn: ${burnEvent.amount.toLocaleString()} $OZOID by ${burnEvent.burner.substring(0,8)}...`
    //     })
    // });
}

/**
 * Get burn statistics
 */
function getStats() {
    const last24h = burnHistory.filter(b => 
        (Date.now() - b.timestamp.getTime()) < 24 * 60 * 60 * 1000
    );
    
    const burned24h = last24h.reduce((sum, b) => sum + b.amount, 0);
    const avgBurnSize = totalBurned / burnHistory.length || 0;
    
    // Get top burner
    const burnerTotals = {};
    burnHistory.forEach(b => {
        burnerTotals[b.burner] = (burnerTotals[b.burner] || 0) + b.amount;
    });
    const topBurner = Object.entries(burnerTotals).sort((a, b) => b[1] - a[1])[0];
    
    return {
        totalBurned,
        totalBurns: burnHistory.length,
        burned24h,
        avgBurnSize,
        topBurner: topBurner ? {
            address: topBurner[0],
            amount: topBurner[1]
        } : null,
        recentBurns: burnHistory.slice(0, 10)
    };
}

/**
 * API endpoint to get burn data
 */
function getBurnData() {
    return {
        stats: getStats(),
        history: burnHistory.slice(0, 100) // Return last 100 burns
    };
}

// Main execution
async function main() {
    console.log('🚀 OmegaZoid Burn Tracker Started');
    console.log('═══════════════════════════════════');
    console.log(`Token: ${TOKEN_MINT}`);
    console.log(`Burn Address: ${BURN_ADDRESS}`);
    console.log('═══════════════════════════════════\n');
    
    // Fetch historical burns first
    await fetchHistoricalBurns(100);
    
    // Start real-time monitoring
    await monitorBurns();
}

// Export functions for use in API
module.exports = {
    fetchHistoricalBurns,
    monitorBurns,
    getStats,
    getBurnData,
    burnHistory
};

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
