import { showBootstrapDialogWithModelessButton } from '../../lib/modeless-dialog.js';
import { render } from '../../lib/template.js';
import deleteAreaTemplate from './templates/delete-area.html';
import newLayerAreaTemplate from './templates/new-layer-area.html';
import dragHandleTemplate from './templates/drag-handle.html';
import courseItemTemplate from './templates/course-item.html';
import infoBadgeTemplate from './templates/info-badge.html';
import infoDialogTemplate from './templates/info-dialog.html';
import tooltipTemplate from './templates/tooltip.html';
import { setInfoDialogContent } from './course-info-dialog.js';
import { makeLayerHeader, removeLayers, setLayerCollapsed } from './layer-header.js';
import {
    courseColors,
    customEventColors,
    findCourseItems,
    findCustomEventItem,
    getAllLists,
    getLayerList,
    getListLayerId,
    moveCustomEventsToEnd
} from './lists.js';

import type { CourseManager } from '../../lib/course-manager.js';
import type { ColorGenerator, Layer } from '../../lib/schedule-types.js';

export interface CourseButtonListOptions {
    courseManager: CourseManager;
    colorGenerator: ColorGenerator;
    textColorGenerator?: ColorGenerator;
    readonly?: boolean;
    onHoverIn: (course: string, layerId: string) => void;
    onHoverOut: (course: string, layerId: string) => void;
    onEnableCourse: (course: string, layerId: string) => void;
    onDisableCourse: (course: string, layerId: string) => void;
    // The courses of the layer were reordered by dragging.
    onReorder: (layerId: string) => void;
    onCourseMove: (course: string, fromLayerId: string, toLayerId: string) => void;
    // A new layer, empty or with the course or the custom event dragged to it.
    onLayerCreate: (course: string | null, fromLayerId: string | null, customEventId?: string) => void;
    onLayerDuplicate: (layerId: string) => void;
    onLayerRename: (layerId: string, name: string) => void;
    onLayerDelete: (layerId: string) => void;
    onLayerVisibilityChange: (layerId: string, hidden: boolean) => void;
    onLayerCollapseChange?: (layerId: string, collapsed: boolean) => void;
    onCustomEventHoverIn: (eventId: string) => void;
    onCustomEventHoverOut: (eventId: string) => void;
    onCustomEventMove: (eventId: string, fromLayerId: string, toLayerId: string) => void;
    onCustomEventRemove: (eventId: string, layerId: string) => void;
}

// The list of the schedule's courses and custom events, by layer, whose items are dragged
// to reorder them, to move them to another layer, or to remove them.
export class CourseButtonList {
    readonly element: JQuery;
    readonly courseManager: CourseManager;
    readonly colorGenerator: ColorGenerator;
    readonly textColorGenerator: ColorGenerator;
    readonly readonly: boolean | undefined;
    readonly onHoverIn: CourseButtonListOptions['onHoverIn'];
    readonly onHoverOut: CourseButtonListOptions['onHoverOut'];
    readonly onEnableCourse: CourseButtonListOptions['onEnableCourse'];
    readonly onDisableCourse: CourseButtonListOptions['onDisableCourse'];
    readonly onReorder: CourseButtonListOptions['onReorder'];
    readonly onCourseMove: CourseButtonListOptions['onCourseMove'];
    readonly onLayerCreate: CourseButtonListOptions['onLayerCreate'];
    readonly onLayerDuplicate: CourseButtonListOptions['onLayerDuplicate'];
    readonly onLayerRename: CourseButtonListOptions['onLayerRename'];
    readonly onLayerDelete: CourseButtonListOptions['onLayerDelete'];
    readonly onLayerVisibilityChange: CourseButtonListOptions['onLayerVisibilityChange'];
    readonly onLayerCollapseChange: (layerId: string, collapsed: boolean) => void;
    readonly onCustomEventHoverIn: CourseButtonListOptions['onCustomEventHoverIn'];
    readonly onCustomEventHoverOut: CourseButtonListOptions['onCustomEventHoverOut'];
    readonly onCustomEventMove: CourseButtonListOptions['onCustomEventMove'];
    readonly onCustomEventRemove: CourseButtonListOptions['onCustomEventRemove'];
    sortableInitialized = false;
    // Layers are optional. Without layers (the default), there's only the first
    // list, badgeContainer, which belongs to the first layer with an empty id.
    layers: Layer[] = [];
    activeLayerId = '';
    readonly badgeContainer: JQuery;
    // The drop areas, shown while dragging, unless readonly.
    readonly deleteArea: JQuery | undefined;
    readonly newLayerArea: JQuery | undefined;
    readonly dropAreas: JQuery | undefined;
    infoDialogs: BootstrapDialogInstance[] = [];

