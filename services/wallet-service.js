/**
 * Wallet Service
 * Handles wallet balance checks and transaction preparations
 */

const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { TOKEN_MINT } = require('./token-verifier');

// RPC configuration with rate limiting
const RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com'
];

let currentEndpointIndex = 0;
let requestCount = 0;
let lastRequestTime = Date.now();

function getConnection() {
    // Simple rate limiting: max 5 requests per second
    const now = Date.now();
    if (now - lastRequestTime < 1000) {
        requestCount++;
        if (requestCount > 5) {
            currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
            requestCount = 0;
        }
    } else {
        requestCount = 0;
        lastRequestTime = now;
    }
    
    const endpoint = RPC_ENDPOINTS[currentEndpointIndex];
    return new Connection(endpoint, 'confirmed');
}

/**
 * Get associated token address
 */
async function getAssociatedTokenAddress(ownerPublicKey, mintPublicKey) {
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
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
 * Get wallet token balance with retry logic
 */
async function getWalletBalance(walletAddress, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = getConnection();
            const ownerPublicKey = new PublicKey(walletAddress);
            const mintPublicKey = new PublicKey(TOKEN_MINT);
            
            // Method 1: Try parsed token accounts
            try {
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    ownerPublicKey,
                    { mint: mintPublicKey }
                );
                
                if (tokenAccounts.value.length === 0) {
                    return {
                        success: true,
                        balance: 0,
                        method: 'parsed'
                    };
                }
                
                const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                
                return {
                    success: true,
                    balance: balance || 0,
                    method: 'parsed'
                };
            } catch (parsedError) {
                console.log('Parsed method failed, trying raw method...');
                
                // Method 2: Fallback to raw account data
                const tokenAccount = await getAssociatedTokenAddress(ownerPublicKey, mintPublicKey);
                const accountInfo = await connection.getAccountInfo(tokenAccount);
                
                if (!accountInfo) {
                    return {
                        success: true,
                        balance: 0,
                        method: 'raw'
                    };
                }
                
                // Parse amount from raw data (bytes 64-72)
                const data = accountInfo.data;
                const amountBuffer = data.slice(64, 72);
                const amountBigInt = amountBuffer.readBigUInt64LE(0);
                const balance = Number(amountBigInt) / Math.pow(10, 6); // 6 decimals
                
                return {
                    success: true,
                    balance,
                    method: 'raw'
                };
            }
            
        } catch (error) {
            console.error(`Balance fetch attempt ${i + 1} failed:`, error.message);
            
            if (i < retries - 1) {
                currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
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
 * Validate wallet address
 */
function isValidSolanaAddress(address) {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get transaction fee estimate
 */
async function estimateTransactionFee() {
    try {
        const connection = getConnection();
        const { feeCalculator } = await connection.getRecentBlockhash();
        return {
            success: true,
            fee: feeCalculator.lamportsPerSignature / 1e9 // Convert to SOL
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    getWalletBalance,
    isValidSolanaAddress,
    estimateTransactionFee,
    getAssociatedTokenAddress
};
