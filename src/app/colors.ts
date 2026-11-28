import type { SavedSession } from './session-types.js';
import { DARK_TEXT_COLOR } from './constants.js';
import { getVisibleCourseNumbers } from './layers.js';
import { customColorSave } from './schedule-edits.js';
import { state } from './state.js';

// The key of a course's custom color. The same course can be in several layers,
// and each layer has its own color. The first layer uses the plain course number,
// same as a schedule without layers.
export function courseColorKey(course: string, layerId?: string): string {
    return layerId ? `${layerId}_${course}` : course;
}

// For custom events, course is the event title and customEventId is the event id.
// For courses, customEventId is null and layerId is the layer of the course.
export function courseColorGenerator(course: string, customEventId?: string | null, layerId?: string): string {
    const customColor = state.customColors[customEventId || courseColorKey(course, layerId)];
    if (customColor) {
        return customColor;
    }

    let str = state.courseManager.toOldCourseNumber(course);
    // Fixup: both 114036 and 114246 get a green color, and both are taken at the same semester.
    // So here we cause the color of 114246 to be different.
    // Similar fixup: pink 124503, 124708 and 134019.
    // Similar fixup: green 334222 and 336537.
    // Similar fixup: green 034055 and 114052.
    const coursePrefixForHashCalc: Record<string, string> = {
        '114246': 'a',
        '124708': 'c',
        '134019': 'a',
        '336537': 'a',
        '034055': 'a'
    };
    if (coursePrefixForHashCalc[str]) {
        str = coursePrefixForHashCalc[str] + str;
    }
    return state.colorHash.hex(str);
}

// The text color for the background color of courseColorGenerator. The automatic colors and
// the palette are meant for white text, but a custom color can be too light for it, so dark
// text is used when white text isn't readable on it (contrast below 3:1) and dark text is.
export function courseTextColorGenerator(course: string, customEventId?: string | null, layerId?: string): string {
    const customColor = state.customColors[customEventId || courseColorKey(course, layerId)];
    return customColor ? readableTextColor(customColor) : 'white';
}

export function readableTextColor(backgroundColor: string) {
    // https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
    const luminance = (hex: string) => {
        const channels = [1, 3, 5].map(i => {
            const value = parseInt(hex.substr(i, 2), 16) / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    const background = luminance(backgroundColor);
    const whiteContrast = contrast(background, 1);
    const darkContrast = contrast(background, luminance(DARK_TEXT_COLOR));
    return whiteContrast < 3 && darkContrast > whiteContrast ? DARK_TEXT_COLOR : 'white';
}

export function customColorsFromSavedSession(session: SavedSession) {
    const colors: Record<string, string> = {};

    const savedColors = session[`${currentSemester}_colors` as const] || {};
    Object.keys(savedColors).forEach(colorKey => {
        // Can come from a shared schedule of another user, so accept only plain hex colors.
        if (/^#[0-9a-f]{6}$/i.test(savedColors[colorKey])) {
            colors[colorKey] = savedColors[colorKey];
        }
    });

    return colors;
}

export function updateColors() {
    state.courseButtonList.updateColors();
    state.courseCalendar.updateColors();
    state.courseExamInfo.renderCourses(getVisibleCourseNumbers());
}

// colorKey is a course color key (see courseColorKey) or a custom event id, and currentColor
// is the color it has now.
export function showColorPicker(colorKey: string, currentColor: string) {
    // Same saturation as the middle value of the automatic colors, with white text in mind.
    const palette: string[] = [];
    [0.5, 0.35].forEach(lightness => {
        for (let hue = 0; hue < 360; hue += 30) {
            palette.push(hslToHex(hue, 0.5, lightness));
        }
    });

    const content = $('<div class="color-picker">');

    palette.forEach(color => {
        const colorButton = $('<button type="button" class="color-picker-item">')
            .attr('aria-label', color)
            .css('background-color', color)
            .toggleClass('color-picker-item-selected', state.customColors[colorKey] === color)
            .click(() => {
                dialog.close();
                customColorSave(colorKey, color);
                updateColors();
            });
        content.append(colorButton);
    });

    // Any color. Browsers without a color input show a text field, so the value is checked.
    const customInput = $('<input type="color" class="color-picker-custom-input" id="color-picker-custom-input">')
        .val(currentColor || '#000000')
        .on('change', function () {
            const color = String($(this).val()).trim().toLowerCase();
            if (!/^#[0-9a-f]{6}$/.test(color)) {
                return;
            }
            dialog.close();
            customColorSave(colorKey, color);
            updateColors();
        });
    const customRow = $('<div class="color-picker-custom">')
        .append($('<label for="color-picker-custom-input">').text(CheeseI18n.t('shell.color.custom')))
        .append(customInput);

    // Used by the handlers above, which run only once it's shown.
    const dialog = BootstrapDialog.show({
        title: CheeseI18n.t('shell.color.title'),
        message: $('<div>').append(content, customRow),
        buttons: [
            {
                label: CheeseI18n.t('shell.color.default'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                    if (state.customColors[colorKey]) {
                        customColorSave(colorKey, null);
                        updateColors();
                    }
                }
            },
            {
                label: CheeseI18n.t('shell.dialog.close'),
                action(dialog: BootstrapDialogInstance) {
                    dialog.close();
                }
            }
        ]
    });

    function hslToHex(hue: number, saturation: number, lightness: number) {
        // https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
        const a = saturation * Math.min(lightness, 1 - lightness);
        return `#${[0, 8, 4]
            .map(n => {
                const k = (n + hue / 30) % 12;
                const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
                return `0${Math.round(value * 255).toString(16)}`.slice(-2);
            })
            .join('')}`;
    }
}
