import { getVisibleCourseNumbers } from './layers.js';
import { state } from './state.js';

export function semesterFriendlyName(semester: string) {
    const year = parseInt(semester.slice(0, 4), 10);
    const semesterCode = semester.slice(4);

    switch (semesterCode) {
        case '01':
            return CheeseI18n.t('shell.semester.winter', { year, nextYear: year + 1 });

        case '02':
            return CheeseI18n.t('shell.semester.spring', { year, nextYear: year + 1 });

        case '03':
            return CheeseI18n.t('shell.semester.summer', { year, nextYear: year + 1 });

        default:
            return semester;
    }
}

export function semesterFriendlyNameForFileName(semester: string) {
    const year = parseInt(semester.slice(0, 4), 10);
    const semesterCode = semester.slice(4);

    switch (semesterCode) {
        case '01':
            return `winter-${year}-${year + 1}`;

        case '02':
            return `spring-${year + 1}`;

        case '03':
            return `summer-${year + 1}`;

        default:
            return semester;
    }
}

export function updateGeneralInfoLine() {
    let courses = 0;
    let points = 0;

    getVisibleCourseNumbers().forEach(course => {
        const general = state.courseManager.getGeneralInfo(course);
        courses++;
        points += parseFloat(general['נקודות']);
    });

    const pointsText = points.toFixed(1).replace(/\.0+$/, '');

    let text;
    if (courses > 0) {
        if (courses === 1) {
            text = CheeseI18n.t('shell.summary.oneCourse');
        } else {
            text = CheeseI18n.t('shell.summary.courses', { count: courses });
        }

        text += CheeseI18n.t('shell.summary.separator');
        if (pointsText === '1') {
            text += CheeseI18n.t('shell.summary.oneCredit');
        } else {
            text += CheeseI18n.t('shell.summary.credits', { count: pointsText });
        }
    } else {
        text = CheeseI18n.t('shell.summary.none');
    }

    $('#general-info').text(text);
}
