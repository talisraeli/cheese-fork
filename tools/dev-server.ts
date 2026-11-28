// `vp dev`: serves the site as GitHub Pages does, except that its bundles are built from src/ as
// they're requested, the way `vp build` builds them, and the page reloads when a source changes.
// The bundles are classic scripts, so a change reloads the page rather than replacing modules.

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite-plus';
import { BUNDLES, bundle } from './bundles.ts';

const root = path.resolve(import.meta.dirname, '..');

// The bundles built since the sources last changed, by file. A request while one builds waits
// for the same build. A build that started before a change goes only to its own requests, and a
// failed build is built again on the next request.
export function createBundleCache(build: (file: string) => Promise<string>) {
    const builds = new Map<string, Promise<string>>();
    return {
        get(file: string): Promise<string> {
            let built = builds.get(file);
            if (!built) {
                const started = build(file);
                built = started;
                builds.set(file, started);
                started.catch(() => {
                    if (builds.get(file) === started) {
                        builds.delete(file);
                    }
                });
            }
            return built;
        },
        clear(): void {
            builds.clear();
        }
    };
}

// The changes that the page shows once it reloads, and whether they change the bundles.
function changeOf(file: string): { reload: boolean; rebuild: boolean } {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const rebuild = relative.startsWith('src/');
    const reload = rebuild || /^(locales|data|modules)\//.test(relative) || /^[^/]+\.html$/.test(relative);
    return { reload, rebuild };
}

// The pages' scripts and stylesheets are classic scripts and plain stylesheets, which Vite would
// transform as modules, so they're served as they are, like GitHub Pages serves them.
const AS_IS = new Map([
    ['.js', 'text/javascript'],
    ['.css', 'text/css'],
    ['.json', 'application/json'],
    ['.map', 'application/json']
]);

// The file in the root that a request path names to serve as it is, if any: not Vite's own
// paths, dependencies or hidden files, and nothing outside the root.
export function fileServedAsIs(requestPath: string): string | null {
    let decoded: string;
    try {
        decoded = decodeURIComponent(requestPath);
    } catch {
        return null;
    }
    const segments = decoded.split('/').filter(Boolean);
    if (
        !AS_IS.has(path.extname(decoded)) ||
        segments.some(
            segment =>
                segment.startsWith('.') ||
                segment.startsWith('@') ||
                segment === 'node_modules' ||
                segment.includes('\\')
        )
    ) {
        return null;
    }
    const file = path.join(root, ...segments);
    if (path.relative(root, file).startsWith('..')) {
        return null;
    }
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}

export function servedBundles(): Plugin {
    const entries = new Map(BUNDLES.map(entry => ['/' + entry.file, entry]));
    return {
        name: 'cheesefork:served-bundles',
        apply: 'serve',
        configureServer(server) {
            const cache = createBundleCache(file => bundle(BUNDLES.find(entry => entry.file === file)!));
            server.watcher.on('all', (event, file) => {
                const { reload, rebuild } = changeOf(file);
                if (rebuild) {
                    cache.clear();
                }
                if (reload) {
                    server.ws.send({ type: 'full-reload' });
                }
            });
            // Before Vite's own middlewares, which would serve the committed dist/.
            server.middlewares.use((request, response, next) => {
                const requestPath = (request.url || '').split('?')[0];
                const entry = entries.get(requestPath);
                if (!entry) {
                    const file =
                        request.method === 'GET' || request.method === 'HEAD' ? fileServedAsIs(requestPath) : null;
                    if (!file) {
                        next();
                        return;
                    }
                    response.setHeader('Content-Type', AS_IS.get(path.extname(file)) + '; charset=utf-8');
                    response.setHeader('Cache-Control', 'no-store');
                    response.end(request.method === 'HEAD' ? undefined : fs.readFileSync(file));
                    return;
                }
                cache.get(entry.file).then(
                    text => {
                        response.setHeader(
                            'Content-Type',
                            (entry.file.endsWith('.css') ? 'text/css' : 'text/javascript') + '; charset=utf-8'
                        );
                        response.setHeader('Cache-Control', 'no-store');
                        response.end(text);
                    },
                    (error: Error) => {
                        server.config.logger.error(entry.file + ': ' + error.message, { error });
                        response.statusCode = 500;
                        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                        response.end(entry.file + ' failed to build:\n' + error.message);
                    }
                );
            });
        }
    };
}
