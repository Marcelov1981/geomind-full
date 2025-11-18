import express, { Request, Response } from 'express';
import { getDatabase } from '../database.js';
import { ObjectId } from 'mongodb';
import crypto from 'node:crypto';

const router = express.Router();

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const email = String((req.body || {}).email || '');
    const password = String((req.body || {}).password || '');
    if (!email || !password) return res.status(400).json({ detail: 'Email and password are required' });

    const db = getDatabase();
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(401).json({ detail: 'Invalid credentials' });

    const plain = (user as any).password;
    const hash = (user as any).password_hash;
    const salt = (user as any).password_salt;

    let ok = false;
    if (typeof hash === 'string' && typeof salt === 'string') {
      const computedHex = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      const a = Buffer.from(computedHex, 'hex');
      const b = Buffer.from(hash, 'hex');
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else if (typeof plain === 'string') {
      const a = Buffer.from(password);
      const b = Buffer.from(plain);
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    if (!ok) return res.status(401).json({ detail: 'Invalid credentials' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.collection('sessions').insertOne({
      user_id: new ObjectId((user as any)._id),
      token,
      created_at: new Date(),
      expires_at: expiresAt,
    });

    const responseUser = {
      id: (user as any)._id?.toString?.() || (user as any).id,
      email: (user as any).email,
      name: (user as any).name ?? '',
    };

    res.json({ token, token_type: 'Bearer', expires_at: expiresAt.toISOString(), user: responseUser });
  } catch (err) {
    res.status(500).json({ detail: String(err) });
  }
});

export default router;