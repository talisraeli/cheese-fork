// Pure functions that read and change a saved schedule, as stored by the site in a Firestore
// semester document. Each change returns an update map of dotted field paths, with DELETE
// marking a field to remove, which the store applies in a transaction. Keep the layout in sync
// with the site (savedSessionFromFirestoreData in src/app/schedule-sync.ts, and the functions of
// src/app/schedule-edits.ts and src/app/layers.ts).

import { ApiError } from './errors.ts';
import type { CatalogLessonInfo } from './catalog.ts';
import type { Change, Lessons, SavedCustomEvent, SavedLayer, ScheduleData, Update } from './types.ts';

type Layers = Record<string, SavedLayer>;

// An item of a layer that can overlap another, see findConflicts.
interface ConflictItem {
    key: string;
    day: number;
    start: number;
    end: number;
    item: Record<string, unknown>;
}

const DELETE = Symbol('delete');

const SEMESTERS_WITHOUT_SUB_COLLECTION = ['201701', '201702', '201703', '201801'];

// The calendar shows a single week, Sunday 2017-01-01 to Saturday 2017-01-07.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function keys(semester: string) {
    return {
        courses: semester + '_courses',
        customEvents: semester + '_custom_events',
        colors: semester + '_colors',
        layers: semester + '_layers',
        lessons: (course: string, layerId?: string) => semester + '_' + (layerId ? layerId + '_' : '') + course,
        metadata: (course: string) => semester + '_metadata_' + course
    };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Mirrors savedLayersSanitize in src/app/layers.ts.
function sanitizeLayers(savedLayers: unknown): Record<string, SavedLayer> {
    const layers: Record<string, SavedLayer> = {};
    if (!isPlainObject(savedLayers)) {
        return layers;
    }

    Object.keys(savedLayers).forEach(layerId => {
        const savedLayer = savedLayers[layerId];
        if (!isPlainObject(savedLayer)) {
            return;
        }

        const layer: Partial<SavedLayer> = {};
        if (typeof savedLayer.name === 'string') {
            layer.name = savedLayer.name;
        }
        if (savedLayer.hidden) {
            layer.hidden = true;
        }

        // The first layer has no courses or custom events of its own, see SavedLayer.
        if (layerId === 'default') {
            layers[layerId] = layer as SavedLayer;
        } else if (/^layer\d+$/.test(layerId)) {
            layer.courses = Array.isArray(savedLayer.courses)
                ? savedLayer.courses.filter((course): course is string => typeof course === 'string')
                : [];
            layer.customEvents = isPlainObject(savedLayer.customEvents)
                ? (savedLayer.customEvents as Record<string, SavedCustomEvent>)
                : {};
            layers[layerId] = layer as SavedLayer;
        }
    });

    // The first layer alone means no layers.
    return extraLayerIds(layers).length > 0 ? layers : {};
}

function extraLayerIds(layers: Record<string, SavedLayer>): string[] {
    return Object.keys(layers)
        .filter(layerId => layerId !== 'default')
        .sort();
}

function layerCourses(data: ScheduleData, semester: string, layerId: string): string[] {
    const k = keys(semester);
    if (!layerId) {
        const courses = data[k.courses];
        return Array.isArray(courses) ? courses : [];
    }
    return sanitizeLayers(data[k.layers])[layerId].courses;
}

function allCourses(data: ScheduleData, semester: string): string[] {
    const courses: string[] = [];
    const layers = sanitizeLayers(data[keys(semester).layers]);
    [''].concat(extraLayerIds(layers)).forEach(layerId => {
        layerCourses(data, semester, layerId).forEach(course => {
            if (!courses.includes(course)) {
                courses.push(course);
            }
        });
    });
    return courses;
}

// Mirrors savedMetadataFromFirestoreData: schedules built before the course change tracking
// feature have courses but no metadata, and the client then ignores metadata altogether.
function metadataEnabled(data: ScheduleData, semester: string) {
    const courses = allCourses(data, semester);
    return courses.length === 0 || courses.some(course => data[keys(semester).metadata(course)]);
}

// Returns '' for the first layer, or the id of an existing extra layer.
function resolveLayer(data: ScheduleData, semester: string, layer: unknown): string {
    if (layer === undefined || layer === null || layer === '' || layer === 'default') {
        return '';
    }
    const layers = sanitizeLayers(data[keys(semester).layers]);
    if (typeof layer !== 'string' || !/^layer\d+$/.test(layer) || !layers[layer]) {
        throw new ApiError(404, 'layer_not_found', 'No layer "' + layer + '" in this semester.');
    }
    return layer;
}

