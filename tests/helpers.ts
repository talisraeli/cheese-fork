import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM, type DOMWindow } from 'jsdom';
import { inject } from 'vite-plus/test';
import type { WrappedCalendar } from '../src/lib/ics-text.ts';
import { TEST_BUNDLE_GLOBAL, UI_BUNDLE } from './setup.ts';

const root = path.resolve(import.meta.dirname, '..');
// A page of the site, in jsdom.
export type TestWindow = DOMWindow;

const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
const contexts = new WeakMap<TestWindow, vm.Context>();

function run(window: TestWindow, code: string, file: string): unknown {
    const context = contexts.get(window);
    return context ? vm.runInContext(code, context, { filename: file }) : window.eval(code);
}

// A file of the site as it's deployed: a bundle as `pnpm build` builds it (see tests/setup.ts),
// or a file of the repository, such as a locale catalog.
function siteFile(file: string): string {
    return inject('siteBundles')[file] ?? read(file);
}

function load(window: TestWindow, file: string): void {
    run(window, siteFile(file), file);
}

// A bundle of tests/setup.ts, which bundles source modules the way the build bundles them,
// once for all the tests. Running it in a page returns its exports.
function bundle(name: string): string {
    const code = inject('testBundles')[name];
    if (code === undefined) {
        throw new Error(
            name +
                " isn't bundled for the tests: tests/setup.ts bundles the modules " +
                "that the tests load with loadModule(window, 'src/...'), given as a string"
        );
    }
    return code + '\n' + TEST_BUNDLE_GLOBAL + ';';
}

// A source module on its own, such as 'src/lib/template.ts', with its exports as T, such as
// typeof import('../src/lib/template.ts').
function loadModule<T>(window: TestWindow, file: string): T {
    return run(window, bundle(file), file) as T;
}

// The modules of the page's components, as the globals the page had before it used modules,
// for tests that use a component on its own (see UI_MODULES in tests/setup.ts).
function loadUIModules(window: TestWindow): void {
    Object.assign(window, run(window, bundle(UI_BUNDLE), UI_BUNDLE) as object);
}

// The app of index.html, as built.
function loadApp(window: TestWindow): void {
    load(window, 'dist/cheesefork.js');
}

