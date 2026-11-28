import type { Moment } from 'moment';
import type { CourseCalendar } from './course-calendar.js';
import { isLessonEvent, type LessonEvent, type ScheduleEvent } from './calendar-types.js';
import { render } from '../../lib/template.js';
import {
    areEventsOverlapping,
    calendarWeek,
    getCourseClassName,
    getCourseConflictedStatus,
    getCourseHiddenLessonTypes,
    getEventLessonType,
    isSameCourse,
    makeCustomEvent,
    updateCalendarMaxDayAndTime,
    updateLessonEvent,
    updateLessonEvents
} from './lesson-events.js';
import { updateDynamicSizes } from './touch-scaling.js';
import colorButtonTemplate from './templates/color-button.html';

// What the calendar does when lessons and custom events are selected, clicked, hovered,
// dragged or resized, and when the window is resized.

export function initSelectLesson(
    events: LessonEvent[],
    courseNumber: string,
    lessonType: string,
    lessonNumber: number | string,
    layerId: string
): void {
    let selected = false;
    const conflictedIds: Record<string, number> = {};

    if (lessonNumber !== '-') {
        events.forEach(cbEvent => {
            if (
                calendarWeek(cbEvent.start) === 1 &&
                !cbEvent.selected &&
                isSameCourse(cbEvent, courseNumber, layerId) &&
                getEventLessonType(cbEvent) === lessonType &&
                cbEvent.lessonData['מס.'] === lessonNumber
            ) {
                cbEvent.selected = true;
                selected = true;

                markConflictedEvents(cbEvent);
            }
        });
    } else {
        selected = true;
    }

    if (selected) {
        events.forEach(cbEvent => {
            if (
                isSameCourse(cbEvent, courseNumber, layerId) &&
                getEventLessonType(cbEvent) === lessonType &&
                cbEvent.lessonData['מס.'] !== lessonNumber
            ) {
                // Different lesson number of the same course and type - can no longer be selected.
                cbEvent.start.add(7, 'days');
                cbEvent.end.add(7, 'days');

                if (lessonNumber === '-') {
                    cbEvent.lessonTypeHidden = true;
                }
            }

            if (conflictedIds[cbEvent.id]) {
                const weeks = conflictedIds[cbEvent.id];
                cbEvent.start.add(7 * weeks, 'days');
                cbEvent.end.add(7 * weeks, 'days');
            }
        });
    }

    function markConflictedEvents(event: LessonEvent): void {
        events.forEach(cbEvent => {
            if (cbEvent.layerId !== event.layerId) {
                return;
            }

            if (
                cbEvent.courseNumber === event.courseNumber &&
                getEventLessonType(cbEvent) === getEventLessonType(event)
            ) {
                return;
            }

            if (areEventsOverlapping(cbEvent, event)) {
                if (!conflictedIds[cbEvent.id]) {
                    conflictedIds[cbEvent.id] = 0;
                }
                conflictedIds[cbEvent.id]++;
            }
        });
    }
}

export function onSelect(this: CourseCalendar, start: Moment, end: Moment): void {
    const that = this;
    const calendar = that.element;

    BootstrapDialog.show({
        title: CheeseI18n.t('calendar.addCustomEvent'),
        message: $('<textarea>', {
            class: 'form-control',
            placeholder: CheeseI18n.t('calendar.eventDescription'),
            'aria-label': CheeseI18n.t('calendar.eventDescription'),
            dir: 'auto'
        }),
        onshown(dialog) {
            dialog.getModalBody().find('textarea').focus();
        },
        onhide(dialog) {
            calendar.fullCalendar('unselect');
        },
        buttons: [
            {
                label: CheeseI18n.t('calendar.add'),
                cssClass: 'btn-primary',
                action(dialog) {
                    dialog.close();

                    const eventTitle = String(dialog.getModalBody().find('textarea').val()).trim();
                    if (eventTitle === '') {
                        return;
                    }

                    let eventIdCounter = Math.round(Date.now() / 1000);
                    let eventId = `custom_event_${eventIdCounter}`;
                    while (calendar.fullCalendar<ScheduleEvent>('clientEvents', eventId).length > 0) {
                        eventIdCounter++;
                        eventId = `custom_event_${eventIdCounter}`;
                    }

                    const layerId = that.getActiveLayerId ? that.getActiveLayerId() : '';

                    calendar.fullCalendar<ScheduleEvent>(
                        'renderEvent',
                        makeCustomEvent(that, eventId, eventTitle, start, end, layerId)
                    );
                    updateCalendarMaxDayAndTime(calendar);

                    that.onCustomEventAdded(
                        eventIdCounter,
                        {
                            title: eventTitle,
                            start: start.format(),
                            end: end.format()
                        },
                        layerId
                    );
                }
            }
        ]
    });
}

