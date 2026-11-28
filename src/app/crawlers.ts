import { semesterFriendlyName } from './semesters.js';
import { state } from './state.js';
import { crawlerUrl, lessonDisplayTime, setPageTitle, sourceText } from './util.js';
import { getParameterByName } from '../lib/url.js';

// A lesson of a staff member or in a room, and its time in Hebrew for sorting, if it has one.
interface CrawlerLesson {
    course: string;
    time: string | null;
    displayTime: string | null;
}

// The days in the catalog, as their short form, so that the times sort by day.
const DAY_FOR_SORTING: Record<string, string> = {
    ראשון: 'א',
    שני: 'ב',
    שלישי: 'ג',
    רביעי: 'ד',
    חמישי: 'ה',
    שישי: 'ו'
};

export function crawlersInfo() {
    const courseParameter = getParameterByName('course');
    const staffParameter = getParameterByName('staff');
    const roomParameter = getParameterByName('room');

    if (courseParameter === null && staffParameter === null && roomParameter === null) {
        return false;
    }

    const content = $('<div class="col-md-12">');
    let title = `${semesterFriendlyName(currentSemester)} - CheeseFork²`;

    if (courseParameter !== null) {
        if (state.courseManager.doesExist(courseParameter)) {
            crawlersMakeCourseContent(content, courseParameter);
            title = `${state.courseManager.getTitle(courseParameter)} – ${title}`;
        } else {
            crawlersMakeListHeader(content, 'course');
            crawlersMakeCourseListContent(content);
            title = `${CheeseI18n.t('shell.crawler.courses')} – ${title}`;
        }
    } else if (staffParameter !== null) {
        if (crawlersMakeStaffContent(content, staffParameter)) {
            title = `${staffParameter} – ${title}`;
        } else {
            crawlersMakeListHeader(content, 'staff');
            crawlersMakeStaffListContent(content);
            title = `${CheeseI18n.t('shell.crawler.staff')} – ${title}`;
        }
    } else {
        // if (roomParameter !== null)
        if (crawlersMakeRoomContent(content, roomParameter as string)) {
            title = `${roomParameter} – ${title}`;
        } else {
            crawlersMakeListHeader(content, 'room');
            crawlersMakeRoomListContent(content);
            title = `${CheeseI18n.t('shell.crawler.rooms')} – ${title}`;
        }
    }

    setPageTitle(title);

    $('#content-container').empty().append(content);

    $('#top-navbar-home').removeClass('d-none');
    $('#top-navbar-share').addClass('d-none');
    $('#top-navbar-calendar').addClass('d-none');
    $('#top-navbar-semester').addClass('d-none');
    $('#course-select').hide();

    $('#top-navbar-supported-content').removeClass('top-navbar-content-uninitialized');

    // The filter form is indexed by Google even though it's hidden, so remove it.
    $('#filter-form').remove();

    $('#page-loader').hide();

    return true;
}

export function crawlersMakeListHeader(content: JQuery, currentList: string) {
    Object.keys(availableSemesters)
        .sort()
        .forEach(semester => {
            const text = semesterFriendlyName(semester);
            if (semester === currentSemester) {
                content.append($('<span>').text(text));
            } else {
                const targetList: Record<string, string> = {};
                targetList[currentList] = 'all';
                targetList.semester = semester;
                const url = crawlerUrl(targetList);
                content.append($('<a>').text(text).prop('href', url));
            }
            content.append('<br>');
        });

    content.append('<br>');

    const listToText: Record<string, string> = {
        course: CheeseI18n.t('shell.crawler.courses'),
        staff: CheeseI18n.t('shell.crawler.staff'),
        room: CheeseI18n.t('shell.crawler.rooms')
    };

    ['course', 'staff', 'room'].forEach(list => {
        const text = listToText[list];
        if (list === currentList) {
            content.append($('<span>').text(text));
        } else {
            const targetList: Record<string, string> = {};
            targetList[list] = 'all';
            const url = crawlerUrl(targetList);
            content.append($('<a>').text(text).prop('href', url));
        }
        content.append('<br>');
    });

    content.append('<br>');
}

