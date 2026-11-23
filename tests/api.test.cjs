'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createApi } = require('../functions/lib/api');
const { Catalog, catalogUrl, parseCatalog, createCatalogLoader } = require('../functions/lib/catalog');
const { generateApiKey, hashApiKey, apiKeyHint, apiKeyFromHeaders } = require('../functions/lib/keys');
const { DELETE, documentPath } = require('../functions/lib/schedule');

const SEMESTER = '202601';
const COURSE = '01040001';

function catalogCourses() {
    return [{
        general: {
            'מספר מקצוע': COURSE,
            'שם מקצוע': 'Course Alpha',
            'נקודות': '3',
            'הערות': 'סדנת רשות: יום ב 14:30-16:30, טאוב 301'
        },
        schedule: [{
            'קבוצה': 11, 'מס.': 10, 'סוג': 'הרצאה', 'יום': 'ראשון', 'שעה': '10:30 - 12:30',
            'בניין': 'Example Building', 'חדר': 101, 'מרצה/מתרגל': 'Professor Example'
        }, {
            'קבוצה': 11, 'מס.': 11, 'סוג': 'תרגול', 'יום': 'שני', 'שעה': '12:30 - 13:30',
            'בניין': 'Example Building', 'חדר': 102, 'מרצה/מתרגל': 'TA Example'
        }]
    }, {
        general: { 'מספר מקצוע': '01040002', 'שם מקצוע': 'Course Beta' },
        schedule: []
    }];
}

// Applies update maps like Firestore does: dotted paths, and DELETE removing fields.
function createMemoryStore() {
    const docs = {};
    const keys = {};

    function apply(doc, update) {
        Object.keys(update).forEach(key => {
            const segments = key.split('.');
            let target = doc;
            segments.slice(0, -1).forEach(segment => {
                target[segment] = target[segment] || {};
                target = target[segment];
            });
            const last = segments[segments.length - 1];
            if (update[key] === DELETE) {
                delete target[last];
            } else {
                target[last] = JSON.parse(JSON.stringify(update[key]));
            }
        });
    }

    return {
        docs: docs,
        keys: keys,
        async findKeyOwner(hash) {
            return keys[hash] || null;
        },
        async userInfo(uid) {
            return { uid: uid, displayName: 'Test User' };
        },
        async read(uid, semester) {
            return JSON.parse(JSON.stringify(docs[documentPath(uid, semester)] || {}));
        },
        async transact(uid, semester, change) {
            const path = documentPath(uid, semester);
            const { update, result } = change(JSON.parse(JSON.stringify(docs[path] || {})));
            if (Object.keys(update).length > 0) {
                docs[path] = docs[path] || { displayName: 'Test User' };
                apply(docs[path], update);
            }
            return result;
        }
    };
}

function setup() {
    const store = createMemoryStore();
    const key = generateApiKey();
    store.keys[hashApiKey(key)] = 'user1';
    let now = 1700000000;
    const api = createApi({
        store: store,
        loadCatalog: async semester => {
            if (semester !== SEMESTER) {
                const { ApiError } = require('../functions/lib/errors');
                throw new ApiError(404, 'semester_not_found', 'No catalog.');
            }
            return new Catalog(semester, catalogCourses());
        },
        nowSeconds: () => now
    });
    const call = (method, path, body, query) => api({
        method: method,
        path: path,
        query: query || {},
        headers: { authorization: 'Bearer ' + key },
        body: body
    });
    const doc = () => store.docs[documentPath('user1', SEMESTER)];
    return { store, key, api, call, doc, tick: () => now++ };
}

const base = '/v1/semesters/' + SEMESTER;

test('API keys are random, hashed and read from the headers', () => {
    const key = generateApiKey();
    assert.match(key, /^cf2_[A-Za-z0-9_-]{43}$/);
    assert.notEqual(generateApiKey(), key);
    assert.equal(hashApiKey(key).length, 64);
    assert.equal(apiKeyHint(key), key.slice(0, 10));
    assert.equal(apiKeyFromHeaders({ authorization: 'Bearer ' + key }), key);
    assert.equal(apiKeyFromHeaders({ 'x-api-key': key }), key);
    assert.equal(apiKeyFromHeaders({}), null);
});

test('requests need a valid API key', async () => {
    const { api } = setup();
    const request = headers => api({ method: 'GET', path: base + '/courses', query: {}, headers: headers });

    let response = await request({});
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'missing_api_key');

    response = await request({ authorization: 'Bearer ' + generateApiKey() });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'invalid_api_key');
});

test('unknown paths and methods are rejected', async () => {
    const { call } = setup();
    assert.equal((await call('GET', '/v1/nothing')).status, 404);
    assert.equal((await call('PATCH', base + '/courses')).status, 405);
    assert.equal((await call('GET', '/v1/semesters/2026/courses')).body.error.code, 'invalid_semester');
});

