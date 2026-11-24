'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load, installFakeFirebase, waitUntil, pageLoaded } = require('./helpers.cjs');

const CALENDAR_PATH = 'user1/winter-2026-2027.ics';
const LECTURE = '{"05d405e805e605d005d4":10}';

// Loads the site signed in, with the course and its lecture selected. The upload delay is
// shortened, and the days off are served without the network.
async function loadSignedIn(files) {
    const dom = createPage();
    const window = loadUI(dom.window);
    for (const key of ['dontShowIntro', 'dontShowHistogramsTip', 'dontShowThursdayGraphPopup', 'dontShowTechnionScansPopup']) {
        window.localStorage.setItem(key, String(Date.now()));
    }
    window.localStorage.setItem('whatsNewSeenVersion', '1000');

    const setTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => setTimeout(callback, delay >= 5000 ? 20 : delay, ...args);

    const daysOffRequests = [];
    window.$.getJSON = url => {
        daysOffRequests.push(url);
        return window.$.Deferred().resolve({ daysOff: ['2026-11-01'] }).promise();
    };

    const firebase = installFakeFirebase(window, {
        files: files,
        data: { '202601_courses': ['01040001'], '202601_01040001': JSON.parse(LECTURE) }
    });
    load(window, 'cheesefork.js');
    await waitUntil(() => pageLoaded(window) && window.$('#course-calendar').fullCalendar('clientEvents').length > 0,
        'the schedule is loaded');
    return { dom, window, firebase, daysOffRequests };
}

// Waits long enough for a pending upload, for checking that nothing was uploaded.
function settle() {
    return new Promise(resolve => setTimeout(resolve, 300));
}

// Waits until there are count uploads, failing after a while.
async function uploadsCount(firebase, count) {
    for (let waited = 0; firebase.uploads.length < count; waited += 10) {
        assert.ok(waited < 3000, 'expected ' + count + ' uploads, got ' + firebase.uploads.length);
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    await settle();
    assert.equal(firebase.uploads.length, count);
}

function events(calendar) {
    return calendar.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length;
}

test('an exported calendar is uploaded again after schedule changes, once for several changes', async () => {
    const { dom, window, firebase, daysOffRequests } = await loadSignedIn([CALENDAR_PATH]);
    try {
        // Loading the schedule uploads it, to include changes made elsewhere, such as with the API.
        await uploadsCount(firebase, 1);
        let upload = firebase.uploads[0];
        assert.equal(upload.path, CALENDAR_PATH);
        assert.equal(upload.metadata.contentType, 'text/calendar; charset=utf-8');
        assert.match(upload.metadata.customMetadata.fingerprint, /^[0-9a-f]+$/);
        assert.ok(upload.text.includes('SUMMARY:Lecture 10 – Course Alpha'));
        assert.ok(upload.text.includes('EXDATE;TZID=Asia/Jerusalem:20261101T103000'), 'the days off are excluded');

        // Unselecting the lecture uploads the calendar without it.
        window.$('#course-calendar .fc-event').trigger('click');
        assert.deepEqual(firebase.data['202601_01040001'], {});
        assert.equal(firebase.uploads.length, 1, 'the upload waits for more changes');
        await uploadsCount(firebase, 2);
        upload = firebase.uploads[1];
        assert.ok(!upload.text.includes('Lecture 10'));
        assert.ok(upload.text.includes('BEGIN:VCALENDAR'));

        // Several changes in a row cause a single upload.
        window.$('#course-calendar .fc-event').trigger('click');
        window.$('#course-calendar .fc-event').trigger('click');
        window.$('#course-calendar .fc-event').trigger('click');
        await uploadsCount(firebase, 3);
        assert.ok(firebase.uploads[2].text.includes('SUMMARY:Lecture 10 – Course Alpha'));

        // The file and the days off are checked once.
        assert.deepEqual(firebase.metadataChecks, [CALENDAR_PATH]);
        assert.equal(daysOffRequests.length, 1);
    } finally {
        dom.window.close();
    }
});

// Loads the site once, as above, and returns the fingerprint its upload saved with the file.
async function uploadedFingerprint() {
    const { dom, firebase } = await loadSignedIn([CALENDAR_PATH]);
    try {
        await uploadsCount(firebase, 1);
        return firebase.uploads[0].metadata.customMetadata.fingerprint;
    } finally {
        dom.window.close();
    }
}

test('a calendar that is the same as the uploaded one is not uploaded again', async () => {
    const fingerprint = await uploadedFingerprint();

    // Another visit, building the calendar at another time, finds the same events.
    const { dom, window, firebase } = await loadSignedIn([{ path: CALENDAR_PATH, customMetadata: { fingerprint } }]);
    try {
        await settle();
        assert.equal(firebase.uploads.length, 0);
        assert.deepEqual(firebase.metadataChecks, [CALENDAR_PATH], 'the fingerprint comes with the existence check');

        // Changes that are undone before the upload leave the calendar the same.
        window.$('#course-calendar .fc-event').trigger('click');
        window.$('#course-calendar .fc-event').trigger('click');
        await settle();
        assert.equal(firebase.uploads.length, 0);

        // A real change is uploaded, with its own fingerprint.
        window.$('#course-calendar .fc-event').trigger('click');
        await uploadsCount(firebase, 1);
        assert.notEqual(firebase.uploads[0].metadata.customMetadata.fingerprint, fingerprint);
    } finally {
        dom.window.close();
    }
});

test('a calendar that changed elsewhere, such as with the API, is uploaded on the next visit', async () => {
    const { dom, firebase } = await loadSignedIn([{ path: CALENDAR_PATH, customMetadata: { fingerprint: 'stale' } }]);
    try {
        await uploadsCount(firebase, 1);
        assert.ok(firebase.uploads[0].text.includes('SUMMARY:Lecture 10 – Course Alpha'));
    } finally {
        dom.window.close();
    }
});

test('an empty schedule is uploaded as a valid calendar without events', async () => {
    const { dom, window, firebase } = await loadSignedIn([CALENDAR_PATH]);
    try {
        await uploadsCount(firebase, 1);
        // Remove the course, which leaves no events at all.
        window.$('#course-button-list .course-button-list-item').trigger('click');
        await uploadsCount(firebase, 2);
        const upload = firebase.uploads[1];
        assert.equal(events(upload.text), 0);
        assert.ok(!upload.text.split('\r\n').includes(''), 'no empty lines');
        assert.match(upload.text, /^BEGIN:VCALENDAR\r\n[\s\S]*\r\nEND:VCALENDAR$/);
    } finally {
        dom.window.close();
    }
});

test('a calendar that was never exported is not uploaded until it is exported', async () => {
    const { dom, window, firebase } = await loadSignedIn([]);
    try {
        window.$('#course-calendar .fc-event').trigger('click');
        await settle();
        window.$('#course-calendar .fc-event').trigger('click');
        await settle();
        assert.equal(firebase.uploads.length, 0);
        assert.deepEqual(firebase.metadataChecks, [CALENDAR_PATH], 'checked once, then remembered');

        // Exporting uploads the file, and later changes upload it again.
        window.$('#top-navbar-export').trigger('click');
        await uploadsCount(firebase, 1);
        window.$('#course-calendar .fc-event').trigger('click');
        await uploadsCount(firebase, 2);
        assert.ok(!firebase.uploads[1].text.includes('Lecture 10'));
        assert.deepEqual(firebase.metadataChecks, [CALENDAR_PATH]);
    } finally {
        dom.window.close();
    }
});
