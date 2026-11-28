import { render } from '../../lib/template.js';
import histogramsTemplate from './templates/histograms.html';
import noHistogramsTemplate from './templates/no-histograms.html';
import shareGuideTemplate from './templates/share-guide.html';

// The histograms of a course, from https://github.com/michael-maltsev/technion-histograms: by
// semester, the statistics of each exam (as text) and the course's staff.
type HistogramCategory = 'Exam_A' | 'Final_A' | 'Exam_B' | 'Final_B' | 'Exam_C' | 'Final_C' | 'Finals';

interface HistogramCategoryData {
    students: string;
    // "<passed>/<failed>".
    passFail: string;
    passPercent: string;
    min: string;
    max: string;
    average: string;
    median: string;
}

interface StaffPerson {
    name: string;
    title: string;
}

interface HistogramSemesterData extends Partial<Record<HistogramCategory, HistogramCategoryData>> {
    Staff?: StaffPerson[];
}

type HistogramData = Record<string, HistogramSemesterData>;

export interface HistogramBrowserOptions {
    // The Bootstrap grid breakpoint from which the semester and exam selects share a row.
    selectColumnGrid?: string;
    // Whether the guide for sharing histograms opens in a new window rather than in a dialog.
    shareGuideInNewWindow?: boolean;
}

export class HistogramBrowser {
    readonly element: JQuery;
    readonly selectColumnGrid: string | undefined;
    readonly shareGuideInNewWindow: boolean | undefined;

    // The guide for sharing histograms, for share-histograms.html and the share dialog.
    static createShareGuide(): JQuery {
        return createShareGuide();
    }

    constructor(element: JQuery, options: HistogramBrowserOptions) {
        this.element = element;
        this.selectColumnGrid = options.selectColumnGrid;
        this.shareGuideInNewWindow = options.shareGuideInNewWindow;
    }

    loadHistograms(course: string): void {
        const element = this.element;

        element.text(t('histogram.loading'));

        const onError = () => {
            const fallbackUrl = `https://michael-maltsev.github.io/technion-histograms/${course}/`;
            element.text(`${t('histogram.loadFailed')} `);
            const urlElement = $('<a target="_blank" rel="noopener">')
                .prop('href', fallbackUrl)
                .text(t('histogram.here'));
            element.append(urlElement);
            element.append('.');
        };

        const url = `https://michael-maltsev.github.io/technion-histograms/${course}/index.min.json`;

        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.onload = () => {
            let data: HistogramData | null = null;
            if (request.status === 200) {
                try {
                    data = JSON.parse(request.response);
                } catch (e) {
                    // Invalid response.
                }
            } else if (request.status === 404) {
                data = {};
            }

            if (data) {
                renderHistograms(this, course, data);
            } else {
                onError();
            }
        };
        request.onerror = onError;
        request.send();
    }
}

function t(key: string, params?: Record<string, unknown>): string {
    return CheeseI18n.t(key, params);
}

function roundGrade(strGrade: string): string {
    return strGrade.trim().replace(/\.\d+$/, '') || '--';
}

function renderHistograms(histogramBrowser: HistogramBrowser, course: string, data: HistogramData): void {
    const element = histogramBrowser.element;
    const semesters = Object.keys(data);
    if (semesters.length > 0) {
        const semesterSelect = $('<select class="form-control">').attr('aria-label', t('histogram.semester'));

        semesters
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            .forEach((semester, i) => {
                let text = semesterFriendlyName(semester);
                const props: string[] = [];

                const termA = data[semester].Final_A || data[semester].Exam_A;
                if (termA) {
                    props.push(t('histogram.summary.a', { grade: roundGrade(termA.average) }));
                }

                const termB = data[semester].Final_B || data[semester].Exam_B;
                if (termB) {
                    props.push(t('histogram.summary.b', { grade: roundGrade(termB.average) }));
                }

                const final = data[semester].Finals;
                if (final) {
                    props.push(t('histogram.summary.final', { grade: roundGrade(final.average) }));
                }

                const staff = data[semester].Staff;
                if (staff) {
                    let lecturer: string | null = null;
                    staff.forEach(item => {
                        if (!lecturer && item.title === 'מרצה - אחראי מקצוע') {
                            lecturer = item.name;
                        }
                    });

                    if (lecturer) {
                        props.push(lecturer);
                    }
                }

                if (props.length > 0) {
                    text += '\xA0'.repeat(Math.max(2, 16 - text.length));
                    text += props.join('\xA0\xA0');
                }

                semesterSelect.append(
                    $('<option>', {
                        value: semester,
                        text,
                        selected: i === 0
                    })
                );
            });

        const activated = shouldActivateHistogramView();
        const selectColumnGrid = histogramBrowser.selectColumnGrid || 'lg';
        const html = render(histogramsTemplate, {
            activatedClass: activated ? ' histogram-activated' : '',
            grid: selectColumnGrid,
            shareUrl: CheeseI18n.withLocale('share-histograms.html')
        });

        element.html(html).find('.histogram-semesters').empty().append(semesterSelect);

        element.find('.histogram-button-share').click(() => {
            onButtonShare(histogramBrowser);
        });
        element.find('.histogram-button-activate').click(() => {
            onButtonActivate(histogramBrowser);
        });
        element.find('.histogram-button-snooze').click(() => {
            onButtonSnooze(histogramBrowser);
        });

        semesterSelect
            .on('change', function (this: HTMLSelectElement) {
                onSemesterSelect(histogramBrowser, course, this.value, data[this.value]);
            })
            .trigger('change');
    } else {
        const noDataHtml = render(noHistogramsTemplate, {
            shareUrl: CheeseI18n.withLocale('share-histograms.html')
        });
        element.html(noDataHtml);
    }
}

