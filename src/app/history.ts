import type { LayerSchedule } from '../components/course-calendar/calendar-types.js';
import type { SelectedLessons } from '../lib/schedule-types.js';
import type { SavedSession } from './session-types.js';
import { calendarAutoUploadSchedule } from './calendar-export.js';
import { customColorsFromSavedSession } from './colors.js';
import { SAVED_SESSION_UNDO_LIMIT } from './constants.js';
import { firestoreAuthenticatedUserDoc, firestoreSave, localStorageSaveFailed } from './firestore.js';
import {
    getVisibleCourseNumbers,
    isLayerCollapsed,
    layerLessonsKey,
    layersFromSavedSession,
    sessionAllCourses,
    sessionExtraLayerIds,
    sessionLayerCourses,
    sessionLayerCustomEvents
} from './layers.js';
import { updateGeneralInfoLine } from './semesters.js';
import { state } from './state.js';

export function restoreSavedSession(currentSession: SavedSession, sessionToRestore: SavedSession) {
    savedSessionChangesSave(currentSession, sessionToRestore);
    setScheduleFromSavedSession(sessionToRestore);
}

// Saves the changes between the two sessions.
export function savedSessionChangesSave(currentSession: SavedSession, sessionToRestore: SavedSession) {
    const newKeys: (keyof SavedSession)[] = [];
    // With the metadata of removed courses, which isn't in the session.
    const removeKeys: string[] = [];
    const newMetadataCourses: string[] = [];

    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const currentCourses = currentSession[semesterCoursesKey];
    const newCourses = sessionToRestore[semesterCoursesKey];
    if (JSON.stringify(currentCourses) !== JSON.stringify(newCourses)) {
        newKeys.push(semesterCoursesKey);
    }

    currentCourses.forEach(course => {
        if (!newCourses.includes(course)) {
            const courseKey = layerLessonsKey(course, '');
            removeKeys.push(courseKey);
        }
    });

    newCourses.forEach(course => {
        const courseKey = layerLessonsKey(course, '');
        if (!currentCourses.includes(course)) {
            newKeys.push(courseKey);
        } else {
            const currentLessons = currentSession[courseKey];
            const newLessons = sessionToRestore[courseKey];
            // Can be different even if object are equal due to key order,
            // but that's OK, we'll just override the same data.
            if (JSON.stringify(currentLessons) !== JSON.stringify(newLessons)) {
                newKeys.push(courseKey);
            }
        }
    });

    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;
    const currentCustomEvents = currentSession[semesterCustomEventsKey];
    const newCustomEvents = sessionToRestore[semesterCustomEventsKey];
    // Can be different even if object are equal due to key order,
    // but that's OK, we'll just override the same data.
    if (JSON.stringify(currentCustomEvents) !== JSON.stringify(newCustomEvents)) {
        newKeys.push(semesterCustomEventsKey);
    }

    const semesterColorsKey = `${currentSemester}_colors` as const;
    if (JSON.stringify(currentSession[semesterColorsKey]) !== JSON.stringify(sessionToRestore[semesterColorsKey])) {
        if (Object.keys(sessionToRestore[semesterColorsKey]).length === 0) {
            removeKeys.push(semesterColorsKey);
        } else {
            newKeys.push(semesterColorsKey);
        }
    }

    const semesterLayersKey = `${currentSemester}_layers` as const;
    const currentSavedLayers = currentSession[semesterLayersKey];
    const newSavedLayers = sessionToRestore[semesterLayersKey];
    if (JSON.stringify(currentSavedLayers) !== JSON.stringify(newSavedLayers)) {
        // Layers are saved only if they're used.
        if (Object.keys(newSavedLayers).length > 0) {
            newKeys.push(semesterLayersKey);
        } else {
            removeKeys.push(semesterLayersKey);
        }
    }

    sessionExtraLayerIds(currentSession).forEach(layerId => {
        sessionLayerCourses(currentSession, layerId).forEach(course => {
            if (!newSavedLayers[layerId] || !newSavedLayers[layerId].courses.includes(course)) {
                removeKeys.push(layerLessonsKey(course, layerId));
            }
        });
    });

    sessionExtraLayerIds(sessionToRestore).forEach(layerId => {
        sessionLayerCourses(sessionToRestore, layerId).forEach(course => {
            const courseKey = layerLessonsKey(course, layerId);
            if (JSON.stringify(currentSession[courseKey]) !== JSON.stringify(sessionToRestore[courseKey])) {
                newKeys.push(courseKey);
            }
        });
    });

    // The metadata is saved once for a course, regardless of the layers it's in.
    if (state.metadataDiff) {
        const currentAllCourses = sessionAllCourses(currentSession);
        const newAllCourses = sessionAllCourses(sessionToRestore);

        currentAllCourses.forEach(course => {
            if (!newAllCourses.includes(course)) {
                const metadataCourseKey = `${currentSemester}_metadata_${course}`;
                removeKeys.push(metadataCourseKey);
            }
        });

        newAllCourses.forEach(course => {
            if (!currentAllCourses.includes(course)) {
                newMetadataCourses.push(course);
            }
        });
    }

    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        const input: Record<string, unknown> = {};

        removeKeys.forEach(key => {
            input[key] = firebase.firestore.FieldValue.delete();
        });

        newKeys.forEach(key => {
            input[key] = sessionToRestore[key];
        });

        newMetadataCourses.forEach(course => {
            const metadataCourseKey = `${currentSemester}_metadata_${course}`;
            input[metadataCourseKey] = state.courseManager.getCourseData(course);
        });

        firestoreSave(doc, input);
    } else {
        try {
            removeKeys.forEach(key => {
                localStorage.removeItem(key);
            });

            newKeys.forEach(key => {
                localStorage.setItem(key, JSON.stringify(sessionToRestore[key]));
            });

            newMetadataCourses.forEach(course => {
                const metadataCourseKey = `${currentSemester}_metadata_${course}`;
                localStorage.setItem(metadataCourseKey, JSON.stringify(state.courseManager.getCourseData(course)));
            });
        } catch (e) {
            localStorageSaveFailed(e);
        }
    }
}

