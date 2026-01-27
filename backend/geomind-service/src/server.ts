import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToMongo } from './database.js';
import clientesRouter from './routes/clientes.js';
import realstateRouter from './routes/realstate.js';
import analysisRouter from './routes/analysis.js';
import searchRouter from './routes/search.js';
import reportRouter from './routes/report.js';
import authRouter from './routes/auth.js';
import projetosRouter from './routes/projetos.js';
import orcamentoRouter from './routes/orcamento.js';
import avaliacoesRouter from './routes/avaliacoes.js';
import integracoesRouter from './routes/integracoes.js';

dotenv.config();

const app = express();
const PORT: number = Number(process.env.PORT) || 8003;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1', clientesRouter);
app.use('/api/v1', realstateRouter);
app.use('/api/v1', analysisRouter);
app.use('/api/v1', searchRouter);
app.use('/api/v1', reportRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', projetosRouter);
app.use('/api/v1', orcamentoRouter);
app.use('/api/v1', avaliacoesRouter);
app.use('/api/v1', integracoesRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Real Estate Audit Service API (Node.js, TS)' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server after DB is connected
(async () => {
  try {
    await connectToMongo();
    app.listen(PORT, () => {
      console.log(`🚀 Node TS server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
