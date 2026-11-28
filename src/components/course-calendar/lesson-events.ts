import type { Moment } from 'moment';
import type { CourseManager, Lesson, TimeRange } from '../../lib/course-manager.js';
import type { CourseCalendar } from './course-calendar.js';
import type { LessonEvent, ScheduleEvent } from './calendar-types.js';

// The calendar events of lessons and custom events, and the state they show: selected,
// conflicted, or hidden, and the hours and days the calendar shows for them.

// The week of a date in the calendar: 1 for the displayed week, 2017-01-01 to 2017-01-07, and
// more for the lessons kept in later weeks while they aren't shown. Unlike moment's week(), it
// doesn't depend on the locale, whose weeks can start on another day, such as Saturday in Arabic.
export function calendarWeek(date: Moment): number {
    const days = (Date.UTC(date.year(), date.month(), date.date()) - Date.UTC(2017, 0, 1)) / 86400000;
    return Math.floor(days / 7) + 1;
}

export function stringHexEncode(str: string): string {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const hex = str.charCodeAt(i).toString(16);
        result += `000${hex}`.slice(-4);
    }
    return result;
}

export function getLessonType(courseNumber: string, lesson: Lesson): string {
    // Sport courses have a non-standard format, treat all of the lessons as the same type.
    if (/^(394[89]\d\d|03940[89]\d\d)$/.test(courseNumber)) {
        return 'sport';
    } else {
        return stringHexEncode(lesson['סוג']);
    }
}

export function getEventLessonType(event: LessonEvent): string {
    return getLessonType(event.courseNumber, event.lessonData);
}

// Layers: each event belongs to a layer, and courses of different layers are independent of
// each other, so the same course can be in several layers with different lessons selected.
// The id of the first layer is an empty string, which keeps ids and class names as they
// were before layers were introduced.
export function isSameCourse(event: ScheduleEvent, course: string, layerId: string): event is LessonEvent {
    return event.courseNumber === course && event.layerId === layerId;
}

export function getCourseClassName(course: string, layerId: string): string {
    return `calendar-item-${layerId ? `layer-${layerId}-` : ''}course-${course}`;
}

export function updateLessonEvents(calendar: JQuery, events: ScheduleEvent[]): void {
    const updates = events.map(event => {
        const update: Partial<ScheduleEvent> = $.extend({}, event); // make a copy

        // Delete properties which are not shared among events with the same id.
        delete update.title;
        delete update.lessonData;
        return update;
    });
    calendar.fullCalendar('updateEvents', updates);
}

export function updateLessonEvent(calendar: JQuery, event: ScheduleEvent): void {
    updateLessonEvents(calendar, [event]);
}

export function getCourseConflictedStatus(calendar: JQuery, course: string, layerId: string): boolean {
    const lessonTypesAvailable: Record<string, true> = {};
    const lessonTypesVisible: Record<string, true> = {};

    calendar.fullCalendar<ScheduleEvent>('clientEvents', event => {
        if (!isSameCourse(event, course, layerId) || event.lessonTypeHidden) {
            return false;
        }

        const type = getLessonType(course, event.lessonData);
        lessonTypesAvailable[type] = true;
        if (calendarWeek(event.start) === 1) {
            lessonTypesVisible[type] = true;
        }

        return false;
    });

    return Object.keys(lessonTypesAvailable).some(type => !lessonTypesVisible[type]);
}

export function getCourseHiddenLessonTypes(
    calendar: JQuery,
    course: string,
    courseManager: CourseManager,
    layerId: string
): string[] {
    const lessonTypesHidden: Record<string, true> = {};

    calendar.fullCalendar<ScheduleEvent>('clientEvents', event => {
        if (!isSameCourse(event, course, layerId) || !event.lessonTypeHidden) {
            return false;
        }

        const lesson = event.lessonData;
        const lessonType = courseManager.getLessonType(lesson);
        lessonTypesHidden[lessonType] = true;

        return false;
    });

    return Object.keys(lessonTypesHidden);
}

