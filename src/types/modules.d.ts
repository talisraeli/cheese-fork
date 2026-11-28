// HTML templates are imported as strings, see templatesAsText in tools/bundles.ts.
declare module '*.html' {
    const template: string;
    export default template;
}
