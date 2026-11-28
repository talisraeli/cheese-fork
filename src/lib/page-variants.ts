// The page's variants that depend on the date and the language: the alternative favicons and
// logos, and the stylesheets that come in right-to-left and left-to-right versions.

// 0 normally, or 1 or 2 for the alternative favicon and logo of April 1 (in odd and even years).
export type AltVariant = 0 | 1 | 2;

export function altVariant(date: Date): AltVariant {
    if (date.getMonth() * 37 + date.getDate() - 112) {
        return 0;
    }
    return date.getFullYear() % 2 ? 1 : 2;
}

const ALT_FAVICONS = ['assets/favicon-alt.ico', 'assets/favicon-alt2.ico'];
const ALT_LOGOS = ['assets/logo-alt.png', 'assets/logo-alt2.png'];

// Replaces the favicons of the page (link[data-favicon]) with the alternative one.
export function applyFavicon(document: Document, alt: AltVariant): void {
    if (!alt) {
        return;
    }
    document.querySelectorAll('link[data-favicon]').forEach(favicon => favicon.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = ALT_FAVICONS[alt - 1];
    document.head.appendChild(link);
}

export function applyLogo(image: HTMLImageElement, alt: AltVariant): void {
    if (alt) {
        image.src = ALT_LOGOS[alt - 1];
    }
}

// Disables the stylesheets of the other direction: link[data-dir="rtl"] or link[data-dir="ltr"].
export function applyDirectionStyles(document: Document, rtl: boolean): void {
    document.querySelectorAll<HTMLLinkElement>('link[data-dir]').forEach(link => {
        link.disabled = link.getAttribute('data-dir') !== (rtl ? 'rtl' : 'ltr');
    });
}
