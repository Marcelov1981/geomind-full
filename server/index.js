import process from 'node:process';
import { Buffer } from 'node:buffer';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { z } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';
import ExcelJS from 'exceljs';
import { db, closeDatabase, databaseInfo } from './db.js';
import { up } from './migrations/001_initial.js';
import { up as migrateBilling } from './migrations/002_billing.js';
import { up as migrateSync } from './migrations/003_sync.js';
import { up as migrateBackups } from './migrations/004_backups.js';
import { up as migrateSyncInbox } from './migrations/005_sync_inbox.js';
import { up as migrateAiRequests } from './migrations/006_ai_requests.js';
import { up as migrateLaudoImports } from './migrations/007_laudo_imports.js';
import { authenticate, clearSessionCookie, comparePassword, hashPassword, issueSession, requireRoles } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const PORT = Number(process.env.PORT || 3001);
const MAX_PAGE_SIZE = 100;
const storageDir = process.env.STORAGE_DIR || path.resolve(__dirname, '..', 'storage');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const metrics = { requests: 0, errors: 0, byStatus: new Map() };

await up(db);
await migrateBilling(db);
await migrateSync(db);
await migrateBackups(db);
await migrateSyncInbox(db);
await migrateAiRequests(db);
await migrateLaudoImports(db);
await fs.mkdir(storageDir, { recursive: true });

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não autorizada pelo CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const started = Date.now();
  metrics.requests += 1;
  res.on('finish', () => {
    const status = String(res.statusCode);
    metrics.byStatus.set(status, Number(metrics.byStatus.get(status) || 0) + 1);
    if (res.statusCode >= 500) metrics.errors += 1;
    console.log(JSON.stringify({ event: 'http.request', request_id: req.requestId, method: req.method, path: req.path, status: res.statusCode, duration_ms: Date.now() - started }));
  });
  next();
});
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: Number(process.env.API_RATE_LIMIT || 300), standardHeaders: true, legacyHeaders: false }));
app.get('/metrics', (req, res) => {
  if (process.env.METRICS_TOKEN && req.get('x-metrics-token') !== process.env.METRICS_TOKEN) return res.status(401).send('unauthorized\n');
  const statuses = [...metrics.byStatus.entries()].map(([status, count]) => `geomind_http_responses_total{status="${status}"} ${count}`).join('\n');
  res.type('text/plain').send(`# HELP geomind_http_requests_total Total de requisições HTTP.\n# TYPE geomind_http_requests_total counter\ngeomind_http_requests_total ${metrics.requests}\n# HELP geomind_http_errors_total Total de erros HTTP 5xx.\n# TYPE geomind_http_errors_total counter\ngeomind_http_errors_total ${metrics.errors}\n${statuses}\n`);
});

const jsonFields = new Set(['assumptions', 'results', 'content', 'metadata', 'output', 'request', 'response', 'payload']);
const jsonFromDb = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};
const serialize = (payload) => Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, jsonFields.has(key) && value !== undefined && value !== null ? JSON.stringify(value) : value]));
const hydrate = (row) => {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonFields.has(key) ? jsonFromDb(value) : value]));
};
const normalizeLegacyPayload = (entity, payload = {}) => {
  const input = { ...payload };
  if (entity === 'client') Object.assign(input, { name: input.name ?? input.nome, document: input.document ?? input.cpf ?? input.cnpj, phone: input.phone ?? input.telefone });
  if (entity === 'project') Object.assign(input, { name: input.name ?? input.nome, client_id: input.client_id ?? input.cliente_id, address: input.address ?? input.endereco_imovel ?? input.endereco, city: input.city ?? input.cidade_imovel ?? input.cidade, state: input.state ?? input.estado_imovel ?? input.estado, postal_code: input.postal_code ?? input.cep_imovel ?? input.cep, purpose: input.purpose ?? input.finalidade_avaliacao, latitude: input.latitude ?? input.coordsLat, longitude: input.longitude ?? input.coordsLng });
  if (entity === 'budget') Object.assign(input, { project_id: input.project_id ?? input.projeto_id, amount: input.amount ?? input.valor });
  if (entity === 'evaluation') Object.assign(input, { project_id: input.project_id ?? input.projeto_id, estimated_value: input.estimated_value ?? input.valor_estimado });
  if (entity === 'report') Object.assign(input, { project_id: input.project_id ?? input.projeto_id, evaluation_id: input.evaluation_id ?? input.avaliacao_id, number: input.number ?? input.numero, title: input.title ?? input.titulo, content: input.content ?? input.conteudo });
  return input;
};
const present = (entity, row) => {
  const value = hydrate(row);
  if (!value) return value;
  if (entity === 'client') return { ...value, nome: value.name, status: value.active === false ? 'inativo' : 'ativo' };
  if (entity === 'project') return { ...value, nome: value.name, cliente_id: value.client_id, endereco_imovel: value.address, cidade_imovel: value.city, estado_imovel: value.state, cep_imovel: value.postal_code, finalidade_avaliacao: value.purpose };
  if (entity === 'budget') return { ...value, valor: value.amount, projeto_id: value.project_id };
  if (entity === 'evaluation') return { ...value, valor_estimado: value.estimated_value, projeto_id: value.project_id };
  if (entity === 'report') return { ...value, numero: value.number, titulo: value.title, projeto_id: value.project_id, avaliacao_id: value.evaluation_id };
  return value;
};
const now = () => new Date().toISOString();
const safeUser = (user) => ({ id: user.id, organization_id: user.organization_id, name: user.name, email: user.email, role: user.role, active: Boolean(user.active) });
const numericId = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

async function audit(req, action, entityType, entityId, metadata = {}) {
  await db('audit_logs').insert({
    organization_id: req.user?.organizationId || null,
    user_id: req.user?.id || null,
    action,
    entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
    metadata: JSON.stringify(metadata),
    created_at: now(),
  });
}

async function enqueueSync(req, entityType, entityId, operation, payload) {
  if (!req.user?.organizationId) return;
  const eventId = crypto.randomUUID();
  await db('sync_outbox').insert({
    organization_id: req.user.organizationId,
    event_id: eventId,
    entity_type: entityType,
    entity_id: String(entityId),
    operation,
    payload: JSON.stringify(payload),
    status: 'pending',
    attempts: 0,
    available_at: now(),
    created_at: now(),
  });
}

function validationError(error) {
  if (!(error instanceof z.ZodError)) return null;
  return { error: 'Dados inválidos.', details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) };
}

async function getOwned(table, id, organizationId) {
  return db(table).where({ id, organization_id: organizationId }).first();
}

