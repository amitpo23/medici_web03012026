# 🚀 Medici Hotels - Vercel Deployment Script (PowerShell)
# =========================================================

Write-Host "`n🎯 Medici Hotels - Deployment to Vercel" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$projectRoot = "c:\Users\97250\Desktop\booking engine\medici_web03012026"

# Step 1: Check Vercel CLI
Write-Host "📦 Checking Vercel CLI..." -ForegroundColor Yellow
$vercelVersion = vercel --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Vercel CLI installed: $vercelVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

# Step 2: Check login status
Write-Host "`n🔐 Checking Vercel login status..." -ForegroundColor Yellow
$whoami = vercel whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Logged in as: $whoami" -ForegroundColor Green
} else {
    Write-Host "❌ Not logged in. Please run: vercel login" -ForegroundColor Red
    Write-Host "`nRun this command:" -ForegroundColor Yellow
    Write-Host "  vercel login" -ForegroundColor Cyan
    exit 1
}

# Step 3: Build Frontend
Write-Host "`n🔨 Building Frontend (Angular)..." -ForegroundColor Yellow
cd $projectRoot
npm run vercel-build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend build successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Check dist folder
if (Test-Path "$projectRoot\dist\only-night-app\index.html") {
    Write-Host "✅ Build output verified!" -ForegroundColor Green
    $size = (Get-ChildItem "$projectRoot\dist\only-night-app" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "   Size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "❌ Build output not found!" -ForegroundColor Red
    exit 1
}

# Step 5: Deploy Frontend
Write-Host "`n🚀 Deploying Frontend to Vercel..." -ForegroundColor Yellow
Write-Host "Choose deployment type:" -ForegroundColor Cyan
Write-Host "  1. Preview (testing)" -ForegroundColor White
Write-Host "  2. Production" -ForegroundColor White
$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "2") {
    Write-Host "`n📤 Deploying to PRODUCTION..." -ForegroundColor Magenta
    vercel --prod
} else {
    Write-Host "`n📤 Deploying to PREVIEW..." -ForegroundColor Magenta
    vercel
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Frontend deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Frontend deployment failed!" -ForegroundColor Red
    exit 1
}

# Step 6: Ask about Backend
Write-Host "`n🔧 Deploy Backend?" -ForegroundColor Yellow
$deployBackend = Read-Host "Deploy backend? (y/n)"

if ($deployBackend -eq "y") {
    Write-Host "`n🚀 Deploying Backend..." -ForegroundColor Yellow
    cd "$projectRoot\medici-backend-node"
    
    # Check if .env exists
    if (Test-Path ".env") {
        Write-Host "⚠️  Remember to set environment variables in Vercel Dashboard!" -ForegroundColor Yellow
        Write-Host "   DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD, JWT_SECRET" -ForegroundColor Cyan
    }
    
    if ($choice -eq "2") {
        vercel --prod
    } else {
        vercel
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Backend deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Backend deployment failed!" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Set environment variables in Vercel Dashboard" -ForegroundColor White
Write-Host "2. Test the deployed application" -ForegroundColor White
Write-Host "3. Update Frontend environment.prod.ts with Backend URL" -ForegroundColor White
Write-Host "`nVercel Dashboard: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host "`n✨ Done!`n" -ForegroundColor Green
