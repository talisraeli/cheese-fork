import type { CourseCalendar } from './course-calendar.js';

// Pinch to zoom the calendar on touch screens, and the sizes that depend on its zoom.

export function initTouchScalingSupport(courseCalendar: CourseCalendar): void {
    const calendar = courseCalendar.element;

    // Based on the CSS rule:
    // .fc-time-grid .fc-slats td {
    //     height: 1.5em;
    // }
    let gridSlotHeight = 1.5;

    let scaling = false;
    // The vertical anchor of the zoom, between 0 (the top of the grid) and 1 (its bottom).
    let verticalCenter = 0;
    let pendingAnimationRequest: number | null = null;
    let renderRequired = false;
    let previousDist = 0;

    // Based on:
    // https://stackoverflow.com/a/11183333

    (calendar.get(0) as HTMLElement).addEventListener(
        'touchstart',
        event => {
            // https://plus.google.com/+RickByers/posts/GHwpqnAFATf
            const target = event.target as EventTarget;
            target.addEventListener('touchmove', onTouchMove as EventListener, { passive: true });
            target.addEventListener('touchend', onTouchEnd as EventListener, { passive: true });
            target.addEventListener('touchcancel', onTouchEnd as EventListener, { passive: true });

            if (!scaling && event.touches.length >= 2) {
                scaling = true;
                verticalCenter = getVerticalCenter(event.touches);
                previousDist = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY
                );

                pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
            } else if (scaling && event.touches.length < 2) {
                scaling = false;
                endScaling();
            }
        },
        { passive: true }
    );

    function onTouchMove(event: TouchEvent): void {
        if (scaling && event.touches.length >= 2) {
            const dist = Math.hypot(
                event.touches[0].pageX - event.touches[1].pageX,
                event.touches[0].pageY - event.touches[1].pageY
            );
            scaleGridSlotHeight(dist / previousDist);
            previousDist = dist;
        }
    }

    function onTouchEnd(event: TouchEvent): void {
        if (scaling) {
            if (event.type === 'touchcancel' || event.touches.length < 2) {
                scaling = false;
                endScaling();
            }
        }

        let targetStillTouched = false;

        for (const touch of Array.from(event.touches)) {
            if (touch.target === event.target) {
                targetStillTouched = true;
                break;
            }
        }

        if (!targetStillTouched) {
            const target = event.target as EventTarget;
            target.removeEventListener('touchmove', onTouchMove as EventListener);
            target.removeEventListener('touchend', onTouchEnd as EventListener);
            target.removeEventListener('touchcancel', onTouchEnd as EventListener);
        }
    }

    function endScaling(): void {
        if (pendingAnimationRequest !== null) {
            window.cancelAnimationFrame(pendingAnimationRequest);
            renderNewSlotHeight();
        }
    }

    function scaleGridSlotHeight(scale: number): void {
        const prevHeight = gridSlotHeight;
        gridSlotHeight *= scale;
        if (gridSlotHeight < 1.5) {
            gridSlotHeight = 1.5;
        } else if (gridSlotHeight > 4.5) {
            gridSlotHeight = 4.5;
        }

        if (gridSlotHeight !== prevHeight) {
            renderRequired = true;
        }
    }

    function renderNewSlotHeight(): void {
        if (renderRequired) {
            // The calendar has its time grid while it's shown.
            const timeGrid = calendar.find('.fc-time-grid');
            const heightBefore = timeGrid.height() as number;

            calendar.find('.fc-time-grid .fc-slats td').css('height', `${gridSlotHeight}em`);

            calendar.fullCalendar('render');
            calendar.fullCalendar('rerenderEvents');

            const heightAfter = timeGrid.height() as number;

            // Make verticalCenter the vertical anchor of the zoom.
            $(window).scrollTop(($(window).scrollTop() as number) + (heightAfter - heightBefore) * verticalCenter);

            renderRequired = false;
        }

        if (scaling) {
            pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
        } else {
            pendingAnimationRequest = null;
        }
    }

    function getVerticalCenter(touches: TouchList): number {
        const timeGrid = calendar.find('.fc-time-grid');
        const offset = timeGrid.offset() as JQuery.Coordinates;
        const top = offset.top;
        const height = timeGrid.height() as number;

        const centerY = (touches[0].pageY + touches[1].pageY) / 2;

        let centerYRelative = (centerY - top) / height;
        if (centerYRelative < 0) {
            centerYRelative = 0;
        } else if (centerYRelative > 1) {
            centerYRelative = 1;
        }

        return centerYRelative;
    }
}

export function updateDynamicSizes(courseCalendar: CourseCalendar): void {
    const calendar = courseCalendar.element;

    // This is an ugly hack. FullCalendar calculates the positions of event
    // elements dynamically, but the print layout doesn't interpret the css
    // font-size rules correctly, so the elements are rendered in the wrong
    // positions. This workaround creates a print-only stylesheet with the
    // calculated sizes. Note that it assumes that there's only one calendar
    // element on the page.
    let css = '';

    const el1 = $('.fc-time-grid .fc-slats td', calendar)[0];
    if (el1) {
        const fontSize1 = window.getComputedStyle(el1).getPropertyValue('font-size');
        css += `.course-calendar .fc-time-grid .fc-slats td { font-size: ${fontSize1}; }`;
    }

    const el2 = $('.fc-event', calendar)[0];
    if (el2) {
        const fontSize2 = window.getComputedStyle(el2).getPropertyValue('font-size');
        css += `.course-calendar .fc-event { font-size: ${fontSize2}; }`;
    } else {
        courseCalendar.printStyleHackWaitingForEvent = true;
    }

    if (css) {
        css = `@media print { ${css} }`;

        let styleElement = courseCalendar.printStyleHackStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            document.head.appendChild(styleElement);
            courseCalendar.printStyleHackStyleElement = styleElement;
        }

        styleElement.textContent = css;
    }
}
