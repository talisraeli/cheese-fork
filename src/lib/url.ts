// The value of a URL's query parameter: null if it's missing, '' if it has no value.
// https://stackoverflow.com/a/901144
export function getParameterByName(name: string, url?: string): string | null {
    const escapedName = name.replace(/[[\]]/g, '\\$&');
    const regex = new RegExp(`[?&]${escapedName}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(url || window.location.href);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
