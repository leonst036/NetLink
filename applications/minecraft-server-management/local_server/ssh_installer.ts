import { Client } from "npm:ssh2";
import { readDaemonFile, DEFAULT_BOOTSTRAP_SCRIPT } from "./daemon_payloads.ts";

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
  // Load bootstrap script from daemon/scripts/ folder
  const bootstrapScript = (await readDaemonFile("bootstrap_remote.sh")) || DEFAULT_BOOTSTRAP_SCRIPT;

  return new Promise((resolve) => {
    const conn = new Client();
    let outputBuffer = "";

    conn
      .on("ready", () => {
        outputBuffer += "[SSH] Connected to remote host.\n";

        // Encode scripts into base64 for shell execution
        const wingsB64 = btoa(unescape(encodeURIComponent(wingsScript)));
        const installerB64 = btoa(unescape(encodeURIComponent(installerScript)));
        const bootstrapB64 = btoa(unescape(encodeURIComponent(bootstrapScript)));
        const daemonPort = config.daemonPort || 9080;
        const daemonToken = config.daemonToken || "netlink-secret-token";
        const sudoPrefix = config.password ? `echo '${config.password.replace(/'/g, "'\\''")}' | sudo -S` : "sudo -n";

        // Execute bootstrap_remote.sh with payload environment variables
        const commandWrapper = `WINGS_PAYLOAD_B64='${wingsB64}' INSTALLER_PAYLOAD_B64='${installerB64}' DAEMON_PORT='${daemonPort}' DAEMON_TOKEN='${daemonToken}' echo '${bootstrapB64}' | base64 -d | ${sudoPrefix} -E bash`;

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
