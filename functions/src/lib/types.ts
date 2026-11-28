// Types shared by the functions' modules.

// A user's semester document in Firestore, as the site saves it (see src/app/session-types.ts).
// It can be written by the user's own client, so it's read as untrusted data.
export type ScheduleData = Record<string, unknown>;

// A custom event: its times are in the calendar's week of 2017-01-01 to 2017-01-07.
export interface SavedCustomEvent {
    title: string;
    start: string;
    end: string;
}

// The lessons selected for a course, by lesson type key, see schedule.lessonsOf.
export type Lessons = Record<string, unknown>;

// A layer, sanitized: the first layer ('default') has no courses or custom events of its own.
export interface SavedLayer {
    name?: string;
    hidden?: boolean;
    courses: string[];
    customEvents: Record<string, SavedCustomEvent>;
}

// The changes of a write: dotted field paths of the document to values, or to DELETE to remove.
export type Update = Record<string, unknown>;

// A change of a semester document: the update to apply, and the result for the response, if any.
export interface Change<T> {
    update: Update;
    result?: T;
}

// Where the API keeps the API keys and the schedules: Firestore (firestore-store.ts), or memory
// in the tests.
export interface Store {
    // The uid of the user of an API key, by the key's hash, or null for an unknown key.
    findKeyOwner(hash: string): Promise<string | null>;
    userInfo(uid: string): Promise<{ uid: string; displayName: string | null }>;
    // The user's semester documents, by semester.
    readAll(uid: string): Promise<Record<string, ScheduleData>>;
    read(uid: string, semester: string): Promise<ScheduleData>;
    // Applies change to the document atomically with reading it, and returns its result.
    transact<T>(uid: string, semester: string, change: (data: ScheduleData) => Change<T>): Promise<T>;
}

// What the loaders use of fetch, so that the tests can stand in for it.
export type Fetch = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
