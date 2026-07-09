# NetLink

NetLink is a web-based remote SSH session tool that allows you to securely access your local machines from a web browser. It utilizes WebSockets for real-time communication and features a relay server architecture to bypass NATs and firewalls, enabling remote access from anywhere.

## Architecture

The project consists of three main components:

1.  **Frontend (`/frontend`)**: A lightweight web interface built with HTML, CSS, and `xterm.js`. It provides a fully functional terminal emulator in the browser that connects via WebSockets to either a local server or a cloud relay.
2.  **Local Server (`/backend/local_server`)**: A TypeScript-based Node.js service running on the target machine. It exposes a local HTTPS server and a WebSocket server. It uses the `ssh2` library to establish a local SSH connection and pipes the terminal data to the connected WebSocket clients. It can optionally maintain a persistent connection to the Relay Server.
3.  **Relay Server (`/backend/relay`)**: A central cloud server written in TypeScript. It acts as a secure middleman, routing WebSocket traffic between the frontend clients and the local servers. It features JWT-based authentication to secure connections and optionally integrates with MongoDB for token management.

## Features

-   **Browser-Based Terminal**: Full terminal emulation using `xterm.js`.
-   **Relay Support**: Access local machines behind firewalls or NATs via the central relay server.
-   **Secure Communication**: Supports WSS (Secure WebSockets) and HTTPS.
-   **JWT Authentication**: Ensures only authorized clients and local servers can connect to the relay.
-   **Direct Local Mode**: Option to connect directly to the local server without the relay for LAN usage.

## Technology Stack

-   **Language**: TypeScript, JavaScript, HTML, CSS
-   **Backend**: Node.js
-   **Networking**: WebSockets (`ws` package)
-   **Terminal**: `xterm.js`
-   **SSH**: `ssh2`
-   **Authentication**: JSON Web Tokens (`jsonwebtoken`)
-   **Database**: MongoDB (optional, for the relay server)

## Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn
-   (Optional) MongoDB instance for the relay server

### 1. Setting up the Relay Server (Optional)

If you plan to access your machine remotely over the internet, you need to run the relay server.

```bash
cd backend/relay
npm install
npm run start
```
*Note: Configure `.env` with `PORT`, `MONGO_URI` (optional), and your JWT secret.*

### 2. Setting up the Local Server

Run this on the machine you want to access via SSH.

```bash
cd backend/local_server
npm install
npm run start
```
*Note: Configure `.env` with `RELAY_TOKEN` if connecting to the relay server.*

### 3. Running the Frontend

The frontend is a simple static HTML file. You can serve it using any HTTP server or open it directly in your browser.

```bash
cd frontend
# e.g., using python
python -m http.server 3000
```
Open your browser to `http://localhost:3000` and configure the WebSocket connection string in `index.html` to point to your relay server or local server.

## License

ISC License
