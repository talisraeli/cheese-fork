import type { CustomEventData } from '../lib/schedule-types.js';
import type { LessonsKey, SavedLayer, SavedSession } from './session-types.js';
import { courseColorKey } from './colors.js';
import { COLLAPSED_LAYERS_STORAGE_KEY } from './constants.js';
import { onSavedSessionChange, savedSessionChangesSave, setScheduleFromSavedSession } from './history.js';
import { onMetadataDiffChange } from './metadata-diff.js';
import { state } from './state.js';

// Layers
//
// Layers are optional. The first layer is what a schedule without layers is, and it's saved
// in the same keys: <semester>_courses, <semester>_<course> and <semester>_custom_events.
// Its layer id is an empty string.
//
// Once more layers are added, <semester>_layers holds them, by layer id:
// { name, hidden (if true), courses, customEvents }. The selected lessons of their courses
// are saved in <semester>_<layerId>_<course>. The 'default' item of <semester>_layers is
// optional and holds the name and hidden values of the first layer if they were changed.

export function layerLessonsKey(course: string, layerId?: string | null): LessonsKey {
    // Course numbers are digits, see LessonsKey.
    return `${currentSemester}_${layerId ? `${layerId}_` : ''}${course}` as LessonsKey;
}

export function sessionExtraLayerIds(session: SavedSession) {
    const semesterLayersKey = `${currentSemester}_layers` as const;
    return Object.keys(session[semesterLayersKey] || {})
        .filter(layerId => layerId !== 'default')
        .sort();
}

export function sessionLayerCourses(session: SavedSession, layerId: string) {
    if (!layerId) {
        return session[`${currentSemester}_courses` as const] || [];
    }

    return session[`${currentSemester}_layers` as const][layerId].courses;
}

// Returns the courses of all layers, each course once.
export function sessionAllCourses(session: SavedSession): string[] {
    const courses: string[] = [];

    [''].concat(sessionExtraLayerIds(session)).forEach(layerId => {
        sessionLayerCourses(session, layerId).forEach(course => {
            if (!courses.includes(course)) {
                courses.push(course);
            }
        });
    });

    return courses;
}

// Returns valid layers data from saved data, which can be of another user for a shared schedule.
export function savedLayersSanitize(savedLayers: unknown): Record<string, SavedLayer> {
    const layers: Record<string, SavedLayer> = {};
    let extraLayersCount = 0;

    if (!savedLayers || typeof savedLayers !== 'object') {
        return layers;
    }

    const source = savedLayers as Record<
        string,
        { name?: unknown; hidden?: unknown; courses?: unknown; customEvents?: unknown } | null
    >;
    Object.keys(source).forEach(layerId => {
        const savedLayer = source[layerId];
        if (!savedLayer || typeof savedLayer !== 'object') {
            return;
        }

        const layer: Partial<SavedLayer> = {};
        if (typeof savedLayer.name === 'string') {
            layer.name = savedLayer.name;
        }
        if (savedLayer.hidden) {
            layer.hidden = true;
        }

        if (layerId === 'default') {
            layers[layerId] = layer as SavedLayer;
        } else if (/^layer\d+$/.test(layerId)) {
            layer.courses = Array.isArray(savedLayer.courses)
                ? savedLayer.courses.filter((course): course is string => typeof course === 'string')
                : [];
            layer.customEvents =
                savedLayer.customEvents && typeof savedLayer.customEvents === 'object'
                    ? (savedLayer.customEvents as Record<string, CustomEventData>)
                    : {};
            layers[layerId] = layer as SavedLayer;
            extraLayersCount++;
        }
    });

    // The first layer alone means no layers.
    return extraLayersCount > 0 ? layers : {};
}

