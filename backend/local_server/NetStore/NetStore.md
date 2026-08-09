# Building Applications for NetStore

NetStore is the built-in application ecosystem for NetLink. You can download existing apps or build your own to extend NetLink's capabilities.

This guide explains how to build and structure a custom NetStore application.

## Application Architecture

NetLink applications are separated by where their code runs. A typical application has three parts:

1. **Frontend**: The React UI that runs in the browser.
2. **Local Server**: Backend code that runs on the edge device (e.g., Raspberry Pi). Apps run securely in a Deno sandbox.
3. **Relay Server**: Backend code that runs on the cloud relay server to handle global API requests, routing, and database interactions. Apps run securely in a Deno sandbox.

When you install an application into the `Applications` folder on your local server, NetLink automatically synchronizes the `relay` backend code to the cloud relay server over a secure WebSocket connection. You don't have to manually deploy code to two different machines!

---

## Getting Started

To create an app, make a new folder inside `backend/local_server/NetStore/Applications/` with your app's ID (e.g., `my-cool-app`).

Here is the standard folder structure you should use:

```text
my-cool-app/
├── index.json        (Required: The app manifest)
├── frontend/
│   └── main.tsx      (Required: The React entry point)
├── local_server/
│   └── index.ts      (Optional: Local edge logic)
└── relay/
    └── index.ts      (Optional: Cloud relay routes)
```

### 1. The Manifest (`index.json`)

Every application needs an `index.json` file in its root folder. This file provides metadata to the NetStore catalog.

```json
{
    "id": "my-cool-app",
    "main": "frontend/main.tsx",
    "name": "My Cool App",
    "author": "Your Name",
    "category": "Tools",
    "version": "1.0.0",
    "color": "#10b981",
    "icon": "icon.png",
    "shortDescription": "A quick summary of what this app does.",
    "fullDescription": "A longer description explaining the features and why users should install it.",
    "features": [
      "Feature one",
      "Feature two"
    ],
    "requiredExternalFolders": [
      { "path": "/mnt/storage", "mode": "read" }
    ]
}
```
*(Make sure the `main` property points to your frontend React component).*

**Optional Manifest Fields:**
- `requiredExternalFolders`: List of host folder paths required by the backend (`mode`: `"read"` or `"write"`).
- `nativeKey`: Key for built-in native applications integrated directly into the dashboard.
- `rating`, `downloads`, `size`, `isFeatured`: Additional metadata fields for store display.

### 2. The Frontend (`frontend/main.tsx`)

This is the UI of your application. It should export a default React component.

```tsx
import { useState } from 'react';

interface AppProps {
    token?: string;
}

export default function App({ token }: AppProps) {
    const [message, setMessage] = useState('');

    const pingBackend = async () => {
        // Example: Calling your custom Relay backend route
        const res = await fetch('/api/my-cool-app/ping', { method: 'POST' });
        const data = await res.json();
        setMessage(data.message);
    };

    return (
        <div>
            <h1>My Cool App</h1>
            <button onClick={pingBackend}>Ping Backend</button>
            <p>{message}</p>
        </div>
    );
}
```

### 3. Registering Backend Routes (`relay/index.ts` & `local_server/index.ts`)

If your app needs a custom backend API, you can write Deno-compatible code in `relay/index.ts` or `local_server/index.ts`. 

NetLink runs these files in an isolated **Deno Sandbox** for security. Your code runs as a standard HTTP server. NetLink will assign an available port via the `PORT` environment variable and automatically proxy requests to it.

```typescript
// Example: A Deno app server
const port = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port }, (req) => {
    const url = new URL(req.url);
    
    // Check if it's a websocket request
    if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req);
        socket.onopen = () => console.log("WS client connected!");
        socket.onmessage = (e) => {
            console.log("WS received:", e.data);
            socket.send("Echo: " + e.data);
        };
        return response;
    }

    if (req.method === "GET" && url.pathname.endsWith("/status")) {
        return new Response(JSON.stringify({ status: 'running' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (req.method === "POST" && url.pathname.endsWith("/ping")) {
        return new Response(JSON.stringify({ message: 'Pong from Deno Sandbox!' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response("Not Found", { status: 404 });
});
```

When the local server connects to the relay, it will automatically send this file to the cloud, and the relay server will launch it securely.

### 4. Sandbox Permissions & Security

For security, your Deno apps run in an isolated Deno sandbox:
- Default file system access is restricted to the application's own directory (`--allow-read=<appDir>`).
- Direct command execution (`Deno.run` or `Deno.Command`) is disabled.
- Network access (`--allow-net`) and environment access for `PORT` (`--allow-env=PORT`) are granted.
- **External Folder Access**: Apps requiring host directories can declare them via `requiredExternalFolders` in `index.json`. The local server checks `permissions.json` and applies `--allow-read=<path>` and/or `--allow-write=<path>` once approved by an administrator.

---

## Remote Application Store & GitHub Integration

NetLink includes an online catalog and dynamic installation mechanism:
1. **Catalog Sync**: NetLink queries remote application lists from GitHub (`leonst036/NetLink` branch `NetStore`).
2. **App Installation**: When installing an app from the catalog, NetLink downloads the tree of app files directly into `backend/local_server/NetStore/Applications/<appId>/`.
3. **Resynchronization**: Local server automatically updates `index.json`, registers backend relay syncs, and starts local sandboxes.

---

## Deployment & Testing

To test your application locally:
1. Place your application folder inside `backend/local_server/NetStore/Applications/`.
2. Start the local server and the relay server (`npm run dev`).
3. Your local server will detect the new application, sync the `relay/` folder to the cloud, and register your routes automatically.
4. Open your NetLink dashboard, navigate to NetStore, and you will see your app ready to use!