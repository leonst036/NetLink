# NetLink

NetLink is a web-based remote management desktop environment. It allows you to securely access and manage your infrastructure from a web browser. The system uses a relay server architecture to bypass NATs and firewalls, and provides a windowed interface for SSH, VNC, SFTP, and network topology visualization.

## 🚀 Setup & Servers

To run NetLink, three core components need to be started. The focus is on the central Relay Server, which acts as the middleman, and the Local Server, which acts as a bridge in the target network.

### 1. Relay Server (Central Middleman)
The Relay Server acts as a secure intermediary. It routes traffic (WebSockets/API) between the web frontend and the local servers. It also manages user accounts and Role-Based Access Control (RBAC) via MongoDB.

**Setup (Manual):**
```bash
cd backend/relay
npm install
npm run start
```
*Note: Create a `.env` file in the `backend/relay` folder and configure `PORT`, `MONGO_URI`, and `JWT_SECRET`.*

**Setup (Docker):**
```bash
cd backend/relay
docker build -t netlink-relay .
docker run -d -p 4535:4535 -p 4536:4536 --env-file .env netlink-relay
```

### 2. Local Server (Target Bridge)
This server runs on the machine or within the network you want to manage remotely (acting as a bridge or direct target). It establishes an outgoing connection to the Relay Server and accepts commands (SSH, SFTP, VNC) from the frontend.

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

### 3. Frontend (Web Interface)
The frontend is the React/Vite-based user interface that you open in your browser.

**Setup:**
```bash
cd frontend
npm install
npm run dev
```
Afterwards, open your browser to the URL provided by Vite (usually `http://localhost:5173`).

---

## 🏗️ Architecture

*   **Frontend (`/frontend`)**: A feature-rich, desktop-like web application (React, TypeScript). Includes apps for SSH (`xterm.js`), VNC (`@novnc/novnc`), SFTP, Network Topology (`@xyflow/react`), and settings.
*   **Local Server (`/backend/local_server`)**: A Node.js/TypeScript service on the target device. Provides SSH, SFTP, and VNC connections to local and remote devices, forwarding the data to connected WebSocket clients.
*   **Relay Server (`/backend/relay`)**: A central Node.js/TypeScript server. Securely connects clients to Local Servers and uses MongoDB for authentication and secure storage of credentials.

## ✨ Features

-   **Desktop Environment**: Window-based UI for multiple simultaneous connections and apps.
-   **Terminal (SSH)**: Full terminal emulation (`xterm.js`) for remote SSH access.
-   **Remote Desktop (VNC)**: In-browser VNC client with dynamic resolution adaptation (`noVNC`).
-   **File Manager (SFTP)**: SFTP interface for file uploads, downloads, and directory management.
-   **Network Topology**: Interactive visualization of the network graph and connected devices.
-   **Relay Support**: Access to local machines behind firewalls or NATs.
-   **Security & Permissions**: JWT-based authentication with Role-Based Access Control (RBAC) via MongoDB.
-   **Centralized Credentials**: Secure storage and management of server logins (SSH, VNC, SFTP).

## 🛠️ Technology Stack

-   **Frontend**: React, TypeScript, Vite, CSS (`react-rnd`, `lucide-react`, `xterm.js`, `noVNC`, `xyflow`)
-   **Backend**: Node.js, TypeScript
-   **Networking**: WebSockets (`ws`), `net`
-   **Protocols**: `ssh2`, `ssh2-sftp-client`
-   **Database & Auth**: MongoDB, JSON Web Tokens (`jsonwebtoken`)

### Build Utilities

To clean up generated TypeScript build artifacts (JavaScript and source maps) in the backend, you can use the provided script:
```bash
./clean_generated.sh
```
