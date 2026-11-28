// The localStorage item of the collapsed layers, see collapsedLayersLoad.
export const COLLAPSED_LAYERS_STORAGE_KEY = 'collapsedLayers';

// The version of the popup that introduces the features CheeseFork² adds over the original
// CheeseFork. Bump it when new features are added to the popup, to show it again.
export const whatsNewVersion = 4;

// The delay of the automatic upload of an exported calendar: several changes in a row, such as
// choosing lessons, cause a single upload.
export const CALENDAR_AUTO_UPLOAD_DELAY_MS = 5000;

// The text color for custom colors that are too light for white text, see readableTextColor.
export const DARK_TEXT_COLOR = '#212529';

// The number of changes that can be undone, see onSavedSessionChange.
export const SAVED_SESSION_UNDO_LIMIT = 50;
