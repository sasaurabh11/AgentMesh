#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  AgentMesh — one-command startup
#  Usage:  ./start.sh
#  Stops:  Ctrl+C  (kills all services cleanly)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
B='\033[1m'
G='\033[0;32m'
BL='\033[0;34m'
CY='\033[0;36m'
YL='\033[1;33m'
RD='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

step()  { echo -e "\n${BL}${B}[$1/$TOTAL]${NC} $2"; }
ok()    { echo -e "  ${G}✓${NC} $1"; }
warn()  { echo -e "  ${YL}⚠${NC}  $1"; }
err()   { echo -e "  ${RD}✗${NC} $1"; }
info()  { echo -e "  ${DIM}$1${NC}"; }
banner(){ echo -e "${CY}${B}$1${NC}"; }

TOTAL=7
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"

# Load .env so we can read TELEGRAM_BOT_TOKEN etc.
if [[ -f "$ROOT/.env" ]]; then
  set -a; source "$ROOT/.env"; set +a
fi

# ── PID tracking & cleanup ────────────────────────────────────────────────────
PIDS=()
trap_cleanup() {
  echo -e "\n${YL}${B}Shutting down AgentMesh…${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Stop the docker redis we started
  docker stop agentmesh-redis 2>/dev/null || true
  echo -e "${G}All services stopped. Goodbye!${NC}"
  exit 0
}
trap trap_cleanup SIGINT SIGTERM

# ── Helpers ───────────────────────────────────────────────────────────────────
wait_for_port() {
  local name=$1 port=$2 retries=${3:-30}
  echo -n "  Waiting for $name"
  for i in $(seq 1 $retries); do
    if nc -z localhost "$port" 2>/dev/null; then echo ""; return 0; fi
    echo -n "."; sleep 1
  done
  echo ""
  err "$name did not start on port $port in ${retries}s"
  return 1
}

wait_for_http() {
  local url=$1 retries=${2:-30}
  echo -n "  Waiting for backend"
  for i in $(seq 1 $retries); do
    if curl -sf "$url" >/dev/null 2>&1; then echo ""; return 0; fi
    echo -n "."; sleep 1
  done
  echo ""
  err "Backend did not respond at $url"
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
echo ""
banner "╔══════════════════════════════════════╗"
banner "║      AgentMesh  — Starting Up        ║"
banner "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Redis ─────────────────────────────────────────────────────────────
step 1 "Redis"
if redis-cli -p 6379 ping >/dev/null 2>&1; then
  ok "Redis already running on :6379"
else
  # Kill any leftover container first, then start fresh
  docker rm -f agentmesh-redis 2>/dev/null || true
  docker run -d --name agentmesh-redis \
    -p 6379:6379 \
    --restart unless-stopped \
    redis:7-alpine >/dev/null
  wait_for_port "Redis" 6379 20
  ok "Redis started via Docker on :6379"
fi

# ── Step 2: Python env ────────────────────────────────────────────────────────
step 2 "Python environment"
VENV="$BACKEND/venv"
if [[ ! -d "$VENV" ]]; then
  info "Creating virtual environment…"
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
info "Installing/verifying dependencies…"
pip install -r "$BACKEND/requirements.txt" -q --disable-pip-version-check
ok "Python venv ready  ($(python --version))"

# ── Step 3: Database migrations ───────────────────────────────────────────────
step 3 "Database migrations"
cd "$BACKEND"
alembic upgrade head 2>&1 | tail -3 | while read -r line; do info "$line"; done
ok "Migrations applied"

# ── Step 4: Backend ───────────────────────────────────────────────────────────
step 4 "Backend  (FastAPI · port 8000)"
cd "$BACKEND"
uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 \
  --reload --log-level warning \
  > "$LOGS/backend.log" 2>&1 &
PIDS+=($!)
wait_for_http "http://localhost:8000/health" 30
ok "Backend running  → http://localhost:8000"
info "Logs: $LOGS/backend.log"

# ── Step 5: Celery worker ─────────────────────────────────────────────────────
step 5 "Celery worker"
cd "$BACKEND"
celery -A app.tasks.scheduled_agents.celery_app worker \
  --loglevel=warning --concurrency=2 \
  > "$LOGS/celery.log" 2>&1 &
PIDS+=($!)
sleep 2
ok "Celery worker started"
info "Logs: $LOGS/celery.log"

# ── Step 6: Frontend ──────────────────────────────────────────────────────────
step 6 "Frontend  (Vite · port 5173)"
cd "$FRONTEND"
if [[ ! -d "node_modules" ]]; then
  info "Installing npm packages…"
  npm install -q
fi
npm run dev > "$LOGS/frontend.log" 2>&1 &
PIDS+=($!)
wait_for_port "Frontend" 5173 30
ok "Frontend running  → http://localhost:5173"
info "Logs: $LOGS/frontend.log"

# ── Step 7: ngrok + Telegram webhook ─────────────────────────────────────────
step 7 "ngrok tunnel + Telegram webhook"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  warn "TELEGRAM_BOT_TOKEN not set in .env — skipping ngrok & webhook"
else
  # Kill any existing ngrok on port 4040
  pkill -f "ngrok http" 2>/dev/null || true
  sleep 1

  ngrok http 8000 \
    --log=stdout \
    --log-format=json \
    > "$LOGS/ngrok.log" 2>&1 &
  PIDS+=($!)

  # Wait for ngrok API (port 4040)
  wait_for_port "ngrok API" 4040 20

  # Extract HTTPS public URL from ngrok API
  PUBLIC_URL=""
  for i in $(seq 1 10); do
    PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
      | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    https = [t['public_url'] for t in tunnels if t.get('proto') == 'https']
    print(https[0] if https else '')
except Exception:
    print('')
" 2>/dev/null)
    [[ -n "$PUBLIC_URL" ]] && break
    sleep 1
  done

  if [[ -z "$PUBLIC_URL" ]]; then
    warn "Could not retrieve ngrok public URL — check $LOGS/ngrok.log"
  else
    ok "ngrok tunnel → $PUBLIC_URL"

    # Update PUBLIC_BASE_URL in .env
    sed -i.bak "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=$PUBLIC_URL|" "$ROOT/.env"

    # Register webhook with Telegram via backend API
    WEBHOOK_URL="$PUBLIC_URL/webhook/telegram"
    RESULT=$(curl -sf -X POST \
      "http://localhost:8000/api/settings/telegram/register?webhook_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$WEBHOOK_URL', safe=''))")" \
      -H "Content-Type: application/json" 2>/dev/null || echo '{"ok":false}')

    if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('ok') else 1)" 2>/dev/null; then
      ok "Telegram webhook registered → $WEBHOOK_URL"
    else
      warn "Webhook registration returned unexpected response — check bot token"
      info "$RESULT"
    fi
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${G}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${G}${B}  AgentMesh is running!${NC}"
echo -e "${G}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${B}Frontend${NC}   →  ${CY}http://localhost:5173${NC}"
echo -e "  ${B}Backend${NC}    →  ${CY}http://localhost:8000${NC}"
echo -e "  ${B}API Docs${NC}   →  ${CY}http://localhost:8000/docs${NC}"
if [[ -n "${PUBLIC_URL:-}" ]]; then
  echo -e "  ${B}Public URL${NC} →  ${CY}$PUBLIC_URL${NC}"
  echo -e "  ${B}Telegram${NC}   →  ${G}webhook active${NC}"
fi
echo ""
echo -e "  Logs: ${DIM}$LOGS/${NC}"
echo -e "  Press ${B}Ctrl+C${NC} to stop all services"
echo ""

# Keep alive — wait for all background processes
wait
