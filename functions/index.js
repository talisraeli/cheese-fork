'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

const { createApi } = require('./lib/api');
const { createCatalogLoader } = require('./lib/catalog');
const { createFirestoreStore } = require('./lib/firestore-store');
const { generateApiKey, hashApiKey, apiKeyHint } = require('./lib/keys');
const { createRateLimiter } = require('./lib/rate-limit');

initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = getFirestore();

const handleApiRequest = createApi({
    store: createFirestoreStore(db, getAuth()),
    loadCatalog: createCatalogLoader(fetch, Date.now),
    nowSeconds: () => Math.round(Date.now() / 1000),
    logError: error => logger.error(error)
});

// The schedule API, authenticated with a personal API key. See API.md.
exports.api = onRequest({ cors: false }, async (req, res) => {
    // Keys are sent in a header, never as cookies, so any origin may call the API.
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Expose-Headers', 'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After');
    res.set('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const response = await handleApiRequest({
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body
    });

    res.set(response.headers || {});
    if (response.body === undefined) {
        res.status(response.status).end();
    } else {
        res.status(response.status).json(response.body);
    }
});

// API key management for the signed-in user, called from the site. Each user has at most one key.

// Creating and revoking keys is rare, so a few attempts a minute are plenty.
const keyChangeLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 1000 });

function requireUid(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign in to manage your API key.');
    }
    return request.auth.uid;
}

function limitKeyChanges(uid) {
    const usage = keyChangeLimiter.take(uid);
    if (!usage.allowed) {
        throw new HttpsError('resource-exhausted', 'Too many API key changes, try again in ' + usage.resetSeconds + ' seconds.');
    }
}

function ownerRef(uid) {
    return db.collection('apiKeyOwners').doc(uid);
}

function timestampMillis(value) {
    return value ? value.toMillis() : null;
}

exports.apiKeyStatus = onCall(async request => {
    const uid = requireUid(request);
    const owner = await ownerRef(uid).get();
    if (!owner.exists) {
        return { exists: false };
    }
    const key = await db.collection('apiKeys').doc(owner.get('hash')).get();
    return {
        exists: true,
        hint: owner.get('hint'),
        createdAt: timestampMillis(owner.get('createdAt')),
        lastUsedAt: key.exists ? timestampMillis(key.get('lastUsedAt')) : null
    };
});

// Creates the user's key, replacing (and revoking) the previous one. The key is returned only here.
exports.apiKeyCreate = onCall(async request => {
    const uid = requireUid(request);
    limitKeyChanges(uid);
    const key = generateApiKey();
    const hash = hashApiKey(key);
    const createdAt = Timestamp.now();

    await db.runTransaction(async transaction => {
        const owner = await transaction.get(ownerRef(uid));
        if (owner.exists) {
            transaction.delete(db.collection('apiKeys').doc(owner.get('hash')));
        }
        transaction.create(db.collection('apiKeys').doc(hash), { uid: uid, createdAt: createdAt });
        transaction.set(ownerRef(uid), { hash: hash, hint: apiKeyHint(key), createdAt: createdAt });
    });

    return { key: key, hint: apiKeyHint(key), createdAt: createdAt.toMillis() };
});

exports.apiKeyRevoke = onCall(async request => {
    const uid = requireUid(request);
    limitKeyChanges(uid);
    await db.runTransaction(async transaction => {
        const owner = await transaction.get(ownerRef(uid));
        if (owner.exists) {
            transaction.delete(db.collection('apiKeys').doc(owner.get('hash')));
            transaction.delete(ownerRef(uid));
        }
    });
    return { exists: false };
});
