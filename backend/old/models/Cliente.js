import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  telefone: {
    type: String,
    required: true,
    trim: true
  },
  documento: {
    type: String,
    required: true,
    trim: true
  },
  tipo_pessoa: {
    type: String,
    enum: ['fisica', 'juridica'],
    required: true
  },
  endereco: {
    type: String,
    required: true,
    trim: true
  },
  cidade: {
    type: String,
    required: true,
    trim: true
  },
  estado: {
    type: String,
    required: true,
    trim: true
  },
  cep: {
    type: String,
    required: true,
    trim: true
  },
  registroProfissional: {
    type: String,
    trim: true,
    default: ''
  },
  tipoRegistro: {
    type: String,
    enum: ['CREA', 'CAU', 'CRECI', 'OUTRO'],
    default: 'OUTRO'
  },
  observacoes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['ativo', 'inativo'],
    default: 'ativo'
  },
  usuario_id: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Índices para melhor performance
clienteSchema.index({ usuario_id: 1 });
clienteSchema.index({ email: 1 });
clienteSchema.index({ documento: 1 });

const Cliente = mongoose.model('Cliente', clienteSchema);

export default Cliente;