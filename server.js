#!/usr/bin/env node

/**
 * OmegaZoid Burn Tracker Startup Script
 * Verifies token and starts the API server
 */

const { verifyToken, testRPCEndpoints } = require('./services/token-verifier');

async function startup() {
    console.log('\n🔥 OmegaZoid Burn Tracker Starting...\n');
    
    // Step 1: Test RPC endpoints
    console.log('📡 Testing RPC endpoints...');
    const rpcResults = await testRPCEndpoints();
    const healthyEndpoints = rpcResults.filter(r => r.status === 'healthy');
    
    if (healthyEndpoints.length === 0) {
        console.error('❌ No healthy RPC endpoints found!');
        console.error('Please check your internet connection or try again later.');
        process.exit(1);
    }
    
    console.log(`✅ ${healthyEndpoints.length}/${rpcResults.length} RPC endpoints healthy\n`);
    
    // Step 2: Verify token
    console.log('🔍 Verifying $OZOID token on Solana mainnet...');
    const tokenResult = await verifyToken();
    
    if (!tokenResult.exists) {
        console.error('❌ Token verification failed:', tokenResult.error);
        console.error('\nPlease verify:');
        console.error('1. Token mint address is correct');
        console.error('2. Token exists on Solana mainnet');
        console.error('3. RPC endpoints are accessible');
        process.exit(1);
    }
    
    console.log('✅ Token verified successfully');
    console.log(`   Mint: ${tokenResult.mint}`);
    console.log(`   Supply: ${tokenResult.supply.total.toLocaleString()} tokens`);
    console.log(`   Decimals: ${tokenResult.supply.decimals}\n`);
    
    // Step 3: Start API server
    console.log('🚀 Starting API server...\n');
    require('./api');
}

// Run startup
startup().catch(error => {
    console.error('\n❌ Startup failed:', error);
    process.exit(1);
});
