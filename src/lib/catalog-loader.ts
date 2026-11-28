// Chooses the semester to show, and loads its course catalog (and the scripts that depend on the
// language) while the page is parsed, so they run before the app.

import { getParameterByName } from './url.js';

// Same as catalogUrl in functions/lib/catalog.js.
export function coursesUrl(semester: string): string {
    if (semester < '202401') {
        return `https://ug.cheesefork.cf/courses_${semester}.min.js`;
    }
    const year = semester.slice(0, 4);
    const sapSemester = parseInt(semester.slice(4), 10) - 1 + 200;
    return `https://sap.cheesefork.cf/courses_${year}_${sapSemester}.min.js`;
}

// The text that SAP has in English, built by ci/english_catalog.py.
export function englishCatalogUrl(semester: string): string {
    return `catalog-en/courses_${semester.slice(0, 4)}_${parseInt(semester.slice(4), 10) - 1 + 200}.min.js`;
}

// Semesters whose key ends with '_' are listed by the semester update before they're published.
export function publishedSemesters(availableSemesters: Record<string, SemesterDates>): Record<string, SemesterDates> {
    Object.keys(availableSemesters).forEach(key => {
        if (key.slice(-1) === '_') {
            delete availableSemesters[key];
        }
    });
    return availableSemesters;
}

function storageGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        return null;
    }
}

function storageSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }
}

// The semester of the URL, else the last selected one, else the latest.
export function chooseSemester(availableSemesters: Record<string, SemesterDates>): string {
    let semester = getParameterByName('semester');
    if (!semester || !availableSemesters[semester]) {
        semester = storageGet('lastSelectedSemester');
        if (!semester || !availableSemesters[semester]) {
            semester = Object.keys(availableSemesters).sort().pop() as string;
        }
    }
    return semester;
}

// Whether the page shows the visitor's own schedule, rather than a shared schedule or a
// catalog page, so the semester is remembered.
function isOwnSchedulePage(sharingUserId: string | null): boolean {
    return (
        sharingUserId === null &&
        getParameterByName('course') === null &&
        getParameterByName('staff') === null &&
        getParameterByName('room') === null
    );
}

function writeScript(document: Document, src: string, onerror?: string): void {
    const script = document.createElement('script');
    script.src = src;
    if (onerror) {
        script.setAttribute('onerror', onerror);
    }
    document.write(script.outerHTML);
}

// Sets the page's globals (currentSemester, scheduleSharingUserId) and writes the scripts of
// FirebaseUI in the page's language and of the semester's catalog.
const FIREBASE_UI_LOCALES: Record<string, string> = { he: '__iw', ar: '__ar' };

export function loadCatalog(window: Window, document: Document): void {
    writeScript(
        document,
        `https://www.gstatic.com/firebasejs/ui/3.3.0/firebase-ui-auth${FIREBASE_UI_LOCALES[window.CheeseI18n.getLocale()] || ''}.js`
    );

    const availableSemesters = publishedSemesters(window.availableSemesters);
    const semester = chooseSemester(availableSemesters);
    window.currentSemester = semester;
    window.scheduleSharingUserId = getParameterByName('uid');
    if (isOwnSchedulePage(window.scheduleSharingUserId)) {
        storageSet('lastSelectedSemester', semester);
    }

    writeScript(document, coursesUrl(semester), 'alert(CheeseI18n.t("shell.error.loadCourses"));');
    // The English interface only. Semesters without it keep the Hebrew text.
    if (window.CheeseI18n.getLocale() === 'en' && semester >= '202401') {
        writeScript(document, englishCatalogUrl(semester));
    }
}
