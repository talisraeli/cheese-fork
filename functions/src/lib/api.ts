// The HTTP API, independent of Firebase so that it can be tested with an in-memory store.
// See docs/API.md for the documented endpoints.

import { ApiError } from './errors.ts';
import { hashApiKey, looksLikeApiKey, apiKeyFromHeaders } from './keys.ts';
import * as schedule from './schedule.ts';
import { lessonTypeCandidates } from './catalog.ts';
import { createRateLimiter, rateLimitHeaders, type RateLimitOptions } from './rate-limit.ts';
import type { Catalog } from './catalog.ts';
import type { Change, ScheduleData, Store } from './types.ts';

export interface ApiDeps {
    store: Store;
    loadCatalog: (semester: string) => Promise<Catalog>;
    loadSemesters: () => Promise<Record<string, { start: string; end: string }>>;
    nowSeconds: () => number;
    // For the rate limit, Date.now by default.
    now?: () => number;
    userLimit?: Partial<RateLimitOptions>;
    logError?: (error: unknown) => void;
}

export interface ApiRequest {
    method: string;
    path: string;
    query?: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
}

export interface ApiResponse {
    status: number;
    body: unknown;
    headers: Record<string, string>;
}

// A request, authenticated. The semester is that of the path, or '' for paths without one.
interface RequestContext {
    uid: string;
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: unknown;
    layer: string | undefined;
    semester: string;
}

type RouteHandler = (ctx: RequestContext) => Promise<{ status?: number; body?: unknown }>;
type Route = [method: string, pattern: string, handler: RouteHandler];

const SEMESTER_RE = /^\d{6}$/;
const COURSE_RE = /^\d{6,8}$/;
const EVENT_ID_RE = /^\d{1,15}$/;

function requireSemester(value: string): string {
    if (!SEMESTER_RE.test(value)) {
        throw new ApiError(
            400,
            'invalid_semester',
            'Semesters look like 202601 (year and 01, 02 or 03 for winter, spring or summer).'
        );
    }
    return value;
}

function requireCourseNumber(value: unknown): string {
    if (typeof value !== 'string' || !COURSE_RE.test(value)) {
        throw new ApiError(400, 'invalid_course', 'Course numbers look like 02340114.');
    }
    return value;
}

function requireEventId(value: string): string {
    if (!EVENT_ID_RE.test(value)) {
        throw new ApiError(404, 'custom_event_not_found', 'No custom event with id ' + value + '.');
    }
    return value;
}

function requireBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError(400, 'invalid_body', 'The request body must be a JSON object.');
    }
    return body as Record<string, unknown>;
}

// A whole number from a query string, between min and max, or the default if it's missing.
function queryInteger(
    query: Record<string, unknown> | undefined,
    name: string,
    defaultValue: number,
    min: number,
    max: number
) {
    const value = query && query[name];
    if (value === undefined || value === '') {
        return defaultValue;
    }
    if (typeof value !== 'string' || !/^\d+$/.test(value) || parseInt(value, 10) < min || parseInt(value, 10) > max) {
        throw new ApiError(400, 'invalid_' + name, name + ' must be a whole number from ' + min + ' to ' + max + '.');
    }
    return parseInt(value, 10);
}

function requireLessonNumber(value: unknown): number {
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new ApiError(400, 'invalid_lesson_number', 'number must be a lesson number such as 11.');
    }
    return value;
}

