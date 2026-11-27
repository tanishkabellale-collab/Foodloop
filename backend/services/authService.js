/**
 * FoodLoop Authentication & User Store Service
 *
 * - Password hashing: Node built-in crypto.scryptSync with random 16-byte salt
 *   and crypto.timingSafeEqual verification.
 * - Tokens: Standard HMAC-SHA256 JWT (RFC 7519) with exp & jti claims.
 * - Token revocation: In-memory blacklist on logout (cleans expired entries).
 * - Persistence: JSON file at backend/data/users.json (never exposes password_hash).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROLES = {
  DONOR: 'DONOR',
  NGO: 'NGO',
  ADMIN: 'ADMIN',
};

const VALID_ROLES = Object.values(ROLES);
const PUBLIC_REGISTER_ROLES = [ROLES.DONOR, ROLES.NGO];

const DEFAULT_USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const TOKEN_TTL_SECONDS = parseInt(process.env.JWT_EXPIRES_IN_SECONDS, 10) || 86400;

function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set (min 16 chars) in production.');
  }
  // Local development fallback only — never used when JWT_SECRET is set
  return 'foodloop-local-dev-secret-change-in-production';
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf8');
}

// Track revoked token JTIs on logout -> Map<jti, expEpochSeconds>
const revokedTokens = new Map();

function pruneRevokedTokens() {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp <= nowSec) revokedTokens.delete(jti);
  }
}

function signToken(user, options = {}) {
  const ttl = options.expiresInSeconds || TOKEN_TTL_SECONDS;
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + ttl;
  const jti = crypto.randomUUID();

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ngo_id: user.ngo_id || null,
      is_demo: Boolean(user.is_demo),
      iat: nowSec,
      exp,
      jti,
    })
  );

  const signature = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest()
  );

  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Authentication token is missing.');
    err.code = 'TOKEN_MISSING';
    throw err;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    const err = new Error('Malformed authentication token.');
    err.code = 'TOKEN_INVALID';
    throw err;
  }

  const [header, payload, signature] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest()
  );

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    const err = new Error('Invalid authentication token signature.');
    err.code = 'TOKEN_INVALID';
    throw err;
  }

  let claims;
  try {
    claims = JSON.parse(base64UrlDecode(payload));
  } catch (e) {
    const err = new Error('Invalid authentication token payload.');
    err.code = 'TOKEN_INVALID';
    throw err;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= nowSec) {
    const err = new Error('Your session has expired. Please sign in again.');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  if (claims.jti && revokedTokens.has(claims.jti)) {
    const err = new Error('This session has been logged out. Please sign in again.');
    err.code = 'TOKEN_REVOKED';
    throw err;
  }

  return claims;
}

function revokeToken(token) {
  try {
    const claims = verifyToken(token);
    if (claims.jti && claims.exp) {
      pruneRevokedTokens();
      revokedTokens.set(claims.jti, claims.exp);
    }
    return true;
  } catch (e) {
    return false;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || null,
    ngo_id: user.ngo_id || null,
    is_demo: Boolean(user.is_demo),
    created_at: user.created_at,
  };
}

function createAuthStore(usersFilePath = DEFAULT_USERS_FILE) {
  let users = [];

  function saveUsers() {
    const dir = path.dirname(usersFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  }

  function seedDemoUsers() {
    if (process.env.NODE_ENV === 'production') return;

    const demoAccounts = [
      {
        id: 'demo-user-donor',
        name: 'RSCOE Canteen (Demo Donor)',
        email: 'donor.demo@foodloop.local',
        password: process.env.DEMO_DONOR_PASSWORD || 'DonorDemo!2026',
        role: ROLES.DONOR,
        organization: 'JSPM RSCOE Campus Canteen',
        ngo_id: null,
        is_demo: true,
      },
      {
        id: 'demo-user-ngo',
        name: 'Annapurna Kitchen (Demo NGO)',
        email: 'ngo.demo@foodloop.local',
        password: process.env.DEMO_NGO_PASSWORD || 'NgoDemo!2026',
        role: ROLES.NGO,
        organization: 'Annapurna Community Kitchen',
        ngo_id: 'demo-ngo-1',
        is_demo: true,
      },
      {
        id: 'demo-user-admin',
        name: 'FoodLoop Reviewer (Demo Admin)',
        email: 'admin.demo@foodloop.local',
        password: process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo!2026',
        role: ROLES.ADMIN,
        organization: 'FoodLoop Quality Oversight',
        ngo_id: null,
        is_demo: true,
      },
    ];

    let changed = false;
    for (const demo of demoAccounts) {
      if (!users.some((u) => u.email === demo.email)) {
        users.push({
          id: demo.id,
          name: demo.name,
          email: demo.email,
          password_hash: hashPassword(demo.password),
          role: demo.role,
          organization: demo.organization,
          ngo_id: demo.ngo_id,
          is_demo: true,
          created_at: new Date().toISOString(),
        });
        changed = true;
      }
    }
    if (changed) saveUsers();
  }

  try {
    if (fs.existsSync(usersFilePath)) {
      users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
      if (!Array.isArray(users)) users = [];
    }
  } catch (err) {
    console.error('Error reading users file:', err);
    users = [];
  }
  seedDemoUsers();

  function registerUser({ name, email, password, role, organization }) {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const upperRole = (role || ROLES.DONOR).trim().toUpperCase();

    if (!cleanName || cleanName.length < 2) {
      const err = new Error('Full name or organization name is required (at least 2 characters).');
      err.status = 400;
      throw err;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      const err = new Error('Please enter a valid email address.');
      err.status = 400;
      throw err;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      const err = new Error('Password must be at least 8 characters long.');
      err.status = 400;
      throw err;
    }

    if (upperRole === ROLES.ADMIN) {
      const err = new Error('Admin accounts cannot be created via public registration.');
      err.status = 403;
      throw err;
    }

    if (!PUBLIC_REGISTER_ROLES.includes(upperRole)) {
      const err = new Error(`Role must be either ${PUBLIC_REGISTER_ROLES.join(' or ')}.`);
      err.status = 400;
      throw err;
    }

    if (users.some((u) => u.email === cleanEmail)) {
      const err = new Error('An account with this email address already exists.');
      err.status = 409;
      throw err;
    }

    const newUser = {
      id: `user-${crypto.randomUUID()}`,
      name: cleanName,
      email: cleanEmail,
      password_hash: hashPassword(password),
      role: upperRole,
      organization: (organization || '').trim() || null,
      ngo_id: null,
      is_demo: false,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers();

    const safeUser = sanitizeUser(newUser);
    const { token, expiresAt } = signToken(newUser);
    return { user: safeUser, token, expiresAt };
  }

  function loginUser({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      const err = new Error('Email and password are required.');
      err.status = 400;
      throw err;
    }

    const user = users.find((u) => u.email === cleanEmail);
    if (!user || !verifyPassword(password, user.password_hash)) {
      const err = new Error('Invalid email or password.');
      err.status = 401;
      throw err;
    }

    const safeUser = sanitizeUser(user);
    const { token, expiresAt } = signToken(user);
    return { user: safeUser, token, expiresAt };
  }

  function findById(id) {
    const user = users.find((u) => u.id === id);
    return sanitizeUser(user);
  }

  function listDemoAccounts() {
    if (process.env.NODE_ENV === 'production') return [];
    return users.filter((u) => u.is_demo).map(sanitizeUser);
  }

  return {
    registerUser,
    loginUser,
    findById,
    listDemoAccounts,
  };
}

module.exports = {
  ROLES,
  VALID_ROLES,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  revokeToken,
  sanitizeUser,
  createAuthStore,
};

