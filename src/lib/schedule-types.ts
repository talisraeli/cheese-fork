// Types shared by the app and its components.

// The color of a course's lessons, or of a custom event: the course number or the event's
// title, the custom event's id (for a custom event only), and the course's layer. A CSS color.
export type ColorGenerator = (course: string, customEventId?: string | null, layerId?: string) => string;

// A layer of the schedule. The first layer has the id '' and is what a schedule without layers
// is. Hidden layers aren't shown on the calendar; collapsed ones only fold their list.
export interface Layer {
    id: string;
    name: string;
    hidden?: boolean;
    collapsed?: boolean;
}

// The lessons selected for a course: lesson type key (see CourseCalendar.getLessonTypeKey) to
// lesson number, or '-' for a lesson type whose lessons are all unselected.
export type SelectedLessons = Record<string, number | string>;

// A custom event of the schedule, which recurs weekly. Its times are ISO dates and times in the
// calendar's week of 2017-01-01 (a Sunday) to 2017-01-07, such as '2017-01-02T10:30:00'.
export interface CustomEventData {
    title: string;
    start: string;
    end: string;
}
