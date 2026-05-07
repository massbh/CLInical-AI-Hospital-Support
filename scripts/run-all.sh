#!/usr/bin/env bash
# CLInical AI Hospital Support — interactive stack manager.
# Cross-platform: Git Bash (Windows), macOS, Linux.
#
# Usage:
#   ./scripts/run-all.sh                    # interactive menu
#   ./scripts/run-all.sh start              # boot everything
#   ./scripts/run-all.sh start --no-whisper --no-email
#   ./scripts/run-all.sh stop
#   ./scripts/run-all.sh reload-db          # docker compose down -v + up
#   ./scripts/run-all.sh status

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts"
PID_FILE="$SCRIPT_DIR/.pids"
COMPOSE_FILE="$REPO_ROOT/database/docker-compose.yml"

NO_EMAIL=0
NO_WHISPER=0

# ---- platform detection ------------------------------------------------------
case "$(uname -s)" in
    Darwin*)              OS=mac ;;
    Linux*)               OS=linux ;;
    MINGW*|MSYS*|CYGWIN*) OS=windows ;;
    *)                    OS=unknown ;;
esac

# ---- pretty printing ---------------------------------------------------------
if [ -t 1 ]; then
    C_CYAN=$'\e[36m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_RED=$'\e[31m'; C_RESET=$'\e[0m'; C_DIM=$'\e[2m'
else
    C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_RESET=''; C_DIM=''
fi
step() { printf "%s==> %s%s\n" "$C_CYAN" "$1" "$C_RESET"; }
ok()   { printf "  %s[ok]%s %s\n"   "$C_GREEN"  "$C_RESET" "$1"; }
warn() { printf "  %s[warn]%s %s\n" "$C_YELLOW" "$C_RESET" "$1"; }
err()  { printf "  %s[err]%s %s\n"  "$C_RED"    "$C_RESET" "$1"; }

# ---- helpers -----------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

wait_tcp() {  # wait_tcp <port> <timeout_s>
    local port="$1" timeout="${2:-60}" elapsed=0
    while [ "$elapsed" -lt "$timeout" ]; do
        if (echo > "/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then return 0; fi
        sleep 1; elapsed=$((elapsed + 1))
    done
    return 1
}

wait_http() {  # wait_http <url> <timeout_s>
    local url="$1" timeout="${2:-30}" elapsed=0
    while [ "$elapsed" -lt "$timeout" ]; do
        if curl -fsS -m 2 "$url" >/dev/null 2>&1; then return 0; fi
        sleep 1; elapsed=$((elapsed + 1))
    done
    return 1
}

# ---- platform-specific spawn -------------------------------------------------
# Open a new terminal window running `cd <workdir> && <command>`.
spawn() {  # spawn <name> <workdir> <command...>
    local name="$1" workdir="$2"; shift 2
    local inner="cd '$workdir' && $* ; echo; echo '[$name exited — press enter to close]'; read"

    case "$OS" in
        windows)
            mintty --title "$name" -h always /usr/bin/bash -c "$inner" &
            ;;
        mac)
            # AppleScript needs the command as a single line; escape quotes
            local esc="${inner//\\/\\\\}"; esc="${esc//\"/\\\"}"
            osascript -e "tell application \"Terminal\" to do script \"$esc\"" >/dev/null
            ;;
        linux)
            if   have gnome-terminal; then gnome-terminal --title="$name" -- bash -c "$inner" &
            elif have konsole;        then konsole --new-tab -p "tabtitle=$name" -e bash -c "$inner" &
            elif have xterm;          then xterm -T "$name" -e bash -c "$inner" &
            else
                err "no supported terminal found (need gnome-terminal, konsole, or xterm)"
                return 1
            fi
            ;;
        *)
            err "unsupported OS for spawning windows: $OS"
            return 1
            ;;
    esac
    ok "$name — terminal window opened"
}

