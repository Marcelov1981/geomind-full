import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../database.js';
import { analyzeProperty } from '../services/analysis.js';

const router = express.Router();

// POST /api/v1/analysis
router.post('/analysis', async (req: Request, res: Response) => {
  try {
    const realEstateId = String((req.body || {}).real_estate_id || '');
    if (!ObjectId.isValid(realEstateId)) {
      return res.status(400).json({ detail: 'Invalid real estate ID format' });
    }

    const db = getDatabase();
    const exists = await db.collection('real_estates').findOne({ _id: new ObjectId(realEstateId) });
    if (!exists) return res.status(404).json({ detail: 'Real estate property not found' });

    const similar = await db.collection('similar_properties').find({ real_estate_id: realEstateId }).toArray();
    if (!similar.length) {
      return res.status(400).json({ detail: 'No similar properties found. Please run a search first.' });
    }

    const existing = await db.collection('analyses').findOne({ real_estate_id: realEstateId });
    if (existing) {
      return res.json(existing);
    }

    const analysis = await analyzeProperty(db, realEstateId);
    // Shape response to match Python response model naming
    const response = {
      _id: (analysis._id as any)?.toString?.() || analysis.id,
      real_estate_id: analysis.real_estate_id,
      price_comparison: analysis.price_comparison,
      area_price_ratio: analysis.area_price_ratio,
      market_position: analysis.market_position,
      recommendation: analysis.recommendation,
      analysis_date: analysis.analysis_date,
      report_path: analysis.report_path ?? null,
    };
    res.json(response);
  } catch (err) {
    console.error('Error analyzing property:', err);
    res.status(500).json({ detail: String(err) });
  }
});

// GET /api/v1/analysis/:id
router.get('/analysis/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'Invalid analysis ID format' });
    }
    const db = getDatabase();
    const doc = await db.collection('analyses').findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ detail: 'Analysis not found' });
    res.json(doc);
  } catch (err) {
    console.error('Error retrieving analysis:', err);
    res.status(500).json({ detail: String(err) });
  }
});

// GET /api/v1/analysis/property/:real_estate_id
router.get('/analysis/property/:real_estate_id', async (req: Request, res: Response) => {
  try {
    const { real_estate_id } = req.params;
    if (!ObjectId.isValid(real_estate_id)) {
      return res.status(400).json({ detail: 'Invalid real estate ID format' });
    }
    const db = getDatabase();
    const doc = await db.collection('analyses').findOne({ real_estate_id });
    if (!doc) return res.status(404).json({ detail: 'Analysis not found for this property. Please create an analysis first.' });
    res.json(doc);
  } catch (err) {
    console.error('Error retrieving analysis by property:', err);
    res.status(500).json({ detail: String(err) });
  }
});

export default router;