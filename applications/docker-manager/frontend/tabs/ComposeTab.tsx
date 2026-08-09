import React, { useState } from 'react';

const STACK_TEMPLATES: Record<string, { name: string; yaml: string }> = {
    nginx: {
        name: '🌐 NGINX Web Server',
        yaml: `version: '3.8'
services:
  web:
    image: nginx:alpine
    container_name: compose-nginx
    ports:
      - "8080:80"
    restart: unless-stopped`
    },
    postgres_adminer: {
        name: '🐘 PostgreSQL + Adminer DB Suite',
        yaml: `version: '3.8'
services:
  db:
    image: postgres:16-alpine
    container_name: compose-postgres
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: secretpassword
      POSTGRES_DB: appdb
    ports:
      - "5432:5432"
    restart: unless-stopped

  adminer:
    image: adminer
    container_name: compose-adminer
    ports:
      - "8081:8080"
    restart: unless-stopped`
    },
    redis: {
        name: '⚡ Redis Cache Server',
        yaml: `version: '3.8'
services:
  cache:
    image: redis:7-alpine
    container_name: compose-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    restart: unless-stopped`
    },
    wordpress: {
        name: '📰 WordPress + MySQL Stack',
        yaml: `version: '3.8'
services:
  db:
    image: mysql:8.0
    container_name: compose-wp-db
    environment:
      MYSQL_ROOT_PASSWORD: secretpassword
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpresspassword
    restart: unless-stopped

  wordpress:
    image: wordpress:latest
    container_name: compose-wordpress
    ports:
      - "8000:80"
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpresspassword
      WORDPRESS_DB_NAME: wordpress
    restart: unless-stopped`
    }
};

export default function ComposeTab({ handleDeployCompose, handleDownCompose }: { handleDeployCompose: (stackName: string, yamlContent: string) => Promise<any>; handleDownCompose: (stackName: string) => Promise<any> }) {
    const [stackName, setStackName] = useState('my-app-stack');
    const [yaml, setYaml] = useState(STACK_TEMPLATES['nginx']?.yaml || '');
    const [deploying, setDeploying] = useState(false);
    const [output, setOutput] = useState<{ stdout?: string; stderr?: string } | null>(null);

    const handleSelectTemplate = (key: string) => {
        const tmpl = STACK_TEMPLATES[key];
        if (tmpl) {
            setYaml(tmpl.yaml);
        }
    };

    const onDeploy = async () => {
        if (!yaml.trim() || !stackName.trim()) return;
        setDeploying(true);
        setOutput(null);
        try {
            const res = await handleDeployCompose(stackName.trim(), yaml.trim());
            setOutput(res);
        } catch (err: any) {
            setOutput({ stderr: err.message || 'Deploy failed' });
        } finally {
            setDeploying(false);
        }
    };

    const onDown = async () => {
        if (!stackName.trim()) return;
        setDeploying(true);
        setOutput(null);
        try {
            const res = await handleDownCompose(stackName.trim());
            setOutput(res);
        } catch (err: any) {
            setOutput({ stderr: err.message || 'Stack removal failed' });
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="dm-table-container" style={{ padding: '28px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem', color: 'var(--dm-text-heading)', fontFamily: 'var(--dm-font-heading)' }}>
                        ⚡ Docker Compose Stack Launcher
                    </h3>
                    <p style={{ margin: 0, color: 'var(--dm-text-muted)', fontSize: '0.88rem' }}>
                        Define multi-container applications using standard <code style={{ fontFamily: 'var(--dm-font-mono)', color: 'var(--dm-cyan)' }}>docker-compose.yml</code> definitions.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="dm-form-group" style={{ marginBottom: 0 }}>
                        <label>Stack / Project Identifier</label>
                        <input
                            className="dm-input dm-input-bare"
                            type="text"
                            value={stackName}
                            onChange={e => setStackName(e.target.value)}
                            placeholder="my-stack"
                        />
                    </div>

                    <div className="dm-form-group" style={{ marginBottom: 0 }}>
                        <label>Preset Stack Templates</label>
                        <select
                            className="dm-select"
                            onChange={e => handleSelectTemplate(e.target.value)}
                            defaultValue="nginx"
                        >
                            {Object.entries(STACK_TEMPLATES).map(([key, t]) => (
                                <option key={key} value={key}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="dm-form-group" style={{ marginBottom: '20px' }}>
                    <label>docker-compose.yml Content</label>
                    <textarea
                        className="dm-input dm-input-bare"
                        rows={14}
                        value={yaml}
                        onChange={e => setYaml(e.target.value)}
                        placeholder="Paste docker-compose.yml content here..."
                        style={{ fontFamily: 'var(--dm-font-mono)', fontSize: '0.82rem', lineHeight: '1.6', resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="dm-btn dm-btn-primary" onClick={onDeploy} disabled={deploying}>
                        {deploying ? '⏳ Deploying Stack...' : '🚀 Deploy Stack (docker compose up -d)'}
                    </button>
                    <button className="dm-btn dm-btn-danger" onClick={onDown} disabled={deploying}>
                        {deploying ? '⏳ Stopping Stack...' : '🛑 Stop Stack (docker compose down)'}
                    </button>
                </div>

                {output && (
                    <div style={{ marginTop: '24px' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Execution Output Log:</h4>
                        <div className="dm-terminal">
                            <div className="dm-terminal-output">
                                {output.stdout && <div style={{ color: 'var(--dm-emerald)' }}>{output.stdout}</div>}
                                {output.stderr && <div style={{ color: 'var(--dm-rose)', marginTop: '8px' }}>{output.stderr}</div>}
                                {!output.stdout && !output.stderr && <div style={{ color: 'var(--dm-text-muted)', fontStyle: 'italic' }}>Stack operation completed.</div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
