import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'dev_secret_key_change_in_production';
// Pre-generated JWT token signed with JWT_SECRET containing payload { deviceId: "local-server" }
const RELAY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VJZCI6ImxvY2FsLXNlcnZlciIsImlhdCI6MTc4NjE0ODk1M30.LYcW99CQ4nfekI73qy5hwkzZLmlrbOx3MPa9huMt4pI';

function parsePortArg() {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--port' || arg === '-p') {
            const val = args[i + 1];
            if (val && !val.startsWith('-')) {
                const port = parseInt(val, 10);
                if (!isNaN(port) && port > 0 && port <= 65535) {
                    return port;
                }
                console.error(`❌ Invalid port "${val}". Using default port 5173.`);
            } else {
                console.warn(`⚠️ No port number provided for ${arg}. Using default port 5173.`);
            }
        } else if (arg.startsWith('--port=')) {
            const val = arg.slice('--port='.length);
            const port = parseInt(val, 10);
            if (!isNaN(port) && port > 0 && port <= 65535) {
                return port;
            }
            console.error(`❌ Invalid port "${val}". Using default port 5173.`);
        } else if (arg.startsWith('-p=')) {
            const val = arg.slice('-p='.length);
            const port = parseInt(val, 10);
            if (!isNaN(port) && port > 0 && port <= 65535) {
                return port;
            }
            console.error(`❌ Invalid port "${val}". Using default port 5173.`);
        }
    }
    if (process.env.PORT) {
        const port = parseInt(process.env.PORT, 10);
        if (!isNaN(port) && port > 0 && port <= 65535) {
            return port;
        }
    }
    return 5173;
}

const vitePort = parsePortArg();

let relayProcess = null;
let viteProcess = null;
let localProcess = null;
let startingTimeout = null;

function startMongoProcess() {
    console.log('🐳 Starting MongoDB via Docker...');
    try {
        const containers = execSync('docker ps -a --format "{{.Names}}"').toString();
        if (containers.includes('netlink-mongo-dev')) {
            execSync('docker start netlink-mongo-dev');
        } else {
            execSync('docker run -d --name netlink-mongo-dev -p 27017:27017 mongo:latest');
        }
        console.log('✅ MongoDB is running on port 27017');
    } catch (e) {
        console.log('❌ Failed to start MongoDB via Docker. Ensure Docker is running.');
    }
}

function startRelayProcess() {
    if (relayProcess) {
        console.log('\n🔄 Restarting Relay Server...\n');
        relayProcess.kill();
        relayProcess = null;
    }
    console.log('🔨 Building Relay Server TypeScript...');
    execSync('npx tsc --outDir dist', { cwd: path.join(__dirname, 'backend/relay'), stdio: 'inherit' });

    const relayEnv = {
        ...process.env,
        HTTP_PORT: '4535',
        WS_PORT: '4536',
        JWT_SECRET: JWT_SECRET,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'admin',
        USE_SSL: 'false',
        MONGO_URI: 'mongodb://localhost:27017'
    };

    relayProcess = spawn('node', ['--no-deprecation', 'dist/main.js'], {
        cwd: path.join(__dirname, 'backend/relay'),
        env: relayEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    relayProcess.stdout.on('data', data => {
        process.stdout.write(`\x1b[36m[RELAY]\x1b[0m ${data.toString()}`);
    });
    relayProcess.stderr.on('data', data => {
        process.stderr.write(`\x1b[31m[RELAY ERR]\x1b[0m ${data.toString()}`);
    });
}

function startViteProcess() {
    if (viteProcess) {
        console.log('\n🔄 Restarting Vite Dev Server...\n');
        viteProcess.kill();
        viteProcess = null;
    }
    const viteBin = path.join(__dirname, 'backend/relay/frontend/node_modules/vite/bin/vite.js');

    const viteArgs = [viteBin, '--host', '0.0.0.0'];
    if (vitePort) {
        viteArgs.push('--port', vitePort.toString());
    }

    viteProcess = spawn('node', viteArgs, {
        cwd: path.join(__dirname, 'backend/relay/frontend'),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    viteProcess.stdout.on('data', data => {
        process.stdout.write(`\x1b[35m[VITE]\x1b[0m ${data.toString()}`);
    });
    viteProcess.stderr.on('data', data => {
        process.stderr.write(`\x1b[31m[VITE ERR]\x1b[0m ${data.toString()}`);
    });
}

function startLocalProcess() {
    if (localProcess) {
        console.log('\n🔄 Restarting Local Server...\n');
        localProcess.kill();
        localProcess = null;
    }
    console.log('🔨 Building Local Server TypeScript...');
    execSync('npx tsc --outDir dist', { cwd: path.join(__dirname, 'backend/local_server'), stdio: 'inherit' });

    const localEnv = {
        ...process.env,
        RELAY_HOST: 'localhost',
        RELAY_PORT: '4535',
        RELAY_SSL: 'false',
        REJECT_UNAUTHORIZED: 'false',
        RELAY_TOKEN: RELAY_TOKEN,
        USE_SCAN_CACHE: 'true'
    };

    localProcess = spawn('node', ['--no-deprecation', 'dist/main.js'], {
        cwd: path.join(__dirname, 'backend/local_server'),
        env: localEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    localProcess.stdout.on('data', data => {
        process.stdout.write(`\x1b[32m[LOCAL SERVER]\x1b[0m ${data.toString()}`);
    });
    localProcess.stderr.on('data', data => {
        process.stderr.write(`\x1b[31m[LOCAL ERR]\x1b[0m ${data.toString()}`);
    });
}

function stopProcesses() {
    if (startingTimeout) clearTimeout(startingTimeout);
    if (relayProcess) relayProcess.kill();
    if (viteProcess) viteProcess.kill();
    if (localProcess) localProcess.kill();
    relayProcess = null;
    viteProcess = null;
    localProcess = null;
}

function startProcesses() {
    stopProcesses();

    console.log('\n🚀 Starting NetLink Development Environment...\n');

    startMongoProcess();
    startRelayProcess();
    startViteProcess();

    startingTimeout = setTimeout(() => {
        startLocalProcess();

        console.log('===========================================================');
        console.log(' NetLink Dev Environment Running!');
        console.log(` 🌐 Web UI (Vite Dev / Hot Reload): http://localhost:${vitePort}`);
        console.log(' 🌐 Relay Backend API:             http://localhost:4535');
        console.log(' 🛠️ NetStore Docker Debug:         http://localhost:4540 (optional)');
        console.log(' 🔑 Login: admin / admin');
        console.log(' 🎯 Default Target: local-server (auto-detected)');
        console.log(' 🔄 Press key + Enter to restart specific processes:');
        console.log('    "rr"       -> Restart Relay Server');
        console.log('    "rl"       -> Restart Local Server');
        console.log('    "rv"       -> Restart Vite Dev Server');
        console.log('    "rs" / "ra" -> Restart All');
        console.log('===========================================================\n');
    }, 1500);
}

const cleanExit = () => {
    console.log('\nStopping NetLink dev servers...');
    stopProcesses();
    process.exit(0);
};

// Only bind process events once
process.once('SIGINT', cleanExit);
process.once('SIGTERM', cleanExit);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 'rs' || cmd === 'ra') {
        console.log('\n🔄 Restarting all processes...\n');
        startProcesses();
    } else if (cmd === 'rr') {
        startRelayProcess();
    } else if (cmd === 'rl') {
        startLocalProcess();
    } else if (cmd === 'rv') {
        startViteProcess();
    }
});

startProcesses();
