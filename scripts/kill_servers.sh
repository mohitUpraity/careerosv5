#!/bin/bash
# ==============================================================================
# CareerOS v5 - Service Manager (Kill & Restart)
# Kills existing port services (8000, 5173, 3000) and starts Backend & Frontend
#
# Usage:
#   ./scripts/kill_servers.sh                # Kill ports & restart services in foreground
#   ./scripts/kill_servers.sh --kill-only    # Only kill services/ports and exit (-k)
#   ./scripts/kill_servers.sh --background   # Kill & restart in background / daemon mode (-d)
#   ./scripts/kill_servers.sh --with-interview # Also start live-interview service on :3000 (-i)
#   ./scripts/kill_servers.sh --wipe-db      # Wipe Neo4j DB before starting (-w)
#   ./scripts/kill_servers.sh --help         # Show options (-h)
# ==============================================================================

# Colors for terminal output
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
DIM="\033[2m"
RESET="\033[0m"

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
INTERVIEW_DIR="$ROOT_DIR/live-interview"
LOGS_DIR="$ROOT_DIR/.logs"

# Parse Flags
KILL_ONLY=false
DAEMON_MODE=false
WITH_INTERVIEW=false
WIPE_DB=false

for arg in "$@"; do
    case "$arg" in
        --kill-only|-k)
            KILL_ONLY=true
            ;;
        --background|-d|-b)
            DAEMON_MODE=true
            ;;
        --with-interview|-i)
            WITH_INTERVIEW=true
            ;;
        --wipe-db|-w)
            WIPE_DB=true
            ;;
        --help|-h)
            echo -e "${BOLD}CareerOS v5 Service Manager${RESET}"
            echo -e "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -k, --kill-only        Kill processes on ports 8000, 5173, 3000 and exit"
            echo "  -d, --background       Start services in background (daemon mode)"
            echo "  -i, --with-interview   Also start live-interview service on port 3000"
            echo "  -w, --wipe-db          Wipe Neo4j graph database before starting"
            echo "  -h, --help             Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${BOLD}${CYAN}========================================================"
echo -e "⚡ CareerOS v5 - Service Manager"
echo -e "========================================================${RESET}"

# 1. Kill existing services on ports 8000, 5173, 3000
echo -e "\n${YELLOW}🧹 [1/4] Stopping existing processes on ports 8000, 5173, 3000...${RESET}"
PORTS=(8000 5173 3000)

