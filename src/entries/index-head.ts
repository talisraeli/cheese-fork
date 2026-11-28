// The end of index.html's <head>: the stylesheets of the page's direction, and the favicon.
import { altVariant, applyDirectionStyles, applyFavicon } from '../lib/page-variants.js';

applyDirectionStyles(document, CheeseI18n.isRTL());
applyFavicon(document, altVariant(new Date()));
