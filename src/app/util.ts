import type { Lesson } from '../lib/course-manager.js';
import { state } from './state.js';

export function copyToClipboard(text: string, onSuccess: () => void, onFailure: () => void) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }

    navigator.clipboard.writeText(text).then(
        () => {
            onSuccess();
        },
        err => {
            onFailure();
        }
    );

    function fallbackCopyTextToClipboard(text: string) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        let successful = false;
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

export function setPageTitle(title: string) {
    $('title').removeAttr('data-i18n');
    document.title = title;
}

export function escapeHtml(text: string) {
    return $('<div>').text(text).html().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function sourceText(text: string | number, element?: string) {
    return $(element || '<span>')
        .addClass('source-content')
        .attr({
            lang: /[\u0590-\u05ff]/.test(String(text)) ? 'he' : 'en',
            dir: 'auto'
        })
        .text(text);
}

// A value of a course's catalog data (general information, or a lesson), in the page's language.
export function metadataDisplayValue(key: string, value: string | number): string | number {
    if (key === 'יום') {
        return state.courseManager.getDayLabel(String(value));
    }
    if (key === 'פקולטה') {
        return state.courseManager.getFacultyLabel(String(value));
    }
    if (key === 'מסגרת לימודים') {
        return String(value)
            .split('\n')
            .map(framework => state.courseManager.getFrameworkLabel(framework))
            .join('\n');
    }
    return value;
}

export function lessonDisplayTime(lesson: Lesson): string | null {
    if (!lesson['יום']) {
        return null;
    }
    const day = CheeseI18n.t('shell.crawler.day', { day: state.courseManager.getDayLabel(lesson['יום']) });
    return day + (lesson['שעה'] ? ` ${lesson['שעה']}` : '');
}

export function shellUrl(updates: Record<string, string | null>) {
    const anchor = document.createElement('a');
    anchor.href = window.location.href;
    let parameters = anchor.search ? anchor.search.slice(1).split('&') : [];
    Object.keys(updates).forEach(name => {
        parameters = parameters.filter(parameter => {
            let parameterName = parameter.split('=')[0].replace(/\+/g, ' ');
            try {
                parameterName = decodeURIComponent(parameterName);
            } catch (error) {
                return true;
            }
            return parameterName !== name;
        });
        if (updates[name] !== null) {
            parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(updates[name])}`);
        }
    });
    anchor.search = parameters.length ? `?${parameters.join('&')}` : '';
    return CheeseI18n.withLocale(anchor.href);
}

export function crawlerUrl(updates: Record<string, string | null>) {
    return shellUrl($.extend({ semester: currentSemester, course: null, staff: null, room: null }, updates));
}

// https://stackoverflow.com/a/19015262
export function getScrollBarWidth() {
    const $outer = $('<div>').css({ visibility: 'hidden', width: 100, overflow: 'scroll' }).appendTo('body');
    const widthWithScroll = $('<div>').css({ width: '100%' }).appendTo($outer).outerWidth() as number;
    $outer.remove();
    return 100 - widthWithScroll;
}
