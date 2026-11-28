// `pnpm build` writes the whole site to out/, which the deploy uploads as it is (see
// .github/workflows/azure-deploy.yml), so out/ must hold everything the pages load and nothing else.

import { test, inject } from 'vite-plus/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOOKMARKLET_FILE } from '../tools/bundles.ts';
import { writeSite } from '../tools/site.ts';

const root = path.resolve(import.meta.dirname, '..');
const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const siteBundles = () => new Map(Object.entries(inject('siteBundles')));

function filesUnder(directory: string): string[] {
    return fs
        .readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .sort();
}

function localReferences(html: string): string[] {
    return [...html.matchAll(/(?<![.\w])(?:src|href)\s*=\s*["']([^"']+)["']/g)]
        .map(match => match[1])
        .filter(reference => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference))
        .map(reference => decodeURI(reference.split(/[?#]/)[0]).replace(/^\//, ''))
        .filter(reference => reference.length);
}

// A new directory for a build, removed when the test ends.
async function withOutDir(run: (outDir: string) => Promise<void>): Promise<void> {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cheesefork-site-'));
    try {
        await run(path.join(parent, 'out'));
    } finally {
        fs.rmSync(parent, { recursive: true, force: true });
    }
}

test('the build writes every page, and every file that the pages load, to out/', async () => {
    await withOutDir(async outDir => {
        const bundles = siteBundles();
        const written = await writeSite(outDir, bundles);
        assert.deepEqual(written, filesUnder(outDir), 'returns the files it wrote');
        for (const page of pages) {
            assert.ok(fs.existsSync(path.join(outDir, page)), page);
            for (const reference of localReferences(fs.readFileSync(path.join(root, page), 'utf8'))) {
                assert.ok(fs.existsSync(path.join(outDir, reference)), page + ' loads ' + reference);
            }
        }
        for (const [file, text] of bundles) {
            assert.ok(fs.readFileSync(path.join(outDir, file), 'utf8') === text, file + ' is written as built');
        }
        // Loaded by the pages at run time rather than by a tag.
        for (const file of [
            'locales/en.js',
            'locales/he.js',
            'locales/ar.js',
            'data/semesters.js',
            'icons/site.webmanifest'
        ]) {
            assert.ok(fs.existsSync(path.join(outDir, file)), file);
        }
    });
}, 60000);

test('the sharing script is at the root of the site, where the bookmarklet loads it', async () => {
    await withOutDir(async outDir => {
        await writeSite(outDir, siteBundles());
        assert.match(
            fs.readFileSync(path.join(outDir, BOOKMARKLET_FILE), 'utf8'),
            /jsSHA/,
            'with the license of jsSHA'
        );
    });
}, 60000);

test('out/ holds the Azure Static Web Apps configuration, which keeps the headers of GitHub Pages', async () => {
    await withOutDir(async outDir => {
        await writeSite(outDir, siteBundles());
        const config = JSON.parse(fs.readFileSync(path.join(outDir, 'staticwebapp.config.json'), 'utf8'));
        // Other sites read the site's files, as they could from GitHub Pages.
        assert.equal(config.globalHeaders['Access-Control-Allow-Origin'], '*');
        assert.equal(config.mimeTypes['.webmanifest'], 'application/manifest+json');
    });
}, 60000);

test("out/ holds none of the sources, tooling or the repository's own files", async () => {
    await withOutDir(async outDir => {
        const written = await writeSite(outDir, siteBundles());
        const topLevel = [...new Set(written.map(file => file.split('/')[0]))].sort();
        for (const unwanted of [
            'src',
            'tests',
            'tools',
            'functions',
            'node_modules',
            'ci',
            'docs',
            '.github',
            'package.json',
            'pnpm-lock.yaml',
            'vite.config.ts',
            'tsconfig.json',
            'README.md',
            'firebase.json'
        ]) {
            assert.ok(!topLevel.includes(unwanted), unwanted + ' is not deployed');
        }
        assert.deepEqual(
            written.filter(file => file.endsWith('.ts')),
            [],
            'no TypeScript'
        );
    });
}, 60000);

test('the build replaces an earlier build', async () => {
    await withOutDir(async outDir => {
        fs.mkdirSync(path.join(outDir, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(outDir, 'dist', 'removed-bundle.js'), 'stale');
        fs.writeFileSync(path.join(outDir, 'index.html'), 'stale');
        await writeSite(outDir, siteBundles());
        assert.ok(
            !fs.existsSync(path.join(outDir, 'dist', 'removed-bundle.js')),
            'a file of an earlier build is removed'
        );
        assert.equal(
            fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'),
            fs.readFileSync(path.join(root, 'index.html'), 'utf8')
        );
    });
}, 60000);

test('the build never replaces the repository or a directory that holds it', async () => {
    for (const outDir of [root, path.dirname(root), path.parse(root).root]) {
        await assert.rejects(writeSite(outDir, siteBundles()), /out of the repository|holds the repository/, outDir);
    }
    assert.ok(fs.existsSync(path.join(root, 'package.json')), 'the repository is untouched');
});
