import { copyToClipboard } from './util.js';

// https://stackoverflow.com/a/30810322
// The prompt is in English for any assistant to follow, whatever language the user writes in.
// It leaves the key out, so that pasting it doesn't share the key with the assistant's service.
export function apiAssistantPrompt(apiBaseUrl: string, docsRawUrl: string, semester: string) {
    return [
        'Help me manage my CheeseFork² course schedule (Technion) through its HTTP API.',
        '',
        `Base URL: ${apiBaseUrl}`,
        'Authentication: send the header "Authorization: Bearer YOUR_API_KEY" with every request.',
        `Full documentation: ${docsRawUrl}`,
        '',
        'Key facts:',
        `- Semesters are YYYYSS: YYYY01 is winter YYYY–YYYY+1, YYYY02 spring, YYYY03 summer. My current semester is ${semester}.`,
        '- GET /semesters/{semester}/schedule returns my whole schedule, GET /semesters/{semester}/courses my courses.',
        '- POST /semesters/{semester}/courses with {"course": "02340114"} adds a course; DELETE /semesters/{semester}/courses/{course} removes it.',
        '- GET /semesters lists the semesters. GET /semesters/{semester}/catalog?q=... searches courses by number or Hebrew name.',
        '- GET /semesters/{semester}/catalog/{course} lists the lessons of a course. Choose one with PUT /semesters/{semester}/courses/{course}/lessons/{type} and {"number": 11}, where type is lecture, tutorial, lab, seminar, project or workshop.',
        '- GET /semesters/{semester}/conflicts lists overlapping lessons and events. Layers are alternative plans: GET/POST /semesters/{semester}/layers, POST .../layers/{layer}/duplicate, and ?layer={layer} on other endpoints.',
        '- Custom weekly events: POST /semesters/{semester}/custom-events with {"title": "Gym", "day": "monday", "startTime": "08:30", "endTime": "10:00"}.',
        '- Errors return {"error": {"code", "message"}}. The limit is 60 requests per minute; on 429, wait for the Retry-After seconds.',
        '',
        'Read the documentation before making changes. If you can make HTTP requests, call the API yourself; otherwise give me curl commands to run. If I have not given you my API key yet, ask me for it. Before removing courses or events, or replacing chosen lessons, tell me what will change and wait for my confirmation.'
    ].join('\n');
}

// The results of the API key functions, see functions/index.js. Times are in milliseconds.
interface ApiKeyStatus {
    exists: boolean;
    hint?: string;
    createdAt?: number | null;
    lastUsedAt?: number | null;
}

interface ApiKeyCreated {
    key: string;
    hint: string;
    createdAt: number;
}

