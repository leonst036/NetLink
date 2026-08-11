import React, { useState } from 'react';

export default function ExecModal({ container, onExecCommand, onClose }: { container: any; onExecCommand: (containerId: string, command: string) => Promise<any>; onClose: () => void }) {
    const [command, setCommand] = useState('ls -la');
    const [output, setOutput] = useState<{ stdout: string; stderr: string; code?: number } | null>(null);
    const [running, setRunning] = useState(false);

    if (!container) return null;

    const handleRun = async (cmdToRun?: string) => {
        const targetCmd = cmdToRun || command;
        if (!targetCmd.trim()) return;

        setRunning(true);
        try {
            const res = await onExecCommand(container.ID, targetCmd.trim());
            setOutput(res);
        } catch (err: any) {
            setOutput({ stdout: '', stderr: err.message || 'Execution error', code: 1 });
        } finally {
            setRunning(false);
        }
    };

    const handlePreset = (presetCmd: string) => {
        setCommand(presetCmd);
        handleRun(presetCmd);
    };

    return (
        <div className="dm-modal-overlay" onClick={onClose}>
            <div className="dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3 className="dm-modal-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--dm-cyan)" strokeWidth="2">
                                <polyline points="4 17 10 11 4 5"></polyline>
                                <line x1="12" y1="19" x2="20" y2="19"></line>
                            </svg>
                            <span>Shell Exec: {container.Names}</span>
                        </h3>
                        <span className="dm-code-sub">{container.ID?.substring(0, 12)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {output && (
                            <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => setOutput(null)}>
                                🧹 Clear Terminal
                            </button>
                        )}
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="dm-modal-body">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                className="dm-input dm-input-bare"
                                type="text"
                                placeholder="Enter shell command (e.g. ls -la, env, cat /etc/os-release)"
                                value={command}
                                onChange={e => setCommand(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRun()}
                                disabled={running}
                                autoFocus
                            />
                        </div>
                        <button className="dm-btn dm-btn-primary" onClick={() => handleRun()} disabled={running}>
                            {running ? 'Executing...' : '▶ Run'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--dm-text-muted)', fontWeight: 600 }}>Quick Presets:</span>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => handlePreset('ls -la')}>ls -la</button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => handlePreset('env')}>env</button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => handlePreset('df -h')}>df -h</button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => handlePreset('uname -a')}>uname -a</button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => handlePreset('cat /etc/os-release')}>OS Info</button>
                        <button className="dm-btn dm-btn-secondary dm-btn-sm" onClick={() => handlePreset('ps aux')}>Processes</button>
                    </div>

                    <div className="dm-terminal">
                        <div className="dm-terminal-toolbar">
                            <span className="dm-terminal-title">docker exec -it {container.ID?.substring(0, 12)} sh -c "{command}"</span>
                            {output && output.code !== undefined && (
                                <span style={{ fontSize: '0.75rem', color: output.code === 0 ? 'var(--dm-emerald)' : 'var(--dm-rose)', fontWeight: 600 }}>
                                    Exit status: {output.code}
                                </span>
                            )}
                        </div>
                        <div className="dm-terminal-output">
                            {running ? (
                                <div style={{ color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>⏳ Executing command inside container...</div>
                            ) : output ? (
                                <>
                                    {output.stdout && <div style={{ color: '#e2e8f0' }}>{output.stdout}</div>}
                                    {output.stderr && <div style={{ color: 'var(--dm-rose)', marginTop: '8px' }}>{output.stderr}</div>}
                                    {!output.stdout && !output.stderr && (
                                        <span style={{ color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>Command executed cleanly with no output.</span>
                                    )}
                                </>
                            ) : (
                                <span style={{ color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>Type a command or choose a quick preset above to execute interactively.</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
