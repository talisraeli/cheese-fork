import type { CustomEventData } from '../lib/schedule-types.js';
import { firestoreAuthenticatedUserDoc, firestoreSave, localStorageSaveFailed } from './firestore.js';
import { onSavedSessionChange } from './history.js';
import { layerLessonsKey, savedSessionUpdate, sessionAllCourses } from './layers.js';
import { onMetadataDiffChange } from './metadata-diff.js';
import { state } from './state.js';

export function selectedCourseSave(course: string, layerId: string) {
    if (layerId) {
        // Use the button list for the order, same as below.
        const layerCourseNumbers = state.courseButtonList.getCourseNumbers(true, layerId);
        savedSessionUpdate(session => {
            const layer = session[`${currentSemester}_layers` as const][layerId];
            layer.courses = layerCourseNumbers.concat(layer.courses.filter(item => !layerCourseNumbers.includes(item)));
            session[layerLessonsKey(course, layerId)] = {};
        });
        return;
    }

    const metadataUpdate = !!state.metadataDiff;
    const metadataCourseKey = `${currentSemester}_metadata_${course}`;
    // Processes the course's schedule, only when its metadata is saved.
    const courseData = metadataUpdate ? state.courseManager.getCourseData(course) : null;

    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const courseKey = layerLessonsKey(course, '');

    // Keep all of the items from currentSavedSession[semesterCoursesKey], even if there
    // are numbers of courses which don't exist anymore. Use the button list for the order.
    const courseNumbers = state.courseButtonList.getCourseNumbers(true, '');
    state.currentSavedSession[semesterCoursesKey] = courseNumbers.concat(
        state.currentSavedSession[semesterCoursesKey].filter(item => !courseNumbers.includes(item))
    );
    state.currentSavedSession[courseKey] = {};

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey];
        input[courseKey] = {};
        if (metadataUpdate) {
            input[metadataCourseKey] = courseData;
        }
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
            localStorage.removeItem(courseKey);
            if (metadataUpdate) {
                localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
            }
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

export function coursesOrderSave(layerId: string) {
    if (layerId) {
        const layerCourseNumbers = state.courseButtonList.getCourseNumbers(true, layerId);
        savedSessionUpdate(session => {
            const layer = session[`${currentSemester}_layers` as const][layerId];
            layer.courses = layerCourseNumbers.concat(layer.courses.filter(item => !layerCourseNumbers.includes(item)));
        });
        return;
    }

    // Save only the course order when reordering via drag-and-drop
    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const courseNumbers = state.courseButtonList.getCourseNumbers(true, '');
    state.currentSavedSession[semesterCoursesKey] = courseNumbers.concat(
        state.currentSavedSession[semesterCoursesKey].filter(item => !courseNumbers.includes(item))
    );

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey];
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

export function selectedCourseUnsave(course: string, layerId: string) {
    if (layerId) {
        savedSessionUpdate(session => {
            const layer = session[`${currentSemester}_layers` as const][layerId];
            layer.courses = layer.courses.filter(item => item !== course);
            delete session[layerLessonsKey(course, layerId)];
        });
        return;
    }

    const metadataCourseKey = `${currentSemester}_metadata_${course}`;

    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const courseKey = layerLessonsKey(course, '');

    state.currentSavedSession[semesterCoursesKey] = state.currentSavedSession[semesterCoursesKey].filter(
        item => item !== course
    );
    delete state.currentSavedSession[courseKey];

    // The metadata is still needed if the course is in another layer.
    const removeMetadata = !sessionAllCourses(state.currentSavedSession).includes(course);

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
        input[courseKey] = firebase.firestore.FieldValue.delete();
        if (removeMetadata) {
            input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
        }
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(semesterCoursesKey, JSON.stringify(state.currentSavedSession[semesterCoursesKey]));
            localStorage.removeItem(courseKey);
            if (removeMetadata) {
                localStorage.removeItem(metadataCourseKey);
            }
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();

    if (removeMetadata && state.metadataDiff && state.metadataDiff[course]) {
        delete state.metadataDiff[course];
        onMetadataDiffChange();
    }
}

