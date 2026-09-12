import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import net from 'node:net';
import { createRequire } from 'node:module';
import type { MagicDnsRegistry as MagicDnsRegistryType } from '../backend/relay/dns/MagicDnsRegistry.ts';
import type { MagicDnsServer as MagicDnsServerType } from '../backend/relay/dns/MagicDnsServer.ts';

const relayRequire = createRequire(new URL('../backend/relay/package.json', import.meta.url));
const dnsPacket = relayRequire('dns-packet');

let MagicDnsRegistry: typeof MagicDnsRegistryType;
let MagicDnsServer: typeof MagicDnsServerType;

try {
    const serverMod = await import('../backend/relay/dns/MagicDnsServer.ts');
    const registryMod = await import('../backend/relay/dns/MagicDnsRegistry.ts');
    MagicDnsServer = serverMod.MagicDnsServer;
    MagicDnsRegistry = registryMod.MagicDnsRegistry;
} catch {
    const serverMod = await import('../backend/relay/dist/dns/MagicDnsServer.js');
    const registryMod = await import('../backend/relay/dist/dns/MagicDnsRegistry.js');
    MagicDnsServer = serverMod.MagicDnsServer;
    MagicDnsRegistry = registryMod.MagicDnsRegistry;
}

// Find an available port for socket tests
function getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr && typeof addr === 'object') {
                const port = addr.port;
                server.close(() => resolve(port));
            } else {
                server.close(() => reject(new Error('Failed to obtain port')));
            }
        });
        server.on('error', reject);
    });
}

