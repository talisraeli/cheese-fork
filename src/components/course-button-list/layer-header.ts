import type { Layer } from '../../lib/schedule-types.js';
import type { CourseButtonList } from './course-button-list.js';
import { render } from '../../lib/template.js';
import { getAllLists, getLayerList } from './lists.js';
import layerCollapseTemplate from './templates/layer-collapse.html';
import layerMenuTemplate from './templates/layer-menu.html';
import layerVisibilityTemplate from './templates/layer-visibility.html';

// The header of a layer: its visibility, its name, collapsing it, and its menu.

export function makeLayerHeader(that: CourseButtonList, layer: Layer) {
    const header = $('<div class="course-button-list-layer-header">').attr('data-layer-id', layer.id);

    const visibility = $(render(layerVisibilityTemplate));
    visibility.find('i').addClass(layer.hidden ? 'fa-square' : 'fa-check-square');

    const name = $('<span class="course-button-list-layer-name">').text(layer.name);

    // Collapsing only folds the layer's list, the layer stays on the calendar.
    // It's a view preference, so it's available in a readonly schedule too.
    const collapse = $(render(layerCollapseTemplate));
    collapse
        .on('click', () => {
            setLayerCollapsed(that, layer, !layer.collapsed);
            that.onLayerCollapseChange(layer.id, !!layer.collapsed);
        })
        .on('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                $(this).trigger('click');
            }
        });

    header.append(collapse, visibility, name);

    if (that.readonly) {
        return header;
    }

    const menu = $(render(layerMenuTemplate));

    header.append(menu);

    header.click(e => {
        // Clicking on the header selects the layer for adding new
        // courses and events, unless one of the controls was clicked.
        if (
            $(e.target).closest(
                '.course-button-list-layer-collapse, .course-button-list-layer-visibility, .course-button-list-layer-menu'
            ).length === 0
        ) {
            that.setActiveLayer(layer.id);
        }
    });

    visibility.attr('title', CheeseI18n.t('courses.layers.toggleVisibility')).click(() => {
        that.onLayerVisibilityChange(layer.id, !layer.hidden);
    });

    menu.find('.course-button-list-layer-rename').click(e => {
        e.preventDefault();
        showLayerRenameDialog(that, layer);
    });

    menu.find('.course-button-list-layer-add').click(e => {
        e.preventDefault();
        that.onLayerCreate(null, null);
    });

    menu.find('.course-button-list-layer-duplicate').click(e => {
        e.preventDefault();
        that.onLayerDuplicate(layer.id);
    });

    menu.find('.course-button-list-layer-delete').click(e => {
        e.preventDefault();
        showLayerDeleteDialog(that, layer);
    });

    return header;
}

export function showLayerRenameDialog(that: CourseButtonList, layer: Layer) {
    const input = $('<input type="text" class="form-control" maxlength="20">').val(layer.name);

    const rename = (dialog: BootstrapDialogInstance) => {
        dialog.close();

        const name = String(input.val()).trim();
        if (name !== '' && name !== layer.name) {
            that.onLayerRename(layer.id, name);
        }
    };

    BootstrapDialog.show({
        title: CheeseI18n.t('courses.layers.renameTitle'),
        message: input,
        onshown(dialog: BootstrapDialogInstance) {
            input
                .focus()
                .select()
                .keydown(e => {
                    if (e.key === 'Enter') {
                        rename(dialog);
                    }
                });
        },
        buttons: [
            {
                label: CheeseI18n.t('courses.layers.save'),
                cssClass: 'btn-primary',
                action: rename
            },
            {
                label: CheeseI18n.t('courses.close'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            }
        ]
    });
}

export function showLayerDeleteDialog(that: CourseButtonList, layer: Layer) {
    const message = $('<div>').text(CheeseI18n.t('courses.layers.deleteMessage', { name: layer.name }));

    BootstrapDialog.show({
        title: CheeseI18n.t('courses.layers.deleteTitle'),
        message,
        buttons: [
            {
                label: CheeseI18n.t('courses.layers.deleteConfirm'),
                cssClass: 'btn-danger',
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                    that.onLayerDelete(layer.id);
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
}

// Shows the layer's list folded or unfolded, and updates its header's toggle to match.
export function setLayerCollapsed(that: CourseButtonList, layer: Layer, collapsed: boolean) {
    layer.collapsed = collapsed;

    getLayerList(that, layer.id).toggleClass('course-button-list-layer-collapsed', collapsed);

    const header = that.element.find('.course-button-list-layer-header').filter(function () {
        return $(this).attr('data-layer-id') === layer.id;
    });
    header.toggleClass('course-button-list-layer-header-collapsed', collapsed);

    const collapsedIcon = CheeseI18n.isRTL() ? 'fa-caret-left' : 'fa-caret-right';
    header
        .find('.course-button-list-layer-collapse')
        .attr({
            title: CheeseI18n.t(collapsed ? 'courses.layers.expand' : 'courses.layers.collapse'),
            'aria-expanded': collapsed ? 'false' : 'true'
        })
        .find('i')
        .removeClass('fa-caret-down fa-caret-left fa-caret-right')
        .addClass(collapsed ? collapsedIcon : 'fa-caret-down');
}

export function removeLayers(that: CourseButtonList) {
    that.element.find('.course-button-list-layer-header').remove();
    getAllLists(that).not(that.badgeContainer).remove();
    that.badgeContainer.removeClass(
        'course-button-list-layer-hidden course-button-list-layer-active course-button-list-layer-collapsed'
    );
    that.element.removeClass('course-button-list-with-layers');
    that.layers = [];
}
