'use strict';

// Loads a semester's course catalog from the same files as index.html, and processes it
// with the site's own course-manager.js so that saved metadata matches what the client saves.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ApiError } = require('./errors');

const CACHE_MS = 60 * 60 * 1000;

// Deployed functions get a copy of course-manager.js (see predeploy in firebase.json).
function courseManagerSource() {
    const candidates = [
        path.join(__dirname, '..', 'shared', 'course-manager.js'),
        path.join(__dirname, '..', '..', 'course-manager.js')
    ];
    const file = candidates.find(candidate => fs.existsSync(candidate));
    if (!file) {
        throw new Error('course-manager.js not found');
    }
    return fs.readFileSync(file, 'utf8');
}

let courseManagerScript = null;

function createCourseManager(courses) {
    if (!courseManagerScript) {
        courseManagerScript = new vm.Script(courseManagerSource(), { filename: 'course-manager.js' });
    }
    const context = vm.createContext({});
    courseManagerScript.runInContext(context);
    context.courses = courses;
    return vm.runInContext('new CourseManager(courses)', context);
}

// Same as getUgCoursesUrl and getSapCoursesUrl in index.html.
function catalogUrl(semester) {
    if (semester < '202401') {
        return 'https://ug.cheesefork.cf/courses_' + semester + '.min.js';
    }
    const year = semester.slice(0, 4);
    const sapSemester = parseInt(semester.slice(4), 10) - 1 + 200;
    return 'https://sap.cheesefork.cf/courses_' + year + '_' + sapSemester + '.min.js';
}

function parseCatalog(source) {
    const match = /^\s*var\s+courses_from_rishum\s*=\s*([\s\S]*?);?\s*$/.exec(source);
    if (!match) {
        throw new Error('Unexpected course catalog format');
    }
    return JSON.parse(match[1]);
}

function lessonTypeOf(lesson) {
    return lesson['סוג'] === 'sadna' ? 'סדנה' : lesson['סוג'];
}

// Accepted English names for the Hebrew lesson types saved in schedules.
const LESSON_TYPE_ALIASES = {
    lecture: ['הרצאה'],
    tutorial: ['תרגול', 'תרגיל'],
    lab: ['מעבדה'],
    laboratory: ['מעבדה'],
    seminar: ['סמינר', 'סמינר/פרויקט'],
    project: ['פרויקט', 'סמינר/פרויקט'],
    'seminar-project': ['סמינר/פרויקט'],
    workshop: ['סדנה']
};

// The saved lesson types that a Hebrew type or an English alias may refer to.
function lessonTypeCandidates(type) {
    const alias = type.toLowerCase();
    return Object.prototype.hasOwnProperty.call(LESSON_TYPE_ALIASES, alias) ? LESSON_TYPE_ALIASES[alias] : [type];
}

class Catalog {
    constructor(semester, courses) {
        this.semester = semester;
        this.manager = createCourseManager(courses);
    }

    has(course) {
        return this.manager.doesExist(course);
    }

    // The course data as the client saves it for tracking catalog changes.
    courseData(course) {
        return JSON.parse(JSON.stringify(this.manager.getCourseData(course)));
    }

    name(course) {
        return this.has(course) ? this.manager.getGeneralInfo(course)['שם מקצוע'] || null : null;
    }

    lessons(course) {
        return this.manager.getSchedule(course).map(lesson => ({
            type: lessonTypeOf(lesson),
            number: lesson['מס.'],
            group: lesson['קבוצה'],
            day: lesson['יום'],
            time: lesson['שעה'],
            building: lesson['בניין'],
            room: lesson['חדר'],
            staff: lesson['מרצה/מתרגל']
        }));
    }

    // Returns the saved lesson type for a Hebrew type or an English alias.
    resolveLessonType(course, type) {
        const types = Array.from(new Set(this.lessons(course).map(lesson => lesson.type)));
        const candidates = lessonTypeCandidates(type);
        const resolved = candidates.find(candidate => types.includes(candidate));
        if (!resolved) {
            throw new ApiError(404, 'lesson_type_not_found', 'Course ' + course + ' has no lessons of type "' +
                type + '". Its lesson types are: ' + types.join(', ') + '.');
        }
        return resolved;
    }

    // Courses whose number or name contains the query, best matches first: an exact number,
    // then numbers that start with it, then the rest by number. Numbers match in the current
    // 8-digit form and in the old 6-digit one, and names ignore case, quotes and gershayim.
    search(query) {
        const normalize = text => String(text).toLowerCase().replace(/["'׳״]/g, '').replace(/\s+/g, ' ').trim();
        const q = normalize(query);
        const digits = /^\d+$/.test(q);
        const rank = course => {
            const numbers = [course, this.manager.toOldCourseNumber(course)];
            if (numbers.includes(q)) {
                return 0;
            }
            return numbers.some(number => number.startsWith(q)) ? 1 : 2;
        };

        // The course manager runs in its own context, so its arrays are converted to this one's.
        return Array.from(this.manager.getAllCourses()).filter(course => {
            if (digits) {
                return course.includes(q) || this.manager.toOldCourseNumber(course).includes(q);
            }
            return normalize(this.name(course) || '').includes(q);
        }).map(course => ({ course: course, rank: digits ? rank(course) : 2 }))
            .sort((a, b) => a.rank - b.rank || a.course.localeCompare(b.course))
            .map(item => ({
                course: item.course,
                name: this.name(item.course),
                points: this.points(item.course)
            }));
    }

    points(course) {
        const points = parseFloat(this.manager.getGeneralInfo(course)['נקודות']);
        return Number.isNaN(points) ? null : points;
    }

    requireLesson(course, type, number) {
        const found = this.lessons(course).some(lesson => lesson.type === type && lesson.number === number);
        if (!found) {
            throw new ApiError(404, 'lesson_not_found', 'Course ' + course + ' has no ' + type + ' number ' + number + '.');
        }
    }
}

function createCatalogLoader(fetchImpl, now) {
    const cache = new Map();

    return async function loadCatalog(semester) {
        const cached = cache.get(semester);
        if (cached && now() - cached.time < CACHE_MS) {
            return cached.catalog;
        }

        const response = await fetchImpl(catalogUrl(semester));
        if (response.status === 404 || response.status === 403) {
            throw new ApiError(404, 'semester_not_found', 'No course catalog for semester ' + semester + '.');
        }
        if (!response.ok) {
            throw new ApiError(502, 'catalog_unavailable', 'The course catalog could not be loaded, try again later.');
        }

        const catalog = new Catalog(semester, parseCatalog(await response.text()));
        cache.set(semester, { time: now(), catalog: catalog });
        return catalog;
    };
}

module.exports = { Catalog, catalogUrl, parseCatalog, createCatalogLoader, lessonTypeCandidates };
