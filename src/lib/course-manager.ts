import { getDescription, type DescriptionOptions } from './course-description.js';
import { filterCourses, type CourseFilters } from './course-filter.js';
import { toNewCourseNumber } from './course-number.js';

// A lesson of a course, as the catalog has it, with Hebrew keys. Workshops, which the catalog has
// only in the course's notes, are added by getSchedule with the type 'sadna'.
export interface Lesson {
    קבוצה: number;
    'מס.': number;
    סוג: string;
    יום: string;
    שעה: string;
    בניין: string;
    חדר: string | number;
    'מרצה/מתרגל': string;
}

// A course of the catalog: its general information, by Hebrew field names, and its lessons.
export interface CatalogCourse {
    general: Record<string, string>;
    schedule: Lesson[];
}

export interface EnglishCourse {
    name?: string;
    syllabus?: string;
    faculty?: string;
    level?: string;
    notes?: string;
    coordinators?: string;
}

export type EnglishCourseField = keyof EnglishCourse;

// The text that SAP has in English, built by ci/english_catalog.py. Staff and buildings are
// keyed by their text in the Hebrew catalog.
export interface EnglishCatalog {
    courses: Record<string, EnglishCourse>;
    staff?: Record<string, string>;
    buildings?: Record<string, string>;
}

// Times of day as 'HH:MM', or dates and times as 'YYYY-MM-DDTHH:MM:SS'.
export interface TimeRange {
    start: string;
    end: string;
}

type Translations = Record<string, string>;

// The value's translation key in keys, translated, or the value as it is.
function translated(keys: Translations, value: string): string {
    return Object.prototype.hasOwnProperty.call(keys, value) ? CheeseI18n.t(keys[value]) : value;
}

// englishCatalog is the text that SAP has in English (see ci/english_catalog.py), given for the
// English interface only. The catalog data itself stays in Hebrew, since it's also used to
// identify lessons and to track catalog changes; the English text is used only for display.
export class CourseManager {
    readonly coursesHashmap: Record<string, CatalogCourse> = {};
    readonly englishCatalog: EnglishCatalog | null;
    private readonly coursesScheduleProcessed: Record<string, boolean> = {};

    constructor(allCourses: CatalogCourse[], englishCatalog?: EnglishCatalog | null) {
        this.englishCatalog = englishCatalog || null;
        allCourses.forEach(item => {
            this.coursesHashmap[item.general['מספר מקצוע']] = item;
        });
    }

    doesExist(course: string): boolean {
        return course in this.coursesHashmap;
    }

    toOldCourseNumber(course: string): string {
        let match = /^970300(\d\d)$/.exec(course);
        if (match) {
            return `9730${match[1]}`;
        }

        if (/^097300\d\d$/.exec(course)) {
            return course;
        }

        match = /^0(\d\d\d)0(\d\d\d)$/.exec(course);
        if (match) {
            return match[1] + match[2];
        }

        return course;
    }

    toNewCourseNumber(course: string): string {
        return toNewCourseNumber(course);
    }

    toSemesterFormatCourseNumber(course: string): string {
        if (currentSemester < '202401') {
            return this.toOldCourseNumber(course);
        } else {
            return this.toNewCourseNumber(course);
        }
    }

    isComputerScienceCourse(course: string): boolean {
        return /^(23\d\d\d\d|023\d\d\d\d\d)$/.test(course);
    }

    stringToCourseNumber(str: string | null | undefined): string | null {
        if (!str || !/^[0-9]{1,8}$/.test(str)) {
            return null;
        }

        if (str.length <= 6) {
            return `00000${str}`.slice(-6);
        } else {
            return `0000000${str}`.slice(-8);
        }
    }

    getAllCourses(): string[] {
        return Object.keys(this.coursesHashmap);
    }

    getCourseData(course: string): CatalogCourse {
        if (!this.coursesScheduleProcessed[course]) {
            this.getSchedule(course);
        }

        return this.coursesHashmap[course];
    }

