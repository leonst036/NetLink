#!/usr/bin/env bash
set -e

# NetLink Minecraft Wings Daemon Installer
INSTALL_DIR="${INSTALL_DIR:-/opt/netlink-wings}"
DATA_DIR="${DATA_DIR:-/var/lib/netlink-wings/servers}"
SERVICE_NAME="${SERVICE_NAME:-netlink-mc-wings}"
PORT="${DAEMON_PORT:-9080}"
TOKEN="${DAEMON_TOKEN:-netlink-secret-token}"

echo "[1/5] Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"

echo "[2/5] Checking and installing prerequisites..."
if ! command -v java &> /dev/null; then
    echo "Java not found. Attempting to install OpenJDK 17+..."
    if command -v apt-get &> /dev/null; then
        apt-get update -y && apt-get install -y openjdk-17-jre-headless curl unzip tar
    elif command -v dnf &> /dev/null; then
        dnf install -y java-17-openjdk-headless curl unzip tar
    elif command -v yum &> /dev/null; then
        yum install -y java-17-openjdk-headless curl unzip tar
    elif command -v apk &> /dev/null; then
        apk add openjdk17-jre curl unzip tar
    elif command -v pacman &> /dev/null; then
        pacman -Sy --noconfirm jre17-openjdk-headless curl unzip tar
    elif command -v zypper &> /dev/null; then
        zypper install -y java-17-openjdk-headless curl unzip tar
    else
        echo "Warning: Package manager not recognized. Please install Java 17+ manually."
    fi
fi

if ! command -v deno &> /dev/null; then
    echo "Installing Deno runtime..."
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh || curl -fsSL https://deno.land/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH:/usr/local/bin"
    if [ -f "$HOME/.deno/bin/deno" ] && [ ! -f "/usr/local/bin/deno" ]; then
        cp "$HOME/.deno/bin/deno" /usr/local/bin/deno 2>/dev/null || true
    fi
fi

echo "[3/5] Setting up Wings daemon environment..."
cat << EOF > "$INSTALL_DIR/wings.env"
PORT=$PORT
DATA_DIR=$DATA_DIR
AUTH_TOKEN=$TOKEN
EOF
chmod 600 "$INSTALL_DIR/wings.env"

echo "[4/5] Creating systemd service..."
DENO_BIN="$(command -v deno || echo "/usr/local/bin/deno")"

cat << EOF > /etc/systemd/system/${SERVICE_NAME}.service
[Unit]
Description=NetLink Minecraft Wings Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/wings.env
ExecStart=$DENO_BIN run --allow-all $INSTALL_DIR/wings.ts
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

echo "[5/5] Enabling and starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "NetLink Wings Daemon installed and running on port $PORT."
