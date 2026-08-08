# NetStore

## What is NetStore?
NetStore is the Application Store for NetLink. You can use it to get more applications or to create and publish your own applications for NetLink.

## How to create an application for NetLink?
Applications are stored in the `Applications` folder. Each application has its own folder containing the following files:
- `index.json`: Contains the application information.

## Example of `index.json`:
```json
{
    "id": "net-graph",
    "main": "main.tsx",
    "name": "Network Topology Explorer",
    "author": "NetLink Core",
    "category": "Monitoring",
    "version": "v2.4.0",
    "color": "#38bdf8",
    "icon": "icon.png",
    "shortDescription": "Interactive network visualization map with node inspection, live ping monitors, and auto-discovery.",
    "fullDescription": "The Network Topology Explorer provides full visibility into your connected subnet infrastructure. View live node statuses, auto-detect active gateway IP addresses, inspect node detail cards, and initiate remote terminal or VNC sessions directly from the graph canvas.",
    "features": [
      "Real-time interactive canvas with pan and zoom",
      "Auto-discovery of active network nodes",
      "Direct terminal, VNC, and SFTP session launcher",
      "WebSocket live status streaming"
    ]
}
```

## Example of `main.tsx`:
```typescript
import { useState } from 'react';

interface AppProps {
    token?: string;
}

export default function App(_props: AppProps) {
    return (
        <div>
            <h1>Hello World</h1>
        </div>
    );
}
```

## Where should I place my application?
- Make a new folder inside `Applications` folder.
- Make a `index.json` and `main.tsx` file inside the folder.
- Fill in the information in `index.json` and `main.tsx`.


## Important Note:
### All Applications created by you or others, is your own buisness. NetLink is not responsible for any applications created by you or others.