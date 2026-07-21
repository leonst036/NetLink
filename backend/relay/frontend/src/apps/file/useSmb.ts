import { useState, useEffect, useRef } from "react";

export interface SmbFileItem {
    name: string;
    size: number;
    // timestamps
    createdTime: number;
    modifyTime: number;
    accsesTime: number;
    // type indification
    isFolder: boolean;
    isSymlink: boolean;
    isReadOnly: boolean;
    isHidden: boolean;
    // rights
    ownerSid?: string;
    groupSid?: string;
    accessRights?: {
        read: boolean;
        write: boolean;
        delete: boolean;
        execute: boolean;
    };
}

export function useSmb(token: string, target: string) {
    const [status, setStatus] = useState<
        "disconnected" | "connecting" | "connected"
    >("disconnected");
    const [statusMessage, setStatusMessage] = useState("");
    const [appError, setAppError] = useState<string | null>(null);
    const [files, setFiles] = useState<SmbFileItem[]>([]);
    const [currentPath, setCurrentPath] = useState("/");
    const [history, setHistory] = useState<string[]>([]);

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [transferSpeed, setTransferSpeed] = useState<string>("");
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

    const downloadTotalSizeRef = useRef<number>(0);
    const downloadReceivedRef = useRef<number>(0);
    const socketRef = useRef<WebSocket | null>(null);
    const downloadChunksRef = useRef<Blob[]>([]);
    const downloadFileNameRef = useRef<string>("");
    const uploadFileRef = useRef<File | null>(null);
    const uploadOffsetRef = useRef<number>(0);
    const currentChunkSizeRef = useRef<number>(64 * 1024);
    const chunkStartTimeRef = useRef<number>(0);

    const normalizePath = (p: string): string => {
        let clean: any = p.replace(/[/\\]+/g, "/");
        if (clean.length > 1 && clean.endsWith("/")) {
            clean = clean.slice(0, -1);
        }
        return clean;
    };

    const triggerDownload = (fileName: string, fileSize: number = 0) => {
        console.log(`Debug: Triggering download for ${fileName} of size ${fileSize}`,);

        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
        }
        setAppError(null);

        const fullPath = normalizePath(
            currentPath === "/" ? `/${fileName}` : `${currentPath}/${fileName}`,
        );

        downloadFileNameRef.current = fileName;
        downloadChunksRef.current = [];
        downloadTotalSizeRef.current = fileSize;
        downloadReceivedRef.current = 0;
        setIsDownloading(true);
        setDownloadProgress(0);
        setTransferSpeed("");
        chunkStartTimeRef.current = Date.now();
        socketRef.current.send(
            JSON.stringify({ type: "download", path: fullPath }),
        );
    };

    const startUpload = (file: File) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        setAppError(null);

        uploadFileRef.current = file;
        uploadOffsetRef.current = 0;
        currentChunkSizeRef.current = 64 * 1024;
        setIsUploading(true);
        setUploadProgress(0);
        setTransferSpeed('');

        const remotePath = normalizePath(currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`);
        socketRef.current.send(JSON.stringify({ type: 'upload', path: remotePath }));
    };
    const cancelUpload = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'uploadCancel' }));
            setIsUploading(false);
            setUploadProgress(null);
            setTransferSpeed('');
            uploadFileRef.current = null;
        }
    };

    const cancelDownload = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'downloadCancel' }));
        }
    };

    const createFolder = (folderName: string) => {
        if (folderName && socketRef.current?.readyState === WebSocket.OPEN) {
            const targetPath = normalizePath(currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`);
            socketRef.current.send(JSON.stringify({ type: 'mkdir', path: targetPath }));
        }
    };

    const deleteItem = (itemName: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            const targetPath = normalizePath(currentPath === '/' ? `/${itemName}` : `${currentPath}/${itemName}`);
            socketRef.current.send(JSON.stringify({ type: 'delete', path: targetPath }));
        }
    };

    const sendNextChunk = () => {
        const file = uploadFileRef.current;
        if (!file || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        const offset = uploadOffsetRef.current;
        if (offset >= file.size) {
            socketRef.current.send(JSON.stringify({ type: 'uploadEnd' }));
            return;
        }

        const chunkSize = currentChunkSizeRef.current;
        const slice = file.slice(offset, offset + chunkSize);
        chunkStartTimeRef.current = Date.now();
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) return;
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            socketRef.current?.send(JSON.stringify({ type: 'uploadChunk', data: base64 }));
            uploadOffsetRef.current += bytes.byteLength;
        };
        reader.readAsArrayBuffer(slice);
    };

    const connectSmb = (ip: string, user: string, pass: string, share: string = 'C$') => {
        if (!token) return;
        if (socketRef.current) socketRef.current.close();

        setStatus('connecting');
        setStatusMessage('Connecting to Relay Server...');

        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (host.includes('localhost:5173')) host = import.meta.env.VITE_RELAY_HOST || 'localhost:4535';

        const socketUrl = `${protocol}//${host}/client?token=${encodeURIComponent(token)}&target=${encodeURIComponent(target)}`;
        const socket = new WebSocket(socketUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            setStatusMessage('Connected to relay. Handshaking with local server...');
        };

        socket.onmessage = async (event) => {
            let textData = event.data;
            if (event.data instanceof Blob) {
                textData = await event.data.text();
            } else if (event.data instanceof ArrayBuffer) {
                textData = new TextDecoder().decode(event.data);
            }

            try {
                const data = JSON.parse(textData);

                if (data.type === 'ready_for_credentials') {
                    setStatusMessage('Sending SMB credentials...');
                    socket.send(JSON.stringify({
                        type: 'connect_smb',
                        host: ip || 'localhost',
                        username: user,
                        password: pass,
                        share: share
                    }));
                }
                else if (data.type === 'connected') {
                    setStatus('connected');
                    setStatusMessage('');
                    setAppError(null);
                    setCurrentPath('/');
                    socket.send(JSON.stringify({ type: 'list', path: '/' }));
                }
                else if (data.type === 'fileList') {
                    const sortedList = (data.data as SmbFileItem[]).sort((a, b) => {
                        if (a.isFolder && !b.isFolder) return -1;
                        if (!a.isFolder && b.isFolder) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    setFiles(sortedList);
                }
                else if (data.type === 'error') {
                    const errorMsg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
                    if (data.fatal) {
                        setStatus('disconnected');
                        setStatusMessage(errorMsg);
                    } else {
                        setAppError(errorMsg);
                    }
                    setIsUploading(false);
                    setUploadProgress(null);
                }
                else if (data.type === 'fileDataDownload') {
                    if (typeof data.data === 'string') {
                        const binaryString = atob(data.data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        downloadChunksRef.current.push(new Blob([bytes]));
                        
                        downloadReceivedRef.current += bytes.byteLength;
                        if (downloadTotalSizeRef.current > 0) {
                            setDownloadProgress(Math.min(100, Math.round((downloadReceivedRef.current / downloadTotalSizeRef.current) * 100)));
                        }
                        const duration = Date.now() - chunkStartTimeRef.current;
                        if (duration > 0) {
                            const speedBytesPerMs = bytes.byteLength / duration;
                            setTransferSpeed((speedBytesPerMs / 1024).toFixed(2) + ' MB/s');
                        }
                        chunkStartTimeRef.current = Date.now();
                    }
                }
                else if (data.type === 'fileEnd') {
                    const blob = new Blob(downloadChunksRef.current, { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = downloadFileNameRef.current || 'download';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    downloadChunksRef.current = [];
                    downloadFileNameRef.current = '';
                    setIsDownloading(false);
                    setDownloadProgress(null);
                    setTransferSpeed('');
                }
                else if (data.type === 'downloadCancelled') {
                    downloadChunksRef.current = [];
                    downloadFileNameRef.current = '';
                    setIsDownloading(false);
                    setDownloadProgress(null);
                    setTransferSpeed('');
                }
                else if (data.type === 'mkdirSuccess' || data.type === 'deleteSuccess') {
                    refreshList();
                }
                else if (data.type === 'uploadReady') {
                    sendNextChunk();
                }
                else if (data.type === 'uploadAck') {
                    const file = uploadFileRef.current;
                    if (file) {
                        setUploadProgress(Math.min(100, Math.round((uploadOffsetRef.current / file.size) * 100)));
                        const duration = Date.now() - chunkStartTimeRef.current;
                        if (duration > 0) {
                            const speedBytesPerMs = currentChunkSizeRef.current / duration;
                            setTransferSpeed((speedBytesPerMs / 1024).toFixed(2) + ' MB/s');
                        }
                        if (duration < 50 && currentChunkSizeRef.current < 2 * 1024 * 1024) {
                            currentChunkSizeRef.current = Math.floor(currentChunkSizeRef.current * 1.5);
                        } else if (duration > 150 && currentChunkSizeRef.current > 32 * 1024) {
                            currentChunkSizeRef.current = Math.floor(currentChunkSizeRef.current * 0.75);
                        }
                    }
                    sendNextChunk();
                }
                else if (data.type === 'uploadSuccess') {
                    setIsUploading(false);
                    setUploadProgress(null);
                    setTransferSpeed('');
                    uploadFileRef.current = null;
                    uploadOffsetRef.current = 0;
                    refreshList();
                }
            } catch (err) {
                console.error('Error handling WebSocket message:', err);
            }
        };

        socket.onclose = (event) => {
            setStatus('disconnected');
            setFiles([]);
            setIsUploading(false);
            setUploadProgress(null);
            if (event.code !== 1000 && event.code !== 1005) {
                setStatusMessage(`Connection lost (Code: ${event.code})`);
            }
        };

        socket.onerror = () => {
            setStatus('disconnected');
            setStatusMessage('WebSocket error occurred.');
        };
    };

    const disconnectSmb = () => {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        setStatus('disconnected');
        setFiles([]);
    };

    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    const navigateTo = (path: string, pushToHistory = true) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        setAppError(null);

        let targetPath = path;
        if (path === '..') {
            const parts = currentPath.split('/').filter(Boolean);
            parts.pop();
            targetPath = '/' + parts.join('/');
        }

        targetPath = normalizePath(targetPath);

        if (pushToHistory) {
            setHistory(prev => [...prev, currentPath]);
        }

        setCurrentPath(targetPath);
        socketRef.current.send(JSON.stringify({ type: 'list', path: targetPath }));
    };

    const goBack = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setHistory(prevHistory => prevHistory.slice(0, -1));
        navigateTo(prev, false);
    };

    const refreshList = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'list', path: currentPath }));
        }
    };

    return {
        status,
        statusMessage,
        appError,
        files,
        currentPath,
        history,
        uploadProgress,
        isUploading,
        isDownloading,
        transferSpeed,
        downloadProgress,
        downloadFileName: downloadFileNameRef.current,
        uploadFileName: uploadFileRef.current?.name,
        setAppError,
        connectSmb,
        disconnectSmb,
        triggerDownload,
        startUpload,
        cancelUpload,
        cancelDownload,
        createFolder,
        deleteItem,
        navigateTo,
        goBack,
        refreshList
    };
}
