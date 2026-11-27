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
    return loadLayersInto(dom, loadUI(dom.window));
}

function loadLayersInto(dom, window) {
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

// Loads the layers of loadLayers, with the collapsedLayers localStorage item set to saved if given.
function loadCollapsibleLayers(saved) {
    const dom = createPage();
    const window = loadUI(dom.window);
    if (saved !== undefined) {
        window.localStorage.setItem('collapsedLayers', saved);
    }
    const dialogs = [];
    const show = window.BootstrapDialog.show;
    window.BootstrapDialog.show = options => {
        const dialog = show(options);
        dialogs.push(dialog);
        return dialog;
    };
    const lastDialog = () => dialogs[dialogs.length - 1];
    const loaded = loadLayersInto(dom, window);
    const header = layerId => window.$('.course-button-list-layer-header[data-layer-id="' + layerId + '"]');
    const toggle = layerId => header(layerId).find('.course-button-list-layer-collapse');
    const list = layerId => layerId
        ? window.$('.course-button-list-badge-container[data-layer-id="' + layerId + '"]')
        : window.$('#course-button-list .course-button-list-badge-container').first();
    const isCollapsed = layerId => list(layerId).hasClass('course-button-list-layer-collapsed');
    const savedCollapsed = () => JSON.parse(window.localStorage.getItem('collapsedLayers'));
    const deleteLayer = layerId => {
        header(layerId).find('.course-button-list-layer-delete').trigger('click');
        lastDialog().getModalFooter().find('button')
            .filter((i, button) => window.$(button).text() === 'Delete').trigger('click');
    };
    return Object.assign(loaded, { header, toggle, list, isCollapsed, savedCollapsed, deleteLayer, lastDialog });
}

test('collapsing a layer folds its list on this device only, and keeps it on the calendar', () => {
    const { dom, window, stored, header, toggle, isCollapsed, savedCollapsed } = loadCollapsibleLayers();
    try {
        const layersBefore = stored('layers');
        const eventsBefore = window.$('#course-calendar').fullCalendar('clientEvents').length;
        assert.ok(eventsBefore > 0);

        assert.equal(isCollapsed(''), false);
        assert.equal(toggle('').attr('aria-expanded'), 'true');
        assert.equal(toggle('').attr('title'), 'Collapse the layer');
        assert.ok(toggle('').find('i').hasClass('fa-caret-down'));

        toggle('').trigger('click');
        assert.equal(isCollapsed(''), true);
        assert.equal(isCollapsed(PLAN_B), false);
        assert.equal(toggle('').attr('aria-expanded'), 'false');
        assert.equal(toggle('').attr('title'), 'Expand the layer');
        assert.ok(toggle('').find('i').hasClass('fa-caret-right'), 'English is left to right');
        assert.deepEqual(savedCollapsed(), { 202601: ['default'] });

        // The schedule, the calendar and the active layer are unchanged, and nothing is added to undo.
        assert.deepEqual(stored('layers'), layersBefore);
        assert.equal(window.$('#course-calendar').fullCalendar('clientEvents').length, eventsBefore);
        assert.ok(header('').hasClass('course-button-list-layer-active'));
        toggle(PLAN_B).trigger('click');
        assert.ok(!header(PLAN_B).hasClass('course-button-list-layer-active'));
        assert.ok(window.$('#top-navbar-undo').hasClass('d-none'));
        assert.deepEqual(savedCollapsed(), { 202601: ['default', PLAN_B] });

        // The keyboard toggles it too.
        toggle('').trigger(window.$.Event('keydown', { key: 'Enter' }));
        assert.equal(isCollapsed(''), false);
        toggle(PLAN_B).trigger(window.$.Event('keydown', { key: ' ' }));
        assert.equal(isCollapsed(PLAN_B), false);
        assert.equal(window.localStorage.getItem('collapsedLayers'), null, 'nothing collapsed, nothing saved');
    } finally {
        dom.window.close();
    }
});

test('right to left interfaces point the collapsed caret left', () => {
    const dom = createPage('index.html', 'he');
    try {
        const window = loadUI(dom.window);
        loadLayersInto(dom, window);
        const toggle = window.$('.course-button-list-layer-header[data-layer-id=""] .course-button-list-layer-collapse');
        toggle.trigger('click');
        assert.ok(toggle.find('i').hasClass('fa-caret-left'));
        assert.equal(toggle.attr('title'), 'הרחבת השכבה');
    } finally {
        dom.window.close();
    }
});

test('collapsed layers are restored on load and after the schedule changes', () => {
    const { dom, window, header, isCollapsed, savedCollapsed } = loadCollapsibleLayers(
        JSON.stringify({ 202601: [PLAN_B], 202602: ['default'] }));
    try {
        assert.equal(isCollapsed(''), false);
        assert.equal(isCollapsed(PLAN_B), true);

        // Showing the hidden layer rebuilds the list from the schedule.
        header(PLAN_B).find('.course-button-list-layer-visibility').trigger('click');
        assert.ok(!window.$('.course-button-list-badge-container[data-layer-id="' + PLAN_B + '"]').hasClass('course-button-list-layer-hidden'));
        assert.equal(isCollapsed(PLAN_B), true);
        assert.deepEqual(savedCollapsed(), { 202601: [PLAN_B], 202602: ['default'] }, 'other semesters are kept');
    } finally {
        dom.window.close();
    }
});

for (const saved of ['not json', '[1, 2]', '{"202601": "default"}', '{"202601": [3, ""]}']) {
    test('an invalid collapsedLayers item (' + saved + ') leaves the layers expanded and is replaced', () => {
        const { dom, toggle, isCollapsed, savedCollapsed } = loadCollapsibleLayers(saved);
        try {
            assert.equal(isCollapsed(''), false);
            assert.equal(isCollapsed(PLAN_B), false);
            toggle(PLAN_B).trigger('click');
            assert.deepEqual(savedCollapsed()[202601], [PLAN_B]);
        } finally {
            dom.window.close();
        }
    });
}

test('deleting a collapsed layer forgets it', () => {
    const { dom, stored, toggle, deleteLayer, savedCollapsed } = loadCollapsibleLayers();
    try {
        toggle('').trigger('click');
        toggle(PLAN_B).trigger('click');
        deleteLayer(PLAN_B);
        assert.equal(stored('layers'), null, 'the layer was deleted, leaving one');
        assert.deepEqual(savedCollapsed(), { 202601: ['default'] });
    } finally {
        dom.window.close();
    }
});

for (const nextCollapsed of [true, false]) {
    test('deleting the first layer moves the next layer\'s collapsed state (' + nextCollapsed + ') into it', () => {
        const { dom, window, stored, toggle, list, deleteLayer } = loadCollapsibleLayers();
        try {
            toggle(nextCollapsed ? PLAN_B : '').trigger('click');
            deleteLayer('');
            assert.equal(stored('layers'), null, 'only one layer is left');
            const expected = nextCollapsed ? JSON.stringify({ 202601: ['default'] }) : null;
            assert.equal(window.localStorage.getItem('collapsedLayers'), expected);

            // Without layers there's no header, so the list is always shown.
            assert.equal(window.$('.course-button-list-layer-header').length, 0);
            assert.ok(!list('').hasClass('course-button-list-layer-collapsed'));
        } finally {
            dom.window.close();
        }
    });
}

test('adding a course or an event to a collapsed layer expands it', () => {
    const { dom, window, toggle, isCollapsed, lastDialog } = loadCollapsibleLayers();
    try {
        toggle('').trigger('click');
        window.$('#course-select').data('selectize').addItem(ALPHA);
        assert.equal(isCollapsed(''), false);
        assert.equal(window.localStorage.getItem('collapsedLayers'), null);

        toggle('').trigger('click');
        assert.equal(isCollapsed(''), true);
        const before = window.$('#course-button-list .course-button-list-custom-event').length;
        window.$('#course-calendar').fullCalendar('option', 'select')(
            window.moment('2017-01-03T10:00:00'), window.moment('2017-01-03T11:00:00'));
        lastDialog().getModalBody().find('textarea').val('Run');
        lastDialog().getModalFooter().find('button.btn-primary').trigger('click');
        assert.equal(window.$('#course-button-list .course-button-list-custom-event').length, before + 1, 'the event was added');
        assert.equal(isCollapsed(''), false);
        assert.equal(window.localStorage.getItem('collapsedLayers'), null);
    } finally {
        dom.window.close();
    }
});

test('a readonly list can collapse layers too', () => {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const changes = [];
        const list = new window.CourseButtonList(window.$('#course-button-list'), {
            courseManager: new window.CourseManager(window.courses_from_rishum),
            colorGenerator: () => '#000000',
            readonly: true,
            onLayerCollapseChange: (layerId, collapsed) => changes.push([layerId, collapsed])
        });
        list.setLayers([{ id: '', name: 'A' }, { id: 'b', name: 'B', collapsed: true }]);
        const toggle = layerId => window.$('.course-button-list-layer-header[data-layer-id="' + layerId + '"] .course-button-list-layer-collapse');
        assert.ok(window.$('.course-button-list-badge-container[data-layer-id="b"]').hasClass('course-button-list-layer-collapsed'));
        toggle('b').trigger('click');
        toggle('').trigger('click');
        assert.deepEqual(changes, [['b', false], ['', true]]);
        list.expandLayer('');
        list.expandLayer('');
        list.expandLayer('missing');
        assert.deepEqual(changes, [['b', false], ['', true], ['', false]], 'expanding an expanded or missing layer does nothing');
    } finally {
        dom.window.close();
    }
});
