import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../database.js';
import { searchSimilarProperties, saveSimilarProperties } from '../services/scraper.js';
import { RealEstateDoc } from '../types/realstate.js';

const router = express.Router();

// POST /api/v1/search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const realEstateId = String((req.body || {}).real_estate_id || '');
    if (!ObjectId.isValid(realEstateId)) {
      return res.status(400).json({ detail: 'Invalid real estate ID format' });
    }
    const db = getDatabase();
    const real = (await db.collection('real_estates').findOne({ _id: new ObjectId(realEstateId) })) as RealEstateDoc | null;
    if (!real) return res.status(404).json({ detail: 'Real estate property not found' });

    const existing = await db.collection('similar_properties').find({ real_estate_id: realEstateId }).toArray();
    if (existing.length) {
      return res.json({ real_estate: real, similar_properties: existing });
    }

    const similar = await searchSimilarProperties(real, 10);
    // Fire-and-forget save (no BackgroundTasks in Express). Intentionally not awaiting to keep response quick.
    saveSimilarProperties(db, realEstateId, similar).catch((e) => console.error('Error saving similar properties:', e));

    const response = {
      real_estate: real,
      similar_properties: similar.map((prop) => ({
        real_estate_id: realEstateId,
        tipo: prop.tipo ?? '',
        endereco: prop.endereco ?? '',
        bairro: prop.bairro ?? '',
        cidade: prop.cidade ?? '',
        area: prop.area ?? 0,
        numero_quartos: prop.numero_quartos ?? 0,
        banheiros: prop.banheiros ?? 0,
        vagas: prop.vagas ?? 0,
        valor: prop.valor ?? 0,
        url: prop.url ?? '',
      })),
    };
    res.json(response);
  } catch (err) {
    console.error('Error searching similar properties:', err);
    res.status(500).json({ detail: String(err) });
  }
});

// GET /api/v1/search/:real_estate_id
router.get('/search/:real_estate_id', async (req: Request, res: Response) => {
  try {
    const { real_estate_id } = req.params;
    if (!ObjectId.isValid(real_estate_id)) {
      return res.status(400).json({ detail: 'Invalid real estate ID format' });
    }
    const db = getDatabase();
    const real = await db.collection('real_estates').findOne({ _id: new ObjectId(real_estate_id) });
    if (!real) return res.status(404).json({ detail: 'Real estate property not found' });
    const similar = await db.collection('similar_properties').find({ real_estate_id }).toArray();
    res.json({ real_estate: real, similar_properties: similar });
  } catch (err) {
    console.error('Error retrieving similar properties:', err);
    res.status(500).json({ detail: String(err) });
  }
});

export default router;