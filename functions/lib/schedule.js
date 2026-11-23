'use strict';

// Pure functions that read and change a saved schedule, as stored by cheesefork.js in a
// Firestore semester document. Each change returns an update map of dotted field paths,
// with DELETE marking a field to remove, which the store applies in a transaction.
// Keep the layout in sync with cheesefork.js (savedSessionFromFirestoreData and the
// *Save/*Unsave functions next to it).

const { ApiError } = require('./errors');

const DELETE = Symbol('delete');

const SEMESTERS_WITHOUT_SUB_COLLECTION = ['201701', '201702', '201703', '201801'];

// The calendar shows a single week, Sunday 2017-01-01 to Saturday 2017-01-07.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function keys(semester) {
    return {
        courses: semester + '_courses',
        customEvents: semester + '_custom_events',
        colors: semester + '_colors',
        layers: semester + '_layers',
        lessons: (course, layerId) => semester + '_' + (layerId ? layerId + '_' : '') + course,
        metadata: course => semester + '_metadata_' + course
    };
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Mirrors savedLayersSanitize in cheesefork.js.
function sanitizeLayers(savedLayers) {
    const layers = {};
    if (!isPlainObject(savedLayers)) {
        return layers;
    }

    Object.keys(savedLayers).forEach(layerId => {
        const savedLayer = savedLayers[layerId];
        if (!isPlainObject(savedLayer)) {
            return;
        }

        const layer = {};
        if (typeof savedLayer.name === 'string') {
            layer.name = savedLayer.name;
        }
        if (savedLayer.hidden) {
            layer.hidden = true;
        }

        if (layerId === 'default') {
            layers[layerId] = layer;
        } else if (/^layer\d+$/.test(layerId)) {
            layer.courses = Array.isArray(savedLayer.courses) ?
                savedLayer.courses.filter(course => typeof course === 'string') : [];
            layer.customEvents = isPlainObject(savedLayer.customEvents) ? savedLayer.customEvents : {};
            layers[layerId] = layer;
        }
    });

    // The first layer alone means no layers.
    return extraLayerIds(layers).length > 0 ? layers : {};
}

function extraLayerIds(layers) {
    return Object.keys(layers).filter(layerId => layerId !== 'default').sort();
}

function layerCourses(data, semester, layerId) {
    const k = keys(semester);
    if (!layerId) {
        return Array.isArray(data[k.courses]) ? data[k.courses] : [];
    }
    return sanitizeLayers(data[k.layers])[layerId].courses;
}

