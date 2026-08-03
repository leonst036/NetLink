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
echo "   NetLink Demo Node Installer       "
echo "====================================="

RELAY_URL="${relayUrl}"
DOCKER_RELAY_URL="$RELAY_URL"
if [[ "$DOCKER_RELAY_URL" == *"localhost"* || "$DOCKER_RELAY_URL" == *"127.0.0.1"* ]]; then
    # Replace localhost with host.docker.internal for local docker testing
    DOCKER_RELAY_URL="${DOCKER_RELAY_URL//localhost/host.docker.internal}"
    DOCKER_RELAY_URL="${DOCKER_RELAY_URL//127.0.0.1/host.docker.internal}"
fi

echo "Setting up temporary demo user..."

# Request temporary credentials from the relay
RESPONSE=$(curl -sS -k -X POST "$RELAY_URL/api/demo-setup") || error_exit "Failed to connect to the relay server at $RELAY_URL"

USERNAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*' | grep -o '[^"]*$' || true)
PASSWORD=$(echo "$RESPONSE" | grep -o '"password":"[^"]*' | grep -o '[^"]*$' || true)
TARGET_ID=$(echo "$RESPONSE" | grep -o '"targetId":"[^"]*' | grep -o '[^"]*$' || true)
JWT_TOKEN=$(echo "$RESPONSE" | grep -o '"jwtToken":"[^"]*' | grep -o '[^"]*$' || true)

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ] || [ -z "$TARGET_ID" ] || [ -z "$JWT_TOKEN" ]; then
    error_exit "Failed to create demo user on the relay server. Response: $RESPONSE"
fi

echo "Success! Created temporary demo user."

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

echo "Starting NetLink Node in Docker (Will automatically destruct after 24h)..."

# Run docker container
docker run -d --rm --network host --add-host=host.docker.internal:host-gateway --name netlink-demo-$TARGET_ID -e PORT=0 -e RELAY_URL="$DOCKER_RELAY_URL" -e RELAY_TOKEN="$JWT_TOKEN" -e DEMO_TIMEOUT=86400 -e SCAN_CIDR="$SCAN_CIDR" leon036/netlink-node:latest || error_exit "Failed to start the Docker container."

echo ""
echo "====================================="
echo "DEMO READY!"
echo "====================================="
echo "URL:      $RELAY_URL"
echo "Username: $USERNAME"
echo "Password: $PASSWORD"
echo "====================================="
echo "Login to the URL above to manage your machine!"
echo "Note: The demo user and this node will expire automatically after 24 hours."
echo "To stop early, run: docker stop netlink-demo-$TARGET_ID"
