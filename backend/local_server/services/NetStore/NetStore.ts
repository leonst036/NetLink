import fs from 'fs';
import path from 'path';

const NET_STORE_DIR = path.join(__dirname, 'Applications');

export function InitNetStore() {
    if (!fs.existsSync(NET_STORE_DIR)) {
        fs.mkdirSync(NET_STORE_DIR);
    }
    if (!fs.existsSync(path.join(NET_STORE_DIR, 'index.json'))) {
        fs.writeFileSync(path.join(NET_STORE_DIR, 'index.json'), JSON.stringify([]));
    }
    WriteApplicationJson();
}

export function ScanApplications() {
    if (!fs.existsSync(NET_STORE_DIR)) {
        InitNetStore();
    }

    const applicationFolders = fs.readdirSync(NET_STORE_DIR).filter((folder) => {
        fs.statSync(path.join(NET_STORE_DIR, folder)).isDirectory();
    });

    let applicationJson = [];
    for (const application of applicationFolders) {
        const applicationPath = path.join(NET_STORE_DIR, application);
        const applicationStat = fs.statSync(applicationPath);
        if (applicationStat.isDirectory()) {
            const indexPath = path.join(applicationPath, 'index.json');
            const indexData = fs.readFileSync(indexPath, 'utf-8');
            applicationJson.push(JSON.parse(indexData));
        }
    }
    return applicationJson;
}

export function WriteApplicationJson() {
    fs.writeFileSync(path.join(NET_STORE_DIR, 'index.json'), JSON.stringify(ScanApplications()));
}