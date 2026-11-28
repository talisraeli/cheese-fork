import type { ScheduleEvent } from '../src/components/course-calendar/calendar-types.ts';
import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { createPage, loadUI, load, loadModule, recordingCalendar } from './helpers.ts';

function createCalendar(language: string) {
    const dom = createPage('index.html', language);
    const window = loadUI(dom.window);
    window.courses_from_rishum[0].schedule.push({
        קבוצה: 11,
        'מס.': 11,
        סוג: 'תרגול',
        יום: 'שלישי',
        שעה: '14:30 - 15:30',
        בניין: 'Example Building',
        חדר: 102,
        'מרצה/מתרגל': 'Teaching Assistant Example'
    });
    const calendar = new window.CourseCalendar(window.$('#course-calendar'), {
        courseManager: new window.CourseManager(window.courses_from_rishum),
        colorGenerator: () => '#336699',
        onCourseConflictedStatusChanged() {},
        onLessonTypesHidden() {}
    });
    return { dom, window, calendar };
}

for (const language of ['en', 'he', 'ar']) {
    test(language + ': a saved lesson retains its Sunday time and exports one localized recurring event', () => {
        const { dom, window, calendar } = createCalendar(language);
        try {
            const savedSchedule = { '01040001': { '05d405e805e605d005d4': 10 } };
            const savedSnapshot = JSON.stringify(savedSchedule);
            calendar.loadSavedSchedule(savedSchedule, {});
            const events = window.$('#course-calendar').fullCalendar<ScheduleEvent>('clientEvents');
            assert.equal(events.length, 2);
            const selected = events.filter(event => event.selected);
            assert.equal(selected.length, 1);
            assert.equal(selected[0].lessonData!['סוג'], 'הרצאה');
            assert.equal(selected[0].start.day(), 0);
            assert.equal(selected[0].start.format('HH:mm'), '10:30');
            assert.equal(selected[0].end.format('HH:mm'), '12:30');
            assert.equal(events.find(event => event.lessonData!['סוג'] === 'תרגול')!.selected, false);

            const calls: unknown[][] = [];
            const count = calendar.saveAsIcs(recordingCalendar(calls), '2026-10-25', '2027-02-01', [
                '2026-11-01',
                '2026-11-02'
            ]);

            assert.equal(count, 1);
            assert.equal(calls.length, 1);
            // What saveAsIcs passes to addEvent: the text, the times, the weekly rule and the days off.
            const [subject, description, location, start, end, recurrence, holidays] = calls[0] as [
                string,
                string,
                string,
                string,
                string,
                { freq: string; until: string },
                Date[]
            ];
            assert.equal(
                subject,
                { en: 'Lecture 10 – Course Alpha', he: 'הרצאה 10 – Course Alpha', ar: 'محاضرة 10 – Course Alpha' }[
                    language
                ]
            );
            assert.equal(description, 'Professor Example');
            assert.equal(location, 'Example Building 101');
            assert.equal(window.moment.parseZone(start).format('YYYY-MM-DDTHH:mm:ss'), '2026-10-25T10:30:00');
            assert.equal(window.moment.parseZone(end).format('YYYY-MM-DDTHH:mm:ss'), '2026-10-25T12:30:00');
            assert.equal(recurrence.freq, 'WEEKLY');
            assert.equal(recurrence.until, '2027-02-02T00:00:00Z');
            assert.equal(holidays.length, 1);
            assert.equal(holidays[0].getFullYear(), 2026);
            assert.equal(holidays[0].getMonth(), 10);
            assert.equal(holidays[0].getDate(), 1);
            assert.equal(holidays[0].getDay(), 0);
            assert.equal(JSON.stringify(savedSchedule), savedSnapshot);
        } finally {
            dom.window.close();
        }
    });

    test(language + ': visible lessons without a saved selection are excluded from the export', () => {
        const { dom, window, calendar } = createCalendar(language);
        try {
            calendar.loadSavedSchedule({ '01040001': {} }, {});
            const events = window.$('#course-calendar').fullCalendar<ScheduleEvent>('clientEvents');
            assert.equal(events.length, 2);
            assert.ok(events.every(event => !event.selected));
            const calls: unknown[][] = [];
            const count = calendar.saveAsIcs(recordingCalendar(calls), '2026-10-25', '2027-02-01', []);
            assert.equal(count, 0);
            assert.equal(calls.length, 0);
        } finally {
            dom.window.close();
        }
    });
}

