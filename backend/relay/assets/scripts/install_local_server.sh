echo "====================================="
echo "      NetLink Node Installer         "
echo "====================================="

RELAY_URL="${relayUrl}"
DOCKER_RELAY_URL="$RELAY_URL"
if [[ "$DOCKER_RELAY_URL" == *"localhost"* ]]; then
    # Replace localhost with host.docker.internal for local docker testing
    DOCKER_RELAY_URL="${DOCKER_RELAY_URL//localhost/host.docker.internal}"
fi

read -p "Enter Target ID (your server's unique name): " TARGET_ID </dev/tty

if [ -z "$TARGET_ID" ]; then
    echo "Error: Target ID cannot be empty."
    exit 1
fi

echo "Validating Target ID '$TARGET_ID' with Relay ($RELAY_URL)..."
VALIDATION=$(curl -ks "$RELAY_URL/api/validate-target?target=$TARGET_ID")

if [[ $VALIDATION == *"\\"valid\\":true"* ]]; then
    JWT_TOKEN=$(echo "$VALIDATION" | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
    echo "Target ID is valid! Proceeding with Docker installation..."
else
    echo "Error: Target ID '$TARGET_ID' is already taken or invalid."
    exit 1
fi

docker run -d --network host --add-host=host.docker.internal:host-gateway --name netlink-node -e RELAY_URL="$DOCKER_RELAY_URL" -e RELAY_TOKEN="$JWT_TOKEN" -v /var/run/docker.sock:/var/run/docker.sock leon036/netlink-node:latest

echo "Installation complete! Your node is connecting to NetLink."