    getGeneralInfo(course: string): Record<string, string> {
        return this.coursesHashmap[course].general;
    }

    getSchedule(course: string): Lesson[] {
        if (!this.coursesScheduleProcessed[course]) {
            this.coursesHashmap[course].schedule = this.processSchedule(course);
            this.coursesScheduleProcessed[course] = true;
        }

        return this.coursesHashmap[course].schedule;
    }

    // The schedule with the workshops in the course's notes, which the catalog doesn't list.
    private processSchedule(course: string): Lesson[] {
        const general = this.coursesHashmap[course].general;
        let schedule = this.coursesHashmap[course].schedule;

        if (general['הערות']) {
            // Extract workshops from course comments.
            let comment = general['הערות'];

            // Fix common typos.
            // Examples:
            // Semester 201702, course 044198: מתרגלת הסנא
            // Semester 202001, course 044137: סדאות רשות
            comment = comment.replace(/(^|[^א-ת])(ה?ס)(דנ|ד|נ)(א|ה|אות)($|[^א-ת])/g, '$1$2דנ$4$5');

            // Add a newline for a single workshop.
            comment = comment.replace(/^(סדנת רשות:)\s*(ב?ימי|יום)(\s)/gm, '$1\n$2$3');

            const commentLines = comment.split('\n');
            for (let i = 0; i < commentLines.length; i++) {
                let line = commentLines[i];
                if (line.match(/^(\d+\.\s*)?סדנ(ת|ה|א|אות)[: ]/)) {
                    let workshopsTa = '';
                    let match = /(?:\n|^)מתרגל[ית]? ה?סדנ(?:א|ה|אות).*?:\s*([\s\S]*?)\s*(?:=|\n\d+\.|$)/.exec(comment);
                    if (match) {
                        workshopsTa = match[1]
                            .replace(/\s+/g, ' ')
                            .replace(/(\((גם אחראי[תם]?|\d+)\)\s*)+,?/g, ',')
                            .replace(/\s*,\s*/g, '\n')
                            .trim();
                    }

                    const workshops: Lesson[] = [];
                    let workshopId = 101;
                    for (i++; i < commentLines.length; i++) {
                        line = commentLines[i];
                        match =
                            /^ב?(?:ימי|יום) ([א-ת]+)'?,?\s*(\d+)[.:](\d+)-(\d+)[.:](\d+)(?:\s*,\s*(.*?)(?:\s+(\d+))?(?:\s*,\s*(.*?))?)?\.?$/.exec(
                                line
                            );
                        if (!match) {
                            break;
                        }

                        const dayMapping: Record<string, string> = {
                            ראשון: 'ראשון',
                            שני: 'שני',
                            שלישי: 'שלישי',
                            רביעי: 'רביעי',
                            חמישי: 'חמישי',
                            שישי: 'שישי',
                            א: 'ראשון',
                            ב: 'שני',
                            ג: 'שלישי',
                            ד: 'רביעי',
                            ה: 'חמישי',
                            ו: 'שישי'
                        };
                        const day = dayMapping[match[1]];
                        if (!day) {
                            break;
                        }

                        // If the TA name is a number, it's not a TA name but a room number.
                        if (match[6] && !match[7] && match[8] && /^\d+$/.test(match[8])) {
                            match[7] = match[8];
                            match[8] = '';
                        }

                        let building = match[6] || '';
                        switch (building) {
                            case "פ'":
                                building = 'פישבך';
                                break;

                            case "מ'":
                                building = 'מאייר';
                                break;
                        }

                        const startTime = `${match[2]}:${match[3]}`;
                        const endTime = `${match[4]}:${match[5]}`;
                        let time = `${startTime} - ${endTime}`;

                        // Make sure the start time is before the end time.
                        const timeParsed = this.parseLessonTime(time);
                        if (timeParsed && timeParsed.end !== '00:00' && timeParsed.start > timeParsed.end) {
                            time = `${endTime} - ${startTime}`;
                        }

                        workshops.push({
                            קבוצה: workshopId,
                            'מס.': workshopId,
                            סוג: 'sadna',
                            'מרצה/מתרגל': match[8] || workshopsTa,
                            יום: day,
                            שעה: time,
                            בניין: building,
                            חדר: match[7] || ''
                        });
                        workshopId++;
                    }

                    if (workshops.length > 0) {
                        schedule = schedule.concat(workshops);
                    }

                    break;
                }
            }
        }

