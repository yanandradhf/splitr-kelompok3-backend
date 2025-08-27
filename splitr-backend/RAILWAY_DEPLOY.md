# 🚂 Railway Deployment Guide

## Quick Deploy to Railway

### 1. Railway Setup
1. Go to [railway.app](https://railway.app)
2. Login with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select this repository

### 2. Add PostgreSQL
1. "New Service" → "Database" → "PostgreSQL"
2. Wait for provisioning

### 3. Environment Variables
Add these in Railway dashboard → Service → Variables:

```env
NODE_ENV=production
JWT_SECRET=splitr_production_secret_2024_very_strong_256_bit
JWT_ACCESS_SECRET=splitr_access_secret_2024_change_for_production
JWT_REFRESH_SECRET=splitr_refresh_secret_2024_change_for_production
CLOUDINARY_CLOUD_NAME=dmbbhxu3w
CLOUDINARY_API_KEY=886363373785349
CLOUDINARY_API_SECRET=dmhucROC6wpbqRBbBccpMtszy_o
GMAIL_USER=splitr.bni@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
OTP_EXPIRY_MINUTES=5
SESSION_EXPIRY_HOURS=2
```

### 4. Deploy Database
Run once after first deploy:
```bash
npm run railway:deploy
```

### 5. Test Deployment
```bash
curl https://your-railway-url.up.railway.app/health
```

## Production URLs
- **API Base:** `https://your-app.up.railway.app`
- **Health Check:** `https://your-app.up.railway.app/health`
- **Mobile API:** `https://your-app.up.railway.app/api/mobile/*`
- **Admin API:** `https://your-app.up.railway.app/api/admin/*`

## Auto-Deploy
Railway auto-deploys on push to main branch.

## Monitoring
- Logs: Railway Dashboard → Service → Logs
- Metrics: Railway Dashboard → Service → Metrics
- Database: Railway Dashboard → PostgreSQL → Data