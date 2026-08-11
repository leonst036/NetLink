import * as os from 'os';
import ipLib from 'ip';
import { exec } from 'child_process';
import * as dns from 'dns';

export interface Device {
    ip: string;
    hostname?: string | undefined;
}

/**
 * Gets the current machine's local IPv4 and subnet mask.
 */
function getLocalNetworkDetails(): { address: string; netmask: string } | null {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        const networkInterface = interfaces[name];
        if (!networkInterface) continue;

        for (const netInfo of networkInterface) {
            // Look for an IPv4 address that is not internal (127.0.0.1)
            if (netInfo.family === 'IPv4' && !netInfo.internal) {
                return {
                    address: netInfo.address,
                    netmask: netInfo.netmask
                };
            }
        }
    }
    return null;
}

/**
 * Performs a reverse DNS lookup to find the hostname for an IP address.
 */
function reverseDns(ip: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        dns.reverse(ip, (err, hostnames) => {
            if (err || !hostnames || hostnames.length === 0) {
                resolve(undefined);
            } else {
                resolve(hostnames[0]);
            }
        });
    });
}

function pingHost(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
        // -c 1: send 1 packet, -W 1: wait 1 second for response
        exec(`ping -c 1 -W 1 ${ip}`, (error, stdout, stderr) => {
            if (error) {
                // Exit code 1 indicates host is down. Other codes (e.g. 127) indicate command errors.
                if (error.code !== 1) {
                    console.error(`System error running ping: ${stderr.trim() || error.message}`);
                }
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Scans a single IP address by pinging it and resolving its hostname if active.
 */
async function scanDevice(ip: string): Promise<Device | null> {
    const isAlive = await pingHost(ip);
    if (isAlive) {
        const hostname = await reverseDns(ip);
        console.log(`[FOUND] Host: ${ip}${hostname ? ` (${hostname})` : ''} is active`);
        return { ip, hostname };
    }
    return null;
}

/**
 * Main function that coordinates the automatic subnet detection and the network scan.
 */
export async function runNetworkScan(): Promise<Device[]> {
    let subnet;

    if (process.env.SCAN_CIDR) {
        try {
            subnet = ipLib.cidrSubnet(process.env.SCAN_CIDR);
            console.log(`Using manually configured scan subnet: ${process.env.SCAN_CIDR}`);
        } catch (err) {
            console.error(`Invalid SCAN_CIDR provided: ${process.env.SCAN_CIDR}`);
            return [];
        }
    } else {
        const networkDetails = getLocalNetworkDetails();

        if (!networkDetails) {
            console.error('Error: Could not automatically detect local network interfaces.');
            return [];
        }

        // Calculate subnet range (e.g., 192.168.1.0/24)
        subnet = ipLib.subnet(networkDetails.address, networkDetails.netmask);

        console.log(`Detected IP: ${networkDetails.address}`);
        console.log(`Subnet Mask: ${networkDetails.netmask}`);
        console.log(`(Note: If this is a Docker subnet like 172.x.x.x, consider setting SCAN_CIDR or using network_mode: 'host')`);
    }

    console.log(`Scanning subnet range: ${subnet.firstAddress} to ${subnet.lastAddress}\n`);
    console.log('Starting ping-based scan (this may take a moment)...');

    // Convert first and last address to long integers for easy iteration
    const startLong = ipLib.toLong(subnet.firstAddress);
    const endLong = ipLib.toLong(subnet.lastAddress);

    const ips: string[] = [];
    for (let currentLong = startLong; currentLong <= endLong; currentLong++) {
        ips.push(ipLib.fromLong(currentLong));
    }

    const CONCURRENCY_LIMIT = 20;
    const foundDevices: Device[] = [];
    let ipIndex = 0;

    async function worker() {
        while (ipIndex < ips.length) {
            const ip = ips[ipIndex++];
            if (ip !== undefined) {
                const device = await scanDevice(ip);
                if (device) {
                    foundDevices.push(device);
                }
            }
        }
    }

    // Start workers
    const numWorkers = Math.min(CONCURRENCY_LIMIT, ips.length);
    const workers = Array.from({ length: numWorkers }, () => worker());
    await Promise.all(workers);

    // Sort devices by IP address numerically
    foundDevices.sort((a, b) => {
        return ipLib.toLong(a.ip) - ipLib.toLong(b.ip);
    });

    console.log('\nNetwork scan completed successfully.');
    return foundDevices;
}
