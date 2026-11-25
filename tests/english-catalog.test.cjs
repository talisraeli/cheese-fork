'use strict';

// The English catalog (ci/english_catalog.py) supplies SAP's English text for the English
// interface only. The catalog data stays in Hebrew for everything else.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI, load } = require('./helpers.cjs');

const COURSE = '01040001';

const ENGLISH_CATALOG = {
    courses: {
        [COURSE]: {
            name: 'Calculus Alpha',
            syllabus: 'The English syllabus.',
            faculty: 'Faculty of Mathematics',
            level: 'Undergraduate Studies',
            notes: 'The English notes.',
            coordinators: 'Prof. Example English'
        }
    },
    staff: { 'Professor Example': 'Prof. Example English' },
    buildings: { 'Example Building': 'Example Hall' }
};

// Loads the site with the course and its lecture selected, and the English catalog loaded.
function loadSchedule(language) {
    const dom = createPage('index.html', language);
    const window = loadUI(dom.window);
    window.courses_english = JSON.parse(JSON.stringify(ENGLISH_CATALOG));
    window.localStorage.setItem('202601_courses', '["' + COURSE + '"]');
    window.localStorage.setItem('202601_' + COURSE, '{"05d405e805e605d005d4":10}');
    window.localStorage.setItem('dontShowIntro', String(Date.now()));
    load(window, 'cheesefork.js');
    return { dom, window };
}

function calendarTitle(window) {
    return window.$('#course-calendar').fullCalendar('clientEvents')[0].title;
}

test('English shows the course name, staff, building and details from the English catalog', () => {
    const { dom, window } = loadSchedule('en');
    try {
        assert.ok(window.document.querySelector('#course-button-list').textContent.includes(COURSE + ' – Calculus Alpha'));

        const title = calendarTitle(window).split('\n');
        assert.deepEqual(title.slice(1), ['Example Hall 101', 'Prof. Example English', 'Calculus Alpha']);

        const manager = new window.CourseManager(window.courses_from_rishum, window.courses_english);
        const description = manager.getDescription(COURSE, {});
        assert.match(description, /^01040001 – Calculus Alpha/);
        assert.ok(description.includes('The English syllabus.'));
        assert.ok(description.includes('The English notes.'));
        assert.ok(description.includes('Prof. Example English'));
        assert.ok(!description.includes('A synthetic course syllabus.'));
        // The site's own faculty and level labels are kept where it has them.
        assert.ok(description.includes('Faculty: Mathematics'));
        assert.ok(description.includes('Study level: Undergraduate'));

        // The course search shows the English name, and finds the course by either name.
        const selectize = window.$('#course-select select, #course-select').filter((i, element) => window.$(element).data('selectize')).data('selectize');
        assert.equal(selectize.options[COURSE].text, COURSE + ' – Calculus Alpha');
        for (const query of ['Calculus', 'Course Alpha']) {
            assert.deepEqual(Array.from(selectize.search(query).items, item => item.id), [COURSE], query);
        }
    } finally {
        dom.window.close();
    }
});

test('Hebrew and Arabic keep the catalog\'s Hebrew text even with the English catalog loaded', () => {
    for (const language of ['he', 'ar']) {
        const { dom, window } = loadSchedule(language);
        try {
            const title = calendarTitle(window);
            assert.ok(title.includes('Example Building 101'), language);
            assert.ok(title.includes('Professor Example'), language);
            assert.ok(title.endsWith('Course Alpha'), language);
            assert.ok(!title.includes('Calculus Alpha'), language);
            assert.ok(window.document.querySelector('#course-button-list').textContent.includes('Course Alpha'), language);
        } finally {
            dom.window.close();
        }
    }
});

test('text missing from the English catalog falls back to the Hebrew catalog', () => {
    const dom = createPage('index.html', 'en');
    try {
        const window = loadUI(dom.window);
        const partial = { courses: { [COURSE]: { name: 'Calculus Alpha' } }, staff: {}, buildings: {} };
        const manager = new window.CourseManager(window.courses_from_rishum, partial);
        const description = manager.getDescription(COURSE, {});
        assert.match(description, /^01040001 – Calculus Alpha/);
        assert.ok(description.includes('A synthetic course syllabus.'));
        assert.ok(description.includes('Synthetic catalog notes.'));
        assert.equal(manager.getStaffLabel('Professor Example'), 'Professor Example');
        assert.equal(manager.getBuildingLabel('Example Building'), 'Example Building');

        // Without an English catalog at all, nothing changes.
        const hebrewOnly = new window.CourseManager(window.courses_from_rishum);
        assert.equal(hebrewOnly.getCourseName(COURSE), 'Course Alpha');
        assert.equal(hebrewOnly.getEnglishText(COURSE, 'syllabus'), null);
    } finally {
        dom.window.close();
    }
});

test('the calendar export uses the English text, and saved lessons stay by their Hebrew types', () => {
    const dom = createPage('index.html', 'en');
    try {
        const window = loadUI(dom.window);
        const calendar = new window.CourseCalendar(window.$('#course-calendar'), {
            courseManager: new window.CourseManager(window.courses_from_rishum, ENGLISH_CATALOG),
            colorGenerator: () => '#336699',
            onCourseConflictedStatusChanged() {},
            onLessonTypesHidden() {}
        });
        calendar.loadSavedSchedule({ [COURSE]: { '05d405e805e605d005d4': 10 } }, {});
        assert.equal(window.$('#course-calendar').fullCalendar('clientEvents')[0].selected, true);

        const calls = [];
        calendar.saveAsIcs({ addEvent(...args) { calls.push(args); } }, '2026-10-25', '2027-02-01', []);
        const [subject, description, location] = calls[0];
        assert.equal(subject, 'Lecture 10 – Calculus Alpha');
        assert.equal(description, 'Prof. Example English');
        assert.equal(location, 'Example Hall 101');
    } finally {
        dom.window.close();
    }
});