const resourceDefinitions = [
  {
    path: 'clientes', table: 'clients', entity: 'client', searchField: 'name',
    schema: z.object({ name: z.string().trim().min(2).max(180), document: z.string().trim().max(40).optional().nullable(), email: z.string().trim().email().max(255).optional().nullable(), phone: z.string().trim().max(40).optional().nullable(), notes: z.string().max(5000).optional().nullable() }),
  },
  {
    path: 'projetos', table: 'projects', entity: 'project', searchField: 'name',
    schema: z.object({ client_id: z.number().int().positive().optional().nullable(), name: z.string().trim().min(2).max(180), status: z.enum(['draft', 'in_progress', 'review', 'completed', 'archived']).optional(), purpose: z.string().trim().max(120).optional().nullable(), address: z.string().trim().max(255).optional().nullable(), city: z.string().trim().max(120).optional().nullable(), state: z.string().trim().max(80).optional().nullable(), postal_code: z.string().trim().max(20).optional().nullable(), latitude: z.number().min(-90).max(90).optional().nullable(), longitude: z.number().min(-180).max(180).optional().nullable(), notes: z.string().max(5000).optional().nullable() }),
  },
  {
    path: 'orcamentos', table: 'budgets', entity: 'budget', searchField: null,
    schema: z.object({ project_id: z.number().int().positive(), amount: z.number().nonnegative(), status: z.enum(['draft', 'sent', 'approved', 'rejected', 'expired']).optional(), notes: z.string().max(5000).optional().nullable() }),
  },
  {
    path: 'avaliacoes', table: 'evaluations', entity: 'evaluation', searchField: null,
    schema: z.object({ project_id: z.number().int().positive(), type: z.string().trim().max(80).optional(), status: z.enum(['draft', 'in_progress', 'review', 'completed', 'archived']).optional(), estimated_value: z.number().nonnegative().optional().nullable(), assumptions: z.record(z.string(), z.unknown()).optional().nullable(), results: z.record(z.string(), z.unknown()).optional().nullable() }),
  },
  {
    path: 'laudos', table: 'reports', entity: 'report', searchField: 'title',
    schema: z.object({ project_id: z.number().int().positive(), evaluation_id: z.number().int().positive().optional().nullable(), number: z.string().trim().min(1).max(80), title: z.string().trim().min(2).max(255), status: z.enum(['draft', 'review', 'approved', 'archived']).optional(), template_version: z.string().trim().max(80).optional(), content: z.record(z.string(), z.unknown()).optional().nullable(), approved_by: z.number().int().positive().optional().nullable(), approved_at: z.string().max(40).optional().nullable() }),
  },
];

app.get('/health', async (_req, res) => {
  try {
    await db.raw(databaseInfo.driver === 'postgresql' ? 'select 1' : 'select 1 as ok');
    res.json({ status: 'ok', service: 'geomind-api', database: databaseInfo.driver, time: now() });
  } catch (error) {
    res.status(503).json({ status: 'error', service: 'geomind-api', error: error.message });
  }
});
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'geomind-api', database: databaseInfo.driver, time: now() }));

const registerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  organization_name: z.string().trim().min(2).max(160).optional(),
});

app.post('/api/v1/usuarios/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const organizationName = input.organization_name || `${input.name} — Organização`;
    const result = await db.transaction(async (trx) => {
      const slugBase = organizationName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'geomind';
      const slug = `${slugBase}-${crypto.randomBytes(3).toString('hex')}`;
      const [organizationId] = await trx('organizations').insert({ name: organizationName, slug, plan: 'trial', created_at: now(), updated_at: now() });
      const password_hash = await hashPassword(input.password);
      const [userId] = await trx('users').insert({ organization_id: organizationId, name: input.name, email, password_hash, role: 'owner', active: true, created_at: now(), updated_at: now() });
      return trx('users').where({ id: userId }).first();
    });
    const token = issueSession(res, result);
    await audit({ user: { id: result.id, organizationId: result.organization_id } }, 'user.registered', 'user', result.id, { organization_id: result.organization_id });
    res.status(201).json({ user: safeUser(result), token });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT' || error?.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
    next(error);
  }
});

app.post('/api/v1/usuarios/login', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await db('users').whereRaw('LOWER(email) = ?', [input.email.toLowerCase()]).first();
    if (!user || !user.active || !(await comparePassword(input.password, user.password_hash))) return res.status(401).json({ error: 'Credenciais inválidas.' });
    await db('users').where({ id: user.id }).update({ last_login_at: now(), updated_at: now() });
    const token = issueSession(res, user);
    await audit({ user: { id: user.id, organizationId: user.organization_id } }, 'user.logged_in', 'user', user.id);
    res.json({ user: safeUser(user), token });
  } catch (error) {
    const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
    next(error);
  }
});

app.post('/api/v1/usuarios/logout', authenticate, async (req, res, next) => {
  try { clearSessionCookie(res); await audit(req, 'user.logged_out', 'user', req.user.id); res.status(204).end(); } catch (error) { next(error); }
});
app.get('/api/v1/usuarios/perfil', authenticate, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id, organization_id: req.user.organizationId }).first();
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ user: safeUser(user) });
  } catch (error) { next(error); }
});

app.patch('/api/v1/usuarios/perfil', authenticate, async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(255) }).parse(req.body);
    const email = input.email.toLowerCase();
    const duplicate = await db('users').where({ organization_id: req.user.organizationId, email }).whereRaw('id <> ?', [req.user.id]).first();
    if (duplicate) return res.status(409).json({ error: 'Este email já está em uso nesta organização.' });
    await db('users').where({ id: req.user.id, organization_id: req.user.organizationId }).update({ name: input.name, email, updated_at: now() });
    const user = await db('users').where({ id: req.user.id, organization_id: req.user.organizationId }).first();
    await audit(req, 'user.profile_updated', 'user', req.user.id, { fields: ['name', 'email'] });
    res.json({ user: safeUser(user) });
  } catch (error) {
    const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
    next(error);
  }
});

app.get('/api/v1/dashboard', authenticate, async (req, res, next) => {
  try {
    const [clients, projects, budgets, evaluations, reports] = await Promise.all([
      db('clients').where({ organization_id: req.user.organizationId }).count({ count: '*' }).first(),
      db('projects').where({ organization_id: req.user.organizationId }).count({ count: '*' }).first(),
      db('budgets').where({ organization_id: req.user.organizationId }).count({ count: '*' }).first(),
      db('evaluations').where({ organization_id: req.user.organizationId }).count({ count: '*' }).first(),
      db('reports').where({ organization_id: req.user.organizationId }).count({ count: '*' }).first(),
    ]);
    res.json({ clients: Number(clients?.count || 0), projects: Number(projects?.count || 0), budgets: Number(budgets?.count || 0), evaluations: Number(evaluations?.count || 0), reports: Number(reports?.count || 0), generated_at: now() });
  } catch (error) { next(error); }
});

