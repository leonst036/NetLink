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

Every application needs an `index.json` file in its root folder. This file defines the technical entry points and required system permissions for the app. 

When you develop a **local application**, you should also include all store metadata (like `name`, `author`, `description`) directly in this file so that the NetStore catalog can display it.

```json
{
    "id": "my-cool-app",
    "version": "1.0.0",
    "main": "frontend/main.tsx",
    "requiredExternalFolders": [
      { "path": "/mnt/storage", "mode": "read", "reason": "Storage for media files" }
    ],
    "requestedPermissions": {
      "allowRun": true,
      "allowRunCommands": ["sh", "docker"],
      "allowEnv": ["CUSTOM_API_KEY"],
      "allowNet": true
    },
    
    // Store metadata (required for local apps to show in the store UI)
    "name": "My Cool App",
    "author": "Your Name",
    "category": "Tools",
    "color": "#10b981",
    "icon": "icon.png",
    "shortDescription": "A quick summary of what this app does.",
    "fullDescription": "A longer description explaining the features and why users should install it."
}
```
*(Make sure the `main` property points to your frontend React component).*

**Optional Manifest Fields:**
- `requiredExternalFolders`: List of host folder paths required by the backend (`path`, `mode`: `"read"` or `"write"`, optional `reason`).
- `requestedPermissions`: Requested elevated capabilities:
  - `allowRun`: `true` or `false` to request host command execution (`Deno.Command` / `Deno.run`).
  - `allowRunCommands`: Optional list of allowed command binaries (e.g. `["sh", "docker"]`).
  - `allowEnv`: List of custom environment variable keys to access (e.g. `["CUSTOM_API_KEY"]`).
  - `allowNet`: `true` or list of allowed domains for outbound network access.
- `nativeKey`: Key for built-in native applications integrated directly into the dashboard.

> **Publishing to NetStore:** If you decide to officially publish your application to the NetLink-NetStore repository on GitHub, the store metadata (everything under the `// Store metadata` section) must be moved out of `index.json` and placed into the central `applications.json` file in the NetStore repository. Your app's `index.json` will then only contain the technical fields (e.g. `id`, `version`, `main`, permissions).

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

For security, your Deno apps run in an isolated and hardened Deno sandbox:

- **Strict Default Isolation**:
  - File system access is restricted strictly to the application's own directory (`--allow-read=<appDir>` and `--allow-write=<appDir>`).
  - Environment variable access is restricted to `PORT` (`--allow-env=PORT`). Sensitive host variables (such as `MONGO_URI`, `JWT_SECRET`, or `GITHUB_TOKEN`) are hidden and never exposed to the sandbox process.
  - Direct shell command execution (`--allow-run`) and OS system telemetry (`--allow-sys`) are disabled by default.

- **Dynamic Permission Requests & Admin Authorization**:
  - If an app requires elevated capabilities (host folders, command execution, custom environment variables, network endpoints), it must declare them in `index.json` under `requiredExternalFolders` or `requestedPermissions`.
  - When the app is initialized or installed, NetLink checks `permissions.json`. If ungranted permissions are requested, startup is paused and an interactive **Permission Request Modal** is presented to the administrator.
  - Once approved by the administrator, the permissions are saved in `permissions.json` and NetLink passes the corresponding flags (`--allow-run`, `--allow-read=<path>`, `--allow-write=<path>`, `--allow-env=PORT,<var>`) to the Deno sandbox upon startup.

---

## Remote Application Store & GitHub Integration

NetLink includes an online catalog and dynamic installation mechanism:
1. **Catalog Sync**: NetLink queries remote application lists from GitHub (`leonst036/NetLink` branch `NetStore`).
2. **App Installation**: When installing an app from the catalog, NetLink downloads the tree of app files directly into `backend/local_server/NetStore/Applications/<appId>/`.
3. **Resynchronization**: Local server automatically updates `index.json`, registers backend relay syncs, checks required permissions, and starts local sandboxes.

---

## Deployment & Testing

To test your application locally:
1. Place your application folder inside `backend/local_server/NetStore/Applications/`.
2. Start the local server and the relay server (`npm run dev`).
3. Your local server will detect the new application, sync the `relay/` folder to the cloud, and register your routes automatically.
4. Open your NetLink dashboard, navigate to NetStore, approve any requested permissions if prompted, and your app will be ready to use!