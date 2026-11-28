import { whatsNewVersion } from './constants.js';
import { state } from './state.js';
import { render } from '../lib/template.js';
import scansPopupTemplate from './templates/scans-popup.html';
import weeklyPopupTemplate from './templates/weekly-popup.html';

// A feature of the "what's new" popup: its messages' key, and its icon's classes.
interface WhatsNewFeature {
    key: string;
    icon: string;
}

export function showExtraContentOnLoad() {
    // The other popups wait until the "what's new" popup is closed, so they don't show on top of it.
    showWhatsNewPopup(() => showIntro() || showThursdayGraphPopup() || showTechnionScansPopup());
}

// Calls onDone right away if the popup isn't shown, otherwise after it's closed. It's shown
// once for each whatsNewVersion, or always with force, as the user guide button does.
export function showWhatsNewPopup(onDone: () => void, force?: boolean) {
    try {
        const seenVersion = parseInt(String(localStorage.getItem('whatsNewSeenVersion')), 10);
        if (!force && seenVersion >= whatsNewVersion) {
            onDone();
            return;
        }
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    // Each feature has shell.whatsNew.<key>.title, .text (a summary), .steps (lines of the
    // "How to use it" list) and optionally .note.
    const features: WhatsNewFeature[] = [
        { key: 'layers', icon: 'fas fa-layer-group' },
        { key: 'colors', icon: 'fas fa-palette' },
        { key: 'calendar', icon: 'fas fa-calendar-check' },
        { key: 'import', icon: 'fas fa-file-upload' },
        { key: 'language', icon: 'fas fa-globe' },
        { key: 'api', icon: 'fas fa-key' }
    ];

    const t = (feature: WhatsNewFeature, name: string) => CheeseI18n.t(`shell.whatsNew.${feature.key}.${name}`);
    const hasText = (feature: WhatsNewFeature, name: string) => {
        const key = `shell.whatsNew.${feature.key}.${name}`;
        return CheeseI18n.t(key) !== key;
    };
    const featureIcon = (feature: WhatsNewFeature) =>
        $('<span class="whats-new-icon text-warning" aria-hidden="true">').append($('<i>').addClass(feature.icon));

    // The first page introduces the features, and each feature has a page of its own.
    const pages: JQuery[] = [];

    const welcomePage = $('<div class="whats-new-page">');
    welcomePage.append($('<p>').text(CheeseI18n.t('shell.whatsNew.intro')));
    const overview = $('<ul class="list-unstyled mb-2">');
    features.forEach((feature, i) => {
        const item = $('<button type="button" class="whats-new-item">')
            .append(featureIcon(feature))
            .append(
                $('<span class="whats-new-item-text">').append(
                    $('<h6 class="mb-0 font-weight-bold">').text(t(feature, 'title'))
                )
            )
            .click(() => {
                showPage(i + 1);
            });
        overview.append($('<li>').append(item));
    });
    welcomePage.append(overview);
    welcomePage.append($('<p class="small text-muted mb-0">').text(CheeseI18n.t('shell.whatsNew.overviewHint')));
    pages.push(welcomePage);

    features.forEach(feature => {
        const page = $('<div class="whats-new-page">');
        page.append(
            $('<div class="whats-new-page-header">')
                .append(featureIcon(feature))
                .append($('<h5 class="mb-0 font-weight-bold">').text(t(feature, 'title')))
        );
        page.append($('<p>').text(t(feature, 'text')));

        page.append($('<h6 class="font-weight-bold">').text(CheeseI18n.t('shell.whatsNew.howTo')));
        const steps = $('<ol class="whats-new-steps">');
        t(feature, 'steps')
            .split('\n')
            .forEach(step => {
                steps.append($('<li>').text(step));
            });
        page.append(steps);

        if (hasText(feature, 'note')) {
            page.append(
                $('<div class="whats-new-note">')
                    .append($('<strong>').text(`${CheeseI18n.t('shell.whatsNew.note')}: `))
                    .append($('<span>').text(t(feature, 'note')))
            );
        }
        pages.push(page);
    });

    const pagesContainer = $('<div class="whats-new-pages">');
    pages.forEach(page => {
        pagesContainer.append(page);
    });

    const dots = $('<div class="whats-new-dots">');
    pages.forEach((page, i) => {
        dots.append(
            $('<button type="button" class="whats-new-dot">')
                .attr('aria-label', CheeseI18n.t('shell.whatsNew.goToPage', { number: i + 1, count: pages.length }))
                .click(() => {
                    showPage(i);
                })
        );
    });

    const message = $('<div class="whats-new">').append(pagesContainer, dots);

    let dialog: BootstrapDialogInstance | null = null;
    let currentPage = 0;

    function showPage(index: number) {
        currentPage = Math.max(0, Math.min(index, pages.length - 1));
        pages.forEach((page, i) => {
            page.toggleClass('d-none', i !== currentPage);
        });
        dots.children().each(function (i) {
            $(this)
                .toggleClass('active', i === currentPage)
                .attr('aria-current', i === currentPage ? 'step' : null);
        });
        pagesContainer.scrollTop(0);

        if (dialog) {
            const last = currentPage === pages.length - 1;
            dialog.getButton('whats-new-previous').toggleClass('d-none', currentPage === 0);
            dialog.getButton('whats-new-skip').toggleClass('d-none', last);
            dialog.getButton('whats-new-next').text(CheeseI18n.t(last ? 'shell.tour.done' : 'shell.tour.next'));
        }

        if (currentPage > 0) {
            gtag('event', `whats-new-page-${features[currentPage - 1].key}`);
        }
    }

    showPage(0);

    gtag('event', 'whats-new-show');

    dialog = BootstrapDialog.show({
        title: CheeseI18n.t('shell.whatsNew.title'),
        message,
        cssClass: 'whats-new-dialog',
        buttons: [
            {
                id: 'whats-new-skip',
                label: CheeseI18n.t('shell.tour.skip'),
                cssClass: 'btn-link whats-new-skip',
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            },
            {
                id: 'whats-new-previous',
                label: CheeseI18n.t('shell.tour.previous'),
                cssClass: 'btn-secondary',
                action() {
                    showPage(currentPage - 1);
                }
            },
            {
                id: 'whats-new-next',
                label: CheeseI18n.t('shell.tour.next'),
                cssClass: 'btn-primary',
                action(dialog: BootstrapDialogInstance) {
                    if (currentPage === pages.length - 1) {
                        dialog.close();
                    } else {
                        showPage(currentPage + 1);
                    }
                }
            }
        ],
        onhide() {
            try {
                localStorage.setItem('whatsNewSeenVersion', whatsNewVersion.toString());
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        },
        onhidden() {
            onDone();
        }
    });

    // The arrow keys turn the pages, in the reading direction of the language.
    dialog.getModal().on('keydown', event => {
        if ($(event.target).is('input, textarea, select')) {
            return;
        }
        const forward = CheeseI18n.isRTL() ? 'ArrowLeft' : 'ArrowRight';
        const backward = CheeseI18n.isRTL() ? 'ArrowRight' : 'ArrowLeft';
        if (event.key === forward || event.key === backward) {
            event.preventDefault();
            showPage(currentPage + (event.key === forward ? 1 : -1));
        }
    });

    showPage(0);
}

export function showIntro() {
    try {
        const dontShowDate = localStorage.getItem('dontShowIntro');
        if (dontShowDate) {
            return false;
        }
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    if (state.courseButtonList.getCourseNumbers(true).length > 0) {
        try {
            localStorage.setItem('dontShowIntro', Date.now().toString());
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }
        return false;
    }

    introJs()
        .setOptions({
            nextLabel: CheeseI18n.t('shell.tour.next'),
            prevLabel: CheeseI18n.t('shell.tour.previous'),
            skipLabel: CheeseI18n.t('shell.tour.skip'),
            doneLabel: CheeseI18n.t('shell.tour.done'),
            disableInteraction: true,
            exitOnOverlayClick: false,
            showStepNumbers: false,
            scrollToElement: false,
            helperElementPadding: 0
        })
        .onexit(() => {
            try {
                localStorage.setItem('dontShowIntro', Date.now().toString());
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        })
        .start();

    return true;
}

export function showThursdayGraphPopup() {
    if (new Date() < new Date('2019-05-09T08:00:00')) {
        // Don't show before the first graph is available.
        return false;
    }

    try {
        const nextShowDate = localStorage.getItem('nextShowThursdayGraphPopup');
        if (nextShowDate && Date.now() < Number(nextShowDate)) {
            return false;
        }
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    BootstrapDialog.show({
        title: CheeseI18n.t('shell.weekly.title'),
        message: render(weeklyPopupTemplate),
        onshown(dialog: BootstrapDialogInstance) {
            const modalBody = dialog.getModalBody();
            const width = Math.floor(modalBody.width() as number);
            const height = 400;
            const frameSrc = `https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fcheesefork.technion%2F&tabs=timeline&width=${width}&height=${height}&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true&appId=863730240682785`;
            const frameElem = $(
                '<iframe scrolling="no" frameborder="0" allowTransparency="true" allow="encrypted-media">'
            )
                .attr({ src: frameSrc, title: CheeseI18n.t('shell.weekly.frameTitle') })
                .width(width)
                .height(height);
            modalBody.find('.facebook-iframe-container').empty().append(frameElem);
        },
        buttons: [
            {
                label: CheeseI18n.t('shell.dialog.close'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            }
        ],
        onhide(dialog: BootstrapDialogInstance) {
            const nextShowDate = new Date();

            if ((document.getElementById('dont-show-thursday-graph-popup') as HTMLInputElement).checked) {
                gtag('event', 'thursday-graph-dont-show');
                nextShowDate.setFullYear(nextShowDate.getFullYear() + 1);
            } else {
                // Advance to the next Thursday 08:00.
                if (nextShowDate.getHours() >= 8) {
                    nextShowDate.setDate(nextShowDate.getDate() + 1);
                }
                nextShowDate.setHours(8, 0, 0, 0);
                while (nextShowDate.getDay() !== 4) {
                    nextShowDate.setDate(nextShowDate.getDate() + 1);
                }
            }

            try {
                localStorage.setItem('nextShowThursdayGraphPopup', nextShowDate.valueOf().toString());
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }
    });

    return true;
}

export function showTechnionScansPopup() {
    const inSemesterPeriod = Object.keys(availableSemesters).some(semester => {
        const now = Date.now();
        const item = availableSemesters[semester];
        const startDate = new Date(item.start);
        const endDate = new Date(item.end);
        // Subtract several days from end date for an early notification.
        endDate.setDate(endDate.getDate() - 7);
        return now >= startDate.getTime() && now <= endDate.getTime();
    });
    if (inSemesterPeriod) {
        return false;
    }

    try {
        const dontShowDate = localStorage.getItem('dontShowTechnionScansPopup');
        if (dontShowDate) {
            const days = (Date.now() - parseInt(dontShowDate, 10)) / (24 * 3600 * 1000);
            if (days <= 30) {
                return false;
            }
        }
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    BootstrapDialog.show({
        title: CheeseI18n.t('shell.scans.title'),
        message: render(scansPopupTemplate),
        buttons: [
            {
                label: CheeseI18n.t('shell.scans.open'),
                cssClass: 'btn-primary',
                action(dialog: BootstrapDialogInstance) {
                    gtag('event', 'scans-click-button');

                    const win = window.open('https://scans.cheesefork.cf/', '_blank', 'noopener');
                    if (win) {
                        win.focus();
                    }
                }
            },
            {
                label: CheeseI18n.t('shell.dialog.close'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            }
        ],
        onhide(dialog: BootstrapDialogInstance) {
            if ((document.getElementById('dont-show-technion-scans-popup') as HTMLInputElement).checked) {
                gtag('event', 'scans-dont-show');

                try {
                    localStorage.setItem('dontShowTechnionScansPopup', Date.now().toString());
                } catch (e) {
                    // localStorage is not available in IE/Edge when running from a local file.
                }
            }
        }
    });

    return true;
}