export function setScheduleFromSavedSession(session: SavedSession, restoreScrollPosition?: boolean) {
    let scrollTop: number | undefined;
    if (restoreScrollPosition) {
        scrollTop = $(window).scrollTop(); // save scroll position
    }

    state.customColors = customColorsFromSavedSession(session);

    const semesterCoursesKey = `${currentSemester}_courses` as const;
    state.courseButtonList.clear();

    state.currentLayers = layersFromSavedSession(session);
    state.currentLayers.forEach(layer => {
        layer.collapsed = isLayerCollapsed(layer.id);
    });
    state.courseButtonList.setLayers(state.currentLayers);

    let schedule: Record<string, SelectedLessons> = {};

    const courses = session[semesterCoursesKey] || [];
    courses.forEach(course => {
        if (!schedule[course] && state.courseManager.doesExist(course)) {
            state.courseButtonList.addCourse(course);

            const courseKey = layerLessonsKey(course, '');
            const lessons = session[courseKey] || {};
            schedule[course] = lessons;
        }
    });

    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;
    let customEvents = session[semesterCustomEventsKey] || {};

    // The courses of all layers are in the list, but only visible layers are in the calendar.
    const extraLayers: LayerSchedule[] = [];

    if (state.currentLayers.length === 0) {
        Object.keys(customEvents)
            .sort()
            .forEach(eventId => {
                state.courseButtonList.addCustomEvent(eventId, customEvents[eventId].title, '');
            });
    }

    state.currentLayers.forEach(layer => {
        // Custom events are in the list too, for moving them between layers or removing them.
        const layerCustomEvents = sessionLayerCustomEvents(session, layer.id) || {};
        Object.keys(layerCustomEvents)
            .sort()
            .forEach(eventId => {
                state.courseButtonList.addCustomEvent(eventId, layerCustomEvents[eventId].title, layer.id);
            });

        if (!layer.id) {
            if (layer.hidden) {
                schedule = {};
                customEvents = {};
            }
            return;
        }

        const layerSchedule: Record<string, SelectedLessons> = {};

        sessionLayerCourses(session, layer.id).forEach(course => {
            if (!layerSchedule[course] && state.courseManager.doesExist(course)) {
                state.courseButtonList.addCourse(course, layer.id);
                layerSchedule[course] = session[layerLessonsKey(course, layer.id)] || {};
            }
        });

        if (!layer.hidden) {
            extraLayers.push({
                id: layer.id,
                schedule: layerSchedule,
                customEvents: session[`${currentSemester}_layers` as const][layer.id].customEvents
            });
        }
    });

    state.courseCalendar.loadSavedSchedule(schedule, customEvents, extraLayers);
    updateGeneralInfoLine();
    state.courseExamInfo.renderCourses(getVisibleCourseNumbers());

    if (restoreScrollPosition) {
        $(window).scrollTop(scrollTop as number); // restore scroll position
    }
}

