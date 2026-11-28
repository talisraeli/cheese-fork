import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { siteFile } from './helpers.ts';

const source = siteFile('dist/i18n.js');

type Listener = (this: unknown, event?: unknown) => void;

interface Listening {
    listeners: Record<string, Listener[]>;
}

// Just enough of an element for the runtime: attributes, children, text, a value and listeners.
// Assigning HTML throws, since translations must never be parsed as HTML.
class FakeElement implements Listening {
    readonly nodeType = 1;
    readonly tagName: string;
    readonly attributes: Record<string, string>;
    readonly children: FakeElement[];
    textContent = 'Original text';
    value?: string;
    readonly listeners: Record<string, Listener[]> = {};

    constructor(tagName: string, attributes: Record<string, string> = {}, children: FakeElement[] = []) {
        this.tagName = tagName.toUpperCase();
        this.attributes = attributes;
        this.children = children;
    }

    set innerHTML(html: string) {
        throw new Error('Translations must never be assigned as HTML: ' + html);
    }

    getAttribute(name: string): string | null {
        return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
    }

    setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    hasAttribute(name: string): boolean {
        return Object.hasOwn(this.attributes, name);
    }

    addEventListener(this: Listening, name: string, listener: Listener): void {
        this.listeners[name] = this.listeners[name] || [];
        this.listeners[name].push(listener);
    }

    // Supports only attribute selectors, optionally of select elements, separated by commas.
    querySelectorAll(selector: string): FakeElement[] {
        const selectors = selector.split(',');
        const result: FakeElement[] = [];

        function visit(element: FakeElement) {
            const matches = selectors.some(part => {
                const match = /^\s*(select)?\[([^\]]+)\]\s*$/.exec(part);
                return match && (!match[1] || element.tagName === 'SELECT') && element.hasAttribute(match[2]);
            });
            if (matches) {
                result.push(element);
            }
            element.children.forEach(visit);
        }

        this.children.forEach(visit);
        return result;
    }
}

interface RuntimeOptions {
    href?: string;
    children?: FakeElement[];
    readyState?: string;
    storedLocale?: string;
    blockStorage?: boolean;
}

function loadRuntime(options: RuntimeOptions = {}) {
    const href = options.href || 'https://example.test/index.html';
    const documentElement = new FakeElement('html', {}, options.children);
    const document = {
        documentElement: documentElement,
        readyState: options.readyState || 'loading',
        listeners: {} as Record<string, Listener[]>,
        addEventListener: FakeElement.prototype.addEventListener,
        querySelectorAll: (selector: string) => documentElement.querySelectorAll(selector)
    };
    const storage: Record<string, string | undefined> = {};
    const navigation: string[] = [];
    const query = href.split('#')[0].split('?')[1] || '';
    const window: { location: object; CheeseI18n?: CheeseI18nApi } = {
        location: {
            href: href,
            search: query ? '?' + query : '',
            assign: (nextHref: string) => {
                navigation.push(nextHref);
            }
        }
    };
    storage['cheesefork.language'] = options.storedLocale;
    Object.defineProperty(window, 'localStorage', {
        get: () => {
            if (options.blockStorage) {
                throw new Error('Storage is blocked');
            }
            return {
                getItem: (key: string) => storage[key] || null,
                setItem: (key: string, value: string) => {
                    storage[key] = value;
                }
            };
        }
    });
    vm.runInNewContext(source, { window: window, document: document });
    return {
        api: window.CheeseI18n!,
        document: document,
        html: documentElement,
        storage: storage,
        navigation: navigation,
        ready: () => {
            (document.listeners.DOMContentLoaded || []).forEach(listener => listener());
        }
    };
}

test('sets Hebrew language and direction before DOM ready by default', function () {
    const runtime = loadRuntime();
    assert.equal(runtime.api.getLocale(), 'he');
    assert.equal(runtime.api.isRTL(), true);
    assert.equal(runtime.html.getAttribute('lang'), 'he');
    assert.equal(runtime.html.getAttribute('dir'), 'rtl');
});

test('a supported URL language takes priority over the stored preference', function () {
    const runtime = loadRuntime({ href: 'https://example.test/?schedule=42&lang=en#calendar', storedLocale: 'he' });
    assert.equal(runtime.api.getLocale(), 'en');
    assert.equal(runtime.api.isRTL(), false);
    assert.equal(runtime.html.getAttribute('lang'), 'en');
    assert.equal(runtime.html.getAttribute('dir'), 'ltr');
    assert.equal(loadRuntime({ href: 'https://example.test/?lang=he', storedLocale: 'en' }).api.getLocale(), 'he');
});

test('uses a supported saved preference when the URL has no supported language', function () {
    assert.equal(loadRuntime({ storedLocale: 'en' }).api.getLocale(), 'en');
    assert.equal(loadRuntime({ href: 'https://example.test/?lang=fr', storedLocale: 'en' }).api.getLocale(), 'en');
    assert.equal(
        loadRuntime({ href: 'https://example.test/?lang=%E0%A4%A', storedLocale: 'en' }).api.getLocale(),
        'en'
    );
    assert.equal(loadRuntime({ storedLocale: 'fr' }).api.getLocale(), 'he');
});

test('handles blocked storage at startup and while switching language', function () {
    const runtime = loadRuntime({ blockStorage: true });
    assert.equal(runtime.api.getLocale(), 'he');
    assert.equal(runtime.api.setLocale('en'), true);
    assert.deepEqual(runtime.navigation, ['https://example.test/index.html?lang=en']);
    assert.equal(loadRuntime({ href: 'https://example.test/?lang=en', blockStorage: true }).api.getLocale(), 'en');
});

