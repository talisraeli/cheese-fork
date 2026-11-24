'use strict';

/* global CheeseI18n, moment */

// Load after moment and the FullCalendar locale files. Each locale file makes its locale moment's
// global one, so this sets the page's language again, for every script that formats dates.
(function () {
    if (CheeseI18n.getLocale() === 'ar') {
        // Moment's Arabic locale writes Eastern Arabic digits, the site uses Western ones, like the
        // catalog and the other languages.
        var keepDigits = function (string) {
            return string;
        };
        moment.updateLocale('ar', {preparse: keepDigits, postformat: keepDigits});
    }
    moment.locale(CheeseI18n.getLocale());
})();