        return schedule;
    }

    getTitle(course: string): string {
        return `${this.coursesHashmap[course].general['מספר מקצוע']} – ${this.getCourseName(course)}`;
    }

    // A field of a course in the English catalog: name, syllabus, faculty, level, notes or
    // coordinators. Null without an English catalog or if SAP has no English text for it.
    getEnglishText(course: string, field: EnglishCourseField): string | null {
        const courses = this.englishCatalog && this.englishCatalog.courses;
        const text = courses && Object.prototype.hasOwnProperty.call(courses, course) && courses[course][field];
        return typeof text === 'string' && text !== '' ? text : null;
    }

    getCourseName(course: string): string {
        return this.getEnglishText(course, 'name') || this.coursesHashmap[course].general['שם מקצוע'];
    }

    getStaffLabel(name: string): string {
        return englishCatalogLabel(this.englishCatalog, 'staff', name);
    }

    getBuildingLabel(building: string): string {
        return englishCatalogLabel(this.englishCatalog, 'buildings', building);
    }

    getFieldLabel(key: string): string {
        const keys: Translations = {
            'מספר מקצוע': 'courses.fields.number',
            'שם מקצוע': 'courses.fields.name',
            פקולטה: 'courses.fields.faculty',
            'מסגרת לימודים': 'courses.fields.framework',
            נקודות: 'courses.fields.credits',
            סילבוס: 'courses.fields.syllabus',
            'מקצועות קדם': 'courses.fields.prerequisites',
            'מקצועות צמודים': 'courses.fields.corequisites',
            'מקצועות זהים': 'courses.fields.equivalentCourses',
            'מקצועות ללא זיכוי נוסף (מוכלים)': 'courses.fields.noAdditionalCreditIncluded',
            'מקצועות ללא זיכוי נוסף (מכילים)': 'courses.fields.noAdditionalCreditIncluding',
            'מקצועות ללא זיכוי נוסף': 'courses.fields.noAdditionalCredit',
            אחראים: 'courses.fields.coordinators',
            הערות: 'courses.fields.remarks',
            'מרצה/מתרגל': 'courses.fields.staff',
            יום: 'courses.fields.day',
            שעה: 'courses.fields.time',
            בניין: 'courses.fields.building',
            חדר: 'courses.fields.room',
            קבוצה: 'courses.fields.group',
            'מס.': 'courses.fields.lessonNumber',
            סוג: 'courses.fields.lessonType',
            'אתר הקורס': 'courses.fields.website',
            'עבור לסמסטר': 'courses.fields.semester',
            מיקום: 'courses.fields.location',
            'מועד הבחינה': 'courses.fields.examDate',
            הרצאה: 'courses.fields.lectureHours',
            תרגיל: 'courses.fields.tutorialHours',
            מעבדה: 'courses.fields.laboratoryHours',
            'סמינר/פרויקט': 'courses.fields.seminarProjectHours',
            'בוחן מועד א': 'courses.fields.testSession1',
            'בוחן מועד ב': 'courses.fields.testSession2',
            'בוחן מועד ג': 'courses.fields.testSession3',
            'בוחן מועד ד': 'courses.fields.testSession4',
            'בוחן מועד ה': 'courses.fields.testSession5',
            'בוחן מועד ו': 'courses.fields.testSession6',
            'מועד א': 'courses.fields.examSession1',
            'מועד ב': 'courses.fields.examSession2',
            'מועד ג': 'courses.fields.examSession3'
        };
        return translated(keys, key);
    }

    getLessonTypeLabel(value: string): string {
        if (isCatalogLanguage() && value !== 'sadna') {
            return value;
        }
        const keys: Translations = {
            הרצאה: 'courses.lessonTypes.lecture',
            תרגול: 'courses.lessonTypes.tutorial',
            תרגיל: 'courses.lessonTypes.tutorial',
            מעבדה: 'courses.lessonTypes.laboratory',
            סמינר: 'courses.lessonTypes.seminar',
            פרויקט: 'courses.lessonTypes.project',
            'סמינר/פרויקט': 'courses.lessonTypes.seminarProject',
            סדנה: 'courses.lessonTypes.workshop',
            sadna: 'courses.lessonTypes.workshop'
        };
        return translated(keys, value);
    }

    getDayLabel(value: string): string {
        if (isCatalogLanguage()) {
            return value;
        }
        const keys: Translations = {
            ראשון: 'calendar.days.sunday',
            שני: 'calendar.days.monday',
            שלישי: 'calendar.days.tuesday',
            רביעי: 'calendar.days.wednesday',
            חמישי: 'calendar.days.thursday',
            שישי: 'calendar.days.friday',
            שבת: 'calendar.days.saturday',
            א: 'calendar.days.sunday',
            ב: 'calendar.days.monday',
            ג: 'calendar.days.tuesday',
            ד: 'calendar.days.wednesday',
            ה: 'calendar.days.thursday',
            ו: 'calendar.days.friday',
            ש: 'calendar.days.saturday'
        };
        return translated(keys, value);
    }

    getFacultyLabel(value: string): string {
        if (isCatalogLanguage()) {
            return value;
        }
        const keys: Translations = {
            'המחלקה ללימודים הומניסטיים ואמנות': 'courses.faculties.humanities',
            'הנדסה ימית': 'courses.faculties.marineEngineering',
            'הפקולטה לארכיטקטורה ובינוי ערים': 'courses.faculties.architecture',
            'הפקולטה לביולוגיה': 'courses.faculties.biology',
            'הפקולטה להנדסה אזרחית וסביבתית': 'courses.faculties.civilEnvironmental',
            'הפקולטה להנדסה ביו-רפואית': 'courses.faculties.biomedical',
            'הפקולטה להנדסה כימית': 'courses.faculties.chemical',
            'הפקולטה להנדסת אווירונוטיקה וחלל': 'courses.faculties.aerospace',
            'הפקולטה להנדסת ביוטכנולוגיה ומזון': 'courses.faculties.biotechnologyFood',
            'הפקולטה להנדסת חשמל ומחשבים': 'courses.faculties.electricalComputer',
            'הפקולטה להנדסת מכונות': 'courses.faculties.mechanical',
            'הפקולטה לכימיה': 'courses.faculties.chemistry',
            'הפקולטה למדע והנדסה של חומרים': 'courses.faculties.materials',
            'הפקולטה למדעי המחשב': 'courses.faculties.computerScience',
            'הפקולטה למדעי הנתונים וההחלטות': 'courses.faculties.dataDecision',
            'הפקולטה למתמטיקה': 'courses.faculties.mathematics',
            'הפקולטה לפיזיקה': 'courses.faculties.physics',
            'הפקולטה לרפואה': 'courses.faculties.medicine',
            'חינוך למדע וטכנולוגיה': 'courses.faculties.education',
            "מדע יישומי (ג'ייקובס-קורנל)": 'courses.faculties.appliedScience',
            'מערכות אוטונומיות ורובוטיקה': 'courses.faculties.autonomousRobotics',
            'מתמטיקה שימושית': 'courses.faculties.appliedMathematics',
            'ננו-מדעים וננו-טכנולוגיה': 'courses.faculties.nanoscience',
            'תוכנית האנרגיה ע"ש גרנד': 'courses.faculties.energy',
            'הפקולטה להנדסת חשמל': 'courses.faculties.electrical',
            'הפקולטה להנדסת תעשייה וניהול': 'courses.faculties.industrialManagement',
            'הפקולטה להנדסת חומרים': 'courses.faculties.materials',
            'המחלקה לחינוך למדע וטכנולוגיה': 'courses.faculties.education'
        };
        return translated(keys, value);
    }

    getFrameworkLabel(value: string): string {
        if (isCatalogLanguage()) {
            return value;
        }
        const keys: Translations = {
            'לימודי הסמכה': 'courses.frameworks.undergraduate',
            'מקצוע משותף': 'courses.frameworks.shared',
            'תארים מתקדמים': 'courses.frameworks.graduate'
        };
        return translated(keys, value);
    }

    getLessonType(lesson: Lesson): string {
        if (lesson['סוג'] === 'sadna') {
            return 'סדנה';
        }
        return lesson['סוג'];
    }

    getLessonTypeAndNumber(lesson: Lesson): string {
        if (lesson['סוג'] === 'sadna') {
            // No number since that's our addition to the schedule.
            // We assume only one workshop can be selected.
            return this.getLessonTypeLabel('sadna');
        }
        return `${this.getLessonTypeLabel(lesson['סוג'])} ${lesson['מס.']}`;
    }

    parseExamDateTime(strDate: string): TimeRange | null {
        let match = /^(\d+)-(\d+)-(\d+)(?:\s+(\d+)(:\d+)\s*-\s*(\d+)(:\d+))?/.exec(strDate);
        if (!match) {
            match = /^בתאריך (\d+)\.(\d+)\.(\d+) (?:יום [א-ו] משעה (\d+)(:\d+)? עד השעה (\d+)(:\d+)?)?/.exec(strDate);
        }

        if (!match) {
            return null;
        }

        const date = `${match[3]}-${match[2]}-${match[1]}`;

        let startHour = '00';
        if (match[4] !== undefined) {
            startHour = `00${match[4]}`.slice(-2);
        }
        let startMinute = '00';
        if (match[5] !== undefined) {
            startMinute = `${match[5]}00`.slice(1, 3);
        }
        const start = `${date}T${startHour}:${startMinute}:00`;

        let endHour = '00';
        if (match[6] !== undefined) {
            endHour = `00${match[6]}`.slice(-2);
        }
        let endMinute = '00';
        if (match[7] !== undefined) {
            endMinute = `${match[7]}00`.slice(1, 3);
        }
        const end = `${date}T${endHour}:${endMinute}:00`;

        return { start, end };
    }

    parseLessonTime(strTime: string): TimeRange | null {
        const match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(strTime);
        if (!match) {
            return null;
        }

        const startHour = `00${match[1]}`.slice(-2);
        let startMinute = '00';
        if (match[2] !== undefined) {
            startMinute = `${match[2]}00`.slice(1, 3);
        }
        const start = `${startHour}:${startMinute}`;

        const endHour = `00${match[3]}`.slice(-2);
        let endMinute = '00';
        if (match[4] !== undefined) {
            endMinute = `${match[4]}00`.slice(1, 3);
        }
        const end = `${endHour}:${endMinute}`;

        return { start, end };
    }

    getDescription(course: string, options: DescriptionOptions): string {
        return getDescription(this, course, options);
    }

    filterCourses(filters: CourseFilters): string[] {
        return filterCourses(this, filters);
    }
}

// Staff and buildings are keyed by their text in the Hebrew catalog.
function englishCatalogLabel(englishCatalog: EnglishCatalog | null, map: 'staff' | 'buildings', value: string): string {
    const labels = englishCatalog && englishCatalog[map];
    return labels && Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : value;
}

// The catalog is in Hebrew, so its values are translated for the other languages.
export function isCatalogLanguage(): boolean {
    return CheeseI18n.getLocale() === 'he';
}