    constructor(element: JQuery, options: CourseButtonListOptions) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        // The text color for a background color of colorGenerator, same arguments. White by default.
        this.textColorGenerator = options.textColorGenerator || (() => 'white');
        this.readonly = options.readonly;
        this.onHoverIn = options.onHoverIn;
        this.onHoverOut = options.onHoverOut;
        this.onEnableCourse = options.onEnableCourse;
        this.onDisableCourse = options.onDisableCourse;
        this.onReorder = options.onReorder;
        this.onCourseMove = options.onCourseMove;
        this.onLayerCreate = options.onLayerCreate;
        this.onLayerDuplicate = options.onLayerDuplicate;
        this.onLayerRename = options.onLayerRename;
        this.onLayerDelete = options.onLayerDelete;
        this.onLayerVisibilityChange = options.onLayerVisibilityChange;
        // Called with the layer id and whether it's collapsed, when the user collapses or expands it.
        this.onLayerCollapseChange = options.onLayerCollapseChange || (() => {});
        this.onCustomEventHoverIn = options.onCustomEventHoverIn;
        this.onCustomEventHoverOut = options.onCustomEventHoverOut;
        this.onCustomEventMove = options.onCustomEventMove;
        this.onCustomEventRemove = options.onCustomEventRemove;

        const that = this;

        that.sortableInitialized = false;

        // Layers are optional. Without layers (the default), there's only the first
        // list, badgeContainer, which belongs to the first layer with an empty id.
        that.layers = [];
        that.activeLayerId = '';

        if (that.readonly) {
            that.element.addClass('course-button-list-readonly');
        }

        // Create a wrapper container inside the element for the badges
        this.badgeContainer = $('<ul class="course-button-list-badge-container list-group">');
        that.element.append(that.badgeContainer);

        // Create drop areas, shown while dragging: drag-to-delete, and
        // drag to move the course to a new layer (only if not readonly)
        if (!that.readonly) {
            this.deleteArea = $(render(deleteAreaTemplate));
            this.newLayerArea = $(render(newLayerAreaTemplate));
            this.dropAreas = $('<div class="course-button-list-drop-areas">').append(
                this.newLayerArea,
                this.deleteArea
            );
            this.dropAreas.hide();
            this.element.append(this.dropAreas);
        }