// Lets the signed-in user create, replace or revoke their personal API key (see docs/API.md).
// The key itself is shown only right after it's created, only its hash is stored.
export function showApiKeyDialog() {
    const apiBaseUrl = 'https://api.cf.talisrae.li/v1';
    const docsUrl = 'https://github.com/talisraeli/cheese-fork/blob/gh-pages/docs/API.md';
    const docsRawUrl = 'https://raw.githubusercontent.com/talisraeli/cheese-fork/gh-pages/docs/API.md';
    const functions = firebase.functions();

    const content = $('<div class="api-key-dialog">');
    const docsLink = $('<a target="_blank" rel="noopener">').attr('href', docsUrl).text(CheeseI18n.t('shell.api.docs'));
    $('<p>')
        .text(`${CheeseI18n.t('shell.api.intro')} `)
        .append(docsLink)
        .appendTo(content);
    $('<p>')
        .text(CheeseI18n.t('shell.api.baseUrl'))
        .append($('<code class="d-block text-left" dir="ltr">').text(apiBaseUrl))
        .appendTo(content);
    const status = $('<p class="api-key-status">').text(CheeseI18n.t('shell.api.loading')).appendTo(content);
    const newKey = $('<div class="api-key-new d-none">').appendTo(content);

    // A prompt to paste into an AI assistant, so that it can manage the schedule with the API.
    const prompt = apiAssistantPrompt(apiBaseUrl, docsRawUrl, currentSemester);
    const promptSection = $('<div class="api-key-prompt">').appendTo(content);
    $('<p class="mb-1">').text(CheeseI18n.t('shell.api.promptIntro')).appendTo(promptSection);
    $('<textarea class="form-control text-monospace small" rows="6" readonly dir="ltr">')
        .val(prompt)
        .on('focus click', function (this: HTMLInputElement | HTMLTextAreaElement) {
            this.select();
        })
        .appendTo(promptSection);
    const promptCopyButton = $('<button type="button" class="btn btn-outline-secondary btn-sm mt-1">')
        .text(CheeseI18n.t('shell.api.promptCopy'))
        .click(() => {
            copyToClipboard(
                prompt,
                () => {
                    promptCopyButton.text(CheeseI18n.t('shell.api.copied'));
                },
                () => {
                    alert(CheeseI18n.t('shell.error.copy'));
                }
            );
        })
        .appendTo(promptSection);

    let hasKey = false;
    let busy = true;

    function formatTime(millis: number | null | undefined) {
        // Western digits in Arabic too, see moment-locale.js.
        const dateLocale = CheeseI18n.getLocale() === 'ar' ? 'ar-u-nu-latn' : CheeseI18n.getLocale();
        return millis ? new Date(millis).toLocaleString(dateLocale) : CheeseI18n.t('shell.api.never');
    }

    function showStatus(result: ApiKeyStatus) {
        hasKey = !!result.exists;
        if (hasKey) {
            status.text(
                CheeseI18n.t('shell.api.status', {
                    hint: `${result.hint}…`,
                    created: formatTime(result.createdAt),
                    used: formatTime(result.lastUsedAt)
                })
            );
        } else {
            status.text(CheeseI18n.t('shell.api.none'));
        }
    }

    function showNewKey(key: string) {
        const input = $('<input type="text" class="form-control" readonly dir="ltr">').val(key);
        input.on('focus click', function (this: HTMLInputElement | HTMLTextAreaElement) {
            this.select();
        });
        const copyButton = $('<button type="button" class="btn btn-outline-secondary">')
            .text(CheeseI18n.t('shell.api.copy'))
            .click(() => {
                copyToClipboard(
                    key,
                    () => {
                        copyButton.text(CheeseI18n.t('shell.api.copied'));
                    },
                    () => {
                        alert(CheeseI18n.t('shell.error.copy'));
                    }
                );
            });
        newKey
            .empty()
            .append($('<p class="text-warning">').text(CheeseI18n.t('shell.api.copyNow')))
            .append(
                $('<div class="input-group">')
                    .append(input)
                    .append($('<div class="input-group-append">').append(copyButton))
            )
            .removeClass('d-none');
    }

    function hideNewKey() {
        newKey.addClass('d-none').empty();
    }

    function updateButtons(dialog: BootstrapDialogInstance) {
        const createButton = dialog.getButton('api-key-create');
        createButton.text(CheeseI18n.t(hasKey ? 'shell.api.replace' : 'shell.api.create'));
        createButton.prop('disabled', busy);
        dialog.getButton('api-key-revoke').toggleClass('d-none', !hasKey).prop('disabled', busy);
    }

    function call<T>(dialog: BootstrapDialogInstance, name: string, onResult: (result: T) => void) {
        busy = true;
        updateButtons(dialog);
        functions
            .httpsCallable(name)()
            .then(
                response => {
                    busy = false;
                    onResult(response.data as T);
                    updateButtons(dialog);
                },
                (error: { message?: string }) => {
                    busy = false;
                    updateButtons(dialog);
                    status.text(CheeseI18n.t('shell.api.error', { error: error.message }));
                }
            );
    }

    function confirmIf(condition: boolean, message: string, okLabel: string, onConfirmed: () => void) {
        if (!condition) {
            onConfirmed();
            return;
        }
        BootstrapDialog.confirm({
            title: CheeseI18n.t('shell.api.title'),
            message,
            type: BootstrapDialog.TYPE_WARNING,
            btnOKLabel: okLabel,
            btnCancelLabel: CheeseI18n.t('shell.dialog.cancel'),
            callback(confirmed: boolean) {
                if (confirmed) {
                    onConfirmed();
                }
            }
        });
    }

    const dialog = BootstrapDialog.show({
        title: CheeseI18n.t('shell.api.title'),
        message: content,
        buttons: [
            {
                id: 'api-key-create',
                label: CheeseI18n.t('shell.api.create'),
                cssClass: 'btn-primary',
                action(dialog: BootstrapDialogInstance) {
                    confirmIf(
                        hasKey,
                        CheeseI18n.t('shell.api.replaceConfirm'),
                        CheeseI18n.t('shell.api.replace'),
                        () => {
                            gtag('event', 'api-key-create');
                            call<ApiKeyCreated>(dialog, 'apiKeyCreate', result => {
                                showStatus({
                                    exists: true,
                                    hint: result.hint,
                                    createdAt: result.createdAt,
                                    lastUsedAt: null
                                });
                                showNewKey(result.key);
                            });
                        }
                    );
                }
            },
            {
                id: 'api-key-revoke',
                label: CheeseI18n.t('shell.api.revoke'),
                cssClass: 'btn-outline-danger d-none',
                action(dialog: BootstrapDialogInstance) {
                    confirmIf(true, CheeseI18n.t('shell.api.revokeConfirm'), CheeseI18n.t('shell.api.revoke'), () => {
                        gtag('event', 'api-key-revoke');
                        call<ApiKeyStatus>(dialog, 'apiKeyRevoke', result => {
                            hideNewKey();
                            showStatus(result);
                        });
                    });
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
    call<ApiKeyStatus>(dialog, 'apiKeyStatus', showStatus);
}
