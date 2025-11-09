import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'node:process';
import connectDB from '../config/database.js';
import Cliente from '../models/Cliente.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrateClientes = async () => {
  try {
    // Conectar ao MongoDB
    await connectDB();
    console.log('✅ Conectado ao MongoDB');

    // Ler dados do arquivo JSON
    const dataPath = path.join(__dirname, '../data/clientes.json');
    
    if (!fs.existsSync(dataPath)) {
      console.log('❌ Arquivo clientes.json não encontrado');
      return;
    }

    const jsonData = fs.readFileSync(dataPath, 'utf8');
    const clientes = JSON.parse(jsonData);

    console.log(`📊 Encontrados ${clientes.length} clientes no arquivo JSON`);

    // Verificar se já existem dados no MongoDB
    const existingCount = await Cliente.countDocuments();
    console.log(`📊 Existem ${existingCount} clientes no MongoDB`);

    if (existingCount > 0) {
      console.log('⚠️ Já existem dados no MongoDB. Deseja continuar? (y/n)');
      // Para automação, vamos prosseguir
    }

    // Migrar cada cliente
    let migrated = 0;
    let skipped = 0;

    for (const clienteData of clientes) {
      try {
        // Verificar se o cliente já existe (por documento ou email)
        const existing = await Cliente.findOne({
          $or: [
            { documento: clienteData.documento },
            { email: clienteData.email }
          ]
        });

        if (existing) {
          console.log(`⏭️ Cliente ${clienteData.nome} já existe, pulando...`);
          skipped++;
          continue;
        }

        // Criar novo cliente no MongoDB
        const novoCliente = new Cliente({
          nome: clienteData.nome,
          email: clienteData.email,
          telefone: clienteData.telefone,
          documento: clienteData.documento,
          tipo_pessoa: clienteData.tipo_pessoa,
          endereco: clienteData.endereco,
          cidade: clienteData.cidade,
          estado: clienteData.estado,
          cep: clienteData.cep,
          registroProfissional: clienteData.registroProfissional || '',
          tipoRegistro: clienteData.tipoRegistro || 'OUTRO',
          observacoes: clienteData.observacoes || '',
          status: clienteData.status || 'ativo',
          usuario_id: clienteData.usuario_id,
          createdAt: clienteData.createdAt ? new Date(clienteData.createdAt) : new Date(),
          updatedAt: clienteData.updatedAt ? new Date(clienteData.updatedAt) : new Date()
        });

        await novoCliente.save();
        console.log(`✅ Cliente ${clienteData.nome} migrado com sucesso`);
        migrated++;

      } catch (error) {
        console.error(`❌ Erro ao migrar cliente ${clienteData.nome}:`, error.message);
      }
    }

    console.log('\n📊 Resumo da migração:');
    console.log(`✅ Migrados: ${migrated}`);
    console.log(`⏭️ Pulados: ${skipped}`);
    console.log(`📊 Total processados: ${migrated + skipped}`);

    // Criar backup do arquivo JSON
    const backupPath = path.join(__dirname, '../data/clientes.json.backup');
    fs.copyFileSync(dataPath, backupPath);
    console.log(`💾 Backup criado em: ${backupPath}`);

    console.log('\n🎉 Migração concluída com sucesso!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  }
};

// Executar migração
migrateClientes();