// https://stackoverflow.com/a/32261263
function popupWindow(url: string, title: string, win: Window, w: number, h: number): Window | null {
    const y = win.outerHeight / 2 + win.screenY - h / 2;
    const x = win.outerWidth / 2 + win.screenX - w / 2;
    return win.open(
        url,
        title,
        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}`
    );
}

function createShareGuide(): JQuery {
    const guide = $(
        render(shareGuideTemplate, {
            scriptUrl: CheeseI18n.withLocale('share-histograms.js')
        })
    );
    const scriptLink = document.createElement('a');
    scriptLink.href = CheeseI18n.withLocale('share-histograms.js');
    const code = `avascript:var url=${JSON.stringify(scriptLink.href)};var script=document.createElement('script');script.src=url;document.head.appendChild(script);`;
    guide
        .find('#javascript-code-container')
        .val(code)
        .on('focus', function (this: HTMLTextAreaElement) {
            this.select();
        })
        .on('mouseup', event => {
            // As the textarea's onmouseup="return false;" did, so the selection stays.
            event.preventDefault();
        });
    guide.find('#javascript-code-copy-button').click(function () {
        const button = $(this);
        copyToClipboard(
            code,
            () => {
                const text = button.text();
                button.text(`${text} ✓`).prop('disabled', true);
                setTimeout(() => {
                    button.text(text).prop('disabled', false);
                }, 500);
            },
            () => {
                alert(t('sharing.copyFailed'));
            }
        );
    });
    CheeseI18n.apply(guide[0]);
    return guide;
}

function onButtonShare(histogramBrowser: HistogramBrowser): void {
    gtag('event', 'histogram-button-share');

    if (histogramBrowser.shareGuideInNewWindow) {
        popupWindow(CheeseI18n.withLocale('share-histograms.html'), 'share-histograms.html', window, 800, 600);
        return;
    }

    BootstrapDialog.show({
        title: t('histogram.share'),
        message: createShareGuide(),
        buttons: [
            {
                label: t('histogram.shared'),
                cssClass: 'btn-primary',
                action(dialog) {
                    gtag('event', 'histogram-share-submit');

                    const nextShowDate = new Date();
                    nextShowDate.setDate(nextShowDate.getDate() + 30 * 4);
                    activateAndSetNextShowDate(histogramBrowser, nextShowDate);

                    dialog.close();
                }
            },
            {
                label: t('histogram.close'),
                action(dialog) {
                    dialog.close();
                }
            }
        ]
    });
}

function onButtonActivate(histogramBrowser: HistogramBrowser): void {
    gtag('event', 'histogram-button-claim-activate');
    const nextShowDate = new Date();
    nextShowDate.setDate(nextShowDate.getDate() + 30 * 4);
    activateAndSetNextShowDate(histogramBrowser, nextShowDate);
}

function onButtonSnooze(histogramBrowser: HistogramBrowser): void {
    gtag('event', 'histogram-button-snooze');
    const nextShowDate = new Date();
    nextShowDate.setHours(nextShowDate.getHours() + 1);
    activateAndSetNextShowDate(histogramBrowser, nextShowDate);
}

function shouldActivateHistogramView(): boolean {
    try {
        const nextShowDate = localStorage.getItem('nextHistogramShareMessage');
        return !!nextShowDate && Date.now() < Number(nextShowDate);
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
        return true;
    }
}

function activateAndSetNextShowDate(histogramBrowser: HistogramBrowser, nextShowDate: Date): void {
    try {
        localStorage.setItem('nextHistogramShareMessage', nextShowDate.valueOf().toString());
    } catch (e) {
        // localStorage is not available in IE/Edge when running from a local file.
    }

    activateHistogramView(histogramBrowser);
}

function activateHistogramView(histogramBrowser: HistogramBrowser): void {
    const element = histogramBrowser.element;
    element.find('.histogram-container').addClass('histogram-activated');
}

function onSemesterSelect(
    histogramBrowser: HistogramBrowser,
    course: string,
    semester: string,
    data: HistogramSemesterData
): void {
    const element = histogramBrowser.element;
    const categories: HistogramCategory[] = ['Exam_A', 'Final_A', 'Exam_B', 'Final_B', 'Exam_C', 'Final_C', 'Finals'];
    const categorySelect = $('<select class="form-control">').attr('aria-label', t('histogram.category'));

    categories.forEach(category => {
        const categoryData = data[category];
        if (!categoryData) {
            return;
        }

        let text = categoryFriendlyName(category);
        text += `: ${roundGrade(categoryData.average)}`;

        categorySelect.append(
            $('<option>', {
                value: category,
                text
            })
        );
    });

    categorySelect.find('option:last').attr('selected', 'selected');

    element.find('.histogram-categories').empty().append(categorySelect);

    categorySelect
        .on('change', function (this: HTMLSelectElement) {
            const category = this.value as HistogramCategory;
            onCategorySelect(histogramBrowser, course, semester, category, data[category] as HistogramCategoryData);
        })
        .trigger('change');

    const staffTable = element.find('.histogram-staff-table');
    if (data.Staff) {
        const staffTableBody = staffTable.find('tbody');
        staffTableBody.html('');

        data.Staff.forEach(staffPerson => {
            const row = $('<tr>')
                .append($('<td>').text(staffPerson.name))
                .append($('<td>').text(staffTitleFriendlyName(staffPerson.title)));
            staffTableBody.append(row);
        });

        staffTable.removeClass('d-none');
    } else {
        staffTable.addClass('d-none');
    }
}

function onCategorySelect(
    histogramBrowser: HistogramBrowser,
    course: string,
    semester: string,
    category: HistogramCategory,
    data: HistogramCategoryData
): void {
    const element = histogramBrowser.element;

    // The values of the table, by the suffix of their cells' class.
    const { passFail: passFailText, ...values } = data;
    const passFail = passFailText.split('/', 2);
    const newData: Record<string, string> = { ...values, pass: passFail[0], fail: passFail[1] || '' };

    Object.keys(newData).forEach(item => {
        const text = newData[item].trim() || '-';
        element.find(`.histogram-data .histogram-value-${item}`).text(text);
    });

    const imageUrl = `https://michael-maltsev.github.io/technion-histograms/${course}/${semester}/${category}.png`;
    element
        .find('.histogram-image-container')
        .empty()
        .append(
            $('<img class="img-fluid histogram-image">')
                .prop('src', imageUrl)
                .attr(
                    'alt',
                    t('histogram.imageAlt', {
                        course,
                        semester: semesterFriendlyName(semester),
                        category: categoryFriendlyName(category)
                    })
                )
        );
    element.find('.histogram-image-note').text(t('histogram.imageNote'));
}

