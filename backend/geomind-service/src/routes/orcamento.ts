import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../database.js';

const router = express.Router();

export interface OrcamentoDoc {
  _id?: unknown;
  id?: string;
  projetoId: ObjectId | string;
  descricao?: string;
  tipoAvaliacao?: string;
  valorEstimado?: number;
  prazoEntrega?: string;
  metodologia?: string;
  observacoes?: string;
  created_at: Date;
  updated_at?: Date | null;
}

function toResponse(doc: OrcamentoDoc) {
  return {
    _id: (doc._id as any)?.toString?.() || (doc as any).id,
    projetoId: ((doc.projetoId as any)?.toString?.() || (doc as any).projetoId) ?? null,
    descricao: doc.descricao ?? '',
    tipoAvaliacao: doc.tipoAvaliacao ?? '',
    valorEstimado: doc.valorEstimado ?? 0,
    prazoEntrega: doc.prazoEntrega ?? '',
    metodologia: doc.metodologia ?? '',
    observacoes: doc.observacoes ?? '',
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? null,
  };
}

router.post('/orcamentos', async (req: Request, res: Response) => {
  try {
    const payload = (req.body || {}) as Partial<OrcamentoDoc>;

    const projetoId = String(payload.projetoId || '');
    if (!projetoId) {
      return res.status(422).json({ detail: 'Missing required field: projetoId' });
    }
    if (!ObjectId.isValid(projetoId)) {
      return res.status(400).json({ detail: 'Invalid projetoId format' });
    }

    const db = getDatabase();
    const projectExists = await db.collection('projetos').findOne({ _id: new ObjectId(projetoId) });
    if (!projectExists) {
      return res.status(404).json({ detail: 'Projeto not found' });
    }

    const now = new Date();
    const doc: OrcamentoDoc = {
      projetoId: new ObjectId(projetoId),
      descricao: String(payload.descricao ?? ''),
      tipoAvaliacao: String(payload.tipoAvaliacao ?? ''),
      valorEstimado: payload.valorEstimado != null ? Number(payload.valorEstimado) : 0,
      prazoEntrega: String(payload.prazoEntrega ?? ''),
      metodologia: String(payload.metodologia ?? ''),
      observacoes: String(payload.observacoes ?? ''),
      created_at: now,
      updated_at: null,
    } as any;

    const result = await db.collection('orcamentos').insertOne(doc as any);
    const created = await db.collection('orcamentos').findOne({ _id: result.insertedId });
    res.status(201).json(toResponse(created as any));
  } catch (err) {
    res.status(500).json({ detail: `Error creating orcamento: ${String(err)}` });
  }
});

router.get('/orcamentos/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'Invalid orcamento ID format' });
    }
    const db = getDatabase();
    const doc = await db.collection('orcamentos').findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ detail: 'Orcamento not found' });
    res.json(toResponse(doc as any));
  } catch (err) {
    res.status(500).json({ detail: `Error retrieving orcamento: ${String(err)}` });
  }
});

router.get('/orcamentos', async (req: Request, res: Response) => {
  try {
    const skip = Number(req.query.skip ?? 0);
    const limit = Number(req.query.limit ?? 100);
    const projetoId = req.query.projetoId ? String(req.query.projetoId) : '';
    const db = getDatabase();

    const query: any = {};
    if (projetoId && ObjectId.isValid(projetoId)) {
      query.projetoId = new ObjectId(projetoId);
    }

    const cursor = db.collection('orcamentos').find(query).skip(skip).limit(limit);
    const docs = await cursor.toArray();
    res.json(docs.map((d) => toResponse(d as any)));
  } catch (err) {
    res.status(500).json({ detail: `Error listing orcamentos: ${String(err)}` });
  }
});

export default router;