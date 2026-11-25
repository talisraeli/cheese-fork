'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, load } = require('./helpers.cjs');

const gtmSelector = 'script[src*="googletagmanager.com"]';

function openPage(file, { language = 'en', storedChoice = null } = {}) {
    const dom = createPage(file, language);
    if (storedChoice) {
        dom.window.localStorage.setItem('cheesefork.analyticsConsent', storedChoice);
    }
    load(dom.window, 'cookie-consent.js');
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    return dom;
}

function commands(window) {
    return Array.from(window.dataLayer, entry => Array.from(entry));
}

for (const file of ['index.html', 'share-histograms.html', 'course-widget-histograms.html']) {
    test(file + ': analytics are not loaded from the page markup', () => {
        const dom = openPage(file);
        try {
            assert.equal(dom.window.document.querySelector(gtmSelector), null);
            dom.window.gtag('event', 'navbar-guide');
            assert.deepEqual(commands(dom.window), []);
        } finally {
            dom.window.close();
        }
    });
}

for (const language of ['en', 'he', 'ar']) {
    test(language + ': first visit asks for consent in the interface language', () => {
        const dom = openPage('index.html', { language });
        try {
            const { document, CheeseI18n } = dom.window;
            const banner = document.querySelector('.cookie-consent');
            assert.ok(banner);
            assert.equal(banner.getAttribute('role'), 'dialog');
            assert.equal(document.getElementById('cookie-consent-title').textContent, CheeseI18n.t('consent.title'));
            assert.equal(banner.querySelector('[data-cookie-consent="granted"]').textContent, CheeseI18n.t('consent.accept'));
            assert.equal(banner.querySelector('[data-cookie-consent="denied"]').textContent, CheeseI18n.t('consent.decline'));
            assert.notEqual(CheeseI18n.t('consent.message'), 'consent.message');
        } finally {
            dom.window.close();
        }
    });
}

test('allowing analytics loads Google Tag Manager and starts sending events', () => {
    const dom = openPage('index.html');
    try {
        const { window } = dom;
        window.gtag('event', 'before-consent');
        window.document.querySelector('[data-cookie-consent="granted"]').click();

        assert.equal(window.document.querySelector('.cookie-consent'), null);
        assert.equal(window.localStorage.getItem('cheesefork.analyticsConsent'), 'granted');
        assert.equal(window.document.querySelectorAll(gtmSelector).length, 1);

        window.gtag('event', 'after-consent');
        const sent = commands(window);
        assert.deepEqual(sent[0].slice(0, 2), ['consent', 'default']);
        assert.equal(sent[0][2].analytics_storage, 'granted');
        assert.ok(sent.some(entry => entry[1] === 'after-consent'));
        assert.ok(!sent.some(entry => entry[1] === 'before-consent'));
    } finally {
        dom.window.close();
    }
});

test('declining analytics keeps Google Tag Manager unloaded and drops events', () => {
    const dom = openPage('index.html');
    try {
        const { window } = dom;
        window.document.querySelector('[data-cookie-consent="denied"]').click();

        assert.equal(window.document.querySelector('.cookie-consent'), null);
        assert.equal(window.localStorage.getItem('cheesefork.analyticsConsent'), 'denied');
        window.gtag('event', 'navbar-guide');
        assert.equal(window.document.querySelector(gtmSelector), null);
        assert.deepEqual(commands(window), []);
    } finally {
        dom.window.close();
    }
});

test('a stored choice is remembered without asking again', () => {
    for (const choice of ['granted', 'denied']) {
        const dom = openPage('index.html', { storedChoice: choice });
        try {
            const { document } = dom.window;
            assert.equal(document.querySelector('.cookie-consent'), null);
            assert.equal(document.querySelectorAll(gtmSelector).length, choice === 'granted' ? 1 : 0);
        } finally {
            dom.window.close();
        }
    }
});

test('the footer link reopens the choice, and withdrawing consent stops analytics', () => {
    const dom = openPage('index.html', { storedChoice: 'granted' });
    try {
        const { window } = dom;
        const { document } = window;
        document.cookie = '_ga=GA1.1.123; path=/';
        document.cookie = '_ga_ABC=GS1.1.123; path=/';
        document.cookie = 'unrelated=1; path=/';

        document.querySelector('[data-cookie-settings]').click();
        assert.ok(document.querySelector('.cookie-consent'));
        document.querySelector('[data-cookie-consent="denied"]').click();

        assert.equal(window.CheeseCookieConsent.isGranted(), false);
        assert.equal(JSON.stringify(commands(window).pop()), JSON.stringify(['consent', 'update', { analytics_storage: 'denied' }]));
        const before = window.dataLayer.length;
        window.gtag('event', 'after-withdrawal');
        assert.equal(window.dataLayer.length, before);
        assert.doesNotMatch(document.cookie, /_ga/);
        assert.match(document.cookie, /unrelated=1/);
    } finally {
        dom.window.close();
    }
});

test('the embedded histogram widget never shows the banner but honors a stored choice', () => {
    for (const choice of [null, 'granted']) {
        const dom = openPage('course-widget-histograms.html', { storedChoice: choice });
        try {
            const { document } = dom.window;
            assert.equal(document.querySelector('.cookie-consent'), null);
            assert.equal(document.querySelectorAll(gtmSelector).length, choice ? 1 : 0);
        } finally {
            dom.window.close();
        }
    }
});
