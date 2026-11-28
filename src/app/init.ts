import type { CustomEventData } from '../lib/schedule-types.js';
import { CourseButtonList } from '../components/course-button-list/course-button-list.js';
import { CourseCalendar } from '../components/course-calendar/course-calendar.js';
import { CourseExamInfo } from '../components/course-exam-info/course-exam-info.js';
import { CourseSelect } from '../components/course-select/course-select.js';
import { trackMarkedLinks } from '../lib/analytics-links.js';
import { CourseManager } from '../lib/course-manager.js';
import { firebaseAuthUIInit, firebaseInit } from './auth.js';
import { courseColorGenerator, courseColorKey, courseTextColorGenerator, showColorPicker } from './colors.js';
import { crawlersInfo } from './crawlers.js';
import {
    collapsedLayersLoad,
    getLayerIdsOfCourse,
    getVisibleCourseNumbers,
    isLayerVisible,
    layerCollapseChange,
    layerCourseMove,
    layerCreate,
    layerCustomEventMove,
    layerCustomEventRemove,
    layerDelete,
    layerDuplicate,
    layerRename,
    layerVisibilityChange
} from './layers.js';
import { navbarInit } from './navbar.js';
import { showExtraContentOnLoad } from './popups.js';
import {
    coursesOrderSave,
    customEventSave,
    customEventUnsave,
    selectedCourseSave,
    selectedCourseUnsave,
    selectedLessonSave,
    selectedLessonUnsave
} from './schedule-edits.js';
import { watchSavedSchedule, watchSharedSchedule } from './schedule-sync.js';
import { updateGeneralInfoLine } from './semesters.js';
import { state } from './state.js';
import { crawlerUrl, getScrollBarWidth, shellUrl } from './util.js';

