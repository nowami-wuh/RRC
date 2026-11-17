import crypto from 'crypto';

const sessions = new Map();
const sessionTtlMs = 8 * 60 * 60 * 1000;

export function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expiresAt: Date.now() + sessionTtlMs, lastActivityAt: Date.now() });
  return token;
}

function readToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Authentication required.' });
  }
  session.lastActivityAt = Date.now();
  session.expiresAt = Date.now() + sessionTtlMs;
  req.user = session.user;
  return next();
}

export function isUserOnline(userId) {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
      continue;
    }
    if (String(session.user?.id) === String(userId) && now - session.lastActivityAt <= 45 * 1000) {
      return true;
    }
  }
  return false;
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  return next();
}

export function scopeCustomerRequest(req, res, next) {
  if (req.user?.role !== 'customer') return next();
  const customerId = req.user.id;
  const supplied = req.query.customerId || req.body?.customerId || req.body?.userId || req.body?.customerPublicId;
  if (supplied && supplied !== customerId) {
    return res.status(403).json({ error: 'You may only access your own account.' });
  }
  if (req.query && !req.query.customerId) req.query.customerId = customerId;
  if (req.body) {
    if ('customerId' in req.body) req.body.customerId = customerId;
    if ('userId' in req.body) req.body.userId = customerId;
    if ('customerPublicId' in req.body) req.body.customerPublicId = customerId;
    if ('senderRole' in req.body) req.body.senderRole = 'customer';
  }
  return next();
}
