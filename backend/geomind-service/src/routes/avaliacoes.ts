import express, { Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../database.js'

const router = express.Router()

export interface AvaliacaoDoc {
  _id?: unknown
  id?: string
  metodologia_utilizada: string
  valor_final: number
  observacoes?: string | null
  status: string
  data_avaliacao: string
  orcamento_id: ObjectId | string
  projeto_id: ObjectId | string
  cliente_id: ObjectId | string
  detalhes_analise?: any
  created_at: Date
  updated_at?: Date | null
}

function toResponse(doc: AvaliacaoDoc) {
  return {
    id: (doc._id as any)?.toString?.() || (doc as any).id,
    metodologia_utilizada: doc.metodologia_utilizada,
    valor_final: doc.valor_final,
    observacoes: doc.observacoes ?? null,
    status: doc.status,
    data_avaliacao: doc.data_avaliacao,
    orcamento_id: ((doc.orcamento_id as any)?.toString?.() || (doc as any).orcamento_id) ?? null,
    projeto_id: ((doc.projeto_id as any)?.toString?.() || (doc as any).projeto_id) ?? null,
    cliente_id: ((doc.cliente_id as any)?.toString?.() || (doc as any).cliente_id) ?? null,
    detalhes_analise: doc.detalhes_analise ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at ?? null,
  }
}

router.post('/avaliacoes', async (req: Request, res: Response) => {
  try {
    const payload = (req.body || {}) as Partial<AvaliacaoDoc>

    const required = ['metodologia_utilizada', 'valor_final', 'status', 'data_avaliacao', 'orcamento_id', 'projeto_id', 'cliente_id'] as const
    for (const field of required) {
      if (payload[field] == null || payload[field] === '') {
        return res.status(422).json({ detail: `Missing required field: ${field}` })
      }
    }

    const db = getDatabase()

    const oid = String(payload.orcamento_id)
    const pid = String(payload.projeto_id)
    const cid = String(payload.cliente_id)

    if (!ObjectId.isValid(oid) || !ObjectId.isValid(pid) || !ObjectId.isValid(cid)) {
      return res.status(400).json({ detail: 'Invalid ID format for orcamento_id, projeto_id or cliente_id' })
    }

    const orcamentoExists = await db.collection('orcamentos').findOne({ _id: new ObjectId(oid) })
    if (!orcamentoExists) return res.status(404).json({ detail: 'Orcamento not found' })
    const projetoExists = await db.collection('projetos').findOne({ _id: new ObjectId(pid) })
    if (!projetoExists) return res.status(404).json({ detail: 'Projeto not found' })
    const clienteExists = await db.collection('clientes').findOne({ _id: new ObjectId(cid) })
    if (!clienteExists) return res.status(404).json({ detail: 'Cliente not found' })

    const now = new Date()
    const doc: AvaliacaoDoc = {
      metodologia_utilizada: String(payload.metodologia_utilizada),
      valor_final: Number(payload.valor_final),
      observacoes: payload.observacoes ?? null,
      status: String(payload.status),
      data_avaliacao: String(payload.data_avaliacao),
      orcamento_id: new ObjectId(oid),
      projeto_id: new ObjectId(pid),
      cliente_id: new ObjectId(cid),
      detalhes_analise: payload.detalhes_analise ?? null,
      created_at: now,
      updated_at: null,
    } as any

    const result = await db.collection('avaliacoes').insertOne(doc as any)
    const created = await db.collection('avaliacoes').findOne({ _id: result.insertedId })
    res.status(201).json(toResponse(created as any))
  } catch (err) {
    res.status(500).json({ detail: `Error creating avaliacao: ${String(err)}` })
  }
})

router.get('/avaliacoes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'Invalid avaliacao ID format' })
    }
    const db = getDatabase()
    const doc = await db.collection('avaliacoes').findOne({ _id: new ObjectId(id) })
    if (!doc) return res.status(404).json({ detail: 'Avaliacao not found' })
    res.json(toResponse(doc as any))
  } catch (err) {
    res.status(500).json({ detail: `Error retrieving avaliacao: ${String(err)}` })
  }
})

router.get('/avaliacoes', async (req: Request, res: Response) => {
  try {
    const skip = Number(req.query.skip ?? 0)
    const limit = Number(req.query.limit ?? 100)
    const db = getDatabase()
    const cursor = db.collection('avaliacoes').find({}).skip(skip).limit(limit)
    const docs = await cursor.toArray()
    res.json(docs.map((d) => toResponse(d as any)))
  } catch (err) {
    res.status(500).json({ detail: `Error listing avaliacao: ${String(err)}` })
  }
})

export default router
