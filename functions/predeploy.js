// Copies the site's course manager, as built in out/dist/, into the functions before deploying, so
// that the API saves course data exactly like the site does. Run by the predeploy of firebase.json,
// after the site and the functions are built.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsDir = path.dirname(fileURLToPath(import.meta.url));
const shared = path.join(functionsDir, 'shared');
fs.mkdirSync(shared, { recursive: true });
fs.copyFileSync(
    path.join(functionsDir, '..', 'out', 'dist', 'course-manager.js'),
    path.join(shared, 'course-manager.js')
);
