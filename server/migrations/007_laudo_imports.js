export async function up(db) {
  if (!(await db.schema.hasTable('laudo_imports'))) {
    await db.schema.createTable('laudo_imports', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('file_name', 255).notNullable();
      table.string('file_type', 20).notNullable();
      table.integer('size_bytes').notNullable().defaultTo(0);
      table.string('checksum', 128).notNullable();
      table.string('status', 40).notNullable().defaultTo('analyzed');
      table.json('integrity_report').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'project_id', 'created_at']);
    });
  }
}

export async function down(db) {
  await db.schema.dropTableIfExists('laudo_imports');
}
