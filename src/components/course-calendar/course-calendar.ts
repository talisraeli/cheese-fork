import {
    afterEventRender,
    getColumnFormat,
    initSelectLesson,
    onCustomEventMoveResize,
    onDayClick,
    onEventClick,
    onEventInteractionStart,
    onEventInteractionStop,
    onEventMouseout,
    onEventMouseover,
    onSelect,
    onWindowResize
} from './interactions.js';
import {
    areEventsOverlapping,
    calendarWeek,
    getCourseClassName,
    getCourseConflictedStatus,
    getCourseHiddenLessonTypes,
    getLessonType,
    initCreateCourseEvents,
    isSameCourse,
    makeCustomEvent,
    makeLessonEvent,
    updateCalendarMaxDayAndTime,
    updateLessonEvents
} from './lesson-events.js';
import { initTouchScalingSupport, updateDynamicSizes } from './touch-scaling.js';
import {
    isLessonEvent,
    type CourseCalendarOptions,
    type LayerSchedule,
    type LessonEvent,
    type ScheduleEvent
} from './calendar-types.js';
import type { CourseManager, Lesson } from '../../lib/course-manager.js';
import type { WrappedCalendar } from '../../lib/ics-text.js';
import type { ColorGenerator, CustomEventData, SelectedLessons } from '../../lib/schedule-types.js';

// The weekly calendar of the schedule: the lessons of its courses, and its custom events.
export class CourseCalendar {
    readonly element: JQuery;
    readonly courseManager: CourseManager;
    readonly colorGenerator: ColorGenerator;
    readonly textColorGenerator: ColorGenerator;
    readonly readonly: boolean | undefined;
    readonly onCourseHoverIn: CourseCalendarOptions['onCourseHoverIn'];
    readonly onCourseHoverOut: CourseCalendarOptions['onCourseHoverOut'];
    readonly onCourseConflictedStatusChanged: CourseCalendarOptions['onCourseConflictedStatusChanged'];
    readonly onLessonTypesHidden: CourseCalendarOptions['onLessonTypesHidden'];
    readonly onLessonSelected: CourseCalendarOptions['onLessonSelected'];
    readonly onLessonUnselected: CourseCalendarOptions['onLessonUnselected'];
    readonly onCustomEventAdded: CourseCalendarOptions['onCustomEventAdded'];
    readonly onCustomEventUpdated: CourseCalendarOptions['onCustomEventUpdated'];
    readonly onCustomEventRemoved: CourseCalendarOptions['onCustomEventRemoved'];
    readonly onColorPickerClick: CourseCalendarOptions['onColorPickerClick'];
    readonly getActiveLayerId: CourseCalendarOptions['getActiveLayerId'];
    // Whether an event is being dragged or resized, see onEventInteractionStart.
    eventInteractionActive = false;
    // See the print style hack in touch-scaling.ts.
    printStyleHackWaitingForEvent = false;
    printStyleHackStyleElement: HTMLStyleElement | null = null;

    // The key that the selected lesson of a lesson type is saved under.
    static getLessonTypeKey(courseNumber: string, lesson: Lesson): string {
        return getLessonType(courseNumber, lesson);
    }

    constructor(element: JQuery, options: CourseCalendarOptions) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        // The text color for a background color of colorGenerator, same arguments. White by default.
        this.textColorGenerator = options.textColorGenerator || (() => 'white');
        this.readonly = options.readonly;
        this.onCourseHoverIn = options.onCourseHoverIn;
        this.onCourseHoverOut = options.onCourseHoverOut;
        this.onCourseConflictedStatusChanged = options.onCourseConflictedStatusChanged;
        this.onLessonTypesHidden = options.onLessonTypesHidden;
        this.onLessonSelected = options.onLessonSelected;
        this.onLessonUnselected = options.onLessonUnselected;
        this.onCustomEventAdded = options.onCustomEventAdded;
        this.onCustomEventUpdated = options.onCustomEventUpdated;
        this.onCustomEventRemoved = options.onCustomEventRemoved;
        this.onColorPickerClick = options.onColorPickerClick;
        this.getActiveLayerId = options.getActiveLayerId;

        const that = this;

