#!/usr/bin/env bash
# Промт 117: установка sync-1c на Yandex VM (ubuntu@84.252.129.233).
# Запуск с dev-машины: bash apps/platform/scripts/install-vm-cron.sh
set -euo pipefail

VM_HOST="${VM_HOST:-ubuntu@84.252.129.233}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/proxy_key}"
REMOTE_DIR="/home/ubuntu/sync-1c"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

echo "→ sync files to ${VM_HOST}:${REMOTE_DIR}"
ssh -i "$SSH_KEY" "$VM_HOST" "mkdir -p ${REMOTE_DIR}/catalog-1c ${REMOTE_DIR}/yandex-vm"

rsync -avz -e "ssh -i $SSH_KEY" \
  "$REPO_ROOT/apps/platform/scripts/sync-1c-catalog.mjs" \
  "$REPO_ROOT/apps/platform/scripts/catalog-1c/" \
  "${VM_HOST}:${REMOTE_DIR}/"

rsync -avz -e "ssh -i $SSH_KEY" \
  "$REPO_ROOT/apps/platform/yandex-vm/sync-1c-runner.mjs" \
  "${VM_HOST}:${REMOTE_DIR}/yandex-vm/"

ssh -i "$SSH_KEY" "$VM_HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /home/ubuntu/sync-1c
if [ ! -f .env ]; then
  cat > .env.example <<'EOF'
FTP_HOST=gw.toopatch.ru
FTP_USER=
FTP_PASSWORD=
FTP_PATH=/s3/IMG/exchange/full_import/catalog1.xml
TARGET_DB=both
DATABASE_URL_UNPOOLED=
PG_PROXY_URL=https://tandoor-proxy.84-252-129-233.sslip.io
PG_PROXY_TOKEN=
SYNC_RUNNER_PORT=38443
SYNC_RUNNER_TOKEN=
SYNC_1C_SCRIPT=/home/ubuntu/sync-1c/sync-1c-catalog.mjs
EOF
  echo "Create /home/ubuntu/sync-1c/.env from .env.example (secrets not in git)"
fi

# node deps (basic-ftp, sax, pg) — from platform checkout on VM if present
if [ -d /home/ubuntu/tandoor-platform/apps/platform ]; then
  cd /home/ubuntu/tandoor-platform/apps/platform && npm install --omit=dev
  export NODE_PATH=/home/ubuntu/tandoor-platform/apps/platform/node_modules
fi

sudo tee /etc/systemd/system/sync-1c-catalog.service >/dev/null <<'UNIT'
[Unit]
Description=Tandoor 1C catalog import (oneshot)

[Service]
Type=oneshot
WorkingDirectory=/home/ubuntu/sync-1c
EnvironmentFile=-/home/ubuntu/sync-1c/.env
Environment=NODE_PATH=/home/ubuntu/tandoor-platform/apps/platform/node_modules
ExecStart=/usr/bin/node /home/ubuntu/sync-1c/sync-1c-catalog.mjs
UNIT

sudo tee /etc/systemd/system/sync-1c-catalog.timer >/dev/null <<'TIMER'
[Unit]
Description=Hourly 1C catalog import

[Timer]
OnCalendar=hourly
Persistent=true
Unit=sync-1c-catalog.service

[Install]
WantedBy=timers.target
TIMER

sudo tee /etc/systemd/system/sync-1c-runner.service >/dev/null <<'RUNNER'
[Unit]
Description=Tandoor sync-1c HTTP runner
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/sync-1c
EnvironmentFile=-/home/ubuntu/sync-1c/.env
Environment=NODE_PATH=/home/ubuntu/tandoor-platform/apps/platform/node_modules
Environment=SYNC_1C_SCRIPT=/home/ubuntu/sync-1c/sync-1c-catalog.mjs
ExecStart=/usr/bin/node /home/ubuntu/sync-1c/yandex-vm/sync-1c-runner.mjs
Restart=always

[Install]
WantedBy=multi-user.target
RUNNER

sudo systemctl daemon-reload
sudo systemctl enable --now sync-1c-catalog.timer
sudo systemctl enable --now sync-1c-runner.service || true
echo "Timers:"
systemctl list-timers | grep sync-1c || true
REMOTE

echo "Done. Configure .env on VM, then: systemctl status sync-1c-runner"
