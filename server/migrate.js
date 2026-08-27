import { db, closeDatabase, databaseInfo } from './db.js';
import { up as migrateInitial } from './migrations/001_initial.js';
import { up as migrateBilling } from './migrations/002_billing.js';
import { up as migrateSync } from './migrations/003_sync.js';
import { up as migrateBackups } from './migrations/004_backups.js';
import { up as migrateSyncInbox } from './migrations/005_sync_inbox.js';
import { up as migrateAiRequests } from './migrations/006_ai_requests.js';
import { up as migrateLaudoImports } from './migrations/007_laudo_imports.js';

try {
  await migrateInitial(db);
  await migrateBilling(db);
  await migrateSync(db);
  await migrateBackups(db);
  await migrateSyncInbox(db);
  await migrateAiRequests(db);
  await migrateLaudoImports(db);
  console.log(`GeoMind database ready (${databaseInfo.driver})`);
} finally {
  await closeDatabase();
}
