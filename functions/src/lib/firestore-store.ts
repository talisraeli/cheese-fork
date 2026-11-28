import type { Auth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { ScheduleData, Store, Update } from './types.ts';
import { DELETE, documentPath, SEMESTERS_WITHOUT_SUB_COLLECTION } from './schedule.ts';

const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

// Builds a new document from an update map: dotted paths become nested maps.
function expandUpdate(update: Update): Record<string, unknown> {
    type Tree = Record<string, unknown>;
    const result: Tree = {};
    Object.keys(update).forEach(key => {
        if (update[key] === DELETE) {
            return;
        }
        const segments = key.split('.');
        let target: Tree = result;
        segments.slice(0, -1).forEach(segment => {
            target[segment] = target[segment] || {};
            target = target[segment] as Tree;
        });
        target[segments[segments.length - 1]] = update[key];
    });
    return result;
}

// Arguments for update(ref, field, value, field, value...). FieldPath objects allow any
// characters in segments, such as the "/" in the lesson type "סמינר/פרויקט".
function updateArguments(update: Update): [FieldPath, unknown, ...unknown[]] {
    const args: unknown[] = [];
    Object.keys(update).forEach(key => {
        args.push(new FieldPath(...key.split('.')), update[key] === DELETE ? FieldValue.delete() : update[key]);
    });
    return args as [FieldPath, unknown, ...unknown[]];
}

function createFirestoreStore(db: Firestore, auth: Auth): Store {
    async function displayName(uid: string) {
        try {
            return (await auth.getUser(uid)).displayName || null;
        } catch (e) {
            return null;
        }
    }

    return {
        async findKeyOwner(hash: string) {
            const ref = db.collection('apiKeys').doc(hash);
            const snapshot = await ref.get();
            if (!snapshot.exists) {
                return null;
            }

            const lastUsedAt = snapshot.get('lastUsedAt');
            if (!lastUsedAt || Date.now() - lastUsedAt.toMillis() > LAST_USED_RESOLUTION_MS) {
                // Not awaited, a failure here shouldn't fail the request.
                ref.update({ lastUsedAt: Timestamp.now() }).catch(() => {});
            }
            return snapshot.get('uid') as string;
        },

        async userInfo(uid: string) {
            return { uid: uid, displayName: await displayName(uid) };
        },

        // Returns { semester: data } for every semester document of the user. The earliest
        // semesters are saved in the user document itself, see documentPath.
        async readAll(uid: string) {
            const userRef = db.collection('users').doc(uid);
            const [userDoc, semesterDocs] = await Promise.all([userRef.get(), userRef.collection('semesters').get()]);
            const result: Record<string, ScheduleData> = {};
            semesterDocs.forEach(doc => {
                result[doc.id] = doc.data();
            });
            if (userDoc.exists) {
                SEMESTERS_WITHOUT_SUB_COLLECTION.forEach(semester => {
                    result[semester] = userDoc.data() as ScheduleData;
                });
            }
            return result;
        },

        async read(uid: string, semester: string) {
            const snapshot = await db.doc(documentPath(uid, semester)).get();
            return snapshot.exists ? (snapshot.data() as ScheduleData) : {};
        },

        // change(data) returns { update, result }; the update is applied atomically with the read.
        async transact<T>(
            uid: string,
            semester: string,
            change: (data: ScheduleData) => { update: Update; result?: T }
        ) {
            const ref = db.doc(documentPath(uid, semester));
            return db.runTransaction(async transaction => {
                const snapshot = await transaction.get(ref);
                const { update, result } = change(snapshot.exists ? (snapshot.data() as ScheduleData) : {});
                if (Object.keys(update).length > 0) {
                    if (snapshot.exists) {
                        transaction.update(ref, ...updateArguments(update));
                    } else {
                        // The client creates the document with the name, which is shown for shared schedules.
                        transaction.set(
                            ref,
                            Object.assign({ displayName: await displayName(uid) }, expandUpdate(update))
                        );
                    }
                }
                return result as T;
            });
        }
    };
}

export { createFirestoreStore, expandUpdate };