// With a mouse, a click on an empty slot already selects it. With touch, selecting
// requires a long press which is hard to discover, so a tap selects the slot too.
export function onDayClick(this: CourseCalendar, date: Moment, jsEvent: JQuery.TriggeredEvent): void {
    if (this.readonly || !jsEvent || !jsEvent.type.startsWith('touch')) {
        return;
    }

    // Prevent the click that follows the tap, which would land on the dialog
    // that's about to be shown and close it.
    jsEvent.preventDefault();

    const calendar = this.element;

    // Wait for a long press selection which ends with the same touch, if any.
    setTimeout(() => {
        if (calendar.fullCalendar('getView').isSelected) {
            return;
        }

        // The option is undefined unless set, use FullCalendar's default in this case.
        const slotDuration = moment.duration(
            (calendar.fullCalendar('option', 'slotDuration') as string | undefined) || '00:30:00'
        );
        calendar.fullCalendar('select', date, date.clone().add(slotDuration));
    }, 0);
}

export function onEventInteractionStart(this: CourseCalendar): void {
    this.eventInteractionActive = true;
}

export function onEventInteractionStop(this: CourseCalendar): void {
    const that = this;

    that.eventInteractionActive = false;

    // FullCalendar is still finishing the drag or the resize, and the event is only
    // moved after this callback, so update the range once it's done. The range shrinks
    // now if the pointer was released outside of the calendar, otherwise when it leaves.
    setTimeout(() => {
        if (!that.eventInteractionActive) {
            updateCalendarMaxDayAndTime(that.element);
        }
    }, 0);
}

export function onCustomEventMoveResize(this: CourseCalendar, event: ScheduleEvent): void {
    const that = this;
    const calendar = that.element;

    updateCalendarMaxDayAndTime(calendar);

    that.onCustomEventUpdated(
        event.id.replace(/^custom_event_/, ''),
        {
            title: event.title,
            start: event.start.format(),
            end: event.end.format()
        },
        event.layerId
    );
}

