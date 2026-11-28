// Right after the navbar's logo in index.html, so the logo changes before it's shown.
import { altVariant, applyLogo } from '../lib/page-variants.js';

applyLogo(document.getElementById('navbar-logo') as HTMLImageElement, altVariant(new Date()));
