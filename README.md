# CheeseFork²

![logo](logo.png)

A scheduling helper web application for Technion students.

Use the language selector to switch between Hebrew and English. You can also open
`?lang=en` or `?lang=he`; an explicit URL language takes priority over the saved
browser preference. Hebrew remains the default. Switching languages reloads the
page while retaining its other URL parameters and fragment.

Course names, syllabuses, staff names, catalog notes, and existing histogram images
remain in their source language.

## Development

The site is built with [Vite+](https://viteplus.dev) (`vite-plus`), with Node.js 24.11 or
later and [pnpm](https://pnpm.io) (the version in `packageManager` of `package.json`). The sources in `src/` are strict TypeScript modules, bundled into `dist/` as classic
scripts (IIFE) in ES2017, which the pages load with `<script>` tags. The build only strips
the types, so `pnpm typecheck` is what checks them, for the site, the tests and the
functions.

```sh
pnpm install
pnpm --dir functions install
pnpm dev        # vp dev: serves the site, and reloads it when a source changes
pnpm build      # vp build: writes dist/ and share-histograms.js
pnpm lint       # vp lint: Oxlint
pnpm fmt        # vp fmt: Oxfmt (fmt:check only checks)
pnpm typecheck  # tsc, for the site, the tests and the functions
pnpm test       # vp test: Vitest
```

`dist/` is committed, since GitHub Pages serves the repository as it is, so run the build
after changing `src/` and commit its output with the change; the build also writes the
bookmarklet script `share-histograms.js`. The tests fail when either is out of date. The
bundles are listed in `tools/bundles.ts`, and `vite.config.ts` configures every command.

`pnpm dev` serves the pages as they are, as Pages does, but builds each bundle from `src/`
when it's requested, the same way the build does, so it never serves a stale `dist/`. The
bundles are classic scripts, so a change reloads the page instead of replacing modules.

The tests use synthetic course data without connecting to Firebase or the Technion grades
portal. Their global setup (`tests/setup.ts`) bundles the modules that tests load on their
own. DOM integration checks, and a test that parses the bundles as ES2017, guard the
browsers of `browserslist` in `package.json`; they do not replace visual checks in a real
browser.

### Layout

- `src/entries/`: one module for each bundle in `dist/`, which only wires the others together.
- `src/app/`: the app of `index.html`, a module for each feature. Their shared state is in
  `state.ts`, and `start()` in `init.ts` starts the page.
- `src/components/`: UI components, each with its logic (`.ts`), style (`.css`) and
  structure (`templates/*.html`).
- `src/lib/`: the course manager, iCalendar, translation and other shared modules.
- `src/styles/`: the site's stylesheets, and in `entries/` the stylesheet bundles of the pages.
- `src/bookmarklet/`: the script that shares histograms from the grades portal.
- `src/types/`: the types of the page's globals and of the libraries in `modules/`.
- `data/semesters.js`: the semesters, updated daily by `ci/semester_update.py`. It isn't bundled,
  so the update needs no build.
- `locales/`: the Hebrew, English, and Arabic translation catalogs.
- `modules/`: third-party libraries, committed as they are.
- `functions/`: the Firebase functions behind the API, in `functions/src/`, built into
  `functions/build/` when deployed.
- `tools/`: the build of the bundles, and the dev server's serving of them.
- `tests/`, `ci/`: the tests and the scheduled data scripts.

Markup is in HTML templates, filled by `render` (`src/lib/template.ts`): `{{name}}` is escaped,
`{{{name}}}` is HTML, and `{{t:key}}` is a translated message. `tests/structure.test.ts` keeps
markup out of script strings, modules under 800 lines, modules free of code that runs on
import, and inline scripts and styles out of the pages.

The HTML pages and `share-histograms.js` stay at the root because other sites, the
bookmarklet, and the browser extension load them by URL.

## Localization

`src/lib/i18n.ts` provides `CheeseI18n.t(key, parameters)` and explicit `data-i18n`
attributes for static text. The complete catalogs are `locales/he.js`,
`locales/en.js` and `locales/ar.js`. Keep their keys and `{parameter}` placeholders
in sync; the tests check all three, and that only Hebrew has Hebrew text. Use
separate elements for translated text and existing icons or links. Use `.text()` or
escape interpolated values when building HTML, including quotes when placing text
inside an attribute.

Locale selection also sets the document's `lang` and `dir`. Hebrew and Arabic are
right to left; `src/styles/i18n.css` supplies the LTR adjustments for the existing RTL styles.
The catalog's values, such as lesson types, days and faculties, are in Hebrew, and
`src/lib/course-manager.ts` translates them for every other language. Internal links should
use `CheeseI18n.withLocale(url)`, including links to standalone widgets. Keep raw
Technion data keys and saved lesson identifiers independent of their displayed
translations.

The course catalog is in Hebrew. For the English interface only, `index.html` also loads
`catalog-en/courses_<year>_<semester>.min.js`: the text that the Technion's SAP system has in
English, such as course names, descriptions, notes, staff and buildings. `CourseManager`
shows it through `getCourseName`, `getStaffLabel`, `getBuildingLabel` and
`getEnglishText`, and falls back to the Hebrew text. The catalog data itself stays in
Hebrew, since it also identifies saved lessons and tracks catalog changes. Hebrew and Arabic
show the Hebrew text. `ci/english_catalog.py` builds the files for the semesters that
technion-sap-info-fetcher updates, and the "Update the English course catalog" workflow
runs it weekly.

`src/lib/moment-locale.ts` sets moment's locale after the FullCalendar locale files, each of
which makes itself the global one. In Arabic it keeps Western digits, like the
catalog. Don't rely on moment's `week()`, whose weeks start on a different day in
Arabic; `course-calendar.ts` numbers its weeks with `calendarWeek`.

The histogram-sharing script runs inside the Technion grades portal, so its small
translation catalog is isolated inside `share-histograms.js`. It reads `lang`
from its own script URL and changes only its overlay, preserving the host page's
language and direction. It supports the same three languages, and old sharing links
continue to default to Hebrew.

## API

Signed-in users can create a personal API key and use it to view and change their
schedule from scripts and other apps. See [docs/API.md](docs/API.md) for the endpoints.

The **API** dialog in the navigation bar creates, replaces and revokes the key, and
offers a ready-made prompt to paste into an AI assistant, such as Claude or ChatGPT, so
that it can manage the schedule through the API. The prompt, built by
`apiAssistantPrompt` in `src/app/api-key.ts`, gives the base URL, authentication, the main
endpoints, the rate limit, the current semester and a link to the raw `docs/API.md`, and asks
the assistant to confirm before removing or replacing anything. It's in English so any
assistant can follow it. It uses a `YOUR_API_KEY` placeholder rather than the key, so
pasting it doesn't share the key with the assistant's service. Keep it in sync with
`docs/API.md` when the API changes.

The API runs as Firebase Cloud Functions in `functions/`, which require the Firebase
project to be on the Blaze plan. Its logic in `functions/src/lib/` has no Firebase
dependencies and is covered by `tests/api.test.ts`. The deploy builds the functions with
`tsc`. The functions are a pnpm project of their own, with their own lockfile, which the
deploy uploads with them. Deploy it with:

```sh
pnpm --dir functions install --frozen-lockfile
firebase deploy --only functions,hosting,firestore:rules
```

The API is served at `https://api.cf.talisrae.li` through Firebase Hosting, which rewrites
every path to the `api` function (`functions/hosting-public` is intentionally empty).

The deploy copies the course manager, as built in `dist/course-manager.js`, into the functions, so that the course data they
save matches what the site saves. Keep the schedule layout in
`functions/src/lib/schedule.ts` in sync with `src/app/layers.ts`, including its layer functions
(`layerCreate`, `layerDelete`, `layerDuplicate` and the others), which the API mirrors.

`GET /semesters` reads the list of semesters from the live site's `data/semesters.js`, or from
`index.html` on a site from before it (see `functions/src/lib/semesters.ts`), so semesters added by CI show up in the
API without deploying the functions.

## Credits

- Originally created by [Michael Maltsev](https://github.com/michael-maltsev) as [CheeseFork](https://github.com/michael-maltsev/cheese-fork).
- Maintained by [Tal Israeli](https://github.com/talisraeli).

## License

CheeseFork² is licensed under the [GNU General Public License v3.0](LICENSE).
