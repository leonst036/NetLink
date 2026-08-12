import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import { Client as SSHClient } from 'ssh2';

type SshSession = {
    ssh: SSHClient;
    stream: any | null;
    attachedWs: WebSocket | null;
    messageHandler: ((message: any) => void) | null;
    streamBound: boolean;
    history: string;
};

const activeSshSessions = new Map<string, SshSession>();

function cleanupSession(sessionId: string): void {
    const session = activeSshSessions.get(sessionId);
    if (!session) {
        return;
    }

    activeSshSessions.delete(sessionId);

    if (session.messageHandler && session.attachedWs) {
        session.attachedWs.off('message', session.messageHandler);
    }

    try {
        session.ssh.end();
    } catch (err) {
        // Ignore shutdown errors when the SSH client is already closed.
    }
}

function attachWebSocket(sessionId: string, session: SshSession, ws: WebSocket): void {
    if (session.messageHandler && session.attachedWs) {
        session.attachedWs.off('message', session.messageHandler);
    }

    const onMessage = (message: any) => {
        if (session.stream && !session.stream.destroyed) {
            session.stream.write(message);
        }
    };

    session.attachedWs = ws;
    session.messageHandler = onMessage;

    ws.on('message', onMessage);
    ws.on('close', () => {
        if (session.attachedWs === ws) {
            session.attachedWs = null;
        }
        if (session.messageHandler === onMessage) {
            session.messageHandler = null;
        }
        ws.off('message', onMessage);
    });

    if (ws.readyState === WebSocket.OPEN) {
        if (session.history) {
            ws.send(session.history);
        }
        ws.send(`\r\n[SSH Session Active]: Reattached to session ${sessionId}\r\n`);
    }
}

function bindStream(sessionId: string, session: SshSession): void {
    if (!session.stream || session.streamBound) {
        return;
    }

    session.streamBound = true;

    session.stream.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        session.history += text;
        // Limit history to last 100k characters to avoid memory leaks
        if (session.history.length > 100000) {
            session.history = session.history.slice(-100000);
        }
        
        if (session.attachedWs && session.attachedWs.readyState === WebSocket.OPEN) {
            session.attachedWs.send(text);
        }
    });

    session.stream.on('close', () => {
        cleanupSession(sessionId);
    });

    session.stream.on('error', (err: Error) => {
        if (session.attachedWs && session.attachedWs.readyState === WebSocket.OPEN) {
            session.attachedWs.send(`\r\n[SSH Stream Error]: ${err.message}\r\n`);
            session.attachedWs.close();
        }
        cleanupSession(sessionId);
    });
}

export function startSsh(ws: WebSocket, host: string, username: string, password: string, sessionId?: string): void {
    storeSshSession(ws, host, username, password, sessionId);
}


export function storeSshSession(ws: WebSocket, host: string, username: string, password: string, sessionId?: string): void {
    const activeSessionId = sessionId || randomUUID();
    const existingSession = activeSshSessions.get(activeSessionId);

    if (existingSession) {
        console.log(`Reattaching SSH session ${activeSessionId} for ${host} as ${username}...`);
        attachWebSocket(activeSessionId, existingSession, ws);
        return;
    }

    console.log(`Storing SSH session for ${host} as ${username}...`);
    const ssh = new SSHClient();
    const session: SshSession = {
        ssh,
        stream: null,
        attachedWs: ws,
        messageHandler: null,
        streamBound: false,
        history: '',
    };

    activeSshSessions.set(activeSessionId, session);

    attachWebSocket(activeSessionId, session, ws);

    ssh.on('ready', () => {
        if (session.attachedWs && session.attachedWs.readyState === WebSocket.OPEN) {
            session.attachedWs.send(`\r\n[SSH Session Stored]: Connected to ${host} as ${username}\r\n`);
        }

        ssh.shell((err, stream) => {
            if (err) {
                if (session.attachedWs && session.attachedWs.readyState === WebSocket.OPEN) {
                    session.attachedWs.send(`\r\n[SSH Error]: ${err.message}\r\n`);
                    session.attachedWs.close();
                }
                cleanupSession(activeSessionId);
                return;
            }

            session.stream = stream;
            bindStream(activeSessionId, session);
        });
    });

    ssh.on('error', (err) => {
        if (session.attachedWs && session.attachedWs.readyState === WebSocket.OPEN) {
            session.attachedWs.send(`\r\n[Connection Error]: ${err.message}\r\n`);
            session.attachedWs.close();
        }
        cleanupSession(activeSessionId);
    });

    ssh.connect({
        host,
        port: 22,
        username,
        password
    });
}
