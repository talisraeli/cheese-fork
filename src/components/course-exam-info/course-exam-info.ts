import type { Moment } from 'moment';
import type { CourseManager } from '../../lib/course-manager.js';
import type { ColorGenerator } from '../../lib/schedule-types.js';
import tooltipTemplate from './templates/tooltip.html';

export interface CourseExamInfoOptions {
    courseManager: CourseManager;
    colorGenerator: ColorGenerator;
    textColorGenerator?: ColorGenerator;
    onHoverIn: (course: string) => void;
    onHoverOut: (course: string) => void;
}

// The exams of the selected courses, with the days between them, in the first and second session.
export class CourseExamInfo {
    readonly element: JQuery;
    private readonly courseManager: CourseManager;
    private readonly colorGenerator: ColorGenerator;
    private readonly textColorGenerator: ColorGenerator;
    private readonly onHoverIn: (course: string) => void;
    private readonly onHoverOut: (course: string) => void;

    constructor(element: JQuery, options: CourseExamInfoOptions) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        // The text color for a background color of colorGenerator, same arguments. White by default.
        this.textColorGenerator = options.textColorGenerator || (() => 'white');
        this.onHoverIn = options.onHoverIn;
        this.onHoverOut = options.onHoverOut;
    }

    renderCourses(courses: string[]): void {
        const that = this;

        // Make sure existing tooltips are disposed. Otherwise if there
        // are any visible tooltips, they'll stay hanging forever.
        that.element.find('[data-toggle="tooltip"]').tooltip('dispose');

        const moedASpan = makeExamInfoSpan(1, courses);
        const moedBSpan = makeExamInfoSpan(2, courses);

        if (!moedASpan && !moedBSpan) {
            that.element.empty();
        } else {
            that.element.empty().append($('<div>').text(CheeseI18n.t('exams.studyDays')));

            if (moedASpan) {
                that.element.append(
                    $('<div>').addClass('exam-info-content').text(CheeseI18n.t('exams.sessionA')).append(moedASpan)
                );
            }

            if (moedBSpan) {
                that.element.append(
                    $('<div>').addClass('exam-info-content').text(CheeseI18n.t('exams.sessionB')).append(moedBSpan)
                );
            }
        }

        function makeExamInfoSpan(moed: 1 | 2, courses: string[]): JQuery | false {
            const moedNames = ['מועד א', 'מועד ב'];
            const moedName = moedNames[moed - 1];
            const moedDates: Record<string, Moment> = {};
            const moedAmounts: Record<string, number> = {};

            courses.forEach(course => {
                const general = that.courseManager.getGeneralInfo(course);
                if (general[moedName]) {
                    const parsedDate = that.courseManager.parseExamDateTime(general[moedName]);
                    if (parsedDate) {
                        moedDates[course] = moment.utc(parsedDate.start).locale(CheeseI18n.getLocale());
                    }

                    // For SAP info, each line contains an exam date. Previous data
                    // is less structured.
                    if (currentSemester >= '202401') {
                        const lines = general[moedName].split('\n').filter(line => line.trim() !== '');
                        moedAmounts[course] = lines.length;
                    } else {
                        moedAmounts[course] = 1;
                    }
                }
            });

            const moedCourses = Object.keys(moedDates);
            if (moedCourses.length === 0) {
                return false;
            }

            moedCourses.sort((leftCourse, rightCourse) => {
                const left = moedDates[leftCourse];
                const right = moedDates[rightCourse];
                const diff = left.diff(right);
                return diff !== 0 ? diff : Number(leftCourse) - Number(rightCourse);
            });

            const spanExamList = $('<span>');
            let prevDaysText: JQuery | null = null;

            moedCourses.forEach((course, i) => {
                if (i !== 0) {
                    //spanExamList.append('🢀\u00AD');
                    spanExamList.append($('<span class="exam-info-left-arrow">'), ' ');
                }

                const daysText = $('<span>').addClass(`exam-info-item exam-info-item-course-${course}`);
                const color = that.colorGenerator(course);
                daysText.css({ 'background-color': color, color: that.textColorGenerator(course) });
                daysText.hover(
                    function () {
                        $(this).addClass('exam-info-item-hovered');
                        that.onHoverIn(course);
                    },
                    function () {
                        $(this).removeClass('exam-info-item-hovered');
                        that.onHoverOut(course);
                    }
                );

                const date = moedDates[course].format('DD/MM');
                let dateWithTime = null;
                if (moedDates[course].hour() !== 0) {
                    dateWithTime = moedDates[course].format('DD/MM HH:mm');
                }

                let elementText: string | number;
                let tooltipText: string | null = null;
                if (i === 0) {
                    elementText = date;
                    if (dateWithTime) {
                        tooltipText = dateWithTime;
                    }
                } else {
                    const left = moedDates[moedCourses[i - 1]].clone().set({ hour: 0, minute: 0, second: 0 });
                    const right = moedDates[course].clone().set({ hour: 0, minute: 0, second: 0 });
                    const diff = right.diff(left, 'days');
                    elementText = diff;
                    if (diff === 0) {
                        daysText.addClass('exam-info-item-conflicted');
                        prevDaysText?.addClass('exam-info-item-conflicted');
                    }
                    tooltipText = dateWithTime || date;
                }

                const spanAbsolute = $('<span class="content-absolute">').text(String(elementText));
                const spanBoldHidden = $('<span class="content-bold-hidden">').text(String(elementText));

                daysText.append(spanAbsolute, spanBoldHidden);

                const extraDates = moedAmounts[course] - 1;
                if (extraDates > 0) {
                    daysText.addClass('exam-info-item-has-extra-dates');
                    tooltipText = tooltipText ? `${tooltipText} ` : '';
                    if (extraDates === 1) {
                        tooltipText += CheeseI18n.t('exams.extraDate');
                    } else {
                        tooltipText += CheeseI18n.t('exams.extraDates', { count: extraDates });
                    }
                }

                if (tooltipText) {
                    daysText
                        .prop('title', tooltipText)
                        .attr('data-toggle', 'tooltip')
                        .tooltip({
                            placement: moed === 1 ? 'top' : 'bottom',
                            template: tooltipTemplate.trim()
                        });
                }

                spanExamList.append(daysText);
                prevDaysText = daysText;
            });

            return spanExamList;
        }
    }

    setHovered(course: string): void {
        $(`.exam-info-item-course-${course}`, this.element).addClass('exam-info-item-hovered');
    }

    removeHovered(course: string): void {
        $(`.exam-info-item-course-${course}`, this.element).removeClass('exam-info-item-hovered');
    }

    setHighlighted(course: string): void {
        $(`.exam-info-item-course-${course}`, this.element).addClass('exam-info-item-highlighted');
    }

    removeHighlighted(course: string): void {
        $(`.exam-info-item-course-${course}`, this.element).removeClass('exam-info-item-highlighted');
    }
}
