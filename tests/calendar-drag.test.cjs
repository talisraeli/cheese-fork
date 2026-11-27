'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPage, loadUI } = require('./helpers.cjs');

// A calendar with a custom event from 22:00 to 24:00, which extends the range to 24:00, and
// a pointer whose hover state the test controls.
function createCalendar() {
    const dom = createPage('index.html', 'en');
    const window = loadUI(dom.window);
    const pointer = { overCalendar: false };
    window.$.expr.pseudos.hover = () => pointer.overCalendar;
    const element = window.$('#course-calendar');
    const calendar = new window.CourseCalendar(element, {
        courseManager: new window.CourseManager(window.courses_from_rishum),
        colorGenerator: () => '#336699',
        onCourseConflictedStatusChanged() {},
        onLessonTypesHidden() {},
        onCustomEventUpdated() {}
    });
    calendar.loadSavedSchedule({}, {
        1: { title: 'Late event', start: '2017-01-01T22:00:00', end: '2017-01-02T00:00:00' }
    });
    const event = element.fullCalendar('clientEvents')[0];
    return { dom, window, element, event, pointer };
}

const option = (element, name) => element.fullCalendar('option', name);
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

// Moves the event to 10:00-12:00 while the pointer is over the calendar, as a drag does.
function moveEventUp(element, event) {
    option(element, 'eventDragStart')?.(event);
    event.start = event.start.clone().set({ hour: 10 });
    event.end = event.start.clone().add(2, 'hours');
    element.fullCalendar('updateEvent', event);
    option(element, 'eventDragStop')?.(event);
    option(element, 'eventDrop')(event);
}

test('the range extends to 24:00 for an event that ends at midnight', () => {
    const { dom, element } = createCalendar();
    try {
        assert.equal(option(element, 'maxTime'), '24:00:00');
    } finally {
        dom.window.close();
    }
});

test('leaving the calendar while no event is dragged shrinks the range', async () => {
    const { dom, element, event, pointer } = createCalendar();
    try {
        pointer.overCalendar = true;
        moveEventUp(element, event);
        await nextTask();
        assert.equal(option(element, 'maxTime'), '24:00:00', 'kept while the pointer is over the calendar');

        pointer.overCalendar = false;
        element.trigger('mouseleave');
        assert.equal(option(element, 'maxTime'), '18:30:00');
    } finally {
        dom.window.close();
    }
});

for (const kind of ['Resize', 'Drag']) {
    test(kind.toLowerCase() + ': leaving the calendar mid-' + kind.toLowerCase() + ' does not re-render it until it stops', async () => {
        const { dom, element, event, pointer } = createCalendar();
        try {
            pointer.overCalendar = true;
            moveEventUp(element, event);
            await nextTask();

            // Records the options set on the calendar, each of which re-renders it.
            const optionChanges = [];
            const original = element.fullCalendar;
            element.fullCalendar = function (method, value) {
                if (method === 'option' && typeof value === 'object') {
                    optionChanges.push(value);
                }
                return original.apply(this, arguments);
            };

            option(element, 'event' + kind + 'Start')?.(event);
            // The pointer leaves past the bottom of the grid, as in issue #64.
            pointer.overCalendar = false;
            element.trigger('mouseleave');
            assert.deepEqual(optionChanges, [], 'no range change mid-' + kind.toLowerCase());
            assert.equal(option(element, 'maxTime'), '24:00:00');

            // Released outside of the grid, so FullCalendar reverts it and no drop or resize follows.
            option(element, 'event' + kind + 'Stop')?.(event);
            assert.equal(option(element, 'maxTime'), '24:00:00', 'deferred until FullCalendar finishes');
            await nextTask();
            assert.equal(option(element, 'maxTime'), '18:30:00', 'shrunk once it stopped outside');
            assert.equal(element.find('.fc-time-grid').length, 1, 'a single time grid');
        } finally {
            dom.window.close();
        }
    });
}

test('a drag that stops over the calendar keeps the range until the pointer leaves', async () => {
    const { dom, element, event, pointer } = createCalendar();
    try {
        pointer.overCalendar = true;
        moveEventUp(element, event);
        option(element, 'eventResizeStart')?.(event);
        option(element, 'eventResizeStop')?.(event);
        await nextTask();
        assert.equal(option(element, 'maxTime'), '24:00:00');

        pointer.overCalendar = false;
        element.trigger('mouseleave');
        assert.equal(option(element, 'maxTime'), '18:30:00');
    } finally {
        dom.window.close();
    }
});

test('a new drag that starts before the previous update runs is not cut short', async () => {
    const { dom, element, event, pointer } = createCalendar();
    try {
        pointer.overCalendar = true;
        moveEventUp(element, event);
        pointer.overCalendar = false;
        option(element, 'eventDragStart')?.(event);
        await nextTask();
        assert.equal(option(element, 'maxTime'), '24:00:00');
        element.trigger('mouseleave');
        assert.equal(option(element, 'maxTime'), '24:00:00');
    } finally {
        dom.window.close();
    }
});
