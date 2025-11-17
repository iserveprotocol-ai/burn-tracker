# OmegaZoid Burn Tracker - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd burn-tracker
npm install
```

### 2. Configure Environment (Optional)
```bash
cp .env.example .env
# Edit .env if you have custom RPC endpoints
```

### 3. Verify Token
```bash
npm run verify
```

### 4. Test RPC Endpoints
```bash
npm run test-rpc
```

### 5. Start Server
```bash
npm start
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Token Verification
```
GET /api/token/verify
```
Returns: Token existence and metadata

### Wallet Balance
```
GET /api/wallet/balance/:address
```
Returns: Token balance for specified wallet

### Burn Statistics
```
GET /api/burns/stats
```
Returns: Overall burn statistics

### Burn History
```
GET /api/burns/history?limit=10&offset=0
```
Returns: Paginated burn history

### User Burns
```
GET /api/burns/user/:address
```
Returns: Burns for specific wallet address

### Leaderboard
```
GET /api/burns/leaderboard?limit=10
```
Returns: Top burners

### Recent Burns
```
GET /api/burns/recent?limit=5
```
Returns: Most recent burns

### RPC Test
```
GET /api/rpc/test
```
Returns: Health status of all RPC endpoints

### Transaction Fee
```
GET /api/transaction/fee
```
Returns: Estimated transaction fee

### Health Check
```
GET /api/health
```
Returns: Server health status

## Production Deployment

### Option 1: Traditional VPS (Recommended)
1. Deploy to VPS (DigitalOcean, Linode, AWS EC2)
2. Install Node.js 18+
3. Clone repo and install dependencies
4. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name omegazoid-burn-tracker
pm2 save
pm2 startup
```

### Option 2: Serverless (Vercel/Netlify)
- Use serverless functions for each endpoint
- Add response caching

### Option 3: Docker
```bash
docker build -t omegazoid-burn-tracker .
docker run -p 3001:3001 omegazoid-burn-tracker
```

## Frontend Integration

Update your burn.html to use the backend API:

```javascript
// Instead of calling RPC directly
const balance = await getWalletBalance(address);

// Use the API
const response = await fetch(`http://localhost:3001/api/wallet/balance/${address}`);
const data = await response.json();
const balance = data.data.balance;
```

## Performance Tips

1. **Use RPC API Keys**: Get free keys from:
   - Helius (https://helius.xyz)
   - QuickNode (https://quicknode.com)
   - Alchemy (https://alchemy.com)

2. **Enable Caching**: Cache responses for 30-60 seconds

3. **Rate Limiting**: Implement rate limiting on frontend

4. **CDN**: Serve static assets via CDN

## Troubleshooting

### Token Not Found
- Verify token mint address is correct
- Check token exists on mainnet (not devnet)

### RPC Errors
- Test endpoints: `npm run test-rpc`
- Try different RPC endpoints
- Get API keys for better reliability

### CORS Issues
- Update ALLOWED_ORIGINS in .env
- Check frontend URL matches

## Monitoring

Use PM2 for monitoring:
```bash
pm2 monit
pm2 logs omegazoid-burn-tracker
```

## Support

For issues, check:
1. Server logs
2. RPC endpoint health
3. Token verification status
