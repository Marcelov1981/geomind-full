export async function up(db) {
  const has = (table) => db.schema.hasTable(table);

  if (!(await has('organizations'))) {
    await db.schema.createTable('organizations', (table) => {
      table.increments('id').primary();
      table.string('name', 160).notNullable();
      table.string('slug', 180).notNullable().unique();
      table.string('plan', 40).notNullable().defaultTo('trial');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
    });
  }

  if (!(await has('users'))) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 160).notNullable();
      table.string('email', 255).notNullable();
      table.string('password_hash', 255).notNullable();
      table.string('role', 40).notNullable().defaultTo('analyst');
      table.boolean('active').notNullable().defaultTo(true);
      table.timestamp('last_login_at');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.unique(['organization_id', 'email']);
    });
  }

  if (!(await has('clients'))) {
    await db.schema.createTable('clients', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('name', 180).notNullable();
      table.string('document', 40);
      table.string('email', 255);
      table.string('phone', 40);
      table.text('notes');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id']);
    });
  }

  if (!(await has('projects'))) {
    await db.schema.createTable('projects', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('SET NULL');
      table.string('name', 180).notNullable();
      table.string('status', 40).notNullable().defaultTo('draft');
      table.string('purpose', 120);
      table.string('address', 255);
      table.string('city', 120);
      table.string('state', 80);
      table.string('postal_code', 20);
      table.decimal('latitude', 10, 7);
      table.decimal('longitude', 10, 7);
      table.text('notes');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'status']);
    });
  }

  if (!(await has('budgets'))) {
    await db.schema.createTable('budgets', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.decimal('amount', 14, 2).notNullable().defaultTo(0);
      table.string('status', 40).notNullable().defaultTo('draft');
      table.text('notes');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'project_id']);
    });
  }

  if (!(await has('evaluations'))) {
    await db.schema.createTable('evaluations', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('type', 80).notNullable().defaultTo('simplified');
      table.string('status', 40).notNullable().defaultTo('draft');
      table.decimal('estimated_value', 14, 2);
      table.json('assumptions');
      table.json('results');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'project_id', 'status']);
    });
  }

  if (!(await has('evidences'))) {
    await db.schema.createTable('evidences', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.integer('evaluation_id').unsigned().references('id').inTable('evaluations').onDelete('SET NULL');
      table.string('kind', 40).notNullable().defaultTo('image');
      table.string('file_name', 255).notNullable();
      table.string('mime_type', 120).notNullable();
      table.integer('size_bytes').notNullable().defaultTo(0);
      table.string('storage_key', 500).notNullable();
      table.string('checksum', 128);
      table.json('metadata');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'project_id']);
    });
  }

  if (!(await has('ai_analyses'))) {
    await db.schema.createTable('ai_analyses', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('evidence_id').unsigned().notNullable().references('id').inTable('evidences').onDelete('CASCADE');
      table.string('provider', 60).notNullable().defaultTo('google-gemini');
      table.string('model', 120).notNullable();
      table.string('prompt_version', 80).notNullable();
      table.string('status', 40).notNullable().defaultTo('pending');
      table.json('output');
      table.text('error_message');
      table.integer('latency_ms');
      table.integer('input_tokens');
      table.integer('output_tokens');
      table.timestamp('reviewed_at');
      table.integer('reviewed_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'evidence_id', 'status']);
    });
  }

  if (!(await has('reports'))) {
    await db.schema.createTable('reports', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.integer('evaluation_id').unsigned().references('id').inTable('evaluations').onDelete('SET NULL');
      table.string('number', 80).notNullable();
      table.string('title', 255).notNullable();
      table.string('status', 40).notNullable().defaultTo('draft');
      table.string('template_version', 80).notNullable().defaultTo('v1');
      table.json('content');
      table.string('pdf_storage_key', 500);
      table.integer('approved_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('approved_at');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.unique(['organization_id', 'number']);
      table.index(['organization_id', 'project_id', 'status']);
    });
  }

  if (!(await has('geo_runs'))) {
    await db.schema.createTable('geo_runs', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('provider', 80).notNullable();
      table.string('operation', 80).notNullable();
      table.string('status', 40).notNullable().defaultTo('complete');
      table.json('request');
      table.json('response');
      table.string('source_url', 500);
      table.timestamp('observed_at').notNullable().defaultTo(db.fn.now());
      table.integer('latency_ms');
      table.index(['organization_id', 'project_id', 'operation']);
    });
  }

  if (!(await has('audit_logs'))) {
    await db.schema.createTable('audit_logs', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('action', 120).notNullable();
      table.string('entity_type', 80);
      table.string('entity_id', 80);
      table.json('metadata');
      table.string('ip_hash', 128);
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'created_at']);
    });
  }

  if (!(await has('billing_events'))) {
    await db.schema.createTable('billing_events', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().references('id').inTable('organizations').onDelete('SET NULL');
      table.string('provider', 60).notNullable();
      table.string('event_id', 255).notNullable();
      table.string('event_type', 120).notNullable();
      table.json('payload').notNullable();
      table.timestamp('processed_at');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.unique(['provider', 'event_id']);
    });
  }
}

export async function down(db) {
  for (const table of ['billing_events', 'audit_logs', 'geo_runs', 'reports', 'ai_analyses', 'evidences', 'evaluations', 'budgets', 'projects', 'clients', 'users', 'organizations']) {
    if (await db.schema.hasTable(table)) await db.schema.dropTableIfExists(table);
  }
}
