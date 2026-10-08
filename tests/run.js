import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = __dirname;

const allFiles = fs.readdirSync(testsDir)
    .filter(file => /\.(test|spec)\.[cm]?[jt]s$/.test(file))
    .map(file => path.join(testsDir, file));

const rawArgs = process.argv.slice(2);
const flags = [];
const patterns = [];

for (const arg of rawArgs) {
    if (arg.startsWith('-')) {
        flags.push(arg);
    } else {
        patterns.push(arg);
    }
}

const targetFiles = new Set();
const namePatterns = [];

for (const pattern of patterns) {
    // Check direct file path match
    if (fs.existsSync(pattern) && fs.statSync(pattern).isFile()) {
        targetFiles.add(path.resolve(pattern));
        continue;
    }

    // Check filename match in tests directory (case-insensitive)
    const lower = pattern.toLowerCase();
    const matchedFiles = allFiles.filter(file => {
        const baseName = path.basename(file).toLowerCase();
        return baseName.includes(lower);
    });

    if (matchedFiles.length > 0) {
        matchedFiles.forEach(f => targetFiles.add(f));
    } else {
        namePatterns.push(pattern);
    }
}

const nodeArgs = ['--test', ...flags];

for (const np of namePatterns) {
    nodeArgs.push(`--test-name-pattern=${np}`);
}

if (targetFiles.size > 0) {
    nodeArgs.push(...Array.from(targetFiles));
} else {
    nodeArgs.push(...allFiles);
}

const child = spawn(process.execPath, nodeArgs, {
    stdio: 'inherit',
    cwd: path.resolve(testsDir, '..')
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
    } else {
        process.exit(code ?? 0);
    }
});