describe('MagicDnsRegistry', () => {
    it('registers node and handles slugification', () => {
        const registry = new MagicDnsRegistry();

        // Standard hostname
        const dom1 = registry.registerNode('my-host', '192.168.1.50');
        assert.equal(dom1, 'my-host.netlink');
        assert.equal(registry.resolve('my-host.netlink'), '192.168.1.50');

        // Stripping existing .netlink and .netlink. suffix
        const dom2 = registry.registerNode('other-host.netlink', '192.168.1.51');
        assert.equal(dom2, 'other-host.netlink');

        const dom3 = registry.registerNode('another-host.NETLINK.', '192.168.1.52');
        assert.equal(dom3, 'another-host.netlink');

        // Special characters and casing
        const dom4 = registry.registerNode('Special_Host @Home!', '192.168.1.53');
        assert.equal(dom4, 'special-host--home.netlink');

        // Leading and trailing hyphens
        const dom5 = registry.registerNode('---trimmed---', '192.168.1.54');
        assert.equal(dom5, 'trimmed.netlink');

        // Empty or invalid hostname
        const domEmpty = registry.registerNode('---', '192.168.1.55');
        assert.equal(domEmpty, '');
    });

    it('cleans IPv6 mapped IPv4 addresses', () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('mapped-node', '::ffff:10.0.0.25');

        assert.equal(registry.resolve('mapped-node.netlink'), '10.0.0.25');
        assert.equal(registry.resolveReverse('10.0.0.25'), 'mapped-node.netlink');
        assert.equal(registry.resolveReverse('::ffff:10.0.0.25'), 'mapped-node.netlink');
    });

    it('updates reverse mapping when IP changes', () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('moving-node', '10.0.0.10');
        assert.equal(registry.resolveReverse('10.0.0.10'), 'moving-node.netlink');

        registry.registerNode('moving-node', '10.0.0.20');
        assert.equal(registry.resolve('moving-node.netlink'), '10.0.0.20');
        assert.equal(registry.resolveReverse('10.0.0.20'), 'moving-node.netlink');
        assert.equal(registry.resolveReverse('10.0.0.10'), undefined);
    });

    it('registers device and multiple aliases', () => {
        const registry = new MagicDnsRegistry();
        const primary = registry.registerDevice('dev-1', 'main-device', '10.0.0.30');
        assert.equal(primary, 'main-device.netlink');

        const aliases = registry.registerDeviceAliases('dev-1', '10.0.0.30', [
            'main-device',
            'alias-one',
            'alias-two',
            '',
            null as any
        ]);

        assert.deepEqual(aliases, ['main-device.netlink', 'alias-one.netlink', 'alias-two.netlink']);
        assert.equal(registry.getDomainForDevice('dev-1'), 'main-device.netlink');
        assert.deepEqual(registry.getDomainsForDevice('dev-1'), [
            'main-device.netlink',
            'alias-one.netlink',
            'alias-two.netlink'
        ]);

        // Removing alias from list unregisters old alias
        registry.registerDeviceAliases('dev-1', '10.0.0.30', ['main-device', 'alias-two']);
        assert.equal(registry.resolve('alias-one.netlink'), undefined);
        assert.equal(registry.resolve('alias-two.netlink'), '10.0.0.30');
    });

    it('resolves domains with trailing dots, case-insensitivity, and typos', () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('test-host', '10.0.0.50');

        assert.equal(registry.resolve('test-host.netlink'), '10.0.0.50');
        assert.equal(registry.resolve('TEST-HOST.NETLINK'), '10.0.0.50');
        assert.equal(registry.resolve('test-host.netlink.'), '10.0.0.50');

        // Typo correction for .netlik
        assert.equal(registry.resolve('test-host.netlik'), '10.0.0.50');

        // Unknown domain
        assert.equal(registry.resolve('unknown.netlink'), undefined);
    });

    it('unregisters node and device', () => {
        const registry = new MagicDnsRegistry();
        registry.registerDevice('dev-2', 'dev-two', '10.0.0.60');

        assert.equal(registry.resolve('dev-two.netlink'), '10.0.0.60');
        assert.equal(registry.resolveReverse('10.0.0.60'), 'dev-two.netlink');

        // Unregister node
        registry.unregisterNode('dev-two.netlink');
        assert.equal(registry.resolve('dev-two.netlink'), undefined);
        assert.equal(registry.resolveReverse('10.0.0.60'), undefined);
        assert.equal(registry.getDomainForDevice('dev-2'), undefined);

        // Re-register and unregister device
        registry.registerDevice('dev-3', 'dev-three', '10.0.0.70');
        const removed = registry.unregisterDevice('dev-3');
        assert.equal(removed, 'dev-three.netlink');
        assert.equal(registry.resolve('dev-three.netlink'), undefined);
    });

    it('restores reverse mapping if another domain points to the same IP', () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('domain-a', '10.0.0.80');
        registry.registerNode('domain-b', '10.0.0.80');

        // Unregister domain-b
        registry.unregisterNode('domain-b.netlink');
        assert.equal(registry.resolveReverse('10.0.0.80'), 'domain-a.netlink');
    });

    it('cleans docker records while preserving local-server', () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('local-server', '10.0.1.1');
        registry.registerNode('app-coolify', '192.168.1.90');
        registry.registerNode('aabbccddeeff11223344', '192.168.1.91');
        registry.registerNode('docker-ip-subnet1', '10.0.1.20');
        registry.registerNode('docker-ip-subnet2', '172.20.0.5');
        registry.registerNode('valid-node', '192.168.1.99');

        const removedCount = registry.cleanDockerRecords();
        assert.equal(removedCount, 4);

        // local-server is preserved
        assert.equal(registry.resolve('local-server.netlink'), '10.0.1.1');
        // valid-node is preserved
        assert.equal(registry.resolve('valid-node.netlink'), '192.168.1.99');
        // Docker records are removed
        assert.equal(registry.resolve('app-coolify.netlink'), undefined);
        assert.equal(registry.resolve('aabbccddeeff11223344.netlink'), undefined);
        assert.equal(registry.resolve('docker-ip-subnet1.netlink'), undefined);
        assert.equal(registry.resolve('docker-ip-subnet2.netlink'), undefined);
    });

    it('retrieves all records dictionary', () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('alpha', '10.0.0.1');
        registry.registerNode('beta', '10.0.0.2');

        const all = registry.getAllRecords();
        assert.deepEqual(all, {
            'alpha.netlink': '10.0.0.1',
            'beta.netlink': '10.0.0.2'
        });
    });
});

