// After data/semesters.js in index.html, and before the app.
import { loadCatalog } from '../lib/catalog-loader.js';

loadCatalog(window, document);
