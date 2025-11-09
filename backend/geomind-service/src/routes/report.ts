import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../database.js';
import { generateReport } from '../services/report.js';

const router = express.Router();

// POST /api/v1/report
router.post('/report', async (req: Request, res: Response) => {
  try {
    const analysisId = String((req.body || {}).analysis_id || '');
    const format = String((req.body || {}).format || 'pdf').toLowerCase() as 'pdf' | 'xls';
    if (!ObjectId.isValid(analysisId)) {
      return res.status(400).json({ detail: 'Invalid analysis ID format' });
    }
    const db = getDatabase();

    const analysis = await db.collection('analyses').findOne({ _id: new ObjectId(analysisId) });
    if (!analysis) return res.status(404).json({ detail: 'Analysis not found' });

    // If report exists, return it
    if (analysis.report_path && fs.existsSync(analysis.report_path)) {
      const downloadUrl = `/api/v1/report/download/${path.basename(analysis.report_path)}`;
      return res.json({ analysis_id: analysisId, report_path: analysis.report_path, download_url: downloadUrl });
    }

    const info = await generateReport(db, analysisId, format);
    res.json(info);
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ detail: String(err) });
  }
});

// GET /api/v1/report/download/:filename
router.get('/report/download/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.resolve('reports', filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ detail: 'Report file not found' });
    res.download(filePath);
  } catch (err) {
    console.error('Error downloading report:', err);
    res.status(500).json({ detail: String(err) });
  }
});

export default router;