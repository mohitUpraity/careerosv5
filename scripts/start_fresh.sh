#!/bin/bash
set -e

# CareerOS v5 - Complete Fresh Service Starter
# Usage: ./scripts/start_fresh.sh [--wipe-db]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "========================================================"
echo "🚀 CareerOS v5 Pro - Clean Service Bootstrapper"
echo "========================================================"

# 1. Kill any existing servers on ports 8000, 3000, 5173
echo "🧹 [1/4] Stopping existing processes on ports 8000, 3000, 5173..."
lsof -ti :8000 -ti :3000 -ti :5173 | xargs kill -9 2>/dev/null || true
sleep 1
echo "   ✓ Ports cleared."

# 2. Check Python Virtual Environment
echo "🐍 [2/4] Verifying Python virtual environment..."
if [ ! -d "venv" ]; then
    echo "   Creating new venv..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "   ✓ Virtual environment active: $(which python)"

# 3. Optional Database Wipe
if [[ "$*" == *"--wipe-db"* ]] || [[ "$*" == *"-w"* ]]; then
    echo "🗑️  [3/4] Wiping Neo4j AuraDB graph database..."
    python scripts/wipe_db.py
else
    echo "ℹ️  [3/4] Skipping DB wipe (run with --wipe-db to clear all graph records)."
fi

# 4. Start FastAPI Backend & Vite React Frontend
echo "⚡ [4/4] Launching CareerOS v5 Core Engine & Vite React Frontend..."
echo "========================================================"
echo "🎯 Vite React UI : http://localhost:5173"
echo "🌐 API Server    : http://localhost:8000"
echo "📖 Swagger Docs  : http://localhost:8000/docs"
echo "🤖 LLM Provider  : Groq (Llama 3.3 70B) + Gemini Fallback"
echo "🔐 Auth Provider : Firebase Google Authentication"
echo "========================================================"
echo "Press CTRL+C to stop services."
echo ""

export PYTHONPATH="$ROOT_DIR/backend:$PYTHONPATH"

# Launch backend in background
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Launch frontend Vite dev server
cd "$ROOT_DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT INT TERM
wait $BACKEND_PID $FRONTEND_PID

