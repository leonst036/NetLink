#!/usr/bin/env bash
set -e

INSTALL_DIR="/opt/netlink-wings"
DATA_DIR="/var/lib/netlink-wings/servers"
SERVICE_NAME="netlink-mc-wings"
PORT="${DAEMON_PORT:-8080}"
TOKEN="${DAEMON_TOKEN:-netlink-secret-token}"

echo "[1/5] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"

echo "[2/5] Checking prerequisites..."
if ! command -v java &> /dev/null; then
    echo "Java not found. Attempting to install OpenJDK..."
    if command -v apt-get &> /dev/null; then
        apt-get update -y && apt-get install -y openjdk-17-jre-headless curl
    elif command -v yum &> /dev/null; then
        yum install -y java-17-openjdk-headless curl
    elif command -v apk &> /dev/null; then
        apk add openjdk17-jre curl
    else
        echo "Warning: Package manager not recognized. Please install Java 17+ manually."
    fi
fi

if ! command -v deno &> /dev/null; then
    echo "Installing Deno runtime..."
    curl -fsSL https://deno.land/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
    cp "$HOME/.deno/bin/deno" /usr/local/bin/deno 2>/dev/null || true
fi

echo "[3/5] Setting up Wings daemon environment..."
cat << 'EOF' > "$INSTALL_DIR/wings.env"
PORT=8080
DATA_DIR=/var/lib/netlink-wings/servers
AUTH_TOKEN=netlink-secret-token
EOF

echo "[4/5] Creating systemd service..."
cat << EOF > /etc/systemd/system/${SERVICE_NAME}.service
[Unit]
Description=NetLink Minecraft Wings Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/wings.env
ExecStart=/usr/local/bin/deno run --allow-all $INSTALL_DIR/wings.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "[5/5] Enabling and starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "NetLink Wings Daemon installed and running on port $PORT."
