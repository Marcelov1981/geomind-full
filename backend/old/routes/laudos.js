import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de dados
const dataPath = path.join(__dirname, '../data/laudos.json');

// Função para ler dados
const readData = () => {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Erro ao ler dados de laudos:', error);
    return [];
  }
};

// Função para salvar dados
const saveData = (data) => {
  try {
    // Criar diretório se não existir
    const dir = path.dirname(dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados de laudos:', error);
    return false;
  }
};

// GET - Listar todos os laudos
router.get('/', (req, res) => {
  try {
    const laudos = readData();
    res.json(laudos);
  } catch (error) {
    console.error('Erro ao buscar laudos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET - Buscar laudo por ID
router.get('/:id', (req, res) => {
  try {
    const laudos = readData();
    const laudo = laudos.find(l => l.id === req.params.id);
    
    if (!laudo) {
      return res.status(404).json({ error: 'Laudo não encontrado' });
    }
    
    res.json(laudo);
  } catch (error) {
    console.error('Erro ao buscar laudo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST - Criar novo laudo
router.post('/', (req, res) => {
  try {
    const laudos = readData();
    const novoLaudo = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    laudos.push(novoLaudo);
    
    if (saveData(laudos)) {
      res.status(201).json(novoLaudo);
    } else {
      res.status(500).json({ error: 'Erro ao salvar laudo' });
    }
  } catch (error) {
    console.error('Erro ao criar laudo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT - Atualizar laudo
router.put('/:id', (req, res) => {
  try {
    const laudos = readData();
    const index = laudos.findIndex(l => l.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Laudo não encontrado' });
    }
    
    laudos[index] = {
      ...laudos[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    if (saveData(laudos)) {
      res.json(laudos[index]);
    } else {
      res.status(500).json({ error: 'Erro ao atualizar laudo' });
    }
  } catch (error) {
    console.error('Erro ao atualizar laudo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE - Deletar laudo
router.delete('/:id', (req, res) => {
  try {
    const laudos = readData();
    const index = laudos.findIndex(l => l.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Laudo não encontrado' });
    }
    
    laudos.splice(index, 1);
    
    if (saveData(laudos)) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: 'Erro ao deletar laudo' });
    }
  } catch (error) {
    console.error('Erro ao deletar laudo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;