test('interpolates literal text, retains missing parameters, and falls back predictably', function () {
    const runtime = loadRuntime({ storedLocale: 'en' });
    const inheritedParams = Object.create({ name: 'inherited' });
    const inheritedMessages = Object.create({ inherited: 'must not be registered' });
    inheritedMessages.own = 'Registered';
    runtime.api.addMessages('he', { greeting: 'שלום {name}', fallback: 'עברית' });
    runtime.api.addMessages('en', { greeting: 'Hello {name}, {count} courses for {name}', blank: '' });
    runtime.api.addMessages('en', inheritedMessages);
    runtime.api.addMessages('fr', { ignored: 'ignored' });
    assert.equal(
        runtime.api.t('greeting', { name: '<b>$&</b>', count: 0 }),
        'Hello <b>$&</b>, 0 courses for <b>$&</b>'
    );
    assert.equal(runtime.api.t('greeting', inheritedParams), 'Hello {name}, {count} courses for {name}');
    assert.equal(runtime.api.t('fallback'), 'עברית');
    assert.equal(runtime.api.t('missing'), 'missing');
    assert.equal(runtime.api.t('blank'), '');
    assert.equal(runtime.api.t('own'), 'Registered');
    assert.equal(runtime.api.t('inherited'), 'inherited');
    assert.equal(runtime.api.t('toString'), 'toString');
    assert.equal(runtime.api.t('ignored'), 'ignored');
});

test('switching preserves all other URL bytes, the hash, and unrelated storage', function () {
    const runtime = loadRuntime({
        href: 'https://example.test/path?semester=2026%2B1&%6cang=he&schedule=a%3Db%26c&flag&lang=en#week%2F2'
    });
    runtime.storage.schedule = 'untouched';
    assert.equal(runtime.api.setLocale('en'), true);
    assert.equal(runtime.storage['cheesefork.language'], 'en');
    assert.equal(runtime.storage.schedule, 'untouched');
    assert.deepEqual(runtime.navigation, [
        'https://example.test/path?semester=2026%2B1&lang=en&schedule=a%3Db%26c&flag#week%2F2'
    ]);
});

test('invalid language values cannot change storage or trigger navigation', function () {
    const runtime = loadRuntime({ storedLocale: 'he' });
    assert.equal(runtime.api.setLocale('fr'), false);
    assert.equal(runtime.api.setLocale('en-US'), false);
    assert.equal(runtime.storage['cheesefork.language'], 'he');
    assert.deepEqual(runtime.navigation, []);
});

test('internal links retain locale without losing query parameters or fragments', function () {
    const runtime = loadRuntime({ storedLocale: 'en' });
    assert.equal(
        runtime.api.withLocale('course-widget-comments.html?course=123&semester=2026#opinions'),
        'course-widget-comments.html?course=123&semester=2026&lang=en#opinions'
    );
    assert.equal(runtime.api.withLocale('./?lang=he&schedule=123#calendar'), './?lang=en&schedule=123#calendar');
    assert.equal(runtime.api.withLocale('./#calendar'), './?lang=en#calendar');
});

test('applies only explicitly marked text and attributes without parsing HTML', function () {
    const translated = new FakeElement('span', { 'data-i18n': 'text' });
    const unmarked = new FakeElement('span');
    const input = new FakeElement('input', {
        'data-i18n-title': 'attribute',
        'data-i18n-placeholder': 'attribute',
        'data-i18n-alt': 'attribute',
        'data-i18n-aria-label': 'attribute',
        'data-i18n-content': 'attribute',
        'data-i18n-data-intro': 'attribute'
    });
    const runtime = loadRuntime({ storedLocale: 'en', children: [translated, input, unmarked] });
    const text = '<img src=x onerror=alert(1)> & Hebrew עברית';
    const attribute = '" onfocus="alert(1)';
    runtime.api.addMessages('en', { text: text, attribute: attribute });
    assert.equal(translated.textContent, 'Original text');
    runtime.ready();
    assert.equal(translated.textContent, text);
    assert.equal(unmarked.textContent, 'Original text');
    ['title', 'placeholder', 'alt', 'aria-label', 'content', 'data-intro'].forEach(function (name) {
        assert.equal(input.getAttribute(name), attribute);
    });
    assert.equal(input.hasAttribute('onfocus'), false);
});

test('apply includes its root and binds a language switch once', function () {
    const select = new FakeElement('select', { 'data-language-switch': '' });
    const root = new FakeElement('section', { 'data-i18n-title': 'heading' }, [select]);
    const runtime = loadRuntime({ storedLocale: 'en' });
    runtime.api.addMessages('en', { heading: 'Language' });
    runtime.api.apply(root as unknown as Element);
    runtime.api.apply(root as unknown as Element);
    assert.equal(root.getAttribute('title'), 'Language');
    assert.equal(select.value, 'en');
    assert.equal(select.listeners.change.length, 1);
    select.value = 'he';
    select.listeners.change[0].call(select);
    assert.equal(runtime.storage['cheesefork.language'], 'he');
    assert.deepEqual(runtime.navigation, ['https://example.test/index.html?lang=he']);
});

test('binds existing switches when the runtime loads after DOM ready', function () {
    const select = new FakeElement('select', { 'data-language-switch': '' });
    loadRuntime({ storedLocale: 'en', readyState: 'complete', children: [select] });
    assert.equal(select.value, 'en');
    assert.equal(select.listeners.change.length, 1);
});
