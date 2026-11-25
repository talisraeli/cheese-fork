'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load, englishContent, installFakeFirebase, waitUntil, pageLoaded } = require('./helpers.cjs');

for (const [language, name, dir] of [['en', 'English', 'ltr'], ['ar', 'Arabic', 'rtl']]) for (const file of ['index.html', 'course-widget-histograms.html', 'share-histograms.html']) {
    test(file + ': ' + name + ' static content and accessible labels are localized', () => {
        const dom = createPage(file, language);
        try {
            if (file === 'share-histograms.html') {
                loadUI(dom.window);
                dom.window.$('#share-guide').append(dom.window.HistogramBrowser.createShareGuide());
            }
            const { document } = dom.window;
            assert.equal(document.documentElement.lang, language);
            assert.equal(document.documentElement.dir, dir);
            assert.doesNotMatch(englishContent(document.documentElement), /[\u0590-\u05ff]/);
            document.querySelectorAll('[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-alt], [data-i18n-aria-label], [data-i18n-data-intro]').forEach(element => {
                for (const name of ['title', 'placeholder', 'alt', 'aria-label', 'data-intro']) {
                    assert.doesNotMatch(element.getAttribute(name) || '', /[\u0590-\u05ff]/);
                }
            });
            const languageSwitch = document.querySelector('select[data-language-switch]');
            assert.ok(languageSwitch);
            assert.deepEqual(Array.from(languageSwitch.options, option => option.value), ['en', 'he', 'ar']);
            assert.equal(languageSwitch.value, language);
        } finally {
            dom.window.close();
        }
    });
}

for (const language of ['en', 'he', 'ar']) {
    test(language + ': standalone review dialogs localize their accessible close button', () => {
        const dom = createPage('course-widget-histograms.html', language);
        try {
            const window = loadUI(dom.window);
            const dialog = window.BootstrapDialog.show({ title: 'Example' });
            assert.equal(dialog.getModal().find('button.close').attr('aria-label'), window.CheeseI18n.t('shell.dialog.close'));
            dialog.close();
        } finally {
            dom.window.close();
        }
    });

    test(language + ': schedule restores raw lesson identities and remains editable', () => {
        const dom = createPage('index.html', language);
        try {
            const window = loadUI(dom.window);
            window.localStorage.setItem('202601_courses', '["01040001"]');
            const savedLesson = '{"05d405e805e605d005d4":10}';
            window.localStorage.setItem('202601_01040001', savedLesson);
            for (const key of ['dontShowIntro', 'dontShowHistogramsTip', 'dontShowThursdayGraphPopup', 'dontShowTechnionScansPopup']) {
                window.localStorage.setItem(key, String(Date.now()));
            }
            load(window, 'cheesefork.js');
            assert.match(window.document.querySelector('#general-info').textContent, /3/);
            assert.ok(window.document.querySelector('#course-button-list').textContent.includes('Course Alpha'));
            const events = window.$('#course-calendar').fullCalendar('clientEvents');
            assert.equal(events.length, 1);
            assert.equal(events[0].selected, true);
            assert.equal(events[0].start.day(), 0);
            assert.equal(window.$('#course-calendar').fullCalendar('option', 'locale'), language);
            assert.equal(window.localStorage.getItem('202601_01040001'), savedLesson);
            window.$('#course-calendar .fc-event').trigger('click');
            assert.equal(window.localStorage.getItem('202601_01040001'), '{}');
            window.$('#course-calendar .fc-event').trigger('click');
            assert.equal(window.localStorage.getItem('202601_01040001'), savedLesson);
            if (language !== 'he') {
                assert.doesNotMatch(englishContent(window.document.body), /[\u0590-\u05ff]/);
                const placeholder = window.document.querySelector('.selectize-input input').placeholder;
                assert.doesNotMatch(placeholder, /[\u0590-\u05ff]/);
            }
            if (language === 'ar') {
                assert.match(window.document.querySelector('#general-info').textContent, /[\u0600-\u06ff]/);
                assert.equal(window.document.documentElement.dir, 'rtl');
                assert.equal(window.$('#course-calendar').fullCalendar('option', 'isRTL'), true);
            } else if (language === 'he') {
                assert.match(window.document.querySelector('#general-info').textContent, /[\u0590-\u05ff]/);
            }
            const firstLink = window.document.querySelector('#top-navbar-semester .dropdown-item');
            assert.equal(new URL(firstLink.href).searchParams.get('lang'), language);
        } finally {
            dom.window.close();
        }
    });
}

