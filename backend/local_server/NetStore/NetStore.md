# Building Applications for NetStore

NetStore is the built-in application ecosystem for NetLink. You can download existing apps or build your own to extend NetLink's capabilities.

This guide explains how to build and structure a custom NetStore application.

## Application Architecture

NetLink applications are separated by where their code runs. A typical application has three parts:

1. **Frontend**: The React UI that runs in the browser.
2. **Local Server**: Backend code that runs on the edge device (e.g., Raspberry Pi) where the local server is installed.
3. **Relay Server**: Backend code that runs on the cloud relay server to handle global API requests, routing, and database interactions.

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
    ]
}
```
*(Make sure the `main` property points to your frontend React component).*

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

### 3. Registering Backend Routes (`relay/index.ts`)

If your app needs a custom backend API on the cloud relay server, you can easily register routes. Create `relay/index.ts` and export a `registerRoutes` function. 

NetLink provides a built-in `Router` that you can use to add `GET`, `POST`, `PUT`, or `DELETE` endpoints.

```typescript
export function registerRoutes(appRouter: any) {
    
    // Register a GET route
    appRouter.get('/api/my-cool-app/status', (req: any, res: any, parsedUrl: any) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'running' }));
    });

    // Register a POST route
    appRouter.post('/api/my-cool-app/ping', (req: any, res: any, parsedUrl: any) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Pong from the Relay Server!' }));
    });
    
}
```

When the local server connects to the relay, it will automatically send this file to the cloud, and the relay server will dynamically load your routes.

### 4. Local Server Logic (`local_server/index.ts`)

*(Note: Local server dynamic routing is structured similarly if your app needs to talk directly to edge hardware like serial ports or local network interfaces).*

---

## Deployment & Testing

To test your application:
1. Place your application folder inside `backend/local_server/NetStore/Applications/`.
2. Start the local server and the relay server (`npm run dev`).
3. Your local server will detect the new application, sync the `relay/` folder to the cloud, and register your routes automatically.
4. Open your NetLink dashboard, navigate to NetStore, and you will see your app ready to use!