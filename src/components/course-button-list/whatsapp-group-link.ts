import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };

// The link to the course's WhatsApp group, shared by the students of the course.

// The groups of a course, as saved in Firestore in courseExtraDetails/<course>.
interface GroupLinks {
    whatsappGroupLink?: string;
    whatsappGroupLink2?: string;
    whatsappGroupLink3?: string;
    telegramGroupLink?: string;
    discordServerLink?: string;
}

type GroupLinkKey = keyof GroupLinks;

export function makeWhatsappGroupLinkContent(data: GroupLinks): JQuery {
    const result = $('<div>');

    let linksFound = 0;

    const whatsappLinks: string[] = [];
    const whatsappLinkKeys: GroupLinkKey[] = ['whatsappGroupLink', 'whatsappGroupLink2', 'whatsappGroupLink3'];

    whatsappLinkKeys.forEach(whatsappLinkKey => {
        const url = data[whatsappLinkKey];
        if (url && url.match(/^https:\/\/chat\.whatsapp\.com\//)) {
            whatsappLinks.push(url);
            linksFound++;
        }
    });

    whatsappLinks.forEach((url, i) => {
        let linkText = CheeseI18n.t('courses.whatsappGroup');
        if (i > 0) {
            linkText += ` ${i + 1}`;
        }

        result.append(
            $('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: "gtag('event', 'info-click-group-link-whatsapp')",
                    text: linkText
                })
            })
        );
    });

    let url = data.telegramGroupLink;
    if (url && url.match(/^https:\/\/t\.me\/.+/)) {
        linksFound++;
        result.append(
            $('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: "gtag('event', 'info-click-group-link-telegram')",
                    text: CheeseI18n.t('courses.telegramGroup')
                })
            })
        );
    }

    url = data.discordServerLink;
    if (url && url.match(/^https:\/\/(discord\.gg|discord\.com\/invite)\/.+/)) {
        linksFound++;
        result.append(
            $('<div>', {
                html: $('<a>', {
                    href: url,
                    target: '_blank',
                    rel: 'noopener',
                    onclick: "gtag('event', 'info-click-group-link-discord')",
                    text: CheeseI18n.t('courses.discordServer')
                })
            })
        );
    }

    if (linksFound > 1) {
        result.prepend($('<div>').text(CheeseI18n.t('courses.groupsJoinMany')));
    } else if (linksFound > 0) {
        result.prepend($('<div>').text(CheeseI18n.t('courses.groupsJoinOne')));
    } else {
        result.text(CheeseI18n.t('courses.groupsNone'));
    }

    return result;
}

export function makeWhatsappGroupLinkForm(data: GroupLinks): JQuery {
    const result = $('<form>', {
        html: [
            $('<input>', {
                type: 'text',
                value: data.whatsappGroupLink || '',
                class: 'form-control mt-2 whatsapp-group-link',
                placeholder: 'https://chat.whatsapp.com/...',
                'aria-label': CheeseI18n.t('courses.whatsappGroup'),
                style: 'direction: ltr;',
                pattern: 'https://chat\\.whatsapp\\.com/.+',
                maxlength: 300
            }),
            $('<input>', {
                type: 'text',
                value: data.whatsappGroupLink2 || '',
                class: 'form-control mt-2 whatsapp-group-link2',
                placeholder: 'https://chat.whatsapp.com/...',
                'aria-label': CheeseI18n.t('courses.whatsappGroup'),
                style: 'direction: ltr;',
                pattern: 'https://chat\\.whatsapp\\.com/.+',
                maxlength: 300
            }),
            $('<input>', {
                type: 'text',
                value: data.whatsappGroupLink3 || '',
                class: 'form-control mt-2 whatsapp-group-link3',
                placeholder: 'https://chat.whatsapp.com/...',
                'aria-label': CheeseI18n.t('courses.whatsappGroup'),
                style: 'direction: ltr;',
                pattern: 'https://chat\\.whatsapp\\.com/.+',
                maxlength: 300
            }),
            $('<input>', {
                type: 'text',
                value: data.telegramGroupLink || '',
                class: 'form-control mt-2 telegram-group-link',
                placeholder: 'https://t.me/...',
                'aria-label': CheeseI18n.t('courses.telegramGroup'),
                style: 'direction: ltr;',
                pattern: 'https://t\\.me/.+',
                maxlength: 300
            }),
            $('<input>', {
                type: 'text',
                value: data.discordServerLink || '',
                class: 'form-control mt-2 discord-server-link',
                placeholder: 'https://discord.gg/...',
                'aria-label': CheeseI18n.t('courses.discordServer'),
                style: 'direction: ltr;',
                pattern: 'https://(discord\\.gg|discord\\.com/invite)/.+',
                maxlength: 300
            }),
            $('<div>', {
                class: 'invalid-feedback',
                html: [
                    $('<div>').text(
                        CheeseI18n.t('courses.groupWhatsappFormat', { url: 'https://chat.whatsapp.com/...' })
                    ),
                    $('<div>').text(CheeseI18n.t('courses.groupTelegramFormat', { url: 'https://t.me/...' })),
                    $('<div>').text(
                        CheeseI18n.t('courses.groupDiscordFormat', {
                            url: 'https://discord.gg/...',
                            alternative: 'https://discord.com/invite/...'
                        })
                    )
                ]
            })
        ]
    });

    return result;
}

