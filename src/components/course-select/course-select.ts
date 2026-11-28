import type { Moment } from 'moment';
import type { CourseFilters } from '../../lib/course-filter.js';
import type { CourseManager } from '../../lib/course-manager.js';
import { showBootstrapDialogWithModelessButton } from '../../lib/modeless-dialog.js';
import filterIconTemplate from './templates/filter-icon.html';
import tooltipTemplate from './templates/tooltip.html';

// An option of the course selection. The option 'partial' says that the list is cut short.
interface CourseOption {
    value: string;
    text: string;
    catalogName?: string;
    oldCourseNumber?: string;
}

type CourseSelectize = Selectize.IApi<string, CourseOption>;

export interface CourseSelectOptions {
    courseManager: CourseManager;
    onItemAdd: (course: string) => void;
    onDropdownItemActivate: (course: string) => void;
    onDropdownItemDeactivate: (course: string) => void;
    // The courses of the schedule, for the filters that depend on them.
    getSelectedCoursesForFilter: () => string[];
}

// The days of an exam session in the catalog, and the years of its exams outside the session.
interface ExamDays {
    minDay?: Moment;
    maxDay?: Moment;
    anomalyYears?: Record<number, true>;
}

// The course selection, with the filters of the courses that can be selected.
export class CourseSelect {
    readonly element: JQuery;
    private readonly courseManager: CourseManager;
    private readonly onItemAdd: (course: string) => void;
    private readonly onDropdownItemActivate: (course: string) => void;
    private readonly onDropdownItemDeactivate: (course: string) => void;
    private readonly getSelectedCoursesForFilter: () => string[];
    readonly allCoursesCount: number;
    filteredCoursesCount: number;
    private filterDialog: BootstrapDialogInstance | null;
    private readonly courseSelect: CourseSelectize;

    constructor(element: JQuery, options: CourseSelectOptions) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.onItemAdd = options.onItemAdd;
        this.onDropdownItemActivate = options.onDropdownItemActivate;
        this.onDropdownItemDeactivate = options.onDropdownItemDeactivate;
        this.getSelectedCoursesForFilter = options.getSelectedCoursesForFilter;

        const that = this;

        const courses = that.courseManager.getAllCourses();
        this.allCoursesCount = courses.length;
        this.filteredCoursesCount = courses.length;

        this.filterDialog = null;

        this.courseSelect = element
            .addClass('course-select')
            .selectize({
                //searchConjunction: 'or',
                options: makeCourseSelectOptions(courses.sort(), that.courseManager),
                maxOptions: 201,
                render: {
                    option(item: CourseOption) {
                        if (item.value === 'partial') {
                            return $('<div>')
                                .addClass('option font-italic')
                                .text(CheeseI18n.t('courses.partialList'))
                                .get(0);
                        }

                        const course = item.value;
                        const general = that.courseManager.getGeneralInfo(course);

                        const courseDescriptionHtml = that.courseManager.getDescription(course, { html: true });

                        const courseNumber = $('<abbr>')
                            .text(general['מספר מקצוע'])
                            .prop('title', courseDescriptionHtml)
                            .attr({
                                'data-toggle': 'tooltip',
                                'data-html': 'true',
                                'data-placement': 'right',
                                'data-template': tooltipTemplate.trim(),
                                'data-boundary': 'viewport'
                            });

                        const courseName = that.courseManager.getCourseName(course);
                        return $('<div>')
                            .addClass('option source-content')
                            .attr({ lang: /[א-ת]/.test(courseName) ? 'he' : 'en', dir: 'auto' })
                            .append(courseNumber)
                            .append(document.createTextNode(` – ${courseName}`))
                            .get(0);
                    }
                },
                onInitialize(this: CourseSelectize) {
                    addFilterButton(that, this);
                },
                onClear(this: CourseSelectize) {
                    addFilterButton(that, this);
                },
                onItemAdd(this: CourseSelectize, course: string) {
                    if (course === 'partial') {
                        // Do nothing
                    } else {
                        that.onItemAdd(course);
                    }
                    this.clear();
                },
                onDropdownItemActivate(course: string) {
                    if (course === 'partial') {
                        return;
                    }

                    that.onDropdownItemActivate(course);
                },
                onDropdownItemDeactivate(course: string) {
                    if (course === 'partial') {
                        return;
                    }

                    that.onDropdownItemDeactivate(course);
                },
                searchField: ['text', 'catalogName', 'oldCourseNumber']
                // selectize renders elements too, which its published types don't allow.
            } as unknown as Selectize.IOptions<string, CourseOption>)
            .data('selectize') as CourseSelectize;

