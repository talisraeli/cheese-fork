# CheeseFork² Privacy Policy

Last updated: 2026-11-25

CheeseFork² is a free, open source schedule builder for Technion students, based on CheeseFork by Michael Maltsev. This policy describes what data the site handles, where it goes, and how you can control it. The full source code is available at https://github.com/talisraeli/cheese-fork under the GNU General Public License v3.0, so everything described here can be verified.

CheeseFork² is a static website. There is no CheeseFork²-operated server that processes your data. All storage and authentication is handled by third-party services (mainly Google Firebase) directly from your browser, as described below.

## Summary

- You can use CheeseFork² without an account. Your schedule is then stored only in your browser.
- Signing in is optional. It enables syncing your schedule across devices, sharing it with a link, and a hosted iCalendar link.
- The site uses Google Analytics only if you allow it.
- The site includes the Negishot accessibility widget, which remembers your accessibility settings and reports which of its tools are used.
- CheeseFork² does not collect course feedback. The "הצג חוות דעת בחלון חדש" button opens the course's feedback on the original CheeseFork.
- Schedules and iCalendar files you share are visible to anyone who has the link.
- Histogram sharing uploads only aggregate course statistics to a public GitHub repository, never your own grades or identity.

## 1. Using CheeseFork² without an account

When you are not signed in, the schedule you build (selected courses, chosen lesson groups, and custom events) is stored in your browser's local storage, per semester. It is not sent to any server.

The site also stores small preference values in local storage, such as:

- the last semester you viewed;
- your selected interface language;
- whether you dismissed the intro tour, tips, and reminder popups (weekly graph, histogram sharing, Technion scans);
- your light/dark mode choice.

This data stays on your device until you clear the site's data in your browser.

## 2. Signing in

Authentication is provided by Firebase Authentication (Google). You can sign in with a Google account or with an email address and password. When you sign in, Firebase provides CheeseFork² with your user ID, email address, and display name (and, for Google sign-in, your profile picture URL). CheeseFork² does not use Facebook or any other social sign-in.

When you are signed in, CheeseFork² stores your display name in its database so that it can be shown to people you share your schedule with (see section 4). Your email address is not stored by CheeseFork² outside of Firebase Authentication itself.

Firebase Authentication keeps your session in your browser (local storage or IndexedDB) so you stay signed in between visits. Signing out clears it.

## 3. Schedule data stored in the cloud

When you are signed in, your schedule is stored in Google Cloud Firestore in a document tied to your user ID and the semester, instead of in local storage. It contains:

- the list of courses you selected and their order;
- the lesson groups you chose for each course;
- custom events you added (title, day, time, and any other fields you fill in);
- a snapshot of the catalog data for your selected courses, used to detect and show changes made to the course catalog after you built your schedule;
- your display name.

This data is used only to render your schedule, keep it in sync across your devices, and power the features described in this policy. Removing a course or a custom event removes it from the cloud document.

## 4. Sharing your schedule

The "Share schedule" feature creates a link that contains your user ID. Anyone who has the link can view your schedule for that semester in real time, together with your display name. Viewing a shared schedule does not require signing in.

Please share the link only with people you want to see your schedule. Anyone who has it can keep viewing your schedule as long as it exists; there is no separate way to revoke a link other than clearing the schedule for that semester.

## 5. iCalendar export

If you are not signed in, the iCalendar (.ics) file is generated in your browser and downloaded directly. Nothing is uploaded.

If you are signed in, the file is uploaded to Firebase Cloud Storage and made available at a fixed public URL under https://files.cheesefork.cf/ that is derived from your user ID and the semester. This lets you subscribe to the link from a calendar application, and the file is overwritten each time you open the export dialog. The file contains your lessons, your exam dates, and your custom events. Anyone who has the URL can download it.

## 6. Course feedback

CheeseFork² does not collect or show course feedback (reviews). In a course's details, the "הצג חוות דעת בחלון חדש" ("Show reviews in a new window") button opens that course's feedback on the original CheeseFork at https://cheesefork.cf/, a separate site run by Michael Maltsev under its own privacy policy. The old embeddable feedback widget address redirects there too.

## 7. Sharing histograms

CheeseFork² shows grade histograms collected from the Technion grades website. You can contribute histograms by running a script (share-histograms.js) on https://grades.technion.ac.il/, either via a bookmarklet or via the Technion Plus Plus browser extension. This only happens when you explicitly start it.

The script runs inside your own session on the Technion grades website and reads the course pages available to you. For each course it extracts only aggregate, non-personal information: the number of students, pass/fail counts, pass percentage, minimum, maximum, average, median, the list of course staff, and the histogram image itself. Your own grades, name, ID number, or any other personal details are not read or uploaded.

