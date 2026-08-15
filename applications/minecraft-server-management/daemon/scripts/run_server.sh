#!/usr/bin/env bash
set -e

# NetLink Minecraft Server Runner Script
# Launches a Minecraft server instance with specified memory limits and jar file

SERVER_DIR="${1:-.}"
RAM_MB="${2:-2048}"
JAR_FILE="${3:-server.jar}"
MIN_RAM_MB=$((RAM_MB / 2))

if [ ! -d "$SERVER_DIR" ]; then
    echo "Creating server directory: $SERVER_DIR"
    mkdir -p "$SERVER_DIR"
fi

cd "$SERVER_DIR"

# Ensure EULA is accepted
if [ ! -f "eula.txt" ]; then
    echo "eula=true" > "eula.txt"
fi

# Ensure server jar exists
if [ ! -f "$JAR_FILE" ]; then
    echo "[Runner] $JAR_FILE not found. Downloading official Minecraft 1.20.4 server jar..."
    JAR_URL="https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar"
    curl -fsSL -o "$JAR_FILE" "$JAR_URL"
    echo "[Runner] $JAR_FILE downloaded successfully."
fi

echo "[Runner] Starting Minecraft instance in $SERVER_DIR with ${RAM_MB}MB RAM..."
exec java -Xms"${MIN_RAM_MB}M" -Xmx"${RAM_MB}M" -jar "$JAR_FILE" nogui
