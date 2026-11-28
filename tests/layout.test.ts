import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));

// Public URLs that other sites and the bookmarklet load from the site root.
const rootScripts = ['share-histograms.js'];

function localReferences(html: string) {
    return [...html.matchAll(/(?<![.\w])(?:src|href)\s*=\s*["']([^"']+)["']/g)]
        .map(match => match[1])
        .filter(reference => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference))
        .map(reference => decodeURI(reference.split(/[?#]/)[0]))
        .filter(reference => reference.length);
}

test('the site has HTML pages to check', () => {
    assert.ok(pages.includes('index.html'));
    assert.ok(pages.length >= 4);
});

for (const page of pages) {
    test(page + ' references only files that exist', () => {
        const references = localReferences(fs.readFileSync(path.join(root, page), 'utf8'));
        assert.ok(references.length, page + ' has no local references');
        for (const reference of references) {
            const file = path.join(root, reference.replace(/^\//, ''));
            assert.ok(fs.existsSync(file), page + ' references a missing file: ' + reference);
        }
    });
}

test('scripts and stylesheets live in src/ and dist/, not the root', () => {
    const loose = fs.readdirSync(root).filter(file => /\.(js|css)$/.test(file) && !rootScripts.includes(file));
    assert.deepEqual(loose, []);
});

test('the pages load the built bundles, not the sources', () => {
    for (const page of pages) {
        const references = localReferences(fs.readFileSync(path.join(root, page), 'utf8'));
        assert.deepEqual(
            references.filter(reference => reference.startsWith('src/')),
            [],
            page
        );
        assert.ok(
            references.some(reference => reference.startsWith('dist/')),
            page
        );
    }
});

test('documents live in docs/, and only the README stays at the root', () => {
    const rootDocs = fs.readdirSync(root).filter(file => file.endsWith('.md'));
    assert.deepEqual(rootDocs, ['README.md']);
    assert.ok(fs.existsSync(path.join(root, 'docs')), 'docs/');
});

test("links to this repository's files on GitHub point to files that exist", () => {
    const repoUrl =
        /https:\/\/(?:github\.com\/talisraeli\/cheese-fork\/blob|raw\.githubusercontent\.com\/talisraeli\/cheese-fork)\/gh-pages\/([^\s'")#?]+)/g;
    const sources = [
        ...pages,
        'README.md',
        ...fs
            .readdirSync(path.join(root, 'src'), { recursive: true, encoding: 'utf8' })
            .filter(file => /\.(js|ts|html)$/.test(file))
            .map(file => path.join('src', file))
    ];
    const links = [];
    for (const file of sources) {
        for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(repoUrl)) {
            links.push({ file, target: match[1] });
        }
    }
    assert.ok(links.length >= 8, 'found ' + links.length + ' links');
    const missing = links
        .filter(link => !fs.existsSync(path.join(root, link.target)))
        .map(link => link.file + ' -> ' + link.target);
    assert.deepEqual(missing, []);
});
