import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import { IcsText } from '../lib/ics-text.js';
import { CALENDAR_AUTO_UPLOAD_DELAY_MS } from './constants.js';
import { getVisibleCourseNumbers } from './layers.js';
import { semesterFriendlyName, semesterFriendlyNameForFileName } from './semesters.js';
import { state } from './state.js';

// iCalendar export

// Calls onLoaded with the days off of the current semester, or onError if they couldn't be
// loaded. The days off don't change while the page is open, so they're loaded once
// (see calendarDaysOff).
// The days off of the semester, as YYYY-MM-DD dates.
export function loadCalendarDaysOff(onLoaded: (daysOff: string[]) => void, onError: () => void) {
    if (state.calendarDaysOff) {
        onLoaded(state.calendarDaysOff);
        return;
    }

    const calendarEventsUrl = `https://michael-maltsev.github.io/technion-calendar-events/${currentSemester}.json`;

    $.getJSON(calendarEventsUrl)
        .done((data: { daysOff?: string[] }) => {
            state.calendarDaysOff = data.daysOff || [];
            onLoaded(state.calendarDaysOff);
        })
        .fail(jqXHR => {
            if (jqXHR.status === 404) {
                state.calendarDaysOff = [];
                onLoaded(state.calendarDaysOff);
            } else {
                onError();
            }
        });
}

// Returns the iCalendar of the shown schedule, an ics.js calendar wrapped with IcsText.wrap:
// the selected lessons and custom events of the visible layers, and the exams of their courses.
export function buildScheduleCalendar(daysOff: string[] | null) {
    const extraCalendarHeaders = [
        `NAME:${IcsText.escapeText(semesterFriendlyName(currentSemester))}`,

        // Suggested minimum interval for polling for changes.
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',

        // Timezone data.
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Jerusalem',
        'X-LIC-LOCATION:Asia/Jerusalem',
        'BEGIN:DAYLIGHT',
        'TZNAME:IDT',
        'TZOFFSETFROM:+0200',
        'TZOFFSETTO:+0300',
        'DTSTART:19700327T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1FR',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZNAME:IST',
        'TZOFFSETFROM:+0300',
        'TZOFFSETTO:+0200',
        'DTSTART:19701025T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
        'END:STANDARD',
        'END:VTIMEZONE'
    ];

    // Generate a unique UID every time to avoid overriding old events.
    // https://github.com/michael-maltsev/cheese-fork/issues/19
    const icsCal = IcsText.wrap(
        ics(`cheesefork.cf-${Date.now()}`, 'CheeseFork²', extraCalendarHeaders, 'Asia/Jerusalem')
    );

    // Schedule.
    let dateFrom = availableSemesters[currentSemester].start;
    const dateTo = availableSemesters[currentSemester].end;

    // This is a workaround for a crazy Outlook bug. Recurring events
    // that start from 26 or 27 of March 2023 are shifted by several
    // hours.
    if (dateFrom === '2023-03-21') {
        dateFrom = '2023-03-19';
    }

    state.courseCalendar.saveAsIcs(icsCal, dateFrom, dateTo, daysOff);

    // Exams.
    getVisibleCourseNumbers().forEach(course => {
        const general = state.courseManager.getGeneralInfo(course);
        ['מועד א', 'מועד ב'].forEach(moed => {
            if (general[moed]) {
                const parsedDate = state.courseManager.parseExamDateTime(general[moed]);
                if (parsedDate) {
                    const title = `${state.courseManager.getFieldLabel(moed)} – ${state.courseManager.getCourseName(course)}`;
                    icsCal.addEvent(title, '', '', parsedDate.start, parsedDate.end);
                }
            }
        });
    });

    return icsCal;
}

// Storage, set by firebaseInit, which runs when Firebase is loaded, before it's used.
export function calendarFileRef(uid: string) {
    return (state.firebaseStorage as firebaseCompat.storage.Storage)
        .ref()
        .child(`${uid}/${semesterFriendlyNameForFileName(currentSemester)}.ics`);
}

// Token-less download URL: stable across re-uploads, access is
// governed by the Storage security rules (public read).
export function calendarFileUrl(uid: string) {
    return `https://firebasestorage.googleapis.com/v0/b/${(firebase.app().options as { storageBucket?: string }).storageBucket}/o/${encodeURIComponent(calendarFileRef(uid).fullPath)}?alt=media`;
}

