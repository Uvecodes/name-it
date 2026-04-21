/**
 * Server-side chat sessions (authoritative history). Stored in Firestore.
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

const COLLECTION = 'chat_sessions';
const MAX_MESSAGES = 40;
const TTL_MS = parseInt(process.env.CHAT_SESSION_TTL_MS || String(7 * 24 * 60 * 60 * 1000), 10);

function getDb() {
  if (!admin.apps.length) {
    throw new Error('Firebase not initialized');
  }
  return admin.firestore();
}

function newSessionId() {
  return crypto.randomUUID();
}

function isValidSessionId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function trimMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-MAX_MESSAGES);
}

/**
 * Load session or return null
 */
async function getSession(sessionId) {
  const snap = await getDb().collection(COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  const exp = data.expiresAt?.toMillis?.() || 0;
  if (exp && Date.now() > exp) {
    return null;
  }
  return { id: sessionId, ...data };
}

/**
 * Ensure session exists and is compatible with authenticated user.
 * Returns { sessionId, messages[], created }
 */
async function resolveSession(sessionId, userId) {
  if (!sessionId || !isValidSessionId(sessionId)) {
    const sid = newSessionId();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + TTL_MS);
    await getDb()
      .collection(COLLECTION)
      .doc(sid)
      .set({
        messages: [],
        userId: userId || null,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });
    return { sessionId: sid, messages: [], created: true };
  }

  const ref = getDb().collection(COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return resolveSession(null, userId);
  }

  const data = snap.data();
  const exp = data.expiresAt?.toMillis?.() || 0;
  if (exp && Date.now() > exp) {
    await ref.delete().catch(() => {});
    return resolveSession(null, userId);
  }

  const storedUser = data.userId || null;
  if (storedUser && userId && storedUser !== userId) {
    return resolveSession(null, userId);
  }

  const messages = trimMessages(data.messages || []);

  if (userId && !storedUser) {
    await ref.update({ userId, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  return { sessionId, messages, created: false };
}

/**
 * Append user + model messages (after model reply)
 */
async function appendExchange(sessionId, userText, modelText) {
  const ref = getDb().collection(COLLECTION).doc(sessionId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + TTL_MS);

  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data();
    let messages = Array.isArray(data.messages) ? [...data.messages] : [];
    const ts = Date.now();
    messages.push({ role: 'user', text: userText.slice(0, 4000), at: ts });
    messages.push({ role: 'model', text: modelText.slice(0, 8000), at: ts + 1 });
    messages = trimMessages(messages);
    tx.update(ref, {
      messages,
      updatedAt: now,
      expiresAt,
    });
  });
}

/**
 * Format messages for Gemini history (excludes latest user message — sent separately)
 */
function toGeminiHistory(messages, maxTurns = 10) {
  const slice = messages.slice(-(maxTurns * 2));
  return slice.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.text || '').slice(0, 8000) }],
  }));
}

module.exports = {
  newSessionId,
  isValidSessionId,
  getSession,
  resolveSession,
  appendExchange,
  toGeminiHistory,
  MAX_MESSAGES,
};