// Returns the layers to show for the session, or an empty array if layers aren't used.
export function layersFromSavedSession(session: SavedSession) {
    const extraLayerIds = sessionExtraLayerIds(session);
    if (extraLayerIds.length === 0) {
        return [];
    }

    const savedLayers = session[`${currentSemester}_layers` as const];
    const firstLayer = savedLayers.default || {};

    return [
        {
            id: '',
            name: firstLayer.name || CheeseI18n.t('shell.layers.defaultName', { number: 1 }),
            hidden: !!firstLayer.hidden
        }
    ].concat(
        extraLayerIds.map(layerId => ({
            id: layerId,
            name: savedLayers[layerId].name || CheeseI18n.t('shell.layers.unnamed'),
            hidden: !!savedLayers[layerId].hidden
        }))
    );
}

export function isLayerVisible(layerId: string) {
    return !state.currentLayers.some(layer => layer.id === layerId && layer.hidden);
}

// Returns the selected courses of the visible layers, each course once.
export function getVisibleCourseNumbers() {
    if (state.currentLayers.length === 0) {
        return state.courseButtonList.getCourseNumbers(true);
    }

    const courseNumbers: string[] = [];

    state.currentLayers.forEach(layer => {
        if (!layer.hidden) {
            state.courseButtonList.getCourseNumbers(true, layer.id).forEach(course => {
                if (!courseNumbers.includes(course)) {
                    courseNumbers.push(course);
                }
            });
        }
    });

    return courseNumbers;
}

// Returns the layers in which the course is shown in the calendar.
export function getLayerIdsOfCourse(course: string) {
    if (state.currentLayers.length === 0) {
        return [''];
    }

    const layerIds = state.currentLayers
        .map(layer => layer.id)
        .filter(layerId => state.courseButtonList.isCourseInList(course, layerId));

    if (state.previewingFromSelectControl === course && !layerIds.includes(state.previewingFromSelectControlLayerId)) {
        layerIds.push(state.previewingFromSelectControlLayerId);
    }

    return layerIds;
}

// Applies a change to the saved session and saves it.
// updateFunc gets a copy of the session to modify.
export function savedSessionUpdate(updateFunc: (session: SavedSession) => void) {
    const newSession = $.extend(true, {}, state.currentSavedSession); // make a deep copy
    updateFunc(newSession);

    savedSessionChangesSave(state.currentSavedSession, newSession);
    state.currentSavedSession = newSession;

    metadataDiffRemoveUnusedCourses();
    onSavedSessionChange();
}

// Same, for changes of the layers themselves, after which the schedule is reloaded.
export function savedSessionUpdateAndReload(updateFunc: (session: SavedSession) => void) {
    savedSessionUpdate(updateFunc);
    setScheduleFromSavedSession(state.currentSavedSession, true);
    state.courseSelect.filterApply();
}

export function metadataDiffRemoveUnusedCourses() {
    const metadataDiff = state.metadataDiff;
    if (!metadataDiff) {
        return;
    }

    const courses = sessionAllCourses(state.currentSavedSession);
    let changed = false;

    Object.keys(metadataDiff).forEach(course => {
        if (!courses.includes(course)) {
            delete metadataDiff[course];
            changed = true;
        }
    });

    if (changed) {
        onMetadataDiffChange();
    }
}

export function sessionLayerCourseMove(
    session: SavedSession,
    course: string,
    fromLayerId: string,
    toLayerId: string,
    toLayerCourses?: string[]
) {
    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const semesterLayersKey = `${currentSemester}_layers` as const;

    const setLayerCourses = (layerId: string, courses: string[]) => {
        if (layerId) {
            session[semesterLayersKey][layerId].courses = courses;
        } else {
            session[semesterCoursesKey] = courses;
        }
    };

    setLayerCourses(
        fromLayerId,
        sessionLayerCourses(session, fromLayerId).filter(item => item !== course)
    );

    // Keep the items which aren't in the given order, same as in selectedCourseSave.
    toLayerCourses = toLayerCourses || [course];
    setLayerCourses(
        toLayerId,
        toLayerCourses.concat(sessionLayerCourses(session, toLayerId).filter(item => !toLayerCourses.includes(item)))
    );

    const fromKey = layerLessonsKey(course, fromLayerId);
    session[layerLessonsKey(course, toLayerId)] = session[fromKey] || {};
    delete session[fromKey];

    // The color moves with the course.
    sessionCourseColorMove(session, course, fromLayerId, toLayerId);
}