function octets(line: string) {
    return Buffer.byteLength(line, 'utf8');
}

// RFC 5545 3.1: unfolding removes each line break followed by a space.
function unfold(calendar: string): string {
    return calendar.replace(/\r\n /g, '');
}

test('exported calendars escape text, fold long lines and keep Hebrew characters whole', () => {
    const dom = createPage();
    try {
        const window = dom.window;
        load(window, 'modules/ics.js/ics.deps.min.js');
        Object.assign(window, loadModule<object>(window, 'src/lib/ics-text.ts'));
        let saved: { blob: Blob; filename: string } | null = null;
        window.saveAs = (blob: Blob, filename: string) => {
            saved = { blob, filename };
        };

        const calendar = window.IcsText.wrap(
            window.ics('test', 'CheeseFork²', ['NAME:' + window.IcsText.escapeText('Winter, 2026')], 'Asia/Jerusalem')
        );
        const longTitle = 'הרצאה 10 – ' + 'מבוא למדעי המחשב '.repeat(6).trim();
        calendar.addEvent(
            'Gym; swim, run \\ rest',
            'Staff A\nStaff B',
            'Building 1, room 2',
            '2026-10-25T10:30:00',
            '2026-10-25T12:30:00'
        );
        calendar.addEvent(longTitle, '', '', '2026-10-26T10:30:00', '2026-10-26T12:30:00');

        const text = calendar.build() as string;
        const lines = text.split('\r\n');
        assert.ok(
            lines.every(line => octets(line) <= 75),
            'every line is at most 75 octets'
        );
        assert.ok(
            lines.some(line => line.startsWith(' ')),
            'the long title is folded'
        );
        assert.ok(!text.includes('�'));

        const unfolded = unfold(text).split('\r\n');
        assert.ok(unfolded.includes('NAME:Winter\\, 2026'));
        assert.ok(unfolded.includes('SUMMARY:Gym\\; swim\\, run \\\\ rest'));
        assert.ok(unfolded.includes('DESCRIPTION:Staff A\\nStaff B'));
        assert.ok(unfolded.includes('LOCATION:Building 1\\, room 2'));
        assert.ok(unfolded.includes('SUMMARY:' + longTitle));
        assert.ok(!text.includes('LANGUAGE=en-us'));

        assert.equal(calendar.download('winter-2026-2027'), text);
        assert.equal(saved!.filename, 'winter-2026-2027.ics');
        assert.equal(saved!.blob.type, 'text/calendar;charset=utf-8');
    } finally {
        dom.window.close();
    }
});

test('folding counts octets and never splits a character', () => {
    const dom = createPage();
    try {
        const window = dom.window;
        Object.assign(window, loadModule<object>(window, 'src/lib/ics-text.ts'));
        for (const line of ['A'.repeat(200), 'SUMMARY:' + 'א'.repeat(100), 'SUMMARY:' + '😀'.repeat(40), 'SHORT:ok']) {
            const folded = window.IcsText.foldLine(line);
            const parts = folded.split('\r\n');
            assert.ok(
                parts.every(part => octets(part) <= 75),
                line
            );
            assert.ok(parts.slice(1).every(part => part.startsWith(' ')));
            assert.equal(unfold(folded), line);
            assert.ok(!parts.some(part => /[\uD800-\uDBFF]$/.test(part)), 'no surrogate pair is split');
        }
        assert.equal(window.IcsText.foldLine('SHORT:ok'), 'SHORT:ok');
    } finally {
        dom.window.close();
    }
});

test('lessons are exported with plain text, escaped by the wrapped calendar', () => {
    const { dom, window, calendar } = createCalendar('en');
    try {
        window.courses_from_rishum[0].schedule[0]['מרצה/מתרגל'] = 'Professor Example\nSecond, Lecturer';
        calendar.loadSavedSchedule({ '01040001': { '05d405e805e605d005d4': 10 } }, {});
        const calls: unknown[][] = [];
        calendar.saveAsIcs(recordingCalendar(calls), '2026-10-25', '2027-02-01', []);
        assert.equal(calls[0][1], 'Professor Example\nSecond, Lecturer');
    } finally {
        dom.window.close();
    }
});
