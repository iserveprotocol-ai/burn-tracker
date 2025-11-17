# OmegaZoid Burn Tracker

Real-time tracking of $OZOID token burns on Solana blockchain.

## Features

- ✅ **Real-time monitoring** - Detects burns as they happen
- ✅ **Historical data** - Fetches past burn transactions
- ✅ **Statistics API** - Total burned, 24h burns, averages
- ✅ **Leaderboard** - Top burners ranked by amount
- ✅ **User lookup** - Check burns by wallet address
- ✅ **REST API** - Easy integration with website

## Setup

### 1. Install Dependencies

```bash
cd burn-tracker
npm install
```

### 2. Configure (Optional)

Set environment variable for RPC endpoint:

```bash
# Windows
set SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Linux/Mac
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

For better performance, use a paid RPC like:
- QuickNode
- Helius
- Alchemy

### 3. Run the Tracker

**API Server (recommended):**
```bash
npm start
```

**Standalone tracker:**
```bash
npm run track
```

**Development mode:**
```bash
npm run dev
```

## API Endpoints

### Get Burn Statistics
```
GET /api/burns/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "totalBurned": 12345678,
    "totalBurns": 523,
    "burned24h": 125000,
    "avgBurnSize": 25000,
    "currentSupply": 987654322,
    "burnRate": "1.23"
  }
}
```

### Get Burn History
```
GET /api/burns/history?limit=10&offset=0
```

### Get User Burns
```
GET /api/burns/user/{walletAddress}
```

### Get Leaderboard
```
GET /api/burns/leaderboard?limit=10
```

### Get Recent Burns
```
GET /api/burns/recent?limit=5
```

## Integration with Website

The burn.html page automatically fetches real burn stats from the API:

1. **Start the API server** (runs on port 3001)
2. **Open burn.html** in browser
3. **Stats update automatically** every 30 seconds

## Deploy to Production

### Option 1: Deploy with Scanner API (Recommended)

Add burn tracker to your existing Render deployment:

```bash
# Add to scanner's package.json dependencies
"@solana/web3.js": "^1.87.6"

# Start both services
node scanner/app.py & node burn-tracker/api.js
```

### Option 2: Separate Service

Deploy as standalone service on Render/Heroku/Railway:

```yaml
# render.yaml
services:
  - type: web
    name: omegazoid-burn-tracker
    env: node
    buildCommand: npm install
    startCommand: npm start
```

### Option 3: Run Locally

Keep it running on your local machine:

```bash
npm start
```

## Notifications (Coming Soon)

Integrate with Telegram/Discord for burn alerts:

```javascript
// In track-burns.js notifyBurn() function
await fetch('https://api.telegram.org/bot{YOUR_BOT_TOKEN}/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        chat_id: 'YOUR_CHANNEL_ID',
        text: `🔥 ${amount.toLocaleString()} $OZOID burned!\n💎 Reward: ${reward}`
    })
});
```

## Troubleshooting

**API not responding?**
- Check if server is running: `curl http://localhost:3001/api/health`
- Check console for errors
- Verify Solana RPC is accessible

**No historical burns found?**
- May take a few minutes to scan blockchain
- Check if token has any burns on Solscan
- Verify TOKEN_MINT address is correct

**Real-time monitoring not working?**
- RPC endpoint may not support websockets
- Use paid RPC provider for better reliability
- Check firewall settings

## Performance Tips

1. **Use paid RPC** - Free endpoints are rate-limited
2. **Cache data** - API caches results in memory
3. **Batch requests** - Process multiple transactions at once
4. **Database** - Replace in-memory storage with MongoDB/PostgreSQL

## Support

Questions? Issues? Join our Telegram: https://t.me/OmegaZoidOfficialChat
