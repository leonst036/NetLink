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

To create an app for local testing during development, make a new folder inside `backend/local_server/NetStore/Applications/<userId>/` (where `<userId>` is usually `admin`) with your app's ID (e.g., `my-cool-app`).

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

### 5. Multi-User Isolation & Routing (Backwards Compatibility)

NetLink supports true multi-user isolation. Apps are installed in isolated directories on a per-user basis (`Applications/<userId>/<appId>`), and each user runs their own isolated Deno sandbox backend (`<userId>_<appId>`).

**As an app developer, you do NOT need to write your app differently.** The NetLink relay server automatically handles all user-specific routing seamlessly:

1. **Frontend Assets:** If you hardcode absolute paths in your `index.html` (e.g., `<link href="/apps/my-cool-app/frontend/styles.css">`), the backend will dynamically rewrite these paths on-the-fly to `/apps/<userId>/my-cool-app/...` before serving the files to the user's browser.
2. **API Requests:** When your app fetches `/api/my-cool-app/execute`, the relay server automatically inspects the user's authentication cookie, identifies the active user, and transparently proxies the request to the correct user-specific Deno sandbox.
   
*(Best Practice: While the system is fully backwards-compatible, it is recommended to use relative paths for new frontend applications (e.g., `./styles.css` and base paths of `./` in Vite) to keep your code clean.)*

---

## Remote Application Store & GitHub Integration

NetLink includes an online catalog and dynamic installation mechanism:
1. **Catalog Sync**: NetLink queries remote application lists from GitHub (`leonst036/NetLink` branch `NetStore`).
2. **App Installation**: When installing an app from the catalog, NetLink downloads the tree of app files directly into `backend/local_server/NetStore/Applications/<appId>/`.
3. **Resynchronization**: Local server automatically updates `index.json`, registers backend relay syncs, checks required permissions, and starts local sandboxes.

---

## Design Guidelines & UI/UX Standards

To ensure all NetStore applications feel cohesive, modern, and integrated seamlessly within the NetLink ecosystem, developers must adhere to the following design standards and guidelines:

### 1. Visual Aesthetics & Theme Integration
- **Dark Mode & Color Palette**: NetLink uses a modern dark theme with deep slate backgrounds (`slate-950` / `#020617` base). Avoid using plain light backgrounds or harsh high-contrast white boxes.
- **Glassmorphism**: Utilize semi-transparent dark containers (`bg-slate-900/60` or `bg-slate-800/40`), subtle background blurs (`backdrop-blur-md`), and thin translucent borders (`border border-white/10` or `border-slate-700/50`).
- **Curated Accent Colors**: Use specific color accents for visual hierarchy and action semantics:
  - **Primary Actions / Highlights**: Indigo (`#6366f1` / `indigo-500`)
  - **Success / Online Status**: Emerald (`#10b981` / `emerald-500`)
  - **Warnings / Caution**: Amber (`#f59e0b` / `amber-500`)
  - **Destructive Actions / Errors**: Rose (`#f43f5e` / `rose-500`)
  - **Utilities / System**: Blue (`#2496ed`) or Cyan (`#06b6d4`)
  - *Avoid unstyled, raw primary colors (e.g. pure `#ff0000` or `#0000ff`).*

### 2. Typography & Hierarchy
- **Font Selection**: Use sans-serif fonts matching NetLink's UI (`Outfit`, `Inter`, or system sans-serif) for titles and body text. Use monospaced fonts (`Fira Code`, `JetBrains Mono`) for logs, code snippets, IP addresses, and terminal output.
- **Contrast & Text Muting**: Ensure high contrast for readability against dark backgrounds:
  - Primary Titles & Headers: `text-slate-100` / `#f8fafc`
  - Body Text: `text-slate-300` / `#cbd5e1`
  - Secondary Metadata / Captions: `text-slate-400` or `text-slate-500`

### 3. Iconography & Badges
- **Lucide Icons**: Use line icons from [Lucide React](https://lucide.dev/) (`lucide-react`) with a consistent stroke width (`1.5px` – `2px`).
- **Store Metadata Icons**: In `index.json` or `applications.json`, assign a recognized Lucide icon name (e.g., `"icon": "Container"`, `"icon": "Terminal"`, `"icon": "Network"`) and matching HEX color (`"color": "#2496ed"`).

### 4. Layout, Sizing & Responsiveness
- **Window & Container Fit**: Apps render inside NetLink dynamic windows, modals, or dashboard views. Root containers must use flexible height/width layout classes (e.g. `w-full h-full flex flex-col overflow-hidden` or `overflow-y-auto`) to scale properly across different window sizes.
- **Spacing**: Maintain consistent padding (`p-4` to `p-6`) and component gaps (`gap-3` to `gap-6`) to ensure layouts feel clean and uncluttered.
- **Custom Scrollbars**: Style scrollbars to match NetLink's subtle dark scrollbars (`::-webkit-scrollbar` with translucent white thumbs).

### 5. Interaction & Feedback
- **Hover & Active States**: Provide instant interactive feedback using subtle hover transitions (`transition-all duration-200 ease-in-out`, hover background shifts, or subtle scale/glow effects).
- **Loading & State Communication**: Display clear visual indicators (spinners, skeleton loaders, progress indicators, or toast notifications) during background API calls, asynchronous file transfers, or backend sync operations. Never leave the user on a blank or un-responsive screen.

### 6. Permissions & Security Clarity
- **Principle of Least Privilege**: Only request the specific host permissions (`allowRunCommands`, `allowEnv`, `requiredExternalFolders`) strictly needed for the app to function.
- **Clear Guidance**: If a feature requires administrative privileges or specific external folder access, display helpful inline explanations or tooltips guiding the user.

---

## Deployment & Testing

To test your application locally:
1. Place your application folder inside `backend/local_server/NetStore/Applications/`.
2. Start the local server and the relay server (`npm run dev`).
3. Your local server will detect the new application, sync the `relay/` folder to the cloud, and register your routes automatically.
4. Open your NetLink dashboard, navigate to NetStore, approve any requested permissions if prompted, and your app will be ready to use!