// The global setup of the tests (see vite.config.ts): bundles the source modules that the tests
// run on their own, the way the build bundles the site's, once for all the test files.

import fs from 'node:fs';
import path from 'node:path';
import type { TestProject } from 'vite-plus/test/node';

declare module 'vitest' {
    export interface ProvidedContext {
        // The bundles, by the module they're of, each defining TEST_BUNDLE_GLOBAL.
        testBundles: Record<string, string>;
    }
}

// The global that a test bundle sets to its module's exports.
export const TEST_BUNDLE_GLOBAL = '__cheeseForkModule';

// The modules of the page's components, as the globals the page had before it used modules,
// for tests that use a component on its own. They share one bundle, as in the page.
export const UI_BUNDLE = 'ui-modules';
const UI_MODULES = [
    "import './src/lib/i18n-dialogs.ts';",
    "import './src/lib/moment-locale.ts';",
    "export { IcsText } from './src/lib/ics-text.ts';",
    "export { IcsImport } from './src/lib/ics-import.ts';",
    "export { CourseManager } from './src/lib/course-manager.ts';",
    "export { CourseSelect } from './src/components/course-select/course-select.ts';",
    "export { CourseButtonList } from './src/components/course-button-list/course-button-list.ts';",
    "export { CourseExamInfo } from './src/components/course-exam-info/course-exam-info.ts';",
    "export { CourseCalendar } from './src/components/course-calendar/course-calendar.ts';",
    "export { HistogramBrowser } from './src/components/histogram-browser/histogram-browser.ts';"
].join('\n');

const root = path.resolve(import.meta.dirname, '..');

// The modules that the tests load with loadModule(window, 'src/...').
export function loadedModules(): string[] {
    const modules = new Set<string>();
    for (const file of fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.ts'))) {
        const source = fs.readFileSync(path.join(root, 'tests', file), 'utf8');
        for (const match of source.matchAll(/\bloadModule\b[\s\S]*?'(src\/[^']+\.ts)'\s*\)/g)) {
            modules.add(match[1]);
        }
    }
    return [...modules].sort();
}

export default async function setup(project: TestProject): Promise<void> {
    // Only here, so that the tests that import this module for its names don't load the build.
    const { bundle, virtualModule } = await import('../tools/bundles.ts');
    const testBundles: Record<string, string> = {};
    for (const file of loadedModules()) {
        testBundles[file] = await bundle({ input: file, file, globalName: TEST_BUNDLE_GLOBAL });
    }
    const ui = virtualModule(UI_BUNDLE, UI_MODULES);
    testBundles[UI_BUNDLE] = await bundle({ input: ui.id, file: UI_BUNDLE, globalName: TEST_BUNDLE_GLOBAL }, [
        ui.plugin
    ]);
    project.provide('testBundles', testBundles);
}