        // The course number and the description tooltip shown for it, if any.
        let optionTooltip: { element: HTMLElement; tip: HTMLElement } | null = null;

        that.courseSelect.$dropdown
            .tooltip({ selector: '[data-toggle=tooltip]' })
            .on('inserted.bs.tooltip', '[data-toggle=tooltip]', function (this: HTMLElement) {
                optionTooltip = {
                    element: this,
                    tip: $(this).data('bs.tooltip').getTipElement()
                };
            })
            .on('mousedown click', '[data-toggle=tooltip]', function () {
                $(this).tooltip('hide');
            });

        // Typing re-renders the options, and closing hides them, without a
        // mouseleave on the hovered course number, which would leave its
        // tooltip floating over the page. Dispose of it rather than hiding it,
        // since a hidden tooltip still counts as hovered and wouldn't show on
        // the next hover. Remove the tip directly as well, since re-rendering
        // clears the jQuery data of the removed options, and with it the
        // tooltip instance that dispose needs.
        const disposeOptionTooltip = () => {
            if (optionTooltip) {
                $(optionTooltip.element).tooltip('dispose').removeAttr('aria-describedby');
                $(optionTooltip.tip).remove();
                optionTooltip = null;
            }
        };
        that.courseSelect.on('type', disposeOptionTooltip);
        that.courseSelect.on('dropdown_close', disposeOptionTooltip);

