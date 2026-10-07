#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=========================================================="
echo "🚀 CareerOS v5 - Complete Services Bootstrapper"
echo "=========================================================="

# 1. Clear ports 8000 and 5173 to prevent address collisions
echo "🧹 [1/3] Clearing existing processes on ports 8000 and 5173..."
lsof -ti :8000 -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo "   ✓ Ports 8000 & 5173 ready."

# 2. Check virtual environment
echo "🐍 [2/3] Activating Python virtual environment..."
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "   ✓ Using Python: $(which python)"
else
    echo "   ⚠️ Virtual environment 'venv' not found! Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r backend/requirements.txt
fi

export PYTHONPATH="$ROOT_DIR/backend:$PYTHONPATH"

# 3. Launch Backend and Frontend
echo "⚡ [3/3] Launching Core Engine (FastAPI) and Frontend (Vite)..."
echo "=========================================================="
echo "🎯 Vite React UI : http://localhost:5173"
echo "🌐 API Server    : http://localhost:8000"
echo "📖 Swagger Docs  : http://localhost:8000/docs"
echo "🎙️ Gemini Live   : ws://localhost:8000/api/live"
echo "=========================================================="
echo "Press Ctrl+C to stop all services."
echo ""

# Start FastAPI in background
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start Vite Frontend in background
(cd "$ROOT_DIR/frontend" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "🛑 Shutting down CareerOS-v5 services..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    lsof -ti :8000 -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null || true
    echo "✓ All services stopped cleanly."
    exit 0
}

trap cleanup EXIT INT TERM
wait "$BACKEND_PID" "$FRONTEND_PID"
