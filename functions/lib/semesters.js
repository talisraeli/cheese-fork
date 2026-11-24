'use strict';

// The semesters the site offers, read from availableSemesters in the site's index.html, which
// CI updates when a semester is added. It's loaded from the site rather than bundled, so that
// new semesters show up without deploying the functions again.

const { ApiError } = require('./errors');

const SITE_URL = 'https://cf.talisrae.li/index.html';
const CACHE_MS = 60 * 60 * 1000;

// Returns { semester: { start, end } }, without the semesters that aren't offered yet, whose
// keys end with "_", same as index.html.
function parseSemesters(html) {
    const match = /var\s+availableSemesters\s*=\s*(\{[\s\S]*?\});/.exec(html);
    if (!match) {
        throw new Error('availableSemesters not found');
    }
    const all = JSON.parse(match[1]);
    const semesters = {};
    Object.keys(all).forEach(semester => {
        if (!semester.endsWith('_')) {
            semesters[semester] = { start: all[semester].start, end: all[semester].end };
        }
    });
    return semesters;
}

function createSemestersLoader(fetchImpl, now, url) {
    let cached = null;

    return async function loadSemesters() {
        if (cached && now() - cached.time < CACHE_MS) {
            return cached.semesters;
        }

        let semesters;
        try {
            const response = await fetchImpl(url || SITE_URL);
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            semesters = parseSemesters(await response.text());
        } catch (e) {
            if (cached) {
                return cached.semesters; // Better a stale list than none.
            }
            throw new ApiError(502, 'semesters_unavailable', 'The list of semesters could not be loaded, try again later.');
        }

        cached = { time: now(), semesters: semesters };
        return semesters;
    };
}

module.exports = { parseSemesters, createSemestersLoader, SITE_URL };