test('Arabic translates catalog labels and writes dates and times with Western digits', () => {
    const dom = createPage('index.html', 'ar');
    try {
        const window = loadUI(dom.window);
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');

        const manager = new window.CourseManager(window.courses_from_rishum);
        assert.equal(manager.getLessonTypeLabel('הרצאה'), 'محاضرة');
        assert.equal(manager.getDayLabel('ראשון'), 'الأحد');
        assert.equal(manager.getFacultyLabel('הפקולטה למתמטיקה'), 'الرياضيات');
        assert.equal(manager.getFrameworkLabel('לימודי הסמכה'), 'اللقب الأول');
        // Counts as labels, since Arabic nouns change with the number, and the Arabic comma.
        assert.equal(window.document.querySelector('#general-info').textContent, 'مساق واحد، نقاط الاستحقاق: 3');

        // The saved lecture is restored as selected, which depends on the displayed week being
        // found regardless of the locale's first day of the week.
        const events = window.$('#course-calendar').fullCalendar('clientEvents');
        assert.equal(events[0].selected, true);

        assert.equal(window.moment.locale(), 'ar');
        assert.equal(window.moment('2017-01-01T10:30:00').format('dddd HH:mm'), 'الأحد 10:30');
        const body = window.document.body.textContent;
        // The time axis of the calendar.
        assert.match(window.$('#course-calendar .fc-axis').text(), /10:30/);
        assert.match(window.$('#course-exam-info').text(), /05\/02/);
        assert.doesNotMatch(body, /[\u0660-\u0669]/, 'no Eastern Arabic digits');
    } finally {
        dom.window.close();
    }
});

test('English course details translate labels while preserving source data', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const manager = new window.CourseManager(window.courses_from_rishum);
        const before = JSON.stringify(window.courses_from_rishum);
        const description = manager.getDescription('01040001', { html: false, relatedCourseInfo: true });
        assert.match(description, /Faculty|School/);
        assert.match(description, /Mathematics/);
        assert.doesNotMatch(description, /[\u0590-\u05ff]/);
        assert.equal(manager.getLessonType(window.courses_from_rishum[0].schedule[0]), 'הרצאה');
        assert.match(manager.getLessonTypeAndNumber(window.courses_from_rishum[0].schedule[0]), /Lecture/);
        assert.equal(JSON.stringify(window.courses_from_rishum), before);
        window.courses_from_rishum[0].general['שם מקצוע'] = 'חשבון אינפיניטסימלי';
        assert.match(manager.getTitle('01040001'), /חשבון אינפיניטסימלי/);
        window.courses_from_rishum[0].general['מקצועות קדם'] = '01040002 או (01040003 ו- 01040004) אוטומטים';
        const related = manager.getDescription('01040001', { html: false, relatedCourseInfo: true });
        assert.match(related, /01040002 or \(01040003 and 01040004\) אוטומטים/);
    } finally {
        dom.window.close();
    }
});

test('clearing the storage in another tab empties the signed-out schedule', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');
        assert.equal(window.$('#course-calendar').fullCalendar('clientEvents').length, 1);

        // Another tab's localStorage.clear() fires a storage event whose key is null.
        window.localStorage.clear();
        window.dispatchEvent(new window.StorageEvent('storage', { key: null }));

        assert.equal(window.$('#course-calendar').fullCalendar('clientEvents').length, 0);
        assert.ok(!window.document.querySelector('#course-button-list').textContent.includes('Course Alpha'));
    } finally {
        dom.window.close();
    }
});

test('undo keeps changes made in another tab', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const savedLesson = '{"05d405e805e605d005d4":10}';
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');
        const undoButton = window.$('#top-navbar-undo');

        // Another tab selects the lecture.
        window.localStorage.setItem('202601_01040001', savedLesson);
        window.dispatchEvent(new window.StorageEvent('storage', { key: '202601_01040001' }));
        assert.equal(window.$('#course-calendar').fullCalendar('clientEvents')[0].selected, true);
        assert.ok(undoButton.hasClass('d-none'), 'a change made elsewhere has nothing to undo here');

        // Unselecting it here and undoing restores the other tab's selection, not the initial one.
        window.$('#course-calendar .fc-event').trigger('click');
        assert.equal(window.localStorage.getItem('202601_01040001'), '{}');
        assert.ok(!undoButton.hasClass('d-none'));
        undoButton.find('a').trigger('click');
        assert.equal(window.localStorage.getItem('202601_01040001'), savedLesson);
    } finally {
        dom.window.close();
    }
});

