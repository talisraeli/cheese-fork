import { HistogramBrowser } from '../components/histogram-browser/histogram-browser.js';
import { getParameterByName } from '../lib/url.js';
import { stringToCourseNumber } from '../lib/course-number.js';

$('.footer-promo a').attr('href', CheeseI18n.withLocale('.'));
const course = stringToCourseNumber(getParameterByName('course'));
if (course) {
    const histogramBrowser = new HistogramBrowser($('.inline-histograms'), {
        selectColumnGrid: 'md',
        shareGuideInNewWindow: true
    });
    histogramBrowser.loadHistograms(course);
} else {
    $('.inline-histograms').text(CheeseI18n.t('histogram.invalidCourse'));
}