function allCourses(data, semester) {
    const courses = [];
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
function metadataEnabled(data, semester) {
    const courses = allCourses(data, semester);
    return courses.length === 0 || courses.some(course => data[keys(semester).metadata(course)]);
}

// Returns '' for the first layer, or the id of an existing extra layer.
function resolveLayer(data, semester, layer) {
    if (layer === undefined || layer === null || layer === '' || layer === 'default') {
        return '';
    }
    const layers = sanitizeLayers(data[keys(semester).layers]);
    if (!/^layer\d+$/.test(layer) || !layers[layer]) {
        throw new ApiError(404, 'layer_not_found', 'No layer "' + layer + '" in this semester.');
    }
    return layer;
}

function lessonsOf(data, semester, course, layerId) {
    const lessons = data[keys(semester).lessons(course, layerId)];
    return isPlainObject(lessons) ? lessons : {};
}

function customEventsOf(data, semester, layerId) {
    const k = keys(semester);
    const events = layerId ? sanitizeLayers(data[k.layers])[layerId].customEvents : data[k.customEvents];
    return isPlainObject(events) ? events : {};
}

function colorsOf(data, semester) {
    const colors = data[keys(semester).colors];
    return isPlainObject(colors) ? colors : {};
}

function courseColorKey(course, layerId) {
    return layerId ? layerId + '_' + course : course;
}

function customEventColorKey(eventId) {
    return 'custom_event_' + eventId;
}

function formatCustomEvent(id, event, colors) {
    const result = {
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

function formatLayer(data, semester, layerId, layerInfo) {
    const colors = colorsOf(data, semester);
    const events = customEventsOf(data, semester, layerId);
    return {
        id: layerId || 'default',
        name: layerInfo && typeof layerInfo.name === 'string' ? layerInfo.name : null,
        hidden: !!(layerInfo && layerInfo.hidden),
        courses: layerCourses(data, semester, layerId).map(course => ({
            course: course,
            lessons: lessonsOf(data, semester, course, layerId),
            color: colors[courseColorKey(course, layerId)] || null
        })),
        customEvents: Object.keys(events).map(id => formatCustomEvent(id, events[id], colors))
    };
}

// Returns the whole saved schedule of a semester in a stable, documented shape.
function readSchedule(data, semester) {
    const layers = sanitizeLayers(data[keys(semester).layers]);
    const main = formatLayer(data, semester, '', layers.default);
    return {
        semester: semester,
        courses: main.courses,
        customEvents: main.customEvents,
        layers: extraLayerIds(layers).length === 0 ? [] :
            [main].concat(extraLayerIds(layers).map(layerId => formatLayer(data, semester, layerId, layers[layerId])))
    };
}

function readLayer(data, semester, layer) {
    const layerId = resolveLayer(data, semester, layer);
    const layers = sanitizeLayers(data[keys(semester).layers]);
    return formatLayer(data, semester, layerId, layers[layerId || 'default']);
}

// Writes the whole layers field, as the client does for layer changes.
function layersUpdate(update, data, semester, changeLayer) {
    const k = keys(semester);
    const layers = JSON.parse(JSON.stringify(sanitizeLayers(data[k.layers])));
    changeLayer(layers);
    update[k.layers] = layers;
}

function addCourse(data, semester, course, layer, courseData) {
    const k = keys(semester);
    const layerId = resolveLayer(data, semester, layer);
    const courses = layerCourses(data, semester, layerId);
    if (courses.includes(course)) {
        throw new ApiError(409, 'course_exists', 'Course ' + course + ' is already in the schedule.');
    }

    const update = {};
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

function requireCourse(data, semester, course, layerId) {
    if (!layerCourses(data, semester, layerId).includes(course)) {
        throw new ApiError(404, 'course_not_in_schedule', 'Course ' + course + ' is not in the schedule.');
    }
}

function removeCourse(data, semester, course, layer) {
    const k = keys(semester);
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);

    const update = {};
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
    const inOtherLayer = [''].concat(extraLayerIds(layers)).some(otherLayerId =>
        otherLayerId !== layerId && layerCourses(data, semester, otherLayerId).includes(course));
    if (!inOtherLayer && data[k.metadata(course)] !== undefined) {
        update[k.metadata(course)] = DELETE;
    }
    return update;
}

function setLesson(data, semester, course, lessonType, lessonNumber, layer) {
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);
    const update = {};
    update[keys(semester).lessons(course, layerId) + '.' + lessonType] = lessonNumber;
    return update;
}

function clearLesson(data, semester, course, lessonType, layer) {
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);
    if (!Object.prototype.hasOwnProperty.call(lessonsOf(data, semester, course, layerId), lessonType)) {
        throw new ApiError(404, 'lesson_not_selected', 'No ' + lessonType + ' is selected for course ' + course + '.');
    }
    const update = {};
    update[keys(semester).lessons(course, layerId) + '.' + lessonType] = DELETE;
    return update;
}

// Sets or removes (color null) a custom color, keeping the colors field only if it's not empty.
function colorUpdate(update, data, semester, colorKey, color) {
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

function normalizeColor(color) {
    if (color === null) {
        return null;
    }
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new ApiError(400, 'invalid_color', 'color must be a hex color such as "#bf4040", or null.');
    }
    return color.toLowerCase();
}

function setCourseColor(data, semester, course, color, layer) {
    const layerId = resolveLayer(data, semester, layer);
    requireCourse(data, semester, course, layerId);
    const update = {};
    colorUpdate(update, data, semester, courseColorKey(course, layerId), normalizeColor(color));
    return update;
}

function parseCalendarTime(value) {
    const match = typeof value === 'string' && /^2017-01-0([1-8])T(\d\d):(\d\d)(?::00)?$/.exec(value);
    if (!match) {
        return null;
    }
    return { day: parseInt(match[1], 10) - 1, time: match[2] + ':' + match[3] };
}

function parseTime(value, name) {
    const match = typeof value === 'string' && /^(\d\d):(\d\d)$/.exec(value);
    if (!match || parseInt(match[1], 10) > 24 || parseInt(match[2], 10) > 59 ||
        (match[1] === '24' && match[2] !== '00')) {
        throw new ApiError(400, 'invalid_time', name + ' must be a time such as "08:30".');
    }
    return value;
}

// Converts the API's day and times to the client's calendar dates, such as 2017-01-01T08:30:00.
function eventTimes(input, existing) {
    const existingStart = existing && parseCalendarTime(existing.start);
    const existingEnd = existing && parseCalendarTime(existing.end);

    let day = existingStart ? existingStart.day : undefined;
    if (input.day !== undefined) {
        day = DAYS.indexOf(typeof input.day === 'string' ? input.day.toLowerCase() : input.day);
        if (day === -1) {
            throw new ApiError(400, 'invalid_day', 'day must be one of: ' + DAYS.join(', ') + '.');
        }
    }
    if (day === undefined) {
        throw new ApiError(400, 'missing_field', 'day is required.');
    }

    const startTime = input.startTime !== undefined ? parseTime(input.startTime, 'startTime') :
        existingStart && existingStart.time;
    let endTime = input.endTime !== undefined ? parseTime(input.endTime, 'endTime') :
        existingEnd && (existingEnd.day > existingStart.day && existingEnd.time === '00:00' ? '24:00' : existingEnd.time);
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

function eventTitle(title) {
    if (typeof title !== 'string' || title.trim() === '' || title.length > 500) {
        throw new ApiError(400, 'invalid_title', 'title must be a non-empty string of up to 500 characters.');
    }
    return title.trim();
}

function customEventPath(semester, eventId) {
    return keys(semester).customEvents + '.' + eventId;
}

// The client uses the current time in seconds as the id, incrementing it until it's unused.
function newCustomEventId(data, semester, nowSeconds) {
    const used = new Set();
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

function addCustomEvent(data, semester, input, layer, nowSeconds) {
    const layerId = resolveLayer(data, semester, layer);
    const eventId = newCustomEventId(data, semester, nowSeconds);
    const event = Object.assign({ title: eventTitle(input.title) }, eventTimes(input, null));

    const update = {};
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

function requireCustomEvent(data, semester, eventId, layerId) {
    const event = customEventsOf(data, semester, layerId)[eventId];
    if (!isPlainObject(event)) {
        throw new ApiError(404, 'custom_event_not_found', 'No custom event with id ' + eventId + '.');
    }
    return event;
}

function updateCustomEvent(data, semester, eventId, input, layer) {
    const layerId = resolveLayer(data, semester, layer);
    const existing = requireCustomEvent(data, semester, eventId, layerId);
    const event = Object.assign(
        { title: input.title !== undefined ? eventTitle(input.title) : existing.title },
        eventTimes(input, existing));

    const update = {};
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

function removeCustomEvent(data, semester, eventId, layer) {
    const layerId = resolveLayer(data, semester, layer);
    requireCustomEvent(data, semester, eventId, layerId);

    const update = {};
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

function setCustomEventColor(data, semester, eventId, color, layer) {
    const layerId = resolveLayer(data, semester, layer);
    requireCustomEvent(data, semester, eventId, layerId);
    const update = {};
    colorUpdate(update, data, semester, customEventColorKey(eventId), normalizeColor(color));
    return update;
}

function documentPath(uid, semester) {
    if (SEMESTERS_WITHOUT_SUB_COLLECTION.includes(semester)) {
        return 'users/' + uid;
    }
    return 'users/' + uid + '/semesters/' + semester;
}

module.exports = {
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
    setCustomEventColor
};
