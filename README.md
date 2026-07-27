# NetLink
NetLink is a web-based tool to reach your home network (or any network you have a local server running on) from anywhere, using SSH, VNC and SFTP.

## Features
- **SSH Terminal**: An in-browser terminal that lets you run commands on the remote device.  
- **File Management**: A web interface to accses files on the remote device.  
- **VNC**: A web interface to control your device graphicaly.
#### More coming soon...

## Setup

### 1. Relay server
The relay server has to be running on a server with a direct connection to the internet. 
#### You need two ports open (by default **4536** for the website and **4535** for the websocket)

**Setup (Manual):**
```bash
cd backend/local_server
npm install
npm run start
```
*Note: Configure a `.env` file with `RELAY_TOKEN` to connect to the Relay Server.*

**Setup (Docker):**
```bash
cd backend/local_server
docker build -t netlink-local .
docker run -d --env-file .env netlink-local
```

## To-Do
- Mobile Version: Enhance interaction with touch screen for better use on tablets and laptops with touch screens


## File Structure

```
NetLink/
├── backend/
│   ├── local_server/              # Daemon running on target local network
│   │   ├── protocols/             # Connection protocols & routing
│   │   │   ├── router.ts
│   │   │   ├── sftpHandler.ts
│   │   │   ├── smbHandler.ts
│   │   │   ├── sshHandler.ts
│   │   │   └── vncHandler.ts
│   │   ├── services/              # Server services (relay connection & network scanner)
│   │   │   ├── relayConnector.ts
│   │   │   └── scanner.ts
│   │   ├── Dockerfile
│   │   ├── httpServer.ts
│   │   ├── main.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── relay/                     # Central Relay Server (Web UI, WebSocket relay & Auth)
│       ├── assets/                # Deployment scripts & assets
│       │   └── scripts/
│       │       ├── demo_setup.sh
│       │       └── install_local_server.sh
│       ├── auth/                  # Authentication & Token management
│       │   ├── authenticator.ts
│       │   ├── login.ts
│       │   └── tokenManager.ts
│       ├── database/              # MongoDB database integration
│       │   └── MongoManager.ts
│       ├── frontend/              # In-browser Web Desktop UI (React + Vite)
│       │   ├── public/            # Static icons, backgrounds & SVGs
│       │   │   ├── favicon.svg
│       │   │   ├── icons.svg
│       │   │   └── login-bg.png
│       │   ├── src/
│       │   │   ├── apps/          # Web apps (Terminal, File Manager, VNC, Settings, Topology)
│       │   │   │   ├── file/      # File Manager hooks & components
│       │   │   │   │   ├── FileApp.tsx
│       │   │   │   │   ├── useSftp.ts
│       │   │   │   │   └── useSmb.ts
│       │   │   │   ├── FileApp.tsx
│       │   │   │   ├── NetworkGraph.tsx
│       │   │   │   ├── SettingsApp.tsx
│       │   │   │   ├── TerminalApp.tsx
│       │   │   │   └── VncApp.tsx
│       │   │   ├── components/    # Desktop UI components (Dock, TopBar, Loaders)
│       │   │   │   ├── Dock.tsx
│       │   │   │   ├── GeminiLoader.tsx
│       │   │   │   └── TopBar.tsx
│       │   │   ├── App.css
│       │   │   ├── App.tsx
│       │   │   ├── Desktop.tsx
│       │   │   ├── Window.tsx
│       │   │   ├── index.css
│       │   │   └── main.tsx
│       │   ├── index.html
│       │   ├── package.json
│       │   └── vite.config.ts
│       ├── http/                  # HTTP server & REST routes
│       │   ├── routes/
│       │   │   ├── authRoutes.ts
│       │   │   ├── scriptRoutes.ts
│       │   │   ├── serverRoutes.ts
│       │   │   ├── staticRoutes.ts
│       │   │   ├── topologyRoutes.ts
│       │   │   └── userRoutes.ts
│       │   └── requestHandler.ts
│       ├── websocket/             # WebSocket management & HTTPS helper
│       │   ├── connectionHandlers.ts
│       │   ├── connectionManager.ts
│       │   └── httpsHelper.ts
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