export function crawlersMakeCourseContent(content: JQuery, course: string) {
    const url = crawlerUrl({ course: 'all' });
    content.append($('<a>').text(CheeseI18n.t('shell.crawler.courseList')).prop('href', url));
    content.append('<br><br>');

    const description = state.courseManager.getDescription(course, {
        html: true,
        relatedCourseInfo: true,
        links: true
    });
    content.append($('<div>').html(description));

    const lessonsAdded: Record<number, number> = {};
    state.courseManager.getSchedule(course).forEach(lesson => {
        if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
            return;
        }

        content.append('<br>');

        const typeAndNumber = state.courseManager.getLessonTypeAndNumber(lesson);
        content.append($('<div style="font-weight: bold;">').text(typeAndNumber));

        if (lesson['מרצה/מתרגל']) {
            const staffContents = $('<div>').text(`${state.courseManager.getFieldLabel('מרצה/מתרגל')}: `);
            lesson['מרצה/מתרגל'].split('\n').forEach((name, i) => {
                if (i > 0) {
                    staffContents.append(', ');
                }
                const staffUrl = crawlerUrl({ staff: name });
                const staffLink = sourceText(state.courseManager.getStaffLabel(name), '<a>').prop('href', staffUrl);
                staffContents.append(staffLink);
            });
            content.append(staffContents);
        }

        if (lesson['יום']) {
            content.append(
                $('<div>').text(
                    `${state.courseManager.getFieldLabel('יום')}: ${state.courseManager.getDayLabel(lesson['יום'])}`
                )
            );
        }

        if (lesson['שעה']) {
            content.append($('<div>').text(`${state.courseManager.getFieldLabel('שעה')}: ${lesson['שעה']}`));
        }

        let roomUrl;
        let roomLink;
        if (lesson['בניין'] && lesson['חדר']) {
            content.append(
                $('<div>')
                    .text(`${state.courseManager.getFieldLabel('בניין')}: `)
                    .append(sourceText(state.courseManager.getBuildingLabel(lesson['בניין'])))
            );
            roomUrl = crawlerUrl({ room: `${lesson['בניין']} ${lesson['חדר']}` });
            roomLink = sourceText(lesson['חדר'], '<a>').prop('href', roomUrl);
            content.append(
                $('<div>')
                    .text(`${state.courseManager.getFieldLabel('חדר')}: `)
                    .append(roomLink)
            );
        } else if (lesson['בניין']) {
            roomUrl = crawlerUrl({ room: lesson['בניין'] });
            roomLink = sourceText(state.courseManager.getBuildingLabel(lesson['בניין']), '<a>').prop('href', roomUrl);
            content.append(
                $('<div>')
                    .text(`${state.courseManager.getFieldLabel('בניין')}: `)
                    .append(roomLink)
            );
        } else if (lesson['חדר']) {
            content.append(
                $('<div>')
                    .text(`${state.courseManager.getFieldLabel('חדר')}: `)
                    .append(sourceText(lesson['חדר']))
            );
        }

        lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
    });
}

export function crawlersMakeCourseListContent(content: JQuery) {
    state.courseManager
        .getAllCourses()
        .sort()
        .forEach(cbCourse => {
            const title = state.courseManager.getTitle(cbCourse);
            const url = crawlerUrl({ course: cbCourse });
            content.append(sourceText(title, '<a>').prop('href', url));
            content.append('<br>');
        });
}

export function crawlersMakeStaffContent(content: JQuery, staff: string) {
    const schedule: CrawlerLesson[] = [];
    state.courseManager.getAllCourses().forEach(course => {
        const lessonsAdded: Record<number, number> = {};
        state.courseManager.getSchedule(course).forEach(lesson => {
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                return;
            }

            if (lesson['מרצה/מתרגל'] && lesson['מרצה/מתרגל'].split('\n').includes(staff)) {
                let time: string | null = null;
                if (lesson['יום']) {
                    if (lesson['שעה']) {
                        time = `יום ${lesson['יום']} ${lesson['שעה']}`;
                    } else {
                        time = `יום ${lesson['יום']}`;
                    }
                }

                schedule.push({ course, time, displayTime: lessonDisplayTime(lesson) });
            }

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        });
    });

    if (schedule.length === 0) {
        return false;
    }

    const url = crawlerUrl({ staff: 'all' });
    content.append($('<a>').text(CheeseI18n.t('shell.crawler.staffList')).prop('href', url));
    content.append('<br><br>');

    content.append(sourceText(staff, '<b>'));
    content.append('<br>');

    schedule
        .sort((a, b) => {
            if (!a.time && !b.time) {
                return 0;
            } else if (!a.time) {
                return 1;
            } else if (!b.time) {
                return -1;
            } else {
                const aTimeForCompare = a.time.replace(
                    /^יום (\S+)/,
                    (match: string, p1: string) => DAY_FOR_SORTING[p1] || p1
                );
                const bTimeForCompare = b.time.replace(
                    /^יום (\S+)/,
                    (match: string, p1: string) => DAY_FOR_SORTING[p1] || p1
                );

                return aTimeForCompare.localeCompare(bTimeForCompare, undefined, { numeric: true });
            }
        })
        .forEach(item => {
            if (item.time) {
                content.append($('<span>').text(`${item.displayTime} – `));
            }

            const url = crawlerUrl({ course: item.course });
            const courseTitle = state.courseManager.getTitle(item.course);
            content.append(sourceText(courseTitle, '<a>').prop('href', url));
            content.append('<br>');
        });

    return true;
}

