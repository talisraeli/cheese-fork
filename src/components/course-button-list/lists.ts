import type { CourseButtonList } from './course-button-list.js';

// The lists of the courses and custom events, one for each layer, and their items.

export function getAllLists(that: CourseButtonList) {
    return that.element.find('ul.course-button-list-badge-container');
}

export function getLayerList(that: CourseButtonList, layerId?: string) {
    if (!layerId) {
        return that.badgeContainer;
    }

    return getAllLists(that).filter(`[data-layer-id="${layerId}"]`);
}

export function getListLayerId(list: JQuery) {
    return list.attr('data-layer-id') || '';
}

// If layerId is undefined, returns the items of the course in all layers.
export function findCourseItems(that: CourseButtonList, course: string, layerId?: string) {
    const lists = layerId === undefined ? getAllLists(that) : getLayerList(that, layerId);
    return lists.find(`li.list-group-item[data-course-number="${course}"]`);
}

export function findCustomEventItem(that: CourseButtonList, eventId: string) {
    return getAllLists(that)
        .find('li.course-button-list-custom-event')
        .filter(function () {
            return $(this).attr('data-custom-event-id') === String(eventId);
        });
}

// The CSS colors of a selected course, same as its events in the calendar.
export function courseColors(that: CourseButtonList, course: string, layerId?: string) {
    return {
        'background-color': that.colorGenerator(course, null, layerId),
        color: that.textColorGenerator(course, null, layerId)
    };
}

// Same as the colors of the event in the calendar, which is identified by the full event id.
export function customEventColors(that: CourseButtonList, eventId: string, title: string) {
    return {
        'background-color': that.colorGenerator(title, `custom_event_${eventId}`),
        color: that.textColorGenerator(title, `custom_event_${eventId}`)
    };
}

// Custom events are listed after the courses of the layer.
export function moveCustomEventsToEnd(list: JQuery) {
    list.append(list.children('li.course-button-list-custom-event'));
}
