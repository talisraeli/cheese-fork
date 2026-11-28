// The schedule as it's saved, in Firestore (a semester document) and in localStorage, for the
// semester shown. See savedSessionFromFirestoreData and functions/lib/schedule.js.

import type { CatalogCourse } from '../lib/course-manager.js';
import type { CustomEventData, SelectedLessons } from '../lib/schedule-types.js';

// A saved layer, by its id: 'default' for the first layer, or 'layer<number>' for the others.
// The first layer keeps its courses and custom events in the keys of a schedule without layers,
// so its entry has neither; savedLayersSanitize makes sure that the other layers have both.
export interface SavedLayer {
    name?: string;
    hidden?: boolean;
    courses: string[];
    customEvents: Record<string, CustomEventData>;
}

// The key of a course's selected lessons: <semester>_<course>, or <semester>_<layer id>_<course>
// for the other layers. Course numbers are digits, so the key ends with a number.
export type LessonsKey = `${string}_${number}`;

export interface SavedSession {
    [key: `${string}_courses`]: string[];
    [key: `${string}_custom_events`]: Record<string, CustomEventData>;
    [key: `${string}_colors`]: Record<string, string>;
    [key: `${string}_layers`]: Record<string, SavedLayer>;
    [key: LessonsKey]: SelectedLessons;
}

// A user's semester document in Firestore: the saved session's keys, and others, such as the
// metadata of the courses and the display name.
export type ScheduleDocument = SavedSession & Record<string, unknown>;

// The catalog data of a course when it was added to the schedule, to tell about changes since.
export type CourseMetadata = CatalogCourse;