export function onEventClick(this: CourseCalendar, event: ScheduleEvent, jsEvent: JQuery.TriggeredEvent): void {
    if (this.readonly) {
        return;
    }

    const that = this;
    const calendar = that.element;

    // The ':hover' check is for mobile, otherwise clicking on an event
    // can trigger the hide button even though it wasn't visible when clicking.
    // Only the unselected lessons have a hide button.
    if (
        isLessonEvent(event) &&
        $(jsEvent.target).hasClass('calendar-item-unselected-hide-button') &&
        $(jsEvent.target).is(':hover')
    ) {
        gtag('event', 'calendar-hide-click');

        const courseTitle = that.courseManager.getTitle(event.courseNumber);
        const lesson = event.lessonData;
        const lessonType = that.courseManager.getLessonTypeLabel(that.courseManager.getLessonType(lesson));

        const title = $('<span>').text(CheeseI18n.t('calendar.hideTypeTitle', { type: lessonType }));
        const message = $('<div>').text(
            CheeseI18n.t('calendar.hideTypeMessage', { type: lessonType, course: courseTitle })
        );

        BootstrapDialog.show({
            title,
            message,
            buttons: [
                {
                    label: CheeseI18n.t('calendar.hide'),
                    cssClass: 'btn-primary',
                    action(dialog) {
                        gtag('event', 'calendar-hide-proceed');

                        dialog.close();

                        const targetLessonTypeEvents = calendar.fullCalendar<ScheduleEvent>(
                            'clientEvents',
                            cbEvent =>
                                isSameCourse(cbEvent, event.courseNumber, event.layerId) &&
                                getEventLessonType(cbEvent) === getEventLessonType(event)
                        );

                        targetLessonTypeEvents.forEach(cbEvent => {
                            cbEvent.start.add(7, 'days');
                            cbEvent.end.add(7, 'days');
                            cbEvent.lessonTypeHidden = true;
                        });

                        updateLessonEvents(calendar, targetLessonTypeEvents);
                        updateCalendarMaxDayAndTime(calendar);

                        that.onLessonSelected(event.courseNumber, '-', getEventLessonType(event), event.layerId);

                        const lessonTypesHidden = getCourseHiddenLessonTypes(
                            calendar,
                            event.courseNumber,
                            that.courseManager,
                            event.layerId
                        );
                        that.onLessonTypesHidden(event.courseNumber, lessonTypesHidden, event.layerId);
                    }
                },
                {
                    label: CheeseI18n.t('calendar.close'),
                    action(dialog) {
                        dialog.close();
                    }
                }
            ]
        });

        return;
    }

    // The ':hover' check is for mobile, same as for the hide button above.
    const colorButton = $(jsEvent.target).closest('.calendar-item-color-button');
    if (colorButton.length > 0 && colorButton.is(':hover')) {
        gtag('event', 'calendar-color-click');

        // Courses are identified by the course number and the layer, since the same course
        // can be in several layers, each with its own color. Custom events by the event id.
        if (event.courseNumber !== null) {
            that.onColorPickerClick(event.courseNumber, null, event.layerId);
        } else {
            that.onColorPickerClick(null, event.id);
        }
        return;
    }

    if (!isLessonEvent(event)) {
        BootstrapDialog.show({
            title: CheeseI18n.t('calendar.editCustomEvent'),
            message: $('<textarea>', {
                class: 'form-control',
                placeholder: CheeseI18n.t('calendar.eventDescription'),
                'aria-label': CheeseI18n.t('calendar.eventDescription'),
                dir: 'auto'
            }).val(event.title),
            onshown(dialog) {
                dialog.getModalBody().find('textarea').focus();
            },
            buttons: [
                {
                    label: CheeseI18n.t('calendar.edit'),
                    cssClass: 'btn-primary',
                    action(dialog) {
                        dialog.close();

                        const eventTitle = String(dialog.getModalBody().find('textarea').val()).trim();
                        if (eventTitle === '') {
                            return;
                        }

                        event.title = eventTitle;
                        event.backgroundColor = that.colorGenerator(eventTitle, event.id);
                        event.textColor = that.textColorGenerator(eventTitle, event.id);
                        calendar.fullCalendar('updateEvent', event);

                        that.onCustomEventUpdated(
                            event.id.replace(/^custom_event_/, ''),
                            {
                                title: eventTitle,
                                start: event.start.format(),
                                end: event.end.format()
                            },
                            event.layerId
                        );
                    }
                },
                {
                    label: CheeseI18n.t('calendar.remove'),
                    action(dialog) {
                        dialog.close();

                        calendar.fullCalendar<ScheduleEvent>('removeEvents', event.id);
                        updateCalendarMaxDayAndTime(calendar);

                        that.onCustomEventRemoved(event.id.replace(/^custom_event_/, ''), event.layerId);
                    }
                }
            ]
        });

        return;
    }

    const selectingEvent = !event.selected;
    const conflictedCourses: Record<string, true> = {};

    event.selected = selectingEvent;
    updateLessonEvent(calendar, event);

    const sameLessonTypeEvents = calendar.fullCalendar<ScheduleEvent>('clientEvents', cbEvent => {
        if (
            isSameCourse(cbEvent, event.courseNumber, event.layerId) &&
            getEventLessonType(cbEvent) === getEventLessonType(event)
        ) {
            if (cbEvent.lessonData['מס.'] === event.lessonData['מס.']) {
                // There might be multiple events for the same course, type, and number, process them all.
                handleConflictedEvents(cbEvent);
                return false;
            } else {
                // Different lesson number of the same course and type - can no longer be selected.
                return true;
            }
        }
        return false;
    });

    sameLessonTypeEvents.forEach(cbEvent => {
        cbEvent.start.add(selectingEvent ? 7 : -7, 'days');
        cbEvent.end.add(selectingEvent ? 7 : -7, 'days');
    });

    updateLessonEvents(calendar, sameLessonTypeEvents);
    updateCalendarMaxDayAndTime(calendar);

    Object.keys(conflictedCourses).forEach(conflictedCourse => {
        const conflicted = getCourseConflictedStatus(calendar, conflictedCourse, event.layerId);
        that.onCourseConflictedStatusChanged(conflictedCourse, conflicted, event.layerId);
    });

    if (selectingEvent) {
        that.onLessonSelected(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event), event.layerId);
    } else {
        that.onLessonUnselected(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event), event.layerId);
    }

    function handleConflictedEvents(event: LessonEvent): void {
        const conflictedIds: Record<string, number> = {};

        const conflictedEvents = calendar.fullCalendar<ScheduleEvent>('clientEvents', cbEvent => {
            if (!isLessonEvent(cbEvent) || cbEvent.layerId !== event.layerId) {
                return false;
            }

            if (
                cbEvent.courseNumber === event.courseNumber &&
                getEventLessonType(cbEvent) === getEventLessonType(event)
            ) {
                return false;
            }

            if (areEventsOverlapping(cbEvent, event)) {
                if (!conflictedIds[cbEvent.id]) {
                    conflictedIds[cbEvent.id] = 1;
                    return true;
                }
                conflictedIds[cbEvent.id]++;
                return false;
            }

            return false;
        });

        for (let i = 0; i < conflictedEvents.length; i++) {
            const weeks = conflictedIds[conflictedEvents[i].id];
            conflictedEvents[i].start.add((selectingEvent ? 7 : -7) * weeks, 'days');
            conflictedEvents[i].end.add((selectingEvent ? 7 : -7) * weeks, 'days');
            conflictedCourses[conflictedEvents[i].courseNumber as string] = true;
        }

        updateLessonEvents(calendar, conflictedEvents);
    }
}