test('a schedule change that fails to save is reported once', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        let gtagEvents = 0;
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');
        window.gtag = (type, name) => {
            if (name === 'save-error') {
                gtagEvents++;
            }
        };

        // Unavailable storage, as in IE/Edge running from a local file, is expected and not reported.
        const setItem = window.Storage.prototype.setItem;
        window.Storage.prototype.setItem = () => {
            throw new window.DOMException('Access denied', 'SecurityError');
        };
        window.$('#course-calendar .fc-event').trigger('click');
        assert.equal(window.$('#save-error-alert').length, 0);

        // A full storage loses the change, so it's reported, once until the notice is closed.
        window.Storage.prototype.setItem = () => {
            throw new window.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        };
        window.$('#course-calendar .fc-event').trigger('click');
        window.$('#course-calendar .fc-event').trigger('click');
        const notice = window.$('#save-error-alert');
        assert.equal(notice.length, 1);
        assert.equal(notice.attr('role'), 'alert');
        assert.match(notice.text(), /storage is full/);
        assert.equal(gtagEvents, 2);

        notice.find('button.close').trigger('click');
        assert.equal(window.$('#save-error-alert').length, 0);
        window.Storage.prototype.setItem = setItem;
    } finally {
        dom.window.close();
    }
});

test('undo and redo step through changes one at a time, with keyboard shortcuts', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const lecture = '{"05d405e805e605d005d4":10}';
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', lecture);
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');
        const saved = () => window.localStorage.getItem('202601_01040001');
        const toggleLecture = () => window.$('#course-calendar .fc-event').trigger('click');
        const undoButton = window.$('#top-navbar-undo');
        const redoButton = window.$('#top-navbar-redo');
        const undo = () => undoButton.find('a').trigger('click');
        const redo = () => redoButton.find('a').trigger('click');
        const key = (key, options = {}) => window.document.dispatchEvent(
            new window.KeyboardEvent('keydown', Object.assign({ key, ctrlKey: true, bubbles: true }, options)));

        // Bootstrap's tooltip moves the title to data-original-title.
        assert.equal(window.$('#top-navbar-undo a').attr('data-original-title'), 'Undo the last change (Ctrl+Z / ⌘Z)');
        assert.ok(undoButton.hasClass('d-none'));

        toggleLecture(); // Unselect.
        toggleLecture(); // Select.
        toggleLecture(); // Unselect.
        assert.equal(saved(), '{}');

        undo();
        assert.equal(saved(), lecture);
        assert.ok(!redoButton.hasClass('d-none'));
        undo();
        assert.equal(saved(), '{}');
        undo();
        assert.equal(saved(), lecture, 'back to the loaded schedule');
        assert.ok(undoButton.hasClass('d-none'), 'nothing more to undo');
        undo();
        assert.equal(saved(), lecture);

        redo();
        assert.equal(saved(), '{}');
        redo();
        assert.equal(saved(), lecture);
        assert.ok(!undoButton.hasClass('d-none'));

        // A new change clears what can be redone.
        undo();
        assert.equal(saved(), '{}');
        toggleLecture();
        assert.equal(saved(), lecture);
        assert.ok(redoButton.hasClass('d-none'));

        // Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y, and Cmd on Mac.
        key('z');
        assert.equal(saved(), '{}');
        key('Z', { shiftKey: true });
        assert.equal(saved(), lecture);
        key('z', { ctrlKey: false, metaKey: true });
        assert.equal(saved(), '{}');
        key('y');
        assert.equal(saved(), lecture);

        // On a Hebrew keyboard the same keys type ז and ט, so the physical key decides.
        key('ז', { code: 'KeyZ' });
        assert.equal(saved(), '{}');
        key('ז', { code: 'KeyZ', shiftKey: true });
        assert.equal(saved(), lecture);
        key('ז', { code: 'KeyZ' });
        assert.equal(saved(), '{}');
        key('ט', { code: 'KeyY' });
        assert.equal(saved(), lecture);
        // On a Latin layout the letter decides, such as German, where Z is on the Y key.
        key('z', { code: 'KeyY' });
        assert.equal(saved(), '{}');
        key('y', { code: 'KeyZ' });
        assert.equal(saved(), lecture);

        // Not while typing, where Ctrl+Z undoes the typing.
        const input = window.$('<input type="text">').appendTo(window.document.body).get(0);
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
        assert.equal(saved(), lecture);
        input.remove();

        // Only the last 50 changes can be undone.
        for (let i = 0; i < 60; i++) {
            toggleLecture();
        }
        let undone = 0;
        while (!undoButton.hasClass('d-none')) {
            undo();
            undone++;
        }
        assert.equal(undone, 50);
    } finally {
        dom.window.close();
    }
});