        filterInit(that.courseManager);
    }

    filterOpen(): void {
        const that = this;

        if (that.filterDialog) {
            that.filterDialog.getModalHeader().trigger('click');
            return;
        }

        gtag('event', 'course-select-filter-open');

        const filterForm = $('#filter-form');
        const filterFormParent = filterForm.parent();
        let filterFormOnSubmit: ((event: JQuery.SubmitEvent) => void) | undefined;

        showBootstrapDialogWithModelessButton('course-filter', {
            cssClass: 'course-filter-dialog',
            title: CheeseI18n.t('filters.title'),
            message: filterForm,
            buttons: [
                {
                    label: CheeseI18n.t('filters.apply'),
                    cssClass: 'btn-primary',
                    action(dialog) {
                        gtag('event', 'course-select-filter-submit');

                        that.filterApply();
                    }
                },
                {
                    label: CheeseI18n.t('filters.reset'),
                    action(dialog) {
                        gtag('event', 'course-select-filter-reset');

                        that.filterReset();
                    }
                },
                {
                    label: CheeseI18n.t('filters.close'),
                    action(dialog) {
                        dialog.close();
                    }
                }
            ],
            onshow(dialog) {
                $('<span>', {
                    id: 'filter-result',
                    class: 'bootstrap-dialog-message',
                    css: {
                        'margin-bottom': '.25rem'
                    }
                })
                    .css(CheeseI18n.isRTL() ? 'margin-left' : 'margin-right', 'auto')
                    .prependTo(dialog.getModalFooter());

                filterFormOnSubmit = (event: JQuery.SubmitEvent) => {
                    event.preventDefault();
                    dialog.getModalFooter().find('button.btn-primary').click();
                };
                filterForm.submit(filterFormOnSubmit);

                that.filterDialog = dialog;
            },
            onhidden(dialog) {
                // Put it back for reuse.
                if (filterFormOnSubmit) {
                    filterForm.off('submit', filterFormOnSubmit);
                }
                filterFormParent.empty().append(filterForm);

                that.filterDialog = null;
            }
        });
    }

    filterApply(): void {
        const that = this;

        const filters: CourseFilters = {};
        const selectize = (selector: string): Selectize.IApi<string, unknown> => $(selector).data('selectize');
        const value = (selector: string): string => String($(selector).val());
        // The course numbers in a text box, in the format of the semester.
        const courseNumbers = (selector: string): string[] | null => {
            const numbers = value(selector).match(/\d+/g);
            return (
                numbers &&
                numbers
                    .map(num => that.courseManager.stringToCourseNumber(num))
                    .filter((course): course is string => !!course)
                    .map(course => that.courseManager.toSemesterFormatCourseNumber(course))
            );
        };

        const faculties = selectize('#filter-faculty').items;
        if (faculties.length > 0) {
            filters.faculties = faculties;
        }

        const frameworks = selectize('#filter-framework').items;
        if (frameworks.length > 0) {
            filters.frameworks = frameworks;
        }

        const selectPointsMin = $('#filter-points-min');
        // If not first which is already the minimum.
        if (selectPointsMin.prop('selectedIndex') > 0) {
            filters.pointsMin = parseFloat(String(selectPointsMin.val()));
        }

        const selectPointsMax = $('#filter-points-max');
        // If not last which is already the maximum.
        if (selectPointsMax.prop('selectedIndex') < selectPointsMax.find('option').length - 1) {
            filters.pointsMax = parseFloat(String(selectPointsMax.val()));
        }

        const coursesTaken = courseNumbers('#filter-courses-taken-list');
        if (coursesTaken) {
            filters.coursesTaken = coursesTaken;
        }

        filters.filterPrerequisites = $('#filter-prerequisites').prop('checked');
        filters.filterLinkedCourses = $('#filter-linked-courses').prop('checked');
        filters.filterOverlappingCourses = $('#filter-overlapping-courses').prop('checked');

        const selectMoedAMin = $('#filter-moed-a-min');
        if (selectMoedAMin.prop('selectedIndex') > 0) {
            filters.moedAMin = String(selectMoedAMin.val());
        }

        const selectMoedAMax = $('#filter-moed-a-max');
        if (selectMoedAMax.prop('selectedIndex') < selectMoedAMax.find('option').length - 1) {
            filters.moedAMax = String(selectMoedAMax.val());
        }

        const selectMoedBMin = $('#filter-moed-b-min');
        if (selectMoedBMin.prop('selectedIndex') > 0) {
            filters.moedBMin = String(selectMoedBMin.val());
        }

        const selectMoedBMax = $('#filter-moed-b-max');
        if (selectMoedBMax.prop('selectedIndex') < selectMoedBMax.find('option').length - 1) {
            filters.moedBMax = String(selectMoedBMax.val());
        }

        filters.moedADaysMin = parseInt(value('#filter-moed-a-days-min'), 10);
        filters.moedBDaysMin = parseInt(value('#filter-moed-b-days-min'), 10);

        filters.filterWithExam = $('#filter-with-exam').prop('checked');
        filters.filterWithoutExam = $('#filter-without-exam').prop('checked');

        const coursesLimit = courseNumbers('#filter-courses-limit');
        if (coursesLimit) {
            filters.coursesLimit = coursesLimit;
        }

        const coursesExclude = courseNumbers('#filter-courses-exclude');
        if (coursesExclude) {
            filters.coursesExclude = coursesExclude;
        }

        const selectedCourses = that.getSelectedCoursesForFilter();
        if (selectedCourses.length > 0) {
            filters.coursesCurrent = selectedCourses;
        }

        const filtered = that.courseManager.filterCourses(filters);
        this.filteredCoursesCount = filtered.length;

        that.courseSelect.clearOptions();
        that.courseSelect.addOption(makeCourseSelectOptions(filtered.sort(), that.courseManager));

        if (that.filterDialog) {
            const messageElement = that.filterDialog.getModalFooter().find('#filter-result');
            messageElement.text(
                CheeseI18n.t('filters.result', { count: that.filteredCoursesCount, total: that.allCoursesCount })
            );
        }

        updateFilterButton(that, that.courseSelect);
    }

    filterReset(): void {
        const that = this;

        $('#filter-form').trigger('reset');
        ($('#filter-faculty').data('selectize') as Selectize.IApi<string, unknown>).clear(); // selectize doesn't work with reset
        ($('#filter-framework').data('selectize') as Selectize.IApi<string, unknown>).clear(); // selectize doesn't work with reset

        if (that.filteredCoursesCount < that.allCoursesCount) {
            that.courseSelect.clearOptions();
            that.courseSelect.addOption(
                makeCourseSelectOptions(that.courseManager.getAllCourses().sort(), that.courseManager)
            );
            that.filteredCoursesCount = that.allCoursesCount;
        }

        if (that.filterDialog) {
            const messageElement = that.filterDialog.getModalFooter().find('#filter-result');
            messageElement.text('');
        }

        updateFilterButton(that, that.courseSelect);
    }
}