test('courses are added and listed as the site saves them', async () => {
    const { call, doc } = setup();

    let response = await call('GET', base + '/courses');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { semester: SEMESTER, layer: 'default', courses: [] });

    response = await call('POST', base + '/courses', { course: COURSE });
    assert.equal(response.status, 201);
    assert.equal(response.body.name, 'Course Alpha');

    assert.equal(doc().displayName, 'Test User');
    assert.deepEqual(doc()[SEMESTER + '_courses'], [COURSE]);
    assert.deepEqual(doc()[SEMESTER + '_' + COURSE], {});
    // The metadata includes the workshop that course-manager.js extracts from the notes.
    const metadata = doc()[SEMESTER + '_metadata_' + COURSE];
    assert.equal(metadata.general['שם מקצוע'], 'Course Alpha');
    assert.ok(metadata.schedule.some(lesson => lesson['סוג'] === 'sadna'));

    assert.equal((await call('POST', base + '/courses', { course: COURSE })).status, 409);
    assert.equal((await call('POST', base + '/courses', { course: '01049999' })).body.error.code, 'course_not_found');
    assert.equal((await call('POST', base + '/courses', { course: 'abc' })).body.error.code, 'invalid_course');
    assert.equal((await call('POST', '/v1/semesters/209901/courses', { course: COURSE })).status, 404);

    response = await call('GET', base + '/courses');
    assert.deepEqual(response.body.courses, [{ course: COURSE, name: 'Course Alpha', lessons: {}, color: null }]);
});

test('lessons are selected by Hebrew type or English alias and validated', async () => {
    const { call, doc } = setup();
    await call('POST', base + '/courses', { course: COURSE });

    let response = await call('PUT', base + '/courses/' + COURSE + '/lessons/lecture', { number: 10 });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { course: COURSE, type: 'הרצאה', number: 10 });

    response = await call('PUT', base + '/courses/' + COURSE + '/lessons/' + 'תרגול', { number: '11' });
    assert.equal(response.status, 200);
    assert.deepEqual(doc()[SEMESTER + '_' + COURSE], { 'הרצאה': 10, 'תרגול': 11 });

    response = await call('PUT', base + '/courses/' + COURSE + '/lessons/workshop', { number: 101 });
    assert.equal(response.status, 200, JSON.stringify(response.body));

    assert.equal((await call('PUT', base + '/courses/' + COURSE + '/lessons/lecture', { number: 99 })).body.error.code, 'lesson_not_found');
    assert.equal((await call('PUT', base + '/courses/' + COURSE + '/lessons/lab', { number: 1 })).body.error.code, 'lesson_type_not_found');
    assert.equal((await call('PUT', base + '/courses/01040002/lessons/lecture', { number: 1 })).body.error.code, 'lesson_type_not_found');

    assert.equal((await call('DELETE', base + '/courses/' + COURSE + '/lessons/tutorial')).status, 204);
    assert.deepEqual(doc()[SEMESTER + '_' + COURSE], { 'הרצאה': 10, 'סדנה': 101 });
    assert.equal((await call('DELETE', base + '/courses/' + COURSE + '/lessons/tutorial')).status, 404);
    assert.equal((await call('DELETE', base + '/courses/' + COURSE + '/lessons/__proto__')).status, 404);
});

test('removing a course removes its lessons and metadata', async () => {
    const { call, doc } = setup();
    await call('POST', base + '/courses', { course: COURSE });
    await call('PUT', base + '/courses/' + COURSE + '/color', { color: '#BF4040' });
    assert.deepEqual(doc()[SEMESTER + '_colors'], { [COURSE]: '#bf4040' });

    assert.equal((await call('DELETE', base + '/courses/' + COURSE)).status, 204);
    assert.deepEqual(doc()[SEMESTER + '_courses'], []);
    assert.equal(doc()[SEMESTER + '_' + COURSE], undefined);
    assert.equal(doc()[SEMESTER + '_metadata_' + COURSE], undefined);
    assert.equal((await call('DELETE', base + '/courses/' + COURSE)).status, 404);
});

