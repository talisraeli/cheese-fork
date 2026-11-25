'use strict';

/* exported IcsImport */

// Importing an iCalendar file exported by the original CheeseFork (or by CheeseFork²).
//
// The export has a weekly recurring event for each selected lesson and custom event, and a
// one-time event for each exam. A lesson's summary is "<type> <number> - <course name>", or
// "סדנה - <course name>" for a workshop, so lessons are matched to the catalog of the current
// semester by the course name, the lesson type and the lesson number, and by the day and the
// time when that's not enough. Exams are skipped, since they come with the courses.
var IcsImport = (function () {
    // Unfolds the lines of an iCalendar text and returns its VEVENT components, each an object
    // of property names to {params, value}, with the text values unescaped.
    function parseEvents(text) {
        var lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
        var events = [];
        var current = null;

        lines.forEach(function (line) {
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

            var colon = line.indexOf(':');
            if (colon === -1) {
                return;
            }
            var nameAndParams = line.slice(0, colon).split(';');
            var name = nameAndParams[0].toUpperCase();
            var params = {};
            nameAndParams.slice(1).forEach(function (param) {
                var eq = param.indexOf('=');
                if (eq !== -1) {
                    params[param.slice(0, eq).toUpperCase()] = param.slice(eq + 1);
                }
            });
            if (!current[name]) {
                current[name] = {params: params, value: line.slice(colon + 1)};
            }
        });

        return events;
    }

    function unescapeText(value) {
        return String(value || '').replace(/\\([\\;,nN])/g, function (match, ch) {
            return ch === 'n' || ch === 'N' ? '\n' : ch;
        });
    }

    // Returns {day, time} of a DATE-TIME property: the day of the week (0 is Sunday) and the
    // time as HH:mm, in the time of the file, or in local time for a UTC time. Null for a date.
    function parseDateTime(property) {
        if (!property) {
            return null;
        }
        var match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(property.value);
        if (!match) {
            return null;
        }
        var date;
        if (match[7]) {
            date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
        } else {
            date = new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
        }
        var pad = function (n) {
            return ('0' + n).slice(-2);
        };
        return {
            day: date.getDay(),
            time: pad(date.getHours()) + ':' + pad(date.getMinutes())
        };
    }

    // Returns {courses, customEvents, unmatched}:
    // - courses: course number to {lesson type key: lesson number}, in the order of the file.
    // - customEvents: {title, day, start, end} of the recurring events that aren't lessons.
    // - unmatched: the summaries of the lessons that aren't in the catalog of this semester.
    // lessonTypeKey(course, lesson) returns the key that a selected lesson is saved under.
    function match(text, courseManager, lessonTypeKey) {
        var result = {courses: {}, courseOrder: [], customEvents: [], unmatched: []};

        var coursesByName = {};
        var addName = function (name, course) {
            name = String(name || '').replace(/\s+/g, ' ').trim();
            if (name) {
                coursesByName[name] = coursesByName[name] || [];
                if (coursesByName[name].indexOf(course) === -1) {
                    coursesByName[name].push(course);
                }
            }
        };
        courseManager.getAllCourses().forEach(function (course) {
            addName(courseManager.getGeneralInfo(course)['שם מקצוע'], course);
            addName(courseManager.getCourseName(course), course);
        });

        var typeMatches = function (lesson, type) {
            return lesson['סוג'] === type || courseManager.getLessonType(lesson) === type ||
                courseManager.getLessonTypeLabel(lesson['סוג']) === type;
        };

        var dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        var timeMatches = function (lesson, when) {
            if (!when) {
                return false;
            }
            var time = courseManager.parseLessonTime(lesson['שעה']);
            return lesson['יום'] === dayNames[when.day] && !!time && time.start === when.time;
        };

        // Returns {course, lesson} for a lesson summary, or null if it isn't one.
        var findLesson = function (summary, when) {
            var parsed = /^(.+?) (\d+) [-–] (.+)$/.exec(summary);
            var type, number, name;
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

            var candidates = [];
            (coursesByName[name] || []).forEach(function (course) {
                courseManager.getSchedule(course).forEach(function (lesson) {
                    if (typeMatches(lesson, type) &&
                        (number === null ? lesson['סוג'] === 'sadna' : parseInt(lesson['מס.'], 10) === number)) {
                        candidates.push({course: course, lesson: lesson});
                    }
                });
            });

            if (candidates.length === 0) {
                return {course: null, lesson: null};
            }
            var exact = candidates.filter(function (candidate) {
                return timeMatches(candidate.lesson, when);
            });
            return exact.length > 0 ? exact[0] : candidates[0];
        };

        parseEvents(text).forEach(function (event) {
            var summary = unescapeText(event.SUMMARY && event.SUMMARY.value).trim();
            if (!summary) {
                return;
            }

            // Exams are one-time events, and come with their courses.
            if (!event.RRULE) {
                return;
            }

            var start = parseDateTime(event.DTSTART);
            var end = parseDateTime(event.DTEND);

            var found = findLesson(summary, start);
            if (found && found.course) {
                var course = found.course;
                if (!result.courses[course]) {
                    result.courses[course] = {};
                    result.courseOrder.push(course);
                }
                result.courses[course][lessonTypeKey(course, found.lesson)] = found.lesson['מס.'];
                return;
            }

            // Looks like a lesson of a course that isn't in the catalog of this semester.
            if (found && /^.+ \d+ [-–] /.test(summary)) {
                if (result.unmatched.indexOf(summary) === -1) {
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

    return {
        parseEvents: parseEvents,
        unescapeText: unescapeText,
        match: match
    };
})();
