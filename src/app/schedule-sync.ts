import type { CustomEventData } from '../lib/schedule-types.js';
import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import type { IcsImportResult } from '../lib/ics-import.js';
import type { CourseMetadata, SavedLayer, SavedSession, ScheduleDocument } from './session-types.js';
import { CourseCalendar } from '../components/course-calendar/course-calendar.js';
import { IcsImport } from '../lib/ics-import.js';
import { courseColorKey } from './colors.js';
import { firestoreAuthenticatedUserDoc, firestoreDisplayNameDecode, firestoreUserDoc } from './firestore.js';
import {
    onSavedSessionChange,
    onSavedSessionReset,
    restoreSavedSession,
    sessionCopy,
    setScheduleFromSavedSession
} from './history.js';
import {
    layerLessonsKey,
    savedLayersSanitize,
    sessionAllCourses,
    sessionExtraLayerIds,
    sessionLayerCourses
} from './layers.js';
import { computeMetadataDiff, onMetadataDiffChange, shouldEnableMetadataDiff } from './metadata-diff.js';
import { semesterFriendlyName } from './semesters.js';
import { state } from './state.js';
import { setPageTitle } from './util.js';

// The schedule of another user, with a uid in the URL.
export function watchSharedSchedule(onLoadedFunc: () => void) {
    let firstDataLoaded = false;

    const doc = firestoreUserDoc(scheduleSharingUserId as string);
    doc.onSnapshot(
        result => {
            // A document that exists has data.
            const data = result.data() as ScheduleDocument | undefined;
            const session = result.exists && data ? savedSessionFromFirestoreData(data) : {};
            setScheduleFromSavedSession(session, !firstDataLoaded);

            if (result.exists && data && data.displayName) {
                const displayName = firestoreDisplayNameDecode(data.displayName as string);
                $('#sharing-user-name').text(displayName);
                $('#sharing-user-known').removeClass('d-none');
                $('#sharing-user-unknown').addClass('d-none');
                setPageTitle(`${displayName} – ${CheeseI18n.t('shell.meta.title')}`);
            } else {
                $('#sharing-user-unknown').removeClass('d-none');
                $('#sharing-user-known').addClass('d-none');
                setPageTitle(CheeseI18n.t('shell.meta.title'));
            }

            if (!firstDataLoaded) {
                onLoadedFunc();
                firstDataLoaded = true;
            }
        },
        error => {
            alert(CheeseI18n.t('shell.error.loadData', { error }));
        }
    );
}

export function watchSavedSchedule(onLoadedFunc: () => void) {
    const doc = firestoreAuthenticatedUserDoc();
    if (doc) {
        let firstDataLoaded = false;

        state.stopScheduleWatching = doc.onSnapshot(
            result => {
                if (result.metadata.hasPendingWrites) {
                    // The callback was called as a result of a local change, ignore it.
                    // https://stackoverflow.com/questions/50186413/is-firestore-onsnapshot-update-event-due-to-local-client-set
                    return;
                }

                if (!firstDataLoaded) {
                    // Save name in server for sharing purposes.
                    // Note: Setting displayName serves two purposes, saving the
                    // name and actually creating the document for the semester
                    // if it doesn't exist yet. So set it even if it's null.
                    // Only when needed, since a write costs more than the read of each page load.
                    // Watched only for a signed-in user, see firestoreAuthenticatedUserDoc.
                    const displayName = (firebase.auth().currentUser as firebaseCompat.User).displayName;
                    if (!result.exists || result.get('displayName') !== displayName) {
                        doc.set({ displayName }, { merge: true });
                    }
                }

                const data = (result.exists ? result.data() : {}) as ScheduleDocument;
                const session = savedSessionFromFirestoreData(data);
                setScheduleFromSavedSession(session, !firstDataLoaded);

                if (shouldEnableMetadataDiff()) {
                    const metadata = savedMetadataFromFirestoreData(data);
                    state.metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                    onMetadataDiffChange();
                } else {
                    state.metadataDiff = null;
                }

                state.currentSavedSession = session;

                // Local changes are skipped above, so this is a change from another tab, device
                // or the API. Undo restores the session saved for it, so start undo from here,
                // otherwise it would revert the change made elsewhere.
                onSavedSessionReset();
                if (!firstDataLoaded) {
                    firstDataLoaded = true;
                    onLoadedFunc();
                }
            },
            error => {
                alert(CheeseI18n.t('shell.error.loadData', { error }));
            }
        );
    } else {
        const onStorageEvent = (e: StorageEvent) => {
            const prefix = `${currentSemester}_`;
            // The key is null if the storage was cleared, which removes the schedule too.
            // Otherwise, check if the key starts with the semester prefix.
            // https://stackoverflow.com/a/4579228
            if (e.key === null || e.key.lastIndexOf(prefix, 0) === 0) {
                const session = savedSessionFromLocalStorage();
                setScheduleFromSavedSession(session, true);

                if (shouldEnableMetadataDiff()) {
                    const metadata = savedMetadataFromLocalStorage();
                    state.metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                    onMetadataDiffChange();
                } else {
                    state.metadataDiff = null;
                }

                state.currentSavedSession = session;
                // A change from another tab. Start undo from here, as for Firestore above.
                onSavedSessionReset();
            }
        };

        window.addEventListener('storage', onStorageEvent);

        state.stopScheduleWatching = () => {
            window.removeEventListener('storage', onStorageEvent);
        };

        const session = savedSessionFromLocalStorage();
        setScheduleFromSavedSession(session, false);

        if (shouldEnableMetadataDiff()) {
            const metadata = savedMetadataFromLocalStorage();
            state.metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
            onMetadataDiffChange();
        } else {
            state.metadataDiff = null;
        }

        state.currentSavedSession = session;
        onSavedSessionReset();

        onLoadedFunc();
    }
}

