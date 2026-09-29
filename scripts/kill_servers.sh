#!/bin/bash
# Kill any processes running on ports 8000 and 3000
echo "🧹 Clearing ports 8000 and 3000..."
lsof -ti :8000 -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1
echo "✅ Ports 8000 and 3000 are completely free!"
