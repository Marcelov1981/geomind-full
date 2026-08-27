import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import api, { API_ENDPOINTS } from '../config/api';
import { addLogoToPDF } from '../utils/LogoUtils.jsx';

const LaudoPDF = ({ avaliacao, onClose }) => {
  const [laudoData, setLaudoData] = useState({
    numeroLaudo: '',
    dataEmissao: new Date().toISOString().split('T')[0],
    responsavelTecnico: '',
    tipoRegistro: 'CREA',
    registroProfissional: '',
    observacoesFinais: '',
    incluirImagens: true,
    imagensDescritivas: [],
    imagensComparativas: [],
    selecaoAutomatica: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userLoading, setUserLoading] = useState(true);

  // Carregar dados do usuário logado
  useEffect(() => {
    const carregarDadosUsuario = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.usuarios.profile);
        
        const usuario = response.data.user;
        if (usuario) {
          setLaudoData(prev => ({
            ...prev,
            responsavelTecnico: usuario.nome || '',
            registroProfissional: usuario.registroProfissional || '',
            tipoRegistro: usuario.tipoRegistro || 'CREA'
          }));
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Erro ao carregar dados do usuário:', error);
      } finally {
        setUserLoading(false);
      }
    };

    carregarDadosUsuario();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLaudoData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = (event, tipo) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      setError('Apenas arquivos de imagem são permitidos.');
      return;
    }
    
    setLaudoData(prev => ({
      ...prev,
      [tipo]: [...prev[tipo], ...imageFiles]
    }));
    setError('');
  };

  const removeImage = (index, tipo) => {
    setLaudoData(prev => ({
      ...prev,
      [tipo]: prev[tipo].filter((_, i) => i !== index)
    }));
  };

  const selectBestImages = (images, maxCount = 3) => {
    // Algoritmo simples para selecionar as melhores imagens baseado no tamanho
    return [...images]
      .sort((a, b) => b.size - a.size) // Ordena por tamanho (maior = melhor qualidade)
      .slice(0, maxCount);
  };

  const incluirImagensNoPDF = async (doc, images, startY, tipoImagem) => {
    let yPosition = startY;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const imageWidth = (pageWidth - 3 * margin) / 2; // 2 imagens por linha
    const imageHeight = 80;
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Verificar se precisa de nova página
      if (yPosition + imageHeight + 30 > 280) {
        doc.addPage();
        yPosition = margin + 20;
      }
      
      // Calcular posição (2 imagens por linha)
       const col = i % 2;
       const xPosition = margin + col * (imageWidth + margin);
       
       try {
         // Converter imagem para base64
         const reader = new FileReader();
         const imageData = await new Promise((resolve, reject) => {
           reader.onload = (e) => resolve(e.target.result);
           reader.onerror = () => reject(new Error(`Falha ao ler ${image.name}`));
           reader.readAsDataURL(image);
         });
         
         // Adicionar imagem
         doc.addImage(imageData, 'JPEG', xPosition, yPosition, imageWidth, imageHeight);
         
         // Adicionar legenda
         doc.setFontSize(9);
         doc.setFont('helvetica', 'normal');
         const legenda = `${tipoImagem} ${i + 1}: ${image.name}`;
         const legendaLines = doc.splitTextToSize(legenda, imageWidth);
         doc.text(legendaLines, xPosition, yPosition + imageHeight + 8);
         
       } catch (error) {
         if (import.meta.env.DEV) console.error('Erro ao processar imagem:', error);
         // Adicionar placeholder em caso de erro
         doc.setDrawColor(200, 200, 200);
         doc.rect(xPosition, yPosition, imageWidth, imageHeight);
         doc.setFontSize(10);
         doc.text('Erro ao carregar imagem', xPosition + 10, yPosition + imageHeight/2);
       }
       
       // Avançar posição Y apenas a cada 2 imagens
       if (col === 1 || i === images.length - 1) {
         yPosition += imageHeight + 25;
       }
    }
    
    return yPosition;
  };

  const gerarPDF = async () => {
    try {
      setLoading(true);
      setError('');

      // Criar novo documento PDF
      const doc = new jsPDF();
      
      // Configurações do documento
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      let yPosition = 30;

      // Adicionar logomarca se configurada
      await addLogoToPDF(doc, pageWidth, doc.internal.pageSize.height, margin, true);

      // Cabeçalho
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('LAUDO DE AVALIAÇÃO IMOBILIÁRIA', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;

      // Número do laudo e data
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Laudo Nº: ${laudoData.numeroLaudo}`, margin, yPosition);
      doc.text(`Data de Emissão: ${new Date(laudoData.dataEmissao).toLocaleDateString('pt-BR')}`, pageWidth - margin - 60, yPosition);
      yPosition += 20;

      // Linha separadora
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;

      // Dados do projeto
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('1. DADOS DO IMÓVEL', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Projeto: ${avaliacao.orcamento?.projeto?.nome || 'N/A'}`, margin, yPosition);
      yPosition += 8;
      doc.text(`Cliente: ${avaliacao.orcamento?.projeto?.cliente?.nome || 'N/A'}`, margin, yPosition);
      yPosition += 8;
      doc.text(`Endereço: ${avaliacao.orcamento?.projeto?.endereco || 'N/A'}`, margin, yPosition);
      yPosition += 8;
      doc.text(`Tipo de Avaliação: ${avaliacao.orcamento?.tipoAvaliacao || 'N/A'}`, margin, yPosition);
      yPosition += 15;

      // Metodologia
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('2. METODOLOGIA UTILIZADA', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Metodologia: ${avaliacao.metodologiaUtilizada}`, margin, yPosition);
      yPosition += 15;

      // Considerações técnicas
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('3. CONSIDERAÇÕES TÉCNICAS', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const consideracoes = doc.splitTextToSize(avaliacao.consideracoes, pageWidth - 2 * margin);
      doc.text(consideracoes, margin, yPosition);
      yPosition += consideracoes.length * 6 + 10;

      // Observações técnicas
      if (avaliacao.observacoesTecnicas) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('4. OBSERVAÇÕES TÉCNICAS', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const observacoes = doc.splitTextToSize(avaliacao.observacoesTecnicas, pageWidth - 2 * margin);
        doc.text(observacoes, margin, yPosition);
        yPosition += observacoes.length * 6 + 10;
      }

      // Valor final
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('5. VALOR DA AVALIAÇÃO', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor Final: R$ ${avaliacao.valorFinal?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin, yPosition);
      yPosition += 20;

      // Observações finais
      if (laudoData.observacoesFinais) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('6. OBSERVAÇÕES FINAIS', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const obsFinais = doc.splitTextToSize(laudoData.observacoesFinais, pageWidth - 2 * margin);
        doc.text(obsFinais, margin, yPosition);
        yPosition += obsFinais.length * 6 + 20;
      }

      // Incluir imagens se selecionado
      if (laudoData.incluirImagens) {
        // Imagens descritivas
        if (laudoData.imagensDescritivas.length > 0) {
          // Nova página para imagens
          doc.addPage();
          yPosition = margin + 20;
          
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('DOCUMENTAÇÃO FOTOGRÁFICA - PARTE DESCRITIVA', margin, yPosition);
          yPosition += 20;
          
          const imagensParaIncluir = laudoData.selecaoAutomatica && laudoData.imagensDescritivas.length > 3
            ? selectBestImages(laudoData.imagensDescritivas, 3)
            : laudoData.imagensDescritivas;
          
          await incluirImagensNoPDF(doc, imagensParaIncluir, yPosition, 'Imagem Descritiva');
        }
        
        // Imagens comparativas
        if (laudoData.imagensComparativas.length > 0) {
          // Nova página para imagens comparativas
          doc.addPage();
          yPosition = margin + 20;
          
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('DOCUMENTAÇÃO FOTOGRÁFICA - PARTE COMPARATIVA', margin, yPosition);
          yPosition += 20;
          
          const imagensParaIncluir = laudoData.selecaoAutomatica && laudoData.imagensComparativas.length > 3
            ? selectBestImages(laudoData.imagensComparativas, 3)
            : laudoData.imagensComparativas;
          
          await incluirImagensNoPDF(doc, imagensParaIncluir, yPosition, 'Imagem Comparativa');
        }
      }

      // Verificar se precisa de nova página
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 30;
      }

      // Responsável técnico e assinatura
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RESPONSÁVEL TÉCNICO', margin, yPosition);
      yPosition += 15;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nome: ${laudoData.responsavelTecnico}`, margin, yPosition);
      yPosition += 8;
      doc.text(`${laudoData.tipoRegistro}: ${laudoData.registroProfissional}`, margin, yPosition);
      yPosition += 25;

      // Espaço para assinatura mais profissional
      const assinaturaWidth = 120;
      const assinaturaX = margin;
      
      // Retângulo para assinatura
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(assinaturaX, yPosition, assinaturaWidth, 30);
      
      // Linha para assinatura dentro do retângulo
      doc.line(assinaturaX + 10, yPosition + 20, assinaturaX + assinaturaWidth - 10, yPosition + 20);
      
      // Texto da assinatura
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Assinatura do Responsável Técnico', assinaturaX + 10, yPosition + 27);
      
      // Data e local no lado direito
      const dataX = assinaturaX + assinaturaWidth + 20;
      doc.text(`Local: ${avaliacao.orcamento?.projeto?.cliente?.cidade || '_________________'}`, dataX, yPosition + 10);
      doc.text(`Data: ${new Date(laudoData.dataEmissao).toLocaleDateString('pt-BR')}`, dataX, yPosition + 20);
      
      yPosition += 40;
      
      // Carimbo profissional
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('CARIMBO PROFISSIONAL:', margin, yPosition);
      yPosition += 5;
      
      // Retângulo para carimbo
      doc.rect(margin, yPosition, 80, 25);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('(Espaço reservado para carimbo)', margin + 5, yPosition + 15);

      // Salvar o PDF
      const fileName = `Laudo_${laudoData.numeroLaudo}_${avaliacao.orcamento?.projeto?.nome?.replace(/\s+/g, '_') || 'Projeto'}.pdf`;
      doc.save(fileName);

      // Salvar dados do laudo no backend
      await salvarLaudo();

      alert('Laudo gerado com sucesso!');
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Erro ao gerar PDF:', error);
      setError('Erro ao gerar o laudo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const salvarLaudo = async () => {
    try {
      const laudoPayload = {
        avaliacaoId: avaliacao.id,
        numeroLaudo: laudoData.numeroLaudo,
        dataEmissao: laudoData.dataEmissao,
        responsavelTecnico: laudoData.responsavelTecnico,
        registroProfissional: laudoData.registroProfissional,
        tipoRegistro: laudoData.tipoRegistro,
        observacoesFinais: laudoData.observacoesFinais,
        status: 'emitido'
      };

      await api.post(API_ENDPOINTS.laudos.base, laudoPayload);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Erro ao salvar laudo:', error);
      // Não bloquear a geração do PDF por erro no backend
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!laudoData.numeroLaudo || !laudoData.responsavelTecnico || !laudoData.registroProfissional) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    gerarPDF();
  };

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modal: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '90vh',
      overflow: 'auto'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    title: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#1e293b'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#64748b'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151'
    },
    input: {
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: '#ffffff'
    },
    select: {
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      cursor: 'pointer'
    },
    textarea: {
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      minHeight: '80px',
      resize: 'vertical'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '20px'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.2s'
    },
    cancelButton: {
      backgroundColor: '#f8fafc',
      color: '#64748b',
      border: '1px solid #e2e8f0'
    },
    submitButton: {
      backgroundColor: '#059669',
      color: 'white'
    },
    error: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '14px',
      marginBottom: '16px'
    },
    avaliacaoInfo: {
      backgroundColor: '#f8fafc',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '20px'
    },
    infoTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#1e293b',
      marginBottom: '8px'
    },
    infoText: {
      fontSize: '14px',
      color: '#64748b',
      marginBottom: '4px'
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Gerar Laudo Final</h3>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Informações da Avaliação */}
        <div style={styles.avaliacaoInfo}>
          <div style={styles.infoTitle}>Dados da Avaliação</div>
          <div style={styles.infoText}>Projeto: {avaliacao.orcamento?.projeto?.nome || 'N/A'}</div>
          <div style={styles.infoText}>Cliente: {avaliacao.orcamento?.projeto?.cliente?.nome || 'N/A'}</div>
          <div style={styles.infoText}>Valor Final: R$ {avaliacao.valorFinal?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
          <div style={styles.infoText}>Metodologia: {avaliacao.metodologiaUtilizada}</div>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {userLoading && (
            <div style={{...styles.error, backgroundColor: '#f0f9ff', color: '#0369a1'}}>
              Carregando dados do usuário...
            </div>
          )}
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Número do Laudo *</label>
            <input
              type="text"
              name="numeroLaudo"
              value={laudoData.numeroLaudo}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="Ex: LAV-2024-001"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Data de Emissão *</label>
            <input
              type="date"
              name="dataEmissao"
              value={laudoData.dataEmissao}
              onChange={handleInputChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Responsável Técnico *</label>
            <input
              type="text"
              name="responsavelTecnico"
              value={laudoData.responsavelTecnico}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="Nome completo do responsável técnico"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Registro *</label>
            <select
              name="tipoRegistro"
              value={laudoData.tipoRegistro}
              onChange={handleInputChange}
              style={styles.select}
              required
            >
              <option value="CREA">CREA</option>
              <option value="CAU">CAU</option>
              <option value="CRECI">CRECI</option>
              <option value="IBAPE">IBAPE</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Número do Registro Profissional *</label>
            <input
              type="text"
              name="registroProfissional"
              value={laudoData.registroProfissional}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="Ex: CREA/SP 123456789"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Observações Finais</label>
            <textarea
              name="observacoesFinais"
              value={laudoData.observacoesFinais}
              onChange={handleInputChange}
              style={styles.textarea}
              placeholder="Observações adicionais para o laudo final..."
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              <input
                type="checkbox"
                name="incluirImagens"
                checked={laudoData.incluirImagens}
                onChange={handleInputChange}
                style={{marginRight: '8px'}}
              />
              Incluir imagens no laudo
            </label>
          </div>

          {laudoData.incluirImagens && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <input
                    type="checkbox"
                    name="selecaoAutomatica"
                    checked={laudoData.selecaoAutomatica}
                    onChange={handleInputChange}
                    style={{marginRight: '8px'}}
                  />
                  Seleção automática das melhores imagens
                </label>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Imagens Descritivas</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'imagensDescritivas')}
                  style={styles.input}
                />
                {laudoData.imagensDescritivas.length > 0 && (
                  <div style={{marginTop: '10px'}}>
                    <p style={{fontSize: '12px', color: '#666'}}>
                      {laudoData.imagensDescritivas.length} imagem(ns) selecionada(s)
                      {laudoData.selecaoAutomatica && laudoData.imagensDescritivas.length > 3 && 
                        ' (3 melhores serão selecionadas automaticamente)'}
                    </p>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px'}}>
                      {laudoData.imagensDescritivas.map((img, index) => (
                        <div key={index} style={{position: 'relative', display: 'inline-block'}}>
                          <span style={{fontSize: '10px', padding: '2px 6px', backgroundColor: '#f0f0f0', borderRadius: '3px'}}>
                            {img.name.substring(0, 15)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => removeImage(index, 'imagensDescritivas')}
                            style={{marginLeft: '5px', fontSize: '10px', color: 'red', background: 'none', border: 'none', cursor: 'pointer'}}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Imagens Comparativas</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'imagensComparativas')}
                  style={styles.input}
                />
                {laudoData.imagensComparativas.length > 0 && (
                  <div style={{marginTop: '10px'}}>
                    <p style={{fontSize: '12px', color: '#666'}}>
                      {laudoData.imagensComparativas.length} imagem(ns) selecionada(s)
                      {laudoData.selecaoAutomatica && laudoData.imagensComparativas.length > 3 && 
                        ' (3 melhores serão selecionadas automaticamente)'}
                    </p>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px'}}>
                      {laudoData.imagensComparativas.map((img, index) => (
                        <div key={index} style={{position: 'relative', display: 'inline-block'}}>
                          <span style={{fontSize: '10px', padding: '2px 6px', backgroundColor: '#f0f0f0', borderRadius: '3px'}}>
                            {img.name.substring(0, 15)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => removeImage(index, 'imagensComparativas')}
                            style={{marginLeft: '5px', fontSize: '10px', color: 'red', background: 'none', border: 'none', cursor: 'pointer'}}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              style={{...styles.button, ...styles.cancelButton}}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{...styles.button, ...styles.submitButton}}
            >
              {loading ? 'Gerando...' : 'Gerar Laudo PDF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LaudoPDF;