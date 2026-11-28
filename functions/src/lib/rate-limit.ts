// Fixed-window request counters kept in memory. Each function instance counts on its own,
// so with several instances running a client can get up to (instances × limit) requests.
// That's an accepted trade-off: a shared counter would add a Firestore write to every
// request, and a single counter document per user can't take frequent writes.

const MAX_ENTRIES = 10000;

export interface RateLimitOptions {
    limit: number;
    windowMs: number;
    now?: () => number;
}

export interface RateLimitState {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSeconds: number;
}

export interface RateLimiter {
    take(id: string): RateLimitState;
}

interface Window {
    count: number;
    resetAt: number;
}

function createRateLimiter(options: RateLimitOptions): RateLimiter {
    const limit = options.limit;
    const windowMs = options.windowMs;
    const now = options.now || Date.now;
    const windows = new Map<string, Window>();

    function current(id: string): Window {
        const time = now();
        let entry = windows.get(id);
        if (!entry || time >= entry.resetAt) {
            if (!entry && windows.size >= MAX_ENTRIES) {
                windows.forEach((value, key) => {
                    if (time >= value.resetAt) {
                        windows.delete(key);
                    }
                });
            }
            entry = { count: 0, resetAt: time + windowMs };
            windows.set(id, entry);
        }
        return entry;
    }

    function state(entry: Window): RateLimitState {
        return {
            allowed: entry.count <= limit,
            limit: limit,
            remaining: Math.max(0, limit - entry.count),
            resetSeconds: Math.max(1, Math.ceil((entry.resetAt - now()) / 1000))
        };
    }

    return {
        // Counts a request and returns whether it's within the limit.
        take(id: string) {
            const entry = current(id);
            entry.count++;
            return state(entry);
        }
    };
}

// Standard rate limit response headers (IETF draft RateLimit header fields).
function rateLimitHeaders(result: RateLimitState): Record<string, string> {
    const headers: Record<string, string> = {
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': String(result.remaining),
        'RateLimit-Reset': String(result.resetSeconds)
    };
    if (!result.allowed) {
        headers['Retry-After'] = String(result.resetSeconds);
    }
    return headers;
}

export { createRateLimiter, rateLimitHeaders };
