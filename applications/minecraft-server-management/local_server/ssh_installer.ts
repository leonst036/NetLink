import { Client } from "npm:ssh2";

export interface SshNodeConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  daemonPort?: number;
  daemonToken?: string;
}

export async function installDaemonOverSsh(
  config: SshNodeConfig,
  installerScript: string,
  wingsScript: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const conn = new Client();
    let outputBuffer = "";

    conn
      .on("ready", () => {
        outputBuffer += "[SSH] Connected to remote host.\n";

        // Encode scripts into base64 for shell compatibility (fish, zsh, bash, etc.)
        const wingsB64 = btoa(unescape(encodeURIComponent(wingsScript)));
        const installerB64 = btoa(unescape(encodeURIComponent(installerScript)));
        const daemonPort = config.daemonPort || 8080;
        const daemonToken = config.daemonToken || "netlink-secret-token";
        const sudoPass = config.password ? `echo '${config.password.replace(/'/g, "'\\''")}' | sudo -S` : "sudo -n";

        // Portable shell script compatible with fish, zsh, bash, sh
        const remoteScript = `
mkdir -p /tmp/netlink-wings-setup
echo '${wingsB64}' | base64 -d > /tmp/netlink-wings-setup/wings.ts
echo '${installerB64}' | base64 -d > /tmp/netlink-wings-setup/installer.sh
chmod +x /tmp/netlink-wings-setup/installer.sh

${sudoPass} mkdir -p /opt/netlink-wings
${sudoPass} cp /tmp/netlink-wings-setup/wings.ts /opt/netlink-wings/wings.ts
${sudoPass} cp /tmp/netlink-wings-setup/installer.sh /opt/netlink-wings/installer.sh
${sudoPass} chmod +x /opt/netlink-wings/installer.sh

export DAEMON_PORT="${daemonPort}"
export DAEMON_TOKEN="${daemonToken}"
${sudoPass} -E DAEMON_PORT="${daemonPort}" DAEMON_TOKEN="${daemonToken}" bash /opt/netlink-wings/installer.sh
rm -rf /tmp/netlink-wings-setup
`;

        // Execute explicitly with bash -c or sh -c for fish compatibility
        const commandWrapper = `sh -c '${remoteScript.replace(/'/g, "'\\''")}'`;

        conn.exec(commandWrapper, (err: any, stream: any) => {
          if (err) {
            outputBuffer += `[SSH Exec Error]: ${err.message}\n`;
            conn.end();
            return resolve({ success: false, output: outputBuffer });
          }

          stream
            .on("close", (code: number) => {
              outputBuffer += `\n[SSH] Process exited with code ${code}\n`;
              conn.end();
              resolve({
                success: code === 0,
                output: outputBuffer,
              });
            })
            .on("data", (data: Uint8Array) => {
              outputBuffer += data.toString();
            })
            .stderr.on("data", (data: Uint8Array) => {
              outputBuffer += `[STDERR] ${data.toString()}`;
            });
        });
      })
      .on("error", (err: any) => {
        outputBuffer += `[SSH Error]: ${err.message}\n`;
        resolve({ success: false, output: outputBuffer });
      })
      .connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        readyTimeout: 20000,
      });
  });
}
