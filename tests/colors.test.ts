import type { ScheduleEvent } from '../src/components/course-calendar/calendar-types.ts';
import type { TestWindow } from './helpers.ts';
import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { createPage, loadUI, loadApp } from './helpers.ts';

const DARK = '#212529';

// Loads the site signed out with the course and its lecture selected, and returns a function
// that opens the color picker of the lecture, as by clicking its palette button.
function loadSchedule() {
    const dom = createPage();
    const window = loadUI(dom.window);
    window.localStorage.setItem('202601_courses', '["01040001"]');
    window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
    window.localStorage.setItem('dontShowIntro', String(Date.now()));
    // jQuery caches compiled selectors, so :hover is replaced before it's first used.
    let hovering = false;
    window.$.expr.pseudos.hover = () => hovering;
    loadApp(window);

    let dialog: BootstrapDialogInstance | null = null;
    const show = window.BootstrapDialog.show;
    window.BootstrapDialog.show = (options: BootstrapDialogOptions) => (dialog = show(options));

    const openPicker = () => {
        // The palette button is used only while hovered, see onEventClick.
        hovering = true;
        window.$('#course-calendar .fc-event .calendar-item-color-button').trigger('click');
        hovering = false;
        // The click opens it right away.
        return dialog!;
    };
    return { dom, window, openPicker };
}

function colors(window: TestWindow) {
    const event = window.$('#course-calendar').fullCalendar<ScheduleEvent>('clientEvents')[0];
    const button = window.$('#course-button-list li[data-course-number="01040001"]').get(0)!;
    const exam = window.$('#course-exam-info .exam-info-item').get(0)!;
    return {
        calendar: [event.backgroundColor, event.textColor],
        button: [button.style.backgroundColor, button.style.color],
        exam: [exam.style.backgroundColor, exam.style.color]
    };
}

function rgb(hex: string) {
    return 'rgb(' + [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)).join(', ') + ')';
}

test('any custom color can be chosen, with dark text when white text is unreadable', () => {
    const { dom, window, openPicker } = loadSchedule();
    try {
        const automatic = colors(window).calendar[0];
        assert.equal(colors(window).calendar[1], 'white');

        // The custom color input starts with the current color.
        let dialog = openPicker();
        const input = dialog.getModalBody().find('input.color-picker-custom-input');
        assert.equal(input.attr('type'), 'color');
        assert.equal(input.val(), automatic);
        assert.equal(dialog.getModalBody().find('label[for="color-picker-custom-input"]').text(), 'Custom color:');

        // A light color gets dark text everywhere.
        input.val('#F0E68C').trigger('change');
        assert.equal(window.localStorage.getItem('202601_colors'), '{"01040001":"#f0e68c"}');
        assert.deepEqual(colors(window), {
            calendar: ['#f0e68c', DARK],
            button: [rgb('#f0e68c'), rgb(DARK)],
            exam: [rgb('#f0e68c'), rgb(DARK)]
        });

        // A dark color keeps white text.
        dialog = openPicker();
        assert.equal(dialog.getModalBody().find('input.color-picker-custom-input').val(), '#f0e68c');
        dialog.getModalBody().find('input.color-picker-custom-input').val('#123456').trigger('change');
        assert.deepEqual(colors(window), {
            calendar: ['#123456', 'white'],
            button: [rgb('#123456'), rgb('#ffffff')],
            exam: [rgb('#123456'), rgb('#ffffff')]
        });

        // Without color input support, the field is text, and invalid values are ignored.
        dialog = openPicker();
        dialog.getModalBody().find('input.color-picker-custom-input').attr('type', 'text').val('red').trigger('change');
        assert.equal(window.localStorage.getItem('202601_colors'), '{"01040001":"#123456"}');
        dialog.close();

        // Back to the automatic color, with white text.
        dialog = openPicker();
        // The first button is the default color.
        dialog.getModalFooter().find('button').first().trigger('click');
        assert.equal(window.localStorage.getItem('202601_colors'), null);
        assert.deepEqual(colors(window).calendar, [automatic, 'white']);
        assert.equal(colors(window).button[1], rgb('#ffffff'));
    } finally {
        dom.window.close();
    }
});

test('a schedule saved with a light custom color loads signed out with dark text', () => {
    // The signed-out schedule is shown while the script is still starting, see DARK_TEXT_COLOR.
    const dom = createPage();
    try {
        const window = loadUI(dom.window);
        const errors: unknown[] = [];
        window.addEventListener('error', event => errors.push(event.error || event.message));
        window.localStorage.setItem('202601_courses', '["01040001"]');
        window.localStorage.setItem('202601_01040001', '{"05d405e805e605d005d4":10}');
        window.localStorage.setItem('202601_colors', '{"01040001":"#f0e68c"}');
        window.localStorage.setItem('dontShowIntro', String(Date.now()));
        loadApp(window);
        assert.deepEqual(errors, []);
        assert.deepEqual(colors(window), {
            calendar: ['#f0e68c', DARK],
            button: [rgb('#f0e68c'), rgb(DARK)],
            exam: [rgb('#f0e68c'), rgb(DARK)]
        });
    } finally {
        dom.window.close();
    }
});

test('automatic colors keep white text', () => {
    const { dom, window } = loadSchedule();
    try {
        assert.equal(colors(window).calendar[1], 'white');
        assert.equal(colors(window).button[1], rgb('#ffffff'));
        assert.equal(colors(window).exam[1], rgb('#ffffff'));
    } finally {
        dom.window.close();
    }
});
