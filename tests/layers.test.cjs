'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load } = require('./helpers.cjs');

const ALPHA = '01040001';
const LECTURE = '05d405e805e605d005d4';
const PLAN_B = 'layer1800000000';

function event(title) {
    return { title: title, start: '2017-01-03T08:00:00', end: '2017-01-03T09:00:00' };
}

// Loads the site signed out with two layers: "Plan A", the first layer, with the course, its
// lecture and a custom event, and the hidden "Plan B" with the course and no lessons.
function loadLayers() {
    const dom = createPage();
    const window = loadUI(dom.window);
    const saved = {
        '202601_courses': [ALPHA],
        ['202601_' + ALPHA]: { [LECTURE]: 10 },
        '202601_custom_events': { 1700000000: event('Gym') },
        '202601_colors': { [ALPHA]: '#bf4040', 'custom_event_1700000000': '#336699', [PLAN_B + '_' + ALPHA]: '#123456' },
        '202601_layers': {
            default: { name: 'Plan A' },
            [PLAN_B]: { name: 'Plan B', hidden: true, courses: [ALPHA], customEvents: {} }
        },
        ['202601_' + PLAN_B + '_' + ALPHA]: {}
    };
    Object.keys(saved).forEach(key => window.localStorage.setItem(key, JSON.stringify(saved[key])));
    window.localStorage.setItem('dontShowIntro', String(Date.now()));
    load(window, 'cheesefork.js');

    const stored = key => JSON.parse(window.localStorage.getItem('202601_' + key));
    const duplicate = layerId => window.$('.course-button-list-layer-header[data-layer-id="' + layerId + '"]')
        .find('.course-button-list-layer-duplicate').trigger('click');
    const newLayerId = before => Object.keys(stored('layers')).find(id => !before.includes(id));
    return { dom, window, stored, duplicate, newLayerId };
}

test('duplicating a layer copies its courses, lessons, custom events and colors', () => {
    const { dom, window, stored, duplicate, newLayerId } = loadLayers();
    try {
        const menuItem = window.$('.course-button-list-layer-header[data-layer-id=""] .course-button-list-layer-duplicate');
        assert.equal(menuItem.text(), 'Duplicate');

        duplicate('');
        const copyId = newLayerId(['default', PLAN_B]);
        assert.match(copyId, /^layer\d+$/);

        const copy = stored('layers')[copyId];
        assert.equal(copy.name, 'Plan A (copy)');
        assert.equal(copy.hidden, undefined);
        assert.deepEqual(copy.courses, [ALPHA]);
        assert.deepEqual(stored(copyId + '_' + ALPHA), { [LECTURE]: 10 });

        // The custom event gets a new id, unique across the layers, with the same color.
        const eventIds = Object.keys(copy.customEvents);
        assert.equal(eventIds.length, 1);
        assert.notEqual(eventIds[0], '1700000000');
        assert.deepEqual(copy.customEvents[eventIds[0]], event('Gym'));
        const colors = stored('colors');
        assert.equal(colors[copyId + '_' + ALPHA], '#bf4040');
        assert.equal(colors['custom_event_' + eventIds[0]], '#336699');

        // The original is unchanged, and the copy is selected for adding courses.
        assert.deepEqual(stored('courses'), [ALPHA]);
        assert.deepEqual(stored('custom_events'), { 1700000000: event('Gym') });
        assert.ok(window.$('.course-button-list-layer-header[data-layer-id="' + copyId + '"]')
            .hasClass('course-button-list-layer-active'));
        assert.equal(window.$('.course-button-list-layer-header[data-layer-id="' + copyId + '"] .course-button-list-layer-name').text(),
            'Plan A (copy)');

        // Duplicating can be undone.
        window.$('#top-navbar-undo a').trigger('click');
        assert.deepEqual(Object.keys(stored('layers')).sort(), ['default', PLAN_B]);
        assert.equal(window.localStorage.getItem('202601_' + copyId + '_' + ALPHA), null);
    } finally {
        dom.window.close();
    }
});

test('a copy of a hidden layer is visible and keeps the layer colors', () => {
    const { dom, stored, duplicate, newLayerId } = loadLayers();
    try {
        duplicate(PLAN_B);
        const copyId = newLayerId(['default', PLAN_B]);
        const copy = stored('layers')[copyId];
        assert.equal(copy.name, 'Plan B (copy)');
        assert.equal(copy.hidden, undefined);
        assert.deepEqual(copy.courses, [ALPHA]);
        assert.deepEqual(copy.customEvents, {});
        assert.deepEqual(stored(copyId + '_' + ALPHA), {});
        assert.equal(stored('colors')[copyId + '_' + ALPHA], '#123456');
        assert.equal(stored('layers')[PLAN_B].hidden, true);
    } finally {
        dom.window.close();
    }
});