export function updateCalendarMaxDayAndTime(calendar: JQuery, ignoreHover?: boolean): void {
    let minTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T08:30:00');
    let maxTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T18:30:00');
    let maxDay = 4;

    calendar.fullCalendar<ScheduleEvent>('clientEvents', event => {
        // Only displayed events determine the visible range.
        if (calendarWeek(event.start) !== 1) {
            return false;
        }

        // Subtract one minute to treat 24:00 as the previous day.
        const endDay = event.end.clone().add(-1, 'minute').day();
        if (maxDay < endDay) {
            maxDay = endDay;
        }

        const start = event.start.clone().set({ year: 2017, month: 0, date: 1 });
        let end = event.end.clone().set({ year: 2017, month: 0, date: 1 });

        if (event.end.day() !== event.start.day()) {
            // Event spans to more than one day, display up to 24:00 to make sure it's visible.
            end = calendar.fullCalendar('getCalendar').moment('2017-01-01T24:00:00');
        }

        if (minTime.isAfter(start)) {
            minTime = start;
        }

        if (maxTime.isBefore(end)) {
            maxTime = end;
        }

        return false;
    });

    // Round to the nearest half hour.
    if (minTime.minute() >= 30) {
        minTime.set({ minute: 30, second: 0, millisecond: 0 });
    } else {
        minTime.set({ minute: 0, second: 0, millisecond: 0 });
    }

    if (maxTime.hour() === 0) {
        maxTime.set({ minute: 0, second: 0, millisecond: 0 });
    } else if (maxTime.minute() > 30) {
        maxTime.set({ hour: maxTime.hour() + 1, minute: 0, second: 0, millisecond: 0 });
    } else if (maxTime.minute() > 0) {
        maxTime.set({ minute: 30, second: 0, millisecond: 0 });
    } else {
        maxTime.set({ minute: 0, second: 0, millisecond: 0 });
    }

    // As the calendar's options, HH:mm:ss, so they compare as text.
    let minTimeText = minTime.format('HH:mm:ss');
    let maxTimeText = maxTime.format('kk:mm:ss');
    let hiddenDays: number[] = [];
    for (let i = maxDay + 1; i < 7; i++) {
        hiddenDays.push(i);
    }

    const currentMinTime = calendar.fullCalendar('option', 'minTime') as string;
    const currentMaxTime = calendar.fullCalendar('option', 'maxTime') as string;
    const currentHiddenDays = calendar.fullCalendar('option', 'hiddenDays') as number[];

    // Shrinking the range shifts the layout under the pointer, wait until it leaves.
    if (!ignoreHover && calendar.is(':hover')) {
        if (minTimeText > currentMinTime) {
            minTimeText = currentMinTime;
        }

        if (maxTimeText < currentMaxTime) {
            maxTimeText = currentMaxTime;
        }

        if (hiddenDays.length > currentHiddenDays.length) {
            hiddenDays = currentHiddenDays;
        }
    }

    // Only apply options that changed, avoids re-rendering if not needed, which is very slow.
    const newOptions: { minTime?: string; maxTime?: string; hiddenDays?: number[] } = {};

    if (minTimeText !== currentMinTime) {
        newOptions.minTime = minTimeText;
    }

    if (maxTimeText !== currentMaxTime) {
        newOptions.maxTime = maxTimeText;
    }

    if (JSON.stringify(hiddenDays) !== JSON.stringify(currentHiddenDays)) {
        newOptions.hiddenDays = hiddenDays;
    }

    if (Object.keys(newOptions).length > 0) {
        calendar.fullCalendar('option', newOptions);
    }
}

export function areEventsOverlapping(event1: ScheduleEvent, event2: ScheduleEvent): boolean {
    if (event1.start.day() !== event2.start.day()) {
        return false;
    }

    const startTime1 = event1.start.clone().year(0).month(0).date(1);
    const endTime1 = event1.end.clone().year(0).month(0).date(1);
    const startTime2 = event2.start.clone().year(0).month(0).date(1);
    const endTime2 = event2.end.clone().year(0).month(0).date(1);

    return startTime1.isBefore(endTime2) && endTime1.isAfter(startTime2);
}

