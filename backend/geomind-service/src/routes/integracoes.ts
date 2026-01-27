import express, { Request, Response } from 'express'
import { getDatabase } from '../database.js'
import crypto from 'crypto'

const router = express.Router()

function getSecret() {
  const s = process.env.CONFIG_SECRET || ''
  if (!s || s.length < 16) return crypto.createHash('sha256').update('geomind-dev-secret').digest('hex')
  return crypto.createHash('sha256').update(s).digest('hex')
}

function encrypt(text: string) {
  const key = Buffer.from(getSecret(), 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(payload: string) {
  try {
    const buf = Buffer.from(payload, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const key = Buffer.from(getSecret(), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return ''
  }
}

router.get('/integracoes/apis', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const doc = await db.collection('settings').findOne({ type: 'api_keys' }) as any
    const has = (k: string) => !!doc?.data?.[k]
    res.json({
      status: {
        OPENAI: has('OPENAI'),
        ANTHROPIC: has('ANTHROPIC'),
        GOOGLE_VISION: has('GOOGLE_VISION'),
        OPENCAGE: has('OPENCAGE'),
        MAPBOX: has('MAPBOX'),
        GOOGLE_MAPS: has('GOOGLE_MAPS')
      },
      updated_at: doc?.updated_at || null
    })
  } catch (err) {
    res.status(500).json({ detail: `Error retrieving API keys status: ${String(err)}` })
  }
})

router.post('/integracoes/apis', async (req: Request, res: Response) => {
  try {
    const adminToken = req.header('x-admin-token') || ''
    const required = process.env.ADMIN_TOKEN || ''
    if (required && adminToken !== required) {
      return res.status(401).json({ detail: 'Unauthorized' })
    }

    const payload = (req.body || {}) as Record<string, string>
    const keys = ['OPENAI','ANTHROPIC','GOOGLE_VISION','OPENCAGE','MAPBOX','GOOGLE_MAPS'] as const
    const data: Record<string, string> = {}
    keys.forEach(k => { if (payload[k]) data[k] = encrypt(String(payload[k])) })

    const db = getDatabase()
    await db.collection('settings').updateOne(
      { type: 'api_keys' },
      { $set: { type: 'api_keys', data, updated_at: new Date() } },
      { upsert: true }
    )

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ detail: `Error saving API keys: ${String(err)}` })
  }
})

export default router
