export async function up(db) {
  if (!(await db.schema.hasTable('backups'))) {
    await db.schema.createTable('backups', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('file_name', 255).notNullable();
      table.string('storage_key', 500).notNullable();
      table.integer('size_bytes').notNullable().defaultTo(0);
      table.string('checksum', 128).notNullable();
      table.string('status', 40).notNullable().defaultTo('complete');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'created_at']);
    });
  }
}

export async function down(db) {
  await db.schema.dropTableIfExists('backups');
}
