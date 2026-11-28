import { render } from './template.js';
import restoreButtonTemplate from './templates/modeless-restore-button.html';

const MODELESS_DIALOGS = 'body > .bootstrap-dialog.cheesefork-modeless-dialog';
const BASE_Z_INDEX = 1000;

function zIndex(element: JQuery): number {
    return Number(element.css('z-index'));
}

// Moves the modeless dialogs above the given z-index down by one, so the dialogs keep
// consecutive z-indexes from BASE_Z_INDEX after one is closed or brought to the top.
function lowerDialogsAbove(modelessDialogs: JQuery, prevZIndex: number): void {
    modelessDialogs.each(function () {
        const iter = $(this);
        if (zIndex(iter) > prevZIndex) {
            iter.css('z-index', zIndex(iter) - 1);
        }
    });
}

// Shows a dialog with a button that makes it modeless: it stays open, draggable, while the page
// is used. Modeless dialogs are stacked, and a click brings one to the top.
export function showBootstrapDialogWithModelessButton(
    dialogName: string,
    options: BootstrapDialogOptions
): BootstrapDialogInstance {
    const newOptions: BootstrapDialogOptions = $.extend({}, options, {
        onshow(dialog: BootstrapDialogInstance) {
            const restoreButton = $(render(restoreButtonTemplate)).css(
                CheeseI18n.isRTL() ? 'margin-right' : 'margin-left',
                'auto'
            );

            dialog.getModalHeader().find('.bootstrap-dialog-close-button').before(restoreButton);

            restoreButton.click(() => {
                gtag('event', `bootstrap-dialog-restore-${dialogName}`);

                restoreButton.hide();

                $('body')
                    .removeClass('modal-open')
                    .css({
                        'padding-right': ''
                    })
                    .find('> .modal-backdrop')
                    .hide();

                const numOfModelessDialogs = $(MODELESS_DIALOGS).length;

                const thatDialogModal = dialog.getModal();
                thatDialogModal
                    .removeClass('modal')
                    .addClass('cheesefork-modeless-dialog')
                    .css('z-index', BASE_Z_INDEX + numOfModelessDialogs)
                    .click(() => {
                        const modelessDialogs = $(MODELESS_DIALOGS);
                        const prevZIndex = zIndex(thatDialogModal);
                        if (prevZIndex < BASE_Z_INDEX + modelessDialogs.length - 1) {
                            lowerDialogsAbove(modelessDialogs, prevZIndex);
                            thatDialogModal.css('z-index', BASE_Z_INDEX + modelessDialogs.length - 1);
                        }
                    });

                dialog.options.draggable = true;
                dialog.makeModalDraggable();
            });

            if (options.onshow) {
                options.onshow(dialog);
            }
        },
        onhidden(dialog: BootstrapDialogInstance) {
            const modelessDialogs = $(MODELESS_DIALOGS);
            const prevZIndex = zIndex(dialog.getModal());
            if (prevZIndex < BASE_Z_INDEX + modelessDialogs.length - 1) {
                lowerDialogsAbove(modelessDialogs, prevZIndex);
            }

            if (options.onhidden) {
                options.onhidden(dialog);
            }
        }
    });

    return BootstrapDialog.show(newOptions);
}