# ---- platform-specific kill --------------------------------------------------
# Kill all processes listening on a TCP port, plus their descendants.
kill_port() {  # kill_port <port> <label>
    local port="$1" label="$2"
    local pids=''
    case "$OS" in
        windows)
            pids=$(powershell -NoProfile -Command \
                "Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess" \
                2>/dev/null | tr -d '\r' | grep -E '^[0-9]+$' | sort -u)
            ;;
        mac|linux)
            if have lsof; then
                pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)
            elif have ss; then
                pids=$(ss -lntp "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
            fi
            ;;
    esac
    if [ -z "$pids" ]; then
        warn "$label (:$port) — nothing listening"
        return
    fi
    for pid in $pids; do
        kill_tree "$pid" "$label (:$port)"
    done
}

# Kill a pid and its children.
kill_tree() {  # kill_tree <pid> <label>
    local pid="$1" label="$2"
    case "$OS" in
        windows)
            # Use PowerShell to walk descendants and Stop-Process them all.
            local out
            out=$(powershell -NoProfile -Command "
\$queue = New-Object System.Collections.Queue
\$queue.Enqueue([int]$pid)
\$all = New-Object System.Collections.Generic.HashSet[int]
while (\$queue.Count -gt 0) {
    \$cur = \$queue.Dequeue()
    if (-not \$all.Add(\$cur)) { continue }
    Get-CimInstance Win32_Process -Filter \"ParentProcessId=\$cur\" -ErrorAction SilentlyContinue |
        ForEach-Object { \$queue.Enqueue([int]\$_.ProcessId) }
}
foreach (\$p in \$all) {
    try {
        \$proc = Get-Process -Id \$p -ErrorAction Stop
        Stop-Process -Id \$p -Force -ErrorAction Stop
        Write-Host (\"killed pid \" + \$p + \" (\" + \$proc.ProcessName + \")\")
    } catch {
        Write-Host (\"FAILED pid \" + \$p + \": \" + \$_.Exception.Message)
    }
}
" 2>&1)
            if [ -n "$out" ]; then
                echo "$out" | tr -d '\r' | while read -r line; do
                    case "$line" in
                        killed*) ok "$label — $line" ;;
                        FAILED*) err "$label — $line" ;;
                        *)       [ -n "$line" ] && warn "$label — $line" ;;
                    esac
                done
            else
                warn "$label (pid $pid) — no output from kill"
            fi
            ;;
        mac|linux)
            # Collect children recursively, then kill leaves first
            local all="$pid"
            local queue="$pid"
            while [ -n "$queue" ]; do
                local next=''
                for p in $queue; do
                    local kids
                    kids=$(pgrep -P "$p" 2>/dev/null || true)
                    next="$next $kids"
                    all="$all $kids"
                done
                queue="$next"
            done
            for p in $all; do
                [ -z "$p" ] && continue
                kill -TERM "$p" 2>/dev/null || true
            done
            sleep 0.3
            for p in $all; do
                [ -z "$p" ] && continue
                kill -KILL "$p" 2>/dev/null || true
            done
            ok "killed $label (pid $pid + children)"
            ;;
    esac
}

# Kill processes matching a command-line regex.
kill_by_cmdline() {  # kill_by_cmdline <label> <regex>
    local label="$1" regex="$2" pids=''
    case "$OS" in
        windows)
            # WMIC is deprecated but still available on most Win10/11; fall back to PowerShell.
            if have wmic; then
                pids=$(wmic process get ProcessId,CommandLine /format:csv 2>/dev/null \
                       | grep -iE "$regex" \
                       | awk -F, 'NF>1 { print $NF }' \
                       | tr -d '\r' | grep -E '^[0-9]+$' | sort -u)
            else
                pids=$(powershell -NoProfile -Command \
                    "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -match '$regex' } | Select-Object -ExpandProperty ProcessId" \
                    2>/dev/null | tr -d '\r' | grep -E '^[0-9]+$' | sort -u)
            fi
            ;;
        mac|linux)
            pids=$(pgrep -f "$regex" 2>/dev/null | sort -u || true)
            ;;
    esac
    if [ -z "$pids" ]; then
        warn "$label — nothing matched /$regex/"
        return
    fi
    for pid in $pids; do
        kill_tree "$pid" "$label"
    done
}

