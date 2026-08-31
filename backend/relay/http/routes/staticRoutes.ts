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

export function getAppImportMap(): string {
    return `  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.2.0",
      "react/": "https://esm.sh/react@18.2.0/",
      "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime",
      "react/jsx-dev-runtime": "https://esm.sh/react@18.2.0/jsx-dev-runtime",
      "react-dom": "https://esm.sh/react-dom@18.2.0",
      "react-dom/": "https://esm.sh/react-dom@18.2.0/",
      "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
      "@emotion/react": "https://esm.sh/@emotion/react@11.11.0?external=react,react-dom",
      "@emotion/styled": "https://esm.sh/@emotion/styled@11.11.0?external=react,react-dom",
      "@mui/material": "https://esm.sh/@mui/material@5.14.0?external=react,react-dom,@emotion/react,@emotion/styled",
      "@mui/material/styles": "https://esm.sh/@mui/material@5.14.0/styles?external=react,react-dom,@emotion/react,@emotion/styled",
      "@mui/material/colors": "https://esm.sh/@mui/material@5.14.0/colors?external=react,react-dom,@emotion/react,@emotion/styled",
      "@mui/icons-material": "https://esm.sh/@mui/icons-material@5.14.0?external=react,react-dom,@emotion/react,@emotion/styled",
      "lucide-react": "https://esm.sh/lucide-react@0.344.0?external=react,react-dom",
      "@xyflow/react": "https://esm.sh/@xyflow/react@12.0.0?external=react,react-dom",
      "@xyflow/react/dist/style.css": "data:text/javascript,const s=document.createElement('link');s.rel='stylesheet';s.href='https://esm.sh/@xyflow/react@12.0.0/dist/style.css';document.head.appendChild(s);export default '';",
      "xterm": "https://esm.sh/xterm@5.3.0",
      "xterm/": "https://esm.sh/xterm@5.3.0/",
      "xterm/css/xterm.css": "data:text/javascript,const s=document.createElement('link');s.rel='stylesheet';s.href='https://esm.sh/xterm@5.3.0/css/xterm.css';document.head.appendChild(s);export default '';",
      "xterm-addon-fit": "https://esm.sh/xterm-addon-fit@0.8.0?external=xterm",
      "@novnc/novnc": "https://esm.sh/@novnc/novnc@1.4.0",
      "@novnc/novnc/core/rfb": "https://esm.sh/@novnc/novnc@1.4.0/core/rfb.js",
      "date-fns": "https://esm.sh/date-fns@2.30.0",
      "date-fns/": "https://esm.sh/date-fns@2.30.0/",
      "@netlink/ui": "/assets/netlink-ui.js"
    }
  }
  </script>`;
}

