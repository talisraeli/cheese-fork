'use strict';

/* global CheeseI18n */

// Google Analytics (through Google Tag Manager) is loaded only after the visitor allows it.
// Until then, gtag() calls are dropped, so nothing is queued and sent later.
(function (window, document) {
    var storageKey = 'cheesefork.analyticsConsent';
    var gtmUrl = 'https://www.googletagmanager.com/gtm.js?id=GTM-5QHXJDHX';
    var granted = false;
    var scriptLoaded = false;
    var banner = null;

    window.dataLayer = window.dataLayer || [];

    // Google's tags only read commands pushed as an arguments object, not as an array.
    function push() {
        window.dataLayer.push(arguments);
    }

    window.gtag = function () {
        if (granted) {
            window.dataLayer.push(arguments);
        }
    };

    function getStoredChoice() {
        try {
            var value = window.localStorage.getItem(storageKey);
            return value === 'granted' || value === 'denied' ? value : null;
        } catch (e) {
            return null;
        }
    }

    function storeChoice(value) {
        try {
            window.localStorage.setItem(storageKey, value);
        } catch (e) {
            // Without storage, the choice applies to this page view only.
        }
    }

    function enableAnalytics() {
        if (granted) {
            return;
        }
        granted = true;
        push('consent', scriptLoaded ? 'update' : 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        if (!scriptLoaded) {
            scriptLoaded = true;
            push('js', new Date());
            var script = document.createElement('script');
            script.async = true;
            script.src = gtmUrl;
            (document.head || document.documentElement).appendChild(script);
        }
    }

    function deleteAnalyticsCookies() {
        var hostParts = window.location.hostname.split('.');
        var domains = [''];
        var i;
        for (i = 0; i < hostParts.length - 1; i++) {
            domains.push('; domain=.' + hostParts.slice(i).join('.'));
        }
        document.cookie.split(';').forEach(function (cookie) {
            var name = cookie.split('=')[0].replace(/^\s+|\s+$/g, '');
            if (name === '_ga' || name === '_gid' || name === '_gat' || name.indexOf('_ga_') === 0 || name.indexOf('_gat_') === 0) {
                domains.forEach(function (domain) {
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + domain;
                });
            }
        });
    }

    function disableAnalytics() {
        if (granted) {
            push('consent', 'update', { analytics_storage: 'denied' });
            granted = false;
        }
        deleteAnalyticsCookies();
    }

    function hideBanner() {
        if (banner) {
            banner.parentNode.removeChild(banner);
            banner = null;
        }
    }

    function choose(value) {
        storeChoice(value);
        if (value === 'granted') {
            enableAnalytics();
        } else {
            disableAnalytics();
        }
        hideBanner();
    }

    function createButton(className, textKey, value) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm ' + className;
        button.setAttribute('data-cookie-consent', value);
        button.textContent = CheeseI18n.t(textKey);
        button.addEventListener('click', function () {
            choose(value);
        });
        return button;
    }

    function showBanner() {
        if (banner) {
            return;
        }

        banner = document.createElement('div');
        banner.className = 'cookie-consent bg-light border shadow';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-modal', 'false');
        banner.setAttribute('aria-labelledby', 'cookie-consent-title');
        banner.setAttribute('aria-describedby', 'cookie-consent-message');

        var title = document.createElement('h2');
        title.id = 'cookie-consent-title';
        title.className = 'cookie-consent-title';
        title.textContent = CheeseI18n.t('consent.title');

        var message = document.createElement('p');
        message.id = 'cookie-consent-message';
        message.className = 'cookie-consent-message';
        message.textContent = CheeseI18n.t('consent.message') + ' ';

        var privacy = document.createElement('a');
        privacy.href = 'https://github.com/talisraeli/cheese-fork/blob/gh-pages/PRIVACY.md';
        privacy.target = '_blank';
        privacy.rel = 'noopener';
        privacy.textContent = CheeseI18n.t('consent.privacy');
        message.appendChild(privacy);

        var buttons = document.createElement('div');
        buttons.className = 'cookie-consent-buttons';
        buttons.appendChild(createButton('btn-primary', 'consent.accept', 'granted'));
        buttons.appendChild(createButton('btn-outline-secondary', 'consent.decline', 'denied'));

        banner.appendChild(title);
        banner.appendChild(message);
        banner.appendChild(buttons);
        document.body.appendChild(banner);
    }

    function init() {
        var links = document.querySelectorAll('[data-cookie-settings]');
        var i;
        for (i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function (event) {
                event.preventDefault();
                showBanner();
            });
        }

        // Embedded widgets never ask; they follow a choice already made on the main site.
        if (getStoredChoice() === null && !document.body.hasAttribute('data-cookie-consent-silent')) {
            showBanner();
        }
    }

    if (getStoredChoice() === 'granted') {
        enableAnalytics();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.CheeseCookieConsent = {
        show: showBanner,
        accept: function () {
            choose('granted');
        },
        decline: function () {
            choose('denied');
        },
        isGranted: function () {
            return granted;
        }
    };
}(window, document));
