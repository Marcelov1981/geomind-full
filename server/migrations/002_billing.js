export async function up(db) {
  if (!(await db.schema.hasTable('credit_accounts'))) {
    await db.schema.createTable('credit_accounts', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('balance_cents').notNullable().defaultTo(0);
      table.integer('monthly_used').notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.unique(['organization_id']);
    });
  }

  if (!(await db.schema.hasTable('transactions'))) {
    await db.schema.createTable('transactions', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.string('type', 60).notNullable();
      table.integer('amount_cents').notNullable().defaultTo(0);
      table.string('status', 40).notNullable().defaultTo('pending');
      table.string('provider', 60);
      table.string('provider_ref', 255);
      table.json('metadata');
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id', 'created_at']);
      table.unique(['provider', 'provider_ref']);
    });
  }

  if (!(await db.schema.hasTable('payment_methods'))) {
    await db.schema.createTable('payment_methods', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.string('provider', 60).notNullable();
      table.string('provider_token', 255).notNullable();
      table.string('brand', 40);
      table.string('last4', 4);
      table.boolean('is_default').notNullable().defaultTo(false);
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
      table.index(['organization_id']);
      table.unique(['provider', 'provider_token']);
    });
  }
}

export async function down(db) {
  for (const table of ['payment_methods', 'transactions', 'credit_accounts']) {
    await db.schema.dropTableIfExists(table);
  }
}
