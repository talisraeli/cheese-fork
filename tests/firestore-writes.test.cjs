'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load, installFakeFirebase, waitUntil, pageLoaded } = require('./helpers.cjs');

// Loads the site signed in as "Test User" with the given semester document, and returns the
// writes made while loading.
async function loadWrites(data) {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        for (const key of ['dontShowIntro', 'dontShowHistogramsTip', 'dontShowThursdayGraphPopup', 'dontShowTechnionScansPopup']) {
            window.localStorage.setItem(key, String(Date.now()));
        }
        window.localStorage.setItem('whatsNewSeenVersion', '1000');
        window.$.getJSON = () => window.$.Deferred().resolve({ daysOff: [] }).promise();
        const firebase = installFakeFirebase(window, { data: data });
        load(window, 'cheesefork.js');
        await waitUntil(() => pageLoaded(window), 'the schedule is loaded');
        return { writes: firebase.writes, data: firebase.data };
    } finally {
        dom.window.close();
    }
}

const SCHEDULE = { '202601_courses': ['01040001'], '202601_01040001': { '05d405e805e605d005d4': 10 } };

test('loading a schedule that already has the name writes nothing', async () => {
    const { writes } = await loadWrites(Object.assign({ displayName: 'Test User' }, SCHEDULE));
    assert.deepEqual(writes, []);
});

test("the name is saved when the semester's document is new or the name changed", async () => {
    // A semester opened for the first time: the write creates its document.
    let result = await loadWrites({});
    assert.deepEqual(result.writes, [{ type: 'set', value: { displayName: 'Test User' } }]);
    assert.equal(result.data.displayName, 'Test User');

    // A document without the name, such as one created before names were saved.
    result = await loadWrites(Object.assign({}, SCHEDULE));
    assert.deepEqual(result.writes, [{ type: 'set', value: { displayName: 'Test User' } }]);

    // A name changed in the account since the last visit.
    result = await loadWrites(Object.assign({ displayName: 'Old Name' }, SCHEDULE));
    assert.deepEqual(result.writes, [{ type: 'set', value: { displayName: 'Test User' } }]);
    assert.equal(result.data.displayName, 'Test User');
});
