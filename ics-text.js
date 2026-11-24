'use strict';

/* global saveAs */
/* exported IcsText */

// Makes the calendars built with the vendored ics.js follow the RFC 5545 text rules, which it
// doesn't do by itself: event text is escaped, long lines are folded, and the hard-coded
// English language of the summaries is removed. ics.js is used as a minified bundle with its
// dependencies, so this is a wrapper rather than a change to the library.
var IcsText = (function () {
    // RFC 5545 3.1: lines should be at most 75 octets long, excluding the line break.
    var MAX_LINE_OCTETS = 75;

    // RFC 5545 3.3.11: escapes a TEXT value, such as SUMMARY, DESCRIPTION or LOCATION.
    function escapeText(text) {
        return String(text)
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r\n|\r|\n/g, '\\n');
    }

    function utf8Length(codePoint) {
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
    function foldLine(line) {
        var result = '';
        var octets = 0;
        var i = 0;

        while (i < line.length) {
            var codePoint = line.charCodeAt(i);
            var char = line.charAt(i);
            if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < line.length) {
                // A surrogate pair, a single character of 4 octets.
                char = line.substr(i, 2);
                codePoint = 0x10000;
            }

            var length = utf8Length(codePoint);
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

    function fixCalendarText(calendar) {
        return calendar.split('\r\n').map(function (line) {
            return foldLine(line.replace(/^SUMMARY;LANGUAGE=en-us:/, 'SUMMARY:'));
        }).join('\r\n');
    }

    // Wraps an ics.js calendar. The text arguments of addEvent are plain text, and build and
    // download return calendars that follow the text rules.
    function wrap(calendar) {
        return {
            addEvent: function (subject, description, location, begin, stop, rrule, exdates) {
                return calendar.addEvent(escapeText(subject), escapeText(description), escapeText(location),
                    begin, stop, rrule, exdates);
            },
            build: function () {
                var text = calendar.build();
                return text ? fixCalendarText(text) : text;
            },
            // Same as ics.js download, which can't be used since it builds the calendar by itself.
            download: function (filename) {
                var text = this.build();
                if (!text) {
                    return false;
                }

                saveAs(new Blob([text], {type: 'text/calendar;charset=utf-8'}), filename + '.ics');
                return text;
            }
        };
    }

    return {
        escapeText: escapeText,
        foldLine: foldLine,
        fixCalendarText: fixCalendarText,
        wrap: wrap
    };
})();