test('English weekday headings adapt to narrow calendars without changing selected lessons', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const calendar = window.$('#course-calendar').css('width', '900px');
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');
        assert.equal(calendar.find('.fc-day-header').first().text(), 'Sunday');
        calendar.css('width', '375px');
        calendar.fullCalendar('option', 'windowResize')();
        assert.equal(calendar.find('.fc-day-header').first().text(), 'Sun');
        assert.equal(calendar.fullCalendar('clientEvents')[0].selected, true);
        calendar.css('width', '900px');
        calendar.fullCalendar('option', 'windowResize')();
        assert.equal(calendar.find('.fc-day-header').first().text(), 'Sunday');
        assert.equal(calendar.fullCalendar('clientEvents')[0].selected, true);
    } finally {
        dom.window.close();
    }
});

test('the API dialog creates a key, shows it once and revokes it', async () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        load(window, 'cheesefork.js');

        const calls = [];
        const results = {
            apiKeyStatus: { exists: false },
            apiKeyCreate: { key: 'cf2_' + 'a'.repeat(43), hint: 'cf2_aaaaaa', createdAt: Date.UTC(2026, 10, 23) },
            apiKeyRevoke: { exists: false }
        };
        window.firebase = {
            functions: () => ({
                httpsCallable: name => () => {
                    calls.push(name);
                    return window.Promise.resolve({ data: results[name] });
                }
            })
        };
        // jsdom doesn't attach the modal to the document, so use the dialog object.
        let dialog = null;
        const show = window.BootstrapDialog.show;
        window.BootstrapDialog.show = options => (dialog = show(options));
        const confirmations = [];
        window.BootstrapDialog.confirm = options => {
            confirmations.push(options.btnOKLabel);
            options.callback(true);
        };
        const settle = () => new Promise(resolve => setTimeout(resolve, 0));
        const status = () => dialog.getModalBody().find('.api-key-status').text();

        window.$('#top-navbar-api a').trigger('click');
        await settle();
        assert.deepEqual(calls, ['apiKeyStatus']);
        assert.equal(status(), "You don't have an API key yet.");
        assert.equal(dialog.getButton('api-key-create').text(), 'Create API key');
        const baseUrl = dialog.getModalBody().find('code');
        assert.equal(baseUrl.text(), 'https://api.cf.talisrae.li/v1');
        assert.ok(baseUrl.hasClass('d-block'));
        assert.equal(baseUrl.parent().contents().first().text(), 'API address:');
        const prompt = dialog.getModalBody().find('.api-key-prompt textarea').val();
        assert.match(prompt, /^Help me manage my CheeseFork² course schedule/);
        assert.ok(prompt.includes('Base URL: https://api.cf.talisrae.li/v1'));
        assert.ok(prompt.includes('My current semester is 202601.'));
        assert.ok(prompt.includes('Authorization: Bearer YOUR_API_KEY'));
        assert.equal(dialog.getModalBody().find('.api-key-prompt button').text(), 'Copy prompt');
        assert.ok(dialog.getButton('api-key-revoke').hasClass('d-none'));

        dialog.getButton('api-key-create').trigger('click');
        await settle();
        assert.deepEqual(calls, ['apiKeyStatus', 'apiKeyCreate']);
        assert.deepEqual(confirmations, []);
        assert.equal(dialog.getModalBody().find('.api-key-new input').val(), results.apiKeyCreate.key);
        // The prompt never includes the key.
        assert.ok(!dialog.getModalBody().find('.api-key-prompt textarea').val().includes(results.apiKeyCreate.key));
        assert.match(status(), /^Your key starts with cf2_aaaaaa…\. Created: .+\. Last used: never\.$/);
        assert.equal(dialog.getButton('api-key-create').text(), 'Replace key');
        assert.ok(!dialog.getButton('api-key-revoke').hasClass('d-none'));

        dialog.getButton('api-key-revoke').trigger('click');
        await settle();
        assert.deepEqual(confirmations, ['Revoke key']);
        assert.deepEqual(calls, ['apiKeyStatus', 'apiKeyCreate', 'apiKeyRevoke']);
        assert.equal(dialog.getModalBody().find('.api-key-new input').length, 0);
        assert.equal(status(), "You don't have an API key yet.");
        dialog.close();
    } finally {
        dom.window.close();
    }
});

