'use strict';

// The HTTP API, independent of Firebase so that it can be tested with an in-memory store.
// See API.md for the documented endpoints.

const { ApiError } = require('./errors');
const { hashApiKey, looksLikeApiKey, apiKeyFromHeaders } = require('./keys');
const schedule = require('./schedule');
const { lessonTypeCandidates } = require('./catalog');
const { createRateLimiter, rateLimitHeaders } = require('./rate-limit');

const SEMESTER_RE = /^\d{6}$/;
const COURSE_RE = /^\d{6,8}$/;
const EVENT_ID_RE = /^\d{1,15}$/;

function requireSemester(value) {
    if (!SEMESTER_RE.test(value)) {
        throw new ApiError(400, 'invalid_semester', 'Semesters look like 202601 (year and 01, 02 or 03 for winter, spring or summer).');
    }
    return value;
}

function requireCourseNumber(value) {
    if (typeof value !== 'string' || !COURSE_RE.test(value)) {
        throw new ApiError(400, 'invalid_course', 'Course numbers look like 02340114.');
    }
    return value;
}

function requireEventId(value) {
    if (!EVENT_ID_RE.test(value)) {
        throw new ApiError(404, 'custom_event_not_found', 'No custom event with id ' + value + '.');
    }
    return value;
}

function requireBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError(400, 'invalid_body', 'The request body must be a JSON object.');
    }
    return body;
}

function requireLessonNumber(value) {
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
    }
    if (!Number.isInteger(value) || value < 0) {
        throw new ApiError(400, 'invalid_lesson_number', 'number must be a lesson number such as 11.');
    }
    return value;
}