function lessonsOf(data: ScheduleData, semester: string, course: string, layerId: string): Lessons {
    const lessons = data[keys(semester).lessons(course, layerId)];
    return isPlainObject(lessons) ? lessons : {};
}

function customEventsOf(data: ScheduleData, semester: string, layerId: string): Record<string, SavedCustomEvent> {
    const k = keys(semester);
    const events = layerId ? sanitizeLayers(data[k.layers])[layerId].customEvents : data[k.customEvents];
    return isPlainObject(events) ? (events as Record<string, SavedCustomEvent>) : {};
}

function colorsOf(data: ScheduleData, semester: string): Record<string, unknown> {
    const colors = data[keys(semester).colors];
    return isPlainObject(colors) ? colors : {};
}

function courseColorKey(course: string, layerId: string) {
    return layerId ? layerId + '_' + course : course;
}

function customEventColorKey(eventId: string) {
    return 'custom_event_' + eventId;
}

function formatCustomEvent(id: string, event: SavedCustomEvent, colors: Record<string, unknown>) {
    const result: {
        id: string;
        title: string;
        start: string;
        end: string;
        day?: string;
        startTime?: string;
        endTime?: string;
        color?: unknown;
    } = {
        id: String(id),
        title: event.title,
        start: event.start,
        end: event.end
    };
    const day = parseCalendarTime(event.start);
    const end = parseCalendarTime(event.end);
    if (day && end) {
        result.day = DAYS[day.day];
        result.startTime = day.time;
        result.endTime = end.day > day.day && end.time === '00:00' ? '24:00' : end.time;
    }
    result.color = colors[customEventColorKey(id)] || null;
    return result;
}

// A course of a layer as the API returns it. The API adds the course's name from the catalog.
interface ScheduleCourse {
    course: string;
    name?: string | null;
    lessons: Lessons;
    color: unknown;
}

function formatLayer(data: ScheduleData, semester: string, layerId: string, layerInfo: SavedLayer | undefined) {
    const colors = colorsOf(data, semester);
    const events = customEventsOf(data, semester, layerId);
    return {
        id: layerId || 'default',
        name: layerInfo && typeof layerInfo.name === 'string' ? layerInfo.name : null,
        hidden: !!(layerInfo && layerInfo.hidden),
        courses: layerCourses(data, semester, layerId).map((course): ScheduleCourse => ({
            course: course,
            lessons: lessonsOf(data, semester, course, layerId),
            color: colors[courseColorKey(course, layerId)] || null
        })),
        customEvents: Object.keys(events).map(id => formatCustomEvent(id, events[id], colors))
    };
}

// Returns the whole saved schedule of a semester in a stable, documented shape.
function readSchedule(data: ScheduleData, semester: string) {
    const layers = sanitizeLayers(data[keys(semester).layers]);
    const main = formatLayer(data, semester, '', layers.default);
    return {
        semester: semester,
        courses: main.courses,
        customEvents: main.customEvents,
        layers:
            extraLayerIds(layers).length === 0
                ? []
                : [main].concat(
                      extraLayerIds(layers).map(layerId => formatLayer(data, semester, layerId, layers[layerId]))
                  )
    };
}

function readLayer(data: ScheduleData, semester: string, layer?: unknown) {
    const layerId = resolveLayer(data, semester, layer);
    const layers = sanitizeLayers(data[keys(semester).layers]);
    return formatLayer(data, semester, layerId, layers[layerId || 'default']);
}

// Writes the whole layers field, as the client does for layer changes.
function layersUpdate(
    update: Update,
    data: ScheduleData,
    semester: string,
    changeLayer: (layers: Record<string, SavedLayer>) => void
) {
    const k = keys(semester);
    const layers = JSON.parse(JSON.stringify(sanitizeLayers(data[k.layers])));
    changeLayer(layers);
    update[k.layers] = layers;
}

function addCourse(data: ScheduleData, semester: string, course: string, layer: unknown, courseData: unknown) {
    const k = keys(semester);
    const layerId = resolveLayer(data, semester, layer);
    const courses = layerCourses(data, semester, layerId);
    if (courses.includes(course)) {
        throw new ApiError(409, 'course_exists', 'Course ' + course + ' is already in the schedule.');
    }

    const update: Update = {};
    if (layerId) {
        layersUpdate(update, data, semester, layers => {
            layers[layerId].courses.push(course);
        });
    } else {
        update[k.courses] = courses.concat([course]);
    }
    update[k.lessons(course, layerId)] = {};

    // The metadata is saved once for a course, regardless of the layers it's in.
    if (courseData && metadataEnabled(data, semester) && !allCourses(data, semester).includes(course)) {
        update[k.metadata(course)] = courseData;
    }
    return update;
}

