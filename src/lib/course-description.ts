import { isCatalogLanguage, type CourseManager } from './course-manager.js';
import { render } from './template.js';
import courseLinkTemplate from './templates/course-link.html';
import whatsappLinkTemplate from './templates/whatsapp-link.html';

export interface DescriptionOptions {
    html?: boolean;
    // The prerequisites and the other related courses.
    relatedCourseInfo?: boolean;
    // Links to the course in other sites, with html.
    links?: boolean;
    // Whether clicks on the links are sent to analytics.
    logging?: boolean;
    whatsappGroupLink?: boolean;
}

// A course's description, as text or as HTML, see CourseManager.getDescription.
export function getDescription(that: CourseManager, course: string, options: DescriptionOptions): string {
    const general = that.coursesHashmap[course].general;
    let header = that.getTitle(course);
    let headerHtml = options.html ? sourceHtml(header) : '';
    let content = '';
    let contentHtml = '';

    function escapeHtml(value: string): string {
        return $('<div>').text(value).html();
    }

    function sourceHtml(value: string): string {
        return $('<span>', {
            class: 'source-content',
            lang: /[א-ת]/.test(value) ? 'he' : 'en',
            dir: 'auto',
            text: value
        })[0].outerHTML.replace(/\n/g, '<br>');
    }

    function addHeader(key: string, value: string): void {
        const label = `${that.getFieldLabel(key)}: `;
        header += `\n${label}${value}`;
        if (options.html) {
            headerHtml += `<br>${escapeHtml(label)}${/[א-ת]/.test(value) ? sourceHtml(value) : escapeHtml(value)}`;
        }
    }

    function addContent(key: string | null, value: string, separator: string): void {
        const label = key ? `${that.getFieldLabel(key)}: ` : '';
        content += separator + label + value;
        if (options.html) {
            contentHtml += separator.replace(/\n/g, '<br>') + escapeHtml(label) + sourceHtml(value);
        }
    }

    // The site's own labels, or SAP's English text for values it doesn't know.
    if (general['פקולטה']) {
        const faculty = that.getFacultyLabel(general['פקולטה']);
        addHeader(
            'פקולטה',
            faculty === general['פקולטה'] ? that.getEnglishText(course, 'faculty') || faculty : faculty
        );
    }

    if (general['מסגרת לימודים']) {
        const frameworks = general['מסגרת לימודים'].split('\n');
        const frameworkLabels = frameworks.map(framework => that.getFrameworkLabel(framework));
        const unknownFramework = frameworkLabels.some((label, i) => label === frameworks[i]);
        addHeader(
            'מסגרת לימודים',
            (unknownFramework && that.getEnglishText(course, 'level')) || frameworkLabels.join(', ')
        );
    }

    if (general['נקודות']) {
        addHeader('נקודות', general['נקודות']);
    }

    if (general['סילבוס']) {
        addContent(null, that.getEnglishText(course, 'syllabus') || general['סילבוס'], '\n\n');
    }

    if (options.relatedCourseInfo) {
        [
            'מקצועות קדם',
            'מקצועות צמודים',
            'מקצועות זהים',
            'מקצועות ללא זיכוי נוסף (מוכלים)',
            'מקצועות ללא זיכוי נוסף (מכילים)',
            'מקצועות ללא זיכוי נוסף'
        ].forEach(key => {
            if (general[key]) {
                let value = general[key]
                    .replace(/(ו-)\s+/g, '$1')
                    .replace(/(\()\s+/g, '$1')
                    .replace(/\s+(\))/g, '$1')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!isCatalogLanguage()) {
                    value = value
                        .replace(/(^|[\s(])או(?=$|[\s()])/g, `$1${CheeseI18n.t('courses.expression.or')}`)
                        .replace(/(^|[\s(])ו-\s*(?=\d|\()/g, `$1${CheeseI18n.t('courses.expression.and')} `);
                }
                addContent(key, value, '\n\n');
            }
        });
    }

    if (general['אחראים']) {
        addContent('אחראים', that.getEnglishText(course, 'coordinators') || general['אחראים'], '\n\n');
    }

    [
        ['בוחן מועד א', 'בוחן מועד ב', 'בוחן מועד ג', 'בוחן מועד ד', 'בוחן מועד ה', 'בוחן מועד ו'],
        ['מועד א', 'מועד ב', 'מועד ג']
    ].forEach(keys => {
        let first = true;
        keys.forEach(key => {
            if (general[key]) {
                let value = general[key].replace(/\n\n/g, '\n========\n');
                if (!isCatalogLanguage()) {
                    value = value
                        .split('\n')
                        .map(line =>
                            line.replace(
                                /^בתאריך (\d+)\.(\d+)\.(\d+)(?: יום ([א-ו]) משעה (\d+(?::\d+)?) עד השעה (\d+(?::\d+)?))?/,
                                (
                                    match,
                                    day: string,
                                    month: string,
                                    year: string,
                                    weekday?: string,
                                    start?: string,
                                    end?: string
                                ) => {
                                    let label = `${day}/${month}/${year}`;
                                    if (weekday) {
                                        label += ` ${that.getDayLabel(weekday)} ${start}–${end}`;
                                    }
                                    return label;
                                }
                            )
                        )
                        .join('\n');
                }
                addContent(key, value, first ? '\n\n' : '\n');
                first = false;
            }
        });
    });

    if (general['הערות']) {
        addContent('הערות', that.getEnglishText(course, 'notes') || general['הערות'], '\n\n');
    }

    if (!options.html) {
        return header + content;
    }

    let linksHtml = '';
    if (options.links) {
        // The click on a link is sent to analytics with options.logging, see trackMarkedLinks.
        const link = (event: string, url: string, icon: string, labelKey: string): string =>
            render(courseLinkTemplate, {
                url,
                icon,
                label: CheeseI18n.t(labelKey),
                event: options.logging ? event : ''
            });

        if (currentSemester < '202401') {
            linksHtml += `<br><br>${link(
                'info-click-link-rishum',
                `https://students.technion.ac.il/local/technionsearch/course/${course}`,
                'assets/icon-students.png',
                'courses.links.studentPortal'
            )}`;
        } else {
            const currentSemesterYear = currentSemester.slice(0, 4);
            const currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
            const sapLanguage = CheeseI18n.getLocale() === 'en' ? 'EN' : 'HE';
            linksHtml += `<br><br>${link(
                'info-click-link-sap',
                `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=${sapLanguage}&sap-ui-language=${sapLanguage}#/details/${currentSemesterYear}/${currentSemesterSapSemester}/SM/${course}`,
                'assets/icon-sap.png',
                'courses.links.catalog'
            )}`;
        }

        if (that.isComputerScienceCourse(course)) {
            linksHtml += `<br>${link(
                'info-click-link-webcourse',
                `https://webcourse.cs.technion.ac.il/${course}/`,
                'assets/icon-webcourse.png',
                'courses.links.webcourse'
            )}`;
        }

        linksHtml += `<br>${link(
            'info-click-link-facebook',
            `https://www.facebook.com/search/groups/?q=${that.toOldCourseNumber(course)}`,
            'assets/icon-facebook.png',
            'courses.links.facebook'
        )}`;

        linksHtml += `<br>${link(
            'info-click-link-tscans',
            `https://scans.cheesefork.cf/?course=${course}`,
            'assets/icon-scans.png',
            'courses.links.examScans'
        )}`;

        if (options.whatsappGroupLink) {
            linksHtml += `<br>${render(whatsappLinkTemplate, { event: options.logging ? 'info-click-link-whatsapp' : '' })}`;
        }
    }

    return headerHtml + linksHtml + contentHtml;
}
