import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find frontend path
let frontendPath = process.env.FRONTEND_PATH || '';
if (!frontendPath) {
    const candidates = [
        path.join(__dirname, 'frontend'),
        path.join(__dirname, '../frontend'),
        path.join(__dirname, '../../frontend'),
        path.join(__dirname, '../../../frontend'),
        path.join(__dirname, '../../../../frontend')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            frontendPath = candidate;
            break;
        }
    }
}
if (!frontendPath) {
    frontendPath = path.join(__dirname, '../../frontend');
}
if (fs.existsSync(path.join(frontendPath, 'dist'))) {
    frontendPath = path.join(frontendPath, 'dist');
}

export function handleFaviconRoute(res: http.ServerResponse): void {
    const faviconPath = path.join(frontendPath, 'favicon.svg');
    if (fs.existsSync(faviconPath)) {
        const stat = fs.statSync(faviconPath);
        res.writeHead(200, {
            'Content-Type': 'image/svg+xml',
            'Content-Length': stat.size
        });
        const readStream = fs.createReadStream(faviconPath);
        readStream.pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Favicon not found');
    }
}

export function handleStaticFileRoute(pathname: string, res: http.ServerResponse): void {
    // Normalize pathname to prevent directory traversal
    const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(frontendPath, safeSuffix);

    // In dev mode (frontendPath doesn't end with dist), static files might be in public/
    if (!filePath.includes('dist') && !fs.existsSync(filePath)) {
        const publicPath = path.join(frontendPath, 'public', safeSuffix);
        if (fs.existsSync(publicPath)) {
            filePath = publicPath;
        }
    }

    // If filePath is a directory, append index.html
    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
    } catch (e) {
        // Fallback or ignore, handle in fs.readFile
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found\n');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${error.code}\n`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

export function handleAppFrontendRoute(pathname: string, res: http.ServerResponse): void {
    // pathname like /apps/{appId}/frontend/...
    const parts = pathname.split('/');
    if (parts.length < 4 || parts[1] !== 'apps' || parts[3] !== 'frontend') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    
    const appId = parts[2] as string;
    const subPath = parts.slice(4).join('/');
    
    // Relay apps directory is at ../../NetStore/Applications relative to the src/dist/http/routes root
    const RELAY_APPS_DIR = path.join(__dirname, '..', '..', 'NetStore', 'Applications');
    const safeSuffix = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(RELAY_APPS_DIR, appId, 'frontend', safeSuffix);

    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.tsx')) {
            filePath += '.tsx';
        } else if (fs.existsSync(filePath + '.ts')) {
            filePath += '.ts';
        } else if (fs.existsSync(filePath + '.jsx')) {
            filePath += '.jsx';
        } else if (fs.existsSync(filePath + '.js')) {
            filePath += '.js';
        }
    }

    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
    } catch (e) {
        // Fallback or ignore, handle in fs.readFile
    }

    // Dynamic React Support
    if (path.basename(filePath) === 'index.html' && !fs.existsSync(filePath)) {
        const indexJsonPath = path.join(RELAY_APPS_DIR, appId, 'index.json');
        if (fs.existsSync(indexJsonPath)) {
            try {
                const indexData = JSON.parse(fs.readFileSync(indexJsonPath, 'utf-8'));
                if (indexData.main && (indexData.main.endsWith('.tsx') || indexData.main.endsWith('.jsx'))) {
                    const shell = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="/netlink.css">
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.2.0",
      "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime",
      "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
      "react-dom": "https://esm.sh/react-dom@18.2.0"
    }
  }
  </script>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="bg-glow-2"></div>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import App from '/apps/${appId}/${indexData.main}';
    
    const renderApp = (Component) => {
        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(Component, { token: localStorage.getItem('netlink_token') }));
    };
    
    if (App instanceof Promise) {
        App.then(m => renderApp(m.default || m));
    } else {
        renderApp(App);
    }
  </script>
</body>
</html>`;
                    const noCacheHeaders = {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    };
                    res.writeHead(200, { 'Content-Type': 'text/html', ...noCacheHeaders });
                    res.end(shell);
                    return;
                }
            } catch (e) {
                console.error('Failed to parse index.json for dynamic React support', e);
            }
        }
    }

    const ext = path.extname(filePath).toLowerCase();
    const isTypeScript = ext === '.tsx' || ext === '.ts' || ext === '.jsx';
    
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.jsx': 'text/javascript',
        '.ts': 'text/javascript',
        '.tsx': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const noCacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found\n');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${error.code}\n`);
            }
        } else {
            if (isTypeScript) {
                (async () => {
                    try {
                        const transpiled = await esbuild.transform(content.toString('utf-8'), {
                            loader: 'tsx',
                            target: 'es2022',
                            format: 'esm'
                        });
                        res.writeHead(200, { 'Content-Type': 'text/javascript', ...noCacheHeaders });
                        res.end(transpiled.code, 'utf-8');
                    } catch (esError) {
                        console.error('esbuild transpilation error:', esError);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Transpilation Error\n');
                    }
                })();
            } else {
                res.writeHead(200, { 'Content-Type': contentType, ...noCacheHeaders });
                res.end(content); // Raw content, no utf-8 forced (important for images)
            }
        }
    });
}
