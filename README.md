# NetLink

NetLink is a web-based tool to reach your home network (or any network you have a local server running on) from anywhere, using SSH, VNC, and SFTP. 

Think of it as your personal, self-hosted remote access gateway. It has a central "Relay Server" you put on the open internet, and a "Local Server" daemon that sits in your home or target network.

## Features

- **SSH Terminal**: An in-browser terminal that lets you run commands on the remote device.  
- **File Management**: A web interface to access files on the remote device.  
- **VNC**: A web interface to control your device graphically.

#### More coming soon...

---

## 🛠️ How to set this thing up

### 🚀 Quick Start with Docker Compose (Recommended)

Run the full stack (MongoDB, Relay Server, and Local Server) with a single command:

```bash
docker compose up -d --build
# or with docker-compose:
docker-compose up -d --build
```

- **Web UI**: Access at [http://localhost:4535](http://localhost:4535) (Default login: `admin` / `admin`).
- **MongoDB**: Automatically initialized with pre-configured token for the local server container.

---

### Manual / Individual Setup

Because NetLink is split into two parts, you can also set up components individually.

### Part 1: The Relay Server (Your Gateway)
This needs to run somewhere with a direct connection to the internet (like a VPS). It serves the web UI and handles the WebSocket connections coming from your local daemon.

By default, it uses port **4535** for the web UI (HTTP) and **4536** for the WebSocket connection.

**Setup with Docker (Recommended for sanity):**
```bash
cd backend/relay
docker build -t netlink-relay .
# Run it (pass your env variables here)
docker run -d -p 4535:4535 -p 4536:4536 --name netlink-relay netlink-relay
```

**Setup (Manual):**
If you prefer doing things by hand, remember that you have to build the frontend first!
```bash
# 1. Build the UI
cd backend/relay/frontend
npm install
npm run build

# 2. Start the relay server
cd ../
npm install
npm run start
```

### Part 2: The Local Server (The Daemon)
This runs on a machine inside the network you want to access (like a Raspberry Pi at home). It connects *out* to your Relay Server, meaning you don't have to open any ports on your home router!

**Setup with Docker:**
```bash
cd backend/local_server
docker build -t netlink-local .
# Make sure you provide an .env file with your RELAY_TOKEN!
docker run -d --env-file .env netlink-local
```

**Setup (Manual):**
```bash
cd backend/local_server
npm install
npm run start
```

---

## 🔧 Environment Variables

Here are all the ways you can configure both servers. You can put these in a `.env` file or pass them directly to Docker. 

### Relay Server Variables (`backend/relay`)
| Variable | Default | What it does |
| :--- | :--- | :--- |
| `HTTP_PORT` | `4535` | Port for the web UI and REST API. |
| `WS_PORT` | `4536` | Port for the WebSocket connections from your local server. |
| `JWT_SECRET` | `default_secret` | Secret key for auth tokens. **Definitely change this** if you expose it to the internet! |
| `ADMIN_USERNAME` | `admin` | Username to log into the web UI. |
| `ADMIN_PASSWORD` | `admin` | Password to log into the web UI. |
| `MONGO_URI` | *(empty)* | Connection string for MongoDB. If you don't set this, it falls back to a memory-only auth mode. |
| `USE_SSL` | `'false'` | Set to `'true'` if you want the Node app to handle HTTPS/WSS natively (instead of using a reverse proxy). |
| `SSL_KEY_PATH` | `key.pem` | Path to the SSL key (if `USE_SSL` is true). |
| `SSL_CERT_PATH`| `cert.pem`| Path to the SSL cert (if `USE_SSL` is true). |
| `FRONTEND_PATH`| *(auto)* | Path to the compiled frontend files. Usually auto-detects `frontend/dist`. |

### Local Server Variables (`backend/local_server`)
| Variable | Default | What it does |
| :--- | :--- | :--- |
| `RELAY_TOKEN` | *(required)* | The auth token used to connect to your Relay Server. Don't leave home without it. |
| `RELAY_URL` | *(empty)* | Full WebSocket URL of your relay (e.g., `wss://relay.example.com`). If you set this, it overrides the host/port configs below. |
| `RELAY_HOST` | `localhost` | The IP or domain of your Relay Server. (Can also use `RELAY_IP` or `RELAY_DOMAIN`). |
| `RELAY_PORT` | `4536` | The WebSocket port your relay is listening on. |
| `RELAY_SSL` | `'true'` | Set to `'false'` if you are connecting to your relay without SSL (like testing locally). |
| `REJECT_UNAUTHORIZED` | `'true'` | Set to `'false'` to accept self-signed SSL certificates from your relay. |
| `SCAN_CIDR` | *(auto)* | Manual CIDR block to scan for devices (e.g., `192.168.1.0/24`). If empty, it tries to guess based on your IP. |
| `DEMO_TIMEOUT` | *(empty)* | Timeout in seconds before killing demo connections. |
| `SSL_KEY_PATH` | `key.pem` | Path for the local server's internal HTTPS API key. |
| `SSL_CERT_PATH`| `cert.pem`| Path for the local server's internal HTTPS API cert. |

---

## 📝 To-Do
- Mobile Version: Enhance interaction with touch screen for better use on tablets and laptops with touch screens
- Custom github repo's for NetStore applications

## 📁 File Structure

```
NetLink/
├── backend/
│   ├── local_server/              # Daemon running on target local network
│   │   ├── protocols/             # Connection protocols & routing
│   │   ├── services/              # Server services (relay connection & network scanner)
│   │   ├── Dockerfile
│   │   ├── httpServer.ts
│   │   ├── main.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── relay/                     # Central Relay Server (Web UI, WebSocket relay & Auth)
│       ├── assets/                # Deployment scripts & assets
│       ├── auth/                  # Authentication & Token management
│       ├── database/              # MongoDB database integration
│       ├── frontend/              # In-browser Web Desktop UI (React + Vite)
│       ├── http/                  # HTTP server & REST routes
│       ├── websocket/             # WebSocket management & HTTPS helper
│       ├── Dockerfile
│       ├── main.ts
│       ├── package.json
│       └── tsconfig.json
│
├── frontend -> backend/relay/frontend  # Symlink to Relay Web Frontend
├── clean_generated.sh
├── shell-netlink.nix
├── LICENSE
└── README.md
```
