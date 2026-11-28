import type { CourseManager } from '../../lib/course-manager.js';
import { render } from '../../lib/template.js';
import { HistogramBrowser } from '../histogram-browser/histogram-browser.js';
import { showWhatsappGroupLink } from './whatsapp-group-link.js';
import feedbackWindowTemplate from './templates/feedback-window.html';

// The course's information dialog, and the original CheeseFork's course reviews in a
// floating window.

export function setInfoDialogContent(dialog: BootstrapDialogInstance, course: string, courseManager: CourseManager) {
    const modalBody = dialog.getModalBody();

    const courseDescriptionHtmlWithLinks = courseManager.getDescription(course, {
        html: true,
        relatedCourseInfo: true,
        links: true,
        whatsappGroupLink: true,
        logging: true
    });

    const courseInfo = $('<div>', {
        html: courseDescriptionHtmlWithLinks
    });

    courseInfo.find('.whatsapp-group-link').click(() => {
        showWhatsappGroupLink(courseManager.toNewCourseNumber(course));
        return false;
    });

    // Put links on course numbers.
    // Replace only text inside element: https://stackoverflow.com/a/11867485
    courseInfo
        .find('.source-content')
        .addBack()
        .contents()
        .filter(function (this: Node) {
            return this.nodeType === Node.TEXT_NODE;
        })
        .each(function (this: Node) {
            let replaced = false;
            const html = $('<div>')
                .text(this.textContent || '')
                .html()
                .replace(/\b(?:\d{5,8})\b/g, match => {
                    // Five to eight digits are always a course number.
                    const matchCourse = courseManager.toSemesterFormatCourseNumber(
                        courseManager.stringToCourseNumber(match) as string
                    );
                    if (matchCourse === course) {
                        return match;
                    }

                    let url;
                    if (currentSemester < '202401') {
                        if (matchCourse.length !== 6) {
                            return match;
                        }

                        url = `https://students.technion.ac.il/local/technionsearch/course/${matchCourse}`;
                    } else {
                        if (matchCourse.length !== 8) {
                            return match;
                        }

                        const currentSemesterYear = currentSemester.slice(0, 4);
                        const currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
                        const sapLanguage = CheeseI18n.getLocale() === 'en' ? 'EN' : 'HE';
                        url = `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=${sapLanguage}&sap-ui-language=${sapLanguage}#/details/${currentSemesterYear}/${currentSemesterSapSemester}/SM/${matchCourse}`;
                    }

                    let tooltipTitle;
                    let onmouseover = undefined;
                    if (courseManager.doesExist(matchCourse)) {
                        tooltipTitle = courseManager.getTitle(matchCourse);
                    } else {
                        tooltipTitle = CheeseI18n.t('courses.notOffered');

                        const courseNameUrl = `https://michael-maltsev.github.io/technion-course-names/num/${matchCourse}`;
                        onmouseover = `var that = this;if (!$(that).attr("data-name-loading")) {$(that).attr("data-name-loading", true);$.get("${courseNameUrl}", function (name) {$(that).attr("data-original-title", "${matchCourse} - " + name + ${JSON.stringify(` ${CheeseI18n.t('courses.notOffered')}`)});if ($(that).is(":hover")) { $(that).tooltip("show"); }});}`;
                    }

                    replaced = true;
                    return $('<a>', {
                        href: url,
                        target: '_blank',
                        rel: 'noopener',
                        onclick: "gtag('event', 'info-click-dependency-link-rishum')",
                        onmouseover,
                        title: tooltipTitle,
                        'data-toggle': 'tooltip',
                        'data-trigger': 'hover',
                        text: match
                    })[0].outerHTML;
                });

            if (replaced) {
                const newElement = $('<span>', { html });
                newElement.find('[data-toggle="tooltip"]').tooltip();
                $(this).replaceWith(newElement);
            }
        });

    modalBody.find('.course-information').empty().append(courseInfo);

    // Course feedback is shown only on the original CheeseFork, in a floating window. The link
    // still opens it in a new tab with a middle click or Ctrl+click.
    const originalFeedbackUrl = getOriginalFeedbackUrl(courseManager, course);
    const originalFeedbackLink = $('<a>', {
        class: 'btn btn-primary',
        href: originalFeedbackUrl,
        target: '_blank',
        rel: 'noopener',
        role: 'button',
        text: CheeseI18n.t('courses.originalFeedback.button')
    }).click(event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        event.preventDefault();
        gtag('event', 'course-feedback-original-site-click');
        showOriginalFeedbackWindow(originalFeedbackUrl, courseManager.getCourseName(course));
    });
    const originalFeedbackNote = $('<div>', {
        class: 'small text-muted mt-1',
        text: CheeseI18n.t('courses.originalFeedback.note')
    });
    modalBody
        .find('.course-feedback')
        .addClass('text-center mb-4')
        .empty()
        .append(originalFeedbackLink, originalFeedbackNote);

    const histogramBrowser = new HistogramBrowser(modalBody.find('.inline-histograms'), {});
    histogramBrowser.loadHistograms(courseManager.toNewCourseNumber(course));
}

export function getOriginalFeedbackUrl(courseManager: CourseManager, course: string) {
    return `https://cheesefork.cf/course-widget-comments.html?course=${encodeURIComponent(courseManager.toNewCourseNumber(course))}`;
}

// A floating window with the reviews page of the original CheeseFork. It stays above the
// dialogs, can be dragged by its header, and is reused for the next course. The page is
// loaded only when the window is opened.
interface Size {
    width: number;
    height: number;
}

