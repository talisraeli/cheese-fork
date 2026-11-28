import type { Lesson } from '../lib/course-manager.js';
import type { CourseMetadata, SavedSession } from './session-types.js';
import type { CourseMetadataDiff, MetadataChange } from './state.js';
import { firestoreAuthenticatedUserDoc, firestoreSave, localStorageSaveFailed } from './firestore.js';
import { savedSessionChangesSave } from './history.js';
import { layerLessonsKey, sessionExtraLayerIds } from './layers.js';
import { state } from './state.js';
import { escapeHtml, metadataDisplayValue, sourceText } from './util.js';

export function shouldEnableMetadataDiff() {
    // Only enable the feature for last four semesters.
    // Only the last three are updated, and extra semester to give time to see the most recent changes.
    const lastFourSemesters = Object.keys(availableSemesters).sort().reverse().slice(0, 4);
    return lastFourSemesters.includes(currentSemester);
}

export function computeMetadataDiff(metadata: Record<string, CourseMetadata>): Record<string, CourseMetadataDiff> {
    const diff: Record<string, CourseMetadataDiff> = {};

    Object.keys(metadata).forEach(course => {
        const courseMetadata = metadata[course];

        if (!state.courseManager.doesExist(course)) {
            diff[course] = {
                exists: false,
                general: courseMetadata.general
            };
            return;
        }

        const generalCourseDiff = computeCourseGeneralMetadataDiff(
            courseMetadata.general,
            state.courseManager.getGeneralInfo(course)
        );
        const scheduleCourseDiff = computeCourseScheduleMetadataDiff(
            courseMetadata.schedule,
            state.courseManager.getSchedule(course)
        );
        if (generalCourseDiff.length > 0 || scheduleCourseDiff.length > 0) {
            diff[course] = {
                exists: true,
                changes: generalCourseDiff.concat(scheduleCourseDiff)
            };
        }
    });

    return diff;
}

export function computeCourseGeneralMetadataDiff(
    oldGeneral: Record<string, string>,
    newGeneral: Record<string, string>
): MetadataChange[] {
    const keyOrder = [
        'פקולטה',
        'מסגרת לימודים',
        'שם מקצוע',
        'מספר מקצוע',
        'אתר הקורס', // old format
        'נקודות',
        'הרצאה', // old format
        'תרגיל', // old format
        'מעבדה', // old format
        'סמינר/פרויקט', // old format
        'סילבוס',
        'מקצועות קדם',
        'מקצועות צמודים',
        'מקצועות ללא זיכוי נוסף',
        'מקצועות ללא זיכוי נוסף (מכילים)',
        'מקצועות ללא זיכוי נוסף (מוכלים)',
        'מקצועות זהים', // old format
        'עבור לסמסטר', // old format
        'אחראים',
        'הערות',
        'מועד הבחינה', // old format
        'בוחן מועד א',
        'בוחן מועד ב',
        'בוחן מועד ג',
        'בוחן מועד ד',
        'בוחן מועד ה',
        'בוחן מועד ו',
        'מועד א',
        'מועד ב',
        'מועד ג',
        'מיקום' // old format
    ];
    const compareFunction = (a: string, b: string) => {
        const aIndex = keyOrder.indexOf(a) + 1 || Number.MAX_VALUE;
        const bIndex = keyOrder.indexOf(b) + 1 || Number.MAX_VALUE;
        if (aIndex !== bIndex) {
            return aIndex - bIndex;
        }

        return a.localeCompare(b);
    };

    const keyExclude: Record<string, boolean> = {
        'אתר הקורס': true,
        'עבור לסמסטר': true,
        מיקום: true
    };

    let oldText = '';
    Object.keys(oldGeneral)
        .sort(compareFunction)
        .forEach(key => {
            if (!keyExclude[key] && oldGeneral[key] !== newGeneral[key] && oldGeneral[key]) {
                oldText += `${state.courseManager.getFieldLabel(key)}: ${metadataDisplayValue(key, oldGeneral[key])}\n`;
            }
        });

    let newText = '';
    Object.keys(newGeneral)
        .sort(compareFunction)
        .forEach(key => {
            if (!keyExclude[key] && newGeneral[key] !== oldGeneral[key] && newGeneral[key]) {
                newText += `${state.courseManager.getFieldLabel(key)}: ${metadataDisplayValue(key, newGeneral[key])}\n`;
            }
        });

    if (oldText === '' && newText === '') {
        return [];
    }

    return [
        {
            title: CheeseI18n.t('shell.changes.general'),
            old: oldText.trim(),
            new: newText.trim()
        }
    ];
}

