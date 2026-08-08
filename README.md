# NetLink

NetLink is a self-hosted remote access gateway that allows you to securely access your home network—or any network with a local server running—from anywhere using a web browser. It provides access via SSH, VNC, and file management.

By using a central Relay Server on the public internet and a Local Server daemon inside your target network, NetLink eliminates the need for port forwarding or exposing your home IP address.

## Features

- **SSH Terminal**: A fully functional in-browser terminal to run commands on remote devices.
- **File Management**: A web interface for browsing, uploading, and downloading files on the remote system.
- **VNC**: Graphical device control directly from your browser.

## Architecture

NetLink consists of two components that work together:

1. **Relay Server**: Hosted on a public server (e.g., a VPS). It serves the web interface and handles incoming connections from clients and the Local Server.
2. **Local Server**: A lightweight daemon running inside your private network (e.g., on a Raspberry Pi or NAS). It establishes an outbound WebSocket connection to the Relay Server.

## Installation

You need to set up both components. Docker is recommended for the simplest deployment.

### 1. Relay Server

By default, the Relay Server uses port `4535` for the web UI/API and `4536` for the WebSocket connection.

**Using Docker (Recommended):**
```bash
cd backend/relay
docker build -t netlink-relay .
docker run -d -p 4535:4535 -p 4536:4536 --name netlink-relay netlink-relay
```

**Manual Installation:**
You must build the React frontend before starting the Node backend.
```bash
# Build frontend
cd backend/relay/frontend
npm install
npm run build

# Start backend
cd ../
npm install
npm run start
```

### 2. Local Server

This component runs on the target network.

**Using Docker (Recommended):**
```bash
cd backend/local_server
docker build -t netlink-local .
# You must provide a .env file containing your RELAY_TOKEN
docker run -d --env-file .env netlink-local
```

**Manual Installation:**
```bash
cd backend/local_server
npm install
npm run start
```

## Configuration

Both servers are configured via environment variables. You can provide these through a `.env` file or directly to your Docker container.

### Relay Server Variables (`backend/relay`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HTTP_PORT` | `4535` | Port for the web UI and REST API. |
| `WS_PORT` | `4536` | Port for the incoming Local Server WebSocket connections. |
| `JWT_SECRET` | `default_secret` | Secret key for auth tokens. **Change this for production.** |
| `ADMIN_USERNAME` | `admin` | Username for the web interface. |
| `ADMIN_PASSWORD` | `admin` | Password for the web interface. |
| `MONGO_URI` | *(empty)* | MongoDB connection string. Falls back to in-memory auth if empty. |
| `USE_SSL` | `'false'` | Set to `'true'` to enable native HTTPS/WSS. |
| `SSL_KEY_PATH` | `key.pem` | Path to the SSL key (if `USE_SSL` is true). |
| `SSL_CERT_PATH`| `cert.pem`| Path to the SSL cert (if `USE_SSL` is true). |
| `FRONTEND_PATH`| *(auto)* | Path to the compiled frontend build directory. |

### Local Server Variables (`backend/local_server`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `RELAY_TOKEN` | *(required)* | Authentication token to connect to your Relay Server. |
| `RELAY_URL` | *(empty)* | Full WebSocket URL of your relay (e.g., `wss://relay.example.com`). Overrides host/port configs. |
| `RELAY_HOST` | `localhost` | The IP or domain of your Relay Server. |
| `RELAY_PORT` | `4536` | The WebSocket port of your Relay Server. |
| `RELAY_SSL` | `'true'` | Set to `'false'` if the Relay Server connection doesn't use SSL. |
| `REJECT_UNAUTHORIZED` | `'true'` | Set to `'false'` to accept self-signed SSL certificates. |
| `SCAN_CIDR` | *(auto)* | Specify a network block to scan for devices (e.g., `192.168.1.0/24`). |
| `DEMO_TIMEOUT` | *(empty)* | Auto-disconnect timeout in seconds. |

## Project Structure

```text
NetLink/
├── backend/
│   ├── local_server/              # Target network daemon
│   │   ├── protocols/             # Connection protocols (SSH, VNC, etc.)
│   │   ├── services/              # Relay connection & network scanner
│   │   └── ...
│   │
│   └── relay/                     # Public gateway server
│       ├── auth/                  # Authentication logic
│       ├── database/              # MongoDB integration
│       ├── frontend/              # React + Vite web dashboard
│       ├── http/                  # Web server & REST routes
│       ├── websocket/             # WebSocket management
│       └── ...
│
├── frontend                       # Symlink to backend/relay/frontend
└── README.md
```

## To-Do
- **Mobile Support**: Improve touch interaction for tablets and touch-enabled screens.
