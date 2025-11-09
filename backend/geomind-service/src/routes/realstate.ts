import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../database.js';
import { RealEstateDoc } from '../types/realstate.js';

const router = express.Router();

function toResponse(doc: RealEstateDoc) {
  return {
    _id: (doc._id as any)?.toString?.() || doc.id,
    nome: doc.nome,
    cliente_id: (doc.cliente_id as any)?.toString?.() || doc.cliente_id,
    tipo_imovel: doc.tipo_imovel,
    endereco_imovel: doc.endereco_imovel,
    cidade_imovel: doc.cidade_imovel,
    estado_imovel: doc.estado_imovel,
    cep_imovel: doc.cep_imovel,
    area_terreno: doc.area_terreno,
    area_construida: doc.area_construida,
    finalidade_avaliacao: doc.finalidade_avaliacao,
    prazo_entrega: doc.prazo_entrega,
    observacoes: doc.observacoes ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? null,
  };
}

// POST /api/v1/realstate
router.post('/realstate', async (req: Request, res: Response) => {
  try {
    const payload = (req.body || {}) as Partial<RealEstateDoc>;

    if (!payload.cliente_id || !ObjectId.isValid(String(payload.cliente_id))) {
      return res.status(400).json({ detail: 'Invalid cliente ID format' });
    }

    const db = getDatabase();
    const cliente = await db.collection('clientes').findOne({ _id: new ObjectId(String(payload.cliente_id)) });
    if (!cliente) {
      return res.status(404).json({ detail: 'Cliente not found' });
    }

    const now = new Date();
    const realstateData: RealEstateDoc = {
      nome: String(payload.nome),
      cliente_id: new ObjectId(String(payload.cliente_id)),
      tipo_imovel: String(payload.tipo_imovel),
      endereco_imovel: String(payload.endereco_imovel),
      cidade_imovel: String(payload.cidade_imovel),
      estado_imovel: String(payload.estado_imovel),
      cep_imovel: String(payload.cep_imovel),
      area_terreno: Number(payload.area_terreno),
      area_construida: Number(payload.area_construida),
      finalidade_avaliacao: String(payload.finalidade_avaliacao),
      prazo_entrega: String(payload.prazo_entrega),
      observacoes: payload.observacoes ?? null,
      created_at: now,
      updated_at: null,
    };

    const result = await db.collection('real_estates').insertOne(realstateData as any);
    const created = await db.collection('real_estates').findOne({ _id: result.insertedId });
    res.status(201).json(toResponse(created as any));
  } catch (err) {
    console.error('Error creating realstate:', err);
    res.status(500).json({ detail: `Error creating realstate: ${String(err)}` });
  }
});

// GET /api/v1/realstate/:id
router.get('/realstate/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'Invalid realstate ID format' });
    }
    const db = getDatabase();
    const doc = await db.collection('real_estates').findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ detail: 'Real estate property not found' });
    res.json(toResponse(doc as any));
  } catch (err) {
    console.error('Error retrieving realstate:', err);
    res.status(500).json({ detail: `Error retrieving realstate: ${String(err)}` });
  }
});

// GET /api/v1/realstate?skip=&limit=
router.get('/realstate', async (req: Request, res: Response) => {
  try {
    const skip = Number(req.query.skip ?? 0);
    const limit = Number(req.query.limit ?? 100);
    const db = getDatabase();
    const cursor = db.collection('real_estates').find({}).skip(skip).limit(limit);
    const docs = await cursor.toArray();
    res.json(docs.map((d) => toResponse(d as any)));
  } catch (err) {
    console.error('Error listing realstates:', err);
    res.status(500).json({ detail: `Error listing realstates: ${String(err)}` });
  }
});

export default router;