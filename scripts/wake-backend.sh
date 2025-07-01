#!/bin/bash

# Wake Up Script for Render Backend
# Usage: ./scripts/wake-backend.sh [backend-url]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default backend URL (update this with your actual Render URL)
DEFAULT_BACKEND_URL="https://ai-concierge-47wh.onrender.com"

# Use provided URL or default
BACKEND_URL=${1:-$DEFAULT_BACKEND_URL}

echo -e "${YELLOW}🌅 Waking up Render backend...${NC}"
echo -e "URL: ${BACKEND_URL}"
echo ""

# Function to check if backend is awake
check_backend() {
    local url=$1
    local start_time=$(date +%s)
    
    echo -e "${YELLOW}⏳ Pinging health endpoint...${NC}"
    
    # Make request with timeout
    if response=$(curl -s -w "%{http_code}" -m 30 "${url}/health" 2>/dev/null); then
        http_code="${response: -3}"
        body="${response%???}"
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✅ Backend is awake! (${duration}s)${NC}"
            echo -e "Response: ${body}"
            return 0
        else
            echo -e "${RED}❌ Backend responded with HTTP ${http_code}${NC}"
            echo -e "Response: ${body}"
            return 1
        fi
    else
        echo -e "${RED}❌ Failed to connect to backend${NC}"
        return 1
    fi
}

# Function to wait for backend to wake up
wait_for_backend() {
    local url=$1
    local max_attempts=6
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo -e "${YELLOW}Attempt ${attempt}/${max_attempts}...${NC}"
        
        if check_backend "$url"; then
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            echo -e "${YELLOW}⏱️  Waiting 10 seconds before retry...${NC}"
            sleep 10
        fi
        
        ((attempt++))
    done
    
    echo -e "${RED}❌ Backend failed to wake up after ${max_attempts} attempts${NC}"
    return 1
}

# Main execution
echo -e "${YELLOW}🚀 Starting wake-up process...${NC}"

if wait_for_backend "$BACKEND_URL"; then
    echo ""
    echo -e "${GREEN}🎉 Success! Your backend is now awake and ready.${NC}"
    echo -e "${GREEN}You can now use your frontend application.${NC}"
    echo ""
    echo -e "📋 ${YELLOW}Next steps:${NC}"
    echo -e "   1. Open your frontend: https://your-app.vercel.app"
    echo -e "   2. Test agent interface: https://your-app.vercel.app/agent"
    echo -e "   3. Test customer interface: https://your-app.vercel.app/customer"
else
    echo ""
    echo -e "${RED}💥 Failed to wake up backend${NC}"
    echo -e "${YELLOW}💡 Troubleshooting tips:${NC}"
    echo -e "   1. Check your backend URL is correct"
    echo -e "   2. Verify backend is deployed on Render"
    echo -e "   3. Check Render dashboard for errors"
    echo -e "   4. Try manual deploy from Render dashboard"
fi

echo ""