// Loads the site with the given "what's new" version seen, and returns the welcome dialog, if shown.
function loadWelcome(seenVersion, language = 'en') {
    const dom = createPage('index.html', language);
    const window = loadUI(dom.window);
    window.localStorage.setItem('dontShowIntro', String(Date.now()));
    if (seenVersion) {
        window.localStorage.setItem('whatsNewSeenVersion', seenVersion);
    }
    const dialogs = [];
    const show = window.BootstrapDialog.show;
    window.BootstrapDialog.show = options => {
        const dialog = show(options);
        dialogs.push(dialog);
        return dialog;
    };
    load(window, 'cheesefork.js');
    const welcome = dialogs.find(dialog => dialog.getTitle() === window.CheeseI18n.t('shell.whatsNew.title'));
    return { dom, window, welcome };
}

const FEATURE_TITLES = ['Layers', 'Your choice of colors', 'A calendar that stays up to date', 'Import from the original CheeseFork', 'English and Arabic interface', 'API access'];

test('the welcome popup lists the new features again for visitors who saw an older version', () => {
    for (const [seenVersion, shown] of [[null, true], ['1', true], ['2', true], ['3', true], ['4', false]]) {
        const { dom, welcome } = loadWelcome(seenVersion);
        try {
            assert.equal(!!welcome, shown, 'seen version ' + seenVersion);
            if (welcome) {
                const titles = Array.from(welcome.getModalBody().find('.whats-new-item h6'), element => element.textContent);
                assert.deepEqual(titles, FEATURE_TITLES);
                welcome.close();
            }
        } finally {
            dom.window.close();
        }
    }
});

test('the welcome popup has a page with how-to steps for each feature', () => {
    const { dom, window, welcome } = loadWelcome(null);
    try {
        const body = welcome.getModalBody();
        const pages = body.find('.whats-new-page');
        const visible = () => pages.filter((i, page) => !window.$(page).hasClass('d-none'));
        const visibleTitle = () => visible().find('.whats-new-page-header h5').text();
        const next = welcome.getButton('whats-new-next');
        const previous = welcome.getButton('whats-new-previous');
        const skip = welcome.getButton('whats-new-skip');

        // The welcome page and a page per feature, with a dot for each.
        assert.equal(pages.length, 1 + FEATURE_TITLES.length);
        assert.equal(body.find('.whats-new-dot').length, pages.length);
        assert.equal(visible().length, 1);
        assert.equal(visible().find('.whats-new-item').length, FEATURE_TITLES.length);
        // The overview has only the titles, the descriptions are on the feature pages.
        assert.deepEqual(Array.from(visible().find('.whats-new-item'), item => item.textContent), FEATURE_TITLES);
        assert.ok(previous.hasClass('d-none'));
        assert.ok(!skip.hasClass('d-none'));
        assert.equal(next.text(), 'Next');
        assert.equal(body.find('.whats-new-dot').first().attr('aria-label'), 'Go to page 1 of 7');
        assert.equal(body.find('.whats-new-dot.active').index(), 0);

        // Next goes through the features in order, each with steps.
        for (const [i, title] of FEATURE_TITLES.entries()) {
            next.trigger('click');
            assert.equal(visibleTitle(), title);
            assert.equal(body.find('.whats-new-dot.active').index(), i + 1);
            assert.ok(visible().find('.whats-new-steps li').length >= 2, title + ' has steps');
            assert.equal(visible().find('h6').first().text(), 'How to use it');
        }
        assert.match(visible().find('.whats-new-note').text(), /^Good to know: Anyone with your key/);
        assert.equal(visible().find('.whats-new-steps li').first().text(), 'Sign in and click API in the navigation bar.');

        // On the last page, Next becomes the button that closes the dialog, and Skip is hidden.
        assert.equal(next.text(), "Let's get started");
        assert.ok(skip.hasClass('d-none'));
        assert.ok(!previous.hasClass('d-none'));

        // Previous, the dots, the overview and the arrow keys turn the pages too.
        previous.trigger('click');
        assert.equal(visibleTitle(), 'English and Arabic interface');
        assert.equal(next.text(), 'Next');
        body.find('.whats-new-dot').eq(0).trigger('click');
        assert.equal(visible().find('.whats-new-item').length, FEATURE_TITLES.length);
        visible().find('.whats-new-item').eq(2).trigger('click');
        assert.equal(visibleTitle(), 'A calendar that stays up to date');
        const key = key => welcome.getModal().trigger(window.$.Event('keydown', { key }));
        key('ArrowRight');
        assert.equal(visibleTitle(), 'Import from the original CheeseFork');
        key('ArrowLeft');
        key('ArrowLeft');
        assert.equal(visibleTitle(), 'Your choice of colors');

        // On the last page, the button closes the dialog. (Bootstrap doesn't finish showing it in
        // jsdom, so it doesn't close here, which is checked by calling close instead.)
        let closed = 0;
        welcome.close = () => closed++;
        body.find('.whats-new-dot').last().trigger('click');
        next.trigger('click');
        assert.equal(closed, 1);
    } finally {
        dom.window.close();
    }
});

