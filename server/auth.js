import process from 'node:process';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const COOKIE_NAME = 'geomind_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-only-change-me');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET é obrigatório em produção.');
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function signSession(user) {
  return jwt.sign({
    sub: String(user.id),
    organizationId: user.organization_id,
    role: user.role,
    email: user.email,
    jti: crypto.randomUUID(),
  }, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export function issueSession(res, user) {
  const token = signSession(user);
  setSessionCookie(res, token);
  return token;
}

export function verifySession(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authenticate(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearer || parseCookies(req.headers.cookie || '')[COOKIE_NAME];

  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });

  try {
    const payload = verifySession(token);
    req.user = {
      id: Number(payload.sub),
      organizationId: Number(payload.organizationId),
      role: payload.role,
      email: payload.email,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

export function optionalAuthenticate(req, _res, next) {
  const authHeader = req.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearer || parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  if (token) {
    try {
      const payload = verifySession(token);
      req.user = {
        id: Number(payload.sub),
        organizationId: Number(payload.organizationId),
        role: payload.role,
        email: payload.email,
      };
    } catch {
      // A autenticação é opcional neste middleware.
    }
  }
  return next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Autenticação necessária.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Permissão insuficiente.' });
    return next();
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
