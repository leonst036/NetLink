import http from 'http';
import { URL } from 'url';

export type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL) => void;

interface Route {
    method: string;
    path: string;
    handler: RouteHandler;
}

export class Router {
    private routes: Route[] = [];

    public get(path: string, handler: RouteHandler) {
        this.add('GET', path, handler);
    }

    public post(path: string, handler: RouteHandler) {
        this.add('POST', path, handler);
    }

    public put(path: string, handler: RouteHandler) {
        this.add('PUT', path, handler);
    }

    public delete(path: string, handler: RouteHandler) {
        this.add('DELETE', path, handler);
    }

    public all(path: string, handler: RouteHandler) {
        this.add('ALL', path, handler);
    }

    private add(method: string, path: string, handler: RouteHandler) {
        this.routes.push({ method, path, handler });
    }

    public handle(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL): boolean {
        const reqMethod = req.method ? req.method.toUpperCase() : 'GET';
        
        for (const route of this.routes) {
            if ((route.method === 'ALL' || route.method === reqMethod) && route.path === parsedUrl.pathname) {
                route.handler(req, res, parsedUrl);
                return true;
            }
        }
        return false;
    }
}
