import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import { render } from '../lib/template.js';
import { state } from './state.js';
import saveErrorTemplate from './templates/save-error.html';

// Firestore, set by firebaseInit, which runs when Firebase is loaded, before it's used.
export function firestoreDb(): firebaseCompat.firestore.Firestore {
    return state.firestoreDb as firebaseCompat.firestore.Firestore;
}

export function firestoreAuthenticatedUserDoc(): firebaseCompat.firestore.DocumentReference | null {
    const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
    if (user !== null) {
        let doc = firestoreDb().collection('users').doc(user.uid);

        const semestersWithoutSubCollection = ['201701', '201702', '201703', '201801'];
        if (!semestersWithoutSubCollection.includes(currentSemester)) {
            doc = doc.collection('semesters').doc(currentSemester);
        }

        return doc;
    }
    return null;
}

// Saves a change of the signed-in user's schedule. The change is already shown, so a failed
// write would otherwise go unnoticed until it disappears on the next reload. While offline,
// the promise stays pending until the write reaches the server, so this isn't reported.
export function firestoreSave(doc: firebaseCompat.firestore.DocumentReference, input: Record<string, unknown>) {
    doc.update(input).catch((error: { message?: string }) => {
        showSaveError(CheeseI18n.t('shell.error.saveSchedule', { error: error.message || error }));
    });
}

// Called with the error of a failed localStorage save of the schedule.
export function localStorageSaveFailed(error: unknown) {
    // localStorage is not available in IE/Edge when running from a local file, which is
    // expected. A full storage is not, and the change is lost.
    const failure = error as { name?: string; code?: number } | null;
    const quotaExceeded =
        failure &&
        (failure.name === 'QuotaExceededError' ||
            failure.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            failure.code === 22 ||
            failure.code === 1014);
    if (quotaExceeded) {
        showSaveError(CheeseI18n.t('shell.error.saveScheduleLocal'));
    }
}

// Shows a notice that doesn't block the page, once until it's closed.
export function showSaveError(message: string) {
    gtag('event', 'save-error');

    if ($('#save-error-alert').length > 0) {
        return;
    }

    const notice = $(render(saveErrorTemplate));
    notice.find('.save-error-message').text(message);
    notice.find('.save-error-reload').click(() => {
        window.location.reload();
    });
    notice.find('.close').click(() => {
        notice.remove();
    });
    $('body').append(notice);
}

export function firestoreUserDoc(userId: string): firebaseCompat.firestore.DocumentReference {
    let doc = firestoreDb().collection('users').doc(userId);

    const semestersWithoutSubCollection = ['201701', '201702', '201703', '201801'];
    if (!semestersWithoutSubCollection.includes(currentSemester)) {
        doc = doc.collection('semesters').doc(currentSemester);
    }

    return doc;
}

export function firestoreDisplayNameDecode(displayName: string) {
    // For some reason, the ' symbol is encoded as &#39;.
    return displayName.replace('&#39;', "'");
}
