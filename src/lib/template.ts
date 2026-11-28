// Fills an HTML template, imported from a .html file:
// - {{name}} is values.name, escaped.
// - {{{name}}} is values.name as HTML, for markup the code built, such as other templates.
// - {{t:<message key>}} is the message in the page's language, escaped.
// A missing, null or undefined value is an error, so a typo doesn't render as an empty string.
// Line breaks, with the indentation around them, are removed, so templates can be laid out for
// reading without adding whitespace to the page. Spaces within a line are kept.

export type TemplateValues = Record<string, string | number | boolean | null | undefined>;

export function escapeHtml(value: unknown): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function render(template: string, values?: TemplateValues): string {
    return template
        .replace(/\s*\n\s*/g, '')
        .replace(
            /\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}|\{\{t:([\w.-]+)\}\}/g,
            (match, raw?: string, escaped?: string, key?: string) => {
                if (key) {
                    return escapeHtml(CheeseI18n.t(key));
                }
                const name = (raw || escaped) as string;
                const value = values ? values[name] : undefined;
                if (value === undefined || value === null) {
                    throw new Error(`Missing template value: ${name}`);
                }
                return raw ? String(value) : escapeHtml(value);
            }
        );
}
