// The types of the course calendar, shared by its modules.

import type { Moment } from 'moment';
import type { CourseManager, Lesson } from '../../lib/course-manager.js';
import type { ColorGenerator, CustomEventData, SelectedLessons } from '../../lib/schedule-types.js';

// An event of the calendar: a lesson of a course, or a custom event (with the id
// custom_event_<id>, and no course).
export interface ScheduleEvent extends FullCalendarEvent {
    id: string;
    title: string;
    className: string;
    // Every event of the calendar has an end.
    end: Moment;
    courseNumber: string | null;
    layerId: string;
    lessonData: Lesson | null;
    // A lesson is selected once chosen; custom events always are.
    selected: boolean;
    // Shown while previewing a course, and removed when the preview ends.
    temporary: boolean;
    // Set on the lessons of a lesson type that the user hid.
    lessonTypeHidden?: boolean;
    constraint?: { start: string; end: string };
}

export interface LessonEvent extends ScheduleEvent {
    courseNumber: string;
    lessonData: Lesson;
}

export function isLessonEvent(event: ScheduleEvent): event is LessonEvent {
    return event.courseNumber !== null && event.lessonData !== null;
}

// A layer of a saved schedule: its courses' selected lessons and its custom events.
export interface LayerSchedule {
    id: string;
    schedule: Record<string, SelectedLessons>;
    customEvents: Record<string, CustomEventData>;
}

export interface CourseCalendarOptions {
    courseManager: CourseManager;
    colorGenerator: ColorGenerator;
    textColorGenerator?: ColorGenerator;
    readonly?: boolean;
    onCourseHoverIn: (course: string, layerId: string) => void;
    onCourseHoverOut: (course: string, layerId: string) => void;
    onCourseConflictedStatusChanged: (course: string, conflicted: boolean, layerId: string) => void;
    // The lesson types of the course whose lessons are all hidden.
    onLessonTypesHidden: (course: string, lessonTypesHidden: string[], layerId: string) => void;
    // The lesson number is '-' when the user hid all the lessons of the type.
    onLessonSelected: (course: string, lessonNumber: number | '-', lessonType: string, layerId: string) => void;
    onLessonUnselected: (course: string, lessonNumber: number, lessonType: string, layerId: string) => void;
    onCustomEventAdded: (eventId: number, eventData: CustomEventData, layerId: string) => void;
    onCustomEventUpdated: (eventId: string, eventData: CustomEventData, layerId: string) => void;
    onCustomEventRemoved: (eventId: string, layerId: string) => void;
    // For a course, or for a custom event by its full event id.
    onColorPickerClick: (course: string | null, customEventId?: string | null, layerId?: string) => void;
    // The layer of the custom events that the user adds.
    getActiveLayerId?: () => string;
}