function requireCourse(data: ScheduleData, semester: string, course: string, layerId: string) {
    if (!layerCourses(data, semester, layerId).includes(course)) {
        throw new ApiError(404, 'course_not_in_schedule', 'Course ' + course + ' is not in the schedule.');
    }
}

function removeCourse(data: ScheduleData, semester: string, course: string, layer: unknown) {
    const k = keys(semester);
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);

    const update: Update = {};
    if (layerId) {
        layersUpdate(update, data, semester, layers => {
            layers[layerId].courses = layers[layerId].courses.filter(item => item !== course);
        });
    } else {
        update[k.courses] = layerCourses(data, semester, '').filter(item => item !== course);
    }
    update[k.lessons(course, layerId)] = DELETE;

    // The metadata is still needed if the course is in another layer.
    const layers = sanitizeLayers(data[k.layers]);
    const inOtherLayer = ['']
        .concat(extraLayerIds(layers))
        .some(otherLayerId => otherLayerId !== layerId && layerCourses(data, semester, otherLayerId).includes(course));
    if (!inOtherLayer && data[k.metadata(course)] !== undefined) {
        update[k.metadata(course)] = DELETE;
    }
    return update;
}

function setLesson(
    data: ScheduleData,
    semester: string,
    course: string,
    lessonType: string,
    lessonNumber: number,
    layer: unknown
) {
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);
    const update: Update = {};
    update[keys(semester).lessons(course, layerId) + '.' + lessonType] = lessonNumber;
    return update;
}

function clearLesson(data: ScheduleData, semester: string, course: string, lessonType: string, layer: unknown) {
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);
    if (!Object.prototype.hasOwnProperty.call(lessonsOf(data, semester, course, layerId), lessonType)) {
        throw new ApiError(404, 'lesson_not_selected', 'No ' + lessonType + ' is selected for course ' + course + '.');
    }
    const update: Update = {};
    update[keys(semester).lessons(course, layerId) + '.' + lessonType] = DELETE;
    return update;
}

// Sets or removes (color null) a custom color, keeping the colors field only if it's not empty.
function colorUpdate(update: Update, data: ScheduleData, semester: string, colorKey: string, color: unknown) {
    const k = keys(semester);
    const colors = Object.assign({}, colorsOf(data, semester));
    if (color) {
        colors[colorKey] = color;
    } else {
        delete colors[colorKey];
    }

    if (Object.keys(colors).length === 0) {
        if (data[k.colors] !== undefined) {
            update[k.colors] = DELETE;
        }
    } else {
        update[k.colors + '.' + colorKey] = color || DELETE;
    }
}

function normalizeColor(color: unknown) {
    if (color === null) {
        return null;
    }
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new ApiError(400, 'invalid_color', 'color must be a hex color such as "#bf4040", or null.');
    }
    return color.toLowerCase();
}

function setCourseColor(data: ScheduleData, semester: string, course: string, color: unknown, layer: unknown) {
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);
    const update: Update = {};
    colorUpdate(update, data, semester, courseColorKey(course, layerId), normalizeColor(color));
    return update;
}

function parseCalendarTime(value: unknown) {
    const match = typeof value === 'string' && /^2017-01-0([1-8])T(\d\d):(\d\d)(?::00)?$/.exec(value);
    if (!match) {
        return null;
    }
    return { day: parseInt(match[1], 10) - 1, time: match[2] + ':' + match[3] };
}

function parseTime(value: unknown, name: string) {
    const match = typeof value === 'string' && /^(\d\d):(\d\d)$/.exec(value);
    if (
        !match ||
        parseInt(match[1], 10) > 24 ||
        parseInt(match[2], 10) > 59 ||
        (match[1] === '24' && match[2] !== '00')
    ) {
        throw new ApiError(400, 'invalid_time', name + ' must be a time such as "08:30".');
    }
    return value;
}

