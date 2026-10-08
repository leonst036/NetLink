import fs from 'fs';
import path from 'path';
import http from 'http';

export function handleNotificationSoundRoute(req: http.IncomingMessage, res: http.ServerResponse): void {
    const scriptPath = path.join(process.cwd(), '/assets/sounds/notificationSound.mp3');
    if (!fs.existsSync(scriptPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Notification sound not found');
        return;
    }

    const script = fs.readFileSync(scriptPath);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
    res.end(script);
}