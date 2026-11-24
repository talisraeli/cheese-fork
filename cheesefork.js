'use strict';

/* global introJs, ColorHash, BootstrapDialog, ics, JsDiff, firebase, firebaseui, gtag, CheeseI18n, moment */
/* global CourseManager, CourseSelect, CourseButtonList, CourseExamInfo, CourseCalendar */
/* global courses_from_rishum, availableSemesters, currentSemester, scheduleSharingUserId */

(function () {
    CheeseI18n.apply(document);
    moment.locale(CheeseI18n.getLocale());

    $('dark-mode-toggle').attr({
        light: CheeseI18n.t('shell.theme.toDark'),
        dark: CheeseI18n.t('shell.theme.toLight'),
        remember: CheeseI18n.t('shell.theme.remember')
    });
    $('#top-navbar-home a, #top-navbar .navbar-brand').prop('href', shellUrl({
        semester: currentSemester, uid: null, course: null, staff: null, room: null
    }));
    $('#course-list-crawler-link').prop('href', crawlerUrl({course: 'all'}));

    var courseManager = new CourseManager(courses_from_rishum);
    var colorHash = new ColorHash();
    var firestoreDb = null;
    var firebaseStorage = null;
    var viewingSharedSchedule = false;
    var previewingFromSelectControl = null;
    var previewingFromSelectControlLayerId = '';
    var stopScheduleWatching = null;
    var currentSavedSession = null, savedSessionForUndo = null, savedSessionForRedo = null;
    var metadataDiff = {};
    var customColors = {};
    // The layers of the shown schedule, { id, name, hidden } each. Empty if layers aren't used.
    var currentLayers = [];

    // The version of the popup that introduces the features CheeseFork² adds over the original
    // CheeseFork. Bump it when new features are added to the popup, to show it again. Declared
    // here because cheeseforkInit() below can show the popup before the rest of the script runs.
    var whatsNewVersion = 2;

    // UI components.
    var loginDialog = null;
    var courseSelect = null;
    var courseButtonList = null;
    var courseExamInfo = null;
    var courseCalendar = null;

    if (!crawlersInfo()) {
        cheeseforkInit();
    }

    function cheeseforkInit() {
        // Use overlayScrollbars only if the scrollbar has width. On desktop it
        // usually does, on mobile it usually doesn't. It can be a very small
        // non-zero number such as 0.0002 as well, only consider significant
        // width.
        if (getScrollBarWidth() > 0.5) {
            $('body').overlayScrollbars({ }).removeClass('os-host-rtl');
        }

        $('[data-toggle="tooltip"]').tooltip();

        viewingSharedSchedule = scheduleSharingUserId ? true : false;

        navbarInit();

        if (!viewingSharedSchedule) {
            courseSelect = new CourseSelect($('#course-select'), {
                courseManager: courseManager,
                onItemAdd: function (course) {
                    var layerId = courseButtonList.getActiveLayerId();
                    if (!courseButtonList.isCourseInList(course, layerId)) {
                        courseButtonList.addCourse(course, layerId);
                        if (isLayerVisible(layerId)) {
                            courseCalendar.addCourse(course, layerId);
                        }
                        selectedCourseSave(course, layerId);
                        updateGeneralInfoLine();
                        courseExamInfo.renderCourses(getVisibleCourseNumbers());
                        // Can't apply filter inside onItemAdd since it changes the select contents.
                        setTimeout(function () {
                            courseSelect.filterApply();
                        }, 0);
                    }
                },
                onDropdownItemActivate: function (course) {
                    var layerId = courseButtonList.getActiveLayerId();

                    previewingFromSelectControl = course;
                    previewingFromSelectControlLayerId = layerId;

                    if (!courseButtonList.isCourseInList(course, layerId) && isLayerVisible(layerId)) {
                        courseCalendar.addCourse(course, layerId);

                        var courseNumbers = getVisibleCourseNumbers();
                        if (courseNumbers.indexOf(course) === -1) {
                            courseNumbers.push(course);
                        }
                        courseExamInfo.renderCourses(courseNumbers);
                    }
                    courseExamInfo.setHighlighted(course);
                    courseCalendar.previewCourse(course, layerId);
                    courseButtonList.setFloatingCourseInfo(course);
                },
                onDropdownItemDeactivate: function (course) {
                    var layerId = previewingFromSelectControlLayerId;

                    if (!courseButtonList.isCourseInList(course, layerId)) {
                        courseCalendar.removeCourse(course, layerId);
                        courseExamInfo.renderCourses(getVisibleCourseNumbers());
                    } else {
                        // Remove highlight
                        courseExamInfo.removeHighlighted(course);
                        courseCalendar.unpreviewCourse(course, layerId);
                    }

                    previewingFromSelectControl = null;
                },
                getSelectedCoursesForFilter: function () {
                    return getVisibleCourseNumbers();
                }
            });
        } else {
            $('#top-navbar-home').removeClass('d-none');
            $('#top-navbar-share').addClass('d-none');
            $('#top-navbar-semester').addClass('d-none');
            $('#course-select').hide();
        }

        courseButtonList = new CourseButtonList($('#course-button-list'), {
            courseManager: courseManager,
            colorGenerator: courseColorGenerator,
            readonly: viewingSharedSchedule,
            onHoverIn: function (course, layerId) {
                courseExamInfo.setHovered(course);
                if (previewingFromSelectControl) {
                    courseCalendar.unpreviewCourse(previewingFromSelectControl, previewingFromSelectControlLayerId);
                }
                courseCalendar.previewCourse(course, layerId);
            },
            onHoverOut: function (course, layerId) {
                courseExamInfo.removeHovered(course);
                courseCalendar.unpreviewCourse(course, layerId);
                if (previewingFromSelectControl) {
                    courseCalendar.previewCourse(previewingFromSelectControl, previewingFromSelectControlLayerId);
                }
            },
            onEnableCourse: function (course, layerId) {
                if (isLayerVisible(layerId)) {
                    courseCalendar.addCourse(course, layerId);
                    courseCalendar.previewCourse(course, layerId);
                }
                selectedCourseSave(course, layerId);
                updateGeneralInfoLine();
                courseExamInfo.renderCourses(getVisibleCourseNumbers());
                courseSelect.filterApply();
            },
            onDisableCourse: function (course, layerId) {
                courseCalendar.removeCourse(course, layerId);
                selectedCourseUnsave(course, layerId);
                updateGeneralInfoLine();
                courseExamInfo.renderCourses(getVisibleCourseNumbers());
                courseSelect.filterApply();
            },
            onReorder: coursesOrderSave,
            onCourseMove: layerCourseMove,
            onLayerCreate: layerCreate,
            onLayerRename: layerRename,
            onLayerDelete: layerDelete,
            onLayerVisibilityChange: layerVisibilityChange,
            onCustomEventHoverIn: function (eventId) {
                courseCalendar.setCustomEventHighlighted(eventId, true);
            },
            onCustomEventHoverOut: function (eventId) {
                courseCalendar.setCustomEventHighlighted(eventId, false);
            },
            onCustomEventMove: layerCustomEventMove,
            onCustomEventRemove: layerCustomEventRemove
        });

        courseExamInfo = new CourseExamInfo($('#course-exam-info'), {
            courseManager: courseManager,
            // The exam info shows each course once, so use the color of its first visible layer.
            colorGenerator: function (course) {
                var layerIds = getLayerIdsOfCourse(course).filter(isLayerVisible);
                return courseColorGenerator(course, null, layerIds[0] || '');
            },
            onHoverIn: function (course) {
                // The exam info is pinned to the bottom of the sidebar, which stretches with the
                // calendar. Keep it in place so that a preview doesn't move it from under the pointer.
                var wrapper = $('#course-exam-info-wrapper');
                wrapper.css('flex', '0 0 ' + wrapper.outerHeight() + 'px');

                courseButtonList.setHovered(course);
                if (previewingFromSelectControl) {
                    courseCalendar.unpreviewCourse(previewingFromSelectControl, previewingFromSelectControlLayerId);
                }
                getLayerIdsOfCourse(course).forEach(function (layerId) {
                    courseCalendar.previewCourse(course, layerId);
                });
            },
            onHoverOut: function (course) {
                courseButtonList.removeHovered(course);
                getLayerIdsOfCourse(course).forEach(function (layerId) {
                    courseCalendar.unpreviewCourse(course, layerId);
                });
                if (previewingFromSelectControl) {
                    courseCalendar.previewCourse(previewingFromSelectControl, previewingFromSelectControlLayerId);
                }

                $('#course-exam-info-wrapper').css('flex', '1');
            }
        });

        courseCalendar = new CourseCalendar($('#course-calendar'), {
            courseManager: courseManager,
            colorGenerator: courseColorGenerator,
            readonly: viewingSharedSchedule,
            getActiveLayerId: function () {
                return courseButtonList.getActiveLayerId();
            },
            onCourseHoverIn: function (course, layerId) {
                courseButtonList.setHovered(course, layerId);
                courseExamInfo.setHovered(course);
            },
            onCourseHoverOut: function (course, layerId) {
                courseButtonList.removeHovered(course, layerId);
                courseExamInfo.removeHovered(course);
            },
            onCourseConflictedStatusChanged: function (course, conflicted, layerId) {
                if (conflicted) {
                    courseButtonList.setConflicted(course, layerId);
                } else {
                    courseButtonList.removeConflicted(course, layerId);
                }
            },
            onLessonTypesHidden: function (course, lessonTypesHidden, layerId) {
                courseButtonList.setLessonTypesHidden(course, lessonTypesHidden, layerId);
            },
            onLessonSelected: function (course, lessonNumber, lessonType, layerId) {
                selectedLessonSave(course, lessonNumber, lessonType, layerId);
            },
            onLessonUnselected: function (course, lessonNumber, lessonType, layerId) {
                selectedLessonUnsave(course, lessonNumber, lessonType, layerId);
            },
            onCustomEventAdded: function (eventId, eventData, layerId) {
                courseButtonList.addCustomEvent(eventId, eventData.title, layerId);
                customEventSave(eventId, eventData, layerId);
            },
            onCustomEventUpdated: function (eventId, eventData, layerId) {
                courseButtonList.updateCustomEvent(eventId, eventData.title);
                customEventSave(eventId, eventData, layerId);
            },
            onCustomEventRemoved: function (eventId, layerId) {
                courseButtonList.removeCustomEvent(eventId);
                customEventUnsave(eventId, layerId);
            },
            onColorPickerClick: function (course, customEventId, layerId) {
                showColorPicker(customEventId || courseColorKey(course, layerId));
            }
        });

        $('#top-navbar-supported-content').removeClass('top-navbar-content-uninitialized');

        $('#right-content-bar').removeClass('invisible');

        if (viewingSharedSchedule) {
            firebaseInit();
            watchSharedSchedule(function () {
                $('#page-loader').hide();
            });
        } else {
            var firebaseAuthUIInitialized = false;

            if (typeof firebase !== 'undefined') {
                try {
                    firebaseInit();
                    firebaseAuthUIInit(function () {
                        watchSavedSchedule(function () {
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
                watchSavedSchedule(function () {
                    $('#page-loader').hide();
                    showExtraContentOnLoad();
                });
            }
        }
    }

    // The key of a course's custom color. The same course can be in several layers,
    // and each layer has its own color. The first layer uses the plain course number,
    // same as a schedule without layers.
    function courseColorKey(course, layerId) {
        return layerId ? layerId + '_' + course : course;
    }

    // For custom events, course is the event title and customEventId is the event id.
    // For courses, customEventId is null and layerId is the layer of the course.
    function courseColorGenerator(course, customEventId, layerId) {
        var customColor = customColors[customEventId || courseColorKey(course, layerId)];
        if (customColor) {
            return customColor;
        }

        var str = courseManager.toOldCourseNumber(course);
        // Fixup: both 114036 and 114246 get a green color, and both are taken at the same semester.
        // So here we cause the color of 114246 to be different.
        // Similar fixup: pink 124503, 124708 and 134019.
        // Similar fixup: green 334222 and 336537.
        // Similar fixup: green 034055 and 114052.
        var coursePrefixForHashCalc = {
            '114246': 'a',
            '124708': 'c',
            '134019': 'a',
            '336537': 'a',
            '034055': 'a',
        };
        if (coursePrefixForHashCalc[str]) {
            str = coursePrefixForHashCalc[str] + str;
        }
        return colorHash.hex(str);
    }

    function customColorsFromSavedSession(session) {
        var colors = {};

        var savedColors = session[currentSemester + '_colors'] || {};
        Object.keys(savedColors).forEach(function (colorKey) {
            // Can come from a shared schedule of another user, so accept only plain hex colors.
            if (/^#[0-9a-f]{6}$/i.test(savedColors[colorKey])) {
                colors[colorKey] = savedColors[colorKey];
            }
        });

        return colors;
    }

    function updateColors() {
        courseButtonList.updateColors();
        courseCalendar.updateColors();
        courseExamInfo.renderCourses(getVisibleCourseNumbers());
    }

    // colorKey is a course color key (see courseColorKey) or a custom event id.
    function showColorPicker(colorKey) {
        // Same saturation as the middle value of the automatic colors, with white text in mind.
        var palette = [];
        [0.5, 0.35].forEach(function (lightness) {
            for (var hue = 0; hue < 360; hue += 30) {
                palette.push(hslToHex(hue, 0.5, lightness));
            }
        });

        var content = $('<div class="color-picker"></div>');

        palette.forEach(function (color) {
            var colorButton = $('<button type="button" class="color-picker-item"></button>')
                .attr('aria-label', color)
                .css('background-color', color)
                .toggleClass('color-picker-item-selected', customColors[colorKey] === color)
                .click(function () {
                    dialog.close();
                    customColorSave(colorKey, color);
                    updateColors();
                });
            content.append(colorButton);
        });

        var dialog = BootstrapDialog.show({
            title: CheeseI18n.t('shell.color.title'),
            message: content,
            buttons: [{
                label: CheeseI18n.t('shell.color.default'),
                action: function (dialog) {
                    dialog.close();
                    if (customColors[colorKey]) {
                        customColorSave(colorKey, null);
                        updateColors();
                    }
                }
            }, {
                label: CheeseI18n.t('shell.dialog.close'),
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });

        function hslToHex(hue, saturation, lightness) {
            // https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
            var a = saturation * Math.min(lightness, 1 - lightness);
            return '#' + [0, 8, 4].map(function (n) {
                var k = (n + hue / 30) % 12;
                var value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
                return ('0' + Math.round(value * 255).toString(16)).slice(-2);
            }).join('');
        }
    }

    function showExtraContentOnLoad() {
        // The other popups wait until the "what's new" popup is closed, so they don't show on top of it.
        showWhatsNewPopup(function () {
            return showIntro() || showThursdayGraphPopup() || showTechnionScansPopup();
        });
    }

    // Calls onDone right away if the popup isn't shown, otherwise after it's closed.
    function showWhatsNewPopup(onDone) {
        try {
            var seenVersion = parseInt(localStorage.getItem('whatsNewSeenVersion'), 10);
            if (seenVersion >= whatsNewVersion) {
                onDone();
                return;
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        var features = [{
            icon: 'fas fa-layer-group',
            title: CheeseI18n.t('shell.whatsNew.layers.title'),
            text: CheeseI18n.t('shell.whatsNew.layers.text')
        }, {
            icon: 'fas fa-palette',
            title: CheeseI18n.t('shell.whatsNew.colors.title'),
            text: CheeseI18n.t('shell.whatsNew.colors.text')
        }, {
            icon: 'fas fa-hand-pointer',
            title: CheeseI18n.t('shell.whatsNew.touchDrag.title'),
            text: CheeseI18n.t('shell.whatsNew.touchDrag.text')
        }, {
            icon: 'fas fa-globe',
            title: CheeseI18n.t('shell.whatsNew.language.title'),
            text: CheeseI18n.t('shell.whatsNew.language.text')
        }, {
            icon: 'fas fa-key',
            title: CheeseI18n.t('shell.whatsNew.api.title'),
            text: CheeseI18n.t('shell.whatsNew.api.text')
        }];

        var message = $('<div class="whats-new"></div>');
        message.append($('<p></p>').text(CheeseI18n.t('shell.whatsNew.intro')));

        var list = $('<ul class="list-unstyled mb-0"></ul>');
        features.forEach(function (feature) {
            var item = $('<li class="whats-new-item mb-3"></li>');
            item.append($('<div class="whats-new-icon text-warning"></div>')
                .append($('<i></i>').addClass(feature.icon)));
            item.append($('<h6 class="mb-1 font-weight-bold"></h6>').text(feature.title));
            item.append($('<div></div>').text(feature.text));
            list.append(item);
        });
        message.append(list);

        gtag('event', 'whats-new-show');

        BootstrapDialog.show({
            title: CheeseI18n.t('shell.whatsNew.title'),
            message: message,
            buttons: [{
                label: CheeseI18n.t('shell.tour.done'),
                cssClass: 'btn-primary',
                action: function (dialog) {
                    dialog.close();
                }
            }],
            onhide: function () {
                try {
                    localStorage.setItem('whatsNewSeenVersion', whatsNewVersion.toString());
                } catch (e) {
                    // localStorage is not available in IE/Edge when running from a local file.
                }
            },
            onhidden: function () {
                onDone();
            }
        });
    }

    function showIntro() {
        try {
            var dontShowDate = localStorage.getItem('dontShowIntro');
            if (dontShowDate) {
                return false;
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        if (courseButtonList.getCourseNumbers(true).length > 0) {
            try {
                localStorage.setItem('dontShowIntro', Date.now().toString());
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
            return false;
        }

        introJs().setOptions({
            nextLabel: CheeseI18n.t('shell.tour.next'),
            prevLabel: CheeseI18n.t('shell.tour.previous'),
            skipLabel: CheeseI18n.t('shell.tour.skip'),
            doneLabel: CheeseI18n.t('shell.tour.done'),
            disableInteraction: true,
            exitOnOverlayClick: false,
            showStepNumbers: false,
            scrollToElement: false,
            helperElementPadding: 0
        }).onexit(function () {
            try {
                localStorage.setItem('dontShowIntro', Date.now().toString());
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }).start();

        return true;
    }

    function showThursdayGraphPopup() {
        if (new Date() < new Date('2019-05-09T08:00:00')) {
            // Don't show before the first graph is available.
            return false;
        }

        try {
            var nextShowDate = localStorage.getItem('nextShowThursdayGraphPopup');
            if (nextShowDate && Date.now() < nextShowDate) {
                return false;
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        BootstrapDialog.show({
            title: CheeseI18n.t('shell.weekly.title'),
            message: escapeHtml(CheeseI18n.t('shell.weekly.message')) + '<br>' +
                '<br>' +
                '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="dont-show-thursday-graph-popup"> ' +
                    '<label class="form-check-label" for="dont-show-thursday-graph-popup">' +
                    escapeHtml(CheeseI18n.t('shell.weekly.dontShow')) +
                    '</label>' +
                '</div>' +
                '<br>' +
                '<div class="facebook-iframe-container"></div>',
            onshown: function (dialog) {
                var modalBody = dialog.getModalBody();
                var width = Math.floor(modalBody.width());
                var height = 400;
                var frameSrc = 'https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fcheesefork.technion%2F&tabs=timeline' +
                    '&width=' + width + '&height=' + height + '&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=true&appId=863730240682785';
                var frameElem = $('<iframe style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true" allow="encrypted-media"></iframe>')
                    .attr({src: frameSrc, title: CheeseI18n.t('shell.weekly.frameTitle')}).width(width).height(height);
                modalBody.find('.facebook-iframe-container').html(frameElem);
            },
            buttons: [{
                label: CheeseI18n.t('shell.dialog.close'),
                action: function (dialog) {
                    dialog.close();
                }
            }],
            onhide: function (dialog) {
                var nextShowDate = new Date();

                if (document.getElementById('dont-show-thursday-graph-popup').checked) {
                    gtag('event', 'thursday-graph-dont-show');
                    nextShowDate.setFullYear(nextShowDate.getFullYear() + 1);
                } else {
                    // Advance to the next Thursday 08:00.
                    if (nextShowDate.getHours() >= 8) {
                        nextShowDate.setDate(nextShowDate.getDate() + 1);
                    }
                    nextShowDate.setHours(8, 0, 0, 0);
                    while (nextShowDate.getDay() !== 4) {
                        nextShowDate.setDate(nextShowDate.getDate() + 1);
                    }
                }

                try {
                    localStorage.setItem('nextShowThursdayGraphPopup', nextShowDate.valueOf().toString());
                } catch (e) {
                    // localStorage is not available in IE/Edge when running from a local file.
                }
            }
        });

        return true;
    }

    function showTechnionScansPopup() {
        var inSemesterPeriod = Object.keys(availableSemesters).some(function (semester) {
            var now = Date.now();
            var item = availableSemesters[semester];
            var startDate = new Date(item.start);
            var endDate = new Date(item.end);
            // Subtract several days from end date for an early notification.
            endDate.setDate(endDate.getDate() - 7);
            return now >= startDate && now <= endDate;
        });
        if (inSemesterPeriod) {
            return false;
        }

        try {
            var dontShowDate = localStorage.getItem('dontShowTechnionScansPopup');
            if (dontShowDate) {
                var days = (Date.now() - parseInt(dontShowDate, 10)) / (24 * 3600 * 1000);
                if (days <= 30) {
                    return false;
                }
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        BootstrapDialog.show({
            title: CheeseI18n.t('shell.scans.title'),
            message: '<a href="https://scans.cheesefork.cf/" target="_blank" rel="noopener" onclick="gtag(\'event\', \'scans-click-logo\')">' +
                    '<img src="https://scans.cheesefork.cf/scanner_technion.png" width="30%" class="mx-auto d-block" alt="' + escapeHtml(CheeseI18n.t('shell.scans.logo')) + '">' +
                '</a><br>' +
                escapeHtml(CheeseI18n.t('shell.scans.studying')) + '<br>' +
                escapeHtml(CheeseI18n.t('shell.scans.find')) + '<br>' +
                escapeHtml(CheeseI18n.t('shell.scans.contribute')) + '<br>' +
                '<br>' +
                escapeHtml(CheeseI18n.t('shell.scans.invitation')) +
                    '<a href="https://scans.cheesefork.cf/" target="_blank" rel="noopener" onclick="gtag(\'event\', \'scans-click-link\')">' + escapeHtml(CheeseI18n.t('shell.scans.link')) + '</a>' +
                    escapeHtml(CheeseI18n.t('shell.scans.help')) + '<br>' +
                escapeHtml(CheeseI18n.t('shell.scans.goodLuck')) + '<br>' +
                '<br>' +
                '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="dont-show-technion-scans-popup"> ' +
                    '<label class="form-check-label" for="dont-show-technion-scans-popup">' +
                    escapeHtml(CheeseI18n.t('shell.notice.dontShow')) +
                    '</label>' +
                '</div>',
            buttons: [{
                label: CheeseI18n.t('shell.scans.open'),
                cssClass: 'btn-primary',
                action: function (dialog) {
                    gtag('event', 'scans-click-button');

                    var win = window.open('https://scans.cheesefork.cf/', '_blank', 'noopener');
                    if (win) {
                        win.focus();
                    }
                }
            }, {
                label: CheeseI18n.t('shell.dialog.close'),
                action: function (dialog) {
                    dialog.close();
                }
            }],
            onhide: function (dialog) {
                if (document.getElementById('dont-show-technion-scans-popup').checked) {
                    gtag('event', 'scans-dont-show');

                    try {
                        localStorage.setItem('dontShowTechnionScansPopup', Date.now().toString());
                    } catch (e) {
                        // localStorage is not available in IE/Edge when running from a local file.
                    }
                }
            }
        });

        return true;
    }

    function navbarInit() {
        $('#top-navbar-print-section-title').text(semesterFriendlyName(currentSemester));
        $('#top-navbar-dropdown-semester-name').text(semesterFriendlyName(currentSemester));

        if (!viewingSharedSchedule) {
            var semesterSelect = $('#top-navbar-semester').find('.dropdown-menu');

            Object.keys(availableSemesters).sort().reverse().forEach(function (semester) {
                var link = $('<a class="dropdown-item"></a>')
                    .prop('href', shellUrl({semester: semester}))
                    .text(semesterFriendlyName(semester));
                if (semester === currentSemester) {
                    link.addClass('active');
                }
                semesterSelect.append(link);
            });

            $('#top-navbar-changes').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-changes');

                BootstrapDialog.show({
                    title: CheeseI18n.t('shell.changes.title'),
                    message: getPrettyMetadataDiff(),
                    buttons: [{
                        label: CheeseI18n.t('shell.changes.accept'),
                        cssClass: 'btn-primary',
                        action: function (dialog) {
                            gtag('event', metadataDiff ? 'metadata-to-current' : 'metadata-first-time');

                            setMetadataToCurrent();
                            dialog.close();
                        }
                    }, {
                        label: CheeseI18n.t('shell.dialog.close'),
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            });

            $('#top-navbar-login').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-login');

                if (loginDialog) {
                    loginDialog.open();
                    return;
                }

                loginDialog = BootstrapDialog.show({
                    title: CheeseI18n.t('shell.login.title'),
                    message: $('#firebaseui-auth-container'),
                    buttons: [{
                        label: CheeseI18n.t('shell.dialog.close'),
                        action: function (dialog) {
                            dialog.close();
                        }
                    }],
                    autodestroy: false
                });
            });

            $('#top-navbar-logout').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-logout');

                $(this).find('[data-toggle="tooltip"]').tooltip('hide');

                BootstrapDialog.show({
                    title: CheeseI18n.t('shell.logout.title'),
                    message: CheeseI18n.t('shell.logout.message'),
                    buttons: [{
                        label: CheeseI18n.t('shell.nav.logout'),
                        cssClass: 'btn-primary',
                        action: function (dialog) {
                            firebase.auth().signOut();
                            dialog.close();
                        }
                    }, {
                        label: CheeseI18n.t('shell.dialog.cancel'),
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            });

            $('#top-navbar-share').click(function (event) {
                event.preventDefault();
                if ($(this).find('a').hasClass('disabled')) {
                    return;
                }

                gtag('event', 'navbar-share');

                var url = shellUrl({semester: currentSemester, uid: firebase.auth().currentUser.uid});
                var urlElement = $('<a target="_blank" rel="noopener">').text(CheeseI18n.t('shell.share.open')).prop('href', url);
                var shareDialogContent = $('<div>').text(CheeseI18n.t('shell.share.link')).append(urlElement).append('.');

                BootstrapDialog.show({
                    title: CheeseI18n.t('shell.nav.share'),
                    message: shareDialogContent,
                    buttons: [{
                        label: CheeseI18n.t('shell.share.copy'),
                        cssClass: 'btn-primary',
                        action: function (dialog) {
                            copyToClipboard(url, function () {
                                dialog.close();
                            }, function () {
                                alert(CheeseI18n.t('shell.error.copy'));
                            });
                        }
                    }, {
                        label: CheeseI18n.t('shell.dialog.close'),
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });
            });

            $('#top-navbar-api').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-api');

                $(this).find('[data-toggle="tooltip"]').tooltip('hide');

                showApiKeyDialog();
            });

            $('#top-navbar-undo').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-undo');

                makeUndo();
            });

            $('#top-navbar-redo').click(function (event) {
                event.preventDefault();

                gtag('event', 'navbar-redo');

                makeRedo();
            });
        }

        $('#top-navbar-export').click(function (event) {
            event.preventDefault();

            gtag('event', 'navbar-export');

            $(this).find('[data-toggle="tooltip"]').tooltip('hide');

            var extraCalendarHeaders = [
                'NAME:' + semesterFriendlyName(currentSemester),

                // Suggested minimum interval for polling for changes.
                'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
                'X-PUBLISHED-TTL:PT1H',

                // Timezone data.
                'BEGIN:VTIMEZONE',
                'TZID:Asia/Jerusalem',
                'X-LIC-LOCATION:Asia/Jerusalem',
                'BEGIN:DAYLIGHT',
                'TZNAME:IDT',
                'TZOFFSETFROM:+0200',
                'TZOFFSETTO:+0300',
                'DTSTART:19700327T020000',
                'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1FR',
                'END:DAYLIGHT',
                'BEGIN:STANDARD',
                'TZNAME:IST',
                'TZOFFSETFROM:+0300',
                'TZOFFSETTO:+0200',
                'DTSTART:19701025T020000',
                'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
                'END:STANDARD',
                'END:VTIMEZONE'
            ];

            // Generate a unique UID every time to avoid overriding old events.
            // https://github.com/michael-maltsev/cheese-fork/issues/19
            var icsCal = ics('cheesefork.cf-' + Date.now(), 'CheeseFork²', extraCalendarHeaders, 'Asia/Jerusalem');

            // Schedule.
            var dateFrom = availableSemesters[currentSemester].start;
            var dateTo = availableSemesters[currentSemester].end;

            // This is a workaround for a crazy Outlook bug. Recurring events
            // that start from 26 or 27 of March 2023 are shifted by several
            // hours.
            if (dateFrom === '2023-03-21') {
                dateFrom = '2023-03-19';
            }

            var calendarEventsUrl = 'https://michael-maltsev.github.io/technion-calendar-events/' + currentSemester + '.json';

            function doExport(daysOff) {
                courseCalendar.saveAsIcs(icsCal, dateFrom, dateTo, daysOff);

                // Exams.
                getVisibleCourseNumbers().forEach(function (course) {
                    var general = courseManager.getGeneralInfo(course);
                    ['מועד א', 'מועד ב'].forEach(function (moed) {
                        if (general[moed]) {
                            var parsedDate = courseManager.parseExamDateTime(general[moed]);
                            if (parsedDate) {
                                var title = courseManager.getFieldLabel(moed) + ' – ' + general['שם מקצוע'];
                                icsCal.addEvent(title, '', '', parsedDate.start, parsedDate.end);
                            }
                        }
                    });
                });

                var errorEmptySchedule = function () {
                    BootstrapDialog.show({
                        title: CheeseI18n.t('shell.export.emptyTitle'),
                        message: CheeseI18n.t('shell.export.empty'),
                        size: BootstrapDialog.SIZE_SMALL
                    });
                };

                if (viewingSharedSchedule || typeof firebase === 'undefined' || firebase.auth().currentUser === null) {
                    if (!icsCal.download(semesterFriendlyNameForFileName(currentSemester))) {
                        errorEmptySchedule();
                    }

                    return;
                }

                var calendar = icsCal.build();
                if (!calendar) {
                    errorEmptySchedule();
                    return;
                }

                var calFilePath = firebase.auth().currentUser.uid + '/' + semesterFriendlyNameForFileName(currentSemester) + '.ics';
                // Token-less download URL: stable across re-uploads, access is
                // governed by the Storage security rules (public read).
                var calendarUrl = 'https://firebasestorage.googleapis.com/v0/b/' +
                    firebase.app().options.storageBucket + '/o/' +
                    encodeURIComponent(calFilePath) + '?alt=media';

                var exportCalendarDialog = BootstrapDialog.show({
                    title: CheeseI18n.t('shell.export.title'),
                    message: escapeHtml(CheeseI18n.t('shell.export.explanation')) + '<br><br>' +
                        escapeHtml(CheeseI18n.t('shell.export.link')) + '<span class="calendar-link-placeholder">' +
                        escapeHtml(CheeseI18n.t('shell.export.updating')) + '</span>.',
                    onshow: function (dialog) {
                        dialog.getButton('copy-link').disable();
                    },
                    buttons: [{
                        id: 'copy-link',
                        label: CheeseI18n.t('shell.share.copy'),
                        cssClass: 'btn-primary',
                        action: function (dialog) {
                            copyToClipboard(calendarUrl, function () {
                                dialog.close();
                            }, function () {
                                alert(CheeseI18n.t('shell.error.copy'));
                            });
                        }
                    }, {
                        label: CheeseI18n.t('shell.dialog.close'),
                        action: function (dialog) {
                            dialog.close();
                        }
                    }]
                });

                var storageRef = firebaseStorage.ref();
                var calFileRef = storageRef.child(calFilePath);

                calFileRef.putString(calendar, 'raw', {
                    // Ask browsers not to cache the request.
                    // https://stackoverflow.com/q/42788488
                    // https://stackoverflow.com/q/41938969
                    cacheControl: 'public, max-age=0'
                }).then(function (snapshot) {
                    var urlElement = $('<a target="_blank" rel="noopener">').text(CheeseI18n.t('shell.export.download')).prop('href', calendarUrl);
                    exportCalendarDialog.getModalBody().find('.calendar-link-placeholder').html(urlElement);

                    exportCalendarDialog.getButton('copy-link').enable();
                }, function (error) {
                    alert(CheeseI18n.t('shell.error.saveCalendar', {error: error.message}));
                });
            }

            $.getJSON(calendarEventsUrl)
                .done(function (data) {
                    doExport(data.daysOff || []);
                })
                .fail(function (jqXHR) {
                    if (jqXHR.status === 404) {
                        doExport([]);
                    } else {
                        BootstrapDialog.show({
                            title: CheeseI18n.t('shell.dialog.danger'),
                            message: CheeseI18n.t('shell.export.holidaysError'),
                            size: BootstrapDialog.SIZE_SMALL
                        });
                    }
                });
        });
    }

    function firebaseInit() {
        var config = {
            apiKey: 'AIzaSyDEbZvXmlT5HiVDHwruqpuvI6nSc5DGoLU',
            authDomain: 'cheesefork-squared.firebaseapp.com',
            projectId: 'cheesefork-squared',
            storageBucket: 'cheesefork-squared.firebasestorage.app',
            messagingSenderId: '985208375940',
            appId: '1:985208375940:web:432d864e1636b1bf8ed0d1',
            measurementId: 'G-7B3BP56GNV'
        };
        firebase.initializeApp(config);
        firebase.auth().languageCode = CheeseI18n.getLocale();

        firestoreDb = firebase.firestore();

        firebaseStorage = firebase.storage();
    }

    function firebaseAuthUIInit(onInitialized) {
        // FirebaseUI config.
        var uiConfig = {
            // Opens IDP Providers sign-in flow in a popup.
            signInFlow: 'popup',
            signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID
                // I wanted to implement viewing Facebook friends' schedule via the Facebook API,
                // but they require business verification for the user_friends permission. -_-
                // https://stackoverflow.com/questions/51089608/business-verification-required-as-part-of-my-app-review
                /*,
                {
                    provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
                    scopes: [
                        'public_profile',
                        'email',
                        'user_friends'
                    ]
                }*/
            ],
            callbacks: {
                // Called when the user has been successfully signed in.
                signInSuccessWithAuthResult: function (authResult) {
                    if (authResult.user) {
                        loginDialog.close();
                    }
                    // Do not redirect.
                    return false;
                }
            },
            // Terms of service url.
            //tosUrl: 'https://policies.google.com/terms',
            // Privacy policy url.
            //privacyPolicyUrl: 'https://policies.google.com/privacy',
            // Disable accountchooser.com which is enabled by default.
            credentialHelper: firebaseui.auth.CredentialHelper.NONE
        };

        // Initialize the FirebaseUI Widget using Firebase.
        var firebaseUI = new firebaseui.auth.AuthUI(firebase.auth());

        var authInitialized = false;

        // Listen to change in auth state so it displays the correct UI for when
        // the user is signed in or not.
        firebase.auth().onAuthStateChanged(function (user) {
            user ? handleSignedInUser(user) : handleSignedOutUser();
            if (!authInitialized) {
                onInitialized();
                authInitialized = true;
            } else if (user) {
                // Slow reload.
                $('#page-loader').show();
                stopScheduleWatching();
                resetSchedule();
                watchSavedSchedule(function () {
                    $('#page-loader').hide();
                });
            } else {
                // Fast reload.
                stopScheduleWatching();
                resetSchedule();
                watchSavedSchedule(function () {});
            }
        });

        function handleSignedInUser(user) {
            $('#top-navbar-login').addClass('d-none');
            $('#top-navbar-logout').removeClass('d-none')
                .find('a').attr('data-original-title', CheeseI18n.t('shell.login.signedInAs', {name: firestoreDisplayNameDecode(user.displayName || user.email || CheeseI18n.t('shell.login.unknown'))}));
            $('#top-navbar-share').find('a').removeClass('disabled').tooltip('disable');
            $('#top-navbar-api').removeClass('d-none');
        }

        function handleSignedOutUser() {
            $('#top-navbar-logout').addClass('d-none');
            $('#top-navbar-api').addClass('d-none');
            $('#top-navbar-login').removeClass('d-none');
            $('#top-navbar-share').find('a').addClass('disabled').tooltip('enable');
            firebaseUI.start('#firebaseui-auth-container', uiConfig);
        }
    }

    function semesterFriendlyName(semester) {
        var year = parseInt(semester.slice(0, 4), 10);
        var semesterCode = semester.slice(4);

        switch (semesterCode) {
        case '01':
            return CheeseI18n.t('shell.semester.winter', {year: year, nextYear: year + 1});

        case '02':
            return CheeseI18n.t('shell.semester.spring', {year: year, nextYear: year + 1});

        case '03':
            return CheeseI18n.t('shell.semester.summer', {year: year, nextYear: year + 1});

        default:
            return semester;
        }
    }

    function semesterFriendlyNameForFileName(semester) {
        var year = parseInt(semester.slice(0, 4), 10);
        var semesterCode = semester.slice(4);

        switch (semesterCode) {
        case '01':
            return 'winter-' + year + '-' + (year + 1);

        case '02':
            return 'spring-' + (year + 1);

        case '03':
            return 'summer-' + (year + 1);

        default:
            return semester;
        }
    }

    function updateGeneralInfoLine() {
        var courses = 0;
        var points = 0;

        getVisibleCourseNumbers().forEach(function (course) {
            var general = courseManager.getGeneralInfo(course);
            courses++;
            points += parseFloat(general['נקודות']);
        });

        points = points.toFixed(1).replace(/\.0+$/, '');

        var text;
        if (courses > 0) {
            if (courses === 1) {
                text = CheeseI18n.t('shell.summary.oneCourse');
            } else {
                text = CheeseI18n.t('shell.summary.courses', {count: courses});
            }

            text += ', ';
            if (points === '1') {
                text += CheeseI18n.t('shell.summary.oneCredit');
            } else {
                text += CheeseI18n.t('shell.summary.credits', {count: points});
            }
        } else {
            text = CheeseI18n.t('shell.summary.none');
        }

        $('#general-info').text(text);
    }

    // Layers
    //
    // Layers are optional. The first layer is what a schedule without layers is, and it's saved
    // in the same keys: <semester>_courses, <semester>_<course> and <semester>_custom_events.
    // Its layer id is an empty string.
    //
    // Once more layers are added, <semester>_layers holds them, by layer id:
    // { name, hidden (if true), courses, customEvents }. The selected lessons of their courses
    // are saved in <semester>_<layerId>_<course>. The 'default' item of <semester>_layers is
    // optional and holds the name and hidden values of the first layer if they were changed.

    function layerLessonsKey(course, layerId) {
        return currentSemester + '_' + (layerId ? layerId + '_' : '') + course;
    }

    function sessionExtraLayerIds(session) {
        var semesterLayersKey = currentSemester + '_layers';
        return Object.keys(session[semesterLayersKey] || {}).filter(function (layerId) {
            return layerId !== 'default';
        }).sort();
    }

    function sessionLayerCourses(session, layerId) {
        if (!layerId) {
            return session[currentSemester + '_courses'] || [];
        }

        return session[currentSemester + '_layers'][layerId].courses;
    }

    // Returns the courses of all layers, each course once.
    function sessionAllCourses(session) {
        var courses = [];

        [''].concat(sessionExtraLayerIds(session)).forEach(function (layerId) {
            sessionLayerCourses(session, layerId).forEach(function (course) {
                if (courses.indexOf(course) === -1) {
                    courses.push(course);
                }
            });
        });

        return courses;
    }

    // Returns valid layers data from saved data, which can be of another user for a shared schedule.
    function savedLayersSanitize(savedLayers) {
        var layers = {};
        var extraLayersCount = 0;

        if (!savedLayers || typeof savedLayers !== 'object') {
            return layers;
        }

        Object.keys(savedLayers).forEach(function (layerId) {
            var savedLayer = savedLayers[layerId];
            if (!savedLayer || typeof savedLayer !== 'object') {
                return;
            }

            var layer = {};
            if (typeof savedLayer.name === 'string') {
                layer.name = savedLayer.name;
            }
            if (savedLayer.hidden) {
                layer.hidden = true;
            }

            if (layerId === 'default') {
                layers[layerId] = layer;
            } else if (/^layer\d+$/.test(layerId)) {
                layer.courses = Array.isArray(savedLayer.courses) ? savedLayer.courses.filter(function (course) {
                    return typeof course === 'string';
                }) : [];
                layer.customEvents = savedLayer.customEvents && typeof savedLayer.customEvents === 'object' ?
                    savedLayer.customEvents : {};
                layers[layerId] = layer;
                extraLayersCount++;
            }
        });

        // The first layer alone means no layers.
        return extraLayersCount > 0 ? layers : {};
    }

    // Returns the layers to show for the session, or an empty array if layers aren't used.
    function layersFromSavedSession(session) {
        var extraLayerIds = sessionExtraLayerIds(session);
        if (extraLayerIds.length === 0) {
            return [];
        }

        var savedLayers = session[currentSemester + '_layers'];
        var firstLayer = savedLayers.default || {};

        return [{
            id: '',
            name: firstLayer.name || CheeseI18n.t('shell.layers.defaultName', {number: 1}),
            hidden: !!firstLayer.hidden
        }].concat(extraLayerIds.map(function (layerId) {
            return {
                id: layerId,
                name: savedLayers[layerId].name || CheeseI18n.t('shell.layers.unnamed'),
                hidden: !!savedLayers[layerId].hidden
            };
        }));
    }

    function isLayerVisible(layerId) {
        return !currentLayers.some(function (layer) {
            return layer.id === layerId && layer.hidden;
        });
    }

    // Returns the selected courses of the visible layers, each course once.
    function getVisibleCourseNumbers() {
        if (currentLayers.length === 0) {
            return courseButtonList.getCourseNumbers(true);
        }

        var courseNumbers = [];

        currentLayers.forEach(function (layer) {
            if (!layer.hidden) {
                courseButtonList.getCourseNumbers(true, layer.id).forEach(function (course) {
                    if (courseNumbers.indexOf(course) === -1) {
                        courseNumbers.push(course);
                    }
                });
            }
        });

        return courseNumbers;
    }

    // Returns the layers in which the course is shown in the calendar.
    function getLayerIdsOfCourse(course) {
        if (currentLayers.length === 0) {
            return [''];
        }

        var layerIds = currentLayers.map(function (layer) {
            return layer.id;
        }).filter(function (layerId) {
            return courseButtonList.isCourseInList(course, layerId);
        });

        if (previewingFromSelectControl === course && layerIds.indexOf(previewingFromSelectControlLayerId) === -1) {
            layerIds.push(previewingFromSelectControlLayerId);
        }

        return layerIds;
    }

    // Applies a change to the saved session and saves it.
    // updateFunc gets a copy of the session to modify.
    function savedSessionUpdate(updateFunc) {
        var newSession = $.extend(true, {}, currentSavedSession); // make a deep copy
        updateFunc(newSession);

        savedSessionChangesSave(currentSavedSession, newSession);
        currentSavedSession = newSession;

        metadataDiffRemoveUnusedCourses();
        onSavedSessionChange();
    }

    // Same, for changes of the layers themselves, after which the schedule is reloaded.
    function savedSessionUpdateAndReload(updateFunc) {
        savedSessionUpdate(updateFunc);
        setScheduleFromSavedSession(currentSavedSession, true);
        courseSelect.filterApply();
    }

    function metadataDiffRemoveUnusedCourses() {
        if (!metadataDiff) {
            return;
        }

        var courses = sessionAllCourses(currentSavedSession);
        var changed = false;

        Object.keys(metadataDiff).forEach(function (course) {
            if (courses.indexOf(course) === -1) {
                delete metadataDiff[course];
                changed = true;
            }
        });

        if (changed) {
            onMetadataDiffChange();
        }
    }

    function sessionLayerCourseMove(session, course, fromLayerId, toLayerId, toLayerCourses) {
        var semesterCoursesKey = currentSemester + '_courses';
        var semesterLayersKey = currentSemester + '_layers';

        var setLayerCourses = function (layerId, courses) {
            if (layerId) {
                session[semesterLayersKey][layerId].courses = courses;
            } else {
                session[semesterCoursesKey] = courses;
            }
        };

        setLayerCourses(fromLayerId, sessionLayerCourses(session, fromLayerId).filter(function (item) {
            return item !== course;
        }));

        // Keep the items which aren't in the given order, same as in selectedCourseSave.
        toLayerCourses = toLayerCourses || [course];
        setLayerCourses(toLayerId, toLayerCourses.concat(
            $(sessionLayerCourses(session, toLayerId)).not(toLayerCourses).get()));

        var fromKey = layerLessonsKey(course, fromLayerId);
        session[layerLessonsKey(course, toLayerId)] = session[fromKey] || {};
        delete session[fromKey];

        // The color moves with the course.
        sessionCourseColorMove(session, course, fromLayerId, toLayerId);
    }

    function sessionCourseColorMove(session, course, fromLayerId, toLayerId) {
        var colors = session[currentSemester + '_colors'];
        var fromColorKey = courseColorKey(course, fromLayerId);
        var toColorKey = courseColorKey(course, toLayerId);
        if (colors[fromColorKey]) {
            colors[toColorKey] = colors[fromColorKey];
        } else {
            delete colors[toColorKey];
        }
        delete colors[fromColorKey];
    }

    // Removes the remaining course colors of a removed layer, including of courses which were
    // unselected earlier. Layer ids aren't reused, so these colors are no longer needed.
    function sessionLayerCourseColorsRemove(session, layerId) {
        var colors = session[currentSemester + '_colors'];
        Object.keys(colors).forEach(function (colorKey) {
            if (colorKey.indexOf(layerId + '_') === 0) {
                delete colors[colorKey];
            }
        });
    }

    function layerCourseMove(course, fromLayerId, toLayerId) {
        var toLayerCourses = courseButtonList.getCourseNumbers(true, toLayerId);

        savedSessionUpdateAndReload(function (session) {
            sessionLayerCourseMove(session, course, fromLayerId, toLayerId, toLayerCourses);
        });
    }

    function sessionLayerCustomEvents(session, layerId) {
        if (!layerId) {
            return session[currentSemester + '_custom_events'];
        }

        return session[currentSemester + '_layers'][layerId].customEvents;
    }

    function sessionLayerCustomEventMove(session, eventId, fromLayerId, toLayerId) {
        var fromCustomEvents = sessionLayerCustomEvents(session, fromLayerId);
        if (fromCustomEvents[eventId]) {
            sessionLayerCustomEvents(session, toLayerId)[eventId] = fromCustomEvents[eventId];
            delete fromCustomEvents[eventId];
        }
    }

    function layerCustomEventMove(eventId, fromLayerId, toLayerId) {
        savedSessionUpdateAndReload(function (session) {
            sessionLayerCustomEventMove(session, eventId, fromLayerId, toLayerId);
        });
    }

    function layerCustomEventRemove(eventId, layerId) {
        savedSessionUpdateAndReload(function (session) {
            delete sessionLayerCustomEvents(session, layerId)[eventId];
            // Same as in customEventUnsave, the color of a removed event is no longer needed.
            delete session[currentSemester + '_colors']['custom_event_' + eventId];
        });
    }

    // Creates a new layer. If course or customEventId are given, the item is moved to the new layer.
    function layerCreate(course, fromLayerId, customEventId) {
        var semesterLayersKey = currentSemester + '_layers';
        var newLayerId;

        savedSessionUpdateAndReload(function (session) {
            var layers = session[semesterLayersKey];

            var layerIdCounter = Math.round(Date.now() / 1000);
            newLayerId = 'layer' + layerIdCounter;
            while (layers[newLayerId]) {
                layerIdCounter++;
                newLayerId = 'layer' + layerIdCounter;
            }

            layers[newLayerId] = {
                name: CheeseI18n.t('shell.layers.defaultName', {number: sessionExtraLayerIds(session).length + 2}),
                courses: [],
                customEvents: {}
            };

            if (course !== null) {
                sessionLayerCourseMove(session, course, fromLayerId, newLayerId);
            } else if (customEventId !== undefined) {
                sessionLayerCustomEventMove(session, customEventId, fromLayerId, newLayerId);
            }
        });

        if (course === null && customEventId === undefined) {
            // An empty layer was requested, probably for adding courses to it.
            courseButtonList.setActiveLayer(newLayerId);
        }
    }

    function layerRename(layerId, name) {
        var semesterLayersKey = currentSemester + '_layers';

        savedSessionUpdateAndReload(function (session) {
            var layers = session[semesterLayersKey];
            var key = layerId || 'default';
            layers[key] = layers[key] || {};
            layers[key].name = name;
        });
    }

    function layerVisibilityChange(layerId, hidden) {
        var semesterLayersKey = currentSemester + '_layers';

        savedSessionUpdateAndReload(function (session) {
            var layers = session[semesterLayersKey];
            var key = layerId || 'default';
            layers[key] = layers[key] || {};
            if (hidden) {
                layers[key].hidden = true;
            } else {
                delete layers[key].hidden;
            }

            if (Object.keys(layers.default || {}).length === 0) {
                delete layers.default;
            }
        });
    }

    // Deletes the layer with its courses and custom events.
    function layerDelete(layerId) {
        var semesterCoursesKey = currentSemester + '_courses';
        var semesterCustomEventsKey = currentSemester + '_custom_events';
        var semesterLayersKey = currentSemester + '_layers';

        savedSessionUpdateAndReload(function (session) {
            var layers = session[semesterLayersKey];

            sessionLayerCourses(session, layerId).forEach(function (course) {
                delete session[layerLessonsKey(course, layerId)];
            });

            // The colors of the removed custom events are no longer needed. Course colors of the
            // first layer are kept, same as when unselecting a course, since its keys are reused.
            var layerCustomEvents = layerId ? layers[layerId].customEvents : session[semesterCustomEventsKey];
            Object.keys(layerCustomEvents || {}).forEach(function (eventId) {
                delete session[currentSemester + '_colors']['custom_event_' + eventId];
            });

            if (layerId) {
                sessionLayerCourseColorsRemove(session, layerId);
                delete layers[layerId];
            } else {
                // The first layer can't be removed, since it's the layer of the keys
                // which are used without layers. Move the next layer into it instead.
                var nextLayerId = sessionExtraLayerIds(session)[0];
                var nextLayer = layers[nextLayerId];

                session[semesterCoursesKey] = nextLayer.courses;
                nextLayer.courses.forEach(function (course) {
                    var nextLayerKey = layerLessonsKey(course, nextLayerId);
                    session[layerLessonsKey(course, '')] = session[nextLayerKey] || {};
                    delete session[nextLayerKey];
                    sessionCourseColorMove(session, course, nextLayerId, '');
                });
                sessionLayerCourseColorsRemove(session, nextLayerId);

                session[semesterCustomEventsKey] = nextLayer.customEvents;

                layers.default = { name: nextLayer.name };
                if (nextLayer.hidden) {
                    layers.default.hidden = true;
                }

                delete layers[nextLayerId];
            }

            // With only the first layer left, layers are no longer used.
            if (sessionExtraLayerIds(session).length === 0) {
                session[semesterLayersKey] = {};
            }
        });
    }

    function selectedCourseSave(course, layerId) {
        if (layerId) {
            // Use the button list for the order, same as below.
            var layerCourseNumbers = courseButtonList.getCourseNumbers(true, layerId);
            savedSessionUpdate(function (session) {
                var layer = session[currentSemester + '_layers'][layerId];
                layer.courses = layerCourseNumbers.concat($(layer.courses).not(layerCourseNumbers).get());
                session[layerLessonsKey(course, layerId)] = {};
            });
            return;
        }

        var metadataCourseKey = null;
        var courseData = null;
        var metadataUpdate = !!metadataDiff;
        if (metadataUpdate) {
            metadataCourseKey = currentSemester + '_metadata_' + course;
            courseData = courseManager.getCourseData(course);
        }

        var semesterCoursesKey = currentSemester + '_courses';
        var courseKey = currentSemester + '_' + course;

        // Keep all of the items from currentSavedSession[semesterCoursesKey], even if there
        // are numbers of courses which don't exist anymore. Use the button list for the order.
        var courseNumbers = courseButtonList.getCourseNumbers(true, '');
        currentSavedSession[semesterCoursesKey] = courseNumbers.concat(
            $(currentSavedSession[semesterCoursesKey]).not(courseNumbers).get());
        currentSavedSession[courseKey] = {};

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = currentSavedSession[semesterCoursesKey];
            input[courseKey] = {};
            if (metadataUpdate) {
                input[metadataCourseKey] = courseData;
            }
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
                localStorage.removeItem(courseKey);
                if (metadataUpdate) {
                    localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
                }
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function coursesOrderSave(layerId) {
        if (layerId) {
            var layerCourseNumbers = courseButtonList.getCourseNumbers(true, layerId);
            savedSessionUpdate(function (session) {
                var layer = session[currentSemester + '_layers'][layerId];
                layer.courses = layerCourseNumbers.concat($(layer.courses).not(layerCourseNumbers).get());
            });
            return;
        }

        // Save only the course order when reordering via drag-and-drop
        var semesterCoursesKey = currentSemester + '_courses';
        var courseNumbers = courseButtonList.getCourseNumbers(true, '');
        currentSavedSession[semesterCoursesKey] = courseNumbers.concat(
            $(currentSavedSession[semesterCoursesKey]).not(courseNumbers).get());

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = currentSavedSession[semesterCoursesKey];
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function selectedCourseUnsave(course, layerId) {
        if (layerId) {
            savedSessionUpdate(function (session) {
                var layer = session[currentSemester + '_layers'][layerId];
                layer.courses = layer.courses.filter(function (item) {
                    return item !== course;
                });
                delete session[layerLessonsKey(course, layerId)];
            });
            return;
        }

        var metadataCourseKey = currentSemester + '_metadata_' + course;

        var semesterCoursesKey = currentSemester + '_courses';
        var courseKey = currentSemester + '_' + course;

        currentSavedSession[semesterCoursesKey] = currentSavedSession[semesterCoursesKey].filter(function (item) {
            return item !== course;
        });
        delete currentSavedSession[courseKey];

        // The metadata is still needed if the course is in another layer.
        var removeMetadata = sessionAllCourses(currentSavedSession).indexOf(course) === -1;

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCoursesKey] = firebase.firestore.FieldValue.arrayRemove(course);
            input[courseKey] = firebase.firestore.FieldValue.delete();
            if (removeMetadata) {
                input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
            }
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
                localStorage.removeItem(courseKey);
                if (removeMetadata) {
                    localStorage.removeItem(metadataCourseKey);
                }
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();

        if (removeMetadata && metadataDiff && metadataDiff[course]) {
            delete metadataDiff[course];
            onMetadataDiffChange();
        }
    }

    function selectedLessonSave(course, lessonNumber, lessonType, layerId) {
        if (layerId) {
            savedSessionUpdate(function (session) {
                session[layerLessonsKey(course, layerId)][lessonType] = lessonNumber;
            });
            return;
        }

        var courseKey = currentSemester + '_' + course;

        currentSavedSession[courseKey][lessonType] = lessonNumber;

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = lessonNumber;
            doc.update(input);
        } else {
            try {
                localStorage.setItem(courseKey, JSON.stringify(currentSavedSession[courseKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function selectedLessonUnsave(course, lessonNumber, lessonType, layerId) {
        if (layerId) {
            savedSessionUpdate(function (session) {
                delete session[layerLessonsKey(course, layerId)][lessonType];
            });
            return;
        }

        var courseKey = currentSemester + '_' + course;

        delete currentSavedSession[courseKey][lessonType];

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[courseKey + '.' + lessonType] = firebase.firestore.FieldValue.delete();
            doc.update(input);
        } else {
            try {
                localStorage.setItem(courseKey, JSON.stringify(currentSavedSession[courseKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function customEventSave(eventId, eventData, layerId) {
        if (layerId) {
            savedSessionUpdate(function (session) {
                session[currentSemester + '_layers'][layerId].customEvents[eventId] = eventData;
            });
            return;
        }

        var semesterCustomEventsKey = currentSemester + '_custom_events';

        currentSavedSession[semesterCustomEventsKey][eventId] = eventData;

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCustomEventsKey + '.' + eventId] = eventData;
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCustomEventsKey, JSON.stringify(currentSavedSession[semesterCustomEventsKey]));
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    function customEventUnsave(eventId, layerId) {
        // The event id isn't reused, so its custom color (if any) is no longer needed.
        var semesterColorsKey = currentSemester + '_colors';
        var colorKey = 'custom_event_' + eventId;

        if (layerId) {
            delete customColors[colorKey];
            savedSessionUpdate(function (session) {
                delete session[currentSemester + '_layers'][layerId].customEvents[eventId];
                delete session[semesterColorsKey][colorKey];
            });
            return;
        }

        var semesterCustomEventsKey = currentSemester + '_custom_events';

        delete currentSavedSession[semesterCustomEventsKey][eventId];

        var hadCustomColor = !!currentSavedSession[semesterColorsKey][colorKey];
        delete currentSavedSession[semesterColorsKey][colorKey];
        delete customColors[colorKey];

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            input[semesterCustomEventsKey + '.' + eventId] = firebase.firestore.FieldValue.delete();
            if (hadCustomColor) {
                customColorFirestoreInput(input, colorKey);
            }
            doc.update(input);
        } else {
            try {
                localStorage.setItem(semesterCustomEventsKey, JSON.stringify(currentSavedSession[semesterCustomEventsKey]));
                if (hadCustomColor) {
                    customColorsLocalStorageSave();
                }
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    // colorKey is a course color key (see courseColorKey) or a custom event id.
    // Pass null as color to remove the custom color.
    function customColorSave(colorKey, color) {
        var semesterColorsKey = currentSemester + '_colors';

        if (color) {
            currentSavedSession[semesterColorsKey][colorKey] = color;
            customColors[colorKey] = color;
        } else {
            delete currentSavedSession[semesterColorsKey][colorKey];
            delete customColors[colorKey];
        }

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};
            customColorFirestoreInput(input, colorKey);
            doc.update(input);
        } else {
            try {
                customColorsLocalStorageSave();
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        onSavedSessionChange();
    }

    // Sets the Firestore update for colorKey according to currentSavedSession.
    // The colors are stored only if there are any, most users don't have custom colors.
    function customColorFirestoreInput(input, colorKey) {
        var semesterColorsKey = currentSemester + '_colors';
        var colors = currentSavedSession[semesterColorsKey];

        if (Object.keys(colors).length === 0) {
            input[semesterColorsKey] = firebase.firestore.FieldValue.delete();
        } else {
            input[semesterColorsKey + '.' + colorKey] = colors[colorKey] || firebase.firestore.FieldValue.delete();
        }
    }

    function customColorsLocalStorageSave() {
        var semesterColorsKey = currentSemester + '_colors';
        var colors = currentSavedSession[semesterColorsKey];

        if (Object.keys(colors).length === 0) {
            localStorage.removeItem(semesterColorsKey);
        } else {
            localStorage.setItem(semesterColorsKey, JSON.stringify(colors));
        }
    }

    function watchSharedSchedule(onLoadedFunc) {
        var firstDataLoaded = false;

        var doc = firestoreUserDoc(scheduleSharingUserId);
        doc.onSnapshot(function (result) {
            var session = result.exists ? savedSessionFromFirestoreData(result.data()) : {};
            setScheduleFromSavedSession(session, !firstDataLoaded);

            if (result.exists && result.data().displayName) {
                var displayName = firestoreDisplayNameDecode(result.data().displayName);
                $('#sharing-user-name').text(displayName);
                $('#sharing-user-known').removeClass('d-none');
                $('#sharing-user-unknown').addClass('d-none');
                setPageTitle(displayName + ' – ' + CheeseI18n.t('shell.meta.title'));
            } else {
                $('#sharing-user-unknown').removeClass('d-none');
                $('#sharing-user-known').addClass('d-none');
                setPageTitle(CheeseI18n.t('shell.meta.title'));
            }

            if (!firstDataLoaded) {
                onLoadedFunc();
                firstDataLoaded = true;
            }
        }, function (error) {
            alert(CheeseI18n.t('shell.error.loadData', {error: error}));
        });
    }

    function watchSavedSchedule(onLoadedFunc) {
        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var firstDataLoaded = false;

            stopScheduleWatching = doc.onSnapshot(function (result) {
                if (result.metadata.hasPendingWrites) {
                    // The callback was called as a result of a local change, ignore it.
                    // https://stackoverflow.com/questions/50186413/is-firestore-onsnapshot-update-event-due-to-local-client-set
                    return;
                }

                if (!firstDataLoaded) {
                    // Save name in server for sharing purposes.
                    // Note: Setting displayName serves two purposes, saving the
                    // name and actually creating the document for the semester
                    // if it doesn't exist yet. So set it even if it's null.
                    doc.set({ displayName: firebase.auth().currentUser.displayName }, { merge: true });
                }

                var session = savedSessionFromFirestoreData(result.exists ? result.data() : {});
                setScheduleFromSavedSession(session, !firstDataLoaded);

                if (shouldEnableMetadataDiff()) {
                    var metadata = savedMetadataFromFirestoreData(result.exists ? result.data() : {});
                    metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                    onMetadataDiffChange();
                } else {
                    metadataDiff = null;
                }

                currentSavedSession = session;

                // Local changes are skipped above, so this is a change from another tab, device
                // or the API. Undo restores the session saved for it, so start undo from here,
                // otherwise it would revert the change made elsewhere.
                onSavedSessionReset();
                if (!firstDataLoaded) {
                    firstDataLoaded = true;
                    onLoadedFunc();
                }
            }, function (error) {
                alert(CheeseI18n.t('shell.error.loadData', {error: error}));
            });
        } else {
            var onStorageEvent = function (e) {
                var prefix = currentSemester + '_';
                // The key is null if the storage was cleared, which removes the schedule too.
                // Otherwise, check if the key starts with the semester prefix.
                // https://stackoverflow.com/a/4579228
                if (e.key === null || e.key.lastIndexOf(prefix, 0) === 0) {
                    var session = savedSessionFromLocalStorage();
                    setScheduleFromSavedSession(session, true);

                    if (shouldEnableMetadataDiff()) {
                        var metadata = savedMetadataFromLocalStorage();
                        metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                        onMetadataDiffChange();
                    } else {
                        metadataDiff = null;
                    }

                    currentSavedSession = session;
                    // A change from another tab. Start undo from here, as for Firestore above.
                    onSavedSessionReset();
                }
            };

            window.addEventListener('storage', onStorageEvent);

            stopScheduleWatching = function () {
                window.removeEventListener('storage', onStorageEvent);
            };

            var session = savedSessionFromLocalStorage();
            setScheduleFromSavedSession(session, false);

            if (shouldEnableMetadataDiff()) {
                var metadata = savedMetadataFromLocalStorage();
                metadataDiff = metadata ? computeMetadataDiff(metadata) : null;
                onMetadataDiffChange();
            } else {
                metadataDiff = null;
            }

            currentSavedSession = session;
            onSavedSessionReset();

            onLoadedFunc();
        }
    }

    function savedSessionFromLocalStorage() {
        var semesterCoursesKey = currentSemester + '_courses';
        var session = {};
        try {
            session[semesterCoursesKey] = JSON.parse(localStorage.getItem(semesterCoursesKey) || '[]');
            session[semesterCoursesKey].forEach(function (course) {
                var courseKey = currentSemester + '_' + course;
                session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
            });
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            session[semesterCoursesKey] = [];
        }

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        try {
            session[semesterCustomEventsKey] = JSON.parse(localStorage.getItem(semesterCustomEventsKey) || '{}');
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            session[semesterCustomEventsKey] = {};
        }

        var semesterColorsKey = currentSemester + '_colors';
        try {
            session[semesterColorsKey] = JSON.parse(localStorage.getItem(semesterColorsKey) || '{}');
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            session[semesterColorsKey] = {};
        }

        var semesterLayersKey = currentSemester + '_layers';
        try {
            session[semesterLayersKey] = savedLayersSanitize(JSON.parse(localStorage.getItem(semesterLayersKey) || '{}'));
            sessionExtraLayerIds(session).forEach(function (layerId) {
                sessionLayerCourses(session, layerId).forEach(function (course) {
                    var courseKey = layerLessonsKey(course, layerId);
                    session[courseKey] = JSON.parse(localStorage.getItem(courseKey) || '{}');
                });
            });
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
            session[semesterLayersKey] = {};
        }

        return session;
    }

    function savedMetadataFromLocalStorage() {
        var metadata = {};
        try {
            var courses = sessionAllCourses(savedSessionFromLocalStorage());
            courses.forEach(function (course) {
                var metadataCourseKey = currentSemester + '_metadata_' + course;
                var courseMetadataEncoded = localStorage.getItem(metadataCourseKey);
                if (courseMetadataEncoded) {
                    metadata[course] = JSON.parse(courseMetadataEncoded);
                }
            });

            // If there's at least one course but no metadata at all, that probably means that
            // the user built the schedule before the feature was introduced.
            // Return null to handle the case.
            if (courses.length > 0 && Object.keys(metadata).length === 0) {
                metadata = null;
            }
        } catch (e) {
            // localStorage is not available in IE/Edge when running from a local file.
        }

        return metadata;
    }

    function savedSessionFromFirestoreData(data) {
        // Returns only the data relevant to the current semester from data.
        var semesterCoursesKey = currentSemester + '_courses';
        var session = {};
        session[semesterCoursesKey] = data[semesterCoursesKey] || [];
        session[semesterCoursesKey].forEach(function (course) {
            var courseKey = currentSemester + '_' + course;
            session[courseKey] = data[courseKey] || {};
        });

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        session[semesterCustomEventsKey] = data[semesterCustomEventsKey] || {};

        var semesterColorsKey = currentSemester + '_colors';
        session[semesterColorsKey] = data[semesterColorsKey] || {};

        var semesterLayersKey = currentSemester + '_layers';
        session[semesterLayersKey] = savedLayersSanitize(data[semesterLayersKey]);
        sessionExtraLayerIds(session).forEach(function (layerId) {
            sessionLayerCourses(session, layerId).forEach(function (course) {
                var courseKey = layerLessonsKey(course, layerId);
                session[courseKey] = data[courseKey] || {};
            });
        });

        return session;
    }

    function savedMetadataFromFirestoreData(data) {
        var metadata = {};

        var courses = sessionAllCourses(savedSessionFromFirestoreData(data));
        courses.forEach(function (course) {
            var metadataCourseKey = currentSemester + '_metadata_' + course;
            if (data[metadataCourseKey]) {
                metadata[course] = data[metadataCourseKey];
            }
        });

        // If there's at least one course but no metadata at all, that probably means that
        // the user built the schedule before the feature was introduced.
        // Return null to handle the case.
        if (courses.length > 0 && Object.keys(metadata).length === 0) {
            metadata = null;
        }

        return metadata;
    }

    function restoreSavedSession(currentSession, sessionToRestore) {
        savedSessionChangesSave(currentSession, sessionToRestore);
        setScheduleFromSavedSession(sessionToRestore);
    }

    // Saves the changes between the two sessions.
    function savedSessionChangesSave(currentSession, sessionToRestore) {
        var newKeys = [], removeKeys = [];
        var newMetadataCourses = [];

        var semesterCoursesKey = currentSemester + '_courses';
        var currentCourses = currentSession[semesterCoursesKey];
        var newCourses = sessionToRestore[semesterCoursesKey];
        if (JSON.stringify(currentCourses) !== JSON.stringify(newCourses)) {
            newKeys.push(semesterCoursesKey);
        }

        currentCourses.forEach(function (course) {
            if (newCourses.indexOf(course) === -1) {
                var courseKey = currentSemester + '_' + course;
                removeKeys.push(courseKey);
            }
        });

        newCourses.forEach(function (course) {
            var courseKey = currentSemester + '_' + course;
            if (currentCourses.indexOf(course) === -1) {
                newKeys.push(courseKey);
            } else {
                var currentLessons = currentSession[courseKey];
                var newLessons = sessionToRestore[courseKey];
                // Can be different even if object are equal due to key order,
                // but that's OK, we'll just override the same data.
                if (JSON.stringify(currentLessons) !== JSON.stringify(newLessons)) {
                    newKeys.push(courseKey);
                }
            }
        });

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        var currentCustomEvents = currentSession[semesterCustomEventsKey];
        var newCustomEvents = sessionToRestore[semesterCustomEventsKey];
        // Can be different even if object are equal due to key order,
        // but that's OK, we'll just override the same data.
        if (JSON.stringify(currentCustomEvents) !== JSON.stringify(newCustomEvents)) {
            newKeys.push(semesterCustomEventsKey);
        }

        var semesterColorsKey = currentSemester + '_colors';
        if (JSON.stringify(currentSession[semesterColorsKey]) !== JSON.stringify(sessionToRestore[semesterColorsKey])) {
            if (Object.keys(sessionToRestore[semesterColorsKey]).length === 0) {
                removeKeys.push(semesterColorsKey);
            } else {
                newKeys.push(semesterColorsKey);
            }
        }

        var semesterLayersKey = currentSemester + '_layers';
        var currentSavedLayers = currentSession[semesterLayersKey];
        var newSavedLayers = sessionToRestore[semesterLayersKey];
        if (JSON.stringify(currentSavedLayers) !== JSON.stringify(newSavedLayers)) {
            // Layers are saved only if they're used.
            if (Object.keys(newSavedLayers).length > 0) {
                newKeys.push(semesterLayersKey);
            } else {
                removeKeys.push(semesterLayersKey);
            }
        }

        sessionExtraLayerIds(currentSession).forEach(function (layerId) {
            sessionLayerCourses(currentSession, layerId).forEach(function (course) {
                if (!newSavedLayers[layerId] || newSavedLayers[layerId].courses.indexOf(course) === -1) {
                    removeKeys.push(layerLessonsKey(course, layerId));
                }
            });
        });

        sessionExtraLayerIds(sessionToRestore).forEach(function (layerId) {
            sessionLayerCourses(sessionToRestore, layerId).forEach(function (course) {
                var courseKey = layerLessonsKey(course, layerId);
                if (JSON.stringify(currentSession[courseKey]) !== JSON.stringify(sessionToRestore[courseKey])) {
                    newKeys.push(courseKey);
                }
            });
        });

        // The metadata is saved once for a course, regardless of the layers it's in.
        if (metadataDiff) {
            var currentAllCourses = sessionAllCourses(currentSession);
            var newAllCourses = sessionAllCourses(sessionToRestore);

            currentAllCourses.forEach(function (course) {
                if (newAllCourses.indexOf(course) === -1) {
                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    removeKeys.push(metadataCourseKey);
                }
            });

            newAllCourses.forEach(function (course) {
                if (currentAllCourses.indexOf(course) === -1) {
                    newMetadataCourses.push(course);
                }
            });
        }

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};

            removeKeys.forEach(function (key) {
                input[key] = firebase.firestore.FieldValue.delete();
            });

            newKeys.forEach(function (key) {
                input[key] = sessionToRestore[key];
            });

            newMetadataCourses.forEach(function (course) {
                var metadataCourseKey = currentSemester + '_metadata_' + course;
                input[metadataCourseKey] = courseManager.getCourseData(course);
            });

            doc.update(input);
        } else {
            try {
                removeKeys.forEach(function (key) {
                    localStorage.removeItem(key);
                });

                newKeys.forEach(function (key) {
                    localStorage.setItem(key, JSON.stringify(sessionToRestore[key]));
                });

                newMetadataCourses.forEach(function (course) {
                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    localStorage.setItem(metadataCourseKey, JSON.stringify(courseManager.getCourseData(course)));
                });
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }
    }

    function setScheduleFromSavedSession(session, restoreScrollPosition) {
        var scrollTop;
        if (restoreScrollPosition) {
            scrollTop = $(window).scrollTop(); // save scroll position
        }

        customColors = customColorsFromSavedSession(session);

        var semesterCoursesKey = currentSemester + '_courses';
        courseButtonList.clear();

        currentLayers = layersFromSavedSession(session);
        courseButtonList.setLayers(currentLayers);

        var schedule = {};

        var courses = session[semesterCoursesKey] || [];
        courses.forEach(function (course) {
            if (!schedule[course] && courseManager.doesExist(course)) {
                courseButtonList.addCourse(course);

                var courseKey = currentSemester + '_' + course;
                var lessons = session[courseKey] || {};
                schedule[course] = lessons;
            }
        });

        var semesterCustomEventsKey = currentSemester + '_custom_events';
        var customEvents = session[semesterCustomEventsKey] || {};

        // The courses of all layers are in the list, but only visible layers are in the calendar.
        var extraLayers = [];

        if (currentLayers.length === 0) {
            Object.keys(customEvents).sort().forEach(function (eventId) {
                courseButtonList.addCustomEvent(eventId, customEvents[eventId].title, '');
            });
        }

        currentLayers.forEach(function (layer) {
            // Custom events are in the list too, for moving them between layers or removing them.
            var layerCustomEvents = sessionLayerCustomEvents(session, layer.id) || {};
            Object.keys(layerCustomEvents).sort().forEach(function (eventId) {
                courseButtonList.addCustomEvent(eventId, layerCustomEvents[eventId].title, layer.id);
            });

            if (!layer.id) {
                if (layer.hidden) {
                    schedule = {};
                    customEvents = {};
                }
                return;
            }

            var layerSchedule = {};

            sessionLayerCourses(session, layer.id).forEach(function (course) {
                if (!layerSchedule[course] && courseManager.doesExist(course)) {
                    courseButtonList.addCourse(course, layer.id);
                    layerSchedule[course] = session[layerLessonsKey(course, layer.id)] || {};
                }
            });

            if (!layer.hidden) {
                extraLayers.push({
                    id: layer.id,
                    schedule: layerSchedule,
                    customEvents: session[currentSemester + '_layers'][layer.id].customEvents
                });
            }
        });

        courseCalendar.loadSavedSchedule(schedule, customEvents, extraLayers);
        updateGeneralInfoLine();
        courseExamInfo.renderCourses(getVisibleCourseNumbers());

        if (restoreScrollPosition) {
            $(window).scrollTop(scrollTop); // restore scroll position
        }
    }

    function resetSchedule() {
        customColors = {};
        currentLayers = [];
        courseButtonList.clear();
        courseCalendar.removeAll();
        updateGeneralInfoLine();
        courseExamInfo.renderCourses([]);
        courseSelect.filterReset();
    }

    function onSavedSessionReset() {
        savedSessionForUndo = $.extend(true, {}, currentSavedSession); // make a deep copy

        $('#top-navbar-undo').addClass('d-none');
        $('#top-navbar-redo').addClass('d-none');
    }

    function onSavedSessionChange() {
        $('#top-navbar-undo').removeClass('d-none');
        $('#top-navbar-redo').addClass('d-none');
    }

    function makeUndo() {
        restoreSavedSession(currentSavedSession, savedSessionForUndo);

        savedSessionForRedo = currentSavedSession;
        currentSavedSession = $.extend(true, {}, savedSessionForUndo); // make a deep copy

        $('#top-navbar-undo').addClass('d-none');
        $('#top-navbar-redo').removeClass('d-none');
    }

    function makeRedo() {
        restoreSavedSession(currentSavedSession, savedSessionForRedo);

        currentSavedSession = savedSessionForRedo;
        savedSessionForRedo = null;

        $('#top-navbar-redo').addClass('d-none');
        $('#top-navbar-undo').removeClass('d-none');
    }

    function firestoreAuthenticatedUserDoc() {
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser !== null) {
            var doc = firestoreDb.collection('users').doc(firebase.auth().currentUser.uid);

            var semestersWithoutSubCollection = ['201701', '201702', '201703', '201801'];
            if (semestersWithoutSubCollection.indexOf(currentSemester) === -1) {
                doc = doc.collection('semesters').doc(currentSemester);
            }

            return doc;
        }
        return null;
    }

    function firestoreUserDoc(userId) {
        var doc = firestoreDb.collection('users').doc(userId);

        var semestersWithoutSubCollection = ['201701', '201702', '201703', '201801'];
        if (semestersWithoutSubCollection.indexOf(currentSemester) === -1) {
            doc = doc.collection('semesters').doc(currentSemester);
        }

        return doc;
    }

    function firestoreDisplayNameDecode(displayName) {
        // For some reason, the ' symbol is encoded as &#39;.
        return displayName.replace('&#39;', '\'');
    }

    function shouldEnableMetadataDiff() {
        // Only enable the feature for last four semesters.
        // Only the last three are updated, and extra semester to give time to see the most recent changes.
        var lastFourSemesters = Object.keys(availableSemesters).sort().reverse().slice(0, 4);
        return lastFourSemesters.indexOf(currentSemester) !== -1;
    }

    function computeMetadataDiff(metadata) {
        var diff = {};

        Object.keys(metadata).forEach(function (course) {
            var courseMetadata = metadata[course];

            if (!courseManager.doesExist(course)) {
                diff[course] = {
                    exists: false,
                    general: courseMetadata.general
                };
                return;
            }

            var generalCourseDiff = computeCourseGeneralMetadataDiff(courseMetadata.general, courseManager.getGeneralInfo(course));
            var scheduleCourseDiff = computeCourseScheduleMetadataDiff(courseMetadata.schedule, courseManager.getSchedule(course));
            if (generalCourseDiff.length > 0 || scheduleCourseDiff.length > 0) {
                diff[course] = {
                    exists: true,
                    changes: generalCourseDiff.concat(scheduleCourseDiff)
                };
            }
        });

        return diff;
    }

    function computeCourseGeneralMetadataDiff(oldGeneral, newGeneral) {
        var keyOrder = [
            'פקולטה',
            'מסגרת לימודים',
            'שם מקצוע',
            'מספר מקצוע',
            'אתר הקורס', // old format
            'נקודות',
            'הרצאה', // old format
            'תרגיל', // old format
            'מעבדה', // old format
            'סמינר/פרויקט', // old format
            'סילבוס',
            'מקצועות קדם',
            'מקצועות צמודים',
            'מקצועות ללא זיכוי נוסף',
            'מקצועות ללא זיכוי נוסף (מכילים)',
            'מקצועות ללא זיכוי נוסף (מוכלים)',
            'מקצועות זהים', // old format
            'עבור לסמסטר', // old format
            'אחראים',
            'הערות',
            'מועד הבחינה', // old format
            'בוחן מועד א',
            'בוחן מועד ב',
            'בוחן מועד ג',
            'בוחן מועד ד',
            'בוחן מועד ה',
            'בוחן מועד ו',
            'מועד א',
            'מועד ב',
            'מועד ג',
            'מיקום' // old format
        ];
        var compareFunction = function (a, b) {
            var aIndex = (keyOrder.indexOf(a) + 1) || Number.MAX_VALUE;
            var bIndex = (keyOrder.indexOf(b) + 1) || Number.MAX_VALUE;
            if (aIndex !== bIndex) {
                return aIndex - bIndex;
            }

            return a.localeCompare(b);
        };

        var keyExclude = {
            'אתר הקורס': true,
            'עבור לסמסטר': true,
            'מיקום': true
        };

        var oldText = '';
        Object.keys(oldGeneral).sort(compareFunction).forEach(function (key) {
            if (!keyExclude[key] && oldGeneral[key] !== newGeneral[key] && oldGeneral[key]) {
                oldText += courseManager.getFieldLabel(key) + ': ' + metadataDisplayValue(key, oldGeneral[key]) + '\n';
            }
        });

        var newText = '';
        Object.keys(newGeneral).sort(compareFunction).forEach(function (key) {
            if (!keyExclude[key] && newGeneral[key] !== oldGeneral[key] && newGeneral[key]) {
                newText += courseManager.getFieldLabel(key) + ': ' + metadataDisplayValue(key, newGeneral[key]) + '\n';
            }
        });

        if (oldText === '' && newText === '') {
            return [];
        }

        return [{
            title: CheeseI18n.t('shell.changes.general'),
            old: oldText.trim(),
            new: newText.trim()
        }];
    }

    function computeCourseScheduleMetadataDiff(oldSchedule, newSchedule) {
        var diff = [];
        var scheduleGroups = {};

        var oldScheduleByGroups = scheduleToGroupOfTexts(oldSchedule, false);
        var newScheduleByGroups = scheduleToGroupOfTexts(newSchedule, false);
        var oldDisplayByGroups = scheduleToGroupOfTexts(oldSchedule, true);
        var newDisplayByGroups = scheduleToGroupOfTexts(newSchedule, true);

        Object.keys(scheduleGroups).sort().forEach(function (typeAndNumber) {
            if (oldScheduleByGroups[typeAndNumber] !== newScheduleByGroups[typeAndNumber]) {
                diff.push({
                    title: scheduleGroups[typeAndNumber],
                    old: (oldDisplayByGroups[typeAndNumber] || '').trim(),
                    new: (newDisplayByGroups[typeAndNumber] || '').trim()
                });
            }
        });

        return diff;

        function scheduleToGroupOfTexts(schedule, localized) {
            var keyOrder = [
                'מרצה/מתרגל',
                'יום',
                'שעה',
                'בניין',
                'חדר'
            ];
            var compareFunction = function (a, b) {
                var aIndex = (keyOrder.indexOf(a) + 1) || Number.MAX_VALUE;
                var bIndex = (keyOrder.indexOf(b) + 1) || Number.MAX_VALUE;
                if (aIndex !== bIndex) {
                    return aIndex - bIndex;
                }

                return a.localeCompare(b);
            };

            var lessonsAdded = {};

            var scheduleByGroups = {};
            schedule.forEach(function (lesson) {
                if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                    return;
                }

                var lessonText = '';
                Object.keys(lesson).sort(compareFunction).forEach(function (key) {
                    if (key !== 'קבוצה' &&
                        key !== 'מס.' &&
                        key !== 'סוג' &&
                        lesson[key]) {
                        var label = localized ? courseManager.getFieldLabel(key) : key;
                        var value = localized ? metadataDisplayValue(key, lesson[key]) : lesson[key];
                        lessonText += label + ': ' + value + '\n';
                    }
                });

                var typeAndNumber = courseManager.getLessonType(lesson);
                if (lesson['סוג'] !== 'sadna') {
                    typeAndNumber += ' ' + lesson['מס.'];
                }
                if (!scheduleByGroups[typeAndNumber]) {
                    scheduleByGroups[typeAndNumber] = '';
                }

                scheduleByGroups[typeAndNumber] += lessonText + '\n';

                lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
                scheduleGroups[typeAndNumber] = courseManager.getLessonTypeAndNumber(lesson);
            });

            return scheduleByGroups;
        }
    }

    function getPrettyMetadataDiff() {
        var result;

        if (metadataDiff) {
            result = $('<div class="course-metadata-diff-container"></div>');

            Object.keys(metadataDiff).sort().forEach(function (course) {
                var courseDiff = metadataDiff[course];
                var general, courseTitle;
                if (courseDiff.exists) {
                    general = courseManager.getGeneralInfo(course);
                    courseTitle = general['מספר מקצוע'] + ' – ' + general['שם מקצוע'];
                    result.append(sourceText(courseTitle, '<h3>'));

                    courseDiff.changes.forEach(function (diff) {
                        result.append($('<h5>').text(diff.title));

                        var jsDiff = JsDiff.diffWords(diff.old, diff.new);
                        jsDiff.forEach(function (part) {
                            var partElement = $('<span>').text(part.value);
                            if (part.added) {
                                partElement.addClass('course-metadata-diff-new');
                            } else if (part.removed) {
                                partElement.addClass('course-metadata-diff-old');
                            }

                            result.append(partElement);
                        });
                    });
                } else {
                    general = courseDiff.general;
                    courseTitle = general['מספר מקצוע'] + ' – ' + general['שם מקצוע'];
                    result.append(sourceText(courseTitle, '<h3>')).append($('<span>').text(CheeseI18n.t('shell.changes.removed')));
                }
            });
        } else {
            result = $('<div>');

            var explanation = escapeHtml(CheeseI18n.t('shell.changes.explanation'));

            result.html(explanation);
        }

        return result;
    }

    function setMetadataToCurrent() {
        var deletedCourses = [];
        if (metadataDiff) {
            deletedCourses = Object.keys(metadataDiff).filter(function (course) {
                return !metadataDiff[course].exists;
            });
        }

        if (deletedCourses.length > 0 && sessionExtraLayerIds(currentSavedSession).length > 0) {
            // Remove the deleted courses from the other layers too.
            var newSession = $.extend(true, {}, currentSavedSession); // make a deep copy
            sessionExtraLayerIds(newSession).forEach(function (layerId) {
                var layer = newSession[currentSemester + '_layers'][layerId];
                layer.courses = $(layer.courses).not(deletedCourses).get();
                deletedCourses.forEach(function (course) {
                    delete newSession[layerLessonsKey(course, layerId)];
                });
            });

            savedSessionChangesSave(currentSavedSession, newSession);
            currentSavedSession = newSession;
        }

        var semesterCoursesKey = currentSemester + '_courses';
        if (deletedCourses.length > 0) {
            currentSavedSession[semesterCoursesKey] = $(currentSavedSession[semesterCoursesKey]).not(deletedCourses).get();
        }

        deletedCourses.forEach(function (course) {
            var courseKey = currentSemester + '_' + course;
            delete currentSavedSession[courseKey];
        });

        var courseNumbers = courseButtonList.getCourseNumbers(true);

        var doc = firestoreAuthenticatedUserDoc();
        if (doc) {
            var input = {};

            courseNumbers.forEach(function (course) {
                var metadataCourseKey = currentSemester + '_metadata_' + course;
                var courseData = courseManager.getCourseData(course);
                input[metadataCourseKey] = courseData;
            });

            if (deletedCourses.length > 0) {
                input[semesterCoursesKey] = currentSavedSession[semesterCoursesKey];
            }

            deletedCourses.forEach(function (course) {
                var courseKey = currentSemester + '_' + course;
                input[courseKey] = firebase.firestore.FieldValue.delete();

                var metadataCourseKey = currentSemester + '_metadata_' + course;
                input[metadataCourseKey] = firebase.firestore.FieldValue.delete();
            });

            doc.update(input);
        } else {
            try {
                courseNumbers.forEach(function (course) {
                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    var courseData = courseManager.getCourseData(course);
                    localStorage.setItem(metadataCourseKey, JSON.stringify(courseData));
                });

                if (deletedCourses.length > 0) {
                    localStorage.setItem(semesterCoursesKey, JSON.stringify(currentSavedSession[semesterCoursesKey]));
                }

                deletedCourses.forEach(function (course) {
                    var courseKey = currentSemester + '_' + course;
                    localStorage.removeItem(courseKey);

                    var metadataCourseKey = currentSemester + '_metadata_' + course;
                    localStorage.removeItem(metadataCourseKey);
                });
            } catch (e) {
                // localStorage is not available in IE/Edge when running from a local file.
            }
        }

        metadataDiff = {};
        onMetadataDiffChange();
    }

    function onMetadataDiffChange() {
        var badgeCount = 0;

        if (metadataDiff) {
            var diffCourses = Object.keys(metadataDiff);
            if (diffCourses.length > 0) {
                badgeCount = diffCourses.reduce(function (accumulator, course) {
                    var diff = metadataDiff[course];
                    return accumulator + (diff.exists ? diff.changes.length : 1);
                }, 0);
            }
        } else {
            // If !metadataDiff, that probably means that
            // the user built the schedule before the feature was introduced.
            badgeCount = 1;
        }

        if (badgeCount > 0) {
            $('#top-navbar-changes').removeClass('d-none').find('.unread-count-badge').text(badgeCount);
            $('#top-navbar .navbar-toggler .unread-count-badge').text(badgeCount).removeClass('d-none');
        } else {
            $('#top-navbar-changes').addClass('d-none');
            $('#top-navbar .navbar-toggler .unread-count-badge').addClass('d-none');
        }
    }

    // https://stackoverflow.com/a/30810322
    // The prompt is in English for any assistant to follow, whatever language the user writes in.
    // It leaves the key out, so that pasting it doesn't share the key with the assistant's service.
    function apiAssistantPrompt(apiBaseUrl, docsRawUrl, semester) {
        return [
            'Help me manage my CheeseFork² course schedule (Technion) through its HTTP API.',
            '',
            'Base URL: ' + apiBaseUrl,
            'Authentication: send the header "Authorization: Bearer YOUR_API_KEY" with every request.',
            'Full documentation: ' + docsRawUrl,
            '',
            'Key facts:',
            '- Semesters are YYYYSS: YYYY01 is winter YYYY–YYYY+1, YYYY02 spring, YYYY03 summer. My current semester is ' + semester + '.',
            '- GET /semesters/{semester}/schedule returns my whole schedule, GET /semesters/{semester}/courses my courses.',
            '- POST /semesters/{semester}/courses with {"course": "02340114"} adds a course; DELETE /semesters/{semester}/courses/{course} removes it.',
            '- GET /semesters/{semester}/catalog/{course} lists the lessons of a course. Choose one with PUT /semesters/{semester}/courses/{course}/lessons/{type} and {"number": 11}, where type is lecture, tutorial, lab, seminar, project or workshop.',
            '- Custom weekly events: POST /semesters/{semester}/custom-events with {"title": "Gym", "day": "monday", "startTime": "08:30", "endTime": "10:00"}.',
            '- Errors return {"error": {"code", "message"}}. The limit is 60 requests per minute; on 429, wait for the Retry-After seconds.',
            '',
            'Read the documentation before making changes. If you can make HTTP requests, call the API yourself; otherwise give me curl commands to run. If I have not given you my API key yet, ask me for it. Before removing courses or events, or replacing chosen lessons, tell me what will change and wait for my confirmation.'
        ].join('\n');
    }

    // Lets the signed-in user create, replace or revoke their personal API key (see API.md).
    // The key itself is shown only right after it's created, only its hash is stored.
    function showApiKeyDialog() {
        var apiBaseUrl = 'https://api.cf.talisrae.li/v1';
        var docsUrl = 'https://github.com/talisraeli/cheese-fork/blob/gh-pages/API.md';
        var docsRawUrl = 'https://raw.githubusercontent.com/talisraeli/cheese-fork/gh-pages/API.md';
        var functions = firebase.functions();

        var content = $('<div class="api-key-dialog">');
        var docsLink = $('<a target="_blank" rel="noopener">').attr('href', docsUrl).text(CheeseI18n.t('shell.api.docs'));
        $('<p>').text(CheeseI18n.t('shell.api.intro') + ' ').append(docsLink).appendTo(content);
        $('<p>').text(CheeseI18n.t('shell.api.baseUrl'))
            .append($('<code class="d-block text-left" dir="ltr">').text(apiBaseUrl)).appendTo(content);
        var status = $('<p class="api-key-status">').text(CheeseI18n.t('shell.api.loading')).appendTo(content);
        var newKey = $('<div class="api-key-new d-none">').appendTo(content);

        // A prompt to paste into an AI assistant, so that it can manage the schedule with the API.
        var prompt = apiAssistantPrompt(apiBaseUrl, docsRawUrl, currentSemester);
        var promptSection = $('<div class="api-key-prompt">').appendTo(content);
        $('<p class="mb-1">').text(CheeseI18n.t('shell.api.promptIntro')).appendTo(promptSection);
        $('<textarea class="form-control text-monospace small" rows="6" readonly dir="ltr">')
            .val(prompt)
            .on('focus click', function () {
                this.select();
            })
            .appendTo(promptSection);
        var promptCopyButton = $('<button type="button" class="btn btn-outline-secondary btn-sm mt-1">')
            .text(CheeseI18n.t('shell.api.promptCopy'))
            .click(function () {
                copyToClipboard(prompt, function () {
                    promptCopyButton.text(CheeseI18n.t('shell.api.copied'));
                }, function () {
                    alert(CheeseI18n.t('shell.error.copy'));
                });
            })
            .appendTo(promptSection);

        var hasKey = false;
        var busy = true;

        function formatTime(millis) {
            return millis ? new Date(millis).toLocaleString(CheeseI18n.getLocale()) : CheeseI18n.t('shell.api.never');
        }

        function showStatus(result) {
            hasKey = !!result.exists;
            if (hasKey) {
                status.text(CheeseI18n.t('shell.api.status', {
                    hint: result.hint + '…',
                    created: formatTime(result.createdAt),
                    used: formatTime(result.lastUsedAt)
                }));
            } else {
                status.text(CheeseI18n.t('shell.api.none'));
            }
        }

        function showNewKey(key) {
            var input = $('<input type="text" class="form-control" readonly dir="ltr">').val(key);
            input.on('focus click', function () {
                this.select();
            });
            var copyButton = $('<button type="button" class="btn btn-outline-secondary">')
                .text(CheeseI18n.t('shell.api.copy'))
                .click(function () {
                    copyToClipboard(key, function () {
                        copyButton.text(CheeseI18n.t('shell.api.copied'));
                    }, function () {
                        alert(CheeseI18n.t('shell.error.copy'));
                    });
                });
            newKey.empty()
                .append($('<p class="text-warning">').text(CheeseI18n.t('shell.api.copyNow')))
                .append($('<div class="input-group">').append(input)
                    .append($('<div class="input-group-append">').append(copyButton)))
                .removeClass('d-none');
        }

        function hideNewKey() {
            newKey.addClass('d-none').empty();
        }

        function updateButtons(dialog) {
            var createButton = dialog.getButton('api-key-create');
            createButton.text(CheeseI18n.t(hasKey ? 'shell.api.replace' : 'shell.api.create'));
            createButton.prop('disabled', busy);
            dialog.getButton('api-key-revoke').toggleClass('d-none', !hasKey).prop('disabled', busy);
        }

        function call(dialog, name, onResult) {
            busy = true;
            updateButtons(dialog);
            functions.httpsCallable(name)().then(function (response) {
                busy = false;
                onResult(response.data);
                updateButtons(dialog);
            }, function (error) {
                busy = false;
                updateButtons(dialog);
                status.text(CheeseI18n.t('shell.api.error', {error: error.message}));
            });
        }

        function confirmIf(condition, message, okLabel, onConfirmed) {
            if (!condition) {
                onConfirmed();
                return;
            }
            BootstrapDialog.confirm({
                title: CheeseI18n.t('shell.api.title'),
                message: message,
                type: BootstrapDialog.TYPE_WARNING,
                btnOKLabel: okLabel,
                btnCancelLabel: CheeseI18n.t('shell.dialog.cancel'),
                callback: function (confirmed) {
                    if (confirmed) {
                        onConfirmed();
                    }
                }
            });
        }

        var dialog = BootstrapDialog.show({
            title: CheeseI18n.t('shell.api.title'),
            message: content,
            buttons: [{
                id: 'api-key-create',
                label: CheeseI18n.t('shell.api.create'),
                cssClass: 'btn-primary',
                action: function (dialog) {
                    confirmIf(hasKey, CheeseI18n.t('shell.api.replaceConfirm'), CheeseI18n.t('shell.api.replace'), function () {
                        gtag('event', 'api-key-create');
                        call(dialog, 'apiKeyCreate', function (result) {
                            showStatus({exists: true, hint: result.hint, createdAt: result.createdAt, lastUsedAt: null});
                            showNewKey(result.key);
                        });
                    });
                }
            }, {
                id: 'api-key-revoke',
                label: CheeseI18n.t('shell.api.revoke'),
                cssClass: 'btn-outline-danger d-none',
                action: function (dialog) {
                    confirmIf(true, CheeseI18n.t('shell.api.revokeConfirm'), CheeseI18n.t('shell.api.revoke'), function () {
                        gtag('event', 'api-key-revoke');
                        call(dialog, 'apiKeyRevoke', function (result) {
                            hideNewKey();
                            showStatus(result);
                        });
                    });
                }
            }, {
                label: CheeseI18n.t('shell.dialog.close'),
                action: function (dialog) {
                    dialog.close();
                }
            }]
        });
        call(dialog, 'apiKeyStatus', showStatus);
    }

    function copyToClipboard(text, onSuccess, onFailure) {
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        // eslint-disable-next-line compat/compat
        navigator.clipboard.writeText(text).then(function () {
            onSuccess();
        }, function (err) {
            onFailure();
        });

        function fallbackCopyTextToClipboard(text) {
            var textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            var successful = false;
            try {
                successful = document.execCommand('copy');
            } catch (err) {
                // We tried...
            }

            document.body.removeChild(textArea);

            if (successful) {
                onSuccess();
            } else {
                onFailure();
            }
        }
    }

    function crawlersInfo() {
        var courseParameter = getParameterByName('course');
        var staffParameter = getParameterByName('staff');
        var roomParameter = getParameterByName('room');

        if (courseParameter === null && staffParameter === null && roomParameter === null) {
            return false;
        }

        var content = $('<div class="col-md-12"></div>');
        var title = semesterFriendlyName(currentSemester) + ' - CheeseFork²';

        if (courseParameter !== null) {
            if (courseManager.doesExist(courseParameter)) {
                crawlersMakeCourseContent(content, courseParameter);
                title = courseManager.getTitle(courseParameter) + ' – ' + title;
            } else {
                crawlersMakeListHeader(content, 'course');
                crawlersMakeCourseListContent(content);
                title = CheeseI18n.t('shell.crawler.courses') + ' – ' + title;
            }
        } else if (staffParameter !== null) {
            if (crawlersMakeStaffContent(content, staffParameter)) {
                title = staffParameter + ' – ' + title;
            } else {
                crawlersMakeListHeader(content, 'staff');
                crawlersMakeStaffListContent(content);
                title = CheeseI18n.t('shell.crawler.staff') + ' – ' + title;
            }
        } else { // if (roomParameter !== null)
            if (crawlersMakeRoomContent(content, roomParameter)) {
                title = roomParameter + ' – ' + title;
            } else {
                crawlersMakeListHeader(content, 'room');
                crawlersMakeRoomListContent(content);
                title = CheeseI18n.t('shell.crawler.rooms') + ' – ' + title;
            }
        }

        setPageTitle(title);

        $('#content-container').html(content);

        $('#top-navbar-home').removeClass('d-none');
        $('#top-navbar-share').addClass('d-none');
        $('#top-navbar-export').addClass('d-none');
        $('#top-navbar-semester').addClass('d-none');
        $('#course-select').hide();

        $('#top-navbar-supported-content').removeClass('top-navbar-content-uninitialized');

        // The filter form is indexed by Google even though it's hidden, so remove it.
        $('#filter-form').remove();

        $('#page-loader').hide();

        return true;
    }

    function crawlersMakeListHeader(content, currentList) {
        Object.keys(availableSemesters).sort().forEach(function (semester) {
            var text = semesterFriendlyName(semester);
            if (semester === currentSemester) {
                content.append($('<span>').text(text));
            } else {
                var targetList = {};
                targetList[currentList] = 'all';
                targetList.semester = semester;
                var url = crawlerUrl(targetList);
                content.append($('<a>').text(text).prop('href', url));
            }
            content.append('<br>');
        });

        content.append('<br>');

        var listToText = {
            'course': CheeseI18n.t('shell.crawler.courses'),
            'staff': CheeseI18n.t('shell.crawler.staff'),
            'room': CheeseI18n.t('shell.crawler.rooms')
        };

        ['course', 'staff', 'room'].forEach(function (list) {
            var text = listToText[list];
            if (list === currentList) {
                content.append($('<span>').text(text));
            } else {
                var targetList = {};
                targetList[list] = 'all';
                var url = crawlerUrl(targetList);
                content.append($('<a>').text(text).prop('href', url));
            }
            content.append('<br>');
        });

        content.append('<br>');
    }

    function crawlersMakeCourseContent(content, course) {
        var url = crawlerUrl({course: 'all'});
        content.append($('<a>').text(CheeseI18n.t('shell.crawler.courseList')).prop('href', url));
        content.append('<br><br>');

        var description = courseManager.getDescription(course, {html: true, relatedCourseInfo: true, links: true});
        content.append($('<div>').html(description));

        var lessonsAdded = {};
        courseManager.getSchedule(course).forEach(function (lesson) {
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                return;
            }

            content.append('<br>');

            var typeAndNumber = courseManager.getLessonTypeAndNumber(lesson);
            content.append($('<div style="font-weight: bold;"></div>').text(typeAndNumber));

            if (lesson['מרצה/מתרגל']) {
                var staffContents = $('<div>').text(courseManager.getFieldLabel('מרצה/מתרגל') + ': ');
                lesson['מרצה/מתרגל'].split('\n').forEach(function (name, i) {
                    if (i > 0) {
                        staffContents.append(', ');
                    }
                    var staffUrl = crawlerUrl({staff: name});
                    var staffLink = sourceText(name, '<a>').prop('href', staffUrl);
                    staffContents.append(staffLink);
                });
                content.append(staffContents);
            }

            if (lesson['יום']) {
                content.append($('<div>').text(courseManager.getFieldLabel('יום') + ': ' + courseManager.getDayLabel(lesson['יום'])));
            }

            if (lesson['שעה']) {
                content.append($('<div>').text(courseManager.getFieldLabel('שעה') + ': ' + lesson['שעה']));
            }

            var roomUrl;
            var roomLink;
            if (lesson['בניין'] && lesson['חדר']) {
                content.append($('<div>').text(courseManager.getFieldLabel('בניין') + ': ').append(sourceText(lesson['בניין'])));
                roomUrl = crawlerUrl({room: lesson['בניין'] + ' ' + lesson['חדר']});
                roomLink = sourceText(lesson['חדר'], '<a>').prop('href', roomUrl);
                content.append($('<div>').text(courseManager.getFieldLabel('חדר') + ': ').append(roomLink));
            } else if (lesson['בניין']) {
                roomUrl = crawlerUrl({room: lesson['בניין']});
                roomLink = sourceText(lesson['בניין'], '<a>').prop('href', roomUrl);
                content.append($('<div>').text(courseManager.getFieldLabel('בניין') + ': ').append(roomLink));
            } else if (lesson['חדר']) {
                content.append($('<div>').text(courseManager.getFieldLabel('חדר') + ': ').append(sourceText(lesson['חדר'])));
            }

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        });
    }

    function crawlersMakeCourseListContent(content) {
        courseManager.getAllCourses().sort().forEach(function (cbCourse) {
            var title = courseManager.getTitle(cbCourse);
            var url = crawlerUrl({course: cbCourse});
            content.append(sourceText(title, '<a>').prop('href', url));
            content.append('<br>');
        });
    }

    function crawlersMakeStaffContent(content, staff) {
        var schedule = [];
        courseManager.getAllCourses().forEach(function (course) {
            var lessonsAdded = {};
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                    return;
                }

                if (lesson['מרצה/מתרגל'] && lesson['מרצה/מתרגל'].split('\n').indexOf(staff) !== -1) {
                    var time = null;
                    if (lesson['יום']) {
                        if (lesson['שעה']) {
                            time = 'יום ' + lesson['יום'] + ' ' + lesson['שעה'];
                        } else {
                            time = 'יום ' + lesson['יום'];
                        }
                    }

                    schedule.push({course: course, time: time, displayTime: lessonDisplayTime(lesson)});
                }

                lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
            });
        });

        if (schedule.length === 0) {
            return false;
        }

        var url = crawlerUrl({staff: 'all'});
        content.append($('<a>').text(CheeseI18n.t('shell.crawler.staffList')).prop('href', url));
        content.append('<br><br>');

        content.append(sourceText(staff, '<b>'));
        content.append('<br>');

        schedule.sort(function (a, b) {
            if (!a.time && !b.time) {
                return 0;
            } else if (!a.time) {
                return 1;
            } else if (!b.time) {
                return -1;
            } else {
                var dayMapping = {
                    'ראשון': 'א',
                    'שני': 'ב',
                    'שלישי': 'ג',
                    'רביעי': 'ד',
                    'חמישי': 'ה',
                    'שישי': 'ו',
                };

                var aTimeForCompare = a.time.replace(/^יום (\S+)/, function (match, p1) {
                    return dayMapping[p1] || p1;
                });
                var bTimeForCompare = b.time.replace(/^יום (\S+)/, function (match, p1) {
                    return dayMapping[p1] || p1;
                });

                return aTimeForCompare.localeCompare(bTimeForCompare, undefined, { numeric: true });
            }
        }).forEach(function (item) {
            if (item.time) {
                content.append($('<span>').text(item.displayTime + ' – '));
            }

            var url = crawlerUrl({course: item.course});
            var courseTitle = courseManager.getTitle(item.course);
            content.append(sourceText(courseTitle, '<a>').prop('href', url));
            content.append('<br>');
        });

        return true;
    }

    function crawlersMakeStaffListContent(content) {
        var staff = {};
        courseManager.getAllCourses().forEach(function (course) {
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lesson['מרצה/מתרגל']) {
                    lesson['מרצה/מתרגל'].split('\n').forEach(function (name) {
                        staff[name] = true;
                    });
                }
            });
        });

        Object.keys(staff).sort().forEach(function (name) {
            var url = crawlerUrl({staff: name});
            content.append(sourceText(name, '<a>').prop('href', url));
            content.append('<br>');
        });
    }

    function crawlersMakeRoomContent(content, room) {
        var schedule = [];
        courseManager.getAllCourses().forEach(function (course) {
            var lessonsAdded = {};
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                    return;
                }

                var roomCompare = null;
                if (lesson['בניין']) {
                    if (lesson['חדר']) {
                        roomCompare = lesson['בניין'] + ' ' + lesson['חדר'];
                    } else {
                        roomCompare = lesson['בניין'];
                    }
                }

                if (roomCompare && room === roomCompare) {
                    var time = null;
                    if (lesson['יום']) {
                        if (lesson['שעה']) {
                            time = 'יום ' + lesson['יום'] + ' ' + lesson['שעה'];
                        } else {
                            time = 'יום ' + lesson['יום'];
                        }
                    }

                    schedule.push({course: course, time: time, displayTime: lessonDisplayTime(lesson)});
                }

                lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
            });
        });

        if (schedule.length === 0) {
            return false;
        }

        var url = crawlerUrl({room: 'all'});
        content.append($('<a>').text(CheeseI18n.t('shell.crawler.roomList')).prop('href', url));
        content.append('<br><br>');

        content.append(sourceText(room, '<b>'));
        content.append('<br>');

        schedule.sort(function (a, b) {
            if (!a.time && !b.time) {
                return 0;
            } else if (!a.time) {
                return 1;
            } else if (!b.time) {
                return -1;
            } else {
                var dayMapping = {
                    'ראשון': 'א',
                    'שני': 'ב',
                    'שלישי': 'ג',
                    'רביעי': 'ד',
                    'חמישי': 'ה',
                    'שישי': 'ו',
                };

                var aTimeForCompare = a.time.replace(/^יום (\S+)/, function (match, p1) {
                    return dayMapping[p1] || p1;
                });
                var bTimeForCompare = b.time.replace(/^יום (\S+)/, function (match, p1) {
                    return dayMapping[p1] || p1;
                });

                return aTimeForCompare.localeCompare(bTimeForCompare, undefined, { numeric: true });
            }
        }).forEach(function (item) {
            if (item.time) {
                content.append($('<span>').text(item.displayTime + ' – '));
            }

            var url = crawlerUrl({course: item.course});
            var courseTitle = courseManager.getTitle(item.course);
            content.append(sourceText(courseTitle, '<a>').prop('href', url));
            content.append('<br>');
        });

        return true;
    }

    function crawlersMakeRoomListContent(content) {
        var rooms = {};
        courseManager.getAllCourses().forEach(function (course) {
            courseManager.getSchedule(course).forEach(function (lesson) {
                if (lesson['בניין']) {
                    if (lesson['חדר']) {
                        rooms[lesson['בניין'] + ' ' + lesson['חדר']] = true;
                    } else {
                        rooms[lesson['בניין']] = true;
                    }
                }
            });
        });

        Object.keys(rooms).sort().forEach(function (room) {
            var url = crawlerUrl({room: room});
            content.append(sourceText(room, '<a>').prop('href', url));
            content.append('<br>');
        });
    }

    function setPageTitle(title) {
        $('title').removeAttr('data-i18n');
        document.title = title;
    }

    function escapeHtml(text) {
        return $('<div>').text(text).html().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sourceText(text, element) {
        return $(element || '<span>').addClass('source-content').attr({
            lang: /[\u0590-\u05ff]/.test(text) ? 'he' : 'en',
            dir: 'auto'
        }).text(text);
    }

    function metadataDisplayValue(key, value) {
        if (key === 'יום') {
            return courseManager.getDayLabel(value);
        }
        if (key === 'פקולטה') {
            return courseManager.getFacultyLabel(value);
        }
        if (key === 'מסגרת לימודים') {
            return value.split('\n').map(function (framework) {
                return courseManager.getFrameworkLabel(framework);
            }).join('\n');
        }
        return value;
    }

    function lessonDisplayTime(lesson) {
        if (!lesson['יום']) {
            return null;
        }
        var day = CheeseI18n.t('shell.crawler.day', {day: courseManager.getDayLabel(lesson['יום'])});
        return day + (lesson['שעה'] ? ' ' + lesson['שעה'] : '');
    }

    function shellUrl(updates) {
        var anchor = document.createElement('a');
        anchor.href = window.location.href;
        var parameters = anchor.search ? anchor.search.slice(1).split('&') : [];
        Object.keys(updates).forEach(function (name) {
            parameters = parameters.filter(function (parameter) {
                var parameterName = parameter.split('=')[0].replace(/\+/g, ' ');
                try {
                    parameterName = decodeURIComponent(parameterName);
                } catch (error) {
                    return true;
                }
                return parameterName !== name;
            });
            if (updates[name] !== null) {
                parameters.push(encodeURIComponent(name) + '=' + encodeURIComponent(updates[name]));
            }
        });
        anchor.search = parameters.length ? '?' + parameters.join('&') : '';
        return CheeseI18n.withLocale(anchor.href);
    }

    function crawlerUrl(updates) {
        return shellUrl($.extend({semester: currentSemester, course: null, staff: null, room: null}, updates));
    }

    // https://stackoverflow.com/a/901144
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    // https://stackoverflow.com/a/19015262
    function getScrollBarWidth() {
        var $outer = $('<div>').css({visibility: 'hidden', width: 100, overflow: 'scroll'}).appendTo('body'),
            widthWithScroll = $('<div>').css({width: '100%'}).appendTo($outer).outerWidth();
        $outer.remove();
        return 100 - widthWithScroll;
    }
})();

// eslint-disable-next-line no-unused-vars
function showBootstrapDialogWithModelessButton(dialogName, options) {
    var newOptions = $.extend({}, options, {
        onshow: function (dialog) {
            var restoreButton = $('<div class="bootstrap-dialog-close-button">' +
                '<button class="close d-none d-sm-inline-block">' +
                '<i class="far fa-window-restore" style="font-size: 18px;"></i>' +
                '</button>' +
                '</div>').css(CheeseI18n.isRTL() ? 'margin-right' : 'margin-left', 'auto');

            restoreButton.find('button').attr('aria-label', CheeseI18n.t('shell.dialog.modeless'));
            dialog.getModalHeader().find('.bootstrap-dialog-close-button').before(restoreButton);

            restoreButton.click(function () {
                gtag('event', 'bootstrap-dialog-restore-' + dialogName);

                restoreButton.hide();

                $('body').removeClass('modal-open').css({
                    'padding-right': ''
                }).find('> .modal-backdrop').hide();

                var numOfModelessDialogs = $('body > .bootstrap-dialog.cheesefork-modeless-dialog').length;

                var thatDialogModal = dialog.getModal();
                thatDialogModal.removeClass('modal')
                    .addClass('cheesefork-modeless-dialog')
                    .css('z-index', 1000 + numOfModelessDialogs)
                    .click(function () {
                        var modelessDialogs = $('body > .bootstrap-dialog.cheesefork-modeless-dialog');
                        var prevZIndex = thatDialogModal.css('z-index');
                        if (prevZIndex < 1000 + modelessDialogs.length - 1) {
                            modelessDialogs.each(function () {
                                var iter = $(this);
                                if (iter.css('z-index') > prevZIndex) {
                                    iter.css('z-index', iter.css('z-index') - 1);
                                }
                            });

                            thatDialogModal.css('z-index', 1000 + modelessDialogs.length - 1);
                        }
                    });

                dialog.options.draggable = true;
                dialog.makeModalDraggable();
            });

            if (options.onshow) {
                options.onshow(dialog);
            }
        },
        onhidden: function (dialog) {
            var thatDialogModal = dialog.getModal();
            var modelessDialogs = $('body > .bootstrap-dialog.cheesefork-modeless-dialog');
            var prevZIndex = thatDialogModal.css('z-index');
            if (prevZIndex < 1000 + modelessDialogs.length - 1) {
                modelessDialogs.each(function () {
                    var iter = $(this);
                    if (iter.css('z-index') > prevZIndex) {
                        iter.css('z-index', iter.css('z-index') - 1);
                    }
                });
            }

            if (options.onhidden) {
                options.onhidden(dialog);
            }
        }
    });

    return BootstrapDialog.show(newOptions);
}