export function sessionCourseColorMove(session: SavedSession, course: string, fromLayerId: string, toLayerId: string) {
    const colors = session[`${currentSemester}_colors` as const];
    const fromColorKey = courseColorKey(course, fromLayerId);
    const toColorKey = courseColorKey(course, toLayerId);
    if (colors[fromColorKey]) {
        colors[toColorKey] = colors[fromColorKey];
    } else {
        delete colors[toColorKey];
    }
    delete colors[fromColorKey];
}

// Removes the remaining course colors of a removed layer, including of courses which were
// unselected earlier. Layer ids aren't reused, so these colors are no longer needed.
export function sessionLayerCourseColorsRemove(session: SavedSession, layerId: string) {
    const colors = session[`${currentSemester}_colors` as const];
    Object.keys(colors).forEach(colorKey => {
        if (colorKey.indexOf(`${layerId}_`) === 0) {
            delete colors[colorKey];
        }
    });
}

export function layerCourseMove(course: string, fromLayerId: string, toLayerId: string) {
    const toLayerCourses = state.courseButtonList.getCourseNumbers(true, toLayerId);

    savedSessionUpdateAndReload(session => {
        sessionLayerCourseMove(session, course, fromLayerId, toLayerId, toLayerCourses);
    });
}

export function sessionLayerCustomEvents(session: SavedSession, layerId: string) {
    if (!layerId) {
        return session[`${currentSemester}_custom_events` as const];
    }

    return session[`${currentSemester}_layers` as const][layerId].customEvents;
}

export function sessionLayerCustomEventMove(
    session: SavedSession,
    eventId: string,
    fromLayerId: string,
    toLayerId: string
) {
    const fromCustomEvents = sessionLayerCustomEvents(session, fromLayerId);
    if (fromCustomEvents[eventId]) {
        sessionLayerCustomEvents(session, toLayerId)[eventId] = fromCustomEvents[eventId];
        delete fromCustomEvents[eventId];
    }
}

export function layerCustomEventMove(eventId: string, fromLayerId: string, toLayerId: string) {
    savedSessionUpdateAndReload(session => {
        sessionLayerCustomEventMove(session, eventId, fromLayerId, toLayerId);
    });
}

export function layerCustomEventRemove(eventId: string, layerId: string) {
    savedSessionUpdateAndReload(session => {
        delete sessionLayerCustomEvents(session, layerId)[eventId];
        // Same as in customEventUnsave, the color of a removed event is no longer needed.
        delete session[`${currentSemester}_colors` as const][`custom_event_${eventId}`];
    });
}

// Creates a new layer. If course or customEventId are given, the item is moved to the new layer.
// Layer ids are the creation time in seconds, made unique.
export function newLayerIdFor(layers: Record<string, SavedLayer>) {
    let layerIdCounter = Math.round(Date.now() / 1000);
    while (layers[`layer${layerIdCounter}`]) {
        layerIdCounter++;
    }
    return `layer${layerIdCounter}`;
}

export function layerCreate(course: string | null, fromLayerId: string | null, customEventId?: string) {
    const semesterLayersKey = `${currentSemester}_layers` as const;
    // Set by the update, which runs right away.
    let newLayerId: string | undefined;

    savedSessionUpdateAndReload(session => {
        const layers = session[semesterLayersKey];

        newLayerId = newLayerIdFor(layers);

        layers[newLayerId] = {
            name: CheeseI18n.t('shell.layers.defaultName', { number: sessionExtraLayerIds(session).length + 2 }),
            courses: [],
            customEvents: {}
        };

        if (course !== null) {
            sessionLayerCourseMove(session, course, fromLayerId as string, newLayerId);
        } else if (customEventId !== undefined) {
            sessionLayerCustomEventMove(session, customEventId, fromLayerId as string, newLayerId);
        }
    });

    if (course === null && customEventId === undefined) {
        // An empty layer was requested, probably for adding courses to it.
        state.courseButtonList.setActiveLayer(newLayerId as string);
    }
}

