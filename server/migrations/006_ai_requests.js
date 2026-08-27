export async function up(db) {
  if (!(await db.schema.hasTable('ai_requests'))) {
    await db.schema.createTable('ai_requests', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('evidence_id').unsigned().notNullable().references('id').inTable('evidences').onDelete('CASCADE');
      table.string('idempotency_key', 160).notNullable();
      table.string('status', 40).notNullable().defaultTo('processing');
      table.integer('analysis_id').unsigned().references('id').inTable('ai_analyses').onDelete('SET NULL');
      table.text('error_message');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.unique(['organization_id', 'evidence_id', 'idempotency_key']);
      table.index(['organization_id', 'status', 'created_at']);
    });
  }
}

export async function down(db) {
  await db.schema.dropTableIfExists('ai_requests');
}
