/**
 * Token Verification Service
 * Verifies if $OZOID token exists on Solana mainnet and provides metadata
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const TOKEN_MINT = '3RNx8fsFmumKhypgL8KdiGvvopBkiaWNNMg4zNPLpump';

// Multiple RPC endpoints for redundancy
const RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com',
    'https://solana.public-rpc.com'
];

let currentEndpointIndex = 0;

function getConnection() {
    const endpoint = RPC_ENDPOINTS[currentEndpointIndex];
    return new Connection(endpoint, 'confirmed');
}

function rotateEndpoint() {
    currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
    console.log(`🔄 Rotating to RPC endpoint: ${RPC_ENDPOINTS[currentEndpointIndex]}`);
}

/**
 * Verify token exists and get basic info
 */
async function verifyToken(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = getConnection();
            const mintPublicKey = new PublicKey(TOKEN_MINT);
            
            console.log(`🔍 Verifying token ${TOKEN_MINT}...`);
            
            // Get account info
            const accountInfo = await connection.getAccountInfo(mintPublicKey);
            
            if (!accountInfo) {
                console.error('❌ Token account not found');
                return {
                    exists: false,
                    error: 'Token account not found on mainnet'
                };
            }
            
            // Parse token supply info
            const supply = await connection.getTokenSupply(mintPublicKey);
            
            console.log('✅ Token verified successfully');
            
            return {
                exists: true,
                mint: TOKEN_MINT,
                supply: {
                    total: supply.value.uiAmount,
                    decimals: supply.value.decimals
                },
                verified: true
            };
            
        } catch (error) {
            console.error(`❌ Attempt ${i + 1} failed:`, error.message);
            
            if (i < retries - 1) {
                rotateEndpoint();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                return {
                    exists: false,
                    error: error.message
                };
            }
        }
    }
}

/**
 * Get token balance for a wallet
 */
async function getTokenBalance(walletAddress, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = getConnection();
            const walletPublicKey = new PublicKey(walletAddress);
            const mintPublicKey = new PublicKey(TOKEN_MINT);
            
            // Get token accounts by owner
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                walletPublicKey,
                { mint: mintPublicKey }
            );
            
            if (tokenAccounts.value.length === 0) {
                return {
                    success: true,
                    balance: 0,
                    hasAccount: false
                };
            }
            
            const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            
            return {
                success: true,
                balance: balance || 0,
                hasAccount: true
            };
            
        } catch (error) {
            console.error(`❌ Balance fetch attempt ${i + 1} failed:`, error.message);
            
            if (i < retries - 1) {
                rotateEndpoint();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }
}

/**
 * Test all RPC endpoints and return health status
 */
async function testRPCEndpoints() {
    const results = [];
    
    for (const endpoint of RPC_ENDPOINTS) {
        const connection = new Connection(endpoint, 'confirmed');
        const startTime = Date.now();
        
        try {
            const version = await connection.getVersion();
            const latency = Date.now() - startTime;
            
            results.push({
                endpoint,
                status: 'healthy',
                latency,
                version: version['solana-core']
            });
            
            console.log(`✅ ${endpoint} - ${latency}ms`);
        } catch (error) {
            results.push({
                endpoint,
                status: 'unhealthy',
                error: error.message
            });
            
            console.log(`❌ ${endpoint} - ${error.message}`);
        }
    }
    
    return results;
}

module.exports = {
    verifyToken,
    getTokenBalance,
    testRPCEndpoints,
    TOKEN_MINT
};
