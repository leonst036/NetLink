#!/usr/bin/env bash
set -e

# NetLink Minecraft Wings Remote Bootstrap Script
# Deploys Wings daemon artifacts on a target remote machine

TMP_SETUP_DIR="/tmp/netlink-wings-setup"
TARGET_DIR="${INSTALL_DIR:-/opt/netlink-wings}"
PORT="${DAEMON_PORT:-9080}"
TOKEN="${DAEMON_TOKEN:-netlink-secret-token}"

mkdir -p "$TMP_SETUP_DIR"

if [ -n "$DAEMON_TAR_B64" ]; then
    mkdir -p "$TARGET_DIR"
    echo "$DAEMON_TAR_B64" | base64 -d | tar -xz -C "$TARGET_DIR" || true
fi

if [ -n "$WINGS_PAYLOAD_B64" ]; then
    echo "$WINGS_PAYLOAD_B64" | base64 -d > "$TMP_SETUP_DIR/wings.ts"
fi

if [ -n "$INSTALLER_PAYLOAD_B64" ]; then
    echo "$INSTALLER_PAYLOAD_B64" | base64 -d > "$TMP_SETUP_DIR/installer.sh"
fi

if [ -f "$TMP_SETUP_DIR/installer.sh" ]; then
    chmod +x "$TMP_SETUP_DIR/installer.sh"
fi

mkdir -p "$TARGET_DIR"

if [ -f "$TMP_SETUP_DIR/wings.ts" ]; then
    cp "$TMP_SETUP_DIR/wings.ts" "$TARGET_DIR/wings.ts"
fi

if [ -f "$TMP_SETUP_DIR/installer.sh" ]; then
    cp "$TMP_SETUP_DIR/installer.sh" "$TARGET_DIR/installer.sh"
    chmod +x "$TARGET_DIR/installer.sh"
fi

export DAEMON_PORT="$PORT"
export DAEMON_TOKEN="$TOKEN"
export INSTALL_DIR="$TARGET_DIR"

if [ -f "$TARGET_DIR/installer.sh" ]; then
    bash "$TARGET_DIR/installer.sh"
fi

rm -rf "$TMP_SETUP_DIR"
