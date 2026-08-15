# Building Applications for NetStore

NetStore is the built-in application ecosystem for NetLink. You can download existing apps or build your own to extend NetLink's capabilities.

This guide explains how to build, structure, and test a custom NetStore application.

---

## Application Architecture

NetLink applications are separated by where their code runs. A typical application has three parts:

1. **Frontend**: The UI that runs in the browser. NetLink supports both standalone Vite/HTML single-page applications (loaded securely inside sandboxed iframes) and single-file React component exports (transpiled dynamically via esbuild).
2. **Local Server**: Backend code that runs on the edge device (e.g., Raspberry Pi or local server). Apps run securely in an isolated Deno sandbox.
3. **Relay Server**: Backend code that runs on the cloud relay server to handle global API requests, routing, and database interactions. Apps run securely in an isolated Deno sandbox.

When you install an application into the `Applications` folder on your local server, NetLink automatically synchronizes the `relay` backend and frontend code to the cloud relay server over a secure WebSocket connection. You don't have to manually deploy code to two different machines!

---

## Getting Started

### Standard Directory Structure

An application package uses the following directory layout:

```text
my-cool-app/
├── index.json          (Required: App manifest, technical entrypoints & permissions)
├── frontend/           (Required: Frontend UI)
│   ├── index.html      (Standard HTML / Vite entrypoint)
│   ├── main.tsx        (React entrypoint)
│   ├── styles.css      (Optional: App stylesheet)
│   └── src/            (Optional: React components & assets)
├── local_server/       (Optional: Local edge backend logic)
│   └── index.ts        (Deno HTTP server entrypoint)
└── relay/              (Optional: Cloud relay backend logic)
    └── index.ts        (Deno HTTP server entrypoint)
```

---

### 1. The Manifest (`index.json`)

Every application must contain an `index.json` file in its root folder. This file defines technical entry points, backend runtime options, and requested system permissions.

When developing a **local application**, you can also include store metadata directly in this file for testing in the NetStore UI.

```json
{
  "id": "my-cool-app",
  "version": "1.0.0",
  "main": "frontend/main.tsx",
  "entrypoint": "frontend/index.html",
  "backend": "index.ts",
  "runInBackground": true,
  "requiredExternalFolders": [
    { "path": "/mnt/storage", "mode": "read", "reason": "Storage for media files" }
  ],
  "requestedPermissions": {
    "allowRun": true,
    "allowRunCommands": ["sh", "docker", "ping", "systemctl"],
    "allowEnv": ["CUSTOM_API_KEY"],
    "allowNet": true,
    "allowDatabase": true,
    "allowRead": true,
    "allowWrite": true,
    "collections": ["servers", "logs"]
  },
  
  // Store metadata (used when developing locally before publishing)
  "name": "My Cool App",
  "author": "Your Name",
  "category": "Tools",
  "color": "#10b981",
  "icon": "Box",
  "shortDesc": "A quick summary of what this app does.",
  "fullDesc": "A longer description explaining the features and why users should install it."
}
```

#### Manifest Fields Reference

* **`id`** (`string`, required): Unique identifier for the app (kebab-case, e.g., `"minecraft-server-management"`).
* **`version`** (`string`, required): Semantic version (e.g., `"1.0.0"`).
* **`main`** (`string`): Path to React entry component (e.g., `"frontend/main.tsx"`).
* **`entrypoint`** (`string`): Path to HTML entrypoint (e.g., `"frontend/index.html"` or `"frontend/dist/index.html"`).
* **`backend`** (`string`): Entrypoint filename inside `local_server/` or `relay/` (e.g., `"index.ts"`).
* **`runInBackground`** (`boolean`): If `true`, the local server starts the app's backend daemon automatically on system boot without waiting for an active user login.
* **`requiredExternalFolders`** (`array`): List of host folder paths required by the backend:
  * `path`: Absolute host directory path.
  * `mode`: `"read"` or `"write"`.
  * `reason`: Explanation displayed to the administrator when requesting permission.
* **`requestedPermissions`** (`object`): Elevated sandbox capabilities:
  * `allowRun` (`boolean`): Request permission to execute shell commands (`Deno.Command`).
  * `allowRunCommands` (`string[]`): Whitelist of allowed binaries (e.g., `["sh", "docker", "ping"]`).
  * `allowEnv` (`string[]`): Whitelist of custom host environment variable keys to expose.
  * `allowNet` (`boolean` or `string[]`): Outbound network access permission (`true` for all, or domain array).
  * `allowDatabase` (`boolean`): Permission to use NetLink's managed MongoDB storage (`/api/db`).
  * `collections` (`string[]`): Whitelist of specific MongoDB collections the app can access.
  * `allowRead` / `allowWrite` (`boolean`): File system access within the app folder.
* **`nativeKey`** (`string`): Identifier for built-in dashboard apps.