// Identifies the events of a calendar, to skip uploading the same calendar again. Each build
// has new UID and DTSTAMP values (see buildScheduleCalendar), so they're left out.
export function calendarFingerprint(calendar: string) {
    const text = calendar
        .split('\r\n')
        .filter(line => !/^(UID|DTSTAMP):/.test(line))
        .join('\r\n');

    // cyrb53, a fast 53-bit string hash: https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
    // Math.imul, which IE 11 lacks.
    const imul = (a: number, b: number) => {
        const ah = (a >>> 16) & 0xffff;
        const al = a & 0xffff;
        const bh = (b >>> 16) & 0xffff;
        const bl = b & 0xffff;
        return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
    };
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = imul(h1 ^ ch, 2654435761);
        h2 = imul(h2 ^ ch, 1597334677);
    }
    h1 = imul(h1 ^ (h1 >>> 16), 2246822507) ^ imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = imul(h2 ^ (h2 >>> 16), 2246822507) ^ imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// The fingerprint is saved with the file, so that other visits and devices can skip
// uploading the same calendar, see whenCalendarExported.
export function uploadCalendarFile(uid: string, calendar: string) {
    const fingerprint = calendarFingerprint(calendar);
    return calendarFileRef(uid)
        .putString(calendar, 'raw', {
            // Ask browsers not to cache the request.
            // https://stackoverflow.com/q/42788488
            // https://stackoverflow.com/q/41938969
            cacheControl: 'public, max-age=0',
            // Required by the Storage rules, and served to calendar apps.
            contentType: 'text/calendar; charset=utf-8',
            customMetadata: { fingerprint }
        })
        .then(snapshot => {
            if (state.calendarAutoUpload.uid === uid) {
                state.calendarAutoUpload.uploadedFingerprint = fingerprint;
            }
            return snapshot;
        });
}

// Once a semester's calendar was exported, its file is kept up to date: shortly after the
// schedule changes, or is loaded with changes made elsewhere, such as with the API, the file
// is uploaded again. A calendar that was never exported isn't created, since nobody
// subscribed to it. Whether it was exported is checked once, with the file's metadata.
// The state is in calendarAutoUpload.
export function calendarAutoUploadSchedule() {
    if (state.viewingSharedSchedule || typeof firebase === 'undefined' || firebase.auth().currentUser === null) {
        return;
    }

    clearTimeout(state.calendarAutoUpload.timer ?? undefined);
    state.calendarAutoUpload.timer = setTimeout(calendarAutoUploadRun, CALENDAR_AUTO_UPLOAD_DELAY_MS);
}

export function calendarAutoUploadRun() {
    const user = firebase.auth().currentUser;
    if (!user) {
        return;
    }

    if (state.calendarAutoUpload.uploading) {
        // Upload again when the current upload is done, it may not include the latest change.
        state.calendarAutoUpload.pending = true;
        return;
    }

    if (state.calendarAutoUpload.uid !== user.uid) {
        state.calendarAutoUpload.uid = user.uid;
        state.calendarAutoUpload.exported = null;
        state.calendarAutoUpload.uploadedFingerprint = null;
    }

    whenCalendarExported(user.uid, () => {
        loadCalendarDaysOff(
            (daysOff: string[]) => {
                if (firebase.auth().currentUser !== user) {
                    return; // Signed out in the meantime.
                }

                // Unlike an export, an empty schedule is uploaded too, to remove the
                // events of the courses that were removed from the subscribed calendar.
                const calendar = buildScheduleCalendar(daysOff).build(true) as string;

                // Most visits and many changes, such as colors, leave the calendar the same.
                if (calendarFingerprint(calendar) === state.calendarAutoUpload.uploadedFingerprint) {
                    return;
                }

                state.calendarAutoUpload.uploading = true;
                uploadCalendarFile(user.uid, calendar).then(
                    () => {
                        calendarAutoUploadDone();
                    },
                    error => {
                        // Not shown, the next change or visit uploads the file again.
                        gtag('event', 'calendar-auto-upload-error');
                        calendarAutoUploadDone();
                    }
                );
            },
            () => {
                // Without the days off, keep the previous file rather than upload a wrong one.
            }
        );
    });
}

export function calendarAutoUploadDone() {
    state.calendarAutoUpload.uploading = false;
    if (state.calendarAutoUpload.pending) {
        state.calendarAutoUpload.pending = false;
        calendarAutoUploadSchedule();
    }
}

export function whenCalendarExported(uid: string, onExported: () => void) {
    if (state.calendarAutoUpload.exported !== null) {
        if (state.calendarAutoUpload.exported) {
            onExported();
        }
        return;
    }

    calendarFileRef(uid)
        .getMetadata()
        .then(
            metadata => {
                if (state.calendarAutoUpload.uid === uid) {
                    state.calendarAutoUpload.exported = true;
                    // Files uploaded before fingerprints were saved have none, and are uploaded again once.
                    state.calendarAutoUpload.uploadedFingerprint =
                        (metadata && metadata.customMetadata && metadata.customMetadata.fingerprint) || null;
                    onExported();
                }
            },
            error => {
                if (state.calendarAutoUpload.uid === uid && error && error.code === 'storage/object-not-found') {
                    state.calendarAutoUpload.exported = false;
                }
                // Otherwise it's unknown, and checked again on the next change.
            }
        );
}