// Importing the schedule built while signed out
//
// While signed out, the schedule is saved in localStorage, and signing in shows the account's
// schedule instead. Right after signing in, if the schedule of the current semester in this
// browser has courses or custom events and differs from the account's, offer to use it, to
// merge it into the account's, or to keep the account's. Using or merging it is a change like
// any other, so it can be undone.

export function sessionCustomEventCount(session: SavedSession) {
    let count = Object.keys(session[`${currentSemester}_custom_events` as const] || {}).length;
    sessionExtraLayerIds(session).forEach(layerId => {
        count += Object.keys(session[`${currentSemester}_layers` as const][layerId].customEvents).length;
    });
    return count;
}

// JSON with sorted object keys, for comparing sessions regardless of the key order.
export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        return `{${Object.keys(object)
            .sort()
            .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

// Returns a copy of accountSession with what localSession has and it doesn't: the courses of
// its first layer with their selected lessons, its custom events, and its other layers as
// new layers. The custom colors of what's added are copied unless already set.
export function sessionsMerge(accountSession: SavedSession, localSession: SavedSession) {
    const session = sessionCopy(accountSession);
    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;
    const semesterColorsKey = `${currentSemester}_colors` as const;
    const semesterLayersKey = `${currentSemester}_layers` as const;

    session[semesterCoursesKey] = session[semesterCoursesKey] || [];
    session[semesterCustomEventsKey] = session[semesterCustomEventsKey] || {};
    session[semesterColorsKey] = session[semesterColorsKey] || {};
    session[semesterLayersKey] = session[semesterLayersKey] || {};

    const colors = session[semesterColorsKey];
    const localColors = localSession[semesterColorsKey] || {};
    // The keys of colors are courses, with their layer, and custom_event_<id>.
    const copyColor = (fromKey: string, toKey: string) => {
        if (localColors[fromKey] && !colors[toKey]) {
            colors[toKey] = localColors[fromKey];
        }
    };

    const usedEventIds: Record<string, true> = {};
    Object.keys(session[semesterCustomEventsKey]).forEach(eventId => {
        usedEventIds[eventId] = true;
    });
    sessionExtraLayerIds(session).forEach(layerId => {
        Object.keys(session[semesterLayersKey][layerId].customEvents).forEach(eventId => {
            usedEventIds[eventId] = true;
        });
    });

    // Custom event ids are numbers, see onCustomEventAdded.
    const addCustomEvents = (
        localEvents: Record<string, CustomEventData>,
        targetEvents: Record<string, CustomEventData>
    ) => {
        Object.keys(localEvents || {}).forEach(eventId => {
            let newEventId = eventId;
            while (usedEventIds[newEventId]) {
                newEventId = String(parseInt(newEventId, 10) + 1);
            }
            usedEventIds[newEventId] = true;
            targetEvents[newEventId] = $.extend(true, {}, localEvents[eventId]);
            copyColor(`custom_event_${eventId}`, `custom_event_${newEventId}`);
        });
    };

    // The first layer.
    sessionLayerCourses(localSession, '').forEach(course => {
        if (state.courseManager.doesExist(course) && !session[semesterCoursesKey].includes(course)) {
            session[semesterCoursesKey].push(course);
            session[layerLessonsKey(course, '')] = $.extend(true, {}, localSession[layerLessonsKey(course, '')]);
            copyColor(course, course);
        }
    });
    addCustomEvents(localSession[semesterCustomEventsKey], session[semesterCustomEventsKey]);

    // The other layers, as new layers.
    const layers = session[semesterLayersKey];
    sessionExtraLayerIds(localSession).forEach(layerId => {
        const localLayer = localSession[semesterLayersKey][layerId];

        let newLayerId = layerId;
        while (layers[newLayerId]) {
            newLayerId = `layer${parseInt(newLayerId.slice('layer'.length), 10) + 1}`;
        }

        const layer: SavedLayer = { name: localLayer.name, courses: [], customEvents: {} };
        if (localLayer.hidden) {
            layer.hidden = true;
        }
        layers[newLayerId] = layer;

        localLayer.courses.forEach(course => {
            if (state.courseManager.doesExist(course) && !layer.courses.includes(course)) {
                layer.courses.push(course);
                session[layerLessonsKey(course, newLayerId)] = $.extend(
                    true,
                    {},
                    localSession[layerLessonsKey(course, layerId)]
                );
                copyColor(courseColorKey(course, layerId), courseColorKey(course, newLayerId));
            }
        });
        addCustomEvents(localLayer.customEvents, layer.customEvents);
    });

    return session;
}

// Removes the schedule of the current semester from localStorage.
export function localStorageScheduleClear() {
    try {
        const prefix = `${currentSemester}_`;
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key !== null && key.lastIndexOf(prefix, 0) === 0) {
                keys.push(key);
            }
        }
        keys.forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }
}

export function offerLocalScheduleImport() {
    const localSession = savedSessionFromLocalStorage();
    const localCourses = sessionAllCourses(localSession).filter(course => state.courseManager.doesExist(course));
    const localEventCount = sessionCustomEventCount(localSession);
    if (
        (localCourses.length === 0 && localEventCount === 0) ||
        canonicalJson(localSession) === canonicalJson(state.currentSavedSession)
    ) {
        return;
    }

    const summary = (courses: number, events: number) => CheeseI18n.t('shell.importLocal.summary', { courses, events });

    const message = $('<div>');
    message.append(
        $('<p>').text(
            CheeseI18n.t('shell.importLocal.message', {
                local: summary(localCourses.length, localEventCount),
                account: summary(
                    sessionAllCourses(state.currentSavedSession).length,
                    sessionCustomEventCount(state.currentSavedSession)
                )
            })
        )
    );
    const clearCheckbox = $('<input type="checkbox" class="form-check-input" id="import-local-clear" checked>');
    message.append(
        $('<div class="form-check">')
            .append(clearCheckbox)
            .append(
                $('<label class="form-check-label" for="import-local-clear">').text(
                    CheeseI18n.t('shell.importLocal.clearLocal')
                )
            )
    );

    const choose = (dialog: BootstrapDialogInstance, choice: string) => {
        gtag('event', `import-local-${choice}`);
        dialog.close();

        let newSession = null;
        if (choice === 'use') {
            newSession = localSession;
        } else if (choice === 'merge') {
            newSession = sessionsMerge(state.currentSavedSession, localSession);
        }

        if (newSession) {
            restoreSavedSession(state.currentSavedSession, newSession);
            state.currentSavedSession = sessionCopy(newSession);
            onSavedSessionChange();
        }

        if (clearCheckbox.prop('checked')) {
            localStorageScheduleClear();
        }
    };

    BootstrapDialog.show({
        title: CheeseI18n.t('shell.importLocal.title'),
        message,
        // The labels are long, so the buttons are stacked, see cheesefork.css.
        cssClass: 'import-local-dialog',
        buttons: [
            {
                id: 'import-local-merge',
                label: CheeseI18n.t('shell.importLocal.merge'),
                cssClass: 'btn-primary',
                action(dialog: BootstrapDialogInstance) {
                    choose(dialog, 'merge');
                }
            },
            {
                id: 'import-local-use',
                label: CheeseI18n.t('shell.importLocal.useLocal'),
                action(dialog: BootstrapDialogInstance) {
                    choose(dialog, 'use');
                }
            },
            {
                id: 'import-local-keep',
                label: CheeseI18n.t('shell.importLocal.keepAccount'),
                action(dialog: BootstrapDialogInstance) {
                    choose(dialog, 'keep');
                }
            }
        ]
    });
}

// Importing an iCalendar file exported by the original CheeseFork
//
// The lessons of the file are matched to the catalog of the current semester (see
// IcsImport.match) and added to the schedule like a merge of a schedule built while signed
// out: courses already in the schedule keep their lessons, and it can be undone.

// Returns a session with the courses, lessons and custom events of an IcsImport.match result.
export function sessionFromIcsImport(result: IcsImportResult): SavedSession {
    const session: SavedSession = {};
    session[`${currentSemester}_courses` as const] = result.courseOrder.slice();
    result.courseOrder.forEach(course => {
        session[layerLessonsKey(course, '')] = $.extend({}, result.courses[course]);
    });

    // Custom events are saved in the week of 2017-01-01, a Sunday, see onSelect in
    // course-calendar.js, and their ids are numbers, see onCustomEventAdded.
    const customEvents: Record<string, CustomEventData> = {};
    let eventId = Math.round(Date.now() / 1000);
    result.customEvents.forEach(customEvent => {
        const date = `2017-01-0${customEvent.day + 1}T`;
        customEvents[String(eventId++)] = {
            title: customEvent.title,
            start: `${date + customEvent.start}:00`,
            end: `${date + customEvent.end}:00`
        };
    });
    session[`${currentSemester}_custom_events` as const] = customEvents;
    session[`${currentSemester}_colors` as const] = {};
    session[`${currentSemester}_layers` as const] = {};
    return session;
}

export function offerIcsImport(text: string) {
    const result = IcsImport.match(text, state.courseManager, CourseCalendar.getLessonTypeKey);

    const message = $('<div>');
    const unmatchedList = () => {
        if (result.unmatched.length === 0) {
            return;
        }
        message.append(
            $('<p class="mb-1">').text(
                CheeseI18n.t('shell.importIcs.unmatched', {
                    semester: semesterFriendlyName(currentSemester)
                })
            )
        );
        const list = $('<ul class="mb-0">');
        result.unmatched.forEach(summary => {
            list.append($('<li dir="auto">').text(summary));
        });
        message.append(list);
    };

    if (result.courseOrder.length === 0 && result.customEvents.length === 0) {
        message.append($('<p>').text(CheeseI18n.t('shell.importIcs.nothing')));
        unmatchedList();
        BootstrapDialog.show({
            title: CheeseI18n.t('shell.importIcs.title'),
            message,
            buttons: [
                {
                    label: CheeseI18n.t('shell.dialog.close'),
                    action(dialog: BootstrapDialogInstance) {
                        dialog.close();
                    }
                }
            ]
        });
        return;
    }

    message.append(
        $('<p>').text(
            CheeseI18n.t('shell.importIcs.found', {
                courses: result.courseOrder.length,
                events: result.customEvents.length,
                semester: semesterFriendlyName(currentSemester)
            })
        )
    );
    unmatchedList();
    message.append($('<p class="mt-3 mb-0 small text-muted">').text(CheeseI18n.t('shell.importIcs.existingNote')));

    BootstrapDialog.show({
        title: CheeseI18n.t('shell.importIcs.title'),
        message,
        buttons: [
            {
                id: 'import-ics-confirm',
                label: CheeseI18n.t('shell.importIcs.import'),
                cssClass: 'btn-primary',
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                    gtag('event', 'import-ics');

                    const newSession = sessionsMerge(state.currentSavedSession, sessionFromIcsImport(result));
                    restoreSavedSession(state.currentSavedSession, newSession);
                    state.currentSavedSession = sessionCopy(newSession);
                    onSavedSessionChange();
                }
            },
            {
                label: CheeseI18n.t('shell.dialog.cancel'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            }
        ]
    });
}

export function savedSessionFromLocalStorage(): SavedSession {
    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const session: SavedSession = {};
    try {
        session[semesterCoursesKey] = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
        session[semesterCoursesKey].forEach(course => {
            const courseKey = layerLessonsKey(course, '');
            session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
        });
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        session[semesterCoursesKey] = [];
    }

    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;
    try {
        session[semesterCustomEventsKey] = JSON.parse(localStorage.getItem(semesterCustomEventsKey) || '{}');
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        session[semesterCustomEventsKey] = {};
    }

    const semesterColorsKey = `${currentSemester}_colors` as const;
    try {
        session[semesterColorsKey] = JSON.parse(localStorage.getItem(semesterColorsKey) || '{}');
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        session[semesterColorsKey] = {};
    }

    const semesterLayersKey = `${currentSemester}_layers` as const;
    try {
        session[semesterLayersKey] = savedLayersSanitize(JSON.parse(localStorage.getItem(semesterLayersKey) || '{}'));
        sessionExtraLayerIds(session).forEach(layerId => {
            sessionLayerCourses(session, layerId).forEach(course => {
                const courseKey = layerLessonsKey(course, layerId);
                session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
            });
        });
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        session[semesterLayersKey] = {};
    }

    return session;
}

export function savedMetadataFromLocalStorage(): Record<string, CourseMetadata> | null {
    let metadata: Record<string, CourseMetadata> | null = {};
    try {
        const courses = sessionAllCourses(savedSessionFromLocalStorage());
        courses.forEach(course => {
            const metadataCourseKey = `${currentSemester}_metadata_${course}`;
            const courseMetadataEncoded = localStorage.getItem(metadataCourseKey);
            if (courseMetadataEncoded) {
                (metadata as Record<string, CourseMetadata>)[course] = JSON.parse(courseMetadataEncoded);
            }
        });

        // If there's at least one course but no metadata at all, that probably means that
        // the user built the schedule before the feature was introduced.
        // Return null to handle the case.
        if (courses.length > 0 && Object.keys(metadata).length === 0) {
            metadata = null;
        }
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    return metadata;
}

export function savedSessionFromFirestoreData(data: ScheduleDocument): SavedSession {
    // Returns only the data relevant to the current semester from data.
    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const session: SavedSession = {};
    session[semesterCoursesKey] = data[semesterCoursesKey] || [];
    session[semesterCoursesKey].forEach(course => {
        const courseKey = layerLessonsKey(course, '');
        session[courseKey] = data[courseKey] || {};
    });

    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;
    session[semesterCustomEventsKey] = data[semesterCustomEventsKey] || {};

    const semesterColorsKey = `${currentSemester}_colors` as const;
    session[semesterColorsKey] = data[semesterColorsKey] || {};

    const semesterLayersKey = `${currentSemester}_layers` as const;
    session[semesterLayersKey] = savedLayersSanitize(data[semesterLayersKey]);
    sessionExtraLayerIds(session).forEach(layerId => {
        sessionLayerCourses(session, layerId).forEach(course => {
            const courseKey = layerLessonsKey(course, layerId);
            session[courseKey] = data[courseKey] || {};
        });
    });

    return session;
}

export function savedMetadataFromFirestoreData(data: ScheduleDocument): Record<string, CourseMetadata> | null {
    let metadata: Record<string, CourseMetadata> | null = {};

    const courses = sessionAllCourses(savedSessionFromFirestoreData(data));
    courses.forEach(course => {
        const metadataCourseKey = `${currentSemester}_metadata_${course}`;
        if (data[metadataCourseKey]) {
            (metadata as Record<string, CourseMetadata>)[course] = data[metadataCourseKey] as CourseMetadata;
        }
    });

    // If there's at least one course but no metadata at all, that probably means that
    // the user built the schedule before the feature was introduced.
    // Return null to handle the case.
    if (courses.length > 0 && Object.keys(metadata).length === 0) {
        metadata = null;
    }

    return metadata;
}
