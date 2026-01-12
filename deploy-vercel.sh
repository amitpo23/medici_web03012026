#!/bin/bash

# 🚀 Medici Hotels - Vercel Deployment Script
# ============================================

set -e  # Exit on error

echo "🎯 Starting Medici Hotels Deployment Process..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Check if Vercel CLI is installed
print_status "Checking Vercel CLI installation..."
if ! command -v vercel &> /dev/null; then
    print_warning "Vercel CLI not found. Installing..."
    npm install -g vercel
    print_success "Vercel CLI installed successfully!"
else
    print_success "Vercel CLI is already installed."
fi

# Step 2: Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node -v)
print_success "Node.js version: $NODE_VERSION"

# Step 3: Install dependencies
print_status "Installing dependencies..."
npm ci --legacy-peer-deps || npm install --legacy-peer-deps
print_success "Dependencies installed successfully!"

# Step 4: Build the project
print_status "Building Angular application for production..."
npm run vercel-build

if [ $? -eq 0 ]; then
    print_success "Build completed successfully!"
else
    print_error "Build failed! Please check the errors above."
    exit 1
fi

# Step 5: Check if dist folder exists
if [ ! -d "dist/only-night-app" ]; then
    print_error "Build output directory not found!"
    exit 1
fi

print_success "Build output verified!"

# Step 6: Deploy to Vercel
print_status "Deploying to Vercel..."
echo ""
echo "Please choose deployment type:"
echo "1. Preview Deployment (default)"
echo "2. Production Deployment"
echo ""
read -p "Enter your choice (1 or 2): " DEPLOY_TYPE

if [ "$DEPLOY_TYPE" == "2" ]; then
    print_status "Deploying to PRODUCTION..."
    vercel --prod
else
    print_status "Deploying to PREVIEW..."
    vercel
fi

if [ $? -eq 0 ]; then
    print_success "🎉 Deployment completed successfully!"
    echo ""
    echo "=============================================="
    echo "Next steps:"
    echo "1. Check the deployment URL provided above"
    echo "2. Verify all features are working correctly"
    echo "3. Configure environment variables in Vercel Dashboard if needed"
    echo "=============================================="
else
    print_error "Deployment failed! Please check the errors above."
    exit 1
fi
