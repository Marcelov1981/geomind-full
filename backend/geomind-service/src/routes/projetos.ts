import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../database.js';

const router = express.Router();

export interface ProjetoDoc {
  _id?: unknown;
  id?: string;
  nome: string;
  descricao?: string | null;
  cliente_id?: ObjectId | string | null;
  status: string;
  created_at: Date;
  updated_at?: Date | null;
}

function toResponse(doc: ProjetoDoc) {
  return {
    _id: (doc._id as any)?.toString?.() || (doc as any).id,
    nome: doc.nome,
    descricao: doc.descricao ?? null,
    cliente_id: ((doc.cliente_id as any)?.toString?.() || (doc as any).cliente_id) ?? null,
    status: doc.status,
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? null,
  };
}

router.post('/projetos', async (req: Request, res: Response) => {
  try {
    const payload = (req.body || {}) as Partial<ProjetoDoc>;

    const required = ['nome', 'status'] as const;
    for (const field of required) {
      if (!payload[field]) {
        return res.status(422).json({ detail: `Missing required field: ${field}` });
      }
    }

    const db = getDatabase();

    let clienteRef: ObjectId | null = null;
    if (payload.cliente_id) {
      const cid = String(payload.cliente_id);
      if (!ObjectId.isValid(cid)) {
        return res.status(400).json({ detail: 'Invalid cliente ID format' });
      }
      const exists = await db.collection('clientes').findOne({ _id: new ObjectId(cid) });
      if (!exists) {
        return res.status(404).json({ detail: 'Cliente not found' });
      }
      clienteRef = new ObjectId(cid);
    }

    const now = new Date();
    const doc: ProjetoDoc = {
      nome: String(payload.nome),
      descricao: payload.descricao ?? null,
      cliente_id: clienteRef,
      status: String(payload.status),
      created_at: now,
      updated_at: null,
    } as any;

    const result = await db.collection('projetos').insertOne(doc as any);
    const created = await db.collection('projetos').findOne({ _id: result.insertedId });
    res.status(201).json(toResponse(created as any));
  } catch (err) {
    console.error('Error creating projeto:', err);
    res.status(500).json({ detail: `Error creating projeto: ${String(err)}` });
  }
});

router.get('/projetos/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'Invalid projeto ID format' });
    }
    const db = getDatabase();
    const doc = await db.collection('projetos').findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ detail: 'Projeto not found' });
    res.json(toResponse(doc as any));
  } catch (err) {
    console.error('Error retrieving projeto:', err);
    res.status(500).json({ detail: `Error retrieving projeto: ${String(err)}` });
  }
});

router.get('/projetos', async (req: Request, res: Response) => {
  try {
    const skip = Number(req.query.skip ?? 0);
    const limit = Number(req.query.limit ?? 100);
    const db = getDatabase();
    const cursor = db.collection('projetos').find({}).skip(skip).limit(limit);
    const docs = await cursor.toArray();
    res.json(docs.map((d) => toResponse(d as any)));
  } catch (err) {
    console.error('Error listing projetos:', err);
    res.status(500).json({ detail: `Error listing projetos: ${String(err)}` });
  }
});

export default router;