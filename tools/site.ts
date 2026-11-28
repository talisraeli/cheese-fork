// The whole site, as deployed: `pnpm build` writes it to out/, which the deploy uploads as it is
// (see .github/workflows/azure-deploy.yml). The pages keep the paths they have in the repository,
// so `vp dev` serves them from the root the same way.

import fs from 'node:fs';
import path from 'node:path';
import { buildBundles } from './bundles.ts';

const root = path.resolve(import.meta.dirname, '..');

export const OUT_DIR = path.join(root, 'out');

// What the pages load besides the bundles, as it is in the repository.
const SITE_DIRECTORIES = ['assets', 'catalog-en', 'data', 'icons', 'locales', 'modules'];
const SITE_FILES = ['favicon.ico', 'logo.png', 'staticwebapp.config.json'];

// The pages: every HTML file at the root.
function pages(): string[] {
    return fs.readdirSync(root).filter(file => file.endsWith('.html'));
}

function filesUnder(directory: string): string[] {
    return fs
        .readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .sort();
}

// Writes the site to outDir, replacing what's there, with the bundles given or built now.
// Returns the files written, relative to outDir.
export async function writeSite(outDir = OUT_DIR, bundles?: Map<string, string>): Promise<string[]> {
    const target = path.resolve(outDir);
    // It's replaced as a whole, so it must never be the repository or hold it.
    const fromTarget = path.relative(target, root);
    if (fromTarget === '' || (!fromTarget.startsWith('..') && !path.isAbsolute(fromTarget))) {
        throw new Error('The site is built out of the repository, but ' + target + ' holds the repository');
    }
    const built = bundles ?? (await buildBundles());

    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    for (const file of [...pages(), ...SITE_FILES]) {
        fs.copyFileSync(path.join(root, file), path.join(target, file));
    }
    for (const directory of SITE_DIRECTORIES) {
        fs.cpSync(path.join(root, directory), path.join(target, directory), {
            recursive: true,
            // Type declarations of the libraries, for tsc.
            filter: source => !source.endsWith('.ts')
        });
    }
    for (const [file, text] of built) {
        if (fs.existsSync(path.join(target, file))) {
            throw new Error(file + ' is both built and copied from the repository');
        }
        fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
        fs.writeFileSync(path.join(target, file), text);
    }
    return filesUnder(target);
}
