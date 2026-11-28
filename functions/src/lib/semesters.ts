// The semesters the site offers, read from availableSemesters in the site's data/semesters.js,
// which CI updates when a semester is added. It's loaded from the site rather than bundled, so
// that new semesters show up without deploying the functions again.

import { ApiError } from './errors.ts';
import type { Fetch } from './types.ts';

// The site had the list in index.html before data/semesters.js, so it's read from there when the
// site doesn't have the data file. That way the functions can be deployed before the site.
const SITE_URLS = ['https://cf.talisrae.li/data/semesters.js', 'https://cf.talisrae.li/index.html'];
const CACHE_MS = 60 * 60 * 1000;

// Returns { semester: { start, end } }, without the semesters that aren't offered yet, whose
// keys end with "_", same as the site.
function parseSemesters(html: string) {
    const match = /var\s+availableSemesters\s*=\s*(\{[\s\S]*?\});/.exec(html);
    if (!match) {
        throw new Error('availableSemesters not found');
    }
    const all = JSON.parse(match[1]);
    const semesters: Record<string, { start: string; end: string }> = {};
    Object.keys(all).forEach(semester => {
        if (!semester.endsWith('_')) {
            semesters[semester] = { start: all[semester].start, end: all[semester].end };
        }
    });
    return semesters;
}

// The text of the first of the URLs that the site has.
async function fetchFirst(fetchImpl: Fetch, urls: string[]) {
    let error = null;
    for (const url of urls) {
        const response = await fetchImpl(url);
        if (response.ok) {
            return response.text();
        }
        error = new Error('HTTP ' + response.status + ' for ' + url);
        if (response.status !== 404) {
            break; // The site is failing, rather than missing the file.
        }
    }
    throw error;
}

function createSemestersLoader(fetchImpl: Fetch, now: () => number, urls?: string[]) {
    let cached: { time: number; semesters: Record<string, { start: string; end: string }> } | null = null;

    return async function loadSemesters() {
        if (cached && now() - cached.time < CACHE_MS) {
            return cached.semesters;
        }

        let semesters;
        try {
            semesters = parseSemesters(await fetchFirst(fetchImpl, urls || SITE_URLS));
        } catch (e) {
            if (cached) {
                return cached.semesters; // Better a stale list than none.
            }
            throw new ApiError(
                502,
                'semesters_unavailable',
                'The list of semesters could not be loaded, try again later.'
            );
        }

        cached = { time: now(), semesters: semesters };
        return semesters;
    };
}

export { parseSemesters, createSemestersLoader, SITE_URLS };
