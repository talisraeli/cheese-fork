'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load, installFakeFirebase, waitUntil, pageLoaded } = require('./helpers.cjs');

const LECTURE = '05d405e805e605d005d4';
const ALPHA = '01040001';
const BETA = '01040002';
const LAYER = 'layer1800000000';

function event(title) {
    return { title: title, start: '2017-01-03T08:00:00', end: '2017-01-03T09:00:00' };
}

const ACCOUNT = {
    '202601_courses': [ALPHA],
    ['202601_' + ALPHA]: { [LECTURE]: 10 },
    '202601_custom_events': { 1700000000: event('Work') }
};

const LOCAL = {
    '202601_courses': [BETA],
    ['202601_' + BETA]: { [LECTURE]: 20 },
    '202601_custom_events': { 1700000000: event('Gym') },
    '202601_colors': { [BETA]: '#bf4040', 'custom_event_1700000000': '#336699' },
    '202601_layers': { [LAYER]: { name: 'Plan B', courses: [ALPHA], customEvents: {} } },
    ['202601_' + LAYER + '_' + ALPHA]: { [LECTURE]: 10 }
};

// Loads the site signed out with the local schedule, then signs in to the account's schedule.
async function signInWithLocalSchedule(local, account) {
    const dom = createPage();
    const window = loadUI(dom.window);
    window.courses_from_rishum.push({
        general: { 'מספר מקצוע': BETA, 'שם מקצוע': 'Course Beta', 'נקודות': '2' },
        schedule: [{
            'קבוצה': 21, 'מס.': 20, 'סוג': 'הרצאה', 'יום': 'שני', 'שעה': '12:30 - 14:30',
            'בניין': 'Example Building', 'חדר': 201, 'מרצה/מתרגל': 'Professor Beta'
        }]
    });
    for (const key of ['dontShowIntro', 'dontShowHistogramsTip', 'dontShowThursdayGraphPopup', 'dontShowTechnionScansPopup']) {
        window.localStorage.setItem(key, String(Date.now()));
    }
    window.localStorage.setItem('whatsNewSeenVersion', '1000');
    Object.keys(local).forEach(key => window.localStorage.setItem(key, JSON.stringify(local[key])));

    const dialogs = [];
    const show = window.BootstrapDialog.show;
    window.BootstrapDialog.show = options => {
        const dialog = show(options);
        dialogs.push({ title: options.title, dialog });
        return dialog;
    };

    const firebase = installFakeFirebase(window, { signedOut: true, data: account });
    load(window, 'cheesefork.js');
    await waitUntil(() => pageLoaded(window), 'the signed-out schedule is loaded');
    // Signing in shows the page loader until the account's schedule is loaded, and the import
    // dialog, if any, is shown right after it's hidden.
    firebase.signIn();
    await waitUntil(() => pageLoaded(window), "the account's schedule is loaded");

    const importDialogs = () => dialogs.filter(item => item.title === 'Schedule from this browser').map(item => item.dialog);
    return { dom, window, firebase, importDialogs };
}

test('merging adds the local courses, custom events, colors and layers to the account', async () => {
    const { dom, window, firebase, importDialogs } = await signInWithLocalSchedule(LOCAL, ACCOUNT);
    try {
        assert.equal(importDialogs().length, 1);
        const dialog = importDialogs()[0];
        assert.match(dialog.getModalBody().text(), /\(courses: 2, custom events: 1\)\. Your account has a different schedule \(courses: 1, custom events: 1\)/);
        dialog.getButton('import-local-merge').trigger('click');

        const data = firebase.data;
        assert.deepEqual(data['202601_courses'], [ALPHA, BETA]);
        assert.deepEqual(data['202601_' + ALPHA], { [LECTURE]: 10 });
        assert.deepEqual(data['202601_' + BETA], { [LECTURE]: 20 });
        // The local event's id is taken in the account, so it gets the next one, with its color.
        assert.deepEqual(data['202601_custom_events'], { 1700000000: event('Work'), 1700000001: event('Gym') });
        assert.deepEqual(data['202601_colors'], { [BETA]: '#bf4040', 'custom_event_1700000001': '#336699' });
        assert.deepEqual(data['202601_layers'], { [LAYER]: { name: 'Plan B', courses: [ALPHA], customEvents: {} } });
        assert.deepEqual(data['202601_' + LAYER + '_' + ALPHA], { [LECTURE]: 10 });
        assert.ok(window.document.querySelector('#course-button-list').textContent.includes('Course Beta'));

        // The schedule is removed from this browser, other settings are kept.
        assert.equal(window.localStorage.getItem('202601_courses'), null);
        assert.equal(window.localStorage.getItem('202601_' + LAYER + '_' + ALPHA), null);
        assert.notEqual(window.localStorage.getItem('dontShowIntro'), null);

        // Merging can be undone.
        window.$('#top-navbar-undo a').trigger('click');
        assert.deepEqual(data['202601_courses'], [ALPHA]);
        assert.equal(data['202601_' + BETA], undefined);
        assert.equal(data['202601_layers'], undefined);
        assert.deepEqual(data['202601_custom_events'], { 1700000000: event('Work') });
    } finally {
        dom.window.close();
    }
});

test("using the local schedule replaces the account's schedule", async () => {
    const local = { '202601_courses': [BETA], ['202601_' + BETA]: { [LECTURE]: 20 } };
    const { dom, firebase, importDialogs } = await signInWithLocalSchedule(local, ACCOUNT);
    try {
        importDialogs()[0].getButton('import-local-use').trigger('click');
        assert.deepEqual(firebase.data['202601_courses'], [BETA]);
        assert.deepEqual(firebase.data['202601_' + BETA], { [LECTURE]: 20 });
        assert.equal(firebase.data['202601_' + ALPHA], undefined);
        assert.deepEqual(firebase.data['202601_custom_events'], {});
    } finally {
        dom.window.close();
    }
});

test("keeping the account's schedule can keep the local one too", async () => {
    const { dom, window, firebase, importDialogs } = await signInWithLocalSchedule(LOCAL, ACCOUNT);
    try {
        const dialog = importDialogs()[0];
        dialog.getModalBody().find('input[type="checkbox"]').prop('checked', false);
        dialog.getButton('import-local-keep').trigger('click');
        assert.deepEqual(firebase.data['202601_courses'], [ALPHA]);
        assert.equal(firebase.data['202601_' + BETA], undefined);
        assert.equal(window.localStorage.getItem('202601_courses'), JSON.stringify([BETA]));
        assert.ok(window.$('#top-navbar-undo').hasClass('d-none'), 'nothing changed');
    } finally {
        dom.window.close();
    }
});

test('nothing is offered for an empty local schedule or the same one as the account', async () => {
    for (const local of [{}, { '202601_courses': [] }, ACCOUNT]) {
        const { dom, importDialogs } = await signInWithLocalSchedule(local, ACCOUNT);
        try {
            assert.equal(importDialogs().length, 0, JSON.stringify(local));
        } finally {
            dom.window.close();
        }
    }
});