export function crawlersMakeStaffListContent(content: JQuery) {
    const staff: Record<string, true> = {};
    state.courseManager.getAllCourses().forEach(course => {
        state.courseManager.getSchedule(course).forEach(lesson => {
            if (lesson['מרצה/מתרגל']) {
                lesson['מרצה/מתרגל'].split('\n').forEach(name => {
                    staff[name] = true;
                });
            }
        });
    });

    Object.keys(staff)
        .sort()
        .forEach(name => {
            const url = crawlerUrl({ staff: name });
            content.append(sourceText(name, '<a>').prop('href', url));
            content.append('<br>');
        });
}

export function crawlersMakeRoomContent(content: JQuery, room: string) {
    const schedule: CrawlerLesson[] = [];
    state.courseManager.getAllCourses().forEach(course => {
        const lessonsAdded: Record<number, number> = {};
        state.courseManager.getSchedule(course).forEach(lesson => {
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                return;
            }

            let roomCompare = null;
            if (lesson['בניין']) {
                if (lesson['חדר']) {
                    roomCompare = `${lesson['בניין']} ${lesson['חדר']}`;
                } else {
                    roomCompare = lesson['בניין'];
                }
            }

            if (roomCompare && room === roomCompare) {
                let time: string | null = null;
                if (lesson['יום']) {
                    if (lesson['שעה']) {
                        time = `יום ${lesson['יום']} ${lesson['שעה']}`;
                    } else {
                        time = `יום ${lesson['יום']}`;
                    }
                }

                schedule.push({ course, time, displayTime: lessonDisplayTime(lesson) });
            }

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        });
    });

    if (schedule.length === 0) {
        return false;
    }

    const url = crawlerUrl({ room: 'all' });
    content.append($('<a>').text(CheeseI18n.t('shell.crawler.roomList')).prop('href', url));
    content.append('<br><br>');

    content.append(sourceText(room, '<b>'));
    content.append('<br>');

    schedule
        .sort((a, b) => {
            if (!a.time && !b.time) {
                return 0;
            } else if (!a.time) {
                return 1;
            } else if (!b.time) {
                return -1;
            } else {
                const aTimeForCompare = a.time.replace(
                    /^יום (\S+)/,
                    (match: string, p1: string) => DAY_FOR_SORTING[p1] || p1
                );
                const bTimeForCompare = b.time.replace(
                    /^יום (\S+)/,
                    (match: string, p1: string) => DAY_FOR_SORTING[p1] || p1
                );

                return aTimeForCompare.localeCompare(bTimeForCompare, undefined, { numeric: true });
            }
        })
        .forEach(item => {
            if (item.time) {
                content.append($('<span>').text(`${item.displayTime} – `));
            }

            const url = crawlerUrl({ course: item.course });
            const courseTitle = state.courseManager.getTitle(item.course);
            content.append(sourceText(courseTitle, '<a>').prop('href', url));
            content.append('<br>');
        });

    return true;
}

export function crawlersMakeRoomListContent(content: JQuery) {
    const rooms: Record<string, true> = {};
    state.courseManager.getAllCourses().forEach(course => {
        state.courseManager.getSchedule(course).forEach(lesson => {
            if (lesson['בניין']) {
                if (lesson['חדר']) {
                    rooms[`${lesson['בניין']} ${lesson['חדר']}`] = true;
                } else {
                    rooms[lesson['בניין']] = true;
                }
            }
        });
    });

    Object.keys(rooms)
        .sort()
        .forEach(room => {
            const url = crawlerUrl({ room });
            content.append(sourceText(room, '<a>').prop('href', url));
            content.append('<br>');
        });
}
