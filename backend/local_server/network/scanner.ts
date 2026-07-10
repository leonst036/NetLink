import * as os from 'os';
import ipLib from 'ip';



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

import { exec } from 'child_process';

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
 * Scans a single IP address by pinging it.
 */
async function scanDevice(ip: string): Promise<void> {
    const isAlive = await pingHost(ip);
    if (isAlive) {
        console.log(`[FOUND] Host: ${ip} is active`);
    }
}

/**
 * Main function that coordinates the automatic subnet detection and the network scan.
 */
async function runNetworkScan(): Promise<void> {
    const networkDetails = getLocalNetworkDetails();

    if (!networkDetails) {
        console.error('Error: Could not automatically detect local network interfaces.');
        return;
    }

    // Calculate subnet range (e.g., 192.168.1.0/24)
    const subnet = ipLib.subnet(networkDetails.address, networkDetails.netmask);

    console.log(`Your IP: ${networkDetails.address}`);
    console.log(`Subnet Mask: ${networkDetails.netmask}`);
    console.log(`Scanning subnet range: ${subnet.firstAddress} to ${subnet.lastAddress}\n`);
    console.log('Starting ping-based scan (this may take a moment)...');

    // Convert first and last address to long integers for easy iteration
    const startLong = ipLib.toLong(subnet.firstAddress);
    const endLong = ipLib.toLong(subnet.lastAddress);

    const CONCURRENCY_LIMIT = 20;
    const activePromises: Promise<void>[] = [];

    // Loop through all available host IPs in the subnet with limited concurrency
    for (let currentLong = startLong; currentLong <= endLong; currentLong++) {
        const currentIp = ipLib.fromLong(currentLong);

        const p = scanDevice(currentIp).then(() => {
            const index = activePromises.indexOf(p);
            if (index > -1) {
                activePromises.splice(index, 1);
            }
        });
        activePromises.push(p);

        if (activePromises.length >= CONCURRENCY_LIMIT) {
            await Promise.race(activePromises);
        }
    }

    // Execute remaining scans
    await Promise.all(activePromises);

    console.log('\nNetwork scan completed successfully.');
}

// Start the scanner
runNetworkScan();
