// Makes the calendars built with the vendored ics.js follow the RFC 5545 text rules, which it
// doesn't do by itself: event text is escaped, long lines are folded, and the hard-coded
// English language of the summaries is removed. ics.js is used as a minified bundle with its
// dependencies, so this is a wrapper rather than a change to the library.

// A calendar built with the vendored ics.js, wrapped by wrap.
export interface WrappedCalendar {
    addEvent(
        subject: string,
        description: string,
        location: string,
        begin: string | Date,
        stop: string | Date,
        rrule?: unknown,
        exdates?: unknown
    ): boolean | void;
    build(allowEmpty?: boolean): string | false;
    download(filename: string): string | false;
}

// RFC 5545 3.1: lines should be at most 75 octets long, excluding the line break.
const MAX_LINE_OCTETS = 75;

// RFC 5545 3.3.11: escapes a TEXT value, such as SUMMARY, DESCRIPTION or LOCATION.
function escapeText(text: string): string {
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Length(codePoint: number): number {
    if (codePoint < 0x80) {
        return 1;
    } else if (codePoint < 0x800) {
        return 2;
    } else if (codePoint < 0x10000) {
        return 3;
    }
    return 4;
}

// RFC 5545 3.1: folds a line longer than 75 octets into several lines, each continuation
// line starting with a space. Never splits a character, Hebrew characters are 2 octets.
function foldLine(line: string): string {
    let result = '';
    let octets = 0;
    let i = 0;

    while (i < line.length) {
        let codePoint = line.charCodeAt(i);
        let char = line.charAt(i);
        if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < line.length) {
            // A surrogate pair, a single character of 4 octets.
            char = line.substr(i, 2);
            codePoint = 0x10000;
        }

        const length = utf8Length(codePoint);
        if (octets + length > MAX_LINE_OCTETS) {
            result += '\r\n ';
            octets = 1; // The leading space.
        }

        result += char;
        octets += length;
        i += char.length;
    }

    return result;
}

function fixCalendarText(calendar: string): string {
    return (
        calendar
            .split('\r\n')
            // ics.js leaves an empty line in a calendar without events, which isn't allowed.
            .filter(line => line !== '')
            .map(line => foldLine(line.replace(/^SUMMARY;LANGUAGE=en-us:/, 'SUMMARY:')))
            .join('\r\n')
    );
}

// Wraps an ics.js calendar. The text arguments of addEvent are plain text, and build and
// download return calendars that follow the text rules.
function wrap(calendar: IcsCalendar): WrappedCalendar {
    return {
        addEvent(subject, description, location, begin, stop, rrule, exdates) {
            return calendar.addEvent(
                escapeText(subject),
                escapeText(description),
                escapeText(location),
                begin,
                stop,
                rrule,
                exdates
            );
        },
        // Returns false for a calendar without events, like ics.js, unless allowEmpty is true.
        build(allowEmpty?: boolean) {
            const text: string | false = allowEmpty ? calendar.calendar() : calendar.build();
            return text ? fixCalendarText(text) : text;
        },
        // Same as ics.js download, which can't be used since it builds the calendar by itself.
        download(filename: string) {
            const text = this.build();
            if (!text) {
                return false;
            }

            saveAs(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `${filename}.ics`);
            return text;
        }
    };
}

export const IcsText = {
    escapeText,
    foldLine,
    fixCalendarText,
    wrap
};
