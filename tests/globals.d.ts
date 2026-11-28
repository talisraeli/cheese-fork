// The globals of the site's pages that the tests read or set on jsdom's window, besides the ones
// of src/types/page.d.ts.

import type {
    CourseButtonList,
    CourseButtonListOptions
} from '../src/components/course-button-list/course-button-list.ts';
import type { CourseCalendarOptions } from '../src/components/course-calendar/calendar-types.ts';
import type { CourseCalendar } from '../src/components/course-calendar/course-calendar.ts';
import type { HistogramBrowser } from '../src/components/histogram-browser/histogram-browser.ts';
import type { CourseManager, CatalogCourse, EnglishCatalog } from '../src/lib/course-manager.ts';
import type { IcsText } from '../src/lib/ics-text.ts';

declare global {
    interface Window {
        $: JQueryStatic;
        jQuery: JQueryStatic;
        BootstrapDialog: BootstrapDialogStatic;
        moment: typeof import('moment');
        // The vendored libraries and Firebase, or the tests' doubles of them.
        firebase: unknown;
        firebaseui: unknown;
        ics: typeof ics;
        saveAs: (data: Blob, filename: string) => void;
        courses_from_rishum: CatalogCourse[];
        courses_english: EnglishCatalog | undefined;
        // The modules of the components, exposed by loadUIModules in helpers.ts.
        CourseManager: typeof CourseManager;
        // The tests make components with only the callbacks that they use.
        CourseCalendar: typeof CourseCalendar &
            (new (element: JQuery, options: Partial<CourseCalendarOptions>) => CourseCalendar);
        CourseButtonList: typeof CourseButtonList &
            (new (element: JQuery, options: Partial<CourseButtonListOptions>) => CourseButtonList);
        HistogramBrowser: typeof HistogramBrowser;
        IcsText: typeof IcsText;
        eval(code: string): unknown;
    }
}

export {};
