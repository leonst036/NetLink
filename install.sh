#!/usr/bin/env bash

# ==============================================================================
# NetLink Docker Installer & Interactive Setup Script
# ==============================================================================

set -e

# Color definitions for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  _  _ ___ _____ _    ___ _  _ _  __"
    echo " | \| | __|_   _| |  |_ _| \| | |/ /"
    echo " | .\` | _|  | | | |___| || .\` | ' < "
    echo " |_|\_|___| |_| |_____|___|_|\_|_|\_\\"
    echo -e "${NC}"
    echo -e "${BOLD}NetLink Remote Access Gateway - Docker Installer${NC}"
    echo "--------------------------------------------------------"
    echo ""
}

check_prerequisites() {
    echo -e "${BLUE}==> Checking prerequisites...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed or not in PATH.${NC}"
        echo "Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}Error: Docker Compose is not installed.${NC}"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi

    echo -e "${GREEN}✓ Docker and Docker Compose ($DOCKER_COMPOSE_CMD) are available.${NC}\n"
}

prompt_config() {
    echo -e "${YELLOW}${BOLD}==> Interactive Setup & Configuration${NC}"
    echo "Press [Enter] to accept the default value shown in brackets.\n"

    # 1. Mode Selection
    echo -e "${BOLD}Select Deployment Mode:${NC}"
    echo "  1) Full Stack (Relay Server + Local Server + MongoDB) [Recommended]"
    echo "  2) Relay Gateway Only (Relay Server + MongoDB)"
    echo "  3) Local Daemon Only (Local Server for home network)"
    read -p "Choice [1-3, default: 1]: " MODE_CHOICE
    MODE_CHOICE=${MODE_CHOICE:-1}

    DEFAULT_JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "netlink_secret_$(date +%s)")
    DEFAULT_RELAY_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VJZCI6ImxvY2FsLXNlcnZlciIsImlhdCI6MTc4NjE0ODk1M30.LYcW99CQ4nfekI73qy5hwkzZLmlrbOx3MPa9huMt4pI"

    # Relay Server Settings
    if [ "$MODE_CHOICE" = "1" ] || [ "$MODE_CHOICE" = "2" ]; then
        echo -e "\n${CYAN}${BOLD}--- Relay Server Settings ---${NC}"
        
        read -p "Admin Username [admin]: " INPUT_ADMIN_USERNAME
        ADMIN_USERNAME=${INPUT_ADMIN_USERNAME:-admin}

        read -sp "Admin Password [admin]: " INPUT_ADMIN_PASSWORD
        echo ""
        ADMIN_PASSWORD=${INPUT_ADMIN_PASSWORD:-admin}

        read -p "HTTP / Web UI Port [4535]: " INPUT_HTTP_PORT
        HTTP_PORT=${INPUT_HTTP_PORT:-4535}

        read -p "WebSocket Port [4536]: " INPUT_WS_PORT
        WS_PORT=${INPUT_WS_PORT:-4536}

        read -p "JWT Secret Key [Auto-generated]: " INPUT_JWT_SECRET
        JWT_SECRET=${INPUT_JWT_SECRET:-$DEFAULT_JWT_SECRET}

        read -p "Enable Native Container SSL (true/false) [false]: " INPUT_USE_SSL
        USE_SSL=${INPUT_USE_SSL:-false}
    fi

    # Local Server Settings
    if [ "$MODE_CHOICE" = "1" ] || [ "$MODE_CHOICE" = "3" ]; then
        echo -e "\n${CYAN}${BOLD}--- Local Server Daemon Settings ---${NC}"
        
        if [ "$MODE_CHOICE" = "1" ]; then
            DEF_RELAY_HOST="relay"
            DEF_RELAY_PORT="${WS_PORT:-4536}"
            DEF_RELAY_SSL="false"
        else
            DEF_RELAY_HOST="your-relay-ip-or-domain"
            DEF_RELAY_PORT="4536"
            DEF_RELAY_SSL="false"
        fi

        read -p "Relay Host/IP [$DEF_RELAY_HOST]: " INPUT_RELAY_HOST
        RELAY_HOST=${INPUT_RELAY_HOST:-$DEF_RELAY_HOST}

        read -p "Relay WebSocket Port [$DEF_RELAY_PORT]: " INPUT_RELAY_PORT
        RELAY_PORT=${INPUT_RELAY_PORT:-$DEF_RELAY_PORT}

        read -p "Relay SSL Enabled (true/false) [$DEF_RELAY_SSL]: " INPUT_RELAY_SSL
        RELAY_SSL=${INPUT_RELAY_SSL:-$DEF_RELAY_SSL}

        read -p "Relay Auth Token (RELAY_TOKEN) [Default Dev Token]: " INPUT_RELAY_TOKEN
        RELAY_TOKEN=${INPUT_RELAY_TOKEN:-$DEFAULT_RELAY_TOKEN}

        read -p "Network Scan CIDR (e.g. 192.168.1.0/24) [Auto-detect]: " INPUT_SCAN_CIDR
        SCAN_CIDR=${INPUT_SCAN_CIDR:-}
    fi

    # Docker Image Source
    echo -e "\n${CYAN}${BOLD}--- Image Source ---${NC}"
    echo "  1) Use official Docker Hub images (leon036/netlink-*) [Fastest]"
    echo "  2) Build images locally from source"
    read -p "Choice [1-2, default: 1]: " INPUT_IMAGE_CHOICE
    IMAGE_CHOICE=${INPUT_IMAGE_CHOICE:-1}
}