// Converts the API's day and times to the client's calendar dates, such as 2017-01-01T08:30:00.
function eventTimes(input: Record<string, unknown>, existing: SavedCustomEvent | null) {
    const existingStart = existing && parseCalendarTime(existing.start);
    const existingEnd = existing && parseCalendarTime(existing.end);

    let day = existingStart ? existingStart.day : undefined;
    if (input.day !== undefined) {
        day = typeof input.day === 'string' ? DAYS.indexOf(input.day.toLowerCase()) : -1;
        if (day === -1) {
            throw new ApiError(400, 'invalid_day', 'day must be one of: ' + DAYS.join(', ') + '.');
        }
    }
    if (day === undefined) {
        throw new ApiError(400, 'missing_field', 'day is required.');
    }

    const startTime =
        input.startTime !== undefined ? parseTime(input.startTime, 'startTime') : existingStart && existingStart.time;
    let endTime =
        input.endTime !== undefined
            ? parseTime(input.endTime, 'endTime')
            : existingEnd &&
              (existingEnd.day > (existingStart as { day: number }).day && existingEnd.time === '00:00'
                  ? '24:00'
                  : existingEnd.time);
    if (!startTime || !endTime) {
        throw new ApiError(400, 'missing_field', 'startTime and endTime are required.');
    }
    if (startTime === '24:00' || startTime >= endTime) {
        throw new ApiError(400, 'invalid_time', 'startTime must be before endTime.');
    }

    let endDay = day;
    if (endTime === '24:00') {
        endDay = day + 1;
        endTime = '00:00';
    }
    return {
        start: '2017-01-0' + (day + 1) + 'T' + startTime + ':00',
        end: '2017-01-0' + (endDay + 1) + 'T' + endTime + ':00'
    };
}

function eventTitle(title: unknown) {
    if (typeof title !== 'string' || title.trim() === '' || title.length > 500) {
        throw new ApiError(400, 'invalid_title', 'title must be a non-empty string of up to 500 characters.');
    }
    return title.trim();
}

function customEventPath(semester: string, eventId: string) {
    return keys(semester).customEvents + '.' + eventId;
}

// The client uses the current time in seconds as the id, incrementing it until it's unused.
function newCustomEventId(data: ScheduleData, semester: string, nowSeconds: number) {
    const used = new Set<string>();
    const layers = sanitizeLayers(data[keys(semester).layers]);
    [''].concat(extraLayerIds(layers)).forEach(layerId => {
        Object.keys(customEventsOf(data, semester, layerId)).forEach(id => used.add(id));
    });
    let id = nowSeconds;
    while (used.has(String(id))) {
        id++;
    }
    return String(id);
}

function addCustomEvent(
    data: ScheduleData,
    semester: string,
    input: Record<string, unknown>,
    layer: unknown,
    nowSeconds: number
) {
    const layerId = resolveLayer(data, semester, layer);
    const eventId = newCustomEventId(data, semester, nowSeconds);
    const event = Object.assign({ title: eventTitle(input.title) }, eventTimes(input, null));

    const update: Update = {};
    if (layerId) {
        layersUpdate(update, data, semester, layers => {
            layers[layerId].customEvents[eventId] = event;
        });
    } else {
        update[customEventPath(semester, eventId)] = event;
    }
    if (input.color !== undefined && input.color !== null) {
        colorUpdate(update, data, semester, customEventColorKey(eventId), normalizeColor(input.color));
    }
    return { update: update, eventId: eventId };
}

function requireCustomEvent(data: ScheduleData, semester: string, eventId: string, layerId: string): SavedCustomEvent {
    const event = customEventsOf(data, semester, layerId)[eventId];
    if (!isPlainObject(event)) {
        throw new ApiError(404, 'custom_event_not_found', 'No custom event with id ' + eventId + '.');
    }
    return event;
}

function updateCustomEvent(
    data: ScheduleData,
    semester: string,
    eventId: string,
    input: Record<string, unknown>,
    layer: unknown
) {
    const layerId = resolveLayer(data, semester, layer);
    const existing = requireCustomEvent(data, semester, eventId, layerId);
    const event = Object.assign(
        { title: input.title !== undefined ? eventTitle(input.title) : existing.title },
        eventTimes(input, existing)
    );

    const update: Update = {};
    if (layerId) {
        layersUpdate(update, data, semester, layers => {
            layers[layerId].customEvents[eventId] = event;
        });
    } else {
        update[customEventPath(semester, eventId)] = event;
    }
    if (input.color !== undefined) {
        colorUpdate(update, data, semester, customEventColorKey(eventId), normalizeColor(input.color));
    }
    return update;
}