test('custom events use the calendar week dates and remove their color', async () => {
    const { call, doc, tick } = setup();

    let response = await call('POST', base + '/custom-events', {
        title: ' Gym ', day: 'monday', startTime: '08:30', endTime: '24:00', color: '#4080BF'
    });
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
        id: '1700000000', title: 'Gym', start: '2017-01-02T08:30:00', end: '2017-01-03T00:00:00',
        day: 'monday', startTime: '08:30', endTime: '24:00', color: '#4080bf'
    });
    assert.deepEqual(doc()[SEMESTER + '_custom_events'], {
        1700000000: { title: 'Gym', start: '2017-01-02T08:30:00', end: '2017-01-03T00:00:00' }
    });

    // Same second: the id is incremented as in the client.
    response = await call('POST', base + '/custom-events', { title: 'Work', day: 'sunday', startTime: '10:00', endTime: '12:00' });
    assert.equal(response.body.id, '1700000001');
    tick();

    response = await call('PATCH', base + '/custom-events/1700000001', { startTime: '11:00' });
    assert.equal(response.body.start, '2017-01-01T11:00:00');
    assert.equal(response.body.end, '2017-01-01T12:00:00');

    assert.equal((await call('PATCH', base + '/custom-events/1700000001', { startTime: '13:00' })).body.error.code, 'invalid_time');
    assert.equal((await call('POST', base + '/custom-events', { title: 'x', day: 'someday', startTime: '10:00', endTime: '11:00' })).body.error.code, 'invalid_day');
    assert.equal((await call('POST', base + '/custom-events', { day: 'monday', startTime: '10:00', endTime: '11:00' })).body.error.code, 'invalid_title');

    assert.equal((await call('DELETE', base + '/custom-events/1700000000')).status, 204);
    assert.equal(doc()[SEMESTER + '_colors'], undefined);
    assert.equal((await call('GET', base + '/custom-events')).body.customEvents.length, 1);
    assert.equal((await call('DELETE', base + '/custom-events/1700000000')).status, 404);
});

test('layers are addressed with the layer query parameter', async () => {
    const { store, call, doc } = setup();
    store.docs[documentPath('user1', SEMESTER)] = {
        [SEMESTER + '_courses']: ['01040002'],
        [SEMESTER + '_01040002']: {},
        [SEMESTER + '_layers']: { default: { name: 'Plan A' }, layer1: { name: 'Plan B', courses: [], customEvents: {} } }
    };

    let response = await call('POST', base + '/courses', { course: COURSE }, { layer: 'layer1' });
    assert.equal(response.status, 201);
    assert.deepEqual(doc()[SEMESTER + '_layers'].layer1.courses, [COURSE]);
    assert.deepEqual(doc()[SEMESTER + '_layer1_' + COURSE], {});
    assert.deepEqual(doc()[SEMESTER + '_courses'], ['01040002']);
    // The existing schedule has no metadata at all, so the client doesn't track changes for it.
    assert.equal(doc()[SEMESTER + '_metadata_' + COURSE], undefined);

    await call('PUT', base + '/courses/' + COURSE + '/color', { color: '#40bf40' }, { layer: 'layer1' });
    assert.deepEqual(doc()[SEMESTER + '_colors'], { ['layer1_' + COURSE]: '#40bf40' });

    response = await call('POST', base + '/custom-events', { title: 'B', day: 'friday', startTime: '09:00', endTime: '10:00' }, { layer: 'layer1' });
    assert.equal(response.status, 201);
    assert.ok(doc()[SEMESTER + '_layers'].layer1.customEvents[response.body.id]);

    response = await call('GET', base + '/schedule');
    assert.deepEqual(response.body.layers.map(layer => [layer.id, layer.name, layer.courses.map(item => item.course)]), [
        ['default', 'Plan A', ['01040002']],
        ['layer1', 'Plan B', [COURSE]]
    ]);

    assert.equal((await call('GET', base + '/courses', undefined, { layer: 'layer7' })).body.error.code, 'layer_not_found');
});

test('the catalog endpoint lists the lessons to choose from', async () => {
    const { call } = setup();
    const response = await call('GET', base + '/catalog/' + COURSE);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.lessons.map(lesson => [lesson.type, lesson.number]), [
        ['הרצאה', 10], ['תרגול', 11], ['סדנה', 101]
    ]);
});

test('catalog files are located and parsed like in index.html', async () => {
    assert.equal(catalogUrl('202301'), 'https://ug.cheesefork.cf/courses_202301.min.js');
    assert.equal(catalogUrl('202601'), 'https://sap.cheesefork.cf/courses_2026_200.min.js');
    assert.equal(catalogUrl('202602'), 'https://sap.cheesefork.cf/courses_2026_201.min.js');
    assert.deepEqual(parseCatalog('var courses_from_rishum = [{"a": 1}];\n'), [{ a: 1 }]);

    let fetches = 0;
    const loadCatalog = createCatalogLoader(async () => {
        fetches++;
        return { ok: true, status: 200, text: async () => 'var courses_from_rishum = ' + JSON.stringify(catalogCourses()) + ';' };
    }, () => 0);
    assert.equal((await loadCatalog(SEMESTER)).name(COURSE), 'Course Alpha');
    await loadCatalog(SEMESTER);
    assert.equal(fetches, 1);

    const missing = createCatalogLoader(async () => ({ ok: false, status: 404 }), () => 0);
    await assert.rejects(missing('209901'), { code: 'semester_not_found' });
});

test('early semesters are saved in the user document', () => {
    assert.equal(documentPath('u', '201701'), 'users/u');
    assert.equal(documentPath('u', '202601'), 'users/u/semesters/202601');
});
