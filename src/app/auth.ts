import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import { firestoreDisplayNameDecode } from './firestore.js';
import { resetSchedule } from './history.js';
import { offerLocalScheduleImport, watchSavedSchedule } from './schedule-sync.js';
import { state } from './state.js';

export function firebaseInit() {
    const config = {
        apiKey: 'AIzaSyDEbZvXmlT5HiVDHwruqpuvI6nSc5DGoLU',
        authDomain: 'cheesefork-squared.firebaseapp.com',
        projectId: 'cheesefork-squared',
        storageBucket: 'cheesefork-squared.firebasestorage.app',
        messagingSenderId: '985208375940',
        appId: '1:985208375940:web:432d864e1636b1bf8ed0d1',
        measurementId: 'G-7B3BP56GNV'
    };
    firebase.initializeApp(config);
    firebase.auth().languageCode = CheeseI18n.getLocale();

    state.firestoreDb = firebase.firestore();

    state.firebaseStorage = firebase.storage();
}

// "By signing in, you agree to the {terms} and the {privacy}", with both placeholders as links.
export function loginTermsNote() {
    const links = {
        terms: {
            url: 'https://github.com/talisraeli/cheese-fork/blob/main/docs/TERMS.md',
            label: CheeseI18n.t('shell.login.termsLink')
        },
        privacy: {
            url: 'https://github.com/talisraeli/cheese-fork/blob/main/docs/PRIVACY.md',
            label: CheeseI18n.t('shell.login.privacyLink')
        }
    };
    const linkByName: Record<string, { url: string; label: string } | undefined> = links;
    const note = $('<p class="login-terms-note small text-muted text-center mt-3 mb-0">');
    CheeseI18n.t('shell.login.terms')
        .split(/(\{terms\}|\{privacy\})/)
        .forEach(part => {
            const link = linkByName[part.slice(1, -1)];
            if (link && part.charAt(0) === '{') {
                note.append($('<a target="_blank" rel="noopener">').attr('href', link.url).text(link.label));
            } else if (part) {
                note.append(document.createTextNode(part));
            }
        });
    return note;
}

export function firebaseAuthUIInit(onInitialized: () => void) {
    // FirebaseUI config.
    const uiConfig = {
        // Opens IDP Providers sign-in flow in a popup.
        signInFlow: 'popup',
        signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID
            // I wanted to implement viewing Facebook friends' schedule via the Facebook API,
            // but they require business verification for the user_friends permission. -_-
            // https://stackoverflow.com/questions/51089608/business-verification-required-as-part-of-my-app-review
            /*,
            {
                provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
                scopes: [
                    'public_profile',
                    'email',
                    'user_friends'
                ]
            }*/
        ],
        callbacks: {
            // Called when the user has been successfully signed in.
            signInSuccessWithAuthResult(authResult: firebaseCompat.auth.UserCredential) {
                if (authResult.user) {
                    state.loginDialog?.close();
                }
                // Do not redirect.
                return false;
            }
        },
        // Terms of service url.
        //tosUrl: 'https://policies.google.com/terms',
        // Privacy policy url.
        //privacyPolicyUrl: 'https://policies.google.com/privacy',
        // Disable accountchooser.com which is enabled by default.
        credentialHelper: firebaseui.auth.CredentialHelper.NONE
    };

    // Initialize the FirebaseUI Widget using Firebase.
    const firebaseUI = new firebaseui.auth.AuthUI(firebase.auth());

    let authInitialized = false;

    // Listen to change in auth state so it displays the correct UI for when
    // the user is signed in or not.
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            handleSignedInUser(user);
        } else {
            handleSignedOutUser();
        }
        if (!authInitialized) {
            onInitialized();
            authInitialized = true;
        } else if (user) {
            // Slow reload.
            $('#page-loader').show();
            state.stopScheduleWatching?.();
            resetSchedule();
            watchSavedSchedule(() => {
                $('#page-loader').hide();
                // Just signed in, offer the schedule built while signed out.
                offerLocalScheduleImport();
            });
        } else {
            // Fast reload.
            state.stopScheduleWatching?.();
            resetSchedule();
            watchSavedSchedule(() => {});
        }
    });

    function handleSignedInUser(user: firebaseCompat.User) {
        $('#top-navbar-login').addClass('d-none');
        $('#top-navbar-logout')
            .removeClass('d-none')
            .find('a')
            .attr(
                'data-original-title',
                CheeseI18n.t('shell.login.signedInAs', {
                    name: firestoreDisplayNameDecode(
                        user.displayName || user.email || CheeseI18n.t('shell.login.unknown')
                    )
                })
            );
        $('#top-navbar-share').find('a').removeClass('disabled').tooltip('disable');
        $('#top-navbar-api').removeClass('d-none');
    }

    function handleSignedOutUser() {
        $('#top-navbar-logout').addClass('d-none');
        $('#top-navbar-api').addClass('d-none');
        $('#top-navbar-login').removeClass('d-none');
        $('#top-navbar-share').find('a').addClass('disabled').tooltip('enable');
        firebaseUI.start('#firebaseui-auth-container', uiConfig);
    }
}
