// Shares the histograms of the courses the user took, from the Technion grades site, with
// https://github.com/michael-maltsev/technion-histograms. It runs on the grades site, loaded by
// a bookmarklet or the Technion Plus Plus extension from /share-histograms.js, so it has its own
// messages and styles rather than the site's.

import jsSHA from '../../modules/jssha/sha1.js';
import { render } from '../lib/template.js';
import categoryCellTemplate from './templates/category-cell.html';
import courseRowTemplate from './templates/course-row.html';
import headerCellTemplate from './templates/header-cell.html';
import overlayTemplate from './templates/overlay.html';

type Locale = 'he' | 'en' | 'ar';

// A course of the grades site, with its link in the list of courses.
interface GradeCourse {
    url: string;
    semesterPretty: string;
    semester: string;
    // The number as the grades site has it, and in the eight digit format.
    courseMatched: string;
    course: string;
    name: string;
}

interface HistogramLink {
    category: string;
    url: string;
}

interface QueuedCourse extends Omit<GradeCourse, 'semesterPretty'> {
    histograms: HistogramLink[];
}

interface StaffMember {
    name: string;
    email: string;
    title: string;
}

interface HistogramPage {
    courseName: string | null;
    category: string | null;
    imgSrc: string;
    properties: Record<string, string>;
}

interface SubmitOptions {
    // The SHA of the file in the repository, if known, to skip uploading it again.
    skipIfSha?: string;
    skipIfExists?: boolean;
    // Lines of the commit message, as <key>: <value>.
    commitMetadata?: Record<string, unknown>;
}

type SubmitResult = 'skipped' | 'exists' | 'updated' | 'created';