        element
            .addClass('course-calendar')
            .fullCalendar({
                defaultDate: '2017-01-01',
                //editable: true,
                //eventLimit: true, // allow "more" link when too many events
                defaultView: 'agendaWeek',
                header: false,
                allDaySlot: false,
                minTime: '08:30:00',
                maxTime: '18:30:00',
                height: 'auto',
                contentHeight: 'auto',
                columnFormat: getColumnFormat(element),
                slotLabelFormat: 'HH:mm',
                locale: CheeseI18n.getLocale(),
                isRTL: CheeseI18n.isRTL(),
                firstDay: 0,
                slotEventOverlap: false,
                displayEventTime: false,
                selectable: !that.readonly,
                selectHelper: true,
                selectOverlap: true,
                select: onSelect.bind(that),
                dayClick: onDayClick.bind(that),
                eventDragStart: onEventInteractionStart.bind(that),
                eventDragStop: onEventInteractionStop.bind(that),
                eventResizeStart: onEventInteractionStart.bind(that),
                eventResizeStop: onEventInteractionStop.bind(that),
                eventDrop: onCustomEventMoveResize.bind(that),
                eventResize: onCustomEventMoveResize.bind(that),
                eventClick: onEventClick.bind(that),
                eventMouseover: onEventMouseover.bind(that),
                eventMouseout: onEventMouseout.bind(that),
                eventAfterRender: afterEventRender.bind(that),
                windowResize: onWindowResize.bind(that)
            })
            .fullCalendar('option', {
                // Set afterwards as a bug workaround.
                // https://github.com/fullcalendar/fullcalendar/issues/4102
                hiddenDays: [5, 6]
            });

        element.on('mouseleave', () => {
            // Re-rendering in the middle of a drag or a resize breaks it, and leaves a copy
            // of the time grid behind. It's done when the drag or the resize stops instead.
            if (that.eventInteractionActive) {
                return;
            }

            updateCalendarMaxDayAndTime(element, true);
        });

        initTouchScalingSupport(that);

