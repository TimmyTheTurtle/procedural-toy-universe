#!/usr/bin/env bash
# Verify a loopback dev server and print the SSH port-forwarding command for a remote VS Code client.
set -euo pipefail

port="${1:-}"
if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    echo "Usage: $0 <port>" >&2
    exit 2
fi

listener="$(ss -tln "sport = :$port" | tail -n +2 || true)"
if [[ -z "$listener" ]]; then
    echo "FAIL: nothing is listening on port $port." >&2
    exit 1
fi
echo "Listener:"
echo "$listener"

if echo "$listener" | grep -Eq '(0\.0\.0\.0|\*|\[::\]):'"$port"'\b'; then
    echo "WARNING: port $port is exposed beyond loopback." >&2
fi

status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$port/" || true)"
if [[ "$status" != "200" ]]; then
    echo "FAIL: http://127.0.0.1:$port/ returned '${status:-no response}'." >&2
    exit 1
fi
echo "OK: http://127.0.0.1:$port/ returned HTTP 200."

host_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' | head -n 1)"
host_ip="${host_ip:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

echo
if [[ "$port" == "5290" ]]; then
    echo "VS Code Remote should auto-forward port 5290 for the Construction Workbench."
else
    echo "This port is not the saved standard; forward it in the VS Code Ports panel."
fi
echo "If automatic forwarding is unavailable, run this on the machine running VS Code:"
echo "  ssh -N -L $port:localhost:$port $(whoami)@${host_ip:-<host-ip>}"
echo "Then open: http://localhost:$port"
