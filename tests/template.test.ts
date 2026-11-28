import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { createPage, loadModule } from './helpers.ts';

function templates() {
    const dom = createPage('index.html', 'en');
    return {
        window: dom.window,
        render: loadModule<typeof import('../src/lib/template.ts')>(dom.window, 'src/lib/template.ts').render
    };
}

test('render escapes {{values}}', () => {
    const { render } = templates();
    assert.equal(
        render('<b title="{{a}}">{{a}}</b>', { a: '<i>"x" & \'y\'</i>' }),
        '<b title="&lt;i&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/i&gt;">&lt;i&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/i&gt;</b>'
    );
});

test('render inserts {{{values}}} as HTML', () => {
    const { render } = templates();
    assert.equal(render('<div>{{{rows}}}</div>', { rows: '<p>1</p><p>2</p>' }), '<div><p>1</p><p>2</p></div>');
});

test('render inserts escaped translations with {{t:key}}', () => {
    const { window, render } = templates();
    assert.equal(
        render('<span>{{t:shell.loading}}</span>', {}),
        '<span>' + window.CheeseI18n.t('shell.loading') + '</span>'
    );
    assert.equal(render('{{t:shell.loading}}'), window.CheeseI18n.t('shell.loading'));
});

test('render keeps zero, false and repeated values', () => {
    const { render } = templates();
    assert.equal(render('{{n}}/{{n}}/{{f}}', { n: 0, f: false }), '0/0/false');
});

test('render rejects a missing, null or undefined value', () => {
    const { render } = templates();
    assert.throws(() => render('{{missing}}', {}), /missing/);
    assert.throws(() => render('{{{missing}}}', { missing: null }), /missing/);
    assert.throws(() => render('{{a}}', { a: undefined }), /\ba\b/);
});

test('render leaves other braces alone', () => {
    const { render } = templates();
    assert.equal(render('a { b } {c} {{ d }}', {}), 'a { b } {c} {{ d }}');
});

test('render removes line breaks and the indentation around them, keeping spaces within a line', () => {
    const { render } = templates();
    assert.equal(
        render('<ul>\n    <li>{{a}} <b>x</b></li>\n    <li>\n        y\n    </li>\n</ul>\n', { a: 1 }),
        '<ul><li>1 <b>x</b></li><li>y</li></ul>'
    );
});