        that.infoDialogs = [];
    }

    // Sets the layers to show, an array of { id, name, hidden, collapsed } with the first layer (which
    // has an empty id) first, or an empty array for no layers. Call it for an empty list,
    // before adding the courses.
    setLayers(layers: Layer[]) {
        const that = this;

        that.destroySortable();
        removeLayers(that);

        that.layers = layers;

        if (!layers.some(layer => layer.id === that.activeLayerId)) {
            that.activeLayerId = '';
        }

        if (layers.length === 0) {
            return;
        }

        that.element.addClass('course-button-list-with-layers');

        layers.forEach(layer => {
            let list = that.badgeContainer;
            if (layer.id) {
                list = $('<ul class="course-button-list-badge-container list-group">').attr('data-layer-id', layer.id);
                if (that.dropAreas) {
                    list.insertBefore(that.dropAreas);
                } else {
                    that.element.append(list);
                }
            }

            list.toggleClass('course-button-list-layer-hidden', !!layer.hidden);
            makeLayerHeader(that, layer).insertBefore(list);
            setLayerCollapsed(that, layer, !!layer.collapsed);
        });

        that.setActiveLayer(that.activeLayerId);

        // Empty layers should be able to receive courses.
        that.initializeSortableIfNeeded();
    }

    // Unfolds the layer if it's collapsed, for example to show an item which was added to it.
    expandLayer(layerId: string) {
        const that = this;

        const layer = that.layers.filter(layer => layer.id === layerId)[0];

        if (layer && layer.collapsed) {
            setLayerCollapsed(that, layer, false);
            that.onLayerCollapseChange(layer.id, false);
        }
    }

    // The active layer is the layer to which new courses and custom events are added.
    getActiveLayerId() {
        return this.activeLayerId;
    }

    setActiveLayer(layerId: string) {
        const that = this;

        that.activeLayerId = layerId;

        if (!that.readonly) {
            that.element.find('.course-button-list-layer-header').each(function () {
                $(this).toggleClass('course-button-list-layer-active', $(this).attr('data-layer-id') === layerId);
            });
        }
    }

    addCourse(course: string, layerId?: string) {
        const that = this;

        const list = getLayerList(that, layerId);

        const courseTitle = that.courseManager.getTitle(course);

        // A wrapper div for proper word wrapping of the content text.
        const spanAbsolute = $('<div class="content-wrapper">')
            .empty()
            .append(
                $('<span class="content-absolute">')
                    .text(courseTitle)
                    .attr({ lang: /[א-ת]/.test(courseTitle) ? 'he' : 'en', dir: 'auto' })
            );
        const spanBoldHidden = $('<span class="content-bold-hidden">')
            .text(courseTitle)
            .attr({ lang: /[א-ת]/.test(courseTitle) ? 'he' : 'en', dir: 'auto' });

        // Create drag handle (only visible when not readonly)
        const dragHandle = $(render(dragHandleTemplate));

        const button = $(render(courseItemTemplate, { course }));
        const badge = $(render(infoBadgeTemplate));
        button
            .css(courseColors(that, course, layerId))
            .click(function () {
                if (!that.readonly) {
                    onCourseButtonClick($(this), course);
                }
            })
            .hover(
                function () {
                    $(this).addClass('course-button-list-item-hovered');
                    that.onHoverIn(course, getListLayerId($(this).parent()));
                },
                function () {
                    $(this).removeClass('course-button-list-item-hovered');
                    that.onHoverOut(course, getListLayerId($(this).parent()));
                }
            )
            .append(dragHandle, spanAbsolute, spanBoldHidden, badge);

        // Add tooltip to badge.
        const courseDescriptionHtml = that.courseManager.getDescription(course, { html: true });
        badge
            .hover(
                function () {
                    $(this).removeClass('badge-secondary');
                    $(this).addClass('badge-primary');
                },
                function () {
                    $(this).removeClass('badge-primary');
                    $(this).addClass('badge-secondary');
                }
            )
            .click(function (e) {
                e.stopPropagation(); // don't execute parent button onclick

                gtag('event', 'course-button-list-info-click');

                const firstTimeTooltipBadge = getAllLists(that).find('[data-special-tooltip="first-time"]');
                if (firstTimeTooltipBadge.length > 0) {
                    firstTimeTooltipBadge.tooltip('dispose');
                    addTooltipToBadge(firstTimeTooltipBadge, courseDescriptionHtml, false);
                    try {
                        localStorage.setItem('dontShowHistogramsTip', Date.now().toString());
                    } catch (e) {
                        // localStorage is not available in IE/Edge when running from a local file.
                    }
                }

                $(this).tooltip('hide');
                showBootstrapDialogWithModelessButton('course-info', {
                    title: courseTitle,
                    size: BootstrapDialog.SIZE_WIDE,
                    message: render(infoDialogTemplate),
                    onshow(dialog: BootstrapDialogInstance) {
                        that.infoDialogs.push(dialog);

                        setInfoDialogContent(dialog, course, that.courseManager);
                    },
                    onhidden(dialog: BootstrapDialogInstance) {
                        const index = that.infoDialogs.indexOf(dialog);
                        if (index !== -1) {
                            that.infoDialogs.splice(index, 1);
                        }
                    }
                });
            });

        let showFirstTimeTooltip = false;
        if (getAllLists(that).find('li.list-group-item[data-course-number]:first').length === 0) {
            try {
                showFirstTimeTooltip = !localStorage.getItem('dontShowHistogramsTip');
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        let tooltipHtml = courseDescriptionHtml;
        if (showFirstTimeTooltip) {
            tooltipHtml = $('<div>').text(CheeseI18n.t('courses.histogramsReviewsTip')).html();
        }

        addTooltipToBadge(badge, tooltipHtml, showFirstTimeTooltip);

        list.append(button);
        moveCustomEventsToEnd(list);

        // Initialize sortable after first course is added
        that.initializeSortableIfNeeded();

        if (showFirstTimeTooltip) {
            // Without setTimeout, if the list is hidden, the tooltip won't
            // scroll with the list once the list is shown.
            setTimeout(() => {
                badge.tooltip('show');
            }, 0);
        }

        function addTooltipToBadge(badge: JQuery, tooltipHtml: string, firstTimeTooltip: boolean): void {
            let trigger: 'hover' | 'manual' = 'hover';
            let extraClass = '';
            let extraClassInner = '';
            if (firstTimeTooltip) {
                trigger = 'manual';
                extraClass = ' course-button-list-tooltip-persistent';
                badge.attr('data-special-tooltip', 'first-time');
            } else {
                extraClassInner = ' course-description-tooltip-inner';
                badge.removeAttr('data-special-tooltip');
            }

            badge
                .prop('title', tooltipHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({
                    html: true,
                    placement: 'right',
                    template: render(tooltipTemplate, { extraClass, extraClassInner }),
                    trigger
                });
        }

        function onCourseButtonClick(button: JQuery, course: string) {
            if (button.hasClass('active')) {
                button.removeClass('active').removeClass('course-button-list-item-conflicted');
                button
                    .find('.content-absolute')
                    .removeClass('course-button-list-content-has-hidden')
                    .tooltip('dispose');
                button.css({ 'background-color': '', color: '' });
                that.onDisableCourse(course, getListLayerId(button.parent()));
            } else {
                button.addClass('active');
                button.css(courseColors(that, course, getListLayerId(button.parent())));
                that.onEnableCourse(course, getListLayerId(button.parent()));
            }
        }
    }

    initializeSortableIfNeeded() {
        const that = this;

        // Don't initialize if already done, or if readonly
        if (that.sortableInitialized || that.readonly) {
            return;
        }

        // Don't initialize if no courses yet, unless there are layers to drag courses to
        if (that.layers.length === 0 && that.badgeContainer.find('li.list-group-item').length === 0) {
            return;
        }

        that.sortableInitialized = true;

        // Track if item should be deleted or moved to a new layer, and original position
        let shouldDelete = false;
        let shouldCreateLayer = false;
        let cachedHeight = 0;
        let originalIndex = -1;
        let originalList: JQuery = $();

        // Initialize jQuery UI sortable, the lists of the layers are connected
        getAllLists(that).sortable({
            handle: '.course-button-list-drag-handle',
            placeholder: 'course-button-list-item ui-sortable-placeholder',
            tolerance: 'pointer',
            cursor: 'move',
            opacity: 0.8,
            delay: 100, // Helps distinguish between click and drag
            distance: 5, // Minimum distance to start drag
            // Keep the dragged item inside the page, otherwise dragging it past the edge
            // enlarges the page and makes it scroll (mostly noticeable on touch screens).
            // Not 'document' or 'window', which don't account for the item size or scrolling.
            containment: 'body',
            connectWith: '.course-button-list-badge-container, .course-button-list-delete-area',

            // Helper event - fires before start, get height while item is still visible.
            // jQuery UI passes the item as a jQuery object, and accepts one, unlike its published types.
            helper: ((event: JQuery.TriggeredEvent, item: JQuery): JQuery => {
                // Cache the height before the item gets hidden
                cachedHeight = item.outerHeight() as number;
                return item.clone();
            }) as unknown as JQueryUI.SortableOptions['helper'],

            // Start event - clean up UI and show delete area
            start(event, ui) {
                shouldDelete = false;
                shouldCreateLayer = false;

                // Store the original list and index to detect if position changed
                originalList = ui.item.parent();
                originalIndex = ui.item.index();

                // Hide any visible tooltips
                getAllLists(that).find('[data-toggle="tooltip"]').tooltip('hide');

                // Add helper class for additional styling
                ui.helper.addClass('ui-sortable-helper');

                // Set placeholder height using cached value (item is still visible when cached)
                ui.placeholder.outerHeight(cachedHeight);

                // Show drop areas (if they exist)
                if (that.dropAreas) {
                    that.dropAreas.fadeIn(150);
                }
            },

            // Stop event - save new order or delete course
            stop(event, ui) {
                // Hide drop areas (if they exist)
                if (that.dropAreas) {
                    that.dropAreas.fadeOut(150);
                }

                // Missing only for custom events, which are handled first.
                const course = ui.item.attr('data-course-number') as string;
                const selected = ui.item.hasClass('active');
                const originalLayerId = getListLayerId(originalList);
                const newList = ui.item.parent();
                const newLayerId = getListLayerId(newList);

                const customEventId = ui.item.attr('data-custom-event-id');
                if (customEventId !== undefined) {
                    const wasDeleted = shouldDelete;
                    const wasMovedToNewLayer = shouldCreateLayer;

                    // Custom events have no order. Put the item back, the list is rebuilt if needed.
                    originalList.sortable('cancel');

                    // Not from within the callback, since the sortable is destroyed.
                    setTimeout(() => {
                        if (wasDeleted) {
                            that.onCustomEventRemove(customEventId, originalLayerId);
                        } else if (wasMovedToNewLayer) {
                            that.onLayerCreate(null, originalLayerId, customEventId);
                        } else if (newLayerId !== originalLayerId) {
                            that.onCustomEventMove(customEventId, originalLayerId, newLayerId);
                        }
                    }, 0);
                } else if (shouldDelete) {
                    // Remove the item from DOM
                    ui.item.remove();

                    // Call onDisableCourse to handle the deletion
                    if (course && that.onDisableCourse) {
                        that.onDisableCourse(course, originalLayerId);
                    }
                } else if (shouldCreateLayer) {
                    // Put the item back, the list is rebuilt once the layer is created.
                    originalList.sortable('cancel');

                    if (selected) {
                        // Not from within the callback, since the sortable is destroyed.
                        setTimeout(() => {
                            that.onLayerCreate(course, originalLayerId);
                        }, 0);
                    }
                } else if (newLayerId !== originalLayerId) {
                    if (newList.find(`li.list-group-item[data-course-number="${course}"]`).length > 1) {
                        // The course is already in the target layer.
                        originalList.sortable('cancel');
                    } else if (selected) {
                        // Not from within the callback, since the sortable is destroyed.
                        setTimeout(() => {
                            that.onCourseMove(course, originalLayerId, newLayerId);
                        }, 0);
                    }
                } else {
                    // Only call onReorder if position actually changed
                    const newIndex = ui.item.index();
                    if (newIndex !== originalIndex && that.onReorder) {
                        that.onReorder(newLayerId);
                    }

                    moveCustomEventsToEnd(newList);
                }

                shouldDelete = false;
                shouldCreateLayer = false;
            }
        });

        // Make delete area droppable (only if it exists)
        if (that.deleteArea) {
            that.deleteArea.droppable({
                accept: '.course-button-list-item',
                tolerance: 'pointer',
                hoverClass: 'ui-droppable-hover',
                over(event, ui) {
                    shouldDelete = true;
                },
                out(event, ui) {
                    shouldDelete = false;
                }
            });
        }

        // Make new layer area droppable (only if it exists)
        if (that.newLayerArea) {
            that.newLayerArea.droppable({
                accept: '.course-button-list-item',
                tolerance: 'pointer',
                hoverClass: 'ui-droppable-hover',
                over(event, ui) {
                    shouldCreateLayer = true;
                },
                out(event, ui) {
                    shouldCreateLayer = false;
                }
            });
        }
    }

    destroySortable() {
        const that = this;

        if (that.sortableInitialized) {
            getAllLists(that).each(function () {
                try {
                    $(this).sortable('destroy');
                } catch (e) {
                    // Sortable may not be initialized, ignore
                }
            });

            if (that.deleteArea) {
                try {
                    that.deleteArea.droppable('destroy');
                } catch (e) {
                    // Droppable may not be initialized, ignore
                }
            }

            if (that.newLayerArea) {
                try {
                    that.newLayerArea.droppable('destroy');
                } catch (e) {
                    // Droppable may not be initialized, ignore
                }
            }

            that.sortableInitialized = false;
        }
    }

    setFloatingCourseInfo(course: string) {
        const that = this;

        if (that.infoDialogs.length === 0) {
            return;
        }

        const dialog = that.infoDialogs[that.infoDialogs.length - 1];

        const courseTitle = that.courseManager.getTitle(course);
        if (dialog.getTitle() === courseTitle) {
            return; // already showing this course
        }

        dialog.setTitle(courseTitle);

        setInfoDialogContent(dialog, course, that.courseManager);
    }

    // Custom events are shown in the list for removing them, or for moving them between layers.
    addCustomEvent(eventId: string, title: string, layerId: string) {
        const that = this;

        // Same structure as of a course item, see addCourse.
        const spanAbsolute = $('<div class="content-wrapper">')
            .empty()
            .append($('<span class="content-absolute">').text(title));
        const spanBoldHidden = $('<span class="content-bold-hidden">').text(title);

        const dragHandle = $(render(dragHandleTemplate));

        const item = $('<li class="list-group-item active course-button-list-item course-button-list-custom-event">')
            .attr('data-custom-event-id', eventId)
            .css(customEventColors(that, eventId, title))
            .hover(
                function () {
                    $(this).addClass('course-button-list-item-hovered');
                    that.onCustomEventHoverIn($(this).attr('data-custom-event-id') as string);
                },
                function () {
                    $(this).removeClass('course-button-list-item-hovered');
                    that.onCustomEventHoverOut($(this).attr('data-custom-event-id') as string);
                }
            )
            .append(dragHandle, spanAbsolute, spanBoldHidden);

        getLayerList(that, layerId).append(item);

        that.initializeSortableIfNeeded();
    }

    updateCustomEvent(eventId: string, title: string) {
        const item = findCustomEventItem(this, eventId);
        item.find('.content-absolute, .content-bold-hidden').text(title);
        item.css(customEventColors(this, eventId, title));
    }

    removeCustomEvent(eventId: string) {
        findCustomEventItem(this, eventId).remove();
    }

    // In the functions below, an undefined layerId means all layers.

    setHovered(course: string, layerId?: string) {
        findCourseItems(this, course, layerId).addClass('course-button-list-item-hovered');
    }

    removeHovered(course: string, layerId?: string) {
        findCourseItems(this, course, layerId).removeClass('course-button-list-item-hovered');
    }

    setConflicted(course: string, layerId?: string) {
        findCourseItems(this, course, layerId).addClass('course-button-list-item-conflicted');
    }

    removeConflicted(course: string, layerId?: string) {
        findCourseItems(this, course, layerId).removeClass('course-button-list-item-conflicted');
    }

    setLessonTypesHidden(course: string, lessonTypesHidden: string[], layerId?: string) {
        const listGroupTextItem = findCourseItems(this, course, layerId).find('.content-absolute');

        if (lessonTypesHidden.length > 0) {
            const courseManager = this.courseManager;
            const types = lessonTypesHidden
                .slice()
                .sort()
                .map(type => courseManager.getLessonTypeLabel(type));
            const title = CheeseI18n.t('courses.hiddenLessonTypes', { types: types.join(', ') });
            const titleHtml = $('<div>').text(title).html().replace(/\n/g, '<br>');

            listGroupTextItem
                .addClass('course-button-list-content-has-hidden')
                .tooltip('dispose')
                .prop('title', titleHtml)
                .attr('data-toggle', 'tooltip')
                .tooltip({
                    html: true,
                    placement: 'bottom'
                });
        } else {
            listGroupTextItem.removeClass('course-button-list-content-has-hidden').tooltip('dispose');
        }
    }

    // Re-applies colorGenerator to the selected courses, call after a custom color changes.
    updateColors() {
        const that = this;

        getAllLists(that)
            .find('li.list-group-item.active')
            .each(function () {
                const item = $(this);
                const customEventId = item.attr('data-custom-event-id');
                item.css(
                    customEventId !== undefined
                        ? customEventColors(that, customEventId, item.find('.content-bold-hidden').text())
                        : courseColors(that, item.attr('data-course-number') as string, getListLayerId(item.parent()))
                );
            });
    }

    isCourseInList(course: string, layerId?: string) {
        return findCourseItems(this, course, layerId).length > 0;
    }

    // Each course is returned once, even if it's in several layers.
    getCourseNumbers(onlySelected: boolean, layerId?: string): string[] {
        const that = this;

        let selector = 'li.list-group-item[data-course-number]';
        if (onlySelected) {
            selector += '.active';
        }

        const lists = layerId === undefined ? getAllLists(that) : getLayerList(that, layerId);

        const courseNumbers: string[] = [];
        lists.find(selector).each(function () {
            // Selected by having it.
            const course = $(this).attr('data-course-number') as string;
            if (!courseNumbers.includes(course)) {
                courseNumbers.push(course);
            }
        });

        return courseNumbers;
    }

    clear() {
        getAllLists(this).find('[data-toggle="tooltip"]').tooltip('hide');
        this.destroySortable();
        removeLayers(this);
        this.badgeContainer.empty();
    }
}
