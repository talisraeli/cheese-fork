// The globals of the pages, defined by the scripts they load before the bundles.

import type { CatalogCourse, EnglishCatalog } from '../lib/course-manager.js';

declare global {
    interface CheeseI18nApi {
        addMessages(locale: string, messages: Record<string, string>): void;
        // The parameters are written with String().
        t(key: string, params?: Record<string, unknown>): string;
        getLocale(): 'he' | 'en' | 'ar';
        isRTL(): boolean;
        apply(root?: Document | Element): void;
        setLocale(locale: string): boolean;
        withLocale(url: string): string;
    }

    interface CheeseCookieConsentApi {
        show(): void;
        accept(): void;
        decline(): void;
        isGranted(): boolean;
    }

    interface SemesterDates {
        start: string;
        end: string;
    }

    interface Window {
        CheeseI18n: CheeseI18nApi;
        CheeseCookieConsent: CheeseCookieConsentApi;
        availableSemesters: Record<string, SemesterDates>;
        currentSemester: string;
        scheduleSharingUserId: string | null;
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }

    // dist/i18n.js, loaded in <head>.
    const CheeseI18n: CheeseI18nApi;
    // data/semesters.js, and index-catalog.js for the others.
    const availableSemesters: Record<string, SemesterDates>;
    const currentSemester: string;
    const scheduleSharingUserId: string | null;
    // The semester's catalog, loaded from sap.cheesefork.cf or ug.cheesefork.cf, and its English
    // text from catalog-en/ in English only.
    const courses_from_rishum: CatalogCourse[];
    const courses_english: EnglishCatalog | undefined;
    // Defined by dist/cookie-consent.js, which drops the calls until analytics are allowed.
    function gtag(...args: unknown[]): void;
}

export {};