for (const definition of resourceDefinitions) {
  const base = `/api/v1/${definition.path}`;
  app.get(base, authenticate, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), MAX_PAGE_SIZE);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      let query = db(definition.table).where({ organization_id: req.user.organizationId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
      if (definition.searchField && req.query.q) query = query.whereRaw(`LOWER(${definition.searchField}) LIKE ?`, [`%${String(req.query.q).toLowerCase()}%`]);
      const rows = await query;
      res.json(rows.map((row) => present(definition.entity, row)));
    } catch (error) { next(error); }
  });

  app.post(base, authenticate, async (req, res, next) => {
    try {
      const input = definition.schema.parse(normalizeLegacyPayload(definition.entity, req.body));
      if (input.client_id) {
        const client = await getOwned('clients', input.client_id, req.user.organizationId);
        if (!client) return res.status(400).json({ error: 'Cliente não encontrado nesta organização.' });
      }
      if (input.project_id) {
        const project = await getOwned('projects', input.project_id, req.user.organizationId);
        if (!project) return res.status(400).json({ error: 'Projeto não encontrado nesta organização.' });
      }
      const payload = serialize({ ...input, organization_id: req.user.organizationId, created_at: now(), updated_at: now() });
      const [id] = await db(definition.table).insert(payload);
      const row = await db(definition.table).where({ id, organization_id: req.user.organizationId }).first();
      await audit(req, `${definition.entity}.created`, definition.entity, id);
      await enqueueSync(req, definition.entity, id, 'upsert', present(definition.entity, row));
      res.status(201).json(present(definition.entity, row));
    } catch (error) {
      const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
      next(error);
    }
  });

  app.get(`${base}/:id`, authenticate, async (req, res, next) => {
    try {
      const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
      const row = await getOwned(definition.table, id, req.user.organizationId);
      if (!row) return res.status(404).json({ error: 'Registro não encontrado.' });
      res.json(present(definition.entity, row));
    } catch (error) { next(error); }
  });

  app.patch(`${base}/:id`, authenticate, async (req, res, next) => {
    try {
      const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
      const existing = await getOwned(definition.table, id, req.user.organizationId);
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado.' });
      const input = definition.schema.partial().parse(normalizeLegacyPayload(definition.entity, req.body));
      if (Object.keys(input).length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
      const payload = serialize({ ...input, updated_at: now() });
      await db(definition.table).where({ id, organization_id: req.user.organizationId }).update(payload);
      const row = await getOwned(definition.table, id, req.user.organizationId);
      await audit(req, `${definition.entity}.updated`, definition.entity, id, { fields: Object.keys(input) });
      await enqueueSync(req, definition.entity, id, 'upsert', present(definition.entity, row));
      res.json(present(definition.entity, row));
    } catch (error) {
      const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
      next(error);
    }
  });

  app.delete(`${base}/:id`, authenticate, async (req, res, next) => {
    try {
      const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
      const existing = await getOwned(definition.table, id, req.user.organizationId);
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado.' });
      await db(definition.table).where({ id, organization_id: req.user.organizationId }).delete();
      await audit(req, `${definition.entity}.deleted`, definition.entity, id);
      await enqueueSync(req, definition.entity, id, 'delete', { id });
      res.status(204).end();
    } catch (error) { next(error); }
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024), files: 1 },
  fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif|tiff)$/.test(file.mimetype)),
});
const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_SPREADSHEET_BYTES || 25 * 1024 * 1024), files: 1 },
  fileFilter: (_req, file, callback) => callback(null, /\.(xlsx|xlsm)$/i.test(file.originalname || '')),
});

app.post('/api/v1/projetos/:projectId/importacoes/laudo', authenticate, spreadsheetUpload.single('file'), async (req, res, next) => {
  try {
    const projectId = numericId(req.params.projectId); if (!projectId) return res.status(400).json({ error: 'Projeto inválido.' });
    const project = await getOwned('projects', projectId, req.user.organizationId); if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo .xlsx ou .xlsm.' });
    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer, { ignoreNodes: ['extLst'] });
    const macroDetected = req.file.buffer.includes(Buffer.from('vbaProject.bin')) || /\.xlsm$/i.test(req.file.originalname);
    const externalLinksDetected = req.file.buffer.includes(Buffer.from('externalLinks'));
    let occupiedCells = 0; let formulaCount = 0;
    const sheets = workbook.worksheets.map((worksheet) => {
      const sample = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const values = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
            occupiedCells += 1;
            if (typeof cell.value === 'object' && cell.value.formula) formulaCount += 1;
            values.push({ address: cell.address, value: typeof cell.value === 'object' && cell.value.formula ? { formula: cell.value.formula, result: cell.value.result ?? null } : String(cell.value) });
          }
        });
        if (values.length && sample.length < 30) sample.push(values.slice(0, 30));
      });
      return { name: worksheet.name, row_count: worksheet.actualRowCount, column_count: worksheet.actualColumnCount, sample };
    });
    const integrityReport = { version: 1, calculation_model_version: 'laudo-v1', file_name: req.file.originalname, checksum, size_bytes: req.file.size, macro_detected: macroDetected, external_links_detected: externalLinksDetected, occupied_cells: occupiedCells, formula_count: formulaCount, sheets, safe_to_execute: false, notes: ['Macros nunca são executadas pelo GeoMind.', 'Links externos não são resolvidos durante a importação.', macroDetected || externalLinksDetected ? 'Arquivo bloqueado para cálculo automático; sanitize e revise antes de importar.' : 'Somente células ocupadas foram amostradas.'] };
    const status = macroDetected || externalLinksDetected ? 'blocked' : 'analyzed';
    const [importId] = await db('laudo_imports').insert({ organization_id: req.user.organizationId, project_id: projectId, created_by: req.user.id, file_name: req.file.originalname, file_type: /\.xlsm$/i.test(req.file.originalname) ? 'xlsm' : 'xlsx', size_bytes: req.file.size, checksum, status, integrity_report: JSON.stringify(integrityReport), created_at: now() });
    await audit(req, 'laudo.import_analyzed', 'laudo_import', importId, { project_id: projectId, status, checksum });
    res.status(201).json({ id: importId, project_id: projectId, status, integrity_report: integrityReport });
  } catch (error) {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Falha no upload da planilha.', code: error.code });
    next(error);
  }
});

app.get('/api/v1/projetos/:projectId/evidencias', authenticate, async (req, res, next) => {
  try {
    const projectId = numericId(req.params.projectId); if (!projectId) return res.status(400).json({ error: 'Projeto inválido.' });
    const project = await getOwned('projects', projectId, req.user.organizationId); if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    const rows = await db('evidences').where({ project_id: projectId, organization_id: req.user.organizationId }).orderBy('created_at', 'desc');
    res.json(rows.map(hydrate));
  } catch (error) { next(error); }
});

