echo "====================================="
echo "   NetLink Demo Node Installer       "
echo "====================================="

RELAY_URL="${relayUrl}"
DOCKER_RELAY_URL="$RELAY_URL"
if [[ "$DOCKER_RELAY_URL" == *"localhost"* ]]; then
    # Replace localhost with host.docker.internal for local docker testing
    DOCKER_RELAY_URL="${DOCKER_RELAY_URL//localhost/host.docker.internal}"
fi

echo "Setting up temporary demo user..."

# Request temporary credentials from the relay
RESPONSE=$(curl -ks -X POST "$RELAY_URL/api/demo-setup")

USERNAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*' | grep -o '[^"]*$')
PASSWORD=$(echo "$RESPONSE" | grep -o '"password":"[^"]*' | grep -o '[^"]*$')
TARGET_ID=$(echo "$RESPONSE" | grep -o '"targetId":"[^"]*' | grep -o '[^"]*$')
JWT_TOKEN=$(echo "$RESPONSE" | grep -o '"jwtToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ] || [ -z "$TARGET_ID" ] || [ -z "$JWT_TOKEN" ]; then
    echo "Error: Failed to create demo user on the relay server."
    echo "Response: $RESPONSE"
    exit 1
fi

echo "Success! Created temporary demo user."
echo "Starting NetLink Node in Docker (Will automatically destruct after 24h)..."

# Run docker container
docker run -d --rm --network host --add-host=host.docker.internal:host-gateway --name netlink-demo-$TARGET_ID -e RELAY_URL="$DOCKER_RELAY_URL" -e RELAY_TOKEN="$JWT_TOKEN" -e DEMO_TIMEOUT=86400 leon036/netlink-node:latest

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