> **Publishing to NetStore:** When publishing your application to the official [leonst036/NetLink-NetStore](https://github.com/leonst036/NetLink-NetStore) repository, store metadata is placed into the central `applications/applications.json` catalog file (using keys `id`, `name`, `author`, `category`, `icon`, `color`, `shortDesc`, `fullDesc`, `version`, `downloads`, `rating`, `isFeatured`). The app's `index.json` only contains the technical configuration.

---

### 2. Frontend Development (`frontend/`)

NetLink supports two frontend approaches:

#### Option A: Standalone HTML / Vite App (Recommended for Complex Apps)

You can create a full React + Vite, Vue, or Vanilla JS application inside the `frontend/` directory with `frontend/index.html`.

NetLink's `DynamicAppLoader` loads your app inside a secure, sandboxed iframe:
1. Obtains a short-lived single-use authentication ticket (`POST /api/auth/ticket?target=<target>`).
2. Loads your app via `/apps/<userId>/<appId>/<entrypoint>?ticket=<ticket>&target=<target>&role=<role>`.
3. NetLink automatically injects `/netlink.css` and subtle background glows, and dynamically rewrites relative/absolute asset paths.

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Cool App</title>
</head>
<body class="bg-slate-950 text-slate-100">
  <div id="root"></div>
  <script type="module" src="/frontend/main.tsx"></script>
</body>
</html>
```

#### Option B: Dynamic React Component (`frontend/main.tsx`)

For simple lightweight apps, export a default React component from `frontend/main.tsx`. The relay dynamically compiles TypeScript/JSX on-the-fly using esbuild and esm.sh importmaps.

```tsx
import { useState } from 'react';

interface AppProps {
    token?: string;
}

export default function App({ token }: AppProps) {
    const [message, setMessage] = useState('');

    const pingBackend = async () => {
        const res = await fetch('/api/my-cool-app/ping', { method: 'POST' });
        const data = await res.json();
        setMessage(data.message);
    };

    return (
        <div className="p-6 text-slate-100">
            <h1 className="text-xl font-bold mb-4">My Cool App</h1>
            <button 
                onClick={pingBackend}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors font-medium text-sm"
            >
                Ping Backend
            </button>
            {message && <p className="mt-4 text-emerald-400">{message}</p>}
        </div>
    );
}
```

---

### 3. Backend Routes (`relay/index.ts` & `local_server/index.ts`)

Backend code runs in an isolated **Deno Sandbox**. NetLink passes a random available port via the `PORT` environment variable and automatically proxies HTTP and WebSocket requests matching `/api/<appId>/...` to your sandbox.

```typescript
// Example Deno app server (relay/index.ts or local_server/index.ts)
const port = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port }, (req) => {
    const url = new URL(req.url);
    
    // Handle WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req);
        socket.onopen = () => console.log("WebSocket client connected!");
        socket.onmessage = (e) => {
            console.log("Received:", e.data);
            socket.send("Echo: " + e.data);
        };
        return response;
    }

    // REST endpoints
    if (req.method === "GET" && url.pathname.endsWith("/status")) {
        return new Response(JSON.stringify({ status: "running" }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    if (req.method === "POST" && url.pathname.endsWith("/ping")) {
        return new Response(JSON.stringify({ message: "Pong from Deno Sandbox!" }), {
            headers: { "Content-Type": "application/json" }
        });
    }
    
    return new Response(JSON.stringify({ error: "Not Found" }), { 
        status: 404, 
        headers: { "Content-Type": "application/json" } 
    });
});
```

* **Relay Backend (`relay/index.ts`)**: Proxied by the cloud relay server for requests sent to `/api/<appId>/...`.
* **Local Backend (`local_server/index.ts`)**: Runs on the edge device, handling local hardware, command execution, or local network scans.

---

### 4. Sandbox Permissions & Security

Deno sandboxes operate under the principle of least privilege:

- **Strict Default Isolation**:
  - File system access is restricted to the app directory (`--allow-read=<appDir>` and `--allow-write=<appDir>`).
  - Environment variables are restricted to `PORT` (`--allow-env=PORT`). Sensitive host variables (`MONGO_URI`, `JWT_SECRET`, `GITHUB_TOKEN`) are never exposed to sandboxes.
  - Direct shell execution (`--allow-run`) and host system access (`--allow-sys`) are disabled by default.

- **Admin Permission Approval**:
  - If an app declares elevated permissions in `index.json` (`requiredExternalFolders`, `requestedPermissions`), NetLink checks `permissions.json`.
  - If unapproved permissions exist, startup is paused and an interactive **Permission Request Modal** is sent to the admin via WebSocket.
  - Once approved, permissions are saved in `permissions.json` and NetLink starts the Deno process with the corresponding security flags (`--allow-run`, `--allow-net`, `--allow-env`, etc.).

---

### 5. Multi-User Isolation & Routing

NetLink provides multi-user isolation. Apps are installed in isolated directories per user (`Applications/<userId>/<appId>`), and each user runs their own sandbox process (`<userId>_<appId>`):

1. **Frontend Rewriting:** Asset paths like `/apps/my-cool-app/...` are dynamically rewritten on-the-fly to `/apps/<userId>/my-cool-app/...`.
2. **API Routing:** Requests to `/api/my-cool-app/...` authenticate the user's session and proxy transparently to the corresponding user's sandbox instance.

---

### 6. App Database API (`POST /api/db`)

NetLink provides an isolated, managed MongoDB endpoint for apps. Apps do not need database drivers or credentials:

- **Endpoint**: `POST /api/db` (or `POST /api/apps/db`)
- **Headers**: `Authorization: Bearer <token>` or session cookie
- **Supported Actions**:
  - `find`: Query documents (`query`, `options: { limit, skip, sort, projection }`).
  - `findOne`: Fetch a single document by query or `id`.
  - `insert`: Insert one document (`data: { ... }`) or multiple documents (`data: [ ... ]`).
  - `update`: Update documents (`query` or `id`, `data`).
  - `delete`: Remove documents matching `query` or `id`.
  - `count`: Count matching documents.
  - `listCollections`: List all collections belonging to the app.
  - `dropCollection`: Drop a specific collection.

#### Example Usage

```typescript
// Insert a document
const insertRes = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        appId: 'minecraft-server-management',
        collection: 'servers',
        action: 'insert',
        data: { name: 'Survival 1.20', port: 25565, status: 'online' }
    })
});
const { data: newDoc } = await insertRes.json();