        updateDynamicSizes(that);
    }

    addCourse(course: string, layerId?: string): void {
        const that = this;

        layerId = layerId || '';

        const schedule = that.courseManager.getSchedule(course);
        if (schedule.length === 0) {
            return;
        }

        const calendar = that.element;

        const lessonsAdded: Record<number, number> = {};
        const events: ScheduleEvent[] = [];
        const conflictedIds: Record<string, number> = {};

        for (const lesson of schedule) {
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            const event = makeLessonEvent(that, course, lesson, layerId);

            const conflictCount = countEventConflicts(event);
            if (conflictCount > 0) {
                if (!conflictedIds[event.id]) {
                    conflictedIds[event.id] = 0;
                }
                conflictedIds[event.id] += conflictCount;
            }

            events.push(event);

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        }

        for (const event of events) {
            if (conflictedIds[event.id]) {
                const weeks = conflictedIds[event.id];
                event.start.add(7 * weeks, 'days');
                event.end.add(7 * weeks, 'days');
            }
        }

        calendar.fullCalendar<ScheduleEvent>('renderEvents', events);

        if (Object.keys(conflictedIds).length > 0 && getCourseConflictedStatus(calendar, course, layerId)) {
            that.onCourseConflictedStatusChanged(course, true, layerId);
        }

        updateCalendarMaxDayAndTime(calendar);

        function countEventConflicts(event: ScheduleEvent): number {
            let count = 0;
            calendar.fullCalendar<ScheduleEvent>('clientEvents', cbEvent => {
                if (
                    cbEvent.courseNumber !== null &&
                    cbEvent.layerId === layerId &&
                    cbEvent.selected &&
                    areEventsOverlapping(cbEvent, event)
                ) {
                    count++;
                }
                return false;
            });
            return count;
        }
    }

    removeCourse(course: string, layerId?: string): void {
        const that = this;
        const calendar = that.element;

        layerId = layerId || '';

        // Show conflicting events which can now be selected.
        const conflictedIds: Record<string, number> = {};

        const conflictedEvents = calendar.fullCalendar<ScheduleEvent>('clientEvents', event => {
            if (
                event.courseNumber !== null &&
                event.layerId === layerId &&
                event.courseNumber !== course &&
                isConflicted(event, course)
            ) {
                if (!conflictedIds[event.id]) {
                    conflictedIds[event.id] = 1;
                    return true;
                }
                conflictedIds[event.id]++;
                return false;
            }

            return false;
        });

        const conflictedCourses: Record<string, true> = {};

        for (const event of conflictedEvents) {
            const weeks = conflictedIds[event.id];
            event.start.add(-7 * weeks, 'days');
            event.end.add(-7 * weeks, 'days');
            conflictedCourses[event.courseNumber as string] = true;
        }

        updateLessonEvents(calendar, conflictedEvents);
        calendar.fullCalendar<ScheduleEvent>('removeEvents', event => isSameCourse(event, course, layerId));

        Object.keys(conflictedCourses).forEach(conflictedCourse => {
            const conflicted = getCourseConflictedStatus(calendar, conflictedCourse, layerId);
            that.onCourseConflictedStatusChanged(conflictedCourse, conflicted, layerId);
        });

        updateCalendarMaxDayAndTime(calendar);

        // True if the event cannot be selected because of the given course.
        function isConflicted(event: ScheduleEvent, course: string): boolean {
            const conflictingEvent = calendar.fullCalendar<ScheduleEvent>(
                'clientEvents',
                cbEvent =>
                    isSameCourse(cbEvent, course, layerId || '') &&
                    cbEvent.selected &&
                    areEventsOverlapping(cbEvent, event)
            );

            return conflictingEvent.length > 0;
        }
    }

    previewCourse(course: string, layerId?: string): void {
        const that = this;
        const calendar = that.element;

        layerId = layerId || '';

        const conflictedEvents = calendar.fullCalendar<ScheduleEvent>(
            'clientEvents',
            event => isSameCourse(event, course, layerId) && calendarWeek(event.start) > 1
        );

        const temporaryEvents: ScheduleEvent[] = [];

        for (const conf of conflictedEvents) {
            // Back to the same day and time of the displayed week.
            const daysToFirstWeek = 7 * (calendarWeek(conf.start) - 1);
            const temp: ScheduleEvent = {
                id: `temp_${conf.id}`,
                title: conf.title,
                start: conf.start.clone().subtract(daysToFirstWeek, 'days'),
                end: conf.end.clone().subtract(daysToFirstWeek, 'days'),
                backgroundColor: conf.backgroundColor,
                textColor: conf.textColor,
                borderColor: conf.borderColor,
                className: conf.className,
                courseNumber: conf.courseNumber,
                layerId: conf.layerId,
                lessonData: conf.lessonData,
                selected: conf.selected,
                temporary: true
            };

            temporaryEvents.push(temp);
        }

        calendar.fullCalendar<ScheduleEvent>('renderEvents', temporaryEvents);

        $(`.${getCourseClassName(course, layerId)}`, this.element).addClass('calendar-item-previewed');

        if (conflictedEvents.length > 0) {
            updateCalendarMaxDayAndTime(calendar);
        }
    }

    unpreviewCourse(course: string, layerId?: string): void {
        const that = this;
        const calendar = that.element;

        layerId = layerId || '';

        let removed = 0;

        calendar.fullCalendar<ScheduleEvent>('removeEvents', event => {
            if (event.temporary && isSameCourse(event, course, layerId)) {
                removed++;
                return true;
            } else {
                return false;
            }
        });

        $(`.${getCourseClassName(course, layerId)}`, this.element).removeClass('calendar-item-previewed');

        if (removed > 0) {
            updateCalendarMaxDayAndTime(calendar);
        }
    }

    // Highlights a custom event, e.g. while it's hovered in the list.
    setCustomEventHighlighted(eventId: string, highlighted: boolean): void {
        if (/^\d+$/.test(eventId)) {
            $(`.calendar-item-custom_event_${eventId}`, this.element).toggleClass(
                'calendar-item-previewed',
                highlighted
            );
        }
    }

    // extraLayers is optional, an array of { id, schedule, customEvents } for the layers
    // to show in addition to the first layer.
    loadSavedSchedule(
        schedule: Record<string, SelectedLessons>,
        customEvents: Record<string, CustomEventData>,
        extraLayers?: LayerSchedule[]
    ): void {
        const that = this;
        const calendar = that.element;

        calendar.fullCalendar<ScheduleEvent>('removeEvents');

        const layers: LayerSchedule[] = [{ id: '', schedule, customEvents }].concat(extraLayers || []);

        let lessonEvents: LessonEvent[] = [];
        layers.forEach(layer => {
            Object.keys(layer.schedule).forEach(course => {
                lessonEvents = lessonEvents.concat(initCreateCourseEvents(that, course, layer.id));
            });
        });

        layers.forEach(layer => {
            Object.keys(layer.schedule).forEach(course => {
                const lessons = layer.schedule[course];
                Object.keys(lessons).forEach(lessonType => {
                    const lessonNumber = lessons[lessonType];
                    initSelectLesson(lessonEvents, course, lessonType, lessonNumber, layer.id);
                });
            });
        });

        const events: ScheduleEvent[] = lessonEvents.slice();

        layers.forEach(layer => {
            Object.keys(layer.customEvents).forEach(eventId => {
                const eventData = layer.customEvents[eventId];
                const start = calendar.fullCalendar('getCalendar').moment(eventData.start);
                const end = calendar.fullCalendar('getCalendar').moment(eventData.end);
                events.push(makeCustomEvent(that, `custom_event_${eventId}`, eventData.title, start, end, layer.id));
            });
        });

        calendar.fullCalendar<ScheduleEvent>('renderEvents', events);
        updateCalendarMaxDayAndTime(calendar);

        layers.forEach(layer => {
            Object.keys(layer.schedule).forEach(course => {
                if (getCourseConflictedStatus(calendar, course, layer.id)) {
                    that.onCourseConflictedStatusChanged(course, true, layer.id);
                }

                const lessonTypesHidden = getCourseHiddenLessonTypes(calendar, course, that.courseManager, layer.id);
                if (lessonTypesHidden.length > 0) {
                    that.onLessonTypesHidden(course, lessonTypesHidden, layer.id);
                }
            });
        });
    }

    // Re-applies colorGenerator to all events, call after a custom color changes.
    updateColors(): void {
        const that = this;
        const calendar = that.element;

        const lessonEvents: ScheduleEvent[] = [];
        const customEvents: ScheduleEvent[] = [];

        calendar.fullCalendar<ScheduleEvent>('clientEvents', event => {
            const color =
                event.courseNumber !== null
                    ? that.colorGenerator(event.courseNumber, null, event.layerId)
                    : that.colorGenerator(event.title, event.id);
            const textColor =
                event.courseNumber !== null
                    ? that.textColorGenerator(event.courseNumber, null, event.layerId)
                    : that.textColorGenerator(event.title, event.id);
            if (event.backgroundColor !== color || event.textColor !== textColor) {
                event.backgroundColor = color;
                event.textColor = textColor;
                (event.courseNumber !== null ? lessonEvents : customEvents).push(event);
            }
            return false;
        });

        updateLessonEvents(calendar, lessonEvents);
        calendar.fullCalendar('updateEvents', customEvents);
    }

    // Adds the selected lessons and custom events to icsCal, an ics.js calendar wrapped with
    // IcsText.wrap, which escapes the plain text passed to addEvent.
    saveAsIcs(icsCal: WrappedCalendar, dateFrom: string, dateTo: string, daysOff: string[] | null): number {
        const that = this;
        const calendar = that.element;

        const dateFromArray = dateFrom.split('-');
        const dateFromObject = {
            year: parseInt(dateFromArray[0], 10),
            month: parseInt(dateFromArray[1], 10) - 1,
            date: parseInt(dateFromArray[2], 10)
        };

        const until = moment.utc(`${dateTo}T00:00:00`).add(1, 'days').format();
        const rrule = { freq: 'WEEKLY', until };

        // Pre-group days off by day of week (0=Sunday, 6=Saturday).
        const daysOffByDay: Record<number, Date[]> = {};
        if (daysOff) {
            daysOff.forEach(dateStr => {
                const parts = dateStr.split('-');
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const day = d.getDay();
                if (!daysOffByDay[day]) {
                    daysOffByDay[day] = [];
                }
                daysOffByDay[day].push(d);
            });
        }

        let count = 0;

        calendar.fullCalendar<ScheduleEvent>('clientEvents', event => {
            if (calendarWeek(event.start) === 1 && event.selected) {
                let subject = '';
                let description = '';
                let location = '';
                if (isLessonEvent(event)) {
                    const lesson = event.lessonData;

                    subject = that.courseManager.getLessonTypeAndNumber(lesson);
                    subject += ` – ${that.courseManager.getCourseName(event.courseNumber)}`;

                    description = '';
                    if (lesson['מרצה/מתרגל']) {
                        description = lesson['מרצה/מתרגל']
                            .split('\n')
                            .map(name => that.courseManager.getStaffLabel(name))
                            .join('\n');
                    }

                    location = '';
                    if (lesson['בניין']) {
                        location = that.courseManager.getBuildingLabel(lesson['בניין']);
                        if (lesson['חדר']) {
                            location += ` ${lesson['חדר']}`;
                        }
                    }
                } else {
                    subject = event.title.replace(/\n/g, ', ');
                }

                const begin = event.start.clone().set(dateFromObject);
                const eventDay = event.start.day();

                // If setting the day will move us to the past, add 7 days
                // to move forward to the next week.
                if (eventDay < begin.day()) {
                    begin.add(7, 'days');
                }

                begin.day(eventDay);
                const end = event.end.clone().add(begin.diff(event.start), 'milliseconds');

                // Causes timezone to be added to the formatted string,
                // fixes a time shift issue in Safari.
                // https://stackoverflow.com/q/54210749
                begin.local();
                end.local();

                icsCal.addEvent(
                    subject,
                    description,
                    location,
                    begin.format(),
                    end.format(),
                    rrule,
                    daysOffByDay[eventDay]
                );
                count++;
            }

            return false;
        });

        return count;
    }

    removeAll(): void {
        const that = this;
        const calendar = that.element;

        calendar.fullCalendar<ScheduleEvent>('removeEvents');

        updateCalendarMaxDayAndTime(calendar);
    }
}

// The key that a selected lesson of the course is saved under.
