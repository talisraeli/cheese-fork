'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load, waitUntil } = require('./helpers.cjs');

const LECTURE = '05d405e805e605d005d4';
const ALPHA = '01040001';

// Like a file exported by the original CheeseFork: a weekly event per lesson and custom event,
// in the time of Asia/Jerusalem, a one-time event per exam, and long lines folded.
function originalExport(events) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:CheeseFork',
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Jerusalem',
        'END:VTIMEZONE'
    ].concat(...events.map(event => [
        'BEGIN:VEVENT',
        'UID:' + Math.random(),
        event.rrule === false ? null : 'RRULE:FREQ=WEEKLY;UNTIL=20270202T000000Z',
        'DTSTAMP:20261020T000000Z',
        event.start.length === 8 ? 'DTSTART;VALUE=DATE:' + event.start : 'DTSTART;TZID=Asia/Jerusalem:' + event.start,
        event.end ? 'DTEND;TZID=Asia/Jerusalem:' + event.end : null,
        'LOCATION:Example Building 101',
        'SUMMARY;LANGUAGE=en-us:' + event.summary,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
    ].filter(line => line !== null)), ['END:VCALENDAR']).join('\r\n');
}

const FILE = originalExport([
    // Folded in the middle of the course name.
    { summary: 'הרצאה 10 - Course\r\n  Alpha', start: '20261025T103000', end: '20261025T123000' },
    { summary: 'Gym\\, with friends', start: '20261027T180000', end: '20261027T190000' },
    { summary: 'תרגול 12 - Course From Another Semester', start: '20261026T080000', end: '20261026T090000' },
    { summary: 'מועד א\' - Course Alpha', start: '20270205', rrule: false }
]);

function openPage(language = 'en') {
    const dom = createPage('index.html', language);
    const window = loadUI(dom.window);
    window.localStorage.setItem('dontShowIntro', String(Date.now()));
    window.localStorage.setItem('whatsNewSeenVersion', '1000');
    const dialogs = [];
    const show = window.BootstrapDialog.show;
    window.BootstrapDialog.show = options => {
        const dialog = show(options);
        dialogs.push({ title: options.title, dialog });
        return dialog;
    };
    load(window, 'cheesefork.js');
    return { dom, window, dialogs };
}

async function chooseFile(window, dialogs, text) {
    const count = dialogs.length;
    window.$('#top-navbar-import').trigger('click');
    const input = window.document.getElementById('import-ics-file');
    Object.defineProperty(input, 'files', { value: [new window.File([text], 'schedule.ics', { type: 'text/calendar' })], configurable: true });
    input.dispatchEvent(new window.Event('change'));
    await waitUntil(() => dialogs.length > count, 'the import dialog is shown');
    return dialogs[dialogs.length - 1].dialog;
}

test('importing a file from the original CheeseFork adds its lessons and custom events, and can be undone', async () => {
    const { dom, window, dialogs } = openPage();
    try {
        assert.ok(!window.$('#top-navbar-import').hasClass('d-none'));
        // Export and import share the Calendar menu of the navigation bar.
        assert.equal(window.$('#top-navbar-calendar > .dropdown-toggle span').text(), 'Calendar');
        assert.deepEqual(Array.from(window.$('#top-navbar-calendar .dropdown-menu .dropdown-item'), item => item.id), ['top-navbar-export', 'top-navbar-import']);
        assert.equal(window.$('#top-navbar-import span').text(), 'Import from CheeseFork');

        const dialog = await chooseFile(window, dialogs, FILE);
        const body = dialog.getModalBody();
        assert.match(body.text(), /Found 1 courses and 1 custom events in the file/);
        assert.deepEqual(Array.from(body.find('li'), li => li.textContent), ['תרגול 12 - Course From Another Semester']);

        dialog.getButton('import-ics-confirm').trigger('click');

        assert.equal(window.localStorage.getItem('202601_courses'), JSON.stringify([ALPHA]));
        assert.equal(window.localStorage.getItem('202601_' + ALPHA), JSON.stringify({ [LECTURE]: 10 }));
        const customEvents = Object.values(JSON.parse(window.localStorage.getItem('202601_custom_events')));
        assert.equal(JSON.stringify(customEvents), JSON.stringify([{
            title: 'Gym, with friends',
            start: '2017-01-03T18:00:00',
            end: '2017-01-03T19:00:00'
        }]));
        // The lesson is selected and the custom event is shown.
        const events = window.$('#course-calendar').fullCalendar('clientEvents');
        assert.ok(events.some(event => event.courseNumber === ALPHA && event.selected));
        assert.ok(events.some(event => event.title === 'Gym, with friends'));

        window.$('#top-navbar-undo a').trigger('click');
        assert.equal(window.localStorage.getItem('202601_courses'), '[]');
        assert.equal(window.localStorage.getItem('202601_custom_events'), '{}');
    } finally {
        dom.window.close();
    }
});

test('courses already in the schedule keep their lessons', async () => {
    const { dom, window, dialogs } = openPage();
    try {
        window.localStorage.setItem('202601_courses', JSON.stringify([ALPHA]));
        window.localStorage.setItem('202601_' + ALPHA, '{}');
        window.dispatchEvent(new window.StorageEvent('storage', { key: '202601_courses' }));

        const dialog = await chooseFile(window, dialogs, FILE);
        dialog.getButton('import-ics-confirm').trigger('click');
        assert.equal(window.localStorage.getItem('202601_' + ALPHA), '{}');
    } finally {
        dom.window.close();
    }
});

test('a file exported by CheeseFork² in English is imported too', async () => {
    const { dom, window, dialogs } = openPage();
    try {
        const dialog = await chooseFile(window, dialogs, originalExport([
            { summary: 'Lecture 10 – Course Alpha', start: '20261025T103000', end: '20261025T123000' }
        ]));
        assert.match(dialog.getModalBody().text(), /Found 1 courses and 0 custom events/);
        dialog.getButton('import-ics-confirm').trigger('click');
        assert.equal(window.localStorage.getItem('202601_' + ALPHA), JSON.stringify({ [LECTURE]: 10 }));
    } finally {
        dom.window.close();
    }
});

for (const language of ['en', 'he', 'ar']) {
    test(language + ': a file without lessons of this semester explains what to check', async () => {
        const { dom, window, dialogs } = openPage(language);
        try {
            const { t } = window.CheeseI18n;
            const dialog = await chooseFile(window, dialogs, originalExport([
                { summary: 'תרגול 12 - Course From Another Semester', start: '20261026T080000', end: '20261026T090000' }
            ]));
            assert.equal(dialogs[dialogs.length - 1].title, t('shell.importIcs.title'));
            const body = dialog.getModalBody();
            assert.ok(body.text().includes(t('shell.importIcs.nothing')));
            assert.equal(body.find('li').length, 1);
            assert.equal(window.localStorage.getItem('202601_courses'), null);
        } finally {
            dom.window.close();
        }
    });
}