function semesterFriendlyName(semester: string): string {
    const year = parseInt(semester.slice(0, 4), 10);
    const semesterCode = semester.slice(4);

    switch (semesterCode) {
        case '01':
            return t('histogram.semester.winter', { year, nextYear: year + 1 });

        case '02':
            return t('histogram.semester.spring', { year: year + 1 });

        case '03':
            return t('histogram.semester.summer', { year: year + 1 });

        default:
            return semester;
    }
}

function categoryFriendlyName(category: string): string {
    const histogramCategories: Record<string, string> = {
        Exam_A: 'histogram.category.examA',
        Final_A: 'histogram.category.finalA',
        Exam_B: 'histogram.category.examB',
        Final_B: 'histogram.category.finalB',
        Exam_C: 'histogram.category.examC',
        Final_C: 'histogram.category.finalC',
        Finals: 'histogram.category.finals'
    };

    return histogramCategories[category] ? t(histogramCategories[category]) : category;
}

function staffTitleFriendlyName(title: string): string {
    const titles: Record<string, string> = {
        'מרצה - אחראי מקצוע': 'histogram.staff.courseCoordinator',
        מרצה: 'histogram.staff.lecturer',
        מתרגל: 'histogram.staff.teachingAssistant',
        מתרגלת: 'histogram.staff.teachingAssistant',
        'מתרגל - אחראי תרגול': 'histogram.staff.teachingCoordinator'
    };
    return titles[title] ? t(titles[title]) : title;
}

// https://stackoverflow.com/a/30810322
function copyToClipboard(text: string, onSuccess: () => void, onFailure: () => void): void {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }

    navigator.clipboard.writeText(text).then(
        () => {
            onSuccess();
        },
        err => {
            onFailure();
        }
    );

    function fallbackCopyTextToClipboard(text: string): void {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        let successful = false;
        try {
            successful = document.execCommand('copy');
        } catch (err) {
            // We tried...
        }

        document.body.removeChild(textArea);

        if (successful) {
            onSuccess();
        } else {
            onFailure();
        }
    }
}
