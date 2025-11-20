import express, { Request, Response } from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

export interface ClienteDoc {
  _id?: unknown;
  id?: string;
  nome: string;
  email: string;
  telefone?: string | null;
  status: string;
  tipo_pessoa?: string;
  documento?: string | null;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  tipo_registro?: string | null;
  registro_profissional?: string | null;
  observacoes?: string | null;
}

function toResponse(doc: ClienteDoc) {
  return {
    id: (doc._id as any)?.toString?.() || doc.id,
    nome: doc.nome,
    email: doc.email,
    telefone: doc.telefone ?? null,
    status: doc.status,
    tipo_pessoa: doc.tipo_pessoa ?? '',
    documento: doc.documento ?? null,
    endereco: doc.endereco ?? '',
    cidade: doc.cidade ?? '',
    estado: doc.estado ?? '',
    cep: doc.cep ?? '',
    tipo_registro: doc.tipo_registro ?? null,
    registro_profissional: doc.registro_profissional ?? null,
    observacoes: doc.observacoes ?? null,
  };
}

// GET /api/v1/clientes
router.get('/clientes', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const clientes = (await db.collection('clientes').find({}).toArray()) as ClienteDoc[];
    res.json(clientes.map(toResponse));
  } catch (err) {
    console.error('Error retrieving clients:', err);
    res.status(500).json({ detail: `Error retrieving clients: ${String(err)}` });
  }
});

// POST /api/v1/clientes
router.post('/clientes', async (req: Request, res: Response) => {
  try {
    const payload = (req.body || {}) as Partial<ClienteDoc>;

    // Basic required fields check (mirrors Python schema expectations)
    const required = ['nome', 'email', 'status', 'tipo_pessoa', 'endereco', 'cidade', 'estado', 'cep'] as const;
    for (const field of required) {
      if (!payload[field]) {
        return res.status(422).json({ detail: `Missing required field: ${field}` });
      }
    }

    const doc: ClienteDoc = {
      nome: String(payload.nome),
      email: String(payload.email),
      telefone: payload.telefone ?? null,
      status: String(payload.status),
      tipo_pessoa: String(payload.tipo_pessoa),
      documento: payload.documento ?? null,
      endereco: String(payload.endereco),
      cidade: String(payload.cidade),
      estado: String(payload.estado),
      cep: String(payload.cep),
      tipo_registro: payload.tipo_registro ?? null,
      registro_profissional: payload.registro_profissional ?? null,
      observacoes: payload.observacoes ?? null,
    };

    const db = getDatabase();
    const result = await db.collection('clientes').insertOne(doc as any);

    const created: ClienteDoc = { ...doc, id: (result.insertedId as any).toString() };
    res.status(201).json(toResponse(created));
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ detail: `Error creating client: ${String(err)}` });
  }
});

router.get('/clientes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'Invalid cliente ID format' });
    }
    const db = getDatabase();
    const doc = (await db.collection('clientes').findOne({ _id: new ObjectId(id) })) as ClienteDoc | null;
    if (!doc) return res.status(404).json({ detail: 'Cliente not found' });
    res.json(toResponse(doc));
  } catch (err) {
    console.error('Error retrieving cliente by id:', err);
    res.status(500).json({ detail: `Error retrieving cliente by id: ${String(err)}` });
  }
});

export default router;