PIDS=$(lsof -ti :8000 -ti :5173 -ti :3000 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    FORMATTED_PIDS=$(echo $PIDS | tr '\n' ' ')
    echo -e "   Found active processes on ports (${PORTS[*]}): ${DIM}$FORMATTED_PIDS${RESET}"
    echo "$PIDS" | xargs kill -15 2>/dev/null || true
    sleep 1
    # Force kill any stubborn processes
    STILL_ALIVE=$(lsof -ti :8000 -ti :5173 -ti :3000 2>/dev/null || true)
    if [ -n "$STILL_ALIVE" ]; then
        echo -e "   Force stopping stubborn processes..."
        echo "$STILL_ALIVE" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
else
    echo -e "   No active processes found on ports ${PORTS[*]}."
fi

# Verify ports are clear
MAX_RETRIES=3
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    LEFTOVER=$(lsof -ti :8000 -ti :5173 -ti :3000 2>/dev/null || true)
    if [ -z "$LEFTOVER" ]; then
        break
    fi
    echo "$LEFTOVER" | xargs kill -9 2>/dev/null || true
    sleep 1
    RETRY=$((RETRY + 1))
done

FINAL_LEFTOVER=$(lsof -ti :8000 -ti :5173 -ti :3000 2>/dev/null || true)
if [ -n "$FINAL_LEFTOVER" ]; then
    echo -e "   ${RED}⚠️  Warning: Process(es) $(echo $FINAL_LEFTOVER | tr '\n' ' ') are still holding ports.${RESET}"
    if [ "$KILL_ONLY" = true ]; then
        exit 1
    fi
else
    echo -e "   ${GREEN}✓ Ports 8000, 5173, and 3000 are completely clear!${RESET}"
fi

if [ "$KILL_ONLY" = true ]; then
    echo -e "\n${GREEN}✅ Done. Target port services stopped (--kill-only).${RESET}"
    exit 0
fi

# 2. Python Environment Setup
echo -e "\n${CYAN}🐍 [2/4] Verifying Python virtual environment...${RESET}"
cd "$ROOT_DIR"

if [ -d "$ROOT_DIR/venv" ]; then
    source "$ROOT_DIR/venv/bin/activate"
elif [ -d "$ROOT_DIR/backend/venv" ]; then
    source "$ROOT_DIR/backend/venv/bin/activate"
else
    echo -e "   ${YELLOW}Creating new virtualenv in $ROOT_DIR/venv...${RESET}"
    python3 -m venv "$ROOT_DIR/venv"
    source "$ROOT_DIR/venv/bin/activate"
fi

echo -e "   ${GREEN}✓ Virtualenv active: $(which python)${RESET}"
export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"

# Optional Database Wipe
if [ "$WIPE_DB" = true ]; then
    echo -e "\n${YELLOW}🗑️  Wiping Neo4j AuraDB graph database...${RESET}"
    python "$ROOT_DIR/scripts/wipe_db.py"
fi

# 3. Check Frontend Dependencies
echo -e "\n${CYAN}📦 [3/4] Checking frontend dependencies...${RESET}"
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "   ${YELLOW}node_modules not found in frontend. Installing dependencies...${RESET}"
    (cd "$FRONTEND_DIR" && npm install)
else
    echo -e "   ${GREEN}✓ Frontend node_modules verified.${RESET}"
fi

if [ "$WITH_INTERVIEW" = true ] && [ -d "$INTERVIEW_DIR" ]; then
    if [ ! -d "$INTERVIEW_DIR/node_modules" ]; then
        echo -e "   ${YELLOW}Installing live-interview dependencies...${RESET}"
        (cd "$INTERVIEW_DIR" && npm install)
    fi
fi

# 4. Start Services
echo -e "\n${CYAN}🚀 [4/4] Starting services...${RESET}"
mkdir -p "$LOGS_DIR"

if [ "$DAEMON_MODE" = true ]; then
    # Background / Daemon Mode
    echo -e "   ▶ Starting Backend (uvicorn) in background -> $LOGS_DIR/backend.log"
    nohup uvicorn app.main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port 8000 --reload > "$LOGS_DIR/backend.log" 2>&1 &

    echo -e "   ▶ Starting Frontend (Vite) in background   -> $LOGS_DIR/frontend.log"
    (cd "$FRONTEND_DIR" && nohup npm run dev -- --host 0.0.0.0 --port 5173 > "$LOGS_DIR/frontend.log" 2>&1 &)

    if [ "$WITH_INTERVIEW" = true ] && [ -d "$INTERVIEW_DIR" ]; then
        echo -e "   ▶ Starting Live-Interview in background    -> $LOGS_DIR/interview.log"
        (cd "$INTERVIEW_DIR" && nohup npm run dev > "$LOGS_DIR/interview.log" 2>&1 &)
    fi

    echo -e "\n${GREEN}========================================================"
    echo -e "✅ Services successfully started in background!"
    echo -e "========================================================${RESET}"
    echo -e "🎯 ${BOLD}Frontend UI${RESET}  : ${CYAN}http://localhost:5173${RESET}"
    echo -e "🌐 ${BOLD}Backend API${RESET}  : ${CYAN}http://localhost:8000${RESET}"
    echo -e "📖 ${BOLD}Swagger Docs${RESET} : ${CYAN}http://localhost:8000/docs${RESET}"
    if [ "$WITH_INTERVIEW" = true ]; then
        echo -e "🎙️  ${BOLD}Interview${RESET}    : ${CYAN}http://localhost:3000${RESET}"
    fi
    echo -e "📜 ${BOLD}Logs${RESET}        : ${DIM}$LOGS_DIR/{backend,frontend}.log${RESET}"
    echo -e "🛑 ${BOLD}To Stop${RESET}     : ${YELLOW}./scripts/kill_servers.sh --kill-only${RESET}"
    echo -e "${GREEN}========================================================${RESET}"
    exit 0
fi

# Foreground Mode (Default)
cd "$ROOT_DIR"

echo -e "   ▶ Launching FastAPI Backend (port 8000)..."
uvicorn app.main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo -e "   ▶ Launching Vite Frontend (port 5173)..."
(cd "$FRONTEND_DIR" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

INTERVIEW_PID=""
if [ "$WITH_INTERVIEW" = true ] && [ -d "$INTERVIEW_DIR" ]; then
    echo -e "   ▶ Launching Live-Interview Bridge (port 3000)..."
    (cd "$INTERVIEW_DIR" && npm run dev) &
    INTERVIEW_PID=$!
fi

# Cleanup trap for graceful shutdown
cleanup() {
    echo -e "\n\n${YELLOW}🛑 Shutting down CareerOS services...${RESET}"
    kill $BACKEND_PID $FRONTEND_PID $INTERVIEW_PID 2>/dev/null || true
    lsof -ti :8000 -ti :5173 -ti :3000 2>/dev/null | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ All services stopped. Ports freed.${RESET}"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}========================================================"
echo -e "✨ CareerOS v5 Services are LIVE!"
echo -e "========================================================${RESET}"
echo -e "🎯 ${BOLD}Frontend UI${RESET}  : ${CYAN}http://localhost:5173${RESET}"
echo -e "🌐 ${BOLD}Backend API${RESET}  : ${CYAN}http://localhost:8000${RESET}"
echo -e "📖 ${BOLD}Swagger Docs${RESET} : ${CYAN}http://localhost:8000/docs${RESET}"
if [ "$WITH_INTERVIEW" = true ]; then
    echo -e "🎙️  ${BOLD}Interview${RESET}    : ${CYAN}http://localhost:3000${RESET}"
fi
echo -e "========================================================"
echo -e "${DIM}Press Ctrl+C to stop all services cleanly.${RESET}\n"

# Wait for all background jobs
wait $BACKEND_PID $FRONTEND_PID $INTERVIEW_PID
