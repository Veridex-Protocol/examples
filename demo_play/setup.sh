#!/bin/bash

# Veridex Demo Play Setup Script
# This script ensures the demo app is properly configured and ready to run

set -e  # Exit on error

echo "🚀 Veridex Demo Play Setup"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the demo_play directory"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Check Node version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
echo ""

# Step 2: Navigate to SDK and build
echo "2️⃣  Building Veridex SDK..."
cd ../../packages/sdk

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: SDK package.json not found${NC}"
    exit 1
fi

echo "   Building SDK..."
npm run build

if [ -d "dist" ]; then
    echo -e "${GREEN}✅ SDK built successfully${NC}"
else
    echo -e "${RED}❌ Error: SDK build failed${NC}"
    exit 1
fi
echo ""

# Step 3: Return to demo_play and install dependencies
echo "3️⃣  Installing demo_play dependencies..."
cd ../../examples/demo_play

# Clean node_modules and .next
if [ -d "node_modules" ]; then
    echo "   Cleaning node_modules..."
    rm -rf node_modules
fi

if [ -d ".next" ]; then
    echo "   Cleaning .next cache..."
    rm -rf .next
fi

echo "   Installing dependencies..."
npm install

if [ -d "node_modules/@veridex/sdk" ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Error: @veridex/sdk not found in node_modules${NC}"
    exit 1
fi
echo ""

# Step 4: Verify SDK installation
echo "4️⃣  Verifying SDK installation..."
if npm list @veridex/sdk > /dev/null 2>&1; then
    SDK_VERSION=$(npm list @veridex/sdk --depth=0 2>/dev/null | grep @veridex/sdk | awk '{print $2}')
    echo -e "${GREEN}✅ @veridex/sdk@$SDK_VERSION installed${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: SDK installation verification failed${NC}"
    echo "   This might be okay if using workspace dependencies"
fi
echo ""

# Step 5: Check for required files
echo "5️⃣  Checking required files..."
REQUIRED_FILES=(
    "src/app/page.tsx"
    "src/app/layout.tsx"
    "src/app/globals.css"
    "next.config.ts"
    "tsconfig.json"
)

ALL_FILES_EXIST=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✅${NC} $file"
    else
        echo -e "   ${RED}❌${NC} $file (missing)"
        ALL_FILES_EXIST=false
    fi
done
echo ""

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}❌ Error: Some required files are missing${NC}"
    exit 1
fi

# Step 6: Success message
echo "=========================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "To start the development server:"
echo -e "${YELLOW}npm run dev${NC}"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "📚 For troubleshooting, see: TROUBLESHOOTING.md"
echo ""
