'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const contexts = new WeakMap();

function load(window, file) {
    const context = contexts.get(window);
    if (context) {
        vm.runInContext(read(file), context, { filename: file });
    } else {
        window.eval(read(file));
    }
}

function createPage(file = 'index.html', language = 'en', query = '') {
    const dom = new JSDOM(read(file), {
        url: 'https://cheesefork.test/' + file + '?lang=' + language + query,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    contexts.set(dom.window, dom.getInternalVMContext());
    load(dom.window, 'i18n.js');
    load(dom.window, 'locales/he.js');
    load(dom.window, 'locales/en.js');
    dom.window.CheeseI18n.apply(dom.window.document);
    return dom;
}

function loadUI(window) {
    const getComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = element => getComputedStyle(element);
    window.scrollTo = function () {};
    [
        'modules/fullcalendar/lib/jquery.min.js',
        'modules/fullcalendar/lib/jquery-ui.min.js',
        'modules/popper/popper.js',
        'modules/bootstrap-rtl/js/bootstrap.min.js',
        'modules/bootstrap4-dialog/js/bootstrap-dialog.min.js',
        'i18n-dialogs.js',
        'modules/OverlayScrollbars/js/jquery.overlayScrollbars.min.js',
        'modules/fullcalendar/lib/moment.min.js',
        'modules/fullcalendar/fullcalendar.min.js',
        'modules/fullcalendar/locale/he.js',
        'modules/selectize/js/standalone/selectize.min.js',
        'modules/color-hash/color-hash.js',
        'modules/ics.js/ics.deps.min.js',
        'ics-text.js',
        'modules/jsdiff/diff.min.js',
        'modules/intro.js/intro.min.js',
        'modules/reparse.js',
        'modules/boolean-expression.js',
        'course-manager.js',
        'components/course-select/course-select.js',
        'components/course-button-list/course-button-list.js',
        'components/course-exam-info/course-exam-info.js',
        'components/course-calendar/course-calendar.js',
        'components/histogram-browser/histogram-browser.js'
    ].forEach(file => load(window, file));
    window.$.expr.pseudos.hover = () => false;
    window.gtag = function () {};
    window.currentSemester = '202601';
    window.availableSemesters = {
        '202601': { start: '2026-10-25', end: '2027-02-01' },
        '202602': { start: '2027-03-01', end: '2027-06-01' }
    };
    window.scheduleSharingUserId = null;
    window.courses_from_rishum = [{
        general: {
            'מספר מקצוע': '01040001',
            'שם מקצוע': 'Course Alpha',
            'פקולטה': 'הפקולטה למתמטיקה',
            'מסגרת לימודים': 'לימודי הסמכה',
            'נקודות': '3',
            'סילבוס': 'A synthetic course syllabus.',
            'אחראים': 'Professor Example',
            'מועד א': '05-02-2027',
            'מועד ב': '05-03-2027',
            'הערות': 'Synthetic catalog notes.'
        },
        schedule: [{
            'קבוצה': 11,
            'מס.': 10,
            'סוג': 'הרצאה',
            'יום': 'ראשון',
            'שעה': '10:30 - 12:30',
            'בניין': 'Example Building',
            'חדר': 101,
            'מרצה/מתרגל': 'Professor Example'
        }]
    }];
    return window;
}

function englishContent(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('script, style, [lang="he"], option[value="he"]').forEach(node => node.remove());
    return copy.textContent;
}

// A signed-in user with the Firebase APIs that cheesefork.js uses. Load it before cheesefork.js.
// data is the user's semester document. Storage holds the paths in options.files, and the
// returned object records the uploads and metadata checks.
function installFakeFirebase(window, options = {}) {
    const user = { uid: options.uid || 'user1', displayName: 'Test User', email: null };
    const files = new Set(options.files || []);
    const data = JSON.parse(JSON.stringify(options.data || {}));
    const uploads = [];
    const metadataChecks = [];
    const DELETE = { fieldValue: 'delete' };
    const resolved = value => window.Promise.resolve(value);

    // Applies an update map like Firestore: dotted paths, and DELETE removing fields.
    function update(input) {
        Object.keys(input).forEach(key => {
            const path = key.split('.');
            let target = data;
            path.slice(0, -1).forEach(segment => {
                target[segment] = target[segment] || {};
                target = target[segment];
            });
            const last = path[path.length - 1];
            const value = input[key];
            if (value === DELETE) {
                delete target[last];
            } else if (value && value.arrayRemove) {
                target[last] = (target[last] || []).filter(item => !value.arrayRemove.includes(item));
            } else {
                target[last] = JSON.parse(JSON.stringify(value));
            }
        });
    }

    // A document without fields doesn't exist yet, like a semester the user never opened.
    const writes = [];
    const doc = {
        collection: () => ({ doc: () => doc }),
        onSnapshot(callback) {
            setTimeout(() => callback({
                metadata: { hasPendingWrites: false },
                exists: Object.keys(data).length > 0,
                data: () => JSON.parse(JSON.stringify(data)),
                get: field => data[field] === undefined ? undefined : JSON.parse(JSON.stringify(data[field]))
            }), 0);
            return () => {};
        },
        set(value) {
            writes.push({ type: 'set', value: JSON.parse(JSON.stringify(value)) });
            update(value);
            return resolved();
        },
        update(input) {
            writes.push({ type: 'update', fields: Object.keys(input) });
            update(input);
            return resolved();
        }
    };

    // Signed in from the start, unless options.signedOut, then signIn() signs in.
    let authCallback = null;
    const auth = {
        languageCode: null,
        currentUser: null,
        onAuthStateChanged(callback) {
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
        authCallback(user);
    };
    const authFunction = () => auth;
    authFunction.GoogleAuthProvider = { PROVIDER_ID: 'google.com' };
    authFunction.EmailAuthProvider = { PROVIDER_ID: 'password' };
    authFunction.FacebookAuthProvider = { PROVIDER_ID: 'facebook.com' };

    const firestore = () => ({ collection: () => ({ doc: () => doc }) });
    firestore.FieldValue = {
        delete: () => DELETE,
        arrayRemove: (...items) => ({ arrayRemove: items })
    };

    const fileRef = path => ({
        fullPath: path,
        putString(text, format, metadata) {
            uploads.push({ path, text, metadata });
            files.add(path);
            return resolved();
        },
        getMetadata() {
            metadataChecks.push(path);
            return files.has(path) ? resolved({ fullPath: path }) :
                window.Promise.reject({ code: 'storage/object-not-found' });
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
            AuthUI: function () {
                this.start = () => {};
            },
            CredentialHelper: { NONE: 'none' }
        }
    };

    return { user, data, uploads, metadataChecks, writes, signIn };
}

// Waits until condition() is true, failing after timeoutMs. For page work whose duration varies,
// such as loading the schedule, which takes much longer on a busy machine than on an idle one.
async function waitUntil(condition, description, timeoutMs = 10000) {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('Timed out waiting until ' + description);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

// Whether the page finished loading the schedule, which hides the page loader.
function pageLoaded(window) {
    return window.document.getElementById('page-loader').style.display === 'none';
}

module.exports = { root, read, load, createPage, loadUI, englishContent, installFakeFirebase, waitUntil, pageLoaded };
