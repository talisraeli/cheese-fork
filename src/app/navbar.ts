import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import { showApiKeyDialog } from './api-key.js';
import { loginTermsNote } from './auth.js';
import { buildScheduleCalendar, calendarFileUrl, loadCalendarDaysOff, uploadCalendarFile } from './calendar-export.js';
import { initUndoRedoKeyboardShortcuts, makeRedo, makeUndo } from './history.js';
import { getPrettyMetadataDiff, setMetadataToCurrent } from './metadata-diff.js';
import { showWhatsNewPopup } from './popups.js';
import { offerIcsImport } from './schedule-sync.js';
import { semesterFriendlyName, semesterFriendlyNameForFileName } from './semesters.js';
import { state } from './state.js';
import { copyToClipboard, shellUrl } from './util.js';
import { render } from '../lib/template.js';
import exportCalendarTemplate from './templates/export-calendar.html';

export function navbarInit() {
    $('#top-navbar-print-section-title').text(semesterFriendlyName(currentSemester));
    $('#top-navbar-dropdown-semester-name').text(semesterFriendlyName(currentSemester));

    $('#top-navbar-guide').click(event => {
        event.preventDefault();

        gtag('event', 'navbar-guide');

        showWhatsNewPopup(() => {}, true);
    });

    if (!state.viewingSharedSchedule) {
        const semesterSelect = $('#top-navbar-semester').find('.dropdown-menu');

        Object.keys(availableSemesters)
            .sort()
            .reverse()
            .forEach(semester => {
                const link = $('<a class="dropdown-item">')
                    .prop('href', shellUrl({ semester }))
                    .text(semesterFriendlyName(semester));
                if (semester === currentSemester) {
                    link.addClass('active');
                }
                semesterSelect.append(link);
            });

        $('#top-navbar-changes').click(event => {
            event.preventDefault();

            gtag('event', 'navbar-changes');

            BootstrapDialog.show({
                title: CheeseI18n.t('shell.changes.title'),
                message: getPrettyMetadataDiff(),
                buttons: [
                    {
                        label: CheeseI18n.t('shell.changes.accept'),
                        cssClass: 'btn-primary',
                        action(dialog: BootstrapDialogInstance) {
                            gtag('event', state.metadataDiff ? 'metadata-to-current' : 'metadata-first-time');

                            setMetadataToCurrent();
                            dialog.close();
                        }
                    },
                    {
                        label: CheeseI18n.t('shell.dialog.close'),
                        action(dialog: BootstrapDialogInstance) {
                            dialog.close();
                        }
                    }
                ]
            });
        });

        $('#top-navbar-login').click(event => {
            event.preventDefault();

            gtag('event', 'navbar-login');

            if (state.loginDialog) {
                state.loginDialog.open();
                return;
            }

            state.loginDialog = BootstrapDialog.show({
                title: CheeseI18n.t('shell.login.title'),
                message: $('<div>').append($('#firebaseui-auth-container'), loginTermsNote()),
                buttons: [
                    {
                        label: CheeseI18n.t('shell.dialog.close'),
                        action(dialog: BootstrapDialogInstance) {
                            dialog.close();
                        }
                    }
                ],
                autodestroy: false
            });
        });

        $('#top-navbar-logout').click(function (event) {
            event.preventDefault();

            gtag('event', 'navbar-logout');

            $(this).find('[data-toggle="tooltip"]').tooltip('hide');

            BootstrapDialog.show({
                title: CheeseI18n.t('shell.logout.title'),
                message: CheeseI18n.t('shell.logout.message'),
                buttons: [
                    {
                        label: CheeseI18n.t('shell.nav.logout'),
                        cssClass: 'btn-primary',
                        action(dialog: BootstrapDialogInstance) {
                            firebase.auth().signOut();
                            dialog.close();
                        }
                    },
                    {
                        label: CheeseI18n.t('shell.dialog.cancel'),
                        action(dialog: BootstrapDialogInstance) {
                            dialog.close();
                        }
                    }
                ]
            });
        });

        $('#top-navbar-share').click(function (event) {
            event.preventDefault();
            if ($(this).find('a').hasClass('disabled')) {
                return;
            }

            gtag('event', 'navbar-share');

            const url = shellUrl({
                semester: currentSemester,
                uid: (firebase.auth().currentUser as firebaseCompat.User).uid
            });
            const urlElement = $('<a target="_blank" rel="noopener">')
                .text(CheeseI18n.t('shell.share.open'))
                .prop('href', url);
            const shareDialogContent = $('<div>').text(CheeseI18n.t('shell.share.link')).append(urlElement).append('.');

            BootstrapDialog.show({
                title: CheeseI18n.t('shell.nav.share'),
                message: shareDialogContent,
                buttons: [
                    {
                        label: CheeseI18n.t('shell.share.copy'),
                        cssClass: 'btn-primary',
                        action(dialog: BootstrapDialogInstance) {
                            copyToClipboard(
                                url,
                                () => {
                                    dialog.close();
                                },
                                () => {
                                    alert(CheeseI18n.t('shell.error.copy'));
                                }
                            );
                        }
                    },
                    {
                        label: CheeseI18n.t('shell.dialog.close'),
                        action(dialog: BootstrapDialogInstance) {
                            dialog.close();
                        }
                    }
                ]
            });
        });

        $('#top-navbar-api').click(function (event) {
            event.preventDefault();

            gtag('event', 'navbar-api');

            $(this).find('[data-toggle="tooltip"]').tooltip('hide');

            showApiKeyDialog();
        });

        $('#top-navbar-undo').click(function (event) {
            event.preventDefault();

            gtag('event', 'navbar-undo');

            $(this).find('[data-toggle="tooltip"]').tooltip('hide');

            makeUndo();
        });

        $('#top-navbar-redo').click(function (event) {
            event.preventDefault();

            gtag('event', 'navbar-redo');

            $(this).find('[data-toggle="tooltip"]').tooltip('hide');

            makeRedo();
        });

        initUndoRedoKeyboardShortcuts();

        $('#top-navbar-import')
            .removeClass('d-none')
            .click(event => {
                event.preventDefault();

                gtag('event', 'navbar-import');

                // Choosing the same file again should import it again.
                $('#import-ics-file').val('').trigger('click');
            });

        $('#import-ics-file').on('change', function (this: HTMLInputElement) {
            const file = this.files && this.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                offerIcsImport(String(reader.result));
            };
            reader.onerror = () => {
                BootstrapDialog.show({
                    title: CheeseI18n.t('shell.dialog.danger'),
                    message: CheeseI18n.t('shell.importIcs.readError'),
                    size: BootstrapDialog.SIZE_SMALL
                });
            };
            reader.readAsText(file);
        });
    }

    $('#top-navbar-export').click(event => {
        event.preventDefault();

        gtag('event', 'navbar-export');

        loadCalendarDaysOff(
            (daysOff: string[]) => {
                const icsCal = buildScheduleCalendar(daysOff);

                const errorEmptySchedule = () => {
                    BootstrapDialog.show({
                        title: CheeseI18n.t('shell.export.emptyTitle'),
                        message: CheeseI18n.t('shell.export.empty'),
                        size: BootstrapDialog.SIZE_SMALL
                    });
                };

                if (
                    state.viewingSharedSchedule ||
                    typeof firebase === 'undefined' ||
                    firebase.auth().currentUser === null
                ) {
                    if (!icsCal.download(semesterFriendlyNameForFileName(currentSemester))) {
                        errorEmptySchedule();
                    }

                    return;
                }

                const calendar = icsCal.build();
                if (!calendar) {
                    errorEmptySchedule();
                    return;
                }

                const uid = (firebase.auth().currentUser as firebaseCompat.User).uid;
                const calendarUrl = calendarFileUrl(uid);

                const exportCalendarDialog = BootstrapDialog.show({
                    title: CheeseI18n.t('shell.export.title'),
                    message: render(exportCalendarTemplate),
                    onshow(dialog: BootstrapDialogInstance) {
                        dialog.getButton('copy-link').disable();
                    },
                    buttons: [
                        {
                            id: 'copy-link',
                            label: CheeseI18n.t('shell.share.copy'),
                            cssClass: 'btn-primary',
                            action(dialog: BootstrapDialogInstance) {
                                copyToClipboard(
                                    calendarUrl,
                                    () => {
                                        dialog.close();
                                    },
                                    () => {
                                        alert(CheeseI18n.t('shell.error.copy'));
                                    }
                                );
                            }
                        },
                        {
                            label: CheeseI18n.t('shell.dialog.close'),
                            action(dialog: BootstrapDialogInstance) {
                                dialog.close();
                            }
                        }
                    ]
                });

                uploadCalendarFile(uid, calendar).then(
                    () => {
                        // From now on, schedule changes update the file automatically.
                        state.calendarAutoUpload.uid = uid;
                        state.calendarAutoUpload.exported = true;

                        const urlElement = $('<a target="_blank" rel="noopener">')
                            .text(CheeseI18n.t('shell.export.download'))
                            .prop('href', calendarUrl);
                        exportCalendarDialog
                            .getModalBody()
                            .find('.calendar-link-placeholder')
                            .empty()
                            .append(urlElement);

                        exportCalendarDialog.getButton('copy-link').enable();
                    },
                    error => {
                        alert(CheeseI18n.t('shell.error.saveCalendar', { error: error.message }));
                    }
                );
            },
            () => {
                BootstrapDialog.show({
                    title: CheeseI18n.t('shell.dialog.danger'),
                    message: CheeseI18n.t('shell.export.holidaysError'),
                    size: BootstrapDialog.SIZE_SMALL
                });
            }
        );
    });
}