// Query documents
const queryRes = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        appId: 'minecraft-server-management',
        collection: 'servers',
        action: 'find',
        query: { status: 'online' },
        options: { limit: 10, sort: { createdAt: -1 } }
    })
});
const { data: servers } = await queryRes.json();
```

*All collections and documents are automatically namespaced (`app_<appId>_<collection>`) and scoped to the active user (`_userId`).*

---

## Local Development & Testing Workflows

You have three convenient ways to test your applications locally:

### Method 1: Local Workspace Detection (Fastest)

Place your app inside the neighbouring `NetLink-NetStore/applications/<appId>/` directory in your workspace. NetLink's local server and relay automatically detect and resolve your local files during development without needing to download anything.

### Method 2: Docker Debug Server (Simulating Remote NetStore)

You can run the official Docker Debug Server from the `NetLink-NetStore` repository:

```bash
# In the NetLink-NetStore repository
./start-debug.sh
# Or with docker compose:
docker compose up -d
```

* Runs on `http://localhost:4540`.
* Simulates GitHub REST trees and raw file endpoints with live hot-reloading from your local `applications/` folder.
* In NetLink's NetStore app, select **🛠️ Local Debug (Docker)** from the channel selector to test installation and updates directly.

### Method 3: Direct User Folder

Place your application folder directly into `backend/local_server/NetStore/Applications/<userId>/<appId>/` (e.g. `admin/my-cool-app`). Start NetLink (`npm run dev`) and your app will be initialized automatically.

---

## Design Guidelines & UI/UX Standards

To ensure all NetStore apps look premium and feel native within NetLink, follow these design rules:

### 1. Visual Aesthetics & Theme Integration
* **Dark Mode Base**: Deep slate backgrounds (`slate-950` / `#020617`).
* **Glassmorphism**: Semi-transparent containers (`bg-slate-900/60`, `bg-slate-800/40`), background blurs (`backdrop-blur-md`), and translucent borders (`border border-white/10` or `border-slate-700/50`).
* **Accent Colors**:
  * **Primary / Highlight**: Indigo (`#6366f1` / `indigo-500`)
  * **Success / Online**: Emerald (`#10b981` / `emerald-500`)
  * **Warning / Caution**: Amber (`#f59e0b` / `amber-500`)
  * **Destructive / Error**: Rose (`#f43f5e` / `rose-500`)
  * **System / Info**: Blue (`#2496ed`) or Cyan (`#06b6d4`)

### 2. Typography & Hierarchy
* **UI Text**: Sans-serif fonts (`Outfit`, `Inter`, or system sans-serif).
* **Code & Logs**: Monospaced fonts (`Fira Code`, `JetBrains Mono`).
* **Contrast**: High contrast text (`text-slate-100` for headings, `text-slate-300` for body, `text-slate-400`/`text-slate-500` for secondary metadata).

### 3. Iconography
* Use line icons from [Lucide React](https://lucide.dev/) (`lucide-react`) with a stroke width of `1.5px` – `2px`.
* Specify a valid Lucide icon name (e.g. `"icon": "Container"`, `"icon": "Terminal"`, `"icon": "Folder"`) and HEX color (`"color": "#10b981"`) in your store catalog definition.

### 4. Layout & Responsiveness
* Apps render inside dynamic windows and tabs. Root containers must use flexible sizing classes (e.g. `w-full h-full flex flex-col overflow-hidden` or `overflow-y-auto`).
* Provide visual feedback for all interactive states (`transition-all duration-200 ease-in-out`, spinners, skeleton loaders).