function createPage(file = 'index.html', language = 'en', query = ''): JSDOM {
    const dom = new JSDOM(read(file), {
        url: 'https://cheesefork.test/' + file + '?lang=' + language + query,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    contexts.set(dom.window, dom.getInternalVMContext());
    load(dom.window, 'dist/i18n.js');
    load(dom.window, 'locales/he.js');
    load(dom.window, 'locales/en.js');
    load(dom.window, 'locales/ar.js');
    dom.window.CheeseI18n.apply(dom.window.document);
    return dom;
}

function loadUI(window: TestWindow): TestWindow {
    const getComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (element: Element) => getComputedStyle(element);
    window.scrollTo = function () {};
    [
        'modules/fullcalendar/lib/jquery.min.js',
        'modules/fullcalendar/lib/jquery-ui.min.js',
        'modules/popper/popper.js',
        'modules/bootstrap-rtl/js/bootstrap.min.js',
        'modules/bootstrap4-dialog/js/bootstrap-dialog.min.js',
        'modules/OverlayScrollbars/js/jquery.overlayScrollbars.min.js',
        'modules/fullcalendar/lib/moment.min.js',
        'modules/fullcalendar/fullcalendar.min.js',
        'modules/fullcalendar/locale/he.js',
        'modules/fullcalendar/locale/ar.js',
        'modules/selectize/js/standalone/selectize.min.js',
        'modules/color-hash/color-hash.js',
        'modules/ics.js/ics.deps.min.js',
        'modules/jsdiff/diff.min.js',
        'modules/intro.js/intro.min.js',
        'modules/reparse.js',
        'modules/boolean-expression.js'
    ].forEach(file => load(window, file));
    loadUIModules(window);
    window.$.expr.pseudos.hover = () => false;
    window.gtag = function () {};
    window.currentSemester = '202601';
    window.availableSemesters = {
        '202601': { start: '2026-10-25', end: '2027-02-01' },
        '202602': { start: '2027-03-01', end: '2027-06-01' }
    };
    window.scheduleSharingUserId = null;
    window.courses_from_rishum = [
        {
            general: {
                'מספר מקצוע': '01040001',
                'שם מקצוע': 'Course Alpha',
                פקולטה: 'הפקולטה למתמטיקה',
                'מסגרת לימודים': 'לימודי הסמכה',
                נקודות: '3',
                סילבוס: 'A synthetic course syllabus.',
                אחראים: 'Professor Example',
                'מועד א': '05-02-2027',
                'מועד ב': '05-03-2027',
                הערות: 'Synthetic catalog notes.'
            },
            schedule: [
                {
                    קבוצה: 11,
                    'מס.': 10,
                    סוג: 'הרצאה',
                    יום: 'ראשון',
                    שעה: '10:30 - 12:30',
                    בניין: 'Example Building',
                    חדר: 101,
                    'מרצה/מתרגל': 'Professor Example'
                }
            ]
        }
    ];
    return window;
}

function englishContent(element: Element): string {
    const copy = element.cloneNode(true) as Element;
    copy.querySelectorAll('script, style, [lang="he"], option[value="he"]').forEach(node => node.remove());
    return copy.textContent ?? '';
}

// A signed-in user with the Firebase APIs that the app uses. Install it before loading the app.
// data is the user's semester document. Storage holds the files in options.files, either paths
// or { path, customMetadata }, and the returned object records the uploads and metadata checks.
interface FakeFirebaseOptions {
    uid?: string;
    files?: (string | { path: string; customMetadata?: Record<string, string> })[];
    data?: Record<string, unknown>;
    signedOut?: boolean;
}

type Tree = Record<string, unknown>;

function installFakeFirebase(window: TestWindow, options: FakeFirebaseOptions = {}) {
    const user = { uid: options.uid || 'user1', displayName: 'Test User', email: null };
    // Path to custom metadata.
    const files = new Map<string, Record<string, string>>(
        (options.files || []).map(file =>
            typeof file === 'string' ? [file, {}] : [file.path, file.customMetadata || {}]
        )
    );
    const data: Tree = JSON.parse(JSON.stringify(options.data || {}));
    // The app uploads calendars with their content type and fingerprint.
    type UploadMetadata = { contentType: string; customMetadata: Record<string, string> };
    const uploads: { path: string; text: string; metadata: UploadMetadata }[] = [];
    const metadataChecks: string[] = [];
    const DELETE = { fieldValue: 'delete' };
    const resolved = (value?: unknown) => window.Promise.resolve(value);

    // Applies an update map like Firestore: dotted paths, and DELETE removing fields.
    function update(input: Tree): void {
        Object.keys(input).forEach(key => {
            const path = key.split('.');
            let target = data;
            path.slice(0, -1).forEach(segment => {
                target[segment] = target[segment] || {};
                target = target[segment] as Tree;
            });
            const last = path[path.length - 1];
            const value = input[key] as { arrayRemove?: unknown[] } | null;
            if (value === DELETE) {
                delete target[last];
            } else if (value && value.arrayRemove) {
                const removed = value.arrayRemove;
                target[last] = ((target[last] || []) as unknown[]).filter(item => !removed.includes(item));
            } else {
                target[last] = JSON.parse(JSON.stringify(value));
            }
        });
    }

    // A document without fields doesn't exist yet, like a semester the user never opened.
    const writes: { type: string; value?: unknown; fields?: string[] }[] = [];
    const doc = {
        collection: (): unknown => ({ doc: () => doc }),
        onSnapshot(callback: (snapshot: unknown) => void) {
            setTimeout(
                () =>
                    callback({
                        metadata: { hasPendingWrites: false },
                        exists: Object.keys(data).length > 0,
                        data: () => JSON.parse(JSON.stringify(data)),
                        get: (field: string) =>
                            data[field] === undefined ? undefined : JSON.parse(JSON.stringify(data[field]))
                    }),
                0
            );
            return () => {};
        },
        set(value: Tree) {
            writes.push({ type: 'set', value: JSON.parse(JSON.stringify(value)) });
            update(value);
            return resolved();
        },
        update(input: Tree) {
            writes.push({ type: 'update', fields: Object.keys(input) });
            update(input);
            return resolved();
        }
    };

    // Signed in from the start, unless options.signedOut, then signIn() signs in.
    type User = typeof user;
    let authCallback: ((user: User | null) => void) | null = null;
    const auth: { languageCode: string | null; currentUser: User | null; [method: string]: unknown } = {
        languageCode: null,
        currentUser: null,
        onAuthStateChanged(callback: (user: User | null) => void) {
            authCallback = callback;
            setTimeout(() => {
                auth.currentUser = options.signedOut ? null : user;
                callback(auth.currentUser);
            }, 0);
        },
        signOut() {}
    };
    const signIn = () => {
        auth.currentUser = user;
        (authCallback as (user: User | null) => void)(user);
    };
    const authFunction = Object.assign(() => auth, {
        GoogleAuthProvider: { PROVIDER_ID: 'google.com' },
        EmailAuthProvider: { PROVIDER_ID: 'password' },
        FacebookAuthProvider: { PROVIDER_ID: 'facebook.com' }
    });

    const firestore = Object.assign(() => ({ collection: () => ({ doc: () => doc }) }), {
        FieldValue: {
            delete: () => DELETE,
            arrayRemove: (...items: unknown[]) => ({ arrayRemove: items })
        }
    });

    const fileRef = (path: string) => ({
        fullPath: path,
        putString(text: string, format: string, metadata?: UploadMetadata) {
            uploads.push({ path, text, metadata: metadata as UploadMetadata });
            files.set(path, (metadata && metadata.customMetadata) || {});
            return resolved({ metadata: { fullPath: path } });
        },
        getMetadata() {
            metadataChecks.push(path);
            return files.has(path)
                ? resolved({ fullPath: path, customMetadata: files.get(path) })
                : window.Promise.reject({ code: 'storage/object-not-found' });
        }
    });

    window.firebase = {
        initializeApp() {},
        app: () => ({ options: { storageBucket: 'test-bucket' } }),
        auth: authFunction,
        firestore: firestore,
        storage: () => ({ ref: () => ({ child: fileRef }) })
    };
    window.firebaseui = {
        auth: {
            AuthUI: function (this: { start: () => void }) {
                this.start = () => {};
            },
            CredentialHelper: { NONE: 'none' }
        }
    };

    return { user, data, uploads, metadataChecks, writes, signIn };
}

// Waits until condition() is true, failing after timeoutMs. For page work whose duration varies,
// such as loading the schedule, which takes much longer on a busy machine than on an idle one.
async function waitUntil(condition: () => unknown, description: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('Timed out waiting until ' + description);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

// A calendar of IcsText.wrap that records the events added to it, for CourseCalendar.saveAsIcs.
function recordingCalendar(calls: unknown[][]): WrappedCalendar {
    return {
        addEvent(...args: unknown[]) {
            calls.push(args);
        },
        build: () => false,
        download: () => false
    };
}

// Records the dialogs that the page shows, and returns a function that returns the last one,
// which the test expects to have been shown.
function recordLastDialog(window: TestWindow): () => BootstrapDialogInstance {
    let last: BootstrapDialogInstance | null = null;
    const show = window.BootstrapDialog.show;
    window.BootstrapDialog.show = (options: BootstrapDialogOptions) => (last = show(options));
    return () => {
        if (!last) {
            throw new Error('No dialog was shown');
        }
        return last;
    };
}

// Whether the page finished loading the schedule, which hides the page loader.
function pageLoaded(window: TestWindow): boolean {
    return (window.document.getElementById('page-loader') as HTMLElement).style.display === 'none';
}

export {
    root,
    read,
    siteFile,
    load,
    loadModule,
    loadApp,
    createPage,
    loadUI,
    englishContent,
    installFakeFirebase,
    waitUntil,
    pageLoaded,
    recordingCalendar,
    recordLastDialog
};