function removeCustomEvent(data: ScheduleData, semester: string, eventId: string, layer: unknown) {
    const layerId = resolveLayer(data, semester, layer);
    requireCustomEvent(data, semester, eventId, layerId);

    const update: Update = {};
    if (layerId) {
        layersUpdate(update, data, semester, layers => {
            delete layers[layerId].customEvents[eventId];
        });
    } else {
        update[customEventPath(semester, eventId)] = DELETE;
    }
    // The event id isn't reused, so its custom color (if any) is no longer needed.
    if (colorsOf(data, semester)[customEventColorKey(eventId)]) {
        colorUpdate(update, data, semester, customEventColorKey(eventId), null);
    }
    return update;
}

function setCustomEventColor(data: ScheduleData, semester: string, eventId: string, color: unknown, layer: unknown) {
    const layerId = resolveLayer(data, semester, layer);
    requireCustomEvent(data, semester, eventId, layerId);
    const update: Update = {};
    colorUpdate(update, data, semester, customEventColorKey(eventId), normalizeColor(color));
    return update;
}

// Layer changes rewrite several fields at once, like the client does. They're made on a copy of
// the semester's fields (see semesterChange), mirroring the layer functions of src/app/layers.ts:
// layerCreate, layerRename, layerVisibilityChange, layerDelete, layerDuplicate and
// sessionLayerCourseMove.

const LAYER_NAME_MAX_LENGTH = 20;

// Returns the update that turns the semester's fields in data into those of the copy that
// change(copy) modifies, with whole fields set or removed, as the client saves them.
function semesterChange<T>(data: ScheduleData, semester: string, change: (copy: ScheduleData) => T): Change<T> {
    const prefix = semester + '_';
    const before: ScheduleData = {};
    Object.keys(data).forEach(key => {
        if (key.startsWith(prefix)) {
            before[key] = data[key];
        }
    });
    const after: ScheduleData = JSON.parse(JSON.stringify(before));
    const result = change(after);

    // Empty layers and colors aren't saved, see savedSessionChangesSave.
    const k = keys(semester);
    after[k.layers] = sanitizeLayers(after[k.layers]);
    (['layers', 'colors'] as const).forEach(name => {
        const value = after[k[name]];
        if (!isPlainObject(value) || Object.keys(value).length === 0) {
            delete after[k[name]];
        }
    });

    // The metadata is kept only for courses that are in a layer, see removeCourse.
    const coursesAfter = allCourses(after, semester);
    allCourses(before, semester).forEach(course => {
        if (!coursesAfter.includes(course)) {
            delete after[k.metadata(course)];
        }
    });

    const update: Update = {};
    new Set(Object.keys(before).concat(Object.keys(after))).forEach(key => {
        if (!(key in after)) {
            update[key] = DELETE;
        } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
            update[key] = after[key];
        }
    });
    return { update: update, result: result };
}

// The layers of a semester copy, with the courses and custom events of each, see sanitizeLayers.
function copyLayers(session: ScheduleData, semester: string): Layers {
    const k = keys(semester);
    const layers = sanitizeLayers(session[k.layers]);
    session[k.layers] = layers;
    return layers;
}

// The layers of a copy that copyLayers sanitized.
function sessionLayers(session: ScheduleData, semester: string): Layers {
    return session[keys(semester).layers] as Layers;
}

function sessionLayerCourses(session: ScheduleData, semester: string, layerId: string): string[] {
    const k = keys(semester);
    if (!layerId) {
        const courses = Array.isArray(session[k.courses]) ? (session[k.courses] as string[]) : [];
        session[k.courses] = courses;
        return courses;
    }
    return sessionLayers(session, semester)[layerId].courses;
}

function setSessionLayerCourses(session: ScheduleData, semester: string, layerId: string, courses: string[]) {
    if (layerId) {
        sessionLayers(session, semester)[layerId].courses = courses;
    } else {
        session[keys(semester).courses] = courses;
    }
}

function sessionLayerCustomEvents(
    session: ScheduleData,
    semester: string,
    layerId: string
): Record<string, SavedCustomEvent> {
    const k = keys(semester);
    if (!layerId) {
        const value = session[k.customEvents];
        const events = isPlainObject(value) ? (value as Record<string, SavedCustomEvent>) : {};
        session[k.customEvents] = events;
        return events;
    }
    return sessionLayers(session, semester)[layerId].customEvents;
}

function sessionColors(session: ScheduleData, semester: string): Record<string, unknown> {
    const k = keys(semester);
    const value = session[k.colors];
    const colors = isPlainObject(value) ? value : {};
    session[k.colors] = colors;
    return colors;
}

