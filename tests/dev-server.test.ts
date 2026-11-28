import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite-plus';
import { BUNDLES, bundle } from '../tools/bundles.ts';
import { createBundleCache, fileServedAsIs } from '../tools/dev-server.ts';

const root = path.resolve(import.meta.dirname, '..');

// Runs the dev server of vite.config.ts on a free port while run runs.
async function withServer(run: (get: (url: string) => Promise<Response>) => Promise<void>) {
    const server: ViteDevServer = await createServer({
        root,
        configFile: path.join(root, 'vite.config.ts'),
        logLevel: 'silent',
        server: { port: 0, strictPort: false, open: false }
    });
    try {
        await server.listen();
        const { port } = server.httpServer!.address() as AddressInfo;
        await run(url => fetch('http://localhost:' + port + url));
    } finally {
        await server.close();
    }
}

test('the dev server serves each bundle as the build makes it', async () => {
    await withServer(async get => {
        for (const entry of BUNDLES) {
            const response = await get('/' + entry.file + '?v=1');
            assert.equal(response.status, 200, entry.file);
            assert.match(
                response.headers.get('content-type') || '',
                entry.file.endsWith('.css') ? /^text\/css/ : /^text\/javascript/,
                entry.file
            );
            assert.ok((await response.text()) === (await bundle(entry)), entry.file + ' is served as built');
        }
    });
}, 120000);

test("the dev server serves the pages' own scripts and the libraries as they are", async () => {
    await withServer(async get => {
        for (const file of [
            'modules/fullcalendar/lib/jquery.min.js',
            'modules/jssha/sha1.js',
            'locales/en.js',
            'data/semesters.js'
        ]) {
            const response = await get('/' + file);
            assert.equal(response.status, 200, file);
            assert.ok(
                (await response.text()) === fs.readFileSync(path.join(root, file), 'utf8'),
                file + ' is served unchanged'
            );
        }
        const page = await (await get('/index.html')).text();
        // Vite makes the page's paths absolute, which is the same, as the pages are at the root.
        assert.match(page, /<script src="\/?dist\/cheesefork\.js"/, 'the page loads the bundles as on the site');
        assert.match(page, /\/@vite\/client/, 'and reloads when the sources change');
    });
}, 120000);

test('the dev server serves only files in the root as they are', () => {
    assert.equal(fileServedAsIs('/locales/en.js'), path.join(root, 'locales', 'en.js'));
    assert.equal(
        fileServedAsIs('/modules/fullcalendar/fullcalendar.min.css'),
        path.join(root, 'modules', 'fullcalendar', 'fullcalendar.min.css')
    );
    for (const requestPath of [
        '/../package.json',
        '/%2e%2e/package.json',
        '/locales/..%2f..%2fpackage.json',
        '/locales/..%5c..%5cpackage.json',
        '/node_modules/jquery/dist/jquery.js',
        '/@vite/client',
        '/.git/config',
        '/locales/missing.js',
        '/index.html',
        '/src/lib/url.ts',
        '/%e0%a4%a'
    ]) {
        assert.equal(fileServedAsIs(requestPath), null, requestPath);
    }
});

// A build that the test finishes, or fails, when it chooses.
function controlledBuilds() {
    const started: { file: string; finish: (text: string) => void; fail: (error: Error) => void }[] = [];
    const build = (file: string) => new Promise<string>((finish, fail) => started.push({ file, finish, fail }));
    return { started, build };
}

test('the bundle cache builds a bundle once for every request until a source changes', async () => {
    const { started, build } = controlledBuilds();
    const cache = createBundleCache(build);
    const first = cache.get('dist/i18n.js');
    const second = cache.get('dist/i18n.js');
    assert.equal(started.length, 1, 'requests while building wait for the same build');
    started[0].finish('one');
    assert.deepEqual([await first, await second], ['one', 'one']);
    assert.equal(await cache.get('dist/i18n.js'), 'one');
    assert.equal(started.length, 1);

    cache.clear();
    const third = cache.get('dist/i18n.js');
    assert.equal(started.length, 2, 'a change builds it again');
    started[1].finish('two');
    assert.equal(await third, 'two');
    assert.equal(started.length, 2, 'only once per bundle');
    cache.get('dist/cheesefork.js');
    assert.deepEqual(
        started.map(entry => entry.file),
        ['dist/i18n.js', 'dist/i18n.js', 'dist/cheesefork.js']
    );
});

test('a build that started before a change is not kept, and a failed build is retried', async () => {
    const { started, build } = controlledBuilds();
    const cache = createBundleCache(build);
    const stale = cache.get('dist/i18n.js');
    cache.clear();
    const fresh = cache.get('dist/i18n.js');
    started[0].finish('before the change');
    started[1].finish('after the change');
    assert.equal(await stale, 'before the change', 'its own requests still get it');
    assert.equal(await fresh, 'after the change');
    assert.equal(await cache.get('dist/i18n.js'), 'after the change');
    assert.equal(started.length, 2);

    cache.clear();
    const failing = cache.get('dist/i18n.js');
    started[2].fail(new Error('syntax error'));
    await assert.rejects(failing, /syntax error/);
    const retried = cache.get('dist/i18n.js');
    assert.equal(started.length, 4, 'a failure is not cached');
    started[3].finish('fixed');
    assert.equal(await retried, 'fixed');

    // A failure of a build from before a change doesn't drop the build after it.
    const old = cache.get('dist/cheesefork.js');
    cache.clear();
    const current = cache.get('dist/cheesefork.js');
    started[4].fail(new Error('old'));
    await assert.rejects(old, /old/);
    assert.equal(cache.get('dist/cheesefork.js'), current);
    assert.equal(started.length, 6);
    started[5].finish('current');
    assert.equal(await current, 'current');
});