export function selectedLessonSave(course: string, lessonNumber: number | string, lessonType: string, layerId: string) {
    if (layerId) {
        savedSessionUpdate(session => {
            session[layerLessonsKey(course, layerId)][lessonType] = lessonNumber;
        });
        return;
    }

    const courseKey = layerLessonsKey(course, '');

    state.currentSavedSession[courseKey][lessonType] = lessonNumber;

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[`${courseKey}.${lessonType}`] = lessonNumber;
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(courseKey, JSON.stringify(state.currentSavedSession[courseKey]));
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

export function selectedLessonUnsave(
    course: string,
    lessonNumber: number | string,
    lessonType: string,
    layerId: string
) {
    if (layerId) {
        savedSessionUpdate(session => {
            delete session[layerLessonsKey(course, layerId)][lessonType];
        });
        return;
    }

    const courseKey = layerLessonsKey(course, '');

    delete state.currentSavedSession[courseKey][lessonType];

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[`${courseKey}.${lessonType}`] = firebase.firestore.FieldValue.delete();
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(courseKey, JSON.stringify(state.currentSavedSession[courseKey]));
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

export function customEventSave(eventId: string, eventData: CustomEventData, layerId: string) {
    if (layerId) {
        savedSessionUpdate(session => {
            session[`${currentSemester}_layers` as const][layerId].customEvents[eventId] = eventData;
        });
        return;
    }

    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;

    state.currentSavedSession[semesterCustomEventsKey][eventId] = eventData;

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[`${semesterCustomEventsKey}.${eventId}`] = eventData;
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(
                semesterCustomEventsKey,
                JSON.stringify(state.currentSavedSession[semesterCustomEventsKey])
            );
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

export function customEventUnsave(eventId: string, layerId: string) {
    // The event id isn't reused, so its custom color (if any) is no longer needed.
    const semesterColorsKey = `${currentSemester}_colors` as const;
    const colorKey = `custom_event_${eventId}`;

    if (layerId) {
        delete state.customColors[colorKey];
        savedSessionUpdate(session => {
            delete session[`${currentSemester}_layers` as const][layerId].customEvents[eventId];
            delete session[semesterColorsKey][colorKey];
        });
        return;
    }

    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;

    delete state.currentSavedSession[semesterCustomEventsKey][eventId];

    const hadCustomColor = !!state.currentSavedSession[semesterColorsKey][colorKey];
    delete state.currentSavedSession[semesterColorsKey][colorKey];
    delete state.customColors[colorKey];

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        input[`${semesterCustomEventsKey}.${eventId}`] = firebase.firestore.FieldValue.delete();
        if (hadCustomColor) {
            customColorFirestoreInput(input, colorKey);
        }
        firestoreSave(doc, input);
    } else {
        try {
            localStorage.setItem(
                semesterCustomEventsKey,
                JSON.stringify(state.currentSavedSession[semesterCustomEventsKey])
            );
            if (hadCustomColor) {
                customColorsLocalStorageSave();
            }
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

// colorKey is a course color key (see courseColorKey) or a custom event id.
// Pass null as color to remove the custom color.
export function customColorSave(colorKey: string, color: string | null) {
    const semesterColorsKey = `${currentSemester}_colors` as const;

    if (color) {
        state.currentSavedSession[semesterColorsKey][colorKey] = color;
        state.customColors[colorKey] = color;
    } else {
        delete state.currentSavedSession[semesterColorsKey][colorKey];
        delete state.customColors[colorKey];
    }

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};
        customColorFirestoreInput(input, colorKey);
        firestoreSave(doc, input);
    } else {
        try {
            customColorsLocalStorageSave();
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }

    onSavedSessionChange();
}

// Sets the Firestore update for colorKey according to currentSavedSession.
// The colors are stored only if there are any, most users don't have custom colors.
export function customColorFirestoreInput(input: Record<string, unknown>, colorKey: string) {
    const semesterColorsKey = `${currentSemester}_colors` as const;
    const colors = state.currentSavedSession[semesterColorsKey];

    if (Object.keys(colors).length === 0) {
        input[semesterColorsKey] = firebase.firestore.FieldValue.delete();
    } else {
        input[`${semesterColorsKey}.${colorKey}`] = colors[colorKey] || firebase.firestore.FieldValue.delete();
    }
}

export function customColorsLocalStorageSave() {
    const semesterColorsKey = `${currentSemester}_colors` as const;
    const colors = state.currentSavedSession[semesterColorsKey];

    if (Object.keys(colors).length === 0) {
        localStorage.removeItem(semesterColorsKey);
    } else {
        localStorage.setItem(semesterColorsKey, JSON.stringify(colors));
    }
}
