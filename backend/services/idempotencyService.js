const admin = require('firebase-admin');

const COLLECTION = 'idempotency_keys';
const TTL_MS = 24 * 60 * 60 * 1000;

function getDb() {
  return admin.firestore();
}

function keyDocId(userId, key) {
  return `${userId}:${key}`;
}

function isValidIdempotencyKey(key) {
  return typeof key === 'string' && key.length >= 8 && key.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(key);
}

async function getStoredResponse(userId, key) {
  const id = keyDocId(userId, key);
  const doc = await getDb().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  const expiresAt = data.expiresAt?.toMillis?.() || 0;
  if (expiresAt && Date.now() > expiresAt) return null;
  return data.response || null;
}

async function storeResponse(userId, key, response) {
  const id = keyDocId(userId, key);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + TTL_MS);
  await getDb().collection(COLLECTION).doc(id).set({
    userId,
    key,
    response,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });
}

module.exports = {
  isValidIdempotencyKey,
  getStoredResponse,
  storeResponse,
};