export function computeCourseScheduleMetadataDiff(oldSchedule: Lesson[], newSchedule: Lesson[]): MetadataChange[] {
    const diff: MetadataChange[] = [];
    // The label of each lesson type and number, by its text in Hebrew.
    const scheduleGroups: Record<string, string> = {};

    const oldScheduleByGroups = scheduleToGroupOfTexts(oldSchedule, false);
    const newScheduleByGroups = scheduleToGroupOfTexts(newSchedule, false);
    const oldDisplayByGroups = scheduleToGroupOfTexts(oldSchedule, true);
    const newDisplayByGroups = scheduleToGroupOfTexts(newSchedule, true);

    Object.keys(scheduleGroups)
        .sort()
        .forEach(typeAndNumber => {
            if (oldScheduleByGroups[typeAndNumber] !== newScheduleByGroups[typeAndNumber]) {
                diff.push({
                    title: scheduleGroups[typeAndNumber],
                    old: (oldDisplayByGroups[typeAndNumber] || '').trim(),
                    new: (newDisplayByGroups[typeAndNumber] || '').trim()
                });
            }
        });

    return diff;

    function scheduleToGroupOfTexts(schedule: Lesson[], localized: boolean): Record<string, string> {
        const keyOrder = ['מרצה/מתרגל', 'יום', 'שעה', 'בניין', 'חדר'];
        const compareFunction = (a: string, b: string) => {
            const aIndex = keyOrder.indexOf(a) + 1 || Number.MAX_VALUE;
            const bIndex = keyOrder.indexOf(b) + 1 || Number.MAX_VALUE;
            if (aIndex !== bIndex) {
                return aIndex - bIndex;
            }

            return a.localeCompare(b);
        };

        const lessonsAdded: Record<number, number> = {};

        const scheduleByGroups: Record<string, string> = {};
        schedule.forEach(lesson => {
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                return;
            }

            let lessonText = '';
            (Object.keys(lesson) as (keyof Lesson)[]).sort(compareFunction).forEach(key => {
                if (key !== 'קבוצה' && key !== 'מס.' && key !== 'סוג' && lesson[key]) {
                    const label = localized ? state.courseManager.getFieldLabel(key) : key;
                    const value = localized ? metadataDisplayValue(key, lesson[key]) : lesson[key];
                    lessonText += `${label}: ${value}\n`;
                }
            });

            let typeAndNumber = state.courseManager.getLessonType(lesson);
            if (lesson['סוג'] !== 'sadna') {
                typeAndNumber += ` ${lesson['מס.']}`;
            }
            if (!scheduleByGroups[typeAndNumber]) {
                scheduleByGroups[typeAndNumber] = '';
            }

            scheduleByGroups[typeAndNumber] += `${lessonText}\n`;

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
            scheduleGroups[typeAndNumber] = state.courseManager.getLessonTypeAndNumber(lesson);
        });

        return scheduleByGroups;
    }
}

export function getPrettyMetadataDiff(): JQuery {
    let result: JQuery;
    const metadataDiff = state.metadataDiff;

    if (metadataDiff) {
        const container = $('<div class="course-metadata-diff-container">');
        result = container;

        Object.keys(metadataDiff)
            .sort()
            .forEach(course => {
                const courseDiff = metadataDiff[course];
                let general;
                let courseTitle;
                if (courseDiff.exists) {
                    courseTitle = state.courseManager.getTitle(course);
                    container.append(sourceText(courseTitle, '<h3>'));

                    courseDiff.changes.forEach(diff => {
                        container.append($('<h5>').text(diff.title));

                        const jsDiff = JsDiff.diffWords(diff.old, diff.new);
                        jsDiff.forEach(part => {
                            const partElement = $('<span>').text(part.value);
                            if (part.added) {
                                partElement.addClass('course-metadata-diff-new');
                            } else if (part.removed) {
                                partElement.addClass('course-metadata-diff-old');
                            }

                            container.append(partElement);
                        });
                    });
                } else {
                    general = courseDiff.general;
                    courseTitle = `${general['מספר מקצוע']} – ${general['שם מקצוע']}`;
                    container
                        .append(sourceText(courseTitle, '<h3>'))
                        .append($('<span>').text(CheeseI18n.t('shell.changes.removed')));
                }
            });
    } else {
        result = $('<div>');

        const explanation = escapeHtml(CheeseI18n.t('shell.changes.explanation'));

        result.html(explanation);
    }

    return result;
}