function addFilterButton(courseSelect: CourseSelect, selectize: CourseSelectize): void {
    let title = CheeseI18n.t('filters.advancedTip');
    let extraClass = '';
    if (courseSelect.filteredCoursesCount < courseSelect.allCoursesCount) {
        title += ` (${courseSelect.filteredCoursesCount}/${courseSelect.allCoursesCount})`;
        extraClass += ' course-select-filter-on';
    }

    selectize.$control.append(
        $('<button>', {
            type: 'button',
            class: `btn course-select-filter-button${extraClass}`,
            html: filterIconTemplate.trim(),
            title,
            'data-toggle': 'tooltip',
            'data-placement': 'bottom'
        })
            .tooltip()
            .click(function (this: HTMLElement, e) {
                e.stopPropagation();
                $(this).tooltip('hide');
                courseSelect.filterOpen();
            })
            .mousedown(e => {
                e.stopPropagation();
            })
            .mouseup(e => {
                e.stopPropagation();
            })
    );
}

function updateFilterButton(courseSelect: CourseSelect, selectize: CourseSelectize): void {
    const button = selectize.$control.find('button.course-select-filter-button');

    let title = CheeseI18n.t('filters.advancedTip');
    if (courseSelect.filteredCoursesCount < courseSelect.allCoursesCount) {
        title += ` (${courseSelect.filteredCoursesCount}/${courseSelect.allCoursesCount})`;
        button.addClass('course-select-filter-on');
    } else {
        button.removeClass('course-select-filter-on');
    }

    button.attr('data-original-title', title);
}

function makeCourseSelectOptions(courses: string[], courseManager: CourseManager): CourseOption[] {
    const items = courses.map((course): CourseOption => {
        const general = courseManager.getGeneralInfo(course);
        return {
            value: course,
            text: `${course} – ${courseManager.getCourseName(course)}`,
            // With an English name shown, the Hebrew one can be searched too.
            catalogName: general['שם מקצוע'],
            oldCourseNumber: courseManager.toOldCourseNumber(course)
        };
    });

    if (items.length > 201) {
        items.splice(200, 0, {
            value: 'partial',
            text: ''
        });
    }

    return items;
}

