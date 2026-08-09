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
        name: '⚡ Redis In-Memory Cache',
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
        name: '📰 WordPress + MySQL',
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
    const [yaml, setYaml] = useState(STACK_TEMPLATES.nginx.yaml);
    const [deploying, setDeploying] = useState(false);
    const [output, setOutput] = useState<{ stdout?: string; stderr?: string } | null>(null);

    const handleSelectTemplate = (key: string) => {
        if (STACK_TEMPLATES[key]) {
            setYaml(STACK_TEMPLATES[key].yaml);
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
        <div className="dm-compose-tab">
            <div className="nl-panel dm-compose-panel">
                <div className="dm-compose-header">
                    <h3>Docker Compose Stack Launcher</h3>
                    <p>Paste a docker-compose.yml configuration or select a template to launch full multi-container applications.</p>
                </div>

                <div className="dm-compose-bar">
                    <div className="dm-form-group" style={{ marginBottom: 0, flex: 1 }}>
                        <label>Stack / Project Name</label>
                        <input
                            className="dm-input"
                            type="text"
                            value={stackName}
                            onChange={e => setStackName(e.target.value)}
                            placeholder="my-stack"
                        />
                    </div>

                    <div className="dm-form-group" style={{ marginBottom: 0, flex: 1 }}>
                        <label>Templates</label>
                        <select
                            className="dm-input"
                            onChange={e => handleSelectTemplate(e.target.value)}
                            defaultValue="nginx"
                        >
                            {Object.entries(STACK_TEMPLATES).map(([key, t]) => (
                                <option key={key} value={key}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="dm-form-group">
                    <label>docker-compose.yml</label>
                    <textarea
                        className="dm-input dm-code-editor"
                        rows={14}
                        value={yaml}
                        onChange={e => setYaml(e.target.value)}
                        placeholder="Paste docker-compose.yml content here..."
                    />
                </div>

                <div className="dm-compose-actions">
                    <button className="nl-button success" onClick={onDeploy} disabled={deploying}>
                        {deploying ? 'Deploying Stack...' : '🚀 Deploy Stack (Up)'}
                    </button>
                    <button className="nl-button danger" onClick={onDown} disabled={deploying}>
                        {deploying ? 'Stopping Stack...' : '🛑 Stop Stack (Down)'}
                    </button>
                </div>

                {output && (
                    <div className="dm-compose-output">
                        <h4>Stack Operation Output:</h4>
                        <pre className="dm-log-terminal">
                            {output.stdout && <div className="dm-stdout">{output.stdout}</div>}
                            {output.stderr && <div className="dm-stderr">{output.stderr}</div>}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