export function makeLessonEvent(
    courseCalendar: CourseCalendar,
    course: string,
    lesson: Lesson,
    layerId: string
): LessonEvent {
    const lessonType = getLessonType(course, lesson);
    // Every lesson of the catalog has a time.
    const lessonStartEnd = courseCalendar.courseManager.parseLessonTime(lesson['שעה']) as TimeRange;

    const dayMapping: Record<string, number> = {
        ראשון: 1,
        שני: 2,
        שלישי: 3,
        רביעי: 4,
        חמישי: 5,
        שישי: 6,
        א: 1,
        ב: 2,
        ג: 3,
        ד: 4,
        ה: 5,
        ו: 6
    };

    const lessonStartDay = dayMapping[lesson['יום']];
    let lessonEndDay = lessonStartDay;
    if (lessonStartEnd.end === '00:00') {
        lessonEndDay++;
    }

    const eventStartEnd = {
        start: courseCalendar.element
            .fullCalendar('getCalendar')
            .moment(`2017-01-0${lessonStartDay}T${lessonStartEnd.start}:00`),
        end: courseCalendar.element
            .fullCalendar('getCalendar')
            .moment(`2017-01-0${lessonEndDay}T${lessonStartEnd.end}:00`)
    };

    const eventId = `${(layerId ? `${layerId}.` : '') + course}.${lesson['מס.']}.${lessonType}`;
    const courseClassName = getCourseClassName(course, layerId);

    const courseManager = courseCalendar.courseManager;

    let title = courseManager.getLessonTypeAndNumber(lesson);
    if (lesson['בניין']) {
        title += `\n${courseManager.getBuildingLabel(lesson['בניין'])}`;
        if (lesson['חדר']) {
            title += ` ${lesson['חדר']}`;
        }
    }
    if (lesson['מרצה/מתרגל']) {
        let staffLines = lesson['מרצה/מתרגל'].split('\n').map(name => courseManager.getStaffLabel(name));
        if (staffLines.length > 3) {
            const staffLinesCount = staffLines.length;
            staffLines = staffLines.slice(0, 2);
            staffLines.push(CheeseI18n.t('calendar.moreStaff', { count: staffLinesCount - 2 }));
        }

        title += `\n${staffLines.join('\n')}`;
    }
    title += `\n${courseManager.getCourseName(course)}`;

    return {
        id: eventId,
        title,
        start: eventStartEnd.start,
        end: eventStartEnd.end,
        backgroundColor: courseCalendar.colorGenerator(course, null, layerId),
        textColor: courseCalendar.textColorGenerator(course, null, layerId),
        borderColor: 'white',
        className: `${courseClassName} ${courseClassName}-type-${lessonType} ${courseClassName}-lesson-${lesson['מס.']}`,
        courseNumber: course,
        layerId,
        lessonData: lesson,
        selected: false,
        temporary: false
    };
}

export function initCreateCourseEvents(courseCalendar: CourseCalendar, course: string, layerId: string): LessonEvent[] {
    const schedule = courseCalendar.courseManager.getSchedule(course);
    if (schedule.length === 0) {
        return [];
    }

    const lessonsAdded: Record<number, number> = {};
    const events: LessonEvent[] = [];

    for (const lesson of schedule) {
        if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
            continue;
        }

        events.push(makeLessonEvent(courseCalendar, course, lesson, layerId));
        lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
    }

    return events;
}

export function makeCustomEvent(
    courseCalendar: CourseCalendar,
    eventId: string,
    eventTitle: string,
    start: Moment,
    end: Moment,
    layerId: string
): ScheduleEvent {
    return {
        id: eventId,
        // The event id is added as a class only if it's safe to use as one.
        className: `custom-event${/^custom_event_\d+$/.test(eventId) ? ` calendar-item-${eventId}` : ''}`,
        title: eventTitle,
        start,
        end,
        backgroundColor: courseCalendar.colorGenerator(eventTitle, eventId),
        textColor: courseCalendar.textColorGenerator(eventTitle, eventId),
        borderColor: 'white',
        editable: !courseCalendar.readonly,
        constraint: {
            start: '2017-01-01T00:00:00',
            end: '2017-01-07T24:00:00'
        },
        courseNumber: null,
        layerId,
        lessonData: null,
        selected: true,
        temporary: false
    };
}