function layerName(name: unknown): string {
    if (typeof name !== 'string' || name.trim() === '' || name.trim().length > LAYER_NAME_MAX_LENGTH) {
        throw new ApiError(
            400,
            'invalid_name',
            'name must be a non-empty string of up to ' + LAYER_NAME_MAX_LENGTH + ' characters.'
        );
    }
    return name.trim();
}

function layerHidden(hidden: unknown) {
    if (typeof hidden !== 'boolean') {
        throw new ApiError(400, 'invalid_hidden', 'hidden must be true or false.');
    }
    return hidden;
}

// Layer ids are the creation time in seconds, made unique, see newLayerIdFor in src/app/layers.ts.
function newLayerId(layers: Record<string, SavedLayer>, nowSeconds: number) {
    let counter = nowSeconds;
    while (layers['layer' + counter]) {
        counter++;
    }
    return 'layer' + counter;
}

// The name the site shows for a layer, see layersFromSavedSession.
function layerDisplayName(layers: Record<string, SavedLayer>, layerId: string) {
    const layer = layers[layerId || 'default'];
    if (layer && typeof layer.name === 'string' && layer.name !== '') {
        return layer.name;
    }
    return layerId ? 'Layer' : 'Layer 1';
}

function requireLayersUsed(data: ScheduleData, semester: string) {
    if (extraLayerIds(sanitizeLayers(data[keys(semester).layers])).length === 0) {
        throw new ApiError(409, 'layers_not_used', 'This schedule has a single layer. Create a layer first.');
    }
}

// Accepts 'default' (or no layer) for the first layer, or an existing layer id.
function resolveLayerParam(data: ScheduleData, semester: string, layer: unknown) {
    return resolveLayer(data, semester, layer);
}

function createLayer(data: ScheduleData, semester: string, input: Record<string, unknown>, nowSeconds: number) {
    const name = input.name !== undefined ? layerName(input.name) : null;
    const hidden = input.hidden !== undefined ? layerHidden(input.hidden) : false;

    return semesterChange(data, semester, session => {
        const layers = copyLayers(session, semester);
        const layerId = newLayerId(layers, nowSeconds);
        const layer: SavedLayer = {
            name: name || 'Layer ' + (extraLayerIds(layers).length + 2),
            courses: [],
            customEvents: {}
        };
        if (hidden) {
            layer.hidden = true;
        }
        layers[layerId] = layer;
        return layerId;
    });
}

function updateLayer(data: ScheduleData, semester: string, layer: unknown, input: Record<string, unknown>) {
    if (input.name === undefined && input.hidden === undefined) {
        throw new ApiError(400, 'missing_field', 'Send name, hidden or both.');
    }
    requireLayersUsed(data, semester);
    const layerId = resolveLayerParam(data, semester, layer);
    const name = input.name !== undefined ? layerName(input.name) : undefined;
    const hidden = input.hidden !== undefined ? layerHidden(input.hidden) : undefined;

    return semesterChange(data, semester, session => {
        const layers = copyLayers(session, semester);
        const key = layerId || 'default';
        // The first layer may have no entry yet, see SavedLayer.
        layers[key] = layers[key] || ({} as SavedLayer);
        if (name !== undefined) {
            layers[key].name = name;
        }
        if (hidden === true) {
            layers[key].hidden = true;
        } else if (hidden === false) {
            delete layers[key].hidden;
        }
        if (Object.keys(layers.default || {}).length === 0) {
            delete layers.default;
        }
        return layerId || 'default';
    });
}

