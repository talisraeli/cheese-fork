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

Serve this directory with any static HTTP server. No application build is needed.
Run the checks with Node.js 24 or later:

```sh
npm ci
npm run lint
npm test
```

The tests use synthetic course data without connecting to Firebase or
the Technion grades portal. DOM integration checks complement the ES5 browser
compatibility lint; they do not replace visual checks in a real browser.

## Localization

`i18n.js` provides `CheeseI18n.t(key, parameters)` and explicit `data-i18n`
attributes for static text. The complete catalogs are `locales/he.js` and
`locales/en.js`. Keep their keys and `{parameter}` placeholders in sync; the tests
check both. Use separate elements for translated text and existing icons or links.
Use `.text()` or escape interpolated values when building HTML, including quotes
when placing text inside an attribute.

Locale selection also sets the document's `lang` and `dir`. `i18n.css` supplies
the LTR adjustments for the existing RTL styles. Internal links should use
`CheeseI18n.withLocale(url)`, including links to standalone widgets. Keep raw
Technion data keys and saved lesson identifiers independent of their displayed
translations.

The histogram-sharing script runs inside the Technion grades portal, so its small
translation catalog is isolated inside `share-histograms.js`. It reads `lang`
from its own script URL and changes only its overlay, preserving the host page's
language and direction. Old sharing links continue to default to Hebrew.

## API

Signed-in users can create a personal API key and use it to view and change their
schedule from scripts and other apps. See [API.md](API.md) for the endpoints.

The **API** dialog in the navigation bar creates, replaces and revokes the key, and
offers a ready-made prompt to paste into an AI assistant, such as Claude or ChatGPT, so
that it can manage the schedule through the API. The prompt, built by
`apiAssistantPrompt` in `cheesefork.js`, gives the base URL, authentication, the main
endpoints, the rate limit, the current semester and a link to the raw `API.md`, and asks
the assistant to confirm before removing or replacing anything. It's in English so any
assistant can follow it. It uses a `YOUR_API_KEY` placeholder rather than the key, so
pasting it doesn't share the key with the assistant's service. Keep it in sync with
`API.md` when the API changes.

The API runs as Firebase Cloud Functions in `functions/`, which require the Firebase
project to be on the Blaze plan. Its logic in `functions/lib/` has no Firebase
dependencies and is covered by `tests/api.test.cjs`. Deploy it with:

```sh
(cd functions && npm ci)
firebase deploy --only functions,hosting,firestore:rules
```

The API is served at `https://api.cf.talisrae.li` through Firebase Hosting, which rewrites
every path to the `api` function (`functions/hosting-public` is intentionally empty).

The deploy copies `course-manager.js` into the functions, so that the course data they
save matches what the site saves. Keep the schedule layout in
`functions/lib/schedule.js` in sync with `cheesefork.js`.

## Credits

- Originally created by [Michael Maltsev](https://github.com/michael-maltsev) as [CheeseFork](https://github.com/michael-maltsev/cheese-fork).
- Maintained by [Tal Israeli](https://github.com/talisraeli).

## License

CheeseFork² is licensed under the [GNU General Public License v3.0](LICENSE).