test('the user guide button shows the welcome dialog again, even after it was seen', () => {
    for (const [language, label, title] of [['en', 'User guide', 'Welcome to CheeseFork²'], ['he', 'מדריך שימוש', 'ברוכים הבאים ל-CheeseFork²']]) {
        const { dom, window, welcome } = loadWelcome('4', language);
        try {
            assert.equal(welcome, undefined, 'not shown on load once seen');
            const button = window.$('#top-navbar-guide a');
            assert.equal(button.text().trim(), label);

            const dialogs = [];
            const show = window.BootstrapDialog.show;
            window.BootstrapDialog.show = options => {
                const dialog = show(options);
                dialogs.push(dialog);
                return dialog;
            };
            button.trigger('click');
            assert.equal(dialogs.length, 1);
            assert.equal(dialogs[0].getTitle(), title);
            const visible = dialogs[0].getModalBody().find('.whats-new-page').not('.d-none');
            assert.equal(visible.find('.whats-new-item').length, FEATURE_TITLES.length, 'starts at the overview');
            dialogs[0].close();
        } finally {
            dom.window.close();
        }
    }
});

test('in Hebrew, the arrow keys turn the pages in the reading direction', () => {
    const { dom, window, welcome } = loadWelcome(null, 'he');
    try {
        const pages = welcome.getModalBody().find('.whats-new-page');
        const index = () => pages.toArray().findIndex(page => !window.$(page).hasClass('d-none'));
        const key = key => welcome.getModal().trigger(window.$.Event('keydown', { key }));
        key('ArrowLeft');
        assert.equal(index(), 1);
        key('ArrowRight');
        assert.equal(index(), 0);
        assert.equal(welcome.getButton('whats-new-next').text(), 'הבא');
        welcome.close();
    } finally {
        dom.window.close();
    }
});

for (const language of ['en', 'he', 'ar']) {
    test(language + ': the sign-in dialog says that signing in accepts the terms and the privacy policy', async () => {
        const dom = createPage('index.html', language);
        try {
            const window = loadUI(dom.window);
            for (const key of ['dontShowIntro', 'dontShowHistogramsTip', 'dontShowThursdayGraphPopup', 'dontShowTechnionScansPopup']) {
                window.localStorage.setItem(key, String(Date.now()));
            }
            window.localStorage.setItem('whatsNewSeenVersion', '1000');
            installFakeFirebase(window, { signedOut: true });
            load(window, 'cheesefork.js');
            await waitUntil(() => pageLoaded(window), 'the signed-out schedule is loaded');

            let dialog;
            const show = window.BootstrapDialog.show;
            window.BootstrapDialog.show = options => (dialog = show(options));
            window.$('#top-navbar-login').trigger('click');
            assert.ok(dialog);
            const body = dialog.getModalBody();
            const note = body.find('.login-terms-note');
            assert.equal(note.length, 1);
            assert.equal(body.find('#firebaseui-auth-container').length, 1);

            const { t } = window.CheeseI18n;
            const expected = t('shell.login.terms')
                .replace('{terms}', t('shell.login.termsLink'))
                .replace('{privacy}', t('shell.login.privacyLink'));
            assert.equal(note.text(), expected);
            const links = Array.from(note.find('a'));
            assert.deepEqual([...links.map(link => link.textContent)], [t('shell.login.termsLink'), t('shell.login.privacyLink')]);
            assert.match(links[0].href, /\/TERMS\.md$/);
            assert.match(links[1].href, /\/PRIVACY\.md$/);
            links.forEach(link => assert.equal(link.rel, 'noopener'));
        } finally {
            dom.window.close();
        }
    });
}
