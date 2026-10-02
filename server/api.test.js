import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { app } from './index.js';
import { db, closeDatabase } from './db.js';

const agent = request.agent(app);
let client;
let project;
let fixturePath;

beforeAll(async () => {
  await db('organizations').delete();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GeoMind Test';
  workbook.created = new Date();
  const ws = workbook.addWorksheet('laudo-dados');
  ws.getCell('A1').value = 'area_util_m2';
  ws.getCell('B1').value = 72;
  ws.getCell('A2').value = 'quartos';
  ws.getCell('B2').value = 2;
  ws.getCell('A3').value = 'm2_unitario';
  ws.getCell('C3').value = { formula: 'SUM(B1:B2)', result: 74 };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  fixturePath = path.join(os.tmpdir(), `geomind-fixture-${crypto.randomBytes(8).toString('hex')}.xlsx`);
  fs.writeFileSync(fixturePath, buffer);
});

afterAll(async () => {
  if (fixturePath && fs.existsSync(fixturePath)) fs.rmSync(fixturePath, { force: true });
  await closeDatabase();
});

describe('GeoMind API', () => {
  it('exige autenticação para dados protegidos', async () => {
    const response = await request(app).get('/api/v1/dashboard');
    expect(response.status).toBe(401);
  });

  it('registra usuário e cria sessão HTTP-only', async () => {
    const response = await agent.post('/api/v1/usuarios/register').send({
      name: 'Avaliador Teste',
      email: 'avaliador@example.com',
      password: 'senha-segura-123',
      organization_name: 'Escritório Teste',
    });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('avaliador@example.com');
    expect(response.headers['set-cookie'][0]).toContain('geomind_session=');
  });

  it('carrega o perfil autenticado', async () => {
    const response = await agent.get('/api/v1/usuarios/perfil');
    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Avaliador Teste');
  });

  it('persiste cliente e projeto no fluxo principal', async () => {
    const clientResponse = await agent.post('/api/v1/clientes').send({ name: 'Cliente de Integração', email: 'cliente@example.com' });
    expect(clientResponse.status).toBe(201);
    client = clientResponse.body;

    const projectResponse = await agent.post('/api/v1/projetos').send({ name: 'Casa de Teste', client_id: client.id, address: 'Rua de Teste, 100', city: 'Canoas', state: 'RS' });
    expect(projectResponse.status).toBe(201);
    project = projectResponse.body;

    const listResponse = await agent.get('/api/v1/projetos');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].name).toBe('Casa de Teste');
  });

  it('cria avaliação e retorna indicadores reais', async () => {
    const response = await agent.post('/api/v1/avaliacoes').send({ project_id: project.id, type: 'simplified', status: 'in_progress', assumptions: { sample_size: 3 } });
    expect(response.status).toBe(201);

    const dashboard = await agent.get('/api/v1/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.clients).toBe(1);
    expect(dashboard.body.projects).toBe(1);
    expect(dashboard.body.evaluations).toBe(1);
  });

  it('atualiza o perfil no servidor', async () => {
    const response = await agent.patch('/api/v1/usuarios/perfil').send({ name: 'Avaliador Atualizado', email: 'avaliador@example.com' });
    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Avaliador Atualizado');
  });

  it('persiste método de pagamento tokenizado sem devolver o token', async () => {
    const created = await agent.post('/api/v1/billing/payment-methods').send({ provider: 'local-test', provider_token: 'tok_test_123456', brand: 'Visa', last4: '4242', is_default: true });
    expect(created.status).toBe(201);
    expect(created.body.last4).toBe('4242');
    expect(created.body.provider_token).toBeUndefined();
    const listed = await agent.get('/api/v1/billing/payment-methods');
    expect(listed.status).toBe(200);
    expect(listed.body[0].provider_token).toBeUndefined();
  });

  it('revisa uma análise IA persistida', async () => {
    const currentUser = await db('users').where({ email: 'avaliador@example.com' }).first();
    const [evidenceId] = await db('evidences').insert({ organization_id: currentUser.organization_id, project_id: project.id, kind: 'image', file_name: 'fixture.png', mime_type: 'image/png', size_bytes: 4, storage_key: 'fixture.png', checksum: 'fixture', metadata: JSON.stringify({}), created_at: new Date().toISOString() });
    const [analysisId] = await db('ai_analyses').insert({ organization_id: currentUser.organization_id, evidence_id: evidenceId, provider: 'google-gemini', model: 'test-model', prompt_version: 'test-v1', status: 'completed', output: JSON.stringify({ descricao: 'Descrição de teste' }), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    const reviewed = await agent.patch(`/api/v1/evidencias/${evidenceId}/analises-ia/${analysisId}`).send({ action: 'approve' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.status).toBe('approved');
  });

  it('cria e lista backup comprimido da organização', async () => {
    const created = await agent.post('/api/v1/backup').send({});
    expect(created.status).toBe(201);
    expect(created.body.checksum).toMatch(/^[a-f0-9]{64}$/);
    const listed = await agent.get('/api/v1/backup');
    expect(listed.status).toBe(200);
    expect(listed.body.some((item) => item.id === created.body.id)).toBe(true);
    const downloaded = await agent.get(`/api/v1/backup/${created.body.id}/download`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body.length).toBeGreaterThan(20);
  });

  it('analisa planilha XLSX sem executar macros', async () => {
    const imported = await agent.post(`/api/v1/projetos/${project.id}/importacoes/laudo`).attach('file', fixturePath);
    expect(imported.status).toBe(201);
    expect(imported.body.status).toBe('analyzed');
    expect(imported.body.integrity_report.occupied_cells).toBe(6);
    expect(imported.body.integrity_report.formula_count).toBe(1);
    expect(imported.body.integrity_report.safe_to_execute).toBe(false);
  });

  it('valida assinatura HMAC de webhook quando configurada', async () => {
    process.env.BILLING_WEBHOOK_SECRET = 'test-secret';
    const raw = JSON.stringify({ type: 'payment.succeeded', id: 'evt_test_1' });
    const signature = crypto.createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET).update(raw).digest('hex');
    const invalid = await request(app).post('/api/v1/integracoes/webhooks/test').set('Content-Type', 'application/json').set('x-webhook-signature', 'bad').send(raw);
    expect(invalid.status).toBe(401);
    const valid = await request(app).post('/api/v1/integracoes/webhooks/test').set('Content-Type', 'application/json').set('x-webhook-signature', signature).send(raw);
    expect(valid.status).toBe(202);
    delete process.env.BILLING_WEBHOOK_SECRET;
  });

  it('recebe eventos de sincronização com HMAC e idempotência', async () => {
    process.env.SYNC_SHARED_SECRET = 'sync-secret';
    const currentUser = await db('users').where({ email: 'avaliador@example.com' }).first();
    const payload = JSON.stringify({ events: [{ organization_id: currentUser.organization_id, event_id: 'evt-sync-test-1', entity_type: 'client', entity_id: String(client.id), operation: 'upsert', payload: { name: 'Cliente replicado' } }] });
    const signature = crypto.createHmac('sha256', process.env.SYNC_SHARED_SECRET).update(payload).digest('hex');
    const first = await request(app).post('/sync/events').set('Content-Type', 'application/json').set('X-GeoMind-Organization', String(currentUser.organization_id)).set('X-GeoMind-Signature', signature).send(payload);
    expect(first.status).toBe(202);
    expect(first.body.received).toBe(1);
    const duplicate = await request(app).post('/sync/events').set('Content-Type', 'application/json').set('X-GeoMind-Organization', String(currentUser.organization_id)).set('X-GeoMind-Signature', signature).send(payload);
    expect(duplicate.status).toBe(202);
    expect(duplicate.body.duplicates).toBe(1);
    delete process.env.SYNC_SHARED_SECRET;
  });

  it('mantém um ledger transacional de créditos', async () => {
    const previousProvider = process.env.BILLING_PROVIDER;
    try {
      process.env.BILLING_PROVIDER = 'local';
      const topUp = await agent.post('/api/v1/billing/top-up').send({ amount_cents: 500 });
      expect(topUp.status).toBe(201);
      expect(topUp.body.novoSaldo).toBe(500);

      const consume = await agent.post('/api/v1/billing/consume').send({ amount_cents: 100, type: 'usage' });
      expect(consume.status).toBe(201);
      expect(consume.body.novoSaldo).toBe(400);

      const summary = await agent.get('/api/v1/billing/summary');
      expect(summary.body.balance_cents).toBe(400);
    } finally {
      process.env.BILLING_PROVIDER = previousProvider;
    }
  });

  it('bloqueia cobrança local em produção', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousProvider = process.env.BILLING_PROVIDER;
    try {
      process.env.NODE_ENV = 'production';
      process.env.BILLING_PROVIDER = 'local';
      const response = await agent.post('/api/v1/billing/top-up').send({ amount_cents: 500 });
      expect(response.status).toBe(503);
      expect(response.body.code).toBe('BILLING_NOT_CONFIGURED');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.BILLING_PROVIDER = previousProvider;
    }
  });

  it('impede acesso de um segundo usuário a outra organização', async () => {
    const otherAgent = request.agent(app);
    const register = await otherAgent.post('/api/v1/usuarios/register').send({ name: 'Outro Usuário', email: 'outro@example.com', password: 'senha-segura-456', organization_name: 'Outra Organização' });
    expect(register.status).toBe(201);
    const list = await otherAgent.get('/api/v1/projetos');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
    const access = await otherAgent.get(`/api/v1/projetos/${project.id}`);
    expect(access.status).toBe(404);
  });

  it('encerra a sessão', async () => {
    const response = await agent.post('/api/v1/usuarios/logout');
    expect(response.status).toBe(204);
    const profile = await agent.get('/api/v1/usuarios/perfil');
    expect(profile.status).toBe(401);
  });
});
