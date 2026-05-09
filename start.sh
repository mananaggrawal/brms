#!/bin/bash

echo "Starting BRMS..."

# Kill any existing processes on the ports
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# Start backend
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!
echo "Backend started (pid $BACKEND_PID) at http://localhost:3001"

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (pid $FRONTEND_PID) at http://localhost:3000"

echo ""
echo "BRMS is running at http://localhost:3000"
echo "Press Ctrl+C to stop all servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
