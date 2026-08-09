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
        <div className="dm-modal-backdrop" onClick={onClose}>
            <div className="dm-modal dm-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="dm-modal-header">
                    <div>
                        <h3>⚡ Container Shell Exec: {container.Names}</h3>
                        <span className="dm-code-sub">{container.ID?.substring(0, 12)}</span>
                    </div>
                    <div className="dm-modal-actions">
                        {output && (
                            <button className="nl-button secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setOutput(null)}>
                                🧹 Clear Terminal
                            </button>
                        )}
                        <button className="dm-modal-close" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="dm-modal-body">
                    <div className="dm-exec-bar">
                        <div className="dm-exec-input-wrapper">
                            <span className="dm-exec-prompt">$ {container.Names?.replace(/^\//, '')}:~#</span>
                            <input
                                className="dm-input dm-exec-input"
                                type="text"
                                placeholder="Enter shell command (e.g. ls -la, env, cat /etc/os-release)"
                                value={command}
                                onChange={e => setCommand(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRun()}
                                disabled={running}
                                autoFocus
                            />
                        </div>
                        <button className="nl-button" onClick={() => handleRun()} disabled={running}>
                            {running ? 'Executing...' : '▶ Run'}
                        </button>
                    </div>

                    <div className="dm-presets">
                        <span className="dm-presets-label">Quick Commands:</span>
                        <button className="dm-preset-btn" onClick={() => handlePreset('ls -la')}>ls -la</button>
                        <button className="dm-preset-btn" onClick={() => handlePreset('env')}>env</button>
                        <button className="dm-preset-btn" onClick={() => handlePreset('df -h')}>df -h</button>
                        <button className="dm-preset-btn" onClick={() => handlePreset('uname -a')}>uname -a</button>
                        <button className="dm-preset-btn" onClick={() => handlePreset('cat /etc/os-release')}>OS Info</button>
                        <button className="dm-preset-btn" onClick={() => handlePreset('ps aux')}>Processes</button>
                        <button className="dm-preset-btn" onClick={() => handlePreset('top -b -n 1')}>top</button>
                    </div>

                    <div className="dm-log-terminal dm-exec-terminal">
                        {running ? (
                            <div className="dm-terminal-muted">⏳ Executing command inside container...</div>
                        ) : output ? (
                            <>
                                {output.code !== undefined && (
                                    <div style={{ marginBottom: '8px', fontSize: '0.75rem', color: output.code === 0 ? '#34d399' : '#f87171' }}>
                                        Exit Status: {output.code} {output.code === 0 ? '✓ Success' : '❌ Failed'}
                                    </div>
                                )}
                                {output.stdout && <pre className="dm-stdout">{output.stdout}</pre>}
                                {output.stderr && <pre className="dm-stderr">{output.stderr}</pre>}
                                {!output.stdout && !output.stderr && (
                                    <span className="dm-terminal-muted">Command executed cleanly with no output.</span>
                                )}
                            </>
                        ) : (
                            <span className="dm-terminal-muted">Type a command or choose a quick preset above to execute interactively.</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

