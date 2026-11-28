// /share-histograms.js, see src/bookmarklet/share-histograms.ts. Loading it again, such as by
// using the bookmarklet twice, does nothing, rather than showing a second overlay.
import { shareHistograms } from '../bookmarklet/share-histograms.js';

declare global {
    interface Window {
        cheeseForkShareHistogramsLoaded?: boolean;
    }
}

if (!window.cheeseForkShareHistogramsLoaded) {
    window.cheeseForkShareHistogramsLoaded = true;
    // 🧀🍴
    shareHistograms();
}
