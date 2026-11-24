'use strict';

// The API mirrors the site's layer functions (see functions/lib/schedule.js). These tests run
// the same change on the same saved schedule with both, and compare what each one saves.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createApi } = require('../functions/lib/api');
const { Catalog } = require('../functions/lib/catalog');
const { generateApiKey, hashApiKey } = require('../functions/lib/keys');
const { DELETE } = require('../functions/lib/schedule');
const { createPage, loadUI, load } = require('./helpers.cjs');

const ALPHA = '01040001';
const BETA = '01040002';
const PLAN_B = 'layer1700000001';

function catalogCourses() {
    return [{
        general: { 'מספר מקצוע': ALPHA, 'שם מקצוע': 'Course Alpha', 'נקודות': '3' },
        schedule: [{
            'קבוצה': 11, 'מס.': 10, 'סוג': 'הרצאה', 'יום': 'ראשון', 'שעה': '10:30 - 12:30',
            'בניין': 'Example Building', 'חדר': 101, 'מרצה/מתרגל': 'Professor Example'
        }]
    }, {
        general: { 'מספר מקצוע': BETA, 'שם מקצוע': 'Course Beta', 'נקודות': '2' },
        schedule: [{
            'קבוצה': 21, 'מס.': 20, 'סוג': 'הרצאה', 'יום': 'שני', 'שעה': '12:30 - 14:30',
            'בניין': 'Example Building', 'חדר': 201, 'מרצה/מתרגל': 'Professor Beta'
        }]
    }];
}

// The first layer with Course Alpha, its lecture, a color and a custom event, "Plan B" (hidden)
// with Course Beta, its lecture, a color and a custom event, and an empty "Plan C".
const BUILD = [
    ['POST', '/courses', { course: ALPHA }],
    ['PUT', '/courses/' + ALPHA + '/lessons/lecture', { number: 10 }],
    ['PUT', '/courses/' + ALPHA + '/color', { color: '#bf4040' }],
    ['POST', '/custom-events', { title: 'Gym', day: 'sunday', startTime: '11:00', endTime: '12:00', color: '#336699' }],
    ['POST', '/layers', { name: 'Plan B', hidden: true }],
    ['POST', '/layers', { name: 'Plan C' }],
    ['POST', '/courses', { course: BETA }, { layer: PLAN_B }],
    ['PUT', '/courses/' + BETA + '/lessons/lecture', { number: 20 }, { layer: PLAN_B }],
    ['PUT', '/courses/' + BETA + '/color', { color: '#123456' }, { layer: PLAN_B }],
    ['POST', '/custom-events', { title: 'Work', day: 'monday', startTime: '08:00', endTime: '09:00', color: '#654321' }, { layer: PLAN_B }]
];

function semesterFields(data) {
    const result = {};
    Object.keys(data).filter(key => key.startsWith('202601_')).sort().forEach(key => {
        result[key] = data[key];
    });
    return result;
}

// Runs the requests on an empty schedule and returns the saved fields.
async function withApi(requests) {
    const doc = {};
    const key = generateApiKey();
    let now = 1700000000;
    const api = createApi({
        store: {
            async findKeyOwner(hash) {
                return hash === hashApiKey(key) ? 'user1' : null;
            },
            async read() {
                return JSON.parse(JSON.stringify(doc));
            },
            // Applies the update like Firestore: dotted paths, and DELETE removing fields.
            async transact(uid, semester, change) {
                const { update, result } = change(JSON.parse(JSON.stringify(doc)));
                Object.keys(update).forEach(path => {
                    const segments = path.split('.');
                    let target = doc;
                    segments.slice(0, -1).forEach(segment => {
                        target[segment] = target[segment] || {};
                        target = target[segment];
                    });
                    const last = segments[segments.length - 1];
                    if (update[path] === DELETE) {
                        delete target[last];
                    } else {
                        target[last] = JSON.parse(JSON.stringify(update[path]));
                    }
                });
                return result;
            }
        },
        loadCatalog: async semester => new Catalog(semester, catalogCourses()),
        nowSeconds: () => now++
    });
    for (const [method, path, body, query] of requests) {
        const response = await api({
            method: method,
            path: '/v1/semesters/202601' + path,
            query: query || {},
            headers: { authorization: 'Bearer ' + key },
            body: body
        });
        assert.ok(response.status < 300, method + ' ' + path + ': ' + JSON.stringify(response.body));
    }
    return semesterFields(doc);
}

// Loads the saved fields signed out, runs action on the site, and returns the saved fields.
function withSite(saved, action) {
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        window.courses_from_rishum = catalogCourses();
        Object.keys(saved).forEach(field => window.localStorage.setItem(field, JSON.stringify(saved[field])));
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        const dialogs = [];
        const show = window.BootstrapDialog.show;
        window.BootstrapDialog.show = options => {
            const dialog = show(options);
            dialogs.push(dialog);
            return dialog;
        };
        load(window, 'cheesefork.js');
        action(window, dialogs);

        const result = {};
        for (let i = 0; i < window.localStorage.length; i++) {
            const field = window.localStorage.key(i);
            result[field] = JSON.parse(window.localStorage.getItem(field));
        }
        return semesterFields(result);
    } finally {
        dom.window.close();
    }
}

for (const [name, layerId] of [['the first layer', ''], ['another layer', PLAN_B]]) {
    test('deleting ' + name + ' saves the same as the site', async () => {
        const saved = await withApi(BUILD);
        assert.ok(saved['202601_layers'][PLAN_B], 'the schedule was built');
        assert.deepEqual(Object.keys(saved['202601_colors']).length, 4, 'with the course and event colors');

        const api = await withApi(BUILD.concat([['DELETE', '/layers/' + (layerId || 'default')]]));
        const site = withSite(saved, (window, dialogs) => {
            window.$('.course-button-list-layer-header[data-layer-id="' + layerId + '"] .course-button-list-layer-delete').trigger('click');
            dialogs[dialogs.length - 1].getModalFooter().find('button')
                .filter((i, button) => window.$(button).text() === 'Delete').trigger('click');
        });
        assert.notDeepEqual(site, saved, 'the site deleted the layer');
        assert.deepEqual(api, site);
    });
}