function deleteLayer(data: ScheduleData, semester: string, layer: unknown) {
    requireLayersUsed(data, semester);
    const layerId = resolveLayerParam(data, semester, layer);

    return semesterChange(data, semester, session => {
        const k = keys(semester);
        const layers = copyLayers(session, semester);
        const colors = sessionColors(session, semester);

        sessionLayerCourses(session, semester, layerId).forEach(course => {
            delete session[k.lessons(course, layerId)];
        });

        // The colors of the removed custom events are no longer needed. Course colors of the
        // first layer are kept, same as when removing a course, since its keys are reused.
        Object.keys(sessionLayerCustomEvents(session, semester, layerId)).forEach(eventId => {
            delete colors[customEventColorKey(eventId)];
        });

        const removeLayerCourseColors = (id: string) => {
            Object.keys(colors).forEach(colorKey => {
                if (colorKey.startsWith(id + '_')) {
                    delete colors[colorKey];
                }
            });
        };

        if (layerId) {
            removeLayerCourseColors(layerId);
            delete layers[layerId];
            return;
        }

        // The first layer can't be removed, since its keys are those of a schedule without
        // layers. The next layer is moved into it instead.
        const nextLayerId = extraLayerIds(layers)[0];
        const nextLayer = layers[nextLayerId];

        session[k.courses] = nextLayer.courses;
        nextLayer.courses.forEach(course => {
            const nextKey = k.lessons(course, nextLayerId);
            session[k.lessons(course, '')] = isPlainObject(session[nextKey]) ? session[nextKey] : {};
            delete session[nextKey];

            const fromColorKey = courseColorKey(course, nextLayerId);
            if (colors[fromColorKey]) {
                colors[course] = colors[fromColorKey];
            } else {
                delete colors[course];
            }
        });
        removeLayerCourseColors(nextLayerId);

        session[k.customEvents] = nextLayer.customEvents;

        // The first layer has no courses or custom events of its own, see SavedLayer.
        layers.default = { name: nextLayer.name } as SavedLayer;
        if (nextLayer.hidden) {
            layers.default.hidden = true;
        }
        delete layers[nextLayerId];
    });
}

function duplicateLayer(data: ScheduleData, semester: string, layer: unknown, nowSeconds: number) {
    const layerId = resolveLayerParam(data, semester, layer);

    return semesterChange(data, semester, session => {
        const k = keys(semester);
        const layers = copyLayers(session, semester);
        const colors = sessionColors(session, semester);
        const newId = newLayerId(layers, nowSeconds);

        const courses = sessionLayerCourses(session, semester, layerId).slice();
        const copy: SavedLayer = {
            name: layerDisplayName(layers, layerId) + ' (copy)',
            courses: courses,
            customEvents: {}
        };
        layers[newId] = copy;

        courses.forEach(course => {
            const lessons = session[k.lessons(course, layerId)];
            session[k.lessons(course, newId)] = isPlainObject(lessons) ? JSON.parse(JSON.stringify(lessons)) : {};
            if (colors[courseColorKey(course, layerId)]) {
                colors[courseColorKey(course, newId)] = colors[courseColorKey(course, layerId)];
            }
        });

        // Custom event ids are unique across the layers.
        const usedEventIds = new Set<string>();
        [''].concat(extraLayerIds(layers)).forEach(otherLayerId => {
            Object.keys(sessionLayerCustomEvents(session, semester, otherLayerId)).forEach(id => usedEventIds.add(id));
        });
        let eventIdCounter = nowSeconds;
        const customEvents = sessionLayerCustomEvents(session, semester, layerId);
        Object.keys(customEvents)
            .sort()
            .forEach(eventId => {
                while (usedEventIds.has(String(eventIdCounter))) {
                    eventIdCounter++;
                }
                const newEventId = String(eventIdCounter);
                usedEventIds.add(newEventId);
                copy.customEvents[newEventId] = JSON.parse(JSON.stringify(customEvents[eventId]));
                if (colors[customEventColorKey(eventId)]) {
                    colors[customEventColorKey(newEventId)] = colors[customEventColorKey(eventId)];
                }
            });

        return newId;
    });
}

function moveCourse(data: ScheduleData, semester: string, course: string, fromLayer: unknown, toLayer: unknown) {
    const fromLayerId = resolveLayerParam(data, semester, fromLayer);
    if (typeof toLayer !== 'string' || toLayer === '') {
        throw new ApiError(400, 'missing_field', 'to is required: the id of the layer to move the course to.');
    }
    const toLayerId = resolveLayerParam(data, semester, toLayer);
    requireCourse(data, semester, course, fromLayerId);
    if (fromLayerId === toLayerId) {
        throw new ApiError(400, 'same_layer', 'The course is already in this layer.');
    }
    if (layerCourses(data, semester, toLayerId).includes(course)) {
        throw new ApiError(409, 'course_exists', 'Course ' + course + ' is already in the target layer.');
    }

    return semesterChange(data, semester, session => {
        const k = keys(semester);
        copyLayers(session, semester);
        const colors = sessionColors(session, semester);

        setSessionLayerCourses(
            session,
            semester,
            fromLayerId,
            sessionLayerCourses(session, semester, fromLayerId).filter(item => item !== course)
        );
        setSessionLayerCourses(
            session,
            semester,
            toLayerId,
            sessionLayerCourses(session, semester, toLayerId).concat([course])
        );

        const fromKey = k.lessons(course, fromLayerId);
        session[k.lessons(course, toLayerId)] = isPlainObject(session[fromKey]) ? session[fromKey] : {};
        delete session[fromKey];

        // The color moves with the course.
        const fromColorKey = courseColorKey(course, fromLayerId);
        const toColorKey = courseColorKey(course, toLayerId);
        if (colors[fromColorKey]) {
            colors[toColorKey] = colors[fromColorKey];
        } else {
            delete colors[toColorKey];
        }
        delete colors[fromColorKey];

        return toLayerId || 'default';
    });
}

