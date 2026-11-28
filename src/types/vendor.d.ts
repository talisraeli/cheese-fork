// The third-party libraries the pages load as scripts from modules/ and from gstatic, as far as
// the site uses them. Libraries with published types (jQuery, jQuery UI, Bootstrap, selectize,
// moment, Firebase) use those.
//
// Firebase's compat types are a CommonJS declaration (export default firebase), which an ES
// module would import as the whole module, so the modules import it with resolution-mode
// require: the pages load Firebase as scripts that define the global firebase.

import type { Moment, MomentInput } from 'moment';
import type firebaseCompat from 'firebase/compat/app' with { 'resolution-mode': 'require' };
import type {} from 'firebase/compat/auth';
import type {} from 'firebase/compat/firestore';
import type {} from 'firebase/compat/storage';
import type {} from 'firebase/compat/functions';

declare global {
    const moment: typeof import('moment');
    const firebase: typeof firebaseCompat;

    // FirebaseUI 3.3, from gstatic.
    namespace firebaseui.auth {
        interface Config {
            signInOptions: unknown[];
            credentialHelper?: string;
            tosUrl?: string | (() => void);
            privacyPolicyUrl?: string | (() => void);
            callbacks?: {
                signInSuccessWithAuthResult?: (
                    authResult: firebaseCompat.auth.UserCredential,
                    redirectUrl?: string
                ) => boolean;
                uiShown?: () => void;
            };
            [option: string]: unknown;
        }
        class AuthUI {
            constructor(auth: firebaseCompat.auth.Auth);
            start(element: string | Element, config: Config): void;
            reset(): void;
        }
        const CredentialHelper: { NONE: string; ACCOUNT_CHOOSER_COM: string; GOOGLE_YOLO: string };
    }

    // bootstrap4-dialog.
    interface BootstrapDialogButton {
        id?: string;
        label?: string;
        icon?: string;
        cssClass?: string;
        hotkey?: number;
        autospin?: boolean;
        action?: (dialog: BootstrapDialogInstance) => void;
    }

    interface BootstrapDialogButtonElement extends JQuery {
        enable(): this;
        disable(): this;
        toggleEnable(enable?: boolean): this;
    }

    interface BootstrapDialogOptions {
        title?: string | JQuery;
        message?: string | JQuery | ((dialog: BootstrapDialogInstance) => string | JQuery);
        type?: string;
        size?: string;
        cssClass?: string;
        closable?: boolean;
        draggable?: boolean;
        nl2br?: boolean;
        // Whether the dialog is removed from the page once closed. True by default.
        autodestroy?: boolean;
        buttons?: BootstrapDialogButton[];
        onshow?: (dialog: BootstrapDialogInstance) => void;
        onshown?: (dialog: BootstrapDialogInstance) => void;
        onhide?: (dialog: BootstrapDialogInstance) => boolean | void;
        onhidden?: (dialog: BootstrapDialogInstance) => void;
    }

    interface BootstrapDialogConfirmOptions extends BootstrapDialogOptions {
        btnOKLabel?: string;
        btnCancelLabel?: string;
        btnOKClass?: string;
        callback?: (confirmed: boolean) => void;
    }

    interface BootstrapDialogInstance {
        options: BootstrapDialogOptions;
        open(): this;
        close(): this;
        getButton(id: string): BootstrapDialogButtonElement;
        getModal(): JQuery;
        getModalHeader(): JQuery;
        getModalBody(): JQuery;
        getModalFooter(): JQuery;
        getTitle(): string | JQuery;
        setTitle(title: string | JQuery): this;
        makeModalDraggable(): this;
        createCloseButton(): JQuery;
    }

    interface BootstrapDialogStatic {
        new (options: BootstrapDialogOptions): BootstrapDialogInstance;
        show(options: BootstrapDialogOptions): BootstrapDialogInstance;
        confirm(options: BootstrapDialogConfirmOptions): BootstrapDialogInstance;
        prototype: BootstrapDialogInstance;
        DEFAULT_TEXTS: Record<string, string>;
        SIZE_SMALL: string;
        SIZE_WIDE: string;
        SIZE_LARGE: string;
        TYPE_DEFAULT: string;
        TYPE_INFO: string;
        TYPE_PRIMARY: string;
        TYPE_SECONDARY: string;
        TYPE_SUCCESS: string;
        TYPE_WARNING: string;
        TYPE_DANGER: string;
        TYPE_DARK: string;
        TYPE_LIGHT: string;
        [type: `TYPE_${string}`]: string;
    }

    const BootstrapDialog: BootstrapDialogStatic;

    // FullCalendar 3, a jQuery plugin.
    interface FullCalendarEvent {
        id?: string | number;
        title?: string;
        start: Moment;
        end: Moment | null;
        allDay?: boolean;
        className?: string | string[];
        editable?: boolean;
        startEditable?: boolean;
        durationEditable?: boolean;
        overlap?: boolean;
        backgroundColor?: string;
        borderColor?: string;
        textColor?: string;
        color?: string;
        rendering?: string;
    }

    // An event as given to the calendar, whose times are converted to moments.
    type FullCalendarEventInput<E extends FullCalendarEvent = FullCalendarEvent> = Omit<E, 'start' | 'end'> & {
        start: MomentInput;
        end?: MomentInput | null;
    };

    interface FullCalendarView {
        name: string;
        start: Moment;
        end: Moment;
        intervalStart: Moment;
        intervalEnd: Moment;
        // Whether a range of the view is selected.
        isSelected?: boolean;
    }

    interface FullCalendarApi {
        moment(input?: MomentInput): Moment;
    }

    type FullCalendarEventFilter<E extends FullCalendarEvent> = string | number | ((event: E) => boolean);

    interface JQuery {
        fullCalendar(options: Record<string, unknown>): this;
        fullCalendar<E extends FullCalendarEvent = FullCalendarEvent>(
            method: 'clientEvents',
            filter?: FullCalendarEventFilter<E>
        ): E[];
        fullCalendar<E extends FullCalendarEvent = FullCalendarEvent>(
            method: 'removeEvents',
            filter?: FullCalendarEventFilter<E>
        ): void;
        fullCalendar(method: 'getCalendar'): FullCalendarApi;
        fullCalendar(method: 'getView'): FullCalendarView;
        fullCalendar(method: 'option', name: string): unknown;
        fullCalendar(method: 'option', name: string, value: unknown): void;
        fullCalendar(method: 'option', options: Record<string, unknown>): void;
        fullCalendar(method: 'render' | 'rerenderEvents' | 'unselect'): void;
        fullCalendar<E extends FullCalendarEvent = FullCalendarEvent>(
            method: 'renderEvent',
            event: FullCalendarEventInput<E>,
            stick?: boolean
        ): void;
        fullCalendar<E extends FullCalendarEvent = FullCalendarEvent>(
            method: 'renderEvents',
            events: FullCalendarEventInput<E>[],
            stick?: boolean
        ): void;
        fullCalendar(method: 'select', start: MomentInput, end?: MomentInput): void;
        // Updates the events with the ids of the given ones, with the given properties.
        fullCalendar(method: 'updateEvent', event: Partial<FullCalendarEvent>): void;
        fullCalendar(method: 'updateEvents', events: Partial<FullCalendarEvent>[]): void;
    }

    // selectize: what its published types leave out.
    namespace Selectize {
        // The type parameters have to be the same as in the published types.
        // oxlint-disable-next-line no-unused-vars
        interface IApi<T, U> {
            $control: JQuery;
            $dropdown: JQuery;
            addOption(data: U | U[]): void;
        }
    }

    // ics.js, with its dependencies, in modules/ics.js.
    interface IcsCalendar {
        addEvent(
            subject: string,
            description: string,
            location: string,
            begin: string | Date,
            stop: string | Date,
            rrule?: unknown,
            exdates?: unknown
        ): boolean | void;
        calendar(): string;
        build(): string | false;
        events(): string[];
    }
    function ics(uidDomain?: string, prodId?: string, extraHeaders?: string[], timezone?: string): IcsCalendar;
    // FileSaver.js, bundled with ics.js.
    function saveAs(data: Blob, filename: string): void;

    // intro.js.
    interface IntroJs {
        setOptions(options: Record<string, unknown>): this;
        onexit(callback: () => void): this;
        oncomplete(callback: () => void): this;
        start(): this;
    }
    function introJs(element?: string | Element): IntroJs;

    // color-hash.
    class ColorHash {
        constructor(options?: { lightness?: number | number[]; saturation?: number | number[]; hue?: unknown });
        hex(text: string): string;
        rgb(text: string): [number, number, number];
        hsl(text: string): [number, number, number];
    }

    // jsdiff.
    interface JsDiffChange {
        value: string;
        added?: boolean;
        removed?: boolean;
        count?: number;
    }
    const JsDiff: {
        diffWords(oldText: string, newText: string): JsDiffChange[];
    };

    // modules/boolean-expression.js, for the filter of courses by those already taken.
    class BooleanExpression {
        constructor(expression: string);
        test(trueVariables: string[]): boolean;
    }
}

export {};
