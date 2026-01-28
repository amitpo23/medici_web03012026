# Deploy Backend to Azure

## Prerequisites
- Azure CLI installed
- Git repository with the latest changes

## Files Added/Fixed
The following middleware files were added to fix the startup issue:
- `middleware/request-logger.js` - HTTP request logging
- `middleware/rate-limiter.js` - API rate limiting

## Deployment Steps

### Option 1: Using Azure CLI

```bash
# Login to Azure
az login

# Deploy using zip
cd medici-backend-node
zip -r deploy.zip . -x "node_modules/*" -x ".git/*" -x "logs/*"
az webapp deployment source config-zip \
  --resource-group medici-resources \
  --name medici-backend-dev-f9h6hxgncha9fbbp \
  --src deploy.zip
```

### Option 2: Using Git Deployment

```bash
# The files have already been pushed to GitHub
# Azure should auto-deploy if connected to the repository
# Check Azure Portal -> Deployment Center for status
```

### Option 3: Manual Upload via Azure Portal

1. Go to Azure Portal
2. Navigate to App Service: `medici-backend-dev-f9h6hxgncha9fbbp`
3. Open **App Service Editor** or **Advanced Tools (Kudu)**
4. Upload the `middleware` folder with both files
5. Restart the app service

## Verify Deployment

After deployment, check:
```bash
curl https://medici-backend-dev-f9h6hxgncha9fbbp.eastus2-01.azurewebsites.net/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": ...,
  "version": "1.0.0"
}
```

## Environment Variables
Ensure these are set in Azure App Service Configuration:
- `DB_SERVER`
- `DB_DATABASE`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `NODE_ENV=production`