// Each route is [method, pattern, handler]; pattern segments starting with ":" are parameters.
function createRoutes(deps: ApiDeps): Route[] {
    const { store, loadCatalog, loadSemesters, nowSeconds } = deps;

    async function catalogCourse(semester: string, course: string) {
        const catalog = await loadCatalog(semester);
        if (!catalog.has(course)) {
            throw new ApiError(
                404,
                'course_not_found',
                'Course ' + course + ' is not offered in semester ' + semester + '.'
            );
        }
        return catalog;
    }

    async function withCourseNames<T extends { course: string }>(
        semester: string,
        courses: T[]
    ): Promise<(T & { name: string | null })[]> {
        let catalog: Catalog | null = null;
        try {
            catalog = await loadCatalog(semester);
        } catch (e) {
            // Names are a convenience, the saved schedule is returned even without them.
        }
        return courses.map(item =>
            Object.assign({ course: item.course, name: catalog ? catalog.name(item.course) : null }, item)
        );
    }

    async function readLayer(ctx: RequestContext) {
        const data = await store.read(ctx.uid, ctx.semester);
        return schedule.readLayer(data, ctx.semester, ctx.layer);
    }

    function transact<T>(ctx: RequestContext, change: (data: ScheduleData) => Change<T>): Promise<T> {
        return store.transact(ctx.uid, ctx.semester, change);
    }

    // The layer as GET /courses and GET /custom-events describe it, with its name and courses.
    async function layerBody(ctx: RequestContext, layerId: string) {
        const data = await store.read(ctx.uid, ctx.semester);
        const layer = schedule.readLayer(data, ctx.semester, layerId);
        layer.courses = await withCourseNames(ctx.semester, layer.courses);
        return Object.assign({ semester: ctx.semester }, layer);
    }

    return [
        [
            'GET',
            '/v1/me',
            async ctx => {
                return { body: await store.userInfo(ctx.uid) };
            }
        ],

        [
            'GET',
            '/v1/semesters',
            async ctx => {
                const [semesters, saved] = await Promise.all([loadSemesters(), store.readAll(ctx.uid)]);
                const ids = Object.keys(semesters).sort().reverse();
                return {
                    body: {
                        latest: ids[0] || null,
                        semesters: ids.map(semester => ({
                            semester: semester,
                            start: semesters[semester].start,
                            end: semesters[semester].end,
                            hasSchedule: !!saved[semester] && schedule.hasSchedule(saved[semester], semester)
                        }))
                    }
                };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/schedule',
            async ctx => {
                const data = await store.read(ctx.uid, ctx.semester);
                const result = schedule.readSchedule(data, ctx.semester);
                result.courses = await withCourseNames(ctx.semester, result.courses);
                for (const layer of result.layers) {
                    layer.courses = await withCourseNames(ctx.semester, layer.courses);
                }
                return { body: result };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/courses',
            async ctx => {
                const layer = await readLayer(ctx);
                return {
                    body: {
                        semester: ctx.semester,
                        layer: layer.id,
                        courses: await withCourseNames(ctx.semester, layer.courses)
                    }
                };
            }
        ],

        [
            'POST',
            '/v1/semesters/:semester/courses',
            async ctx => {
                const course = requireCourseNumber(requireBody(ctx.body).course);
                const catalog = await catalogCourse(ctx.semester, course);
                await transact(ctx, data => ({
                    update: schedule.addCourse(data, ctx.semester, course, ctx.layer, catalog.courseData(course))
                }));
                return { status: 201, body: { course: course, name: catalog.name(course), lessons: {} } };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/courses/:course',
            async ctx => {
                const layer = await readLayer(ctx);
                const item = layer.courses.find(entry => entry.course === ctx.params.course);
                if (!item) {
                    throw new ApiError(
                        404,
                        'course_not_in_schedule',
                        'Course ' + ctx.params.course + ' is not in the schedule.'
                    );
                }
                return { body: (await withCourseNames(ctx.semester, [item]))[0] };
            }
        ],

        [
            'DELETE',
            '/v1/semesters/:semester/courses/:course',
            async ctx => {
                const course = requireCourseNumber(ctx.params.course);
                await transact(ctx, data => ({ update: schedule.removeCourse(data, ctx.semester, course, ctx.layer) }));
                return { status: 204 };
            }
        ],

        [
            'PUT',
            '/v1/semesters/:semester/courses/:course/lessons/:type',
            async ctx => {
                const course = requireCourseNumber(ctx.params.course);
                const number = requireLessonNumber(requireBody(ctx.body).number);
                const catalog = await catalogCourse(ctx.semester, course);
                const type = catalog.resolveLessonType(course, ctx.params.type);
                catalog.requireLesson(course, type, number);
                await transact(ctx, data => ({
                    update: schedule.setLesson(data, ctx.semester, course, type, number, ctx.layer)
                }));
                return { body: { course: course, type: type, number: number } };
            }
        ],

        [
            'DELETE',
            '/v1/semesters/:semester/courses/:course/lessons/:type',
            async ctx => {
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
            }
        ],

        [
            'PUT',
            '/v1/semesters/:semester/courses/:course/color',
            async ctx => {
                const course = requireCourseNumber(ctx.params.course);
                const color = requireBody(ctx.body).color;
                await transact(ctx, data => ({
                    update: schedule.setCourseColor(data, ctx.semester, course, color, ctx.layer)
                }));
                return { body: { course: course, color: color === null ? null : (color as string).toLowerCase() } };
            }
        ],

        [
            'DELETE',
            '/v1/semesters/:semester/courses/:course/color',
            async ctx => {
                const course = requireCourseNumber(ctx.params.course);
                await transact(ctx, data => ({
                    update: schedule.setCourseColor(data, ctx.semester, course, null, ctx.layer)
                }));
                return { status: 204 };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/custom-events',
            async ctx => {
                const layer = await readLayer(ctx);
                return { body: { semester: ctx.semester, layer: layer.id, customEvents: layer.customEvents } };
            }
        ],

        [
            'POST',
            '/v1/semesters/:semester/custom-events',
            async ctx => {
                const input = requireBody(ctx.body);
                const eventId = await transact(ctx, data => {
                    const result = schedule.addCustomEvent(data, ctx.semester, input, ctx.layer, nowSeconds());
                    return { update: result.update, result: result.eventId };
                });
                const layer = await readLayer(ctx);
                return { status: 201, body: layer.customEvents.find(event => event.id === eventId) };
            }
        ],

        [
            'PATCH',
            '/v1/semesters/:semester/custom-events/:id',
            async ctx => {
                const eventId = requireEventId(ctx.params.id);
                const input = requireBody(ctx.body);
                await transact(ctx, data => ({
                    update: schedule.updateCustomEvent(data, ctx.semester, eventId, input, ctx.layer)
                }));
                const layer = await readLayer(ctx);
                return { body: layer.customEvents.find(event => event.id === eventId) };
            }
        ],

        [
            'DELETE',
            '/v1/semesters/:semester/custom-events/:id',
            async ctx => {
                const eventId = requireEventId(ctx.params.id);
                await transact(ctx, data => ({
                    update: schedule.removeCustomEvent(data, ctx.semester, eventId, ctx.layer)
                }));
                return { status: 204 };
            }
        ],

        [
            'PUT',
            '/v1/semesters/:semester/custom-events/:id/color',
            async ctx => {
                const eventId = requireEventId(ctx.params.id);
                const color = requireBody(ctx.body).color;
                await transact(ctx, data => ({
                    update: schedule.setCustomEventColor(data, ctx.semester, eventId, color, ctx.layer)
                }));
                return { body: { id: eventId, color: color === null ? null : (color as string).toLowerCase() } };
            }
        ],

        [
            'DELETE',
            '/v1/semesters/:semester/custom-events/:id/color',
            async ctx => {
                const eventId = requireEventId(ctx.params.id);
                await transact(ctx, data => ({
                    update: schedule.setCustomEventColor(data, ctx.semester, eventId, null, ctx.layer)
                }));
                return { status: 204 };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/catalog',
            async ctx => {
                const q = ctx.query && typeof ctx.query.q === 'string' ? ctx.query.q.trim() : '';
                if (q.length < 2) {
                    throw new ApiError(
                        400,
                        'invalid_query',
                        'q must have at least 2 characters: part of a course number or name.'
                    );
                }
                const limit = queryInteger(ctx.query, 'limit', 20, 1, 100);
                const offset = queryInteger(ctx.query, 'offset', 0, 0, 100000);
                const catalog = await loadCatalog(ctx.semester);
                const courses = catalog.search(q);
                return {
                    body: {
                        semester: ctx.semester,
                        query: q,
                        total: courses.length,
                        offset: offset,
                        limit: limit,
                        courses: courses.slice(offset, offset + limit)
                    }
                };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/layers',
            async ctx => {
                const data = await store.read(ctx.uid, ctx.semester);
                const layers = schedule.readSchedule(data, ctx.semester).layers;
                const list = layers.length > 0 ? layers : [schedule.readLayer(data, ctx.semester)];
                return {
                    body: {
                        semester: ctx.semester,
                        layers: list.map(layer => ({
                            id: layer.id,
                            name: layer.name,
                            hidden: layer.hidden,
                            courseCount: layer.courses.length,
                            customEventCount: layer.customEvents.length
                        }))
                    }
                };
            }
        ],

        [
            'POST',
            '/v1/semesters/:semester/layers',
            async ctx => {
                const input =
                    ctx.body === undefined || ctx.body === null || ctx.body === '' ? {} : requireBody(ctx.body);
                const layerId = await transact(ctx, data =>
                    schedule.createLayer(data, ctx.semester, input, nowSeconds())
                );
                return { status: 201, body: await layerBody(ctx, layerId) };
            }
        ],

        [
            'PATCH',
            '/v1/semesters/:semester/layers/:layer',
            async ctx => {
                const input = requireBody(ctx.body);
                const layerId = await transact(ctx, data =>
                    schedule.updateLayer(data, ctx.semester, ctx.params.layer, input)
                );
                return { body: await layerBody(ctx, layerId) };
            }
        ],

        [
            'DELETE',
            '/v1/semesters/:semester/layers/:layer',
            async ctx => {
                await transact(ctx, data => schedule.deleteLayer(data, ctx.semester, ctx.params.layer));
                return { status: 204 };
            }
        ],

        [
            'POST',
            '/v1/semesters/:semester/layers/:layer/duplicate',
            async ctx => {
                const layerId = await transact(ctx, data =>
                    schedule.duplicateLayer(data, ctx.semester, ctx.params.layer, nowSeconds())
                );
                return { status: 201, body: await layerBody(ctx, layerId) };
            }
        ],

        [
            'POST',
            '/v1/semesters/:semester/courses/:course/move',
            async ctx => {
                const course = requireCourseNumber(ctx.params.course);
                const to = requireBody(ctx.body).to;
                const layerId = await transact(ctx, data =>
                    schedule.moveCourse(data, ctx.semester, course, ctx.layer, to)
                );
                return { body: { course: course, layer: layerId } };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/conflicts',
            async ctx => {
                const data = await store.read(ctx.uid, ctx.semester);
                const catalog = await loadCatalog(ctx.semester);
                return {
                    body: Object.assign(
                        { semester: ctx.semester },
                        schedule.findConflicts(
                            data,
                            ctx.semester,
                            ctx.layer,
                            course => (catalog.has(course) ? catalog.lessons(course) : []),
                            course => catalog.name(course)
                        )
                    )
                };
            }
        ],

        [
            'GET',
            '/v1/semesters/:semester/catalog/:course',
            async ctx => {
                const course = requireCourseNumber(ctx.params.course);
                const catalog = await catalogCourse(ctx.semester, course);
                const data = catalog.courseData(course);
                return {
                    body: {
                        course: course,
                        name: catalog.name(course),
                        general: data.general,
                        lessons: catalog.lessons(course)
                    }
                };
            }
        ]
    ];
}

function decodePathSegment(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch (e) {
        // A malformed percent-encoding such as "%E0" is a client error, not an internal one.
        throw new ApiError(400, 'invalid_path', 'The request path has a malformed percent-encoding.');
    }
}

function matchRoute(routes: Route[], method: string, pathname: string) {
    const parts = pathname.replace(/\/+$/, '').split('/').slice(1).map(decodePathSegment);
    let pathMatched = false;

    for (const [routeMethod, pattern, handler] of routes) {
        const patternParts = pattern.split('/').slice(1);
        if (patternParts.length !== parts.length) {
            continue;
        }
        const params: Record<string, string> = {};
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

function tooManyRequests(message: string) {
    return new ApiError(429, 'rate_limited', message);
}

// Returns async (request) => response, where request is { method, path, query, headers, body }
// and response is { status, body, headers }.
function createApi(deps: ApiDeps): (request: ApiRequest) => Promise<ApiResponse> {
    const routes = createRoutes(deps);
    const userLimiter = createRateLimiter(
        Object.assign({ now: deps.now }, DEFAULT_USER_LIMIT, deps.userLimit) as RateLimitOptions
    );

    async function authenticate(request: ApiRequest): Promise<string> {
        const key = apiKeyFromHeaders(request.headers);
        if (!key) {
            throw new ApiError(
                401,
                'missing_api_key',
                'Send your API key in the Authorization header: "Bearer <key>".'
            );
        }
        const uid = looksLikeApiKey(key) ? await deps.store.findKeyOwner(hashApiKey(key)) : null;
        if (!uid) {
            throw new ApiError(401, 'invalid_api_key', 'The API key is invalid or was revoked.');
        }
        return uid;
    }

    return async function handle(request) {
        let headers: Record<string, string> = {};
        try {
            const route = matchRoute(routes, request.method, request.path);
            const uid = await authenticate(request);

            const usage = userLimiter.take(uid);
            headers = rateLimitHeaders(usage);
            if (!usage.allowed) {
                throw tooManyRequests(
                    'Rate limit of ' +
                        usage.limit +
                        ' requests per minute exceeded, try again in ' +
                        usage.resetSeconds +
                        ' seconds.'
                );
            }

            const ctx: RequestContext = {
                uid: uid,
                params: route.params,
                query: request.query || {},
                body: request.body,
                layer: request.query && typeof request.query.layer === 'string' ? request.query.layer : undefined,
                semester: ''
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

export { createApi };