// Each route is [method, pattern, handler]; pattern segments starting with ":" are parameters.
function createRoutes(deps) {
    const { store, loadCatalog, nowSeconds } = deps;

    async function catalogCourse(semester, course) {
        const catalog = await loadCatalog(semester);
        if (!catalog.has(course)) {
            throw new ApiError(404, 'course_not_found', 'Course ' + course + ' is not offered in semester ' + semester + '.');
        }
        return catalog;
    }

    async function withCourseNames(semester, courses) {
        let catalog = null;
        try {
            catalog = await loadCatalog(semester);
        } catch (e) {
            // Names are a convenience, the saved schedule is returned even without them.
        }
        return courses.map(item => Object.assign(
            { course: item.course, name: catalog ? catalog.name(item.course) : null },
            item));
    }

    async function readLayer(ctx) {
        const data = await store.read(ctx.uid, ctx.semester);
        return schedule.readLayer(data, ctx.semester, ctx.layer);
    }

    function transact(ctx, change) {
        return store.transact(ctx.uid, ctx.semester, change);
    }

    return [
        ['GET', '/v1/me', async ctx => {
            return { body: await store.userInfo(ctx.uid) };
        }],

        ['GET', '/v1/semesters/:semester/schedule', async ctx => {
            const data = await store.read(ctx.uid, ctx.semester);
            const result = schedule.readSchedule(data, ctx.semester);
            result.courses = await withCourseNames(ctx.semester, result.courses);
            for (const layer of result.layers) {
                layer.courses = await withCourseNames(ctx.semester, layer.courses);
            }
            return { body: result };
        }],

        ['GET', '/v1/semesters/:semester/courses', async ctx => {
            const layer = await readLayer(ctx);
            return { body: { semester: ctx.semester, layer: layer.id, courses: await withCourseNames(ctx.semester, layer.courses) } };
        }],

        ['POST', '/v1/semesters/:semester/courses', async ctx => {
            const course = requireCourseNumber(requireBody(ctx.body).course);
            const catalog = await catalogCourse(ctx.semester, course);
            await transact(ctx, data => ({
                update: schedule.addCourse(data, ctx.semester, course, ctx.layer, catalog.courseData(course))
            }));
            return { status: 201, body: { course: course, name: catalog.name(course), lessons: {} } };
        }],

        ['GET', '/v1/semesters/:semester/courses/:course', async ctx => {
            const layer = await readLayer(ctx);
            const item = layer.courses.find(entry => entry.course === ctx.params.course);
            if (!item) {
                throw new ApiError(404, 'course_not_in_schedule', 'Course ' + ctx.params.course + ' is not in the schedule.');
            }
            return { body: (await withCourseNames(ctx.semester, [item]))[0] };
        }],

        ['DELETE', '/v1/semesters/:semester/courses/:course', async ctx => {
            const course = requireCourseNumber(ctx.params.course);
            await transact(ctx, data => ({ update: schedule.removeCourse(data, ctx.semester, course, ctx.layer) }));
            return { status: 204 };
        }],

        ['PUT', '/v1/semesters/:semester/courses/:course/lessons/:type', async ctx => {
            const course = requireCourseNumber(ctx.params.course);
            const number = requireLessonNumber(requireBody(ctx.body).number);
            const catalog = await catalogCourse(ctx.semester, course);
            const type = catalog.resolveLessonType(course, ctx.params.type);
            catalog.requireLesson(course, type, number);
            await transact(ctx, data => ({
                update: schedule.setLesson(data, ctx.semester, course, type, number, ctx.layer)
            }));
            return { body: { course: course, type: type, number: number } };
        }],

        ['DELETE', '/v1/semesters/:semester/courses/:course/lessons/:type', async ctx => {
            const course = requireCourseNumber(ctx.params.course);
            let type = ctx.params.type;
            await transact(ctx, data => {
                // Allow the English alias of a saved Hebrew type without loading the catalog.
                const layerId = schedule.resolveLayer(data, ctx.semester, ctx.layer);
                const saved = Object.keys(schedule.lessonsOf(data, ctx.semester, course, layerId));
                type = lessonTypeCandidates(type).find(candidate => saved.includes(candidate)) || type;
                return { update: schedule.clearLesson(data, ctx.semester, course, type, ctx.layer) };
            });
            return { status: 204 };
        }],

        ['PUT', '/v1/semesters/:semester/courses/:course/color', async ctx => {
            const course = requireCourseNumber(ctx.params.course);
            const color = requireBody(ctx.body).color;
            await transact(ctx, data => ({ update: schedule.setCourseColor(data, ctx.semester, course, color, ctx.layer) }));
            return { body: { course: course, color: color === null ? null : color.toLowerCase() } };
        }],

        ['DELETE', '/v1/semesters/:semester/courses/:course/color', async ctx => {
            const course = requireCourseNumber(ctx.params.course);
            await transact(ctx, data => ({ update: schedule.setCourseColor(data, ctx.semester, course, null, ctx.layer) }));
            return { status: 204 };
        }],

        ['GET', '/v1/semesters/:semester/custom-events', async ctx => {
            const layer = await readLayer(ctx);
            return { body: { semester: ctx.semester, layer: layer.id, customEvents: layer.customEvents } };
        }],

        ['POST', '/v1/semesters/:semester/custom-events', async ctx => {
            const input = requireBody(ctx.body);
            const eventId = await transact(ctx, data => {
                const result = schedule.addCustomEvent(data, ctx.semester, input, ctx.layer, nowSeconds());
                return { update: result.update, result: result.eventId };
            });
            const layer = await readLayer(ctx);
            return { status: 201, body: layer.customEvents.find(event => event.id === eventId) };
        }],

        ['PATCH', '/v1/semesters/:semester/custom-events/:id', async ctx => {
            const eventId = requireEventId(ctx.params.id);
            const input = requireBody(ctx.body);
            await transact(ctx, data => ({
                update: schedule.updateCustomEvent(data, ctx.semester, eventId, input, ctx.layer)
            }));
            const layer = await readLayer(ctx);
            return { body: layer.customEvents.find(event => event.id === eventId) };
        }],

        ['DELETE', '/v1/semesters/:semester/custom-events/:id', async ctx => {
            const eventId = requireEventId(ctx.params.id);
            await transact(ctx, data => ({ update: schedule.removeCustomEvent(data, ctx.semester, eventId, ctx.layer) }));
            return { status: 204 };
        }],

        ['PUT', '/v1/semesters/:semester/custom-events/:id/color', async ctx => {
            const eventId = requireEventId(ctx.params.id);
            const color = requireBody(ctx.body).color;
            await transact(ctx, data => ({
                update: schedule.setCustomEventColor(data, ctx.semester, eventId, color, ctx.layer)
            }));
            return { body: { id: eventId, color: color === null ? null : color.toLowerCase() } };
        }],

        ['DELETE', '/v1/semesters/:semester/custom-events/:id/color', async ctx => {
            const eventId = requireEventId(ctx.params.id);
            await transact(ctx, data => ({
                update: schedule.setCustomEventColor(data, ctx.semester, eventId, null, ctx.layer)
            }));
            return { status: 204 };
        }],

        ['GET', '/v1/semesters/:semester/catalog/:course', async ctx => {
            const course = requireCourseNumber(ctx.params.course);
            const catalog = await catalogCourse(ctx.semester, course);
            const data = catalog.courseData(course);
            return { body: { course: course, name: catalog.name(course), general: data.general, lessons: catalog.lessons(course) } };
        }]
    ];
}

