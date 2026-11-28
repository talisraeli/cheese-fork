// Course numbers of the old six digit format are converted to the current eight digit format.
export function toNewCourseNumber(course: string): string {
    let match = /^9730(\d\d)$/.exec(course);
    if (match) {
        return `970300${match[1]}`;
    }

    match = /^(\d\d\d)(\d\d\d)$/.exec(course);
    if (match) {
        return `0${match[1]}0${match[2]}`;
    }

    return course;
}

// The course number of a string of up to eight digits, else null.
export function stringToCourseNumber(str: string | null): string | null {
    if (!str || !/^[0-9]{1,8}$/.test(str)) {
        return null;
    }

    if (str.length <= 6) {
        return toNewCourseNumber(`00000${str}`.slice(-6));
    } else {
        return `0000000${str}`.slice(-8);
    }
}
