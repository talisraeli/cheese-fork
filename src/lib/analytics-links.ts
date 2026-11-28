// Clicks on links marked with data-gtag-event="<event name>" are sent to analytics. Markup
// shown as HTML, such as course descriptions in tooltips, marks its links this way instead of
// having onclick handlers. An empty event name isn't sent.
export function trackMarkedLinks(document: Document): void {
    $(document).on('click', '[data-gtag-event]', function (this: HTMLElement) {
        const event = this.getAttribute('data-gtag-event');
        if (event) {
            gtag('event', event);
        }
    });
}