export function shareHistograms(): void {
    const currentScript = document.currentScript as HTMLScriptElement | null;
    const scriptUrl = currentScript && currentScript.src;
    const requestedLocale = scriptUrl ? new URL(scriptUrl).searchParams.get('lang') : null;
    const locale: Locale = requestedLocale === 'en' || requestedLocale === 'ar' ? requestedLocale : 'he';
    const rtl = locale !== 'en';
    const messages: Record<Locale, Record<string, string>> = {
        he: {
            'sharing.overlay.heading': 'שיתוף היסטוגרמות',
            'sharing.overlay.title': 'שיתוף היסטוגרמות: {status}',
            'sharing.overlay.loading': 'טוען נתונים...',
            'sharing.overlay.share': 'לחצו כאן לשיתוף ההיסטוגרמות',
            'sharing.overlay.retry': 'נסה שוב',
            'sharing.overlay.close': 'סגירת חלון השיתוף',
            'sharing.overlay.semester': 'סמסטר',
            'sharing.overlay.course': 'קורס',
            'sharing.overlay.courseName': 'שם קורס',
            'sharing.overlay.staff': 'סגל',
            'sharing.overlay.examA': "מבחן מועד א'",
            'sharing.overlay.finalA': "סופי מועד א'",
            'sharing.overlay.examB': "מבחן מועד ב'",
            'sharing.overlay.finalB': "סופי מועד ב'",
            'sharing.overlay.examC': "מבחן מועד ג'",
            'sharing.overlay.finalC': "סופי מועד ג'",
            'sharing.overlay.finals': 'סופי',
            'sharing.overlay.available': 'קיים מידע לשיתוף',
            'sharing.overlay.unavailable': 'אין מידע לשיתוף',
            'sharing.overlay.ready': 'מוכן',
            'sharing.overlay.sharing': 'משתף...',
            'sharing.overlay.error': 'שגיאה',
            'sharing.overlay.errorDetails': 'שגיאה: {message}',
            'sharing.overlay.complete': 'השיתוף הושלם',
            'sharing.overlay.uploading': 'משתף מידע...',
            'sharing.overlay.exists': 'המידע כבר קיים',
            'sharing.overlay.success': 'המידע שותף בהצלחה',
            'sharing.overlay.failed': 'שיתוף המידע נכשל',
            'sharing.overlay.getTreeFailed': 'קריאת רשימת הקבצים מ-GitHub החזירה שגיאה {status}',
            'sharing.overlay.putFileFailed': 'שמירת קובץ ב-GitHub החזירה שגיאה {status}',
            'sharing.overlay.fetchFailed': 'טעינת {resource} החזירה שגיאה {status}',
            'sharing.overlay.resource.coursePage': 'עמוד הקורס',
            'sharing.overlay.resource.histogramPage': 'עמוד ההיסטוגרמה',
            'sharing.overlay.resource.histogramImage': 'תמונת ההיסטוגרמה',
            'sharing.overlay.semester.winter': 'חורף {year}–{nextYear}',
            'sharing.overlay.semester.spring': 'אביב {year}',
            'sharing.overlay.semester.summer': 'קיץ {year}'
        },
        en: {
            'sharing.overlay.heading': 'Share histograms',
            'sharing.overlay.title': 'Histogram sharing: {status}',
            'sharing.overlay.loading': 'Loading data...',
            'sharing.overlay.share': 'Share histograms',
            'sharing.overlay.retry': 'Try again',
            'sharing.overlay.close': 'Close sharing window',
            'sharing.overlay.semester': 'Semester',
            'sharing.overlay.course': 'Course',
            'sharing.overlay.courseName': 'Course name',
            'sharing.overlay.staff': 'Staff',
            'sharing.overlay.examA': 'Exam A',
            'sharing.overlay.finalA': 'Final grade A',
            'sharing.overlay.examB': 'Exam B',
            'sharing.overlay.finalB': 'Final grade B',
            'sharing.overlay.examC': 'Exam C',
            'sharing.overlay.finalC': 'Final grade C',
            'sharing.overlay.finals': 'Final grade',
            'sharing.overlay.available': 'Data available to share',
            'sharing.overlay.unavailable': 'No data to share',
            'sharing.overlay.ready': 'Ready',
            'sharing.overlay.sharing': 'Sharing...',
            'sharing.overlay.error': 'Error',
            'sharing.overlay.errorDetails': 'Error: {message}',
            'sharing.overlay.complete': 'Sharing complete',
            'sharing.overlay.uploading': 'Sharing data...',
            'sharing.overlay.exists': 'Data already exists',
            'sharing.overlay.success': 'Data shared successfully',
            'sharing.overlay.failed': 'Could not share the data',
            'sharing.overlay.getTreeFailed': 'Reading the file list from GitHub returned status {status}',
            'sharing.overlay.putFileFailed': 'Saving a file to GitHub returned status {status}',
            'sharing.overlay.fetchFailed': 'Loading {resource} returned status {status}',
            'sharing.overlay.resource.coursePage': 'the course page',
            'sharing.overlay.resource.histogramPage': 'the histogram page',
            'sharing.overlay.resource.histogramImage': 'the histogram image',
            'sharing.overlay.semester.winter': 'Winter {year}–{nextYear}',
            'sharing.overlay.semester.spring': 'Spring {year}',
            'sharing.overlay.semester.summer': 'Summer {year}'
        },
        ar: {
            'sharing.overlay.heading': 'مشاركة مخططات العلامات',
            'sharing.overlay.title': 'مشاركة مخططات العلامات: {status}',
            'sharing.overlay.loading': 'جارٍ تحميل البيانات...',
            'sharing.overlay.share': 'مشاركة مخططات العلامات',
            'sharing.overlay.retry': 'إعادة المحاولة',
            'sharing.overlay.close': 'إغلاق نافذة المشاركة',
            'sharing.overlay.semester': 'الفصل الدراسي',
            'sharing.overlay.course': 'المساق',
            'sharing.overlay.courseName': 'اسم المساق',
            'sharing.overlay.staff': 'الطاقم',
            'sharing.overlay.examA': 'امتحان موعد أ',
            'sharing.overlay.finalA': 'العلامة النهائية موعد أ',
            'sharing.overlay.examB': 'امتحان موعد ب',
            'sharing.overlay.finalB': 'العلامة النهائية موعد ب',
            'sharing.overlay.examC': 'امتحان موعد ج',
            'sharing.overlay.finalC': 'العلامة النهائية موعد ج',
            'sharing.overlay.finals': 'العلامة النهائية',
            'sharing.overlay.available': 'توجد بيانات للمشاركة',
            'sharing.overlay.unavailable': 'لا توجد بيانات للمشاركة',
            'sharing.overlay.ready': 'جاهز',
            'sharing.overlay.sharing': 'جارٍ المشاركة...',
            'sharing.overlay.error': 'خطأ',
            'sharing.overlay.errorDetails': 'خطأ: {message}',
            'sharing.overlay.complete': 'اكتملت المشاركة',
            'sharing.overlay.uploading': 'جارٍ مشاركة البيانات...',
            'sharing.overlay.exists': 'البيانات موجودة مسبقًا',
            'sharing.overlay.success': 'تمت مشاركة البيانات بنجاح',
            'sharing.overlay.failed': 'تعذّرت مشاركة البيانات',
            'sharing.overlay.getTreeFailed': 'قراءة قائمة الملفات من GitHub أعادت الحالة {status}',
            'sharing.overlay.putFileFailed': 'حفظ ملف في GitHub أعاد الحالة {status}',
            'sharing.overlay.fetchFailed': 'تحميل {resource} أعاد الحالة {status}',
            'sharing.overlay.resource.coursePage': 'صفحة المساق',
            'sharing.overlay.resource.histogramPage': 'صفحة مخطط العلامات',
            'sharing.overlay.resource.histogramImage': 'صورة مخطط العلامات',
            'sharing.overlay.semester.winter': 'شتاء {year}–{nextYear}',
            'sharing.overlay.semester.spring': 'ربيع {year}',
            'sharing.overlay.semester.summer': 'صيف {year}'
        }
    };
    let sharingRoot: HTMLElement | null = null;

    // An element of the overlay, which uiCreateTable makes before it's used.
    function uiElement<T extends HTMLElement = HTMLElement>(selector: string): T {
        return (sharingRoot as HTMLElement).querySelector(selector) as T;
    }

    function t(key: string, params: Record<string, unknown> = {}): string {
        return messages[locale][key].replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
            Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
        );
    }

    const histogramCategories = ['Exam_A', 'Final_A', 'Exam_B', 'Final_B', 'Exam_C', 'Final_C', 'Finals'];
    const histogramUploadQueue: QueuedCourse[] = [];

    function semesterFriendlyName(semester: string): string {
        const year = parseInt(semester.slice(0, 4), 10);
        switch (semester.slice(4)) {
            case '01':
                return t('sharing.overlay.semester.winter', { year, nextYear: year + 1 });
            case '02':
                return t('sharing.overlay.semester.spring', { year: year + 1 });
            case '03':
                return t('sharing.overlay.semester.summer', { year: year + 1 });
            default:
                return semester;
        }
    }

    // The styles are in the markup, since the grades site has none of the site's stylesheets.
    function uiCreateTable(courses: GradeCourse[]): void {
        const columns = [
            'semester',
            'course',
            'courseName',
            'staff',
            'examA',
            'finalA',
            'examB',
            'finalB',
            'examC',
            'finalC',
            'finals'
        ];
        const loading = t('sharing.overlay.loading');
        const html = render(overlayTemplate, {
            closeSide: rtl ? 'left' : 'right',
            close: t('sharing.overlay.close'),
            title: t('sharing.overlay.title', { status: loading }),
            share: t('sharing.overlay.share'),
            retry: t('sharing.overlay.retry'),
            headers: columns
                .map(column => render(headerCellTemplate, { label: t('sharing.overlay.' + column) }))
                .join(''),
            rows: courses
                .map(course =>
                    render(courseRowTemplate, {
                        className: 'grabber_course_' + course.semester + '_' + course.course,
                        semester: semesterFriendlyName(course.semester),
                        course: course.course,
                        name: course.name,
                        loading,
                        categoryCells: histogramCategories
                            .map(category => render(categoryCellTemplate, { category, loading }))
                            .join('')
                    })
                )
                .join('')
        });

        if (!sharingRoot) {
            sharingRoot = document.createElement('section');
            sharingRoot.id = 'cheesefork-histogram-sharing';
            sharingRoot.lang = locale;
            sharingRoot.dir = rtl ? 'rtl' : 'ltr';
            sharingRoot.setAttribute('role', 'region');
            sharingRoot.setAttribute('aria-label', t('sharing.overlay.heading'));
            sharingRoot.style.cssText =
                'position:fixed;top:12px;right:12px;bottom:12px;left:12px;z-index:2147483647;overflow:auto;background:#fff;color:#212529;border:1px solid #777;padding:20px;text-align:' +
                (rtl ? 'right' : 'left') +
                ';font:14px Arial,sans-serif;box-sizing:border-box;';
            document.body.appendChild(sharingRoot);
        }
        const root = sharingRoot;
        root.innerHTML = html;
        uiElement('#grabber_close_button').onclick = () => {
            root.style.display = 'none';
        };
    }

    function uiUpdateTitle(title: string): void {
        uiElement('#grabber_title').textContent = t('sharing.overlay.title', { status: title });
    }

    function uiUpdateItemStatus(
        semester: string,
        course: string,
        category: string,
        status: string,
        statusText: string
    ): void {
        const className = 'grabber_course_' + semester + '_' + course;
        const node = uiElement('tr.' + className + ' td.' + category);
        node.textContent = status;
        node.title = statusText;
        node.setAttribute('aria-label', statusText);
    }

    function uiAddCourseCategories(semester: string, course: string, categories: string[]): void {
        let status = '📁';
        let statusText = t('sharing.overlay.available');
        uiUpdateItemStatus(semester, course, 'Staff', status, statusText);

        for (const category of histogramCategories) {
            if (categories.includes(category)) {
                status = '📁';
                statusText = t('sharing.overlay.available');
            } else {
                status = '➖';
                statusText = t('sharing.overlay.unavailable');
            }
            uiUpdateItemStatus(semester, course, category, status, statusText);
        }
    }

    function uiOnFirstLoadingDone() {
        uiUpdateTitle(t('sharing.overlay.ready'));

        const submitButton = uiElement('#grabber_submit_button');
        submitButton.style.display = 'inline-block';
        submitButton.onclick = () => {
            submitButton.style.display = 'none';
            uiUpdateTitle(t('sharing.overlay.sharing'));
            submitHistograms().catch(reason => uiOnError(reason.message));
            return false;
        };
    }

    function uiOnError(message: string): void {
        alert(t('sharing.overlay.errorDetails', { message }));
        if (!sharingRoot) {
            uiCreateTable([]);
        }
        uiUpdateTitle(t('sharing.overlay.error'));

        const tryAgainButton = uiElement('#grabber_try_again_button');
        tryAgainButton.style.display = 'inline-block';
        tryAgainButton.onclick = () => {
            tryAgainButton.style.display = 'none';
            uiUpdateTitle(t('sharing.overlay.loading'));
            run().catch(reason => uiOnError(reason.message));
            return false;
        };
    }

    function uiOnSubmitDone() {
        uiUpdateTitle(t('sharing.overlay.complete'));
    }

    // The links of the grades site have the semester as "<semester>/<year>" in data-sem, and the
    // course number and name in their text.
    function getCourses(): GradeCourse[] {
        const courses: GradeCourse[] = [];
        for (const node of Array.from(document.querySelectorAll<HTMLAnchorElement>('a.ga-course'))) {
            const url = node.href.replace(/\/contentEng\.aspx\b/, '/content.aspx');
            const semesterPretty = node.getAttribute('data-sem') as string;
            const semesterArray = semesterPretty.split('/', 2);
            const semester = semesterArray[1] + semesterArray[0];
            const match = /^\s*\d+\s+(\d+)\s+(.*?)\s*$/.exec(node.textContent || '') as RegExpExecArray;
            const courseMatched = match[1];
            const course = ('0000000' + courseMatched).slice(-8);
            const name = match[2];

            courses.push({
                url,
                semesterPretty,
                semester,
                courseMatched,
                course,
                name
            });
        }

        return courses;
    }

    function getCourseHistogramsFromHtml(html: string): HistogramLink[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const histograms: HistogramLink[] = [];
        for (const node of Array.from(doc.querySelectorAll('table#cBody_GV_StudentGrade tbody tr'))) {
            const category = node.children[4].textContent || '';
            if (histogramCategories.includes(category)) {
                const histogramLink = node.querySelector<HTMLAnchorElement>('a[data-histogram]');
                if (histogramLink) {
                    const url = histogramLink.href.replace(/&lang=[a-z]+$/, '');
                    histograms.push({
                        category,
                        url
                    });
                }
            }
        }

        // Sometimes the Finals histogram exists only in the lower statistics table.
        if (histograms.every(x => x.category !== 'Finals')) {
            for (const node of Array.from(doc.querySelectorAll('#cBody_PanelCourseStatistic tbody tr'))) {
                const taskName = node.children[3].textContent;
                const category = node.children[4].textContent || '';
                if (taskName === 'ציון סופי במחשב המרכזי' && category === 'Finals') {
                    const histogramLink = node.querySelector<HTMLAnchorElement>('a[data-histogram]');
                    if (histogramLink) {
                        const url = histogramLink.href.replace(/&lang=[a-z]+$/, '');
                        histograms.push({
                            category,
                            url
                        });
                    }
                }
            }
        }

        histograms.sort((a, b) => histogramCategories.indexOf(a.category) - histogramCategories.indexOf(b.category));
        return histograms;
    }

    function getStaffFromHtml(html: string): StaffMember[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const staff: StaffMember[] = [];
        for (const node of Array.from(doc.querySelectorAll('table#cBody_GridView_Advisors tbody tr'))) {
            staff.push({
                name: (node.children[2].textContent || '').trim(),
                email: (node.children[3].textContent || '').trim(),
                title: (node.children[4].textContent || '').trim()
            });
        }

        return staff;
    }

    // The page of a histogram has its title, its image, and its statistics in a table.
    function getCourseHistogramFromHtml(html: string): HistogramPage {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Example:
        // בקורס - מבוא להסתברות ח' במשימה : ציון סופי במחשב המרכזי
        const match = /^בקורס - (.*?) במשימה : (.*)$/.exec(
            ((doc.querySelector('title') as HTMLTitleElement).textContent || '').trim()
        );
        const courseName = match ? match[1].trim() : null;
        const categoryRaw = match ? match[2].trim() : null;
        const category = categoryRaw === 'ציון סופי במחשב המרכזי' ? 'Finals' : categoryRaw;

        const imgSrc = (doc.querySelector('img#CourseChart') as HTMLImageElement).src;
        const n = doc.querySelectorAll('table#gvChart tbody td');
        const properties = {
            students: n[5] ? n[5].textContent || '' : '',
            passFail: n[6] ? n[6].textContent || '' : '',
            passPercent: n[7] ? n[7].textContent || '' : '',
            min: n[9] ? n[9].textContent || '' : '',
            max: n[10] ? n[10].textContent || '' : '',
            average: n[11] ? n[11].textContent || '' : '',
            median: n[12] ? n[12].textContent || '' : ''
        };

        return {
            courseName,
            category,
            imgSrc,
            properties
        };
    }

    async function submitToGithub(
        course: string,
        semester: string,
        category: string,
        suffix: string,
        buffer: ArrayBuffer,
        options: SubmitOptions = {}
    ): Promise<SubmitResult> {
        function calcGitFileSha(content: ArrayBuffer): string {
            const shaObj = new jsSHA('SHA-1', 'ARRAYBUFFER');
            shaObj.update(new TextEncoder().encode('blob ' + content.byteLength + '\0').buffer as ArrayBuffer);
            shaObj.update(content);
            return shaObj.getHash('HEX');
        }

        function getGithubToken(): string {
            const tokens = [
                atob('Y2ViMTY5ZWM2YzAyYzY5ZDVmOTk2NjA5MmVkZWZkOTRiZGY2YjI2Yw=='),
                atob('NTNjNzA3MDc2NzM5MDJkYjI5ZGMzZTkxN2JlODdmNWI4YTMzZDdjNg=='),
                atob('MTA4MjQxYTJkYmNkYmZkZDQ2YWI0NDliZTJkZTVmMTYxZGZiZThhZQ=='),
                atob('NTllNTJhNTg1NTZiMWEzZjJmYmZjZjYyMjU3ZGM0OGY1YWQwY2ZkZg=='),
                atob('OWE4MmYzNjMwZjBlODQ1MWE2MDkwZjZhNjlkOWU3ZGQ4YmQ4MmYyYg==')
            ];
            return tokens[Math.floor(Math.random() * tokens.length)];
        }

        async function getGitFileSha(path: string, filename: string, token: string): Promise<string | null> {
            const url =
                'https://api.github.com/repos/michael-maltsev/technion-histograms/git/trees/main:' +
                encodeURIComponent(path) +
                '?t=' +
                Date.now();

            const response = await fetch(url, {
                headers: {
                    // Rate limiting: Authenticated requests get a higher rate limit.
                    // https://developer.github.com/v3/#rate-limiting
                    Authorization: 'token ' + token
                }
            });
            if (response.status === 200) {
                const data: { tree: { path: string; sha: string }[] } = await response.json();
                const item = data.tree.find(function (item) {
                    return item.path === filename;
                });

                return item ? item.sha : null;
            } else if (response.status === 404) {
                // No such folder.
                return null;
            } else {
                throw new Error(t('sharing.overlay.getTreeFailed', { status: response.status }));
            }
        }

        // https://stackoverflow.com/a/9458996
        function arrayBufferToBase64(buffer: ArrayBuffer): string {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        }

        const fileSha = calcGitFileSha(buffer);
        if (fileSha === options.skipIfSha) {
            return 'skipped';
        }

        const filename = category + suffix;
        const path = course + '/' + semester;
        const token = getGithubToken();

        const serverSha = await getGitFileSha(path, filename, token);
        if (serverSha && (options.skipIfExists || serverSha === fileSha)) {
            return 'exists';
        }

        const url =
            'https://api.github.com/repos/michael-maltsev/technion-histograms/contents/' + path + '/' + filename;

        const messagePrefix = serverSha ? 'Update' : 'Add';
        let message = `${messagePrefix} ${path}/${filename}`;
        const commitMetadata = options.commitMetadata ?? {};
        if (Object.keys(commitMetadata).length > 0) {
            message +=
                '\n\n' +
                Object.entries(commitMetadata)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n');
        }

        const data: { message: string; content: string; branch: string; sha?: string } = {
            message,
            content: arrayBufferToBase64(buffer),
            branch: 'main'
        };
        if (serverSha) {
            data.sha = serverSha;
        }

        let attemptNum = 0;
        while (true) {
            attemptNum++;
            if (attemptNum >= 4) {
                // Sleep for up to 5 seconds.
                await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000)));
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Authorization: 'token ' + token
                },
                body: JSON.stringify(data)
            });
            if (response.status === 409) {
                // 409 Conflict, submissions are too fast, try again.
                // https://github.com/pyupio/pyup/issues/5
            } else if (response.status === 200) {
                return 'updated';
            } else if (response.status === 201) {
                return 'created';
            } else {
                throw new Error(t('sharing.overlay.putFileFailed', { status: response.status }));
            }
        }
    }

    async function fetchValidResponse(url: string, name: string): Promise<Response> {
        let lastStatus: number | undefined;
        for (let i = 0; i < 4; i++) {
            const result = await fetch(url, {
                // Disable redirects because if not logged in, the user is
                // redirected to /login.aspx, and we don't want to use the login
                // page as the response.
                redirect: 'error'
            });
            if (result.ok) {
                return result;
            }

            lastStatus = result.status;
        }

        throw new Error(t('sharing.overlay.fetchFailed', { resource: t(name), status: lastStatus }));
    }

    async function fetchValidResponseAsText(url: string, name: string, encoding?: string): Promise<string> {
        const response = await fetchValidResponse(url, name);
        if (!encoding) {
            return await response.text();
        }

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder(encoding);
        return decoder.decode(buffer);
    }

    async function submitHistograms() {
        for (const {
            courseMatched,
            course,
            semester,
            url: courseUrl,
            name: courseName,
            histograms
        } of histogramUploadQueue) {
            const commitMetadata = {
                course: courseMatched,
                courseName
            };

            uiUpdateItemStatus(semester, course, 'Staff', '...', t('sharing.overlay.uploading'));

            const coursePageHtml = await fetchValidResponseAsText(
                courseUrl,
                'sharing.overlay.resource.coursePage',
                'windows-1255'
            );
            const staffArray = getStaffFromHtml(coursePageHtml);
            const staff = new TextEncoder().encode(JSON.stringify(staffArray, null, 2)).buffer;
            const skipIfExists = staffArray.length === 0;
            const staffResult = await submitToGithub(course, semester, 'Staff', '.json', staff, {
                commitMetadata,
                skipIfExists
            });

            if (staffResult === 'exists') {
                uiUpdateItemStatus(semester, course, 'Staff', '⚌', t('sharing.overlay.exists'));
            } else {
                uiUpdateItemStatus(semester, course, 'Staff', '✔', t('sharing.overlay.success'));
            }

            for (const { category, url: histogramUrl } of histograms) {
                uiUpdateItemStatus(semester, course, category, '...', t('sharing.overlay.uploading'));

                const histogramPageHtml = await fetchValidResponseAsText(
                    histogramUrl,
                    'sharing.overlay.resource.histogramPage',
                    'windows-1255'
                );
                const histogram = getCourseHistogramFromHtml(histogramPageHtml);

                // The histogram course name might not match. This can happen if a different course page was loaded before loading the histogram page.
                // The server determines which course's histogram to show according to the last viewed course page.
                // The course is saved in a server session once the course page is loaded, and the histogram page URL is the same for all courses.
                // Awful design, and the best we can do is try to detect this and refuse to upload the details of the wrong course.
                // The image URL is unique for that histogram page, so there's no such problem with it, and the check that we do is enough.
                // We allow an empty course name just in case it can happen (perhaps we don't detect all possible formats).
                const histogramCourseNameMissing = !histogram.courseName;
                const histogramCourseNameMismatch = histogram.courseName !== courseName;
                const histogramCategoryMissing = !histogram.category;
                const histogramCategoryToCompare =
                    histogram.category === 'ציון סופי במערכת האקדמית במחשב המרכזי' ? 'Finals' : histogram.category;
                // A page whose title has no category fails the upload here, as it always has.
                const histogramCategoryMismatch =
                    (histogramCategoryToCompare as string).toLowerCase() !== category.toLowerCase();

                // In case of a mismatch, we add a prefix to the course name to
                // avoid overriding the correct data. We still upload the data
                // to be able to see the mismatch and fix it manually.
                let courseToCommit = course;
                if (
                    (histogramCourseNameMismatch && !histogramCourseNameMissing) ||
                    (histogramCategoryMismatch && !histogramCategoryMissing)
                ) {
                    courseToCommit = '_mismatch_' + courseToCommit;
                }

                const histogramCommitMetadata = {
                    ...commitMetadata,
                    category,
                    histogramCourseName: histogram.courseName,
                    histogramCategory: histogram.category,
                    histogramCourseNameMissing,
                    histogramCourseNameMismatch,
                    histogramCategoryMissing,
                    histogramCategoryMismatch
                };

                // Don't override with empty data (might happen sometimes because of an error or tests).
                const skipIfExists = Object.values(histogram.properties).every(x => !x);

                const properties = new TextEncoder().encode(JSON.stringify(histogram.properties, null, 2)).buffer;
                const propertiesResult = await submitToGithub(courseToCommit, semester, category, '.json', properties, {
                    commitMetadata: histogramCommitMetadata,
                    skipIfExists
                });

                // Don't upload test images (stop testing in production!)
                // Example:
                // https://github.com/michael-maltsev/technion-histograms/blob/f985c9133f4b5858e3b9605707fad6a913842e12/104013/201802/Final_B.png
                // The hash can be calculated with:
                // git hash-object image.png
                const skipIfSha = '76b85c3ecefcb57e8856889dbb44b31c52b50fc3';

                const image = await (
                    await fetchValidResponse(histogram.imgSrc, 'sharing.overlay.resource.histogramImage')
                ).arrayBuffer();
                const imageResult = await submitToGithub(courseToCommit, semester, category, '.png', image, {
                    commitMetadata: histogramCommitMetadata,
                    skipIfSha
                });

                if (propertiesResult === 'skipped' || imageResult === 'skipped') {
                    uiUpdateItemStatus(semester, course, category, '⚠', t('sharing.overlay.failed'));
                } else if (propertiesResult === 'exists' && imageResult === 'exists') {
                    uiUpdateItemStatus(semester, course, category, '⚌', t('sharing.overlay.exists'));
                } else {
                    uiUpdateItemStatus(semester, course, category, '✔', t('sharing.overlay.success'));
                }
            }
        }

        uiOnSubmitDone();
    }

    async function run() {
        const courses = getCourses();
        uiCreateTable(courses);

        for (const { courseMatched, course, semester, url, name } of courses) {
            const html = await fetchValidResponseAsText(url, 'sharing.overlay.resource.coursePage', 'windows-1255');
            const histograms = getCourseHistogramsFromHtml(html);

            histogramUploadQueue.push({
                courseMatched,
                course,
                semester,
                url,
                name,
                histograms
            });

            const categories = histograms.map(x => x.category);
            uiAddCourseCategories(semester, course, categories);
        }

        uiOnFirstLoadingDone();
    }

    run().catch(reason => uiOnError(reason.message));
}
