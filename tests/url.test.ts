import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { createPage, loadModule } from './helpers.ts';

function url() {
    return loadModule<typeof import('../src/lib/url.ts')>(createPage('index.html', 'en').window, 'src/lib/url.ts');
}

test('getParameterByName reads a parameter, empty or missing', () => {
    const { getParameterByName } = url();
    assert.equal(getParameterByName('semester', 'https://x.test/?a=1&semester=202601'), '202601');
    assert.equal(getParameterByName('uid', 'https://x.test/?uid&a=1'), '');
    assert.equal(getParameterByName('uid', 'https://x.test/?a=1'), null);
    assert.equal(getParameterByName('q', 'https://x.test/?q=a+b%20c#x'), 'a b c');
});

test('getParameterByName matches names with brackets literally', () => {
    const { getParameterByName } = url();
    assert.equal(getParameterByName('a[b]', 'https://x.test/?a[b]=1'), '1');
    assert.equal(getParameterByName('a[b]', 'https://x.test/?ab=1'), null);
});
