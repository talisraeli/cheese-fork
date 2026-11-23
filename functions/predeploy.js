'use strict';

// Copies the site's course-manager.js into the functions before deploying, so that the API
// saves course data exactly like the site does. Run by the predeploy hook in firebase.json.

const fs = require('node:fs');
const path = require('node:path');

const shared = path.join(__dirname, 'shared');
fs.mkdirSync(shared, { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', 'course-manager.js'), path.join(shared, 'course-manager.js'));
