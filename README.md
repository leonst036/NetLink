# NetLink

NetLink is a web-based remote management desktop environment that allows you to securely access and manage your infrastructure from a web browser. It features a windowed interface, real-time communication via WebSockets, and a relay server architecture to bypass NATs and firewalls, enabling remote access from anywhere.

## Architecture

The project consists of three main components:

1.  **Frontend (`/frontend`)**: A rich, desktop-like web application built with React, Vite, and TypeScript. It features a window manager (`react-rnd`) and provides applications for SSH terminal emulation (`xterm.js`), VNC remote desktop (`@novnc/novnc`), SFTP file management, Network Topology visualization (`@xyflow/react`), and administrative Settings.
2.  **Local Server (`/backend/local_server`)**: A TypeScript-based Node.js service running on the target machine. It exposes a local server and a WebSocket server. It handles SSH, SFTP, and VNC connections to local and remote devices, piping data to connected WebSocket clients. It can optionally maintain a persistent connection to the Relay Server.
3.  **Relay Server (`/backend/relay`)**: A central server written in TypeScript. It acts as a secure middleman, routing WebSocket and API traffic between the frontend clients and the local servers. It uses MongoDB for storing user accounts, role-based access control (RBAC), and saved server login credentials, secured by JWT authentication.

## Features

-   **Desktop Environment**: A windowed UI allowing multiple simultaneous connections and applications.
-   **Terminal (SSH)**: Full terminal emulation using `xterm.js` for remote SSH access.
-   **Remote Desktop (VNC)**: In-browser VNC client with dynamic resolution adaptation via `noVNC`.
-   **File Manager (SFTP)**: Full SFTP file management interface with upload/download progress, and directory manipulation.
-   **Network Topology**: Interactive visualization of the network graph and connected devices.
-   **Relay Support**: Access local machines behind firewalls or NATs via the central relay server.
-   **Security & Permissions**: JWT-based authentication with a MongoDB-backed User Permission System (RBAC).
-   **Centralized Credentials**: Securely store and manage server logins (SSH, VNC, SFTP) in MongoDB.

## Technology Stack

-   **Frontend**: React, TypeScript, Vite, CSS
-   **Frontend Libraries**: `xterm.js`, `@novnc/novnc`, `@xyflow/react`, `react-rnd`, `lucide-react`
-   **Backend**: Node.js, TypeScript
-   **Networking**: WebSockets (`ws`), `net`
-   **Protocols**: `ssh2`, `ssh2-sftp-client`
-   **Database & Auth**: MongoDB, JSON Web Tokens (`jsonwebtoken`)

## Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn
-   MongoDB instance (for the relay server features like users and saved logins)

### 1. Setting up the Relay Server

If you plan to access your machine remotely over the internet or use user management, you need to run the relay server.

```bash
cd backend/relay
npm install
npm run start
```
*Note: Configure `.env` with `PORT`, `MONGO_URI`, and your `JWT_SECRET`.*

### 2. Setting up the Local Server

Run this on the machine acting as your bridge or target server.

```bash
cd backend/local_server
npm install
npm run start
```
*Note: Configure `.env` with `RELAY_TOKEN` if connecting to the relay server.*

### 3. Running the Frontend

The frontend is a React application built with Vite.

```bash
cd frontend
npm install
npm run dev
```
Open your browser to the URL provided by Vite (usually `http://localhost:5173`).

### 4. Build Utilities

To clean up generated TypeScript build artifacts (JavaScript and source maps) in the backend, you can use the provided script:
```bash
./clean_generated.sh
```

## License

ISC License
