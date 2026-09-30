#!/bin/bash
# Kill any processes running on ports 8000, 3000, and 5173
echo "🧹 Clearing ports 8000, 3000, and 5173..."
lsof -ti :8000 -ti :3000 -ti :5173 | xargs kill -9 2>/dev/null || true
sleep 1
echo "✅ Ports 8000, 3000, and 5173 are completely free!"
