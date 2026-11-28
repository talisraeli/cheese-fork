// Importing an iCalendar file exported by the original CheeseFork (or by CheeseFork²).
//
// The export has a weekly recurring event for each selected lesson and custom event, and a
// one-time event for each exam. A lesson's summary is "<type> <number> - <course name>", or
// "סדנה - <course name>" for a workshop, so lessons are matched to the catalog of the current
// semester by the course name, the lesson type and the lesson number, and by the day and the
// time when that's not enough. Exams are skipped, since they come with the courses.

import type { CourseManager, Lesson } from './course-manager.js';

export interface IcsProperty {
    params: Record<string, string>;
    value: string;
}

// A VEVENT, by property names in upper case.
export type IcsEvent = Record<string, IcsProperty | undefined>;

// The day of the week (0 is Sunday) and the time as HH:mm.
interface DayTime {
    day: number;
    time: string;
}

export interface ImportedCustomEvent {
    title: string;
    day: number;
    start: string;
    end: string;
}

export interface IcsImportResult {
    // Course number to {lesson type key: lesson number}.
    courses: Record<string, Record<string, number>>;
    // The courses, in the order of the file.
    courseOrder: string[];
    customEvents: ImportedCustomEvent[];
    unmatched: string[];
}

interface FoundLesson {
    course: string | null;
    lesson: Lesson | null;
}

// Unfolds the lines of an iCalendar text and returns its VEVENT components, each an object
// of property names to {params, value}, with the text values unescaped.
function parseEvents(text: string): IcsEvent[] {
    const lines = String(text)
        .replace(/\r\n?/g, '\n')
        .replace(/\n[ \t]/g, '')
        .split('\n');
    const events: IcsEvent[] = [];
    let current: IcsEvent | null = null;

    lines.forEach(line => {
        if (line === 'BEGIN:VEVENT') {
            current = {};
            return;
        }
        if (line === 'END:VEVENT') {
            if (current) {
                events.push(current);
            }
            current = null;
            return;
        }
        if (!current) {
            return;
        }

        const colon = line.indexOf(':');
        if (colon === -1) {
            return;
        }
        const nameAndParams = line.slice(0, colon).split(';');
        const name = nameAndParams[0].toUpperCase();
        const params: Record<string, string> = {};
        nameAndParams.slice(1).forEach(param => {
            const eq = param.indexOf('=');
            if (eq !== -1) {
                params[param.slice(0, eq).toUpperCase()] = param.slice(eq + 1);
            }
        });
        if (!current[name]) {
            current[name] = { params, value: line.slice(colon + 1) };
        }
    });

    return events;
}

function unescapeText(value: string | null | undefined): string {
    return String(value || '').replace(/\\([\\;,nN])/g, (match, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

// Returns {day, time} of a DATE-TIME property: the day of the week (0 is Sunday) and the
// time as HH:mm, in the time of the file, or in local time for a UTC time. Null for a date.
function parseDateTime(property: IcsProperty | undefined): DayTime | null {
    if (!property) {
        return null;
    }
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(property.value);
    if (!match) {
        return null;
    }
    let date;
    if (match[7]) {
        date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
    } else {
        date = new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
    }
    const pad = (n: number): string => `0${n}`.slice(-2);
    return {
        day: date.getDay(),
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
    };
}

// Returns {courses, customEvents, unmatched}:
// - courses: course number to {lesson type key: lesson number}, in the order of the file.
// - customEvents: {title, day, start, end} of the recurring events that aren't lessons.
// - unmatched: the summaries of the lessons that aren't in the catalog of this semester.
// lessonTypeKey(course, lesson) returns the key that a selected lesson is saved under.
function match(
    text: string,
    courseManager: CourseManager,
    lessonTypeKey: (course: string, lesson: Lesson) => string
): IcsImportResult {
    const result: IcsImportResult = { courses: {}, courseOrder: [], customEvents: [], unmatched: [] };

    const coursesByName: Record<string, string[]> = {};
    const addName = (name: string | undefined, course: string): void => {
        name = String(name || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (name) {
            coursesByName[name] = coursesByName[name] || [];
            if (!coursesByName[name].includes(course)) {
                coursesByName[name].push(course);
            }
        }
    };
    courseManager.getAllCourses().forEach(course => {
        addName(courseManager.getGeneralInfo(course)['שם מקצוע'], course);
        addName(courseManager.getCourseName(course), course);
    });

    const typeMatches = (lesson: Lesson, type: string): boolean =>
        lesson['סוג'] === type ||
        courseManager.getLessonType(lesson) === type ||
        courseManager.getLessonTypeLabel(lesson['סוג']) === type;

    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const timeMatches = (lesson: Lesson, when: DayTime | null): boolean => {
        if (!when) {
            return false;
        }
        const time = courseManager.parseLessonTime(lesson['שעה']);
        return lesson['יום'] === dayNames[when.day] && !!time && time.start === when.time;
    };

    // Returns {course, lesson} for a lesson summary, or null if it isn't one.
    const findLesson = (summary: string, when: DayTime | null): FoundLesson | null => {
        let parsed = /^(.+?) (\d+) [-–] (.+)$/.exec(summary);
        let type: string;
        let number: number | null;
        let name: string;
        if (parsed) {
            type = parsed[1];
            number = parseInt(parsed[2], 10);
            name = parsed[3];
        } else {
            parsed = /^(\S+) [-–] (.+)$/.exec(summary);
            if (!parsed) {
                return null;
            }
            type = parsed[1];
            number = null;
            name = parsed[2];
        }
        name = name.replace(/\s+/g, ' ').trim();

        const candidates: { course: string; lesson: Lesson }[] = [];
        (coursesByName[name] || []).forEach(course => {
            courseManager.getSchedule(course).forEach(lesson => {
                if (
                    typeMatches(lesson, type) &&
                    (number === null ? lesson['סוג'] === 'sadna' : parseInt(String(lesson['מס.']), 10) === number)
                ) {
                    candidates.push({ course, lesson });
                }
            });
        });

        if (candidates.length === 0) {
            return { course: null, lesson: null };
        }
        const exact = candidates.filter(candidate => timeMatches(candidate.lesson, when));
        return exact.length > 0 ? exact[0] : candidates[0];
    };

    parseEvents(text).forEach(event => {
        const summary = unescapeText(event.SUMMARY && event.SUMMARY.value).trim();
        if (!summary) {
            return;
        }

        // Exams are one-time events, and come with their courses.
        if (!event.RRULE) {
            return;
        }

        const start = parseDateTime(event.DTSTART);
        const end = parseDateTime(event.DTEND);

        const found = findLesson(summary, start);
        if (found && found.course && found.lesson) {
            const course = found.course;
            if (!result.courses[course]) {
                result.courses[course] = {};
                result.courseOrder.push(course);
            }
            result.courses[course][lessonTypeKey(course, found.lesson)] = found.lesson['מס.'];
            return;
        }

        // Looks like a lesson of a course that isn't in the catalog of this semester.
        if (found && /^.+ \d+ [-–] /.test(summary)) {
            if (!result.unmatched.includes(summary)) {
                result.unmatched.push(summary);
            }
            return;
        }

        if (start && end) {
            result.customEvents.push({
                title: summary,
                day: start.day,
                start: start.time,
                end: end.day === start.day ? end.time : '24:00'
            });
        }
    });

    return result;
}

export const IcsImport = {
    parseEvents,
    unescapeText,
    match
};
