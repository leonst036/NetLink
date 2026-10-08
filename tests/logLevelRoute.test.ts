import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
let handleLogLevelRoute: any;
let GenerateToken: any;

try {
    const routeMod = await import('../backend/relay/dist/http/routes/utilityRoutes.js');
    const tokenMod = await import('../backend/relay/dist/auth/tokenManager.js');
    handleLogLevelRoute = routeMod.handleLogLevelRoute;
    GenerateToken = tokenMod.GenerateToken;
} catch {
    const routeMod = await import('../backend/relay/http/routes/utilityRoutes.ts');
    const tokenMod = await import('../backend/relay/auth/tokenManager.ts');
    handleLogLevelRoute = routeMod.handleLogLevelRoute;
    GenerateToken = tokenMod.GenerateToken;
}

function createMockReqRes(method: string, headers: Record<string, string> = {}, body = '') {
    const req = new EventEmitter() as any;
    req.method = method;
    req.headers = headers;

    let responseStatusCode = 0;
    let responseHeaders: any = {};
    let responseBody = '';

    const res = {
        writeHead(status: number, headers?: any) {
            responseStatusCode = status;
            if (headers) responseHeaders = headers;
        },
        end(chunk?: string) {
            if (chunk) responseBody += chunk;
        }
    } as any;

    const sendBody = () => {
        setImmediate(() => {
            if (body) {
                req.emit('data', Buffer.from(body));
            }
            req.emit('end');
        });
    };

    return {
        req,
        res,
        sendBody,
        getResponse: () => ({
            statusCode: responseStatusCode,
            headers: responseHeaders,
            body: responseBody ? JSON.parse(responseBody) : null
        })
    };
}

describe('handleLogLevelRoute authentication', () => {
    const secret = process.env.JWT_SECRET || 'default_secret';
    const validToken = GenerateToken({ userId: 'test-user', role: 'admin' }, secret);

    it('rejects unauthenticated GET requests with 401', async () => {
        const { req, res, getResponse } = createMockReqRes('GET');
        const url = new URL('http://localhost/api/log-level');

        await handleLogLevelRoute(url, req, res);
        const response = getResponse();

        assert.equal(response.statusCode, 401);
        assert.equal(response.body.error, 'Unauthorized');
    });

    it('rejects unauthenticated POST requests with 401', async () => {
        const { req, res, getResponse } = createMockReqRes('POST', {}, JSON.stringify({ logLevel: 4 }));
        const url = new URL('http://localhost/api/log-level');

        await handleLogLevelRoute(url, req, res);
        const response = getResponse();

        assert.equal(response.statusCode, 401);
        assert.equal(response.body.error, 'Unauthorized');
    });

    it('rejects requests with invalid token', async () => {
        const { req, res, getResponse } = createMockReqRes('GET', {
            authorization: 'Bearer invalid.token.value'
        });
        const url = new URL('http://localhost/api/log-level');

        await handleLogLevelRoute(url, req, res);
        const response = getResponse();

        assert.equal(response.statusCode, 401);
        assert.equal(response.body.error, 'Unauthorized');
    });

    it('handles OPTIONS preflight request with 204', async () => {
        const { req, res, getResponse } = createMockReqRes('OPTIONS');
        const url = new URL('http://localhost/api/log-level');

        await handleLogLevelRoute(url, req, res);
        const response = getResponse();

        assert.equal(response.statusCode, 204);
    });

    it('allows authenticated GET request and returns current logLevel', async () => {
        process.env.LOG_LEVEL = '4';
        const { req, res, getResponse } = createMockReqRes('GET', {
            authorization: `Bearer ${validToken}`
        });
        const url = new URL('http://localhost/api/log-level');

        await handleLogLevelRoute(url, req, res);
        const response = getResponse();

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.logLevel, '4');
    });

    it('allows authenticated POST request to update logLevel', async () => {
        const { req, res, sendBody, getResponse } = createMockReqRes(
            'POST',
            {
                authorization: `Bearer ${validToken}`,
                'content-type': 'application/json'
            },
            JSON.stringify({ logLevel: 2 })
        );
        const url = new URL('http://localhost/api/log-level');

        const promise = handleLogLevelRoute(url, req, res);
        sendBody();
        await promise;

        // Allow microtasks to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        const response = getResponse();
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.success, true);
        assert.equal(process.env.LOG_LEVEL, '2');
    });
});
