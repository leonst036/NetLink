import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'dev_secret_key_change_in_production';
// Pre-generated JWT token signed with JWT_SECRET containing payload { deviceId: "local-server" }
const RELAY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VJZCI6ImxvY2FsLXNlcnZlciIsImlhdCI6MTc4NjE0ODk1M30.LYcW99CQ4nfekI73qy5hwkzZLmlrbOx3MPa9huMt4pI';

console.log('🔨 [1/3] Building Relay Server TypeScript...');
execSync('npx tsc --outDir dist', { cwd: path.join(__dirname, 'backend/relay'), stdio: 'inherit' });

console.log('🔨 [2/3] Building Web Frontend...');
execSync('npm run build', { cwd: path.join(__dirname, 'backend/relay/frontend'), stdio: 'inherit' });

console.log('🔨 [3/3] Building Local Server TypeScript...');
execSync('npx tsc --outDir dist', { cwd: path.join(__dirname, 'backend/local_server'), stdio: 'inherit' });

console.log('\n🚀 Starting NetLink Development Environment...\n');

// 1. Start Relay Server
const relayEnv = {
    ...process.env,
    HTTP_PORT: '4535',
    WS_PORT: '4536',
    JWT_SECRET: JWT_SECRET,
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin',
    USE_SSL: 'false'
};

const relayProcess = spawn('node', ['dist/main.js'], {
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

// 2. Delay slightly to let Relay start, then launch Local Server
setTimeout(() => {
    const localEnv = {
        ...process.env,
        RELAY_HOST: 'localhost',
        RELAY_PORT: '4535',
        RELAY_SSL: 'false',
        REJECT_UNAUTHORIZED: 'false',
        RELAY_TOKEN: RELAY_TOKEN
    };

    const localProcess = spawn('node', ['dist/main.js'], {
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

    console.log('===========================================================');
    console.log(' NetLink Dev Environment Running!');
    console.log(' 🌐 Web UI: http://localhost:4535');
    console.log(' 🔑 Login: admin / admin');
    console.log(' 🎯 Default Target: local-server (auto-detected)');
    console.log('===========================================================\n');

    const cleanExit = () => {
        console.log('\nStopping NetLink dev servers...');
        localProcess.kill();
        relayProcess.kill();
        process.exit(0);
    };

    process.on('SIGINT', cleanExit);
    process.on('SIGTERM', cleanExit);

}, 1500);
