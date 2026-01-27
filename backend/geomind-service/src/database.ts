import { MongoClient, Db } from 'mongodb';

// Default to the provided MongoDB Atlas cluster URI, overridable via env
const MONGODB_URL: string =
  process.env.MONGODB_URL ||
  'mongodb+srv://geomind:geomind@geomindcluster.48itfjm.mongodb.net/admin?appName=GeoMindCluster&retryWrites=true&loadBalanced=false&replicaSet=atlas-u5d8i8-shard-0&readPreference=primary&srvServiceName=mongodb&connectTimeoutMS=10000&w=majority&authSource=admin&authMechanism=SCRAM-SHA-1';
const DATABASE_NAME: string = process.env.DATABASE_NAME || 'realstate_audit';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectToMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGODB_URL);
  await client.connect();
  db = client.db(DATABASE_NAME);
  console.log(`✅ Connected to MongoDB (URI set), db: ${DATABASE_NAME}`);
  await ensureIndexes(db);
  return db;
}

export function getDatabase(): Db {
  if (!db) throw new Error('Database not initialized. Call connectToMongo first.');
  return db;
}

export async function closeMongoConnection(): Promise<void> {
  if (client) await client.close();
}

async function ensureIndexes(d: Db) {
  try {
    await d.collection('clientes').createIndex({ email: 1 });
    await d.collection('clientes').createIndex({ status: 1 });
    await d.collection('projetos').createIndex({ cliente_id: 1 });
    await d.collection('projetos').createIndex({ created_at: -1 });
    await d.collection('orcamentos').createIndex({ projetoId: 1 });
    await d.collection('orcamentos').createIndex({ created_at: -1 });
    await d.collection('avaliacoes').createIndex({ projeto_id: 1 });
    await d.collection('avaliacoes').createIndex({ orcamento_id: 1 });
    await d.collection('analyses').createIndex({ real_estate_id: 1 });
    await d.collection('settings').createIndex({ type: 1 }, { unique: true });
  } catch {}
}
