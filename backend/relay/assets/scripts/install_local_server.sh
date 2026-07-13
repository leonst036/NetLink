echo "====================================="
echo "      NetLink Node Installer         "
echo "====================================="

RELAY_URL="${relayUrl}"

read -p "Enter Target ID (your server's unique name): " TARGET_ID </dev/tty

if [ -z "$TARGET_ID" ]; then
    echo "Error: Target ID cannot be empty."
    exit 1
fi

echo "Validating Target ID '$TARGET_ID' with Relay ($RELAY_URL)..."
VALIDATION=$(curl -ks "$RELAY_URL/api/validate-target?target=$TARGET_ID")

if [[ $VALIDATION == *"\\"valid\\":true"* ]]; then
    echo "Target ID is valid! Proceeding with Docker installation..."
else
    echo "Error: Target ID '$TARGET_ID' is already taken or invalid."
    exit 1
fi

docker run -d --name netlink-node -e RELAY_URL="$RELAY_URL" -e TARGET_ID="$TARGET_ID" -v /var/run/docker.sock:/var/run/docker.sock netlink/node:latest

echo "Installation complete! Your node is connecting to NetLink."