export function setMetadataToCurrent() {
    let deletedCourses: string[] = [];
    const metadataDiff = state.metadataDiff;
    if (metadataDiff) {
        deletedCourses = Object.keys(metadataDiff).filter(course => !metadataDiff[course].exists);
    }

    if (deletedCourses.length > 0 && sessionExtraLayerIds(state.currentSavedSession).length > 0) {
        // Remove the deleted courses from the other layers too.
        const newSession: SavedSession = $.extend(true, {}, state.currentSavedSession); // make a deep copy
        sessionExtraLayerIds(newSession).forEach(layerId => {
            const layer = newSession[`${currentSemester}_layers` as const][layerId];
            layer.courses = layer.courses.filter(item => !deletedCourses.includes(item));
            deletedCourses.forEach(course => {
                delete newSession[layerLessonsKey(course, layerId)];
            });
        });

        savedSessionChangesSave(state.currentSavedSession, newSession);
        state.currentSavedSession = newSession;
    }

    const semesterCoursesKey = `${currentSemester}_courses` as const;
    if (deletedCourses.length > 0) {
        state.currentSavedSession[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey].filter(
            item => !deletedCourses.includes(item)
        );
    }

    deletedCourses.forEach(course => {
        const courseKey = layerLessonsKey(course, '');
        delete state.currentSavedSession[courseKey];
    });

    const courseNumbers = state.courseButtonList.getCourseNumbers(true);

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};

        courseNumbers.forEach(course => {
            const metadataCourseKey = `${currentSemester}_metadata_${course}`;
            const courseData = state.courseManager.getCourseData(course);
            input[metadataCourseKey] = courseData;
        });

        if (deletedCourses.length > 0) {
            input[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey];
        }

        deletedCourses.forEach(course => {
            const courseKey = layerLessonsKey(course, '');
            input[courseKey] = firebase.firestore.FieldValue.delete();

            const metadataCourseKey = `${currentSemester}_metadata_${course}`;
            input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
        });

        firestoreSave(doc, input);
    } else {
        try {
            courseNumbers.forEach(course => {
                const metadataCourseKey = `${currentSemester}_metadata_${course}`;
                const courseData = state.courseManager.getCourseData(course);
                localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
            });

            if (deletedCourses.length > 0) {
                localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
            }

            deletedCourses.forEach(course => {
                const courseKey = layerLessonsKey(course, '');
                localStorage.removeItem(courseKey);

                const metadataCourseKey = `${currentSemester}_metadata_${course}`;
                localStorage.removeItem(metadataCourseKey);
            });
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    state.metadataDiff = {};
    onMetadataDiffChange();
}

export function onMetadataDiffChange() {
    let badgeCount = 0;

    const metadataDiff = state.metadataDiff;
    if (metadataDiff) {
        const diffCourses = Object.keys(metadataDiff);
        if (diffCourses.length > 0) {
            badgeCount = diffCourses.reduce((accumulator, course) => {
                const diff = metadataDiff[course];
                return accumulator + (diff.exists ? diff.changes.length : 1);
            }, 0);
        }
    } else {
        // If !metadataDiff, that probably means that
        // the user built the schedule before the feature was introduced.
        badgeCount = 1;
    }

    if (badgeCount > 0) {
        $('#top-navbar-changes').removeClass('d-none').find('.unread-count-badge').text(String(badgeCount));
        $('#top-navbar .navbar-toggler .unread-count-badge').text(String(badgeCount)).removeClass('d-none');
    } else {
        $('#top-navbar-changes').addClass('d-none');
        $('#top-navbar .navbar-toggler .unread-count-badge').addClass('d-none');
    }
}
