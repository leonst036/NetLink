#!/bin/bash
set -e

# Error handling functions
error_exit() {
    echo "Error: $1" >&2
    exit 1
}

# Check requirements
command -v curl >/dev/null 2>&1 || error_exit "curl is required but it's not installed."
command -v docker >/dev/null 2>&1 || error_exit "docker is required but it's not installed."
command -v grep >/dev/null 2>&1 || error_exit "grep is required but it's not installed."

docker info >/dev/null 2>&1 || error_exit "Docker is not running or you do not have permission. Please start Docker and try again."

echo "====================================="
echo "      NetLink Node Installer         "
echo "====================================="

RELAY_URL="${relayUrl}"
DOCKER_RELAY_URL="$RELAY_URL"
if [[ "$DOCKER_RELAY_URL" == *"localhost"* || "$DOCKER_RELAY_URL" == *"127.0.0.1"* ]]; then
    # Replace localhost with host.docker.internal for local docker testing
    DOCKER_RELAY_URL="${DOCKER_RELAY_URL//localhost/host.docker.internal}"
    DOCKER_RELAY_URL="${DOCKER_RELAY_URL//127.0.0.1/host.docker.internal}"
fi

read -p "Enter Target ID (your server's unique name): " TARGET_ID </dev/tty || error_exit "Failed to read Target ID."

if [ -z "$TARGET_ID" ]; then
    error_exit "Target ID cannot be empty."
fi

echo "Validating Target ID '$TARGET_ID' with Relay ($RELAY_URL)..."
VALIDATION=$(curl -sS -k "$RELAY_URL/api/validate-target?target=$TARGET_ID") || error_exit "Failed to connect to the relay server at $RELAY_URL"

if [[ $VALIDATION == *"\"valid\":true"* ]]; then
    JWT_TOKEN=$(echo "$VALIDATION" | grep -o '"token":"[^"]*' | grep -o '[^"]*$' || true)
    if [ -z "$JWT_TOKEN" ]; then
        error_exit "Failed to extract token from validation response: $VALIDATION"
    fi
    echo "Target ID is valid! Proceeding with Docker installation..."
else
    error_exit "Target ID '$TARGET_ID' is already taken or invalid. Response: $VALIDATION"
fi

echo "Detecting local network CIDR for scanning..."
DEFAULT_IFACE=$(ip route show default | awk '/default/ {print $5}')
if [ -n "$DEFAULT_IFACE" ]; then
    SCAN_CIDR=$(ip -o -f inet addr show "$DEFAULT_IFACE" | awk '{print $4}')
fi
if [ -z "$SCAN_CIDR" ]; then
    SCAN_CIDR="192.168.1.0/24"
    echo "Could not auto-detect network CIDR, defaulting to $SCAN_CIDR"
else
    echo "Detected network CIDR: $SCAN_CIDR"
fi

docker run -d --network host --add-host=host.docker.internal:host-gateway --name netlink-node -e RELAY_URL="$DOCKER_RELAY_URL" -e RELAY_TOKEN="$JWT_TOKEN" -e SCAN_CIDR="$SCAN_CIDR" -v /var/run/docker.sock:/var/run/docker.sock leon036/netlink-node:latest || error_exit "Failed to start the Docker container."

echo "Installation complete! Your node is connecting to NetLink."