let originalFeedbackWindow: JQuery | null = null;
// The size the floating window was resized to, kept when it's opened again.
let originalFeedbackWindowSize: Size | null = null;
const originalFeedbackWindowMinSize: Size = { width: 260, height: 220 };

export function showOriginalFeedbackWindow(url: string, courseName: string): void {
    const title = CheeseI18n.t('courses.originalFeedback.windowTitle', { course: courseName });

    if (!originalFeedbackWindow) {
        originalFeedbackWindow = createOriginalFeedbackWindow();
    }

    originalFeedbackWindow.find('.course-feedback-window-title').text(title);
    originalFeedbackWindow.find('.course-feedback-window-button[target]').attr('href', url);
    originalFeedbackWindow.find('iframe').attr({ src: url, title });
    originalFeedbackWindow.removeClass('d-none');
    fitOriginalFeedbackWindow(true);
}

function createOriginalFeedbackWindow(): JQuery {
    const feedbackWindow = $(render(feedbackWindowTemplate)).appendTo('body');
    feedbackWindow.find('button.close').click(() => {
        // Unload the page, so that it doesn't keep running in the background.
        feedbackWindow.find('iframe').attr('src', 'about:blank');
        feedbackWindow.addClass('d-none');
    });

    if (feedbackWindow.draggable) {
        feedbackWindow.draggable({
            handle: '.course-feedback-window-header',
            cancel: '.course-feedback-window-button',
            containment: 'window',
            // The iframe would swallow the mouse events while dragging over it.
            iframeFix: true
        });
    }

    if (feedbackWindow.resizable) {
        feedbackWindow.resizable({
            handles: 'n, e, s, w, ne, nw, se, sw',
            minWidth: originalFeedbackWindowMinSize.width,
            minHeight: originalFeedbackWindowMinSize.height,
            start() {
                // Like iframeFix of draggable: the iframe would swallow the mouse events.
                feedbackWindow.addClass('course-feedback-window-resizing');
            },
            stop(event, ui) {
                feedbackWindow.removeClass('course-feedback-window-resizing');
                originalFeedbackWindowSize = {
                    width: ui.size.width,
                    height: ui.size.height
                };
                fitOriginalFeedbackWindow(false);
            }
        });
        // A grip in the bottom corner at the end of the reading direction.
        feedbackWindow
            .find(CheeseI18n.isRTL() ? '.ui-resizable-sw' : '.ui-resizable-se')
            .addClass('course-feedback-window-grip');
    }

    // Keep it inside the screen when its size changes, such as when a phone is rotated.
    // jQuery UI's resize events of the window bubble up to the browser window too, and
    // only the browser's own resize is the screen size changing.
    $(window).on('resize', event => {
        if (event.target === window && !feedbackWindow.hasClass('d-none')) {
            fitOriginalFeedbackWindow(false);
        }
    });

    return feedbackWindow;
}

// The default size of the floating window: 60% of the screen's width and 85% of its height,
// or all of the screen but the margins on phones, and at least the minimum size where the
// screen allows.
export function getOriginalFeedbackWindowDefaultSize(screenWidth: number, screenHeight: number, margin: number) {
    const phone = screenWidth < 576;
    const width = screenWidth * (phone ? 1 : 0.6);
    const height = screenHeight * (phone ? 1 : 0.85);

    const grow = Math.max(
        1,
        originalFeedbackWindowMinSize.width / width,
        originalFeedbackWindowMinSize.height / height
    );
    const shrink = Math.min(
        1,
        (screenWidth - 2 * margin) / (width * grow),
        (screenHeight - 2 * margin) / (height * grow)
    );
    return { width: width * grow * shrink, height: height * grow * shrink };
}

// Sizes the floating window to the size it was resized to, or the default size, shrunk to
// fit the visible part of the screen, and centers it, or with center false, moves it back
// inside the screen if needed. innerWidth and innerHeight are the visible size, also on
// phones, where 100vh can be taller than what's shown.
function fitOriginalFeedbackWindow(center: boolean): void {
    // It's only fitted once shown.
    const feedbackWindow = originalFeedbackWindow;
    if (!feedbackWindow) {
        return;
    }
    const screenWidth = window.innerWidth || document.documentElement.clientWidth;
    const screenHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = screenWidth < 576 ? 8 : 16;
    const size = originalFeedbackWindowSize || getOriginalFeedbackWindowDefaultSize(screenWidth, screenHeight, margin);
    const width = Math.round(Math.max(0, Math.min(size.width, screenWidth - 2 * margin)));
    const height = Math.round(Math.max(0, Math.min(size.height, screenHeight - 2 * margin)));

    if (feedbackWindow.resizable && feedbackWindow.hasClass('ui-resizable')) {
        feedbackWindow.resizable('option', {
            maxWidth: Math.max(originalFeedbackWindowMinSize.width, screenWidth - 2 * margin),
            maxHeight: Math.max(originalFeedbackWindowMinSize.height, screenHeight - 2 * margin)
        });
    }

    let left: number;
    let top: number;
    if (center) {
        left = (screenWidth - width) / 2;
        top = (screenHeight - height) / 2;
    } else {
        const position = feedbackWindow.position();
        left = Math.min(Math.max(margin, position.left), screenWidth - width - margin);
        top = Math.min(Math.max(margin, position.top), screenHeight - height - margin);
    }

    feedbackWindow.css({
        width,
        height,
        left: Math.round(Math.max(0, left)),
        top: Math.round(Math.max(0, top))
    });
}
