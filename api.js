/**
 * Burn Tracker API
 * Express server to expose burn statistics and history
 */

const express = require('express');
const cors = require('cors');
const { getStats, getBurnData, fetchHistoricalBurns, monitorBurns } = require('./track-burns');
const { verifyToken, getTokenBalance, testRPCEndpoints, TOKEN_MINT } = require('./services/token-verifier');
const { getWalletBalance, isValidSolanaAddress, estimateTransactionFee } = require('./services/wallet-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
    'http://localhost:3000',
    'https://omegazoid.xyz',
    'https://www.omegazoid.xyz'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // For now, allow all origins
        }
    },
    credentials: true
}));
app.use(express.json());

// Initialize burn tracking on startup
let initialized = false;
async function initializeBurnTracking() {
    if (!initialized) {
        console.log('🔥 Initializing burn tracking...');
        await fetchHistoricalBurns(100);
        monitorBurns(); // Start real-time monitoring
        initialized = true;
    }
}

/**
 * GET /api/burns/stats
 * Get burn statistics
 */
app.get('/api/burns/stats', async (req, res) => {
    try {
        await initializeBurnTracking();
        const stats = getStats();
        
        res.json({
            success: true,
            data: {
                totalBurned: stats.totalBurned,
                totalBurns: stats.totalBurns,
                burned24h: stats.burned24h,
                avgBurnSize: stats.avgBurnSize,
                topBurner: stats.topBurner,
                currentSupply: 1000000000 - stats.totalBurned, // Assuming 1B initial supply
                burnRate: (stats.totalBurned / 1000000000 * 100).toFixed(2)
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch burn statistics'
        });
    }
});

/**
 * GET /api/burns/history
 * Get burn history with pagination
 */
app.get('/api/burns/history', async (req, res) => {
    try {
        await initializeBurnTracking();
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        
        const data = getBurnData();
        const history = data.history.slice(offset, offset + limit);
        
        res.json({
            success: true,
            data: {
                burns: history,
                total: data.history.length,
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch burn history'
        });
    }
});

/**
 * GET /api/burns/user/:address
 * Get burn history for specific user
 */
app.get('/api/burns/user/:address', async (req, res) => {
    try {
        await initializeBurnTracking();
        const { address } = req.params;
        const data = getBurnData();
        
        const userBurns = data.history.filter(b => b.burner === address);
        const totalUserBurned = userBurns.reduce((sum, b) => sum + b.amount, 0);
        
        res.json({
            success: true,
            data: {
                address,
                totalBurned: totalUserBurned,
                burnCount: userBurns.length,
                burns: userBurns.slice(0, 50) // Last 50 burns
            }
        });
    } catch (error) {
        console.error('Error fetching user burns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user burn data'
        });
    }
});

/**
 * GET /api/burns/leaderboard
 * Get top burners leaderboard
 */
app.get('/api/burns/leaderboard', async (req, res) => {
    try {
        await initializeBurnTracking();
        const limit = parseInt(req.query.limit) || 10;
        const data = getBurnData();
        
        // Calculate total burns per address
        const burnerTotals = {};
        data.history.forEach(b => {
            if (!burnerTotals[b.burner]) {
                burnerTotals[b.burner] = {
                    address: b.burner,
                    totalBurned: 0,
                    burnCount: 0,
                    lastBurn: b.timestamp
                };
            }
            burnerTotals[b.burner].totalBurned += b.amount;
            burnerTotals[b.burner].burnCount += 1;
        });
        
        // Sort by total burned
        const leaderboard = Object.values(burnerTotals)
            .sort((a, b) => b.totalBurned - a.totalBurned)
            .slice(0, limit);
        
        res.json({
            success: true,
            data: {
                leaderboard,
                total: Object.keys(burnerTotals).length
            }
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

/**
 * GET /api/burns/recent
 * Get most recent burns
 */
app.get('/api/burns/recent', async (req, res) => {
    try {
        await initializeBurnTracking();
        const limit = parseInt(req.query.limit) || 5;
        const data = getBurnData();
        
        res.json({
            success: true,
            data: {
                burns: data.history.slice(0, limit)
            }
        });
    } catch (error) {
        console.error('Error fetching recent burns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent burns'
        });
    }
});

/**
 * GET /api/token/verify
 * Verify token exists on mainnet
 */
app.get('/api/token/verify', async (req, res) => {
    try {
        const result = await verifyToken();
        res.json({
            success: result.exists,
            data: result
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify token'
        });
    }
});

/**
 * GET /api/wallet/balance/:address
 * Get wallet token balance
 */
app.get('/api/wallet/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        if (!isValidSolanaAddress(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Solana wallet address'
            });
        }
        
        const result = await getWalletBalance(address);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: {
                address,
                balance: result.balance,
                token: TOKEN_MINT
            }
        });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wallet balance'
        });
    }
});

/**
 * GET /api/rpc/test
 * Test all RPC endpoints
 */
app.get('/api/rpc/test', async (req, res) => {
    try {
        const results = await testRPCEndpoints();
        const healthyEndpoints = results.filter(r => r.status === 'healthy');
        
        res.json({
            success: true,
            data: {
                total: results.length,
                healthy: healthyEndpoints.length,
                endpoints: results
            }
        });
    } catch (error) {
        console.error('Error testing RPC endpoints:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test RPC endpoints'
        });
    }
});

/**
 * GET /api/transaction/fee
 * Get estimated transaction fee
 */
app.get('/api/transaction/fee', async (req, res) => {
    try {
        const result = await estimateTransactionFee();
        res.json({
            success: result.success,
            data: result.success ? { fee: result.fee } : null,
            error: result.error
        });
    } catch (error) {
        console.error('Error estimating fee:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to estimate transaction fee'
        });
    }
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'OmegaZoid Burn Tracker',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'OmegaZoid Burn Tracker API',
        version: '1.0.0',
        status: 'operational',
        endpoints: [
            '/api/token/verify',
            '/api/wallet/balance/:address',
            '/api/burns/stats',
            '/api/burns/history',
            '/api/burns/user/:address',
            '/api/burns/leaderboard',
            '/api/burns/recent',
            '/api/rpc/test',
            '/api/transaction/fee',
            '/api/health'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🔥 Burn Tracker API running on port ${PORT}`);
    console.log(`📊 Stats: http://localhost:${PORT}/api/burns/stats`);
    console.log(`📜 History: http://localhost:${PORT}/api/burns/history`);
    console.log(`🏆 Leaderboard: http://localhost:${PORT}/api/burns/leaderboard`);
    console.log(`\n🚀 Server ready!\n`);
});

module.exports = app;