// Adds a copy of the layer, with its courses and their selected lessons, its custom events
// and their custom colors, and selects it for adding courses, to try a variation of a plan.
// The copy is visible even if the layer is hidden.
export function layerDuplicate(layerId: string) {
    const semesterLayersKey = `${currentSemester}_layers` as const;
    const semesterColorsKey = `${currentSemester}_colors` as const;
    // Set by the update, which runs right away.
    let newLayerId: string | undefined;

    const layerName = state.currentLayers.filter(layer => layer.id === layerId)[0].name;

    savedSessionUpdateAndReload(session => {
        const layers = session[semesterLayersKey];
        const colors = session[semesterColorsKey];

        const copyId = newLayerIdFor(layers);
        newLayerId = copyId;

        const courses = sessionLayerCourses(session, layerId).slice();
        const layer: SavedLayer = {
            name: CheeseI18n.t('courses.layers.copyName', { name: layerName }),
            courses,
            customEvents: {}
        };
        layers[copyId] = layer;

        courses.forEach(course => {
            session[layerLessonsKey(course, copyId)] = $.extend(
                true,
                {},
                session[layerLessonsKey(course, layerId)] || {}
            );
            if (colors[courseColorKey(course, layerId)]) {
                colors[courseColorKey(course, copyId)] = colors[courseColorKey(course, layerId)];
            }
        });

        // Custom event ids are unique across the layers, see onCustomEventAdded.
        const usedEventIds: Record<string, true> = {};
        [''].concat(sessionExtraLayerIds(session)).forEach(otherLayerId => {
            Object.keys(sessionLayerCustomEvents(session, otherLayerId) || {}).forEach(eventId => {
                usedEventIds[eventId] = true;
            });
        });
        let eventIdCounter = Math.round(Date.now() / 1000);

        const customEvents = sessionLayerCustomEvents(session, layerId) || {};
        Object.keys(customEvents)
            .sort()
            .forEach(eventId => {
                while (usedEventIds[eventIdCounter]) {
                    eventIdCounter++;
                }
                const newEventId = String(eventIdCounter);
                usedEventIds[newEventId] = true;

                layer.customEvents[newEventId] = $.extend(true, {}, customEvents[eventId]);
                if (colors[`custom_event_${eventId}`]) {
                    colors[`custom_event_${newEventId}`] = colors[`custom_event_${eventId}`];
                }
            });
    });

    state.courseButtonList.setActiveLayer(newLayerId as string);
}

export function layerRename(layerId: string, name: string) {
    const semesterLayersKey = `${currentSemester}_layers` as const;

    savedSessionUpdateAndReload(session => {
        const layers = session[semesterLayersKey];
        const key = layerId || 'default';
        layers[key] = layers[key] || {};
        layers[key].name = name;
    });
}

export function layerVisibilityChange(layerId: string, hidden: boolean) {
    const semesterLayersKey = `${currentSemester}_layers` as const;

    savedSessionUpdateAndReload(session => {
        const layers = session[semesterLayersKey];
        const key = layerId || 'default';
        layers[key] = layers[key] || {};
        if (hidden) {
            layers[key].hidden = true;
        } else {
            delete layers[key].hidden;
        }

        if (Object.keys(layers.default || {}).length === 0) {
            delete layers.default;
        }
    });
}

// Returns the collapsed layer ids of the current semester, see collapsedLayerIds.
export function collapsedLayersLoad(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    try {
        const saved = JSON.parse(String(localStorage.getItem(COLLAPSED_LAYERS_STORAGE_KEY)));
        const ids = saved && saved[currentSemester];
        if (Array.isArray(ids)) {
            ids.forEach(id => {
                if (typeof id === 'string' && id) {
                    result[id] = true;
                }
            });
        }
    } catch (e) {
        // Unavailable or invalid, all layers are expanded.
    }
    return result;
}