app.post('/api/v1/projetos/:projectId/evidencias', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const projectId = numericId(req.params.projectId); if (!projectId) return res.status(400).json({ error: 'Projeto inválido.' });
    const project = await getOwned('projects', projectId, req.user.organizationId); if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem JPEG, PNG, WebP, GIF ou TIFF.' });
    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const key = path.join(String(req.user.organizationId), `${crypto.randomUUID()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    const absolutePath = path.join(storageDir, key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, req.file.buffer, { flag: 'wx' });
    try {
      const [id] = await db('evidences').insert({ organization_id: req.user.organizationId, project_id: projectId, evaluation_id: numericId(req.body.evaluation_id), kind: 'image', file_name: req.file.originalname, mime_type: req.file.mimetype, size_bytes: req.file.size, storage_key: key, checksum, metadata: JSON.stringify({ width: req.body.width || null, height: req.body.height || null }), created_at: now() });
      const row = await db('evidences').where({ id, organization_id: req.user.organizationId }).first();
      await audit(req, 'evidence.created', 'evidence', id, { project_id: projectId, checksum });
      res.status(201).json(hydrate(row));
    } catch (error) {
      await fs.rm(absolutePath, { force: true });
      throw error;
    }
  } catch (error) {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Falha no upload.', code: error.code });
    next(error);
  }
});

app.get('/api/v1/evidencias/:evidenceId/download', authenticate, async (req, res, next) => {
  try {
    const evidenceId = numericId(req.params.evidenceId); if (!evidenceId) return res.status(400).json({ error: 'Evidência inválida.' });
    const evidence = await getOwned('evidences', evidenceId, req.user.organizationId); if (!evidence) return res.status(404).json({ error: 'Evidência não encontrada.' });
    const absolutePath = path.join(storageDir, evidence.storage_key);
    res.type(evidence.mime_type).sendFile(absolutePath, (error) => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
});

const aiOutputSchema = {
  type: Type.OBJECT,
  properties: {
    descricao: { type: Type.STRING, description: 'Descrição factual e observável da imagem.' },
    ambiente: { type: Type.STRING, description: 'Ambiente ou elemento predominante.' },
    elementos_visiveis: { type: Type.ARRAY, items: { type: Type.STRING } },
    estado_conservacao: { type: Type.STRING, description: 'novo, bom, regular, precario ou indeterminado.' },
    pontos_atencao: { type: Type.ARRAY, items: { type: Type.STRING } },
    limites: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['descricao', 'ambiente', 'elementos_visiveis', 'estado_conservacao', 'pontos_atencao', 'limites'],
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isRetryableAiError = (error) => [429, 500, 502, 503, 504].includes(Number(error?.status || error?.code));

app.post('/api/v1/evidencias/:evidenceId/analise-ia', authenticate, async (req, res, next) => {
  const started = Date.now();
  let requestRecord = null;
  try {
    const evidenceId = numericId(req.params.evidenceId); if (!evidenceId) return res.status(400).json({ error: 'Evidência inválida.' });
    const evidence = await getOwned('evidences', evidenceId, req.user.organizationId); if (!evidence) return res.status(404).json({ error: 'Evidência não encontrada.' });
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Gemini não configurado no servidor.', code: 'AI_NOT_CONFIGURED' });
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim().slice(0, 160) || null;
    if (idempotencyKey) {
      const existing = await db('ai_requests').where({ organization_id: req.user.organizationId, evidence_id: evidenceId, idempotency_key: idempotencyKey }).first();
      if (existing?.analysis_id) {
        const stored = await db('ai_analyses').where({ id: existing.analysis_id, organization_id: req.user.organizationId }).first();
        return res.status(200).json({ ...hydrate(stored), idempotent: true });
      }
      if (existing?.status === 'processing') return res.status(409).json({ error: 'Esta análise já está em processamento.', code: 'AI_REQUEST_IN_PROGRESS' });
      if (existing) {
        requestRecord = existing;
        await db('ai_requests').where({ id: existing.id, organization_id: req.user.organizationId }).update({ status: 'processing', error_message: null, updated_at: now() });
      } else {
        const [requestId] = await db('ai_requests').insert({ organization_id: req.user.organizationId, evidence_id: evidenceId, idempotency_key: idempotencyKey, status: 'processing', created_at: now(), updated_at: now() });
        requestRecord = { id: requestId };
      }
    }
    const absolutePath = path.join(storageDir, evidence.storage_key);
    const data = (await fs.readFile(absolutePath)).toString('base64');
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const prompt = String(req.body.prompt || 'Descreva somente o que é visualmente observável. Não infira valor, vício construtivo, segurança estrutural ou conformidade legal. Use indeterminado quando a imagem não sustentar uma conclusão.');
    const ai = new GoogleGenAI({ apiKey });
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: evidence.mime_type, data } }] }],
          config: { responseMimeType: 'application/json', responseSchema: aiOutputSchema, temperature: 0.1 },
        });
        break;
      } catch (error) {
        if (!isRetryableAiError(error) || attempt === 2) throw error;
        await wait(250 * (2 ** attempt));
      }
    }
    const rawOutput = String(response?.text || '{}').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const output = JSON.parse(rawOutput);
    const usage = response?.usageMetadata || {};
    const [analysisId] = await db('ai_analyses').insert({ organization_id: req.user.organizationId, evidence_id: evidenceId, provider: 'google-gemini', model, prompt_version: process.env.GEMINI_PROMPT_VERSION || 'image-description-v1', status: 'completed', output: JSON.stringify(output), latency_ms: Date.now() - started, input_tokens: Number(usage.promptTokenCount || 0) || null, output_tokens: Number(usage.candidatesTokenCount || 0) || null, created_at: now(), updated_at: now() });
    if (requestRecord) await db('ai_requests').where({ id: requestRecord.id, organization_id: req.user.organizationId }).update({ status: 'completed', analysis_id: analysisId, updated_at: now() });
    await audit(req, 'ai.analysis_completed', 'ai_analysis', analysisId, { evidence_id: evidenceId, model, idempotent: Boolean(idempotencyKey) });
    res.status(201).json({ id: analysisId, evidence_id: evidenceId, provider: 'google-gemini', model, status: 'completed', output, input_tokens: usage.promptTokenCount || null, output_tokens: usage.candidatesTokenCount || null, latency_ms: Date.now() - started });
  } catch (error) {
    if (requestRecord) await db('ai_requests').where({ id: requestRecord.id, organization_id: req.user.organizationId }).update({ status: 'failed', error_message: String(error.message || 'Falha na análise'), updated_at: now() });
    if (error?.status === 429) return res.status(429).json({ error: 'Limite temporário do Gemini atingido. Tente novamente mais tarde.', code: 'AI_RATE_LIMITED' });
    next(error);
  }
});

app.get('/api/v1/evidencias/:evidenceId/analises-ia', authenticate, async (req, res, next) => {
  try {
    const evidenceId = numericId(req.params.evidenceId); if (!evidenceId) return res.status(400).json({ error: 'Evidência inválida.' });
    const evidence = await getOwned('evidences', evidenceId, req.user.organizationId); if (!evidence) return res.status(404).json({ error: 'Evidência não encontrada.' });
    const rows = await db('ai_analyses').where({ evidence_id: evidenceId, organization_id: req.user.organizationId }).orderBy('created_at', 'desc');
    res.json(rows.map(hydrate));
  } catch (error) { next(error); }
});

app.patch('/api/v1/evidencias/:evidenceId/analises-ia/:analysisId', authenticate, async (req, res, next) => {
  try {
    const evidenceId = numericId(req.params.evidenceId);
    const analysisId = numericId(req.params.analysisId);
    if (!evidenceId || !analysisId) return res.status(400).json({ error: 'Evidência ou análise inválida.' });
    const input = z.object({ action: z.enum(['approve', 'edit', 'reject']), output: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    const evidence = await getOwned('evidences', evidenceId, req.user.organizationId);
    const analysis = await db('ai_analyses').where({ id: analysisId, evidence_id: evidenceId, organization_id: req.user.organizationId }).first();
    if (!evidence || !analysis) return res.status(404).json({ error: 'Análise não encontrada.' });
    if (input.action === 'edit' && !input.output) return res.status(400).json({ error: 'Informe output para editar a análise.' });
    const status = input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : 'edited';
    const patch = { status, reviewed_at: now(), reviewed_by: req.user.id, updated_at: now() };
    if (input.output) patch.output = JSON.stringify(input.output);
    await db('ai_analyses').where({ id: analysisId, organization_id: req.user.organizationId }).update(patch);
    const updated = await db('ai_analyses').where({ id: analysisId, organization_id: req.user.organizationId }).first();
    await audit(req, `ai.analysis_${input.action}d`, 'ai_analysis', analysisId, { evidence_id: evidenceId });
    res.json(hydrate(updated));
  } catch (error) {
    const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
    next(error);
  }
});

const geoCache = new Map();
const geoCategoryContext = {
  escola: { benefits: ['Acesso potencial a serviços educacionais.'], verification: ['Verifique etapa de ensino, matrícula, horários e distância no trajeto real.'] },
  shopping: { benefits: ['Acesso potencial a comércio e serviços.'], verification: ['Verifique horário, mix de lojas, estacionamento e tempo em horário de pico.'] },
  supermercado: { benefits: ['Acesso potencial a compras recorrentes e abastecimento.'], verification: ['Verifique horário, variedade, preços e segurança do percurso.'] },
  hospital: { benefits: ['Acesso potencial a atendimento de saúde.'], verification: ['Verifique especialidades, pronto atendimento, cobertura e tempo de deslocamento.'] },
  farmacia: { benefits: ['Acesso potencial a medicamentos e itens de saúde.'], verification: ['Verifique funcionamento, disponibilidade e atendimento fora do horário comercial.'] },
  transporte: { benefits: ['Acesso potencial à rede de transporte público.'], verification: ['Verifique frequência, integração, tarifa, acessibilidade e segurança no trajeto.'] },
};
const haversineMeters = (fromLat, fromLng, toLat, toLng) => {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const dLat = toRadians(toLat - fromLat); const dLng = toRadians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const geoCategories = {
  escola: ['school'],
  shopping: ['shopping_mall'],
  supermercado: ['supermarket'],
  hospital: ['hospital'],
  farmacia: ['pharmacy'],
  transporte: ['transit_station', 'bus_station', 'subway_station', 'train_station'],
};

app.post('/api/v1/projetos/:projectId/geografia', authenticate, async (req, res, next) => {
  const started = Date.now();
  try {
    const projectId = numericId(req.params.projectId); if (!projectId) return res.status(400).json({ error: 'Projeto inválido.' });
    const project = await getOwned('projects', projectId, req.user.organizationId); if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Provedor geográfico não configurado no servidor.', code: 'GEO_NOT_CONFIGURED' });
    const address = String(req.body.address || [project.address, project.city, project.state, project.postal_code].filter(Boolean).join(', ')).trim();
    if (!address && !(project.latitude && project.longitude)) return res.status(400).json({ error: 'Informe endereço ou coordenadas do projeto.' });
    let latitude = Number(project.latitude); let longitude = Number(project.longitude); let geocode = null;
    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && address) {
      const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      geocodeUrl.searchParams.set('address', address); geocodeUrl.searchParams.set('key', apiKey); geocodeUrl.searchParams.set('language', 'pt-BR');
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      const location = geocodeData.results?.[0]?.geometry?.location;
      if (!location) return res.status(422).json({ error: 'Endereço não localizado.', provider_status: geocodeData.status });
      latitude = location.lat; longitude = location.lng; geocode = geocodeData.results[0];
      await db('projects').where({ id: projectId, organization_id: req.user.organizationId }).update({ latitude, longitude, updated_at: now() });
    }
    const radius = Math.min(Math.max(Number(req.body.radius) || 2000, 50), 50000);
    const requestedCategories = Array.isArray(req.body.categories) && req.body.categories.length ? req.body.categories : Object.keys(geoCategories);
    const categories = requestedCategories.filter((category) => geoCategories[category]).slice(0, 8);
    const cacheKey = JSON.stringify({ organizationId: req.user.organizationId, projectId, address, radius, categories });
    const cached = geoCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.status(200).json({ id: cached.id, ...cached.value, cached: true });
    const results = await Promise.all(categories.map(async (category) => {
      const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.googleMapsUri' },
        body: JSON.stringify({ includedTypes: geoCategories[category], maxResultCount: 10, locationRestriction: { circle: { center: { latitude, longitude }, radius } }, languageCode: 'pt-BR' }),
      });
      const data = await placesResponse.json();
      const places = (data.places || []).map((place) => {
        const placeLatitude = Number(place.location?.latitude); const placeLongitude = Number(place.location?.longitude);
        return { ...place, distance_meters: Number.isFinite(placeLatitude) && Number.isFinite(placeLongitude) ? haversineMeters(latitude, longitude, placeLatitude, placeLongitude) : null };
      });
      return { category, places, context: geoCategoryContext[category] || { benefits: [], verification: [] }, provider_status: placesResponse.ok ? 'OK' : 'ERROR', error: placesResponse.ok ? null : data.error?.message };
    }));
    const response = { project_id: projectId, coordinates: { latitude, longitude }, address, radius, categories: results, geocoded: Boolean(geocode), provider: 'google-maps-platform', cache_ttl_seconds: 300, cached: false, observed_at: now() };
    const [runId] = await db('geo_runs').insert({ organization_id: req.user.organizationId, project_id: projectId, provider: 'google-maps-platform', operation: 'nearby_context', status: results.some((item) => item.provider_status !== 'OK') ? 'partial' : 'complete', request: JSON.stringify({ address, radius, categories }), response: JSON.stringify(response), source_url: 'https://developers.google.com/maps/documentation/places/web-service/nearby-search', observed_at: now(), latency_ms: Date.now() - started });
    await audit(req, 'geo.context_completed', 'geo_run', runId, { project_id: projectId });
    geoCache.set(cacheKey, { id: runId, expiresAt: Date.now() + 300000, value: { ...response, latency_ms: Date.now() - started } });
    res.status(201).json({ id: runId, ...response, latency_ms: Date.now() - started });
  } catch (error) { next(error); }
});

app.post('/api/v1/projetos/:projectId/rotas', authenticate, async (req, res, next) => {
  try {
    const projectId = numericId(req.params.projectId); if (!projectId) return res.status(400).json({ error: 'Projeto inválido.' });
    const project = await getOwned('projects', projectId, req.user.organizationId); if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Provedor de rotas não configurado no servidor.', code: 'ROUTES_NOT_CONFIGURED' });
    const destination = req.body.destination;
    if (!destination) return res.status(400).json({ error: 'Informe o destino da rota.' });
    const origin = req.body.origin || { location: { latLng: { latitude: Number(project.latitude), longitude: Number(project.longitude) } } };
    const travelMode = req.body.travelMode || 'TRANSIT';
    const routesResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.steps.transitDetails,routes.localizedValues' }, body: JSON.stringify({ origin, destination, travelMode, computeAlternativeRoutes: true, transitPreferences: travelMode === 'TRANSIT' ? { routingPreference: req.body.routingPreference || 'FEWER_TRANSFERS' } : undefined }) });
    const data = await routesResponse.json();
    if (!routesResponse.ok) return res.status(routesResponse.status).json({ error: data.error?.message || 'Falha ao calcular rota.', provider_status: routesResponse.status });
    const response = { project_id: projectId, origin, destination, travel_mode: travelMode, routes: data.routes || [], provider: 'google-routes-api', observed_at: now() };
    const [runId] = await db('geo_runs').insert({ organization_id: req.user.organizationId, project_id: projectId, provider: 'google-routes-api', operation: 'route', status: 'complete', request: JSON.stringify({ origin, destination, travelMode }), response: JSON.stringify(response), source_url: 'https://developers.google.com/maps/documentation/routes/transit-route', observed_at: now() });
    await audit(req, 'geo.route_completed', 'geo_run', runId, { project_id: projectId, travel_mode: travelMode });
    res.status(201).json({ id: runId, ...response });
  } catch (error) { next(error); }
});

app.get('/api/v1/integracoes/status', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    res.json({ database: databaseInfo, gemini: { configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY), model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' }, maps: { configured: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY) }, local_gateway: { configured: Boolean(process.env.LOCAL_GATEWAY_URL), url: process.env.LOCAL_GATEWAY_URL || null }, billing: { configured: Boolean(process.env.BILLING_PROVIDER) } });
  } catch (error) { next(error); }
});

app.post('/api/v1/integracoes/webhooks/:provider', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res, next) => {
  try {
    const provider = String(req.params.provider).slice(0, 60);
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {})));
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    const signature = req.get('x-webhook-signature') || req.get('stripe-signature');
    if (secret && signature) {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (signature.replace(/^sha256=/, '') !== expected) return res.status(401).json({ error: 'Assinatura de webhook inválida.' });
    } else if (secret && !signature) {
      return res.status(401).json({ error: 'Assinatura de webhook ausente.' });
    }
    const eventId = req.get('x-event-id') || req.get('stripe-event-id') || crypto.createHash('sha256').update(rawBody).digest('hex');
    const payload = JSON.parse(rawBody.toString('utf8'));
    const existing = await db('billing_events').where({ provider, event_id: eventId }).first();
    if (!existing) await db('billing_events').insert({ provider, event_id: eventId, event_type: payload.type || 'unknown', payload: JSON.stringify(payload), processed_at: now(), created_at: now() });
    res.status(202).json({ accepted: true, duplicate: Boolean(existing), event_id: eventId });
  } catch (error) { next(error); }
});

app.get('/api/v1/auditoria', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), MAX_PAGE_SIZE);
    const rows = await db('audit_logs').where({ organization_id: req.user.organizationId }).orderBy('created_at', 'desc').limit(limit);
    res.json(rows.map(hydrate));
  } catch (error) { next(error); }
});

const backupTables = ['users', 'clients', 'projects', 'budgets', 'evaluations', 'evidences', 'ai_analyses', 'reports', 'geo_runs', 'audit_logs', 'billing_events', 'credit_accounts', 'transactions', 'payment_methods', 'sync_outbox', 'sync_inbox', 'ai_requests', 'laudo_imports'];

app.get('/api/v1/backup', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const rows = await db('backups').where({ organization_id: req.user.organizationId }).orderBy('created_at', 'desc').limit(50);
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/v1/backup/:id/download', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const backup = await db('backups').where({ id, organization_id: req.user.organizationId }).first();
    if (!backup) return res.status(404).json({ error: 'Backup não encontrado.' });
    return res.download(path.join(storageDir, backup.storage_key), backup.file_name);
  } catch (error) { next(error); }
});

app.post('/api/v1/backup', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const snapshot = { version: 1, created_at: now(), organization_id: req.user.organizationId, tables: {} };
    for (const table of backupTables) snapshot.tables[table] = await db(table).where({ organization_id: req.user.organizationId });
    snapshot.tables.organizations = await db('organizations').where({ id: req.user.organizationId });
    const compressed = await gzipAsync(Buffer.from(JSON.stringify(snapshot)));
    const checksum = crypto.createHash('sha256').update(compressed).digest('hex');
    const fileName = `geomind-${req.user.organizationId}-${Date.now()}.json.gz`;
    const key = path.join('backups', String(req.user.organizationId), fileName);
    const absolutePath = path.join(storageDir, key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, compressed, { flag: 'wx' });
    try {
      const [id] = await db('backups').insert({ organization_id: req.user.organizationId, created_by: req.user.id, file_name: fileName, storage_key: key, size_bytes: compressed.length, checksum, status: 'complete', created_at: now() });
      const backup = await db('backups').where({ id, organization_id: req.user.organizationId }).first();
      await audit(req, 'backup.created', 'backup', id, { size_bytes: compressed.length });
      res.status(201).json(backup);
    } catch (error) { await fs.rm(absolutePath, { force: true }); throw error; }
  } catch (error) { next(error); }
});

app.post('/api/v1/backup/:id/restore', authenticate, requireRoles('owner'), async (req, res, next) => {
  try {
    if (req.body.confirm !== 'RESTORE') return res.status(400).json({ error: 'Envie confirm: RESTORE para confirmar a operação destrutiva.' });
    const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const backup = await db('backups').where({ id, organization_id: req.user.organizationId }).first();
    if (!backup) return res.status(404).json({ error: 'Backup não encontrado.' });
    const compressed = await fs.readFile(path.join(storageDir, backup.storage_key));
    const snapshot = JSON.parse((await gunzipAsync(compressed)).toString('utf8'));
    await db.transaction(async (trx) => {
      for (const table of [...backupTables].reverse()) await trx(table).where({ organization_id: req.user.organizationId }).delete();
      for (const table of backupTables) {
        const rows = snapshot.tables?.[table] || [];
        if (rows.length) await trx(table).insert(rows);
      }
    });
    await audit(req, 'backup.restored', 'backup', id, { checksum: backup.checksum });
    res.json({ restored: true, backup_id: id });
  } catch (error) { next(error); }
});

app.post('/api/v1/backup/cleanup', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const retentionDays = Math.min(Math.max(Number(process.env.BACKUP_RETENTION_DAYS || 30), 1), 3650);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const candidates = await db('backups').where({ organization_id: req.user.organizationId });
    const expired = candidates.filter((backup) => new Date(backup.created_at).getTime() < cutoff);
    for (const backup of expired) {
      await db('backups').where({ id: backup.id, organization_id: req.user.organizationId }).delete();
      await fs.rm(path.join(storageDir, backup.storage_key), { force: true });
    }
    if (expired.length) await audit(req, 'backup.retention_cleanup', 'backup', null, { deleted: expired.length, retention_days: retentionDays });
    res.json({ deleted: expired.length, retention_days: retentionDays });
  } catch (error) { next(error); }
});

app.delete('/api/v1/backup/:id', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const backup = await db('backups').where({ id, organization_id: req.user.organizationId }).first();
    if (!backup) return res.status(404).json({ error: 'Backup não encontrado.' });
    await db('backups').where({ id, organization_id: req.user.organizationId }).delete();
    await fs.rm(path.join(storageDir, backup.storage_key), { force: true });
    await audit(req, 'backup.deleted', 'backup', id);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/sync/events', async (req, res, next) => {
  try {
    const secret = process.env.SYNC_SHARED_SECRET;
    if (process.env.NODE_ENV === 'production' && !secret) return res.status(503).json({ error: 'SYNC_SHARED_SECRET não configurado.', code: 'SYNC_AUTH_NOT_CONFIGURED' });
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const signature = req.get('x-geomind-signature');
    if (secret) {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (!signature || signature.replace(/^sha256=/, '') !== expected) return res.status(401).json({ error: 'Assinatura de sincronização inválida.' });
    }
    const organizationId = numericId(req.get('x-geomind-organization'));
    const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 100) : [];
    if (!organizationId || !events.length) return res.status(400).json({ error: 'Organização e eventos são obrigatórios.' });
    let received = 0; let duplicates = 0;
    for (const event of events) {
      if (!event?.event_id || String(event.organization_id) !== String(organizationId)) return res.status(400).json({ error: 'Evento incompatível com a organização informada.' });
      const eventId = String(event.event_id);
      const alreadyReceived = await db('sync_inbox').where({ organization_id: organizationId, event_id: eventId }).first();
      if (alreadyReceived) { duplicates += 1; continue; }
      try {
        await db('sync_inbox').insert({ organization_id: organizationId, event_id: eventId, entity_type: String(event.entity_type || 'unknown'), entity_id: String(event.entity_id || ''), operation: String(event.operation || 'upsert'), payload: JSON.stringify(event.payload || {}), status: 'received', received_at: now() });
        received += 1;
      } catch (error) {
        if (error?.code === 'SQLITE_CONSTRAINT' || error?.code === '23505' || error?.errcode === 2067 || /UNIQUE constraint|duplicate key/i.test(error?.message || '')) duplicates += 1;
        else throw error;
      }
    }
    res.status(202).json({ accepted: true, received, duplicates, pending_apply: received });
  } catch (error) { next(error); }
});

app.get('/api/v1/sync/status', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const pending = await db('sync_outbox').where({ organization_id: req.user.organizationId, status: 'pending' }).count({ count: '*' }).first();
    const processed = await db('sync_outbox').where({ organization_id: req.user.organizationId, status: 'processed' }).count({ count: '*' }).first();
    const received = await db('sync_inbox').where({ organization_id: req.user.organizationId, status: 'received' }).count({ count: '*' }).first();
    const applied = await db('sync_inbox').where({ organization_id: req.user.organizationId, status: 'applied' }).count({ count: '*' }).first();
    res.json({ target_configured: Boolean(process.env.SYNC_TARGET_URL || process.env.LOCAL_GATEWAY_URL), pending: Number(pending?.count || 0), processed: Number(processed?.count || 0), received: Number(received?.count || 0), applied: Number(applied?.count || 0) });
  } catch (error) { next(error); }
});

app.post('/api/v1/sync/push', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const target = process.env.SYNC_TARGET_URL || process.env.LOCAL_GATEWAY_URL;
    if (!target) return res.status(503).json({ error: 'Destino de sincronização não configurado.', code: 'SYNC_NOT_CONFIGURED' });
    const events = await db('sync_outbox').where({ organization_id: req.user.organizationId, status: 'pending' }).orderBy('id', 'asc').limit(Math.min(Math.max(Number(req.body.limit) || 50, 1), 100)).then((rows) => rows.map(hydrate));
    if (!events.length) return res.json({ sent: 0, accepted: true });
    const syncUrl = target.endsWith('/') ? target.slice(0, -1) : target;
    const payload = JSON.stringify({ events });
    const secret = process.env.SYNC_SHARED_SECRET;
    if (process.env.NODE_ENV === 'production' && !secret) return res.status(503).json({ error: 'SYNC_SHARED_SECRET não configurado.', code: 'SYNC_AUTH_NOT_CONFIGURED' });
    const headers = { 'Content-Type': 'application/json', 'X-GeoMind-Organization': String(req.user.organizationId) };
    if (secret) headers['X-GeoMind-Signature'] = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const response = await fetch(`${syncUrl}/sync/events`, { method: 'POST', headers, body: payload });
    if (!response.ok) {
      await Promise.all(events.map((event) => db('sync_outbox').where({ id: event.id, organization_id: req.user.organizationId }).update({ attempts: Number(event.attempts || 0) + 1, last_error: `HTTP ${response.status}` })));
      return res.status(502).json({ error: 'Destino rejeitou a sincronização.', status: response.status });
    }
    await Promise.all(events.map((event) => db('sync_outbox').where({ id: event.id, organization_id: req.user.organizationId }).update({ status: 'processed', processed_at: now(), attempts: Number(event.attempts || 0) + 1 })));
    await audit(req, 'sync.events_pushed', 'sync_outbox', null, { count: events.length, target });
    res.json({ sent: events.length, accepted: true });
  } catch (error) { next(error); }
});

async function ensureCreditAccount(organizationId) {
  let account = await db('credit_accounts').where({ organization_id: organizationId }).first();
  if (!account) {
    try {
      const [id] = await db('credit_accounts').insert({ organization_id: organizationId, balance_cents: 0, monthly_used: 0, created_at: now(), updated_at: now() });
      account = await db('credit_accounts').where({ id, organization_id: organizationId }).first();
    } catch (error) {
      if (error?.code !== 'SQLITE_CONSTRAINT' && error?.code !== '23505') throw error;
      account = await db('credit_accounts').where({ organization_id: organizationId }).first();
    }
  }
  return account;
}

app.get('/api/v1/billing/summary', authenticate, async (req, res, next) => {
  try {
    const [account, organization] = await Promise.all([
      ensureCreditAccount(req.user.organizationId),
      db('organizations').where({ id: req.user.organizationId }).first(),
    ]);
    res.json({ balance_cents: Number(account?.balance_cents || 0), monthly_used: Number(account?.monthly_used || 0), provider: process.env.BILLING_PROVIDER || null, plan: organization?.plan || 'trial', organization_name: organization?.name || null });
  } catch (error) { next(error); }
});

app.get('/api/v1/billing/transactions', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), MAX_PAGE_SIZE);
    const rows = await db('transactions').where({ organization_id: req.user.organizationId }).orderBy('created_at', 'desc').limit(limit);
    res.json(rows.map(hydrate));
  } catch (error) { next(error); }
});

app.post('/api/v1/billing/top-up', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const amountCents = Number(req.body.amount_cents);
    const provider = process.env.BILLING_PROVIDER || '';
    if (!Number.isInteger(amountCents) || amountCents < 500 || amountCents > 100000000) return res.status(400).json({ error: 'Valor deve estar entre R$ 5,00 e R$ 1.000.000,00 em centavos.' });
    if (!provider || provider === 'none' || (process.env.NODE_ENV === 'production' && provider === 'local')) return res.status(503).json({ error: 'Gateway de pagamento real não configurado. Nenhum crédito foi adicionado.', code: 'BILLING_NOT_CONFIGURED' });
    const localDevelopment = provider === 'local' && process.env.NODE_ENV !== 'production';
    if (!localDevelopment && !req.body.provider_payment_id) return res.status(400).json({ error: 'Informe a referência do pagamento confirmado pelo gateway.' });
    const account = await ensureCreditAccount(req.user.organizationId);
    const transaction = await db.transaction(async (trx) => {
      const [transactionId] = await trx('transactions').insert({ organization_id: req.user.organizationId, user_id: req.user.id, type: 'top_up', amount_cents: amountCents, status: localDevelopment ? 'approved' : 'pending', provider, provider_ref: req.body.provider_payment_id || `local-${crypto.randomUUID()}`, metadata: JSON.stringify({ source: localDevelopment ? 'development' : 'gateway' }), created_at: now(), updated_at: now() });
      if (localDevelopment) {
        await trx('credit_accounts').where({ id: account.id, organization_id: req.user.organizationId }).update({ balance_cents: Number(account.balance_cents) + amountCents, updated_at: now() });
      }
      return trx('transactions').where({ id: transactionId, organization_id: req.user.organizationId }).first();
    });
    await audit(req, 'billing.top_up_created', 'transaction', transaction.id, { amount_cents: amountCents, provider });
    const updated = await ensureCreditAccount(req.user.organizationId);
    res.status(201).json({ sucesso: transaction.status === 'approved', transaction: hydrate(transaction), novoSaldo: Number(updated.balance_cents), mensagem: transaction.status === 'approved' ? 'Créditos adicionados.' : 'Pagamento recebido e aguardando confirmação do webhook.' });
  } catch (error) { next(error); }
});

app.post('/api/v1/billing/consume', authenticate, async (req, res, next) => {
  try {
    const amountCents = Number(req.body.amount_cents || 100);
    const account = await ensureCreditAccount(req.user.organizationId);
    if (!Number.isInteger(amountCents) || amountCents <= 0) return res.status(400).json({ error: 'Valor de consumo inválido.' });
    if (Number(account.balance_cents) < amountCents) return res.status(402).json({ error: 'Saldo de créditos insuficiente.', code: 'INSUFFICIENT_CREDITS', balance_cents: Number(account.balance_cents) });
    const transaction = await db.transaction(async (trx) => {
      await trx('credit_accounts').where({ id: account.id, organization_id: req.user.organizationId }).update({ balance_cents: Number(account.balance_cents) - amountCents, monthly_used: Number(account.monthly_used || 0) + amountCents, updated_at: now() });
      const [transactionId] = await trx('transactions').insert({ organization_id: req.user.organizationId, user_id: req.user.id, type: req.body.type || 'usage', amount_cents: -amountCents, status: 'approved', provider: 'geomind-ledger', provider_ref: crypto.randomUUID(), metadata: JSON.stringify(req.body.metadata || {}), created_at: now(), updated_at: now() });
      return trx('transactions').where({ id: transactionId, organization_id: req.user.organizationId }).first();
    });
    await audit(req, 'billing.credits_consumed', 'transaction', transaction.id, { amount_cents: amountCents });
    const updated = await ensureCreditAccount(req.user.organizationId);
    res.status(201).json({ sucesso: true, transaction: hydrate(transaction), novoSaldo: Number(updated.balance_cents), mensagem: 'Créditos consumidos.' });
  } catch (error) { next(error); }
});

app.get('/api/v1/billing/payment-methods', authenticate, async (req, res, next) => {
  try {
    const rows = await db('payment_methods').where({ organization_id: req.user.organizationId }).orderBy('created_at', 'desc');
    res.json(rows.map((method) => {
      const safeMethod = { ...method };
      delete safeMethod.provider_token;
      return safeMethod;
    }));
  } catch (error) { next(error); }
});

app.post('/api/v1/billing/payment-methods', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const input = z.object({ provider: z.string().trim().min(2).max(60), provider_token: z.string().trim().min(8).max(255), brand: z.string().trim().max(40).optional().nullable(), last4: z.string().regex(/^\d{4}$/).optional().nullable(), is_default: z.boolean().optional() }).parse(req.body);
    if (input.is_default) await db('payment_methods').where({ organization_id: req.user.organizationId }).update({ is_default: false, updated_at: now() });
    const [id] = await db('payment_methods').insert({ ...input, organization_id: req.user.organizationId, is_default: input.is_default ? true : false, created_at: now(), updated_at: now() });
    const method = await db('payment_methods').where({ id, organization_id: req.user.organizationId }).first();
    await audit(req, 'billing.payment_method_added', 'payment_method', id);
    const safeMethod = { ...method };
    delete safeMethod.provider_token;
    res.status(201).json(safeMethod);
  } catch (error) {
    const parsed = validationError(error); if (parsed) return res.status(400).json(parsed);
    next(error);
  }
});

app.delete('/api/v1/billing/payment-methods/:id', authenticate, requireRoles('owner', 'admin'), async (req, res, next) => {
  try {
    const id = numericId(req.params.id); if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const deleted = await db('payment_methods').where({ id, organization_id: req.user.organizationId }).delete();
    if (!deleted) return res.status(404).json({ error: 'Método de pagamento não encontrado.' });
    await audit(req, 'billing.payment_method_removed', 'payment_method', id);
    res.status(204).end();
  } catch (error) { next(error); }
});

const staticPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(staticPath, { index: 'index.html' }));
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(staticPath, 'index.html'), (error) => { if (error && !res.headersSent) next(error); });
});

app.use((error, req, res, next) => {
  void next;
  console.error(`[${req.requestId}]`, error);
  if (res.headersSent) return;
  res.status(error.statusCode || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor.' : error.message, request_id: req.requestId });
});

export { app };

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const server = app.listen(PORT, () => console.log(`GeoMind API running on http://localhost:${PORT}`));
  const shutdown = async () => { server.close(); await closeDatabase(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
