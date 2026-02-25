#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
    echo ""
    echo "Shutting down..."
    kill $API_PID $WORKER_PID $FRONTEND_PID 2>/dev/null
    wait $API_PID $WORKER_PID $FRONTEND_PID 2>/dev/null
    echo "All processes stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

# --- Backend setup ---
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
    source "$BACKEND_DIR/venv/bin/activate"
    pip install -r "$BACKEND_DIR/requirements.txt"
else
    source "$BACKEND_DIR/venv/bin/activate"
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "ERROR: backend/.env not found. Create it with your OpenAI API key:"
    echo "  echo 'OPENAI_API_KEY=sk-...' > backend/.env"
    exit 1
fi

# --- Frontend setup ---
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install)
fi

# --- Start services ---
echo "Starting API server..."
(cd "$BACKEND_DIR" && source venv/bin/activate && uvicorn app.main:app --reload --port 8000) &
API_PID=$!

echo "Starting worker..."
(cd "$BACKEND_DIR" && source venv/bin/activate && PYTHONUNBUFFERED=1 python worker.py) &
WORKER_PID=$!

echo "Starting frontend..."
(cd "$FRONTEND_DIR" && npm run dev -- --port 5173) &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  AI KYC Risk Reviewer is running"
echo "========================================="
echo "  Frontend:  http://localhost:5173"
echo "  API:       http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "========================================="
echo "  Press Ctrl+C to stop all services"
echo "========================================="
echo ""

wait
