'use strict';

// API keys are random secrets shown to the user once. Only their SHA-256 hash is stored:
// apiKeys/{hash} maps a key to its owner, and apiKeyOwners/{uid} points back to the
// user's single key so that it can be shown, replaced or revoked.

const crypto = require('node:crypto');

const KEY_PREFIX = 'cf2_';

function generateApiKey() {
    return KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
}

function hashApiKey(key) {
    return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

// The start of the key, safe to show so that users can tell their keys apart.
function apiKeyHint(key) {
    return key.slice(0, KEY_PREFIX.length + 6);
}

function looksLikeApiKey(value) {
    return typeof value === 'string' && value.startsWith(KEY_PREFIX) && /^[A-Za-z0-9_-]{40,100}$/.test(value);
}

// Reads the key from "Authorization: Bearer <key>" or "X-API-Key: <key>".
function apiKeyFromHeaders(headers) {
    const authorization = headers.authorization;
    if (typeof authorization === 'string') {
        const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
        if (match) {
            return match[1];
        }
    }
    const header = headers['x-api-key'];
    return typeof header === 'string' ? header.trim() : null;
}

module.exports = { generateApiKey, hashApiKey, apiKeyHint, looksLikeApiKey, apiKeyFromHeaders };