generate_docker_compose() {
    echo -e "\n${BLUE}==> Writing environment configuration (.env)...${NC}"
    
    cat <<EOF > .env
# NetLink Generated Environment Configuration
# Created: $(date)

# Relay Server Settings
HTTP_PORT=${HTTP_PORT:-4535}
WS_PORT=${WS_PORT:-4536}
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
JWT_SECRET=${JWT_SECRET:-$DEFAULT_JWT_SECRET}
USE_SSL=${USE_SSL:-false}

# Local Server Settings
RELAY_HOST=${RELAY_HOST:-relay}
RELAY_PORT=${RELAY_PORT:-4536}
RELAY_SSL=${RELAY_SSL:-false}
RELAY_TOKEN=${RELAY_TOKEN:-$DEFAULT_RELAY_TOKEN}
SCAN_CIDR=${SCAN_CIDR:-}
EOF

    echo -e "${BLUE}==> Writing docker-compose.yml...${NC}"

    RELAY_IMAGE="leon036/netlink-relay:latest"
    LOCAL_SERVER_IMAGE="leon036/netlink-local_server:latest"

    cat <<EOF > docker-compose.yml
services:
EOF

    # Mode 1 or Mode 2 includes MongoDB & Relay
    if [ "$MODE_CHOICE" = "1" ] || [ "$MODE_CHOICE" = "2" ]; then
        cat <<EOF >> docker-compose.yml
  mongodb:
    image: mongo:7.0
    container_name: netlink-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=NetLink
    volumes:
      - mongodb_data:/data/db
      - ./docker/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    healthcheck:
      test: ["CMD-SHELL", "mongosh --eval 'db.runCommand(\"ping\").ok' || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  relay:
EOF
        if [ "$IMAGE_CHOICE" = "2" ]; then
            cat <<EOF >> docker-compose.yml
    build:
      context: ./backend/relay
      dockerfile: Dockerfile
EOF
        else
            cat <<EOF >> docker-compose.yml
    image: ${RELAY_IMAGE}
EOF
        fi

        cat <<EOF >> docker-compose.yml
    container_name: netlink-relay
    restart: unless-stopped
    ports:
      - "${HTTP_PORT:-4535}:${HTTP_PORT:-4535}"
      - "${WS_PORT:-4536}:${WS_PORT:-4536}"
    environment:
      - HTTP_PORT=${HTTP_PORT:-4535}
      - WS_PORT=${WS_PORT:-4536}
      - MONGO_URI=mongodb://mongodb:27017/NetLink
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_USERNAME=${ADMIN_USERNAME}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - USE_SSL=${USE_SSL}
    depends_on:
      mongodb:
        condition: service_healthy

EOF
    fi

    # Mode 1 or Mode 3 includes Local Server
    if [ "$MODE_CHOICE" = "1" ] || [ "$MODE_CHOICE" = "3" ]; then
        cat <<EOF >> docker-compose.yml
  local_server:
EOF
        if [ "$IMAGE_CHOICE" = "2" ]; then
            cat <<EOF >> docker-compose.yml
    build:
      context: ./backend/local_server
      dockerfile: Dockerfile
EOF
        else
            cat <<EOF >> docker-compose.yml
    image: ${LOCAL_SERVER_IMAGE}
EOF
        fi

        cat <<EOF >> docker-compose.yml
    container_name: netlink-local-server
    restart: unless-stopped
    environment:
      - RELAY_HOST=${RELAY_HOST}
      - RELAY_PORT=${RELAY_PORT}
      - RELAY_SSL=${RELAY_SSL}
      - REJECT_UNAUTHORIZED=false
      - RELAY_TOKEN=${RELAY_TOKEN}
      - SCAN_CIDR=${SCAN_CIDR}
EOF
        if [ "$MODE_CHOICE" = "1" ]; then
            cat <<EOF >> docker-compose.yml
    depends_on:
      - relay
EOF
        fi
    fi

    if [ "$MODE_CHOICE" = "1" ] || [ "$MODE_CHOICE" = "2" ]; then
        cat <<EOF >> docker-compose.yml

volumes:
  mongodb_data:
EOF
    fi

    echo -e "${GREEN}✓ Generated docker-compose.yml and .env successfully.${NC}\n"
}

start_services() {
    echo -e "${YELLOW}==> Launching NetLink services via Docker Compose...${NC}"
    
    if [ "$IMAGE_CHOICE" = "2" ]; then
        $DOCKER_COMPOSE_CMD up -d --build
    else
        $DOCKER_COMPOSE_CMD up -d
    fi

    echo -e "\n${GREEN}✓ NetLink containers started successfully!${NC}\n"
}

print_summary() {
    echo -e "${GREEN}${BOLD}========================================================${NC}"
    echo -e "${GREEN}${BOLD}           NetLink Installation Complete!              ${NC}"
    echo -e "${GREEN}${BOLD}========================================================${NC}"
    
    if [ "$MODE_CHOICE" = "1" ] || [ "$MODE_CHOICE" = "2" ]; then
        HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
        echo -e "${BOLD}Web Desktop Interface:${NC} http://${HOST_IP}:${HTTP_PORT:-4535} (or http://localhost:${HTTP_PORT:-4535})"
        echo -e "${BOLD}Admin Username:${NC}       ${ADMIN_USERNAME}"
        echo -e "${BOLD}Admin Password:${NC}       ${ADMIN_PASSWORD}"
        echo -e "${BOLD}WebSocket Port:${NC}       ${WS_PORT:-4536}"
        echo ""
    fi

    echo -e "${BOLD}Useful Management Commands:${NC}"
    echo "  - View container status: ${CYAN}$DOCKER_COMPOSE_CMD ps${NC}"
    echo "  - View live logs:       ${CYAN}$DOCKER_COMPOSE_CMD logs -f${NC}"
    echo "  - Stop NetLink:          ${CYAN}$DOCKER_COMPOSE_CMD down${NC}"
    echo "  - Restart NetLink:       ${CYAN}$DOCKER_COMPOSE_CMD restart${NC}"
    echo -e "${GREEN}${BOLD}========================================================${NC}\n"
}

# Main Execution Flow
main() {
    print_banner
    check_prerequisites
    prompt_config
    generate_docker_compose
    start_services
    print_summary
}

main "$@"