export function handleStaticFileRoute(pathname: string, res: http.ServerResponse): void {
    if (pathname === '/assets/netlink-ui.js') {
        res.writeHead(200, {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache'
        });
        res.end(`import React from 'react';
import { ThemeProvider, CssBaseline, Box } from 'https://esm.sh/@mui/material@5.14.0?external=react,react-dom,@emotion/react,@emotion/styled';
import { createTheme } from 'https://esm.sh/@mui/material@5.14.0/styles?external=react,react-dom,@emotion/react,@emotion/styled';

export * from 'https://esm.sh/@mui/material@5.14.0?external=react,react-dom,@emotion/react,@emotion/styled';
export * from 'https://esm.sh/@mui/material@5.14.0/styles?external=react,react-dom,@emotion/react,@emotion/styled';

export const getAppTheme = (themeName = 'Dark') => {
    const isDark = themeName?.toLowerCase() !== 'light';
    return createTheme({
        palette: {
            mode: isDark ? 'dark' : 'light',
            primary: { main: '#38bdf8' },
            background: { default: '#020617', paper: '#0f172a' }
        }
    });
};

export function WindowLayout({ children, themeName = 'Dark', padding = '20px', style, ...props }) {
  const theme = getAppTheme(themeName);
  return React.createElement(
    ThemeProvider,
    { theme },
    React.createElement(CssBaseline, null),
    React.createElement(
      Box,
      {
        sx: {
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: theme.palette.background.default,
          color: theme.palette.text.primary,
          overflow: 'hidden',
          ...style
        },
        ...props
      },
      React.createElement(
        Box,
        {
          sx: { flexGrow: 1, padding, overflowY: 'auto', display: 'flex', flexDirection: 'column' }
        },
        children
      )
    )
  );
}

export function GeminiLoader({ size = 48 }) {
  return React.createElement(
    Box,
    { className: 'loader-container', style: { width: size, height: size } },
    React.createElement('div', { className: 'gemini-blob' }),
    React.createElement('div', { className: 'gemini-core' })
  );
}

export default { getAppTheme, WindowLayout, GeminiLoader };
`);
        return;
    }

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
                // SPA fallback for HTML5 history API routes (e.g. /devices/authorize)
                if (!ext || ext === '.html' || pathname.startsWith('/devices/')) {
                    const spaIndex = path.join(frontendPath, 'index.html');
                    if (fs.existsSync(spaIndex)) {
                        fs.readFile(spaIndex, (spaErr, spaContent) => {
                            if (!spaErr) {
                                res.writeHead(200, { 'Content-Type': 'text/html' });
                                res.end(spaContent, 'utf-8');
                                return;
                            }
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('404 Not Found\n');
                        });
                        return;
                    }
                }
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

export function handleAppFrontendRoute(pathname: string, res: http.ServerResponse, req?: http.IncomingMessage): void {
    // pathname like /apps/{userId}/{appId}/frontend/... or /apps/{userId}/{appId}/...
    const parts = pathname.split('/');
    if (parts.length < 4 || parts[1] !== 'apps') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    
    const userId = parts[2] as string;
    const appId = parts[3] as string;
    
    // Extract subpath relative to app frontend
    let subPath = '';
    if (parts.length >= 5 && parts[4] === 'frontend') {
        subPath = parts.slice(5).join('/');
    } else {
        subPath = parts.slice(4).join('/');
    }
    
    // Relay apps directory is at ../../NetStore/Applications relative to the src/dist/http/routes root
    const RELAY_APPS_DIR = path.join(__dirname, '..', '..', 'NetStore', 'Applications');
    const safeSuffix = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(RELAY_APPS_DIR, userId, appId, 'frontend', safeSuffix);

    // Prioritize fresh files from local dev workspace NetLink-NetStore if available
    const localDevCandidates = [
        path.join(__dirname, '..', '..', '..', '..', 'NetLink-NetStore', 'applications', appId, 'frontend', safeSuffix),
        path.join(__dirname, '..', '..', '..', '..', '..', 'NetLink-NetStore', 'applications', appId, 'frontend', safeSuffix),
        path.join(process.cwd(), '..', 'NetLink-NetStore', 'applications', appId, 'frontend', safeSuffix)
    ];
    for (const cand of localDevCandidates) {
        if (fs.existsSync(cand)) {
            filePath = cand;
            break;
        }
    }

    // Fallback if dist/... was requested but frontend/... exists directly
    if (!fs.existsSync(filePath) && (safeSuffix === 'dist/index.html' || safeSuffix.startsWith('dist/'))) {
        const fallbackPath = path.join(RELAY_APPS_DIR, userId, appId, 'frontend', safeSuffix.replace(/^dist[\/\\]/, ''));
        if (fs.existsSync(fallbackPath) || 
            fs.existsSync(fallbackPath + '.tsx') || 
            fs.existsSync(fallbackPath + '.ts') || 
            fs.existsSync(fallbackPath + '.jsx') || 
            fs.existsSync(fallbackPath + '.js')) {
            filePath = fallbackPath;
        }
    }

    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.tsx')) {
            filePath += '.tsx';
        } else if (fs.existsSync(filePath + '.ts')) {
            filePath += '.ts';
        } else if (fs.existsSync(filePath + '.jsx')) {
            filePath += '.jsx';
        } else if (fs.existsSync(filePath + '.js')) {
            filePath += '.js';
        } else if (fs.existsSync(path.join(filePath, 'index.tsx'))) {
            filePath = path.join(filePath, 'index.tsx');
        } else if (fs.existsSync(path.join(filePath, 'index.ts'))) {
            filePath = path.join(filePath, 'index.ts');
        } else if (fs.existsSync(path.join(filePath, 'index.jsx'))) {
            filePath = path.join(filePath, 'index.jsx');
        } else if (fs.existsSync(path.join(filePath, 'index.js'))) {
            filePath = path.join(filePath, 'index.js');
        }
    }

    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            const noCacheHeaders = {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
            if (fs.existsSync(path.join(filePath, 'index.ts'))) {
                const targetPath = pathname.endsWith('/') ? pathname + 'index.ts' : pathname + '/index.ts';
                res.writeHead(307, { 'Location': targetPath, ...noCacheHeaders });
                res.end();
                return;
            } else if (fs.existsSync(path.join(filePath, 'index.tsx'))) {
                const targetPath = pathname.endsWith('/') ? pathname + 'index.tsx' : pathname + '/index.tsx';
                res.writeHead(307, { 'Location': targetPath, ...noCacheHeaders });
                res.end();
                return;
            } else if (fs.existsSync(path.join(filePath, 'index.js'))) {
                const targetPath = pathname.endsWith('/') ? pathname + 'index.js' : pathname + '/index.js';
                res.writeHead(307, { 'Location': targetPath, ...noCacheHeaders });
                res.end();
                return;
            } else if (fs.existsSync(path.join(filePath, 'index.jsx'))) {
                const targetPath = pathname.endsWith('/') ? pathname + 'index.jsx' : pathname + '/index.jsx';
                res.writeHead(307, { 'Location': targetPath, ...noCacheHeaders });
                res.end();
                return;
            } else {
                filePath = path.join(filePath, 'index.html');
            }
        }
    } catch (e) {
        // Fallback or ignore, handle in fs.readFile
    }
    console.log(`[staticRoutes] Trying to read file: ${filePath}`);

    // Dynamic React Support
    if (path.basename(filePath) === 'index.html' && !fs.existsSync(filePath)) {
        const indexJsonPath = path.join(RELAY_APPS_DIR, userId, appId, 'index.json');
        if (fs.existsSync(indexJsonPath)) {
            try {
                const indexData = JSON.parse(fs.readFileSync(indexJsonPath, 'utf-8'));
                if (indexData.main && (indexData.main.endsWith('.tsx') || indexData.main.endsWith('.jsx'))) {
                    // Ensure main path starts with frontend/ for static app route matching
                    const cleanMain = indexData.main.startsWith('frontend/') 
                        ? indexData.main 
                        : 'frontend/' + indexData.main;
                    const mainScriptPath = indexData.main.startsWith('/') 
                        ? indexData.main 
                        : `/apps/${userId}/${appId}/${cleanMain}`;

                    const shell = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="/netlink.css">
${getAppImportMap()}
</head>
<body>
  <div class="bg-glow"></div>
  <div class="bg-glow-2"></div>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    
    const mainScriptPath = '${mainScriptPath}';
    
    // Dynamically import the main file
    import(mainScriptPath).then(m => {
        const renderApp = (Component) => {
            const root = createRoot(document.getElementById('root'));
            root.render(React.createElement(Component, { token: localStorage.getItem('netlink_token') }));
        };
        
        const App = m.default || m;
        if (App instanceof Promise) {
            App.then(appModule => renderApp(appModule.default || appModule));
        } else {
            renderApp(App);
        }
    }).catch(err => {
        console.error('Failed to load application entrypoint:', err);
        document.getElementById('root').innerHTML = '<div style="color:red;padding:20px;">Failed to load application entrypoint: ' + (err?.message || err) + '</div>';
    });
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
                if (ext === '.html' || !ext || pathname.endsWith('index.html')) {
                    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="/netlink.css">
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
    .card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 32px; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(8px); }
    h2 { margin-top: 0; color: #38bdf8; font-size: 20px; font-weight: 600; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 12px 0 20px; }
    button { background: #38bdf8; color: #020617; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #0ea5e9; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Application Not Installed</h2>
    <p>The application <strong>${appId}</strong> is not installed on this target device.</p>
    <button onclick="window.parent.postMessage({ type: 'open_app', appId: 'store' }, '*')">Open NetStore to Install</button>
  </div>
</body>
</html>`;
                    res.writeHead(200, { 'Content-Type': 'text/html', ...noCacheHeaders });
                    res.end(fallbackHtml);
                    return;
                }
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
                        const loader = ext === '.ts' ? 'ts' : (ext === '.jsx' ? 'jsx' : 'tsx');
                        const transpiled = await esbuild.transform(content.toString('utf-8'), {
                            loader,
                            target: 'es2022',
                            format: 'esm',
                            jsx: 'automatic'
                        });
                        let transpiledCode = transpiled.code;
                        // Backwards compatibility for old absolute paths in apps
                        transpiledCode = transpiledCode.replace(new RegExp(`/apps/${appId}/`, 'g'), `/apps/${userId}/${appId}/`);
                        res.writeHead(200, { 'Content-Type': 'text/javascript', ...noCacheHeaders });
                        res.end(transpiledCode, 'utf-8');
                    } catch (esError) {
                        console.error('esbuild transpilation error:', esError);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Transpilation Error\n');
                    }
                })();
            } else if (['.html', '.css', '.js', '.json', '.svg'].includes(ext)) {
                let fileContent = content.toString('utf-8');
                // Backwards compatibility for old absolute paths in apps
                fileContent = fileContent.replace(new RegExp(`/apps/${appId}/`, 'g'), `/apps/${userId}/${appId}/`);
                if (ext === '.css') {
                    const isModuleImport = req?.headers['sec-fetch-dest'] === 'script' || (req?.headers.accept && !req.headers.accept.includes('text/css'));
                    if (isModuleImport) {
                        const jsCss = `const css = ${JSON.stringify(fileContent)};\nconst style = document.createElement('style');\nstyle.setAttribute('data-injected-from', '${safeSuffix}');\nstyle.textContent = css;\ndocument.head.appendChild(style);\nexport default css;`;
                        res.writeHead(200, { 'Content-Type': 'application/javascript', ...noCacheHeaders });
                        res.end(jsCss, 'utf-8');
                        return;
                    }
                }
                if (ext === '.html') {
                    fileContent = fileContent.replace(/="\/assets\//g, '="./assets/');
                    fileContent = fileContent.replace(/="\/src\//g, '="./src/');
                    
                    // Inject importmap if not present to resolve standard React and UI packages
                    if (!fileContent.includes('type="importmap"')) {
                        const importMap = getAppImportMap() + '\n';
                        if (fileContent.includes('<head>')) {
                            fileContent = fileContent.replace('<head>', '<head>\n' + importMap);
                        } else {
                            fileContent = importMap + fileContent;
                        }
                    }
                    
                    // Inject global netlink.css for glassmorphism and tailwind classes
                    if (!fileContent.includes('href="/netlink.css"')) {
                        fileContent = fileContent.replace('</head>', '  <link rel="stylesheet" href="/netlink.css">\n</head>');
                    }
                    
                    // Inject background glows for the standard NetLink aesthetic
                    if (!fileContent.includes('class="bg-glow"')) {
                        fileContent = fileContent.replace('<div id="root">', '<div class="bg-glow"></div>\n  <div class="bg-glow-2"></div>\n  <div id="root">');
                    }
                }
                res.writeHead(200, { 'Content-Type': contentType, ...noCacheHeaders });
                res.end(fileContent, 'utf-8');
            } else {
                res.writeHead(200, { 'Content-Type': contentType, ...noCacheHeaders });
                res.end(content); // Raw content, no utf-8 forced (important for images)
            }
        }
    });
}