# ---- actions -----------------------------------------------------------------
do_stop() {
    step 'Killing services by listening port'
    kill_port 8000  'batching'
    kill_port 8001  'medBrain'
    kill_port 8002  'tradLlm'
    kill_port 8003  'emailService'
    kill_port 3000  'webPlatform'
    kill_port 11434 'ollama'

    step 'Killing stragglers by command line'
    kill_by_cmdline 'uvicorn'  'uvicorn'
    kill_by_cmdline 'next dev' 'next.*dev'
    kill_by_cmdline 'whisper'  'transcribe\.py'
    kill_by_cmdline 'ollama'   'ollama'

    if [ "$OS" = 'windows' ]; then
        step 'Closing mintty windows'
        for t in batching medBrain tradLlm emailService whisper webPlatform; do
            taskkill //FI "WINDOWTITLE eq $t" //T //F >/dev/null 2>&1 || true
        done
    fi

    rm -f "$PID_FILE"

    step 'Stopping database container'
    docker compose -f "$COMPOSE_FILE" down
    ok 'stopped'
}

do_reload_db() {
    step 'Reloading database (down -v + up)'
    docker compose -f "$COMPOSE_FILE" down -v
    docker compose -f "$COMPOSE_FILE" up -d
    if wait_tcp 5432 60; then ok 'postgres ready on :5432 (fresh schema from init.sql)'
    else err 'postgres did not become ready'; return 1; fi
}

do_status() {
    step 'Status'
    local items=(
        "postgres :5432|tcp|5432"
        "ollama :11434|http|http://localhost:11434/api/tags"
        "batching :8000|http|http://localhost:8000/docs"
        "medBrain :8001|http|http://localhost:8001/docs"
        "tradLlm :8002|http|http://localhost:8002/docs"
        "emailService :8003|http|http://localhost:8003/docs"
        "webPlatform :3000|http|http://localhost:3000"
    )
    for item in "${items[@]}"; do
        IFS='|' read -r name kind target <<< "$item"
        if [ "$kind" = 'tcp' ]; then
            if wait_tcp "$target" 1; then ok "$name up"; else warn "$name down"; fi
        else
            if wait_http "$target" 1; then ok "$name up"; else warn "$name down"; fi
        fi
    done
}

