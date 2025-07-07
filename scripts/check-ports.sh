#!/bin/bash

# Port Management Script for Mulisa Voice Bot
# Helps detect and resolve port conflicts

echo "🔍 Checking Mulisa Voice Bot Port Status..."

# Define expected ports
FRONTEND_PORT=3000
BACKEND_PORT=3001

# Function to check if a port is in use
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        echo "❌ Port $port ($service) is occupied by PID $pid ($process)"
        return 1
    else
        echo "✅ Port $port ($service) is available"
        return 0
    fi
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    echo "🔨 Killing processes on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Check current port status
echo ""
echo "📊 Current Port Status:"
check_port $FRONTEND_PORT "Frontend"
frontend_available=$?

check_port $BACKEND_PORT "Backend" 
backend_available=$?

# Provide recommendations
echo ""
echo "💡 Recommendations:"

if [ $backend_available -ne 0 ]; then
    echo "⚠️  Backend port $BACKEND_PORT is occupied"
    read -p "Kill processes on port $BACKEND_PORT? (y/n): " kill_backend
    if [ "$kill_backend" = "y" ]; then
        kill_port $BACKEND_PORT
        check_port $BACKEND_PORT "Backend"
    else
        echo "ℹ️  Backend must use port $BACKEND_PORT for proper operation"
        echo "   Consider manually stopping the conflicting process"
    fi
fi

if [ $frontend_available -ne 0 ]; then
    echo "ℹ️  Frontend port $FRONTEND_PORT is occupied"
    echo "   Vite will automatically use the next available port"
    echo "   This is normal and doesn't require action"
fi

echo ""
echo "🚀 To start the application:"
echo "   npm run dev"
echo ""
echo "📝 Port Configuration:"
echo "   Frontend: http://localhost:$FRONTEND_PORT (or auto-assigned)"
echo "   Backend:  http://localhost:$BACKEND_PORT (fixed)"
