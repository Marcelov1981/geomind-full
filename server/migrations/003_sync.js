export async function up(db) {
  if (!(await db.schema.hasTable('sync_outbox'))) {
    await db.schema.createTable('sync_outbox', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('event_id', 80).notNullable();
      table.string('entity_type', 80).notNullable();
      table.string('entity_id', 80).notNullable();
      table.string('operation', 40).notNullable();
      table.json('payload').notNullable();
      table.string('status', 40).notNullable().defaultTo('pending');
      table.integer('attempts').notNullable().defaultTo(0);
      table.text('last_error');
      table.timestamp('available_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('processed_at');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.unique(['organization_id', 'event_id']);
      table.index(['organization_id', 'status', 'available_at']);
    });
  }
}

export async function down(db) {
  await db.schema.dropTableIfExists('sync_outbox');
}
