'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, read } = require('./helpers.cjs');

function catalogs() {
    const result = {};
    for (const locale of ['he', 'en', 'ar']) {
        vm.runInNewContext(read('locales/' + locale + '.js'), {
            CheeseI18n: {
                addMessages(language, messages) {
                    assert.equal(language, locale);
                    result[locale] = { ...result[locale], ...messages };
                }
            }
        });
    }
    return result;
}

function firstPartySources(directory = root) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return entry.name === 'components' || directory.includes(path.sep + 'components') ? firstPartySources(file) : [];
        }
        return /\.(js|html)$/.test(entry.name) && entry.name !== 'dark-mode-toggle-stylesheets-loader.min.js' ? [file] : [];
    });
}

test('catalogs have matching keys, interpolation parameters, and English text', () => {
    const { he, en, ar } = catalogs();
    assert.ok(Object.keys(en).length > 100);
    assert.deepEqual(Object.keys(en).sort(), Object.keys(he).sort());
    assert.deepEqual(Object.keys(ar).sort(), Object.keys(he).sort());
    const parameters = value => [...value.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort();
    for (const key of Object.keys(en)) {
        for (const [locale, catalog] of [['en', en], ['ar', ar]]) {
            assert.equal(typeof catalog[key], 'string', key + ' (' + locale + ')');
            assert.ok(catalog[key].trim().length, key + ' (' + locale + ')');
            assert.doesNotMatch(catalog[key], /[\u0590-\u05ff]/, key + ' (' + locale + ')');
            assert.deepEqual(parameters(catalog[key]), parameters(he[key]), key + ' (' + locale + ')');
        }
    }
});

test('the Hebrew catalog has no English text, except names and shortcuts', () => {
    const { he } = catalogs();
    // Product names, abbreviations and keyboard shortcuts stay as they are in every language.
    const names = /CheeseFork|API|AI|iCalendar|Google Calendar|Google|Discord|WhatsApp|Telegram|Facebook|GitHub|Chrome|Firefox|Console|Enter|Ctrl|Shift|URL|WebCourse|Outlook|Claude|ChatGPT|Mac|Apple|Firebase/g;
    const english = Object.keys(he).filter(key =>
        /[A-Za-z]{2,}/.test(he[key].replace(/\{[^{}]+\}/g, '').replace(names, '')));
    assert.deepEqual(english, []);
});

test('the Arabic catalog is in Arabic, with shortcuts kept left to right', () => {
    const { ar, en } = catalogs();
    // Values made only of names, codes and placeholders are the same in every language.
    const translatable = Object.keys(en).filter(key => /[a-z]{3,}/i.test(en[key].replace(/\{[^{}]+\}/g, '')) &&
        !['shell.nav.api', 'shell.crawler.day'].includes(key));
    const untranslated = translatable.filter(key => !/[\u0600-\u06ff]/.test(ar[key]));
    assert.deepEqual(untranslated, []);
    for (const key of ['shell.nav.undoTooltip', 'shell.nav.redoTooltip']) {
        assert.match(ar[key], /\u2066Ctrl\+[^\u2069]+\u2069/, key);
    }
});

test('every explicit message key in first-party UI exists in both catalogs', () => {
    const messages = catalogs();
    const used = new Set();
    for (const file of firstPartySources()) {
        const source = fs.readFileSync(file, 'utf8');
        const expressions = [
            /CheeseI18n\.t\(\s*['"]([^'"]+)['"]\s*(?=[,)])/g,
            /data-i18n(?:-(?:title|placeholder|alt|aria-label|content|data-intro))?=['"]([^'"]+)['"]/g
        ];
        if (file.endsWith('course-feedback.js')) {
            for (const match of source.matchAll(/\b(?:t|translatedHtml)\(\s*['"]([^'"]+)['"]\s*(?=[,)])/g)) {
                used.add('feedback.' + match[1]);
            }
        } else if (file.endsWith('histogram-browser.js')) {
            for (const match of source.matchAll(/\b[th]\(\s*['"]([^'"]+)['"]\s*(?=[,)])/g)) {
                used.add(match[1]);
            }
        }
        for (const expression of expressions) {
            for (const match of source.matchAll(expression)) {
                used.add(match[1]);
                for (const locale of ['he', 'en', 'ar']) {
                    assert.ok(Object.hasOwn(messages[locale], match[1]), path.relative(root, file) + ': ' + match[1] + ' (' + locale + ')');
                }
            }
        }
    }
    for (const key of used) {
        for (const locale of ['he', 'en', 'ar']) {
            assert.ok(Object.hasOwn(messages[locale], key), key + ' (' + locale + ')');
        }
    }
    assert.ok(used.size > 100);
});