The extracted data is sent from your browser directly to the GitHub API and committed to the public repository https://github.com/michael-maltsev/technion-histograms using CheeseFork's own GitHub credentials, so the contribution is not attributed to you or your GitHub account. Nothing is uploaded until you click the share button in the script's interface.

## 8. Analytics

CheeseFork² can use Google Analytics on the main site, the histogram sharing page, and the embeddable histogram widget, but only after you allow it. On your first visit, a cookie notice asks whether to allow analytics. Until you choose "Allow analytics", Google Tag Manager and Google Analytics are not loaded and no analytics data is sent. Your choice is kept in your browser's local storage, and you can change it at any time with the "Cookie settings" link at the bottom of the page. Withdrawing consent stops analytics and removes the Google Analytics cookies from the site. The embeddable histogram widget never shows the notice; it follows the choice you made on the main site, when your browser makes it available to the widget, and otherwise does not load analytics.

When allowed, Google Analytics collects information such as the pages you visit, your browser and device type, approximate location derived from your IP address, and interaction events (for example, which navigation buttons or popup options were clicked). Google Analytics sets cookies in your browser for this purpose.

CheeseFork² does not send your name, email, user ID, or schedule contents to Google Analytics. You can also block Google Analytics with a content blocker or with Google's opt-out browser add-on. Google's own privacy policy is available at https://policies.google.com/privacy.

## 9. Third-party services and content

Using CheeseFork² causes your browser to contact the following services. Each of them receives standard connection information such as your IP address and browser details, and is governed by its own privacy policy.

- **Google Firebase** (Authentication, Cloud Firestore, Cloud Storage) and Firebase SDKs loaded from www.gstatic.com. Privacy policy: https://firebase.google.com/support/privacy.
- **Google Analytics**, loaded from www.googletagmanager.com only if you allow analytics. See section 8.
- **Negishot accessibility widget**, loaded from negishot.co.il on the main site and the histogram sharing page. It adds an accessibility menu (for example, text size, contrast, and readable fonts). Your accessibility settings are saved in your browser's local storage and in a `negishot_prefs` cookie that lasts 30 days. When you use one of the widget's tools, the widget sends Negishot the name of the tool and a random identifier that it keeps in your browser's local storage (`negishot_sid`); it does not send your name, email, user ID, or schedule. When you open the menu, the widget may load fonts from fonts.googleapis.com, cdn.jsdelivr.net, and media.getmood.io. Negishot is a separate service with its own privacy policy, available at https://negishot.co.il.
- **Course catalog and data files** loaded from ug.cheesefork.cf, sap.cheesefork.cf, and michael-maltsev.github.io (hosted on GitHub Pages). These contain only public course information, histograms, and calendar data; no user data is sent to them beyond the request itself.
- **Facebook Page plugin**. The "weekly graph" popup embeds the CheeseFork Facebook page in an iframe served by Facebook. Facebook may set cookies and collect data when that popup is displayed, according to Facebook's privacy policy. The plugin is only loaded when the popup is shown, and you can disable the popup from within it.
- **Original CheeseFork** (cheesefork.cf). The "הצג חוות דעת בחלון חדש" button and the old feedback widget address open course feedback there. Nothing is sent to it beyond the request itself.
- **Hosting**. The site itself is served by GitHub Pages, which may keep standard server access logs.

The site also contains links to external sites and communities (Technion websites, Technion scans, WhatsApp, Telegram, Discord, Facebook groups, the Chrome Web Store). Following a link takes you to a site with its own policy, and CheeseFork² does not share your data with them.

## 10. Cookies and browser storage

CheeseFork² itself does not set cookies. It uses local storage for the data described in section 1 and for your analytics choice, and Firebase Authentication uses local storage or IndexedDB to keep you signed in. Google Analytics (only if you allow it), the Negishot accessibility widget, and the Facebook Page plugin may set their own cookies and browser storage as described above.

## 11. Retention and deletion

- Data in your browser is kept until you clear the site's data in your browser settings.
- Cloud schedule data is kept for as long as your account exists. You can remove individual courses and custom events from within the app.
- Contributed histograms are part of a public repository and are kept indefinitely; they contain no personal data.

To request deletion of your account, your cloud schedule data, or a hosted iCalendar file, contact the maintainer as described in section 14. Please include the email address or display name of the account so the data can be located.

## 12. Security

All communication with the services above is over HTTPS. Your cloud schedule data can only be modified from your browser while you are signed in to your account. Data that you choose to make available through a link (a shared schedule or a hosted iCalendar file) is readable by anyone who has that link.

## 13. Changes to this policy

This policy may be updated when the site's features change. The date at the top indicates the latest revision, and the history is available in the project's Git repository.

## 14. Contact

CheeseFork² is maintained by Tal Israeli and is based on CheeseFork, originally created by Michael Maltsev. For privacy questions or data deletion requests, open an issue at https://github.com/talisraeli/cheese-fork/issues.
