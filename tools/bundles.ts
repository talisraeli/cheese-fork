// The site's bundles, built by Vite+ from src/: `vp build` writes them with the rest of the site
// to out/ (see tools/site.ts), `vp dev` serves them as they're requested, and the tests bundle
// modules for themselves the same way.

import fs from 'node:fs';
import path from 'node:path';
import { build, type Plugin } from 'vite-plus';

const root = path.resolve(import.meta.dirname, '..');

export interface Bundle {
    // The entry: a source file, relative to the root, or the id of a virtual module.
    input: string;
    // Where it's published, relative to the root of the site, such as 'dist/i18n.js'.
    file: string;
    // The global that a script bundle sets to the entry's exports, if any.
    globalName?: string;
}

// The histogram sharing script, served from the root at a URL that the bookmarklet and the
// Technion Plus Plus extension load, so it's built there rather than in dist/. It runs on the
// grades site, so it bundles its libraries, with their licenses.
export const BOOKMARKLET_FILE = 'share-histograms.js';

export const BUNDLES: Bundle[] = [
    // Loaded in <head> before the locale catalogs, which register their messages with it.
    { input: 'src/entries/i18n.ts', file: 'dist/i18n.js' },
    { input: 'src/entries/cookie-consent.ts', file: 'dist/cookie-consent.js' },
    { input: 'src/entries/index-head.ts', file: 'dist/index-head.js' },
    { input: 'src/entries/navbar-logo.ts', file: 'dist/navbar-logo.js' },
    { input: 'src/entries/index-catalog.ts', file: 'dist/index-catalog.js' },
    { input: 'src/entries/cheesefork.ts', file: 'dist/cheesefork.js' },
    { input: 'src/entries/course-widget-histograms.ts', file: 'dist/course-widget-histograms.js' },
    { input: 'src/entries/course-widget-comments.ts', file: 'dist/course-widget-comments.js' },
    { input: 'src/entries/share-histograms-page.ts', file: 'dist/share-histograms-page.js' },
    // The functions run the course manager in a vm (see functions/src/lib/catalog.ts), so it is
    // built as a script that defines a global.
    { input: 'src/entries/course-manager.ts', file: 'dist/course-manager.js', globalName: 'CheeseForkCourseManager' },
    { input: 'src/styles/entries/cheesefork.css', file: 'dist/cheesefork.css' },
    { input: 'src/styles/entries/cheesefork-dark.css', file: 'dist/cheesefork-dark.css' },
    { input: 'src/styles/entries/cheesefork-print.css', file: 'dist/cheesefork-print.css' },
    { input: 'src/styles/entries/i18n.css', file: 'dist/i18n.css' },
    { input: 'src/styles/entries/cookie-consent.css', file: 'dist/cookie-consent.css' },
    { input: 'src/styles/entries/course-widget-histograms.css', file: 'dist/course-widget-histograms.css' },
    { input: 'src/styles/entries/share-histograms.css', file: 'dist/share-histograms.css' },
    { input: 'src/entries/share-histograms.ts', file: BOOKMARKLET_FILE }
];

// The bundles have LF line breaks, whatever git checked out, so that they're the same when
// built on any system.
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

const TEMPLATE_SUFFIX = '?cheesefork-template';

// Imports the HTML templates as strings.
export function templatesAsText(): Plugin {
    return {
        name: 'cheesefork:templates-as-text',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (!source.endsWith('.html') || !importer) {
                return null;
            }
            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
            return resolved && { ...resolved, id: resolved.id + TEMPLATE_SUFFIX };
        },
        load(id) {
            if (!id.endsWith(TEMPLATE_SUFFIX)) {
                return null;
            }
            const file = id.slice(0, -TEMPLATE_SUFFIX.length);
            this.addWatchFile(file);
            return 'export default ' + JSON.stringify(lf(fs.readFileSync(file, 'utf8'))) + ';';
        }
    };
}

// A module made of code, such as one that imports several modules, with imports relative to
// the root.
export function virtualModule(name: string, code: string): { id: string; plugin: Plugin } {
    const id = '\0cheesefork:' + name;
    return {
        id,
        plugin: {
            name: 'cheesefork:virtual-' + name,
            resolveId(source, importer) {
                if (source === id) {
                    return id;
                }
                return importer === id ? this.resolve(path.join(root, source)) : null;
            },
            load(loaded) {
                return loaded === id ? code : null;
            }
        }
    };
}

// Builds a bundle, and returns its text. Scripts are classic scripts (IIFE) for the browsers of
// browserslist in package.json, which all run ES2017; Vite+ only strips the types, which tsc
// checks (see tsconfig.json). Stylesheets have their imports inlined.
export async function bundle(entry: Bundle, plugins: Plugin[] = []): Promise<string> {
    const isStylesheet = entry.input.endsWith('.css');
    const result = await build({
        configFile: false,
        root,
        logLevel: 'warn',
        publicDir: false,
        plugins: [templatesAsText(), ...plugins],
        build: {
            write: false,
            emptyOutDir: false,
            copyPublicDir: false,
            reportCompressedSize: false,
            minify: false,
            cssMinify: false,
            target: 'es2017',
            rolldownOptions: {
                input: entry.input.startsWith('\0') ? entry.input : path.join(root, entry.input),
                // Keeps the entry's exports, which an app build would drop, for globalName.
                preserveEntrySignatures: 'strict',
                output: isStylesheet
                    ? { format: 'es', assetFileNames: '[name][extname]' }
                    : { format: 'iife', name: entry.globalName, entryFileNames: '[name].js', banner: '"use strict";' }
            }
        }
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => ('output' in item ? item.output : []));
    const output = outputs.find(item => item.fileName.endsWith(isStylesheet ? '.css' : '.js'));
    if (!output) {
        throw new Error(entry.input + ' built no ' + (isStylesheet ? 'stylesheet' : 'script'));
    }
    return lf(output.type === 'chunk' ? output.code : String(output.source));
}

// Every bundle, by the file it's published as.
export async function buildBundles(): Promise<Map<string, string>> {
    const built = new Map<string, string>();
    for (const entry of BUNDLES) {
        built.set(entry.file, await bundle(entry));
    }
    return built;
}
