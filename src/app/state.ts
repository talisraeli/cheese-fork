import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import type { CourseButtonList } from '../components/course-button-list/course-button-list.js';
import type { CourseCalendar } from '../components/course-calendar/course-calendar.js';
import type { CourseExamInfo } from '../components/course-exam-info/course-exam-info.js';
import type { CourseSelect } from '../components/course-select/course-select.js';
import type { CourseManager } from '../lib/course-manager.js';
import type { Layer } from '../lib/schedule-types.js';
import type { SavedSession } from './session-types.js';

// A change in the catalog: the text of a part of the course's information, before and after.
export interface MetadataChange {
    title: string;
    old: string;
    new: string;
}

// The changes of a course in the catalog since it was added to the schedule, see
// computeMetadataDiff. A course that was removed from the catalog keeps its saved information.
export type CourseMetadataDiff =
    | { exists: true; changes: MetadataChange[] }
    | { exists: false; general: Record<string, string> };

export interface CalendarAutoUpload {
    uid: string | null;
    exported: boolean | null;
    uploadedFingerprint: string | null;
    timer: ReturnType<typeof setTimeout> | null;
    uploading: boolean;
    pending: boolean;
}

export interface State {
    courseManager: CourseManager;
    colorHash: ColorHash;
    firestoreDb: firebaseCompat.firestore.Firestore | null;
    firebaseStorage: firebaseCompat.storage.Storage | null;
    viewingSharedSchedule: boolean;
    previewingFromSelectControl: string | null;
    previewingFromSelectControlLayerId: string;
    stopScheduleWatching: (() => void) | null;
    currentSavedSession: SavedSession;
    savedSessionLastState: SavedSession;
    savedSessionUndoStack: SavedSession[];
    savedSessionRedoStack: SavedSession[];
    metadataDiff: Record<string, CourseMetadataDiff> | null;
    customColors: Record<string, string>;
    currentLayers: Layer[];
    collapsedLayerIds: Record<string, boolean>;
    calendarDaysOff: string[] | null;
    calendarAutoUpload: CalendarAutoUpload;
    loginDialog: BootstrapDialogInstance | null;
    courseSelect: CourseSelect;
    courseButtonList: CourseButtonList;
    courseExamInfo: CourseExamInfo;
    courseCalendar: CourseCalendar;
}

// Unused before start() or cheeseforkInit() sets them, see their comments in State.
const unset = null as never;

// The state of the page, shared by the app's modules. Values that depend on the page's data are
// set by start(), in init.js.
export const state: State = {
    // The course catalog, with the English text in English only, see start().
    courseManager: unset,
    colorHash: unset,
    firestoreDb: null,
    firebaseStorage: null,
    viewingSharedSchedule: false,
    previewingFromSelectControl: null,
    previewingFromSelectControlLayerId: '',
    stopScheduleWatching: null,
    // Set once the schedule is loaded, before the code that uses it runs.
    currentSavedSession: unset,
    // See onSavedSessionChange.
    // Set with currentSavedSession.
    savedSessionLastState: unset,
    savedSessionUndoStack: [],
    savedSessionRedoStack: [],
    metadataDiff: {},
    customColors: {},
    // The layers of the shown schedule, { id, name, hidden, collapsed } each. Empty if layers aren't used.
    currentLayers: [],
    // The ids of the collapsed layers of the current semester, by 'default' for the first layer
    // and the id for the others. A view preference of this device, so it's kept in its own
    // localStorage item rather than in the schedule. Not saved for a shared schedule.
    collapsedLayerIds: {},
    // The iCalendar export: the days off of the semester, once loaded, and the automatic upload
    // of an exported calendar (see calendarAutoUploadSchedule): exported is null if unknown, or
    // true or false once checked.
    calendarDaysOff: null,
    calendarAutoUpload: {
        uid: null,
        exported: null,
        uploadedFingerprint: null,
        timer: null,
        uploading: false,
        pending: false
    },
    loginDialog: null,
    // UI components, created by cheeseforkInit() before the code that uses them runs. The pages
    // of the catalog (crawlersInfo) have none, and don't run that code.
    courseSelect: unset,
    courseButtonList: unset,
    courseExamInfo: unset,
    courseCalendar: unset
};
