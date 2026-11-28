const types = ['DEFAULT', 'INFO', 'PRIMARY', 'SECONDARY', 'SUCCESS', 'WARNING', 'DANGER', 'DARK', 'LIGHT'];
types.forEach(type => {
    BootstrapDialog.DEFAULT_TEXTS[BootstrapDialog[`TYPE_${type}`]] = CheeseI18n.t(`shell.dialog.${type.toLowerCase()}`);
});
['OK', 'CANCEL', 'CONFIRM'].forEach(label => {
    BootstrapDialog.DEFAULT_TEXTS[label] = CheeseI18n.t(`shell.dialog.${label.toLowerCase()}`);
});
const createCloseButton = BootstrapDialog.prototype.createCloseButton;
BootstrapDialog.prototype.createCloseButton = function (this: BootstrapDialogInstance): JQuery {
    const button = createCloseButton.call(this);
    button.find('button.close').attr('aria-label', CheeseI18n.t('shell.dialog.close'));
    return button;
};

export {};