function decodePathSegment(segment) {
    try {
        return decodeURIComponent(segment);
    } catch (e) {
        // A malformed percent-encoding such as "%E0" is a client error, not an internal one.
        throw new ApiError(400, 'invalid_path', 'The request path has a malformed percent-encoding.');
    }
}

function matchRoute(routes, method, pathname) {
    const parts = pathname.replace(/\/+$/, '').split('/').slice(1).map(decodePathSegment);
    let pathMatched = false;

    for (const [routeMethod, pattern, handler] of routes) {
        const patternParts = pattern.split('/').slice(1);
        if (patternParts.length !== parts.length) {
            continue;
        }
        const params = {};
        const matches = patternParts.every((part, i) => {
            if (part.startsWith(':')) {
                params[part.slice(1)] = parts[i];
                return parts[i] !== '';
            }
            return part === parts[i];
        });
        if (!matches) {
            continue;
        }
        pathMatched = true;
        if (routeMethod === method) {
            return { handler: handler, params: params };
        }
    }

    if (pathMatched) {
        throw new ApiError(405, 'method_not_allowed', method + ' is not supported for this path.');
    }
    throw new ApiError(404, 'not_found', 'No such endpoint. See the API documentation.');
}

// Requests per user, whichever of their keys is used. There's deliberately no limit per IP
// address: the client IP comes from X-Forwarded-For, which clients can fake, so it could be
// used to lock out other users. Keys are 256-bit random values, so guessing them is hopeless.
const DEFAULT_USER_LIMIT = { limit: 60, windowMs: 60 * 1000 };

function tooManyRequests(message) {
    return new ApiError(429, 'rate_limited', message);
}

// Returns async (request) => response, where request is { method, path, query, headers, body }
// and response is { status, body, headers }.
function createApi(deps) {
    const routes = createRoutes(deps);
    const userLimiter = createRateLimiter(Object.assign({ now: deps.now }, DEFAULT_USER_LIMIT, deps.userLimit));

    async function authenticate(request) {
        const key = apiKeyFromHeaders(request.headers);
        if (!key) {
            throw new ApiError(401, 'missing_api_key', 'Send your API key in the Authorization header: "Bearer <key>".');
        }
        const uid = looksLikeApiKey(key) ? await deps.store.findKeyOwner(hashApiKey(key)) : null;
        if (!uid) {
            throw new ApiError(401, 'invalid_api_key', 'The API key is invalid or was revoked.');
        }
        return uid;
    }

    return async function handle(request) {
        let headers = {};
        try {
            const route = matchRoute(routes, request.method, request.path);
            const uid = await authenticate(request);

            const usage = userLimiter.take(uid);
            headers = rateLimitHeaders(usage);
            if (!usage.allowed) {
                throw tooManyRequests('Rate limit of ' + usage.limit + ' requests per minute exceeded, try again in ' +
                    usage.resetSeconds + ' seconds.');
            }

            const ctx = {
                uid: uid,
                params: route.params,
                body: request.body,
                layer: request.query && typeof request.query.layer === 'string' ? request.query.layer : undefined
            };
            if (route.params.semester !== undefined) {
                ctx.semester = requireSemester(route.params.semester);
            }

            const response = await route.handler(ctx);
            return { status: response.status || 200, body: response.body, headers: headers };
        } catch (e) {
            if (e instanceof ApiError) {
                return {
                    status: e.status,
                    body: { error: { code: e.code, message: e.message } },
                    headers: headers
                };
            }
            if (deps.logError) {
                deps.logError(e);
            }
            return { status: 500, body: { error: { code: 'internal', message: 'Internal error.' } }, headers: headers };
        }
    };
}

module.exports = { createApi };
