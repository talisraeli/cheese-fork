// Keeps the code in small TypeScript modules, with structure (HTML templates), style (CSS) and
// logic (TS) apart, and the bundles in ES2017.

import { test, inject } from 'vite-plus/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as espree from 'espree';
import { parseAst } from 'vite-plus';
import type { Declaration, Expression, Node, Program, Statement } from '@oxc-project/types';
import { BOOKMARKLET_FILE } from '../tools/bundles.ts';

const root = path.resolve(import.meta.dirname, '..');
const MAX_MODULE_LINES = 800;

function filesIn(directory: string, extension: string) {
    return fs
        .readdirSync(path.join(root, directory), { withFileTypes: true, recursive: true })
        .filter(entry => entry.isFile() && entry.name.endsWith(extension))
        .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}

const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
// The modules, without type declarations (.d.ts), which hold no code.
const sourceModules = [...filesIn('src', '.js'), ...filesIn('src', '.ts')].filter(file => !file.endsWith('.d.ts'));

// A module's syntax tree, and the line of a position in it.
function parseModule(file: string): { program: Program; lineOf: (offset: number) => number } {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const program = parseAst(source, { lang: file.endsWith('.ts') ? 'ts' : 'js' }) as Program;
    return { program, lineOf: offset => source.slice(0, offset).split('\n').length };
}

// Every node in the tree under node.
function* nodesIn(node: unknown): Generator<Node> {
    if (Array.isArray(node)) {
        for (const child of node) {
            yield* nodesIn(child);
        }
    } else if (node && typeof node === 'object') {
        if (typeof (node as { type?: unknown }).type === 'string') {
            yield node as Node;
        }
        for (const child of Object.values(node)) {
            if (child && typeof child === 'object') {
                yield* nodesIn(child);
            }
        }
    }
}

test('there are source modules and pages to check', () => {
    assert.ok(sourceModules.length > 20, 'src/ has ' + sourceModules.length + ' modules');
    assert.ok(pages.length >= 4);
});

for (const page of pages) {
    test(page + ' has no inline scripts or styles', () => {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        const inlineScripts = [...html.matchAll(/<script\b([^>]*)>/g)].filter(match => !/\bsrc\s*=/.test(match[1]));
        assert.deepEqual(
            inlineScripts.map(match => match[0]),
            [],
            'inline <script>'
        );
        assert.doesNotMatch(html, /<style\b/, 'inline <style>');
        assert.doesNotMatch(html, /\sstyle\s*=/, 'style attribute');
        assert.doesNotMatch(html, /\son[a-z]+\s*=/, 'inline event handler');
    });
}

test('source modules have at most ' + MAX_MODULE_LINES + ' lines', () => {
    const large = sourceModules
        .map(file => ({ file, lines: fs.readFileSync(path.join(root, file), 'utf8').split('\n').length }))
        .filter(({ lines }) => lines > MAX_MODULE_LINES)
        .map(({ file, lines }) => file + ' (' + lines + ')');
    assert.deepEqual(large, []);
});

test('markup lives in HTML templates, not in script strings', () => {
    const offenders = [];
    for (const file of sourceModules) {
        const { program, lineOf } = parseModule(file);
        for (const node of nodesIn(program)) {
            const text =
                node.type === 'Literal' && typeof node.value === 'string'
                    ? node.value
                    : node.type === 'TemplateElement'
                      ? node.value.raw
                      : '';
            if (/<\/[a-z]/i.test(text)) {
                offenders.push(file + ':' + lineOf(node.start));
            }
        }
    }
    assert.deepEqual(offenders, []);
});

test('the sources are TypeScript', () => {
    assert.deepEqual(
        sourceModules.filter(file => !file.endsWith('.ts')),
        []
    );
});

// The browsers of browserslist in package.json all run ES2017, the target of the build.
test('the bundles are ES2017', () => {
    const bundles = inject('siteBundles');
    assert.ok(bundles[BOOKMARKLET_FILE], BOOKMARKLET_FILE);
    for (const [file, text] of Object.entries(bundles).filter(([file]) => file.endsWith('.js'))) {
        assert.doesNotThrow(() => espree.parse(text, { ecmaVersion: 2017 }), file);
    }
});
// The app starts in start() (src/app/init.js), called by its entry once every module is loaded,
// so a module must not run code when it's imported, other than declaring what it exports and
// setting up its prototypes. Otherwise it could run before the modules it uses are initialized.
const SIDE_EFFECT_MODULES = [
    'src/lib/i18n.ts',
    'src/lib/cookie-consent.ts',
    'src/lib/i18n-dialogs.ts',
    'src/lib/moment-locale.ts'
];

function isPureExpression(node: Expression): boolean {
    switch (node.type) {
        case 'Literal':
        case 'Identifier':
        case 'FunctionExpression':
        case 'ObjectExpression':
        case 'ArrayExpression':
        case 'ArrowFunctionExpression':
        case 'TemplateLiteral':
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'MemberExpression':
        case 'UnaryExpression':
        case 'BinaryExpression':
            return true;
        case 'CallExpression':
            // A class defined in a function that's called right away.
            return node.callee.type === 'FunctionExpression' && node.arguments.length === 0;
        default:
            return false;
    }
}

function isPureStatement(statement: Statement | Declaration): boolean {
    switch (statement.type) {
        case 'ImportDeclaration':
        case 'FunctionDeclaration':
        case 'ClassDeclaration':
        case 'TSInterfaceDeclaration':
        case 'TSTypeAliasDeclaration':
        case 'TSDeclareFunction':
        case 'TSModuleDeclaration':
            return true;
        case 'ExportNamedDeclaration':
            return !statement.declaration || isPureStatement(statement.declaration);
        case 'VariableDeclaration':
            return statement.declarations.every(d => !d.init || isPureExpression(d.init));
        case 'ExpressionStatement':
            // Prototype setup, such as CourseManager.prototype.getTitle = function () {...}.
            return (
                statement.expression.type === 'AssignmentExpression' &&
                statement.expression.left.type === 'MemberExpression' &&
                isPureExpression(statement.expression.right)
            );
        default:
            return false;
    }
}

test('modules run no code when imported, except the entries and the page scripts', () => {
    const impure = [];
    for (const file of sourceModules.filter(
        file => !file.startsWith('src/entries/') && !SIDE_EFFECT_MODULES.includes(file)
    )) {
        const { program, lineOf } = parseModule(file);
        for (const statement of program.body.filter(statement => !isPureStatement(statement as Statement))) {
            impure.push(file + ':' + lineOf(statement.start));
        }
    }
    assert.deepEqual(impure, []);
});