export function resetSchedule() {
    state.customColors = {};
    state.currentLayers = [];
    state.courseButtonList.clear();
    state.courseCalendar.removeAll();
    updateGeneralInfoLine();
    state.courseExamInfo.renderCourses([]);
    state.courseSelect.filterReset();
}

// Undo and redo
//
// Each change pushes the session from before it to savedSessionUndoStack, so changes are
// undone one at a time. Most changes modify currentSavedSession in place before calling
// onSavedSessionChange, so savedSessionLastState keeps a copy of the session after the last
// change, which is the session from before the next one. Undoing and redoing write the
// difference between the sessions, like any other change.

export function sessionCopy(session: SavedSession) {
    return $.extend(true, {}, session); // make a deep copy
}

export function updateUndoRedoButtons() {
    $('#top-navbar-undo').toggleClass('d-none', state.savedSessionUndoStack.length === 0);
    $('#top-navbar-redo').toggleClass('d-none', state.savedSessionRedoStack.length === 0);
}

// The schedule was loaded, possibly with changes made elsewhere, such as in another tab or
// with the API. Undo starts from here, since undoing would revert the change made elsewhere.
export function onSavedSessionReset() {
    state.savedSessionLastState = sessionCopy(state.currentSavedSession);
    state.savedSessionUndoStack = [];
    state.savedSessionRedoStack = [];
    updateUndoRedoButtons();

    calendarAutoUploadSchedule();
}

export function onSavedSessionChange() {
    if (JSON.stringify(state.savedSessionLastState) !== JSON.stringify(state.currentSavedSession)) {
        state.savedSessionUndoStack.push(state.savedSessionLastState);
        if (state.savedSessionUndoStack.length > SAVED_SESSION_UNDO_LIMIT) {
            state.savedSessionUndoStack.shift();
        }
        state.savedSessionRedoStack = [];
        state.savedSessionLastState = sessionCopy(state.currentSavedSession);
    }
    updateUndoRedoButtons();

    calendarAutoUploadSchedule();
}

export function makeUndo() {
    if (state.savedSessionUndoStack.length === 0) {
        return;
    }

    const session = state.savedSessionUndoStack.pop() as SavedSession;
    restoreSavedSession(state.currentSavedSession, session);

    state.savedSessionRedoStack.push(state.currentSavedSession);
    state.currentSavedSession = sessionCopy(session);
    state.savedSessionLastState = session;
    updateUndoRedoButtons();

    calendarAutoUploadSchedule();
}

export function makeRedo() {
    if (state.savedSessionRedoStack.length === 0) {
        return;
    }

    const session = state.savedSessionRedoStack.pop() as SavedSession;
    restoreSavedSession(state.currentSavedSession, session);

    state.savedSessionUndoStack.push(state.savedSessionLastState);
    state.currentSavedSession = session;
    state.savedSessionLastState = sessionCopy(session);
    updateUndoRedoButtons();

    calendarAutoUploadSchedule();
}

// Ctrl+Z to undo, Ctrl+Shift+Z or Ctrl+Y to redo (Cmd on Mac), unless typing or in a dialog.
export function initUndoRedoKeyboardShortcuts() {
    $(document).on('keydown', event => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) {
            return;
        }

        const target = event.target;
        if (
            $(target).is('input, textarea, select, [contenteditable], [contenteditable] *') ||
            $('.modal.show').length > 0
        ) {
            return;
        }

        let key = String(event.key).toLowerCase();
        if (!/^[a-z]$/.test(key)) {
            // A non-Latin layout, such as Hebrew, where the Z key types "ז". Like the
            // browser's own shortcuts, use the key's Latin letter instead. jQuery's event
            // doesn't copy code, so it's read from the original event.
            const code = event.originalEvent && event.originalEvent.code;
            if (code === 'KeyZ' || event.keyCode === 90) {
                key = 'z';
            } else if (code === 'KeyY' || event.keyCode === 89) {
                key = 'y';
            }
        }
        const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
        const undo = key === 'z' && !event.shiftKey;
        if (!undo && !redo) {
            return;
        }

        // Like the browser's own undo, which does nothing on the page.
        event.preventDefault();

        // The same as clicking the button, if it's shown.
        const button = $(undo ? '#top-navbar-undo' : '#top-navbar-redo');
        if (!button.hasClass('d-none')) {
            button.find('a').trigger('click');
        }
    });
}
