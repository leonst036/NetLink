import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4540', 10);
const REPO_ROOT = process.env.GIT_DIR ? path.resolve(process.env.GIT_DIR) : __dirname;

// Helper to set CORS headers
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
}

// Get all local git branches and current branch
function getGitBranches() {
    try {
        const stdout = execSync('git branch --format="%(refname:short)|%(HEAD)"', {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const lines = stdout.trim().split('\n').filter(Boolean);
        const branches = [];
        let currentBranch = 'NetStore-dev';

        for (const line of lines) {
            const [name, isHead] = line.split('|');
            if (name) {
                branches.push(name.trim());
                if (isHead && isHead.trim() === '*') {
                    currentBranch = name.trim();
                }
            }
        }

        return {
            currentBranch,
            branches: Array.from(new Set(['workspace', ...branches, 'NetStore', 'NetStore-dev']))
        };
    } catch {
        return {
            currentBranch: 'workspace',
            branches: ['workspace', 'NetStore', 'NetStore-dev']
        };
    }
}

// Get recursive tree of applications
function getApplicationsTree(branch = 'workspace') {
    const isLive = !branch || branch === 'workspace' || branch === 'live';
    
    // Try git ls-tree if not live workspace
    if (!isLive) {
        try {
            const stdout = execSync(`git ls-tree -r --name-only ${branch} applications/`, {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            const files = stdout.trim().split('\n').filter(Boolean);
            if (files.length > 0) {
                return files.map(filePath => ({
                    path: filePath.replace(/\\/g, '/'),
                    mode: '100644',
                    type: 'blob',
                    sha: 'debug-sha'
                }));
            }
        } catch {
            // Fall back to scanning disk
        }
    }

    // Disk scan for live workspace
    const appDir = path.join(REPO_ROOT, 'applications');
    const tree = [];

    function scanDir(dir) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.isFile()) {
                const relPath = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
                tree.push({
                    path: relPath,
                    mode: '100644',
                    type: 'blob',
                    sha: 'debug-sha'
                });
            }
        }
    }

    scanDir(appDir);
    return tree;
}

// Read raw file content from branch or disk
function getRawFileContent(branch = 'workspace', filePath = '') {
    const cleanPath = filePath.replace(/^\/+/, '');
    const isLive = !branch || branch === 'workspace' || branch === 'live';

    if (!isLive) {
        try {
            const content = execSync(`git show ${branch}:${cleanPath}`, {
                cwd: REPO_ROOT,
                maxBuffer: 50 * 1024 * 1024,
                stdio: ['ignore', 'pipe', 'ignore']
            });
            return { found: true, buffer: content };
        } catch {
            // Fall back to disk
        }
    }

    const diskPath = path.join(REPO_ROOT, cleanPath);
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
        return { found: true, buffer: fs.readFileSync(diskPath) };
    }

    return { found: false, buffer: null };
}

// Get content type from file path
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.json': return 'application/json';
        case '.js': return 'application/javascript';
        case '.ts': case '.tsx': return 'text/plain';
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.svg': return 'image/svg+xml';
        case '.png': return 'image/png';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream';
    }
}

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // Health check endpoint
    if (pathname === '/health' || pathname === '/api/status') {
        const { currentBranch, branches } = getGitBranches();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            mode: 'netstore-debug-server',
            currentBranch,
            branches,
            repoRoot: REPO_ROOT
        }, null, 2));
        return;
    }

    // Branch listing endpoint
    if (pathname === '/api/branches' || pathname === '/branches') {
        const { currentBranch, branches } = getGitBranches();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ currentBranch, branches }));
        return;
    }

    // Git Trees GitHub API mock
    // Matches /repos/:owner/:repo/git/trees/:branch or /git/trees/:branch
    const treeMatch = pathname.match(/(?:\/repos\/[^/]+\/[^/]+)?\/git\/trees\/([^/]+)/);
    if (treeMatch) {
        const branch = decodeURIComponent(treeMatch[1]);
        const tree = getApplicationsTree(branch);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            sha: `tree-${branch}`,
            url: `http://localhost:${PORT}/git/trees/${branch}`,
            tree,
            truncated: false
        }));
        return;
    }

    // Raw GitHub API mock
    // Matches /refs/heads/:branch/:filePath, /raw/:branch/:filePath, /raw.githubusercontent.com/:owner/:repo/refs/heads/:branch/:filePath
    let branch = parsedUrl.searchParams.get('ref') || parsedUrl.searchParams.get('branch') || 'workspace';
    let targetFilePath = '';

    const rawMatch = pathname.match(/(?:\/raw\.githubusercontent\.com\/[^/]+\/[^/]+|\/repos\/[^/]+\/[^/]+\/contents)?\/(?:refs\/heads|raw)\/([^/]+)\/(.+)/);
    if (rawMatch) {
        branch = decodeURIComponent(rawMatch[1]);
        targetFilePath = decodeURIComponent(rawMatch[2]);
    } else if (pathname.startsWith('/applications/')) {
        targetFilePath = pathname.substring(1);
    }

    if (targetFilePath) {
        const fileResult = getRawFileContent(branch, targetFilePath);
        if (fileResult.found) {
            res.writeHead(200, { 'Content-Type': getContentType(targetFilePath) });
            res.end(fileResult.buffer);
            return;
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `File not found: ${targetFilePath} on branch ${branch}` }));
            return;
        }
    }

    // Direct applications.json catalog
    if (pathname === '/applications.json') {
        const fileResult = getRawFileContent(branch, 'applications/applications.json');
        if (fileResult.found) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fileResult.buffer);
            return;
        }
    }

    // Direct version.json
    if (pathname === '/version.json') {
        const fileResult = getRawFileContent(branch, 'applications/version.json');
        if (fileResult.found) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fileResult.buffer);
            return;
        }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 NetStore Debug Server running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Repository root: ${REPO_ROOT}`);
    console.log(`🌐 Health check:    http://localhost:${PORT}/health`);
    console.log(`🌿 Branch list:     http://localhost:${PORT}/api/branches`);
    console.log(`📦 Catalog:         http://localhost:${PORT}/applications/applications.json\n`);
});
