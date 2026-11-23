'use strict';

const { FieldPath, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { DELETE, documentPath } = require('./schedule');

const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

// Builds a new document from an update map: dotted paths become nested maps.
function expandUpdate(update) {
    const result = {};
    Object.keys(update).forEach(key => {
        if (update[key] === DELETE) {
            return;
        }
        const segments = key.split('.');
        let target = result;
        segments.slice(0, -1).forEach(segment => {
            target[segment] = target[segment] || {};
            target = target[segment];
        });
        target[segments[segments.length - 1]] = update[key];
    });
    return result;
}

// Arguments for update(ref, field, value, field, value...). FieldPath objects allow any
// characters in segments, such as the "/" in the lesson type "סמינר/פרויקט".
function updateArguments(update) {
    const args = [];
    Object.keys(update).forEach(key => {
        args.push(new FieldPath(...key.split('.')), update[key] === DELETE ? FieldValue.delete() : update[key]);
    });
    return args;
}

function createFirestoreStore(db, auth) {
    async function displayName(uid) {
        try {
            return (await auth.getUser(uid)).displayName || null;
        } catch (e) {
            return null;
        }
    }

    return {
        async findKeyOwner(hash) {
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
            return snapshot.get('uid');
        },

        async userInfo(uid) {
            return { uid: uid, displayName: await displayName(uid) };
        },

        async read(uid, semester) {
            const snapshot = await db.doc(documentPath(uid, semester)).get();
            return snapshot.exists ? snapshot.data() : {};
        },

        // change(data) returns { update, result }; the update is applied atomically with the read.
        async transact(uid, semester, change) {
            const ref = db.doc(documentPath(uid, semester));
            return db.runTransaction(async transaction => {
                const snapshot = await transaction.get(ref);
                const { update, result } = change(snapshot.exists ? snapshot.data() : {});
                if (Object.keys(update).length > 0) {
                    if (snapshot.exists) {
                        transaction.update(ref, ...updateArguments(update));
                    } else {
                        // The client creates the document with the name, which is shown for shared schedules.
                        transaction.set(ref, Object.assign({ displayName: await displayName(uid) }, expandUpdate(update)));
                    }
                }
                return result;
            });
        }
    };
}

module.exports = { createFirestoreStore, expandUpdate };
