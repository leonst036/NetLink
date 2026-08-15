#!/usr/bin/env bash
set -e

# NetLink Minecraft Wings Daemon Uninstaller
INSTALL_DIR="${INSTALL_DIR:-/opt/netlink-wings}"
DATA_DIR="${DATA_DIR:-/var/lib/netlink-wings/servers}"
SERVICE_NAME="${SERVICE_NAME:-netlink-mc-wings}"

echo "[1/4] Stopping and disabling Wings service..."
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME" || true
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl disable "$SERVICE_NAME" || true
fi

echo "[2/4] Removing systemd service unit..."
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
fi

echo "[3/4] Removing daemon installation directory..."
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
fi

echo "[4/4] Checking server data directory..."
if [ "$1" == "--purge-data" ]; then
    echo "Purging all server data at $DATA_DIR..."
    rm -rf "$DATA_DIR"
else
    echo "Server data directory preserved at $DATA_DIR. (Use --purge-data to remove)"
fi

echo "NetLink Wings Daemon successfully uninstalled."
