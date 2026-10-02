// Vercel serverless function handler (catch-all /api/* e /health e /storage/*)
import { app } from '../server/index.js';

export const config = { runtime: 'nodejs' };

function getOriginalUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
  const proto = req.headers['x-forwarded-proto'] || (req.headers[':scheme']) || 'https';
  const url = req.url || '/';
  if (/^https?:\/\//i.test(url)) return url;
  return `${proto}://${host}${url}`;
}

export default async function handler(req, res) {
  if (req.url && !req.url.startsWith('/')) req.url = '/' + req.url;
  Object.defineProperty(req, 'originalUrl', {
    configurable: true,
    get() { return this._originalUrl || (this._originalUrl = getOriginalUrl(this)); },
    set(v) { this._originalUrl = v; },
  });
  return new Promise((resolve, reject) => {
    let done = false;
    const end = () => { if (done) return; done = true; resolve(); };
    res.once('finish', end);
    res.once('close', end);
    app(req, res, (err) => {
      if (err) reject(err); else end();
    });
  });
}