export function showWhatsappGroupLink(course: string) {
    let groupLinksData: GroupLinks = {};

    const whatsappGroupDialog = BootstrapDialog.show({
        title: CheeseI18n.t('courses.groupsTitle'),
        message: $('<div>', { class: 'whatsapp-group-link-content', text: CheeseI18n.t('courses.loading') }),
        onshow(dialog: BootstrapDialogInstance) {
            dialog.getButton('update-link').disable();
        },
        buttons: [
            {
                id: 'update-link',
                label: CheeseI18n.t('courses.updateLinks'),
                action(dialog: BootstrapDialogInstance) {
                    const content = dialog.getModalBody().find('.whatsapp-group-link-content');

                    const form = content.find('form').get(0);
                    if (!form) {
                        content.empty().append(makeWhatsappGroupLinkForm(groupLinksData));
                        content.find('form input:first').focus();
                        return;
                    }

                    if (form.checkValidity() === false) {
                        form.classList.add('was-validated');
                        return;
                    }
                    form.classList.remove('was-validated');

                    const button = dialog.getButton('update-link');
                    button.disable();

                    const newGroupLinksData: GroupLinks = {};
                    const newGroupLinksDataWithDelete: Record<string, string | firebaseCompat.firestore.FieldValue> =
                        {};
                    const newGroupLinksDataSelectors: Record<GroupLinkKey, string> = {
                        whatsappGroupLink: '.whatsapp-group-link',
                        whatsappGroupLink2: '.whatsapp-group-link2',
                        whatsappGroupLink3: '.whatsapp-group-link3',
                        telegramGroupLink: '.telegram-group-link',
                        discordServerLink: '.discord-server-link'
                    };

                    (Object.keys(newGroupLinksDataSelectors) as GroupLinkKey[]).forEach(key => {
                        const selector = newGroupLinksDataSelectors[key];
                        const url = String(content.find(selector).val())
                            .trim()
                            .replace(/[?&]fbclid=[a-zA-Z0-9_-]+$/, '')
                            .replace(/[?&]mode=\w+$/, '');

                        if (url !== '') {
                            newGroupLinksData[key] = url;
                            newGroupLinksDataWithDelete[key] = url;
                        } else {
                            newGroupLinksDataWithDelete[key] = firebase.firestore.FieldValue.delete();
                        }
                    });

                    // Required by the Firestore rules, to know who changed the links.
                    // The button is enabled once the links are loaded, which requires signing in.
                    newGroupLinksDataWithDelete.updatedBy = (firebase.auth().currentUser as firebaseCompat.User).uid;
                    newGroupLinksDataWithDelete.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                    firebase
                        .firestore()
                        .collection('courseExtraDetails')
                        .doc(course)
                        .set(newGroupLinksDataWithDelete, { merge: true })
                        .then(
                            () => {
                                groupLinksData = newGroupLinksData;
                                content.empty().append(makeWhatsappGroupLinkContent(groupLinksData));
                                button.enable();
                            },
                            error => {
                                button.enable();
                                alert(CheeseI18n.t('courses.groupSaveFailed', { error }));
                            }
                        );
                }
            },
            {
                label: CheeseI18n.t('courses.close'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            }
        ]
    });

    const onError = (errorMessage: string): void => {
        whatsappGroupDialog.getModalBody().find('.whatsapp-group-link-content').text(errorMessage);
    };

    const authenticated = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser !== null;
    if (typeof firebase === 'undefined') {
        onError(CheeseI18n.t('courses.firebaseUnavailable'));
    } else if (!authenticated) {
        onError(CheeseI18n.t('courses.groupLoginRequired'));
    } else {
        firebase
            .firestore()
            .collection('courseExtraDetails')
            .doc(course)
            .get()
            .then(
                doc => {
                    if (doc.exists) {
                        groupLinksData = doc.data() as GroupLinks;
                    }

                    whatsappGroupDialog
                        .getModalBody()
                        .find('.whatsapp-group-link-content')
                        .empty()
                        .append(makeWhatsappGroupLinkContent(groupLinksData));

                    whatsappGroupDialog.getButton('update-link').enable();
                },
                error => {
                    onError(CheeseI18n.t('courses.loadFailed'));
                }
            );
    }
}