export function onEventMouseover(this: CourseCalendar, event: ScheduleEvent): void {
    if (!isLessonEvent(event)) {
        return;
    }

    const courseClassName = getCourseClassName(event.courseNumber, event.layerId);
    $(`.${courseClassName}`, this.element).addClass('calendar-item-same-course-as-hovered');
    $(`.${courseClassName}-type-${getEventLessonType(event)}`, this.element).addClass(
        'calendar-item-same-type-as-hovered'
    );
    this.onCourseHoverIn(event.courseNumber, event.layerId);
}

export function onEventMouseout(this: CourseCalendar, event: ScheduleEvent): void {
    if (!isLessonEvent(event)) {
        return;
    }

    const courseClassName = getCourseClassName(event.courseNumber, event.layerId);
    $(`.${courseClassName}`, this.element).removeClass('calendar-item-same-course-as-hovered');
    $(`.${courseClassName}-type-${getEventLessonType(event)}`, this.element).removeClass(
        'calendar-item-same-type-as-hovered'
    );
    this.onCourseHoverOut(event.courseNumber, event.layerId);
}

export function afterEventRender(this: CourseCalendar, event: ScheduleEvent, element: JQuery): void {
    const that = this;

    if (that.printStyleHackWaitingForEvent) {
        updateDynamicSizes(that);
        that.printStyleHackWaitingForEvent = false;
    }

    if (event.selected) {
        element.addClass('calendar-item-selected');
    } else {
        element.addClass('calendar-item-unselected');

        if (isLessonEvent(event)) {
            const courseClassName = getCourseClassName(event.courseNumber, event.layerId);
            const sameType = $(`.${courseClassName}-type-${getEventLessonType(event)}`, this.element).not(
                `.${courseClassName}-lesson-${event.lessonData['מס.']}`
            );
            if (sameType.length === 0) {
                element.addClass('calendar-item-last-choice');
            }

            if (!this.readonly && !event.temporary) {
                element.append(
                    $('<div>', { class: 'calendar-item-unselected-hide-button', text: CheeseI18n.t('calendar.hide') })
                );
            }
        }
    }

    if (!this.readonly && !event.temporary) {
        element.append($(render(colorButtonTemplate)));
    }
}

export function getColumnFormat(element: JQuery): string {
    return CheeseI18n.getLocale() === 'en' && (element.width() as number) < 700 ? 'ddd' : 'dddd';
}

export function onWindowResize(this: CourseCalendar): void {
    const that = this;
    const format = getColumnFormat(that.element);
    if (that.element.fullCalendar('option', 'columnFormat') !== format) {
        that.element.fullCalendar('option', 'columnFormat', format);
    }

    updateDynamicSizes(that);
}