function filterInit(courseManager: CourseManager): void {
    const facultySet: Record<string, true> = {};
    const frameworkSet: Record<string, true> = {};
    const pointSet: Record<string, true> = {};
    const examDates: Record<string, ExamDays> = {
        'מועד א': {},
        'מועד ב': {}
    };

    const currentExamsYear = parseInt(currentSemester.slice(0, 4), 10) + 1;

    courseManager.getAllCourses().forEach(course => {
        const general = courseManager.getGeneralInfo(course);

        if (general['פקולטה']) {
            facultySet[general['פקולטה']] = true;
        }

        if (general['מסגרת לימודים']) {
            general['מסגרת לימודים'].split('\n').forEach(item => {
                frameworkSet[item] = true;
            });
        }

        if (general['נקודות']) {
            pointSet[general['נקודות']] = true;
        }

        ['מועד א', 'מועד ב'].forEach(exam => {
            if (general[exam]) {
                const dateTime = courseManager.parseExamDateTime(general[exam]);
                if (dateTime) {
                    const day = moment.utc(dateTime.start).set({ hour: 0, minute: 0, second: 0 });
                    const year = day.year();
                    if (year === currentExamsYear) {
                        if (!examDates[exam].minDay || day.isBefore(examDates[exam].minDay)) {
                            examDates[exam].minDay = day;
                        }
                        if (!examDates[exam].maxDay || day.isAfter(examDates[exam].maxDay)) {
                            examDates[exam].maxDay = day;
                        }
                    } else {
                        const anomalyYears = examDates[exam].anomalyYears || {};
                        anomalyYears[year] = true;
                        examDates[exam].anomalyYears = anomalyYears;
                    }
                }
            }
        });
    });

    const faculties = Object.keys(facultySet).sort();

    const selectFaculties = $('#filter-faculty');

    faculties.forEach(faculty => {
        selectFaculties.append(
            $('<option>', {
                value: faculty,
                text: courseManager.getFacultyLabel(faculty)
            })
        );
    });

    selectFaculties.selectize();

    const frameworks = Object.keys(frameworkSet).sort();

    const selectFrameworks = $('#filter-framework');

    frameworks.forEach(framework => {
        selectFrameworks.append(
            $('<option>', {
                value: framework,
                text: courseManager.getFrameworkLabel(framework)
            })
        );
    });

    selectFrameworks.selectize();

    const selectPointsMin = $('#filter-points-min');
    const selectPointsMax = $('#filter-points-max');

    const points = Object.keys(pointSet).sort((a, b) => parseFloat(a) - parseFloat(b));

    points.forEach((point, i) => {
        selectPointsMin.append(
            $('<option>', {
                value: point,
                text: point,
                selected: i === 0
            })
        );
        selectPointsMax.append(
            $('<option>', {
                value: point,
                text: point,
                selected: i === points.length - 1
            })
        );
    });

    [
        ['מועד א', 'moed-a'],
        ['מועד ב', 'moed-b']
    ].forEach(examData => {
        const exam = examData[0];
        const examId = examData[1];
        const anomalyYears = Object.keys(examDates[exam].anomalyYears || {})
            .map(Number)
            .sort((a, b) => a - b);
        const minDay = examDates[exam].minDay;
        const maxDay = examDates[exam].maxDay;

        const selectMoedMin = $(`#filter-${examId}-min`);
        const selectMoedMax = $(`#filter-${examId}-max`);
        const addDate = (date: Moment): void => {
            const dateStrFull = date.format();
            const dateStrShort = date.format('DD/MM');
            selectMoedMin.append(
                $('<option>', {
                    value: dateStrFull,
                    text: dateStrShort
                })
            );
            selectMoedMax.append(
                $('<option>', {
                    value: dateStrFull,
                    text: dateStrShort
                })
            );
        };
        const addYear = (year: number): void => {
            const yearStart = moment.utc([year]).startOf('year');
            const yearEnd = moment.utc([year]).endOf('year');
            selectMoedMin.append(
                $('<option>', {
                    value: yearStart.format(),
                    text: year.toString()
                })
            );
            selectMoedMax.append(
                $('<option>', {
                    value: yearEnd.format(),
                    text: year.toString()
                })
            );
        };

        anomalyYears
            .filter(year => year < currentExamsYear)
            .forEach(year => {
                addYear(year);
            });

        if (minDay && maxDay) {
            for (const date = minDay.clone(); !date.isAfter(maxDay); date.add(1, 'days')) {
                addDate(date);
            }
        }

        anomalyYears
            .filter(year => year > currentExamsYear)
            .forEach(year => {
                addYear(year);
            });

        selectMoedMax.find('option:last').attr('selected', 'selected');
    });
}