do_start() {
    step "Preflight checks (OS: $OS)"
    local missing=()
    local required=(docker ollama python npm curl)
    case "$OS" in
        windows) required+=(mintty) ;;
        # mac/linux: terminal command checked at spawn time
    esac
    for c in "${required[@]}"; do
        if have "$c"; then ok "$c on PATH"; else err "$c missing"; missing+=("$c"); fi
    done
    [ ${#missing[@]} -gt 0 ] && { err "Install: ${missing[*]}"; return 1; }

    local env_files=("tradLlm/.env" "medBrain/.env" "webPlatform/.env.local")
    [ "$NO_EMAIL" -eq 0 ] && env_files+=("emailService/.env")
    for e in "${env_files[@]}"; do
        if [ -f "$REPO_ROOT/$e" ]; then ok "$e"; else err "missing $e"; missing+=("$e"); fi
    done
    if [ ! -d "$REPO_ROOT/webPlatform/node_modules" ]; then
        err 'webPlatform/node_modules missing — run: cd webPlatform && npm install'
        missing+=('node_modules')
    fi
    [ ${#missing[@]} -gt 0 ] && return 1

    [ -f "$PID_FILE" ] && { warn "stale pid file — removing"; rm -f "$PID_FILE"; }
    : > "$PID_FILE"

    # Database
    step 'Starting Postgres'
    docker compose -f "$COMPOSE_FILE" up -d >/dev/null
    if wait_tcp 5432 60; then ok 'postgres ready on :5432'
    else err 'postgres did not become ready'; return 1; fi

    # Ollama
    step 'Checking Ollama'
    if wait_http 'http://localhost:11434/api/tags' 2; then
        ok 'ollama already running on :11434'
    else
        warn 'ollama not running — please start it (`ollama serve`) and re-run'
        return 1
    fi

    if curl -fsS -m 5 http://localhost:11434/api/tags | grep -q 'medllama2'; then
        ok 'ollama has medllama2'
    else
        err 'medllama2 not pulled. Run: ollama pull medllama2:latest'
        return 1
    fi

    # Service windows
    step 'Spawning service windows'
    spawn 'batching' "$REPO_ROOT/eavesdropper/batching" uvicorn main:app --reload --port 8000
    spawn 'medBrain' "$REPO_ROOT/medBrain"             uvicorn app.main:app --reload --port 8001
    spawn 'tradLlm'  "$REPO_ROOT/tradLlm"              uvicorn app.main:app --reload --port 8002
    [ "$NO_EMAIL"   -eq 0 ] && spawn 'emailService' "$REPO_ROOT/emailService" uvicorn app.main:app --reload --port 8003
    [ "$NO_WHISPER" -eq 0 ] && spawn 'whisper'      "$REPO_ROOT/eavesdropper" python transcribe.py --model tiny --output transcript.txt
    spawn 'webPlatform' "$REPO_ROOT/webPlatform" npm run dev

    step 'Waiting for services to come up'
    sleep 5

    local checks=(
        "batching|http://localhost:8000/docs"
        "medBrain|http://localhost:8001/docs"
        "tradLlm|http://localhost:8002/docs"
        "webPlatform|http://localhost:3000"
    )
    [ "$NO_EMAIL" -eq 0 ] && checks+=("emailService|http://localhost:8003/docs")

    for c in "${checks[@]}"; do
        IFS='|' read -r name url <<< "$c"
        if wait_http "$url" 30; then ok "$name -> $url"
        else warn "$name not responding at $url (it may still be booting)"; fi
    done

    echo
    printf "%sStack is up. Open:%s\n" "$C_CYAN" "$C_RESET"
    echo "  http://localhost:3000/conversation"
}

# ---- menu --------------------------------------------------------------------
show_menu() {
    while true; do
        echo
        printf "%s======================================================%s\n" "$C_CYAN" "$C_RESET"
        echo   "  CLInical AI Hospital Support — Stack Manager"
        printf "%s======================================================%s\n" "$C_CYAN" "$C_RESET"
        echo   "  1) Start everything"
        echo   "  2) Stop everything"
        echo   "  3) Reload database (down -v + up, recreates schema)"
        echo   "  4) Status"
        echo   "  5) Start without whisper"
        echo   "  6) Start without email"
        echo   "  q) Quit"
        echo
        read -r -p 'Select an option: ' choice
        case "$choice" in
            1) do_start ;;
            2) do_stop ;;
            3) do_reload_db ;;
            4) do_status ;;
            5) NO_WHISPER=1; do_start; NO_WHISPER=0 ;;
            6) NO_EMAIL=1;   do_start; NO_EMAIL=0 ;;
            q|Q) return ;;
            *) warn "Unknown option: $choice" ;;
        esac
    done
}

# ---- entrypoint --------------------------------------------------------------
ACTION="${1:-}"
shift || true
while [ $# -gt 0 ]; do
    case "$1" in
        --no-email)   NO_EMAIL=1 ;;
        --no-whisper) NO_WHISPER=1 ;;
        *) ;;
    esac
    shift
done

case "$ACTION" in
    start)     do_start ;;
    stop)      do_stop ;;
    reload-db) do_reload_db ;;
    status)    do_status ;;
    '')        show_menu ;;
    *)         echo "Unknown action: $ACTION"; echo "Usage: $0 [start|stop|reload-db|status] [--no-email] [--no-whisper]"; exit 1 ;;
esac