// Hebrew day names in the catalog, from Sunday.
const CATALOG_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function minutes(time: string) {
    const [hours, mins] = time.split(':').map(value => parseInt(value, 10));
    return hours * 60 + mins;
}

// Overlapping items of a layer: the meetings of its selected lessons and its custom events.
// lessonsOfCourse(course) returns the catalog lessons of a course, see Catalog.lessons.
function findConflicts(
    data: ScheduleData,
    semester: string,
    layer: unknown,
    lessonsOfCourse: (course: string) => CatalogLessonInfo[],
    courseName: (course: string) => string | null
) {
    const formatted = readLayer(data, semester, layer);
    const items: ConflictItem[] = [];

    formatted.courses.forEach(entry => {
        const lessons = lessonsOfCourse(entry.course);
        Object.keys(entry.lessons).forEach(type => {
            const number = entry.lessons[type];
            lessons
                .filter(lesson => lesson.type === type && lesson.number === number)
                .forEach(lesson => {
                    const day = CATALOG_DAYS.indexOf(String(lesson.day));
                    const time = /^(\d{1,2}:\d\d)\s*-\s*(\d{1,2}:\d\d)$/.exec(String(lesson.time || '').trim());
                    if (day === -1 || !time) {
                        return;
                    }
                    items.push({
                        key: 'lesson:' + entry.course + ':' + type + ':' + number,
                        day: day,
                        start: minutes(time[1]),
                        end: minutes(time[2]),
                        item: {
                            kind: 'lesson',
                            course: entry.course,
                            name: courseName(entry.course),
                            type: type,
                            number: number,
                            day: DAYS[day],
                            startTime: time[1].padStart(5, '0'),
                            endTime: time[2].padStart(5, '0')
                        }
                    });
                });
        });
    });

    formatted.customEvents.forEach(event => {
        if (!event.day) {
            return;
        }
        // Formatted custom events have a day and times when their times are valid.
        const startTime = event.startTime as string;
        const endTime = event.endTime as string;
        items.push({
            key: 'customEvent:' + event.id,
            day: DAYS.indexOf(event.day),
            start: minutes(startTime),
            end: endTime === '24:00' ? 24 * 60 : minutes(endTime),
            item: {
                kind: 'customEvent',
                id: event.id,
                title: event.title,
                day: event.day,
                startTime: event.startTime,
                endTime: event.endTime
            }
        });
    });

    const conflicts: [Record<string, unknown>, Record<string, unknown>][] = [];
    items.forEach((a, i) => {
        items.slice(i + 1).forEach(b => {
            if (a.key !== b.key && a.day === b.day && a.start < b.end && b.start < a.end) {
                conflicts.push([a.item, b.item]);
            }
        });
    });
    return { layer: formatted.id, conflicts: conflicts };
}

// Whether a semester document has courses or custom events, in any layer.
function hasSchedule(data: ScheduleData, semester: string) {
    if (allCourses(data, semester).length > 0) {
        return true;
    }
    const layers = sanitizeLayers(data[keys(semester).layers]);
    return ['']
        .concat(extraLayerIds(layers))
        .some(layerId => Object.keys(customEventsOf(data, semester, layerId)).length > 0);
}

function documentPath(uid: string, semester: string) {
    if (SEMESTERS_WITHOUT_SUB_COLLECTION.includes(semester)) {
        return 'users/' + uid;
    }
    return 'users/' + uid + '/semesters/' + semester;
}

export {
    DELETE,
    DAYS,
    documentPath,
    readSchedule,
    readLayer,
    resolveLayer,
    lessonsOf,
    addCourse,
    removeCourse,
    setLesson,
    clearLesson,
    setCourseColor,
    addCustomEvent,
    updateCustomEvent,
    removeCustomEvent,
    setCustomEventColor,
    createLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    moveCourse,
    findConflicts,
    hasSchedule,
    SEMESTERS_WITHOUT_SUB_COLLECTION
};
