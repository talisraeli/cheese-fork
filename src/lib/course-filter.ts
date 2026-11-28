import type { Moment } from 'moment';
import type { CourseManager } from './course-manager.js';

// The filters of the course selection, see CourseSelect. Dates are 'YYYY-MM-DD'.
export interface CourseFilters {
    faculties?: string[];
    frameworks?: string[];
    pointsMin?: number;
    pointsMax?: number;
    coursesTaken?: string[];
    coursesCurrent?: string[];
    coursesLimit?: string[];
    coursesExclude?: string[];
    filterPrerequisites?: boolean;
    filterLinkedCourses?: boolean;
    filterOverlappingCourses?: boolean;
    moedAMin?: string;
    moedAMax?: string;
    moedBMin?: string;
    moedBMax?: string;
    // The minimum number of days between exams. NaN or 0 for none.
    moedADaysMin?: number;
    moedBDaysMin?: number;
    filterWithExam?: boolean;
    filterWithoutExam?: boolean;
}

// The courses that match the filters of the course selection, see CourseManager.filterCourses.
export function filterCourses(that: CourseManager, filters: CourseFilters): string[] {
    const filtered: string[] = [];
    let i;

    const moedAMin = filters.moedAMin ? moment.utc(filters.moedAMin).set({ hour: 0, minute: 0, second: 0 }) : null;
    const moedAMax = filters.moedAMax ? moment.utc(filters.moedAMax).set({ hour: 0, minute: 0, second: 0 }) : null;
    const moedBMin = filters.moedBMin ? moment.utc(filters.moedBMin).set({ hour: 0, minute: 0, second: 0 }) : null;
    const moedBMax = filters.moedBMax ? moment.utc(filters.moedBMax).set({ hour: 0, minute: 0, second: 0 }) : null;

    const currentMoedADates: Moment[] = [];
    if (filters.moedADaysMin && filters.coursesCurrent) {
        filters.coursesCurrent.forEach(course => {
            const general = that.coursesHashmap[course].general;
            if (general['מועד א']) {
                const dateTimeA = that.parseExamDateTime(general['מועד א']);
                if (dateTimeA) {
                    const moedA = moment.utc(dateTimeA.start).set({ hour: 0, minute: 0, second: 0 });
                    currentMoedADates.push(moedA);
                }
            }
        });
    }

    const currentMoedBDates: Moment[] = [];
    if (filters.moedBDaysMin && filters.coursesCurrent) {
        filters.coursesCurrent.forEach(course => {
            const general = that.coursesHashmap[course].general;
            if (general['מועד ב']) {
                const dateTimeB = that.parseExamDateTime(general['מועד ב']);
                if (dateTimeB) {
                    const moedB = moment.utc(dateTimeB.start).set({ hour: 0, minute: 0, second: 0 });
                    currentMoedBDates.push(moedB);
                }
            }
        });
    }

    Object.keys(that.coursesHashmap).forEach(course => {
        const general = that.coursesHashmap[course].general;

        if (filters.coursesLimit && !filters.coursesLimit.includes(course)) {
            return;
        }

        if (filters.coursesExclude && filters.coursesExclude.includes(course)) {
            return;
        }

        if (filters.faculties && general['פקולטה'] && !filters.faculties.includes(general['פקולטה'])) {
            return;
        }

        const frameworks = filters.frameworks;
        if (frameworks && general['מסגרת לימודים']) {
            const frameworkMatch = general['מסגרת לימודים'].split('\n').some(item => frameworks.includes(item));
            if (!frameworkMatch) {
                return;
            }
        }

        if (general['נקודות']) {
            const points = parseFloat(general['נקודות']);
            if (filters.pointsMin !== undefined && points < filters.pointsMin) {
                return;
            }
            if (filters.pointsMax !== undefined && points > filters.pointsMax) {
                return;
            }
        }

        if (filters.filterPrerequisites && general['מקצועות קדם']) {
            if (!filters.coursesTaken) {
                return;
            }

            const booleanExpression = general['מקצועות קדם']
                .replace(/\s/g, '')
                .replace(/או/g, ' OR ')
                .replace(/ו-/g, ' AND ');
            if (!new BooleanExpression(booleanExpression).test(filters.coursesTaken)) {
                return;
            }
        }

        if (filters.filterLinkedCourses && general['מקצועות צמודים']) {
            if (!filters.coursesTaken && !filters.coursesCurrent) {
                return;
            }

            const linkedCourses = general['מקצועות צמודים'].match(/\d+/g);
            if (linkedCourses) {
                for (i = 0; i < linkedCourses.length; i++) {
                    if (
                        (filters.coursesTaken && !filters.coursesTaken.includes(linkedCourses[i])) ||
                        (filters.coursesCurrent && !filters.coursesCurrent.includes(linkedCourses[i]))
                    ) {
                        // OK, was taken or taking now.
                    } else {
                        return;
                    }
                }
            }
        }

        if (filters.filterOverlappingCourses && (filters.coursesTaken || filters.coursesCurrent)) {
            // If we've already taken this course, it's kinda trivially overlapping.
            if (filters.coursesTaken && filters.coursesTaken.includes(course)) {
                return;
            }
            if (filters.coursesCurrent && filters.coursesCurrent.includes(course)) {
                return;
            }

            let overlappingCourses: string[] = [];
            const overlappingCoursesKeys = [
                'מקצועות זהים',
                'מקצועות ללא זיכוי נוסף (מוכלים)',
                'מקצועות ללא זיכוי נוסף (מכילים)',
                'מקצועות ללא זיכוי נוסף'
            ];

            overlappingCoursesKeys.forEach(key => {
                if (general[key]) {
                    const overlappingCoursesPart = general[key].match(/\d+/g);
                    if (overlappingCoursesPart) {
                        overlappingCourses = overlappingCourses.concat(overlappingCoursesPart);
                    }
                }
            });

            for (i = 0; i < overlappingCourses.length; i++) {
                if (filters.coursesTaken && filters.coursesTaken.includes(overlappingCourses[i])) {
                    return;
                }
                if (filters.coursesCurrent && filters.coursesCurrent.includes(overlappingCourses[i])) {
                    return;
                }
            }
        }

        if ((moedAMin || moedAMax || filters.moedADaysMin) && general['מועד א']) {
            const dateTimeA = that.parseExamDateTime(general['מועד א']);
            if (dateTimeA) {
                const moedA = moment.utc(dateTimeA.start).set({ hour: 0, minute: 0, second: 0 });
                if ((moedAMin && moedA.isBefore(moedAMin)) || (moedAMax && moedA.isAfter(moedAMax))) {
                    return;
                }

                if (filters.moedADaysMin) {
                    for (i = 0; i < currentMoedADates.length; i++) {
                        if (Math.abs(moedA.diff(currentMoedADates[i], 'days')) < filters.moedADaysMin) {
                            return;
                        }
                    }
                }
            }
        }

        if ((moedBMin || moedBMax || filters.moedBDaysMin) && general['מועד ב']) {
            const dateTimeB = that.parseExamDateTime(general['מועד ב']);
            if (dateTimeB) {
                const moedB = moment.utc(dateTimeB.start).set({ hour: 0, minute: 0, second: 0 });
                if ((moedBMin && moedB.isBefore(moedBMin)) || (moedBMax && moedB.isAfter(moedBMax))) {
                    return;
                }

                if (filters.moedBDaysMin) {
                    for (i = 0; i < currentMoedBDates.length; i++) {
                        if (Math.abs(moedB.diff(currentMoedBDates[i], 'days')) < filters.moedBDaysMin) {
                            return;
                        }
                    }
                }
            }
        }

        if (filters.filterWithExam && (general['מועד א'] || general['מועד ב'])) {
            return;
        }

        if (filters.filterWithoutExam && !general['מועד א'] && !general['מועד ב']) {
            return;
        }

        filtered.push(course);
    });

    return filtered;
}