export function collapsedLayersSave() {
    if (state.viewingSharedSchedule) {
        return;
    }

    try {
        let saved: Record<string, unknown> | null = null;
        try {
            saved = JSON.parse(String(localStorage.getItem(COLLAPSED_LAYERS_STORAGE_KEY)));
        } catch (e) {
            // Invalid, replace it.
        }
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            saved = {};
        }

        const ids = Object.keys(state.collapsedLayerIds);
        if (ids.length > 0) {
            saved[currentSemester] = ids;
        } else {
            delete saved[currentSemester];
        }

        if (Object.keys(saved).length > 0) {
            localStorage.setItem(COLLAPSED_LAYERS_STORAGE_KEY, JSON.stringify(saved));
        } else {
            localStorage.removeItem(COLLAPSED_LAYERS_STORAGE_KEY);
        }
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }
}

export function isLayerCollapsed(layerId: string) {
    return !!state.collapsedLayerIds[layerId || 'default'];
}

export function layerCollapseChange(layerId: string, collapsed: boolean) {
    const key = layerId || 'default';
    if (collapsed) {
        state.collapsedLayerIds[key] = true;
    } else {
        delete state.collapsedLayerIds[key];
    }

    state.currentLayers.forEach(layer => {
        if (layer.id === layerId) {
            layer.collapsed = collapsed;
        }
    });

    collapsedLayersSave();
}

// Deletes the layer with its courses and custom events.
export function layerDelete(layerId: string) {
    // Deleting the first layer moves the next layer into it, so its collapsed state moves too.
    let collapsedKey = layerId;
    if (!layerId) {
        collapsedKey = state.currentLayers[1] && state.currentLayers[1].id;
        if (collapsedKey && isLayerCollapsed(collapsedKey)) {
            state.collapsedLayerIds.default = true;
        } else {
            delete state.collapsedLayerIds.default;
        }
    }
    if (collapsedKey) {
        delete state.collapsedLayerIds[collapsedKey];
    }
    collapsedLayersSave();

    const semesterCoursesKey = `${currentSemester}_courses` as const;
    const semesterCustomEventsKey = `${currentSemester}_custom_events` as const;
    const semesterLayersKey = `${currentSemester}_layers` as const;

    savedSessionUpdateAndReload(session => {
        const layers = session[semesterLayersKey];

        sessionLayerCourses(session, layerId).forEach(course => {
            delete session[layerLessonsKey(course, layerId)];
        });

        // The colors of the removed custom events are no longer needed. Course colors of the
        // first layer are kept, same as when unselecting a course, since its keys are reused.
        const layerCustomEvents = layerId ? layers[layerId].customEvents : session[semesterCustomEventsKey];
        Object.keys(layerCustomEvents || {}).forEach(eventId => {
            delete session[`${currentSemester}_colors` as const][`custom_event_${eventId}`];
        });

        if (layerId) {
            sessionLayerCourseColorsRemove(session, layerId);
            delete layers[layerId];
        } else {
            // The first layer can't be removed, since it's the layer of the keys
            // which are used without layers. Move the next layer into it instead.
            const nextLayerId = sessionExtraLayerIds(session)[0];
            const nextLayer = layers[nextLayerId];

            session[semesterCoursesKey] = nextLayer.courses;
            nextLayer.courses.forEach(course => {
                const nextLayerKey = layerLessonsKey(course, nextLayerId);
                session[layerLessonsKey(course, '')] = session[nextLayerKey] || {};
                delete session[nextLayerKey];
                sessionCourseColorMove(session, course, nextLayerId, '');
            });
            sessionLayerCourseColorsRemove(session, nextLayerId);

            session[semesterCustomEventsKey] = nextLayer.customEvents;

            // The first layer has no courses or custom events of its own, see SavedLayer.
            layers.default = { name: nextLayer.name } as SavedLayer;
            if (nextLayer.hidden) {
                layers.default.hidden = true;
            }

            delete layers[nextLayerId];
        }

        // With only the first layer left, layers are no longer used.
        if (sessionExtraLayerIds(session).length === 0) {
            session[semesterLayersKey] = {};
        }
    });
}