describe('MagicDnsServer', () => {
    it('returns null for non-query message', async () => {
        const server = new MagicDnsServer({ upstreamDns: '' });
        const responsePacket = dnsPacket.encode({
            type: 'response',
            id: 1,
            flags: 0,
            questions: []
        });

        const result = await server.processQuery(responsePacket);
        assert.equal(result, null);
    });

    it('handles query with empty questions', async () => {
        const server = new MagicDnsServer({ upstreamDns: '' });
        const query = dnsPacket.encode({
            type: 'query',
            id: 10,
            flags: dnsPacket.RECURSION_DESIRED,
            questions: []
        });

        const responseBuf = await server.processQuery(query);
        assert.ok(responseBuf);
        const decoded = dnsPacket.decode(responseBuf);
        assert.equal(decoded.type, 'response');
        assert.equal(decoded.id, 10);
    });

    it('resolves A record for local domain', async () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('test-node', '10.10.10.10');
        const server = new MagicDnsServer({ registry, upstreamDns: '' });

        const query = dnsPacket.encode({
            type: 'query',
            id: 100,
            flags: dnsPacket.RECURSION_DESIRED,
            questions: [{ type: 'A', name: 'test-node.netlink' }]
        });

        const resBuf = await server.processQuery(query);
        assert.ok(resBuf);
        const decoded = dnsPacket.decode(resBuf);

        assert.equal(decoded.id, 100);
        assert.equal(decoded.answers?.length, 1);
        assert.equal(decoded.answers[0].name, 'test-node.netlink');
        assert.equal(decoded.answers[0].data, '10.10.10.10');
        assert.equal(decoded.answers[0].type, 'A');
    });

    it('resolves short query without .netlink suffix', async () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('short-node', '10.10.10.20');
        const server = new MagicDnsServer({ registry, upstreamDns: '' });

        const query = dnsPacket.encode({
            type: 'query',
            id: 101,
            questions: [{ type: 'A', name: 'short-node' }]
        });

        const resBuf = await server.processQuery(query);
        assert.ok(resBuf);
        const decoded = dnsPacket.decode(resBuf);

        assert.equal(decoded.id, 101);
        assert.equal(decoded.answers?.length, 1);
        assert.equal(decoded.answers[0].data, '10.10.10.20');
    });

    it('returns rcode 3 (NXDOMAIN) for unknown domain', async () => {
        const registry = new MagicDnsRegistry();
        const server = new MagicDnsServer({ registry, upstreamDns: '' });

        const query = dnsPacket.encode({
            type: 'query',
            id: 102,
            questions: [{ type: 'A', name: 'missing.netlink' }]
        });

        const resBuf = await server.processQuery(query);
        assert.ok(resBuf);
        const decoded = dnsPacket.decode(resBuf);

        assert.equal(decoded.id, 102);
        assert.equal(decoded.rcode, 'NXDOMAIN');
        assert.equal(decoded.answers?.length, 0);
    });

    it('resolves PTR reverse DNS record', async () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('reverse-node', '10.10.10.30');
        const server = new MagicDnsServer({ registry, upstreamDns: '' });

        const query = dnsPacket.encode({
            type: 'query',
            id: 103,
            questions: [{ type: 'PTR', name: '30.10.10.10.in-addr.arpa' }]
        });

        const resBuf = await server.processQuery(query);
        assert.ok(resBuf);
        const decoded = dnsPacket.decode(resBuf);

        assert.equal(decoded.id, 103);
        assert.equal(decoded.answers?.length, 1);
        assert.equal(decoded.answers[0].type, 'PTR');
        assert.equal(decoded.answers[0].data, 'reverse-node.netlink');
    });

    it('returns rcode 3 for unknown PTR query', async () => {
        const registry = new MagicDnsRegistry();
        const server = new MagicDnsServer({ registry, upstreamDns: '' });

        const query = dnsPacket.encode({
            type: 'query',
            id: 104,
            questions: [{ type: 'PTR', name: '99.99.99.99.in-addr.arpa' }]
        });

        const resBuf = await server.processQuery(query);
        assert.ok(resBuf);
        const decoded = dnsPacket.decode(resBuf);

        assert.equal(decoded.id, 104);
        assert.equal(decoded.rcode, 'NXDOMAIN');
    });

    it('handles non-A queries (e.g. AAAA) for existing and non-existing domains', async () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('v6-node', '10.10.10.40');
        const server = new MagicDnsServer({ registry, upstreamDns: '' });

        // Existing domain -> NOERROR with no answers
        const queryExisting = dnsPacket.encode({
            type: 'query',
            id: 105,
            questions: [{ type: 'AAAA', name: 'v6-node.netlink' }]
        });
        const resExisting = await server.processQuery(queryExisting);
        assert.ok(resExisting);
        const decodedExisting = dnsPacket.decode(resExisting);
        assert.equal(decodedExisting.rcode, 'NOERROR');
        assert.equal(decodedExisting.answers?.length, 0);

        // Non-existing domain -> NXDOMAIN
        const queryMissing = dnsPacket.encode({
            type: 'query',
            id: 106,
            questions: [{ type: 'AAAA', name: 'missing.netlink' }]
        });
        const resMissing = await server.processQuery(queryMissing);
        assert.ok(resMissing);
        const decodedMissing = dnsPacket.decode(resMissing);
        assert.equal(decodedMissing.rcode, 'NXDOMAIN');
    });

    it('performs DNS lookup over real UDP socket', async () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('udp-service', '10.20.30.40');

        const testPort = await getAvailablePort();
        const server = new MagicDnsServer({
            port: testPort,
            host: '127.0.0.1',
            registry,
            enableTcp: false,
            upstreamDns: ''
        });

        await server.start(testPort, '127.0.0.1');

        try {
            const client = dgram.createSocket('udp4');
            const query = dnsPacket.encode({
                type: 'query',
                id: 201,
                flags: dnsPacket.RECURSION_DESIRED,
                questions: [{ type: 'A', name: 'udp-service.netlink' }]
            });

            const responsePromise = new Promise<Buffer>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    client.close();
                    reject(new Error('UDP request timed out'));
                }, 2000);

                client.on('message', (msg) => {
                    clearTimeout(timeout);
                    client.close();
                    resolve(msg);
                });
                client.on('error', (err) => {
                    clearTimeout(timeout);
                    client.close();
                    reject(err);
                });
            });

            client.send(query, testPort, '127.0.0.1');
            const responseBuf = await responsePromise;
            const decoded = dnsPacket.decode(responseBuf);

            assert.equal(decoded.id, 201);
            assert.equal(decoded.answers?.length, 1);
            assert.equal(decoded.answers[0].data, '10.20.30.40');
        } finally {
            await server.stop();
        }
    });

    it('performs DNS lookup over real TCP socket with 2-byte prefix', async () => {
        const registry = new MagicDnsRegistry();
        registry.registerNode('tcp-service', '10.20.30.50');

        const testPort = await getAvailablePort();
        const server = new MagicDnsServer({
            port: testPort,
            host: '127.0.0.1',
            registry,
            enableTcp: true,
            upstreamDns: ''
        });

        await server.start(testPort, '127.0.0.1');

        try {
            const query = dnsPacket.encode({
                type: 'query',
                id: 202,
                flags: dnsPacket.RECURSION_DESIRED,
                questions: [{ type: 'A', name: 'tcp-service.netlink' }]
            });

            const responseBuf = await new Promise<Buffer>((resolve, reject) => {
                const client = net.createConnection({ port: testPort, host: '127.0.0.1' });
                const chunks: Buffer[] = [];
                let expectedLen = -1;

                const timeout = setTimeout(() => {
                    client.destroy();
                    reject(new Error('TCP request timed out'));
                }, 2000);

                client.on('connect', () => {
                    // Prepend 2-byte length according to RFC 1035
                    const lenBuf = Buffer.alloc(2);
                    lenBuf.writeUInt16BE(query.length, 0);
                    client.write(Buffer.concat([lenBuf, query]));
                });

                client.on('data', (data) => {
                    chunks.push(data);
                    const total = Buffer.concat(chunks);
                    if (expectedLen === -1 && total.length >= 2) {
                        expectedLen = total.readUInt16BE(0);
                    }
                    if (expectedLen !== -1 && total.length >= 2 + expectedLen) {
                        clearTimeout(timeout);
                        client.destroy();
                        resolve(total.subarray(2, 2 + expectedLen));
                    }
                });

                client.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

            const decoded = dnsPacket.decode(responseBuf);
            assert.equal(decoded.id, 202);
            assert.equal(decoded.answers?.length, 1);
            assert.equal(decoded.answers[0].data, '10.20.30.50');
        } finally {
            await server.stop();
        }
    });
});