export function cheeseforkInit() {
    // Use overlayScrollbars only if the scrollbar has width. On desktop it
    // usually does, on mobile it usually doesn't. It can be a very small
    // non-zero number such as 0.0002 as well, only consider significant
    // width.
    if (getScrollBarWidth() > 0.5) {
        ($('body') as JQuery & { overlayScrollbars(options: object): JQuery })
            .overlayScrollbars({})
            .removeClass('os-host-rtl');
    }

    $('[data-toggle="tooltip"]').tooltip();

    state.viewingSharedSchedule = scheduleSharingUserId ? true : false;

    if (!state.viewingSharedSchedule) {
        state.collapsedLayerIds = collapsedLayersLoad();
    }

    navbarInit();

    if (!state.viewingSharedSchedule) {
        state.courseSelect = new CourseSelect($('#course-select'), {
            courseManager: state.courseManager,
            onItemAdd(course: string) {
                const layerId = state.courseButtonList.getActiveLayerId();
                state.courseButtonList.expandLayer(layerId);
                if (!state.courseButtonList.isCourseInList(course, layerId)) {
                    state.courseButtonList.addCourse(course, layerId);
                    if (isLayerVisible(layerId)) {
                        state.courseCalendar.addCourse(course, layerId);
                    }
                    selectedCourseSave(course, layerId);
                    updateGeneralInfoLine();
                    state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
                    // Can't apply filter inside onItemAdd since it changes the select contents.
                    setTimeout(() => {
                        state.courseSelect.filterApply();
                    }, 0);
                }
            },
            onDropdownItemActivate(course: string) {
                const layerId = state.courseButtonList.getActiveLayerId();

                state.previewingFromSelectControl = course;
                state.previewingFromSelectControlLayerId = layerId;

                if (!state.courseButtonList.isCourseInList(course, layerId) && isLayerVisible(layerId)) {
                    state.courseCalendar.addCourse(course, layerId);

                    const courseNumbers = getVisibleCourseNumbers();
                    if (!courseNumbers.includes(course)) {
                        courseNumbers.push(course);
                    }
                    state.courseExamInfo.renderCourses(courseNumbers);
                }
                state.courseExamInfo.setHighlighted(course);
                state.courseCalendar.previewCourse(course, layerId);
                state.courseButtonList.setFloatingCourseInfo(course);
            },
            onDropdownItemDeactivate(course: string) {
                const layerId = state.previewingFromSelectControlLayerId;

                if (!state.courseButtonList.isCourseInList(course, layerId)) {
                    state.courseCalendar.removeCourse(course, layerId);
                    state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
                } else {
                    // Remove highlight
                    state.courseExamInfo.removeHighlighted(course);
                    state.courseCalendar.unpreviewCourse(course, layerId);
                }

                state.previewingFromSelectControl = null;
            },
            getSelectedCoursesForFilter() {
                return getVisibleCourseNumbers();
            }
        });
    } else {
        $('#top-navbar-home').removeClass('d-none');
        $('#top-navbar-share').addClass('d-none');
        $('#top-navbar-semester').addClass('d-none');
        $('#course-select').hide();
    }

    state.courseButtonList = new CourseButtonList($('#course-button-list'), {
        courseManager: state.courseManager,
        colorGenerator: courseColorGenerator,
        textColorGenerator: courseTextColorGenerator,
        readonly: state.viewingSharedSchedule,
        onHoverIn(course: string, layerId: string) {
            state.courseExamInfo.setHovered(course);
            if (state.previewingFromSelectControl) {
                state.courseCalendar.unpreviewCourse(
                    state.previewingFromSelectControl,
                    state.previewingFromSelectControlLayerId
                );
            }
            state.courseCalendar.previewCourse(course, layerId);
        },
        onHoverOut(course: string, layerId: string) {
            state.courseExamInfo.removeHovered(course);
            state.courseCalendar.unpreviewCourse(course, layerId);
            if (state.previewingFromSelectControl) {
                state.courseCalendar.previewCourse(
                    state.previewingFromSelectControl,
                    state.previewingFromSelectControlLayerId
                );
            }
        },
        onEnableCourse(course: string, layerId: string) {
            if (isLayerVisible(layerId)) {
                state.courseCalendar.addCourse(course, layerId);
                state.courseCalendar.previewCourse(course, layerId);
            }
            selectedCourseSave(course, layerId);
            updateGeneralInfoLine();
            state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
            state.courseSelect.filterApply();
        },
        onDisableCourse(course: string, layerId: string) {
            state.courseCalendar.removeCourse(course, layerId);
            selectedCourseUnsave(course, layerId);
            updateGeneralInfoLine();
            state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
            state.courseSelect.filterApply();
        },
        onReorder: coursesOrderSave,
        onCourseMove: layerCourseMove,
        onLayerCreate: layerCreate,
        onLayerDuplicate: layerDuplicate,
        onLayerRename: layerRename,
        onLayerDelete: layerDelete,
        onLayerVisibilityChange: layerVisibilityChange,
        onLayerCollapseChange: layerCollapseChange,
        onCustomEventHoverIn(eventId: string) {
            state.courseCalendar.setCustomEventHighlighted(eventId, true);
        },
        onCustomEventHoverOut(eventId: string) {
            state.courseCalendar.setCustomEventHighlighted(eventId, false);
        },
        onCustomEventMove: layerCustomEventMove,
        onCustomEventRemove: layerCustomEventRemove
    });

    state.courseExamInfo = new CourseExamInfo($('#course-exam-info'), {
        courseManager: state.courseManager,
        // The exam info shows each course once, so use the color of its first visible layer.
        colorGenerator(course: string) {
            const layerIds = getLayerIdsOfCourse(course).filter(isLayerVisible);
            return courseColorGenerator(course, null, layerIds[0] || '');
        },
        textColorGenerator(course: string) {
            const layerIds = getLayerIdsOfCourse(course).filter(isLayerVisible);
            return courseTextColorGenerator(course, null, layerIds[0] || '');
        },
        onHoverIn(course: string) {
            // The exam info is pinned to the bottom of the sidebar, which stretches with the
            // calendar. Keep it in place so that a preview doesn't move it from under the pointer.
            const wrapper = $('#course-exam-info-wrapper');
            wrapper.css('flex', `0 0 ${wrapper.outerHeight()}px`);

            state.courseButtonList.setHovered(course);
            if (state.previewingFromSelectControl) {
                state.courseCalendar.unpreviewCourse(
                    state.previewingFromSelectControl,
                    state.previewingFromSelectControlLayerId
                );
            }
            getLayerIdsOfCourse(course).forEach(layerId => {
                state.courseCalendar.previewCourse(course, layerId);
            });
        },
        onHoverOut(course: string) {
            state.courseButtonList.removeHovered(course);
            getLayerIdsOfCourse(course).forEach(layerId => {
                state.courseCalendar.unpreviewCourse(course, layerId);
            });
            if (state.previewingFromSelectControl) {
                state.courseCalendar.previewCourse(
                    state.previewingFromSelectControl,
                    state.previewingFromSelectControlLayerId
                );
            }

            // Back to the stylesheet's size, see onHoverIn.
            $('#course-exam-info-wrapper').css('flex', '');
        }
    });

    state.courseCalendar = new CourseCalendar($('#course-calendar'), {
        courseManager: state.courseManager,
        colorGenerator: courseColorGenerator,
        textColorGenerator: courseTextColorGenerator,
        readonly: state.viewingSharedSchedule,
        getActiveLayerId() {
            return state.courseButtonList.getActiveLayerId();
        },
        onCourseHoverIn(course: string, layerId: string) {
            state.courseButtonList.setHovered(course, layerId);
            state.courseExamInfo.setHovered(course);
        },
        onCourseHoverOut(course: string, layerId: string) {
            state.courseButtonList.removeHovered(course, layerId);
            state.courseExamInfo.removeHovered(course);
        },
        onCourseConflictedStatusChanged(course: string, conflicted: boolean, layerId: string) {
            if (conflicted) {
                state.courseButtonList.setConflicted(course, layerId);
            } else {
                state.courseButtonList.removeConflicted(course, layerId);
            }
        },
        onLessonTypesHidden(course: string, lessonTypesHidden: string[], layerId: string) {
            state.courseButtonList.setLessonTypesHidden(course, lessonTypesHidden, layerId);
        },
        onLessonSelected(course: string, lessonNumber: number | string, lessonType: string, layerId: string) {
            selectedLessonSave(course, lessonNumber, lessonType, layerId);
        },
        onLessonUnselected(course: string, lessonNumber: number | string, lessonType: string, layerId: string) {
            selectedLessonUnsave(course, lessonNumber, lessonType, layerId);
        },
        onCustomEventAdded(eventId: number, eventData: CustomEventData, layerId: string) {
            state.courseButtonList.expandLayer(layerId);
            state.courseButtonList.addCustomEvent(String(eventId), eventData.title, layerId);
            customEventSave(String(eventId), eventData, layerId);
        },
        onCustomEventUpdated(eventId: string, eventData: CustomEventData, layerId: string) {
            state.courseButtonList.updateCustomEvent(eventId, eventData.title);
            customEventSave(eventId, eventData, layerId);
        },
        onCustomEventRemoved(eventId: string, layerId: string) {
            state.courseButtonList.removeCustomEvent(eventId);
            customEventUnsave(eventId, layerId);
        },
        // A course with its layer, or a custom event by its event id, with a null course.
        onColorPickerClick(course: string | null, customEventId?: string | null, layerId?: string) {
            // For a custom event without a custom color, the picker's current color is the hash of
            // a null course, not the event's color on the calendar, as before the conversion.
            showColorPicker(
                customEventId || courseColorKey(course as string, layerId),
                courseColorGenerator(course as string, customEventId, layerId)
            );
        }
    });

    $('#top-navbar-supported-content').removeClass('top-navbar-content-uninitialized');

    $('#right-content-bar').removeClass('invisible');

    if (state.viewingSharedSchedule) {
        firebaseInit();
        watchSharedSchedule(() => {
            $('#page-loader').hide();
        });
    } else {
        let firebaseAuthUIInitialized = false;

        if (typeof firebase !== 'undefined') {
            try {
                firebaseInit();
                firebaseAuthUIInit(() => {
                    watchSavedSchedule(() => {
                        $('#page-loader').hide();
                        showExtraContentOnLoad();
                    });
                });
                firebaseAuthUIInitialized = true;
            } catch (e) {
                // Firebase UI doesn't work on Edge/IE in private mode.
                // Will fall back to offline mode.
            }
        }

        if (!firebaseAuthUIInitialized) {
            watchSavedSchedule(() => {
                $('#page-loader').hide();
                showExtraContentOnLoad();
            });
        }
    }
}

// Starts the page.
export function start() {
    trackMarkedLinks(document);
    CheeseI18n.apply(document);
    moment.locale(CheeseI18n.getLocale()); // See moment-locale.js.

    $('dark-mode-toggle').attr({
        light: CheeseI18n.t('shell.theme.toDark'),
        dark: CheeseI18n.t('shell.theme.toLight'),
        remember: CheeseI18n.t('shell.theme.remember')
    });
    $('#top-navbar-home a, #top-navbar .navbar-brand').prop(
        'href',
        shellUrl({
            semester: currentSemester,
            uid: null,
            course: null,
            staff: null,
            room: null
        })
    );
    $('#course-list-crawler-link').prop('href', crawlerUrl({ course: 'all' }));
    // The English catalog, from SAP, is loaded by index.html in English only. Hebrew and Arabic
    // show the catalog's Hebrew text.
    state.courseManager = new CourseManager(
        courses_from_rishum,
        CheeseI18n.getLocale() === 'en' && typeof courses_english !== 'undefined' ? courses_english : null
    );
    state.colorHash = new ColorHash();

    if (!crawlersInfo()) {
        cheeseforkInit();
    }
}
