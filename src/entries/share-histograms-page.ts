import { HistogramBrowser } from '../components/histogram-browser/histogram-browser.js';

$('#share-guide').append(HistogramBrowser.createShareGuide());
$('#top-navbar a[href="."]').attr('href', CheeseI18n.withLocale('.'));
