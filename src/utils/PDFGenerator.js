import { jsPDF } from 'jspdf';
import { addLogoToPDF } from './LogoUtils.jsx';
import SafariCompatibility from './SafariCompatibility.js';

class PDFGenerator {
  constructor() {
    this.doc = null;
    this.currentY = 20;
    this.pageHeight = 297; // A4 height in mm
    this.margin = 20;
    this.lineHeight = 7;
  }

  // Inicializa um novo documento PDF
  initDocument() {
    this.doc = new jsPDF();
    this.currentY = 20;
    return this.doc;
  }

  // Adiciona cabeçalho do relatório
  addHeader(title, subtitle = '') {
    if (!this.doc) this.initDocument();
    
    // Título principal
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 10;
    
    // Subtítulo
    if (subtitle) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(subtitle, this.margin, this.currentY);
      this.currentY += 8;
    }
    
    // Data e hora
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const now = new Date();
    const dateStr = `Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
    this.doc.text(dateStr, this.margin, this.currentY);
    this.currentY += 15;
    
    // Linha separadora
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, 190, this.currentY);
    this.currentY += 10;
  }

  // Adiciona seção com título
  addSection(title, content) {
    if (!this.doc) this.initDocument();
    
    this.checkPageBreak(20);
    
    // Título da seção
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
    
    // Conteúdo da seção
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    const lines = this.splitTextToLines(content, 170);
    lines.forEach(line => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    });
    
    this.currentY += 5; // Espaço após seção
  }

  // Adiciona informações do imóvel
  addPropertyInfo(propertyData) {
    if (!this.doc) this.initDocument();
    
    this.addSection('INFORMAÇÕES DO IMÓVEL', '');
    
    const info = [
      `Endereço: ${propertyData.endereco || 'Não informado'}`,
      `Cidade: ${propertyData.cidade || 'Não informado'}`,
      `Tipo: ${propertyData.tipo || 'Não informado'}`,
      `Área do Terreno: ${propertyData.areaTerreno || 'Não informado'}`,
      `Área Construída: ${propertyData.areaConstruida || 'Não informado'}`,
      `Finalidade: ${propertyData.finalidade || 'Não informado'}`
    ];
    
    info.forEach(item => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(item, this.margin + 5, this.currentY);
      this.currentY += this.lineHeight;
    });
    
    this.currentY += 5;
  }

  // Adiciona análise da IA
  addAIAnalysis(analysis) {
    if (!this.doc) this.initDocument();
    
    this.addSection('ANÁLISE INTELIGENTE DE IMAGENS', analysis);
  }

  // Adiciona lista de imagens analisadas
  addImagesList(images) {
    if (!this.doc) this.initDocument();
    
    this.addSection('IMAGENS ANALISADAS', '');
    
    images.forEach((image, index) => {
      this.checkPageBreak(this.lineHeight);
      const imageInfo = `${index + 1}. ${image.name} (${this.formatFileSize(image.size)})`;
      this.doc.text(imageInfo, this.margin + 5, this.currentY);
      this.currentY += this.lineHeight;
    });
    
    this.currentY += 5;
  }

  // Adiciona rodapé
  addFooter() {
    if (!this.doc) this.initDocument();
    
    const pageCount = this.doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Linha separadora
      this.doc.setLineWidth(0.3);
      this.doc.line(this.margin, 280, 190, 280);
      
      // Texto do rodapé
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Relatório gerado pelo Sistema de Análise de Imóveis - GeoMind', this.margin, 285);
      this.doc.text(`Página ${i} de ${pageCount}`, 170, 285);
    }
  }

  // Verifica se precisa quebrar página
  checkPageBreak(requiredSpace) {
    if (this.currentY + requiredSpace > this.pageHeight - 30) {
      this.doc.addPage();
      this.currentY = 20;
    }
  }

  // Divide texto em linhas que cabem na página
  splitTextToLines(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = this.doc.getTextWidth(testLine);
      
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  // Formata tamanho do arquivo
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Gera PDF completo da análise
  async generateAnalysisReport(analysisData) {
    this.initDocument();
    
    // Adicionar logo se configurado
    await addLogoToPDF(this.doc, this.doc.internal.pageSize.width, this.doc.internal.pageSize.height, 20, true);
    
    // Cabeçalho
    this.addHeader(
      'RELATÓRIO DE ANÁLISE DE IMÓVEL',
      'Análise Inteligente com IA'
    );
    
    // Informações do imóvel (se disponível)
    if (analysisData.propertyInfo) {
      this.addPropertyInfo(analysisData.propertyInfo);
    }
    
    // Lista de imagens
    if (analysisData.images && analysisData.images.length > 0) {
      this.addImagesList(analysisData.images);
    }
    
    // Análise da IA
    if (analysisData.analysis) {
      this.addAIAnalysis(analysisData.analysis);
    }
    
    // Informações técnicas
    if (analysisData.timestamp) {
      this.addSection('INFORMAÇÕES TÉCNICAS', 
        `Análise realizada em: ${new Date(analysisData.timestamp).toLocaleString('pt-BR')}\n` +
        `Modelo de IA utilizado: IA Personalizada GeoMind (Multi-Provider)\n` +
        `Versão do sistema: 1.0.0`
      );
    }
    
    // Rodapé
    this.addFooter();
    
    return this.doc;
  }

  // Gera PDF de comparação
  async generateComparisonReport(comparisonData) {
    this.initDocument();
    
    // Adicionar logo se configurado
    await addLogoToPDF(this.doc, this.doc.internal.pageSize.width, this.doc.internal.pageSize.height, 20, true);
    
    // Cabeçalho
    this.addHeader(
      'RELATÓRIO DE COMPARAÇÃO DE IMAGENS',
      'Banco de Dados vs Webscraping'
    );
    
    // Informações da propriedade
    if (comparisonData.propertyInfo) {
      this.addPropertyInfo(comparisonData.propertyInfo);
    }
    
    // Resumo da comparação
    const databaseCount = comparisonData.databaseImages ? comparisonData.databaseImages.length : 0;
    const webscrapingCount = comparisonData.webscrapingImages ? comparisonData.webscrapingImages.length : 0;
    
    this.addSection('RESUMO DA COMPARAÇÃO', 
      `Imagens do Banco de Dados: ${databaseCount}\n` +
      `Imagens de Webscraping: ${webscrapingCount}\n` +
      `Total de imagens analisadas: ${databaseCount + webscrapingCount}`
    );
    
    // Análise comparativa
    if (comparisonData.analysis) {
      this.addSection('ANÁLISE COMPARATIVA DETALHADA', comparisonData.analysis);
    }
    
    // Informações técnicas
    if (comparisonData.timestamp) {
      this.addSection('INFORMAÇÕES TÉCNICAS', 
        `Comparação realizada em: ${new Date(comparisonData.timestamp).toLocaleString('pt-BR')}\n` +
        `Modelo de IA utilizado: IA Personalizada GeoMind com Análise Geoespacial\n` +
        `Tipo de análise: Comparação de autenticidade de propriedades\n` +
        `Versão do sistema: 1.0.0`
      );
    }
    
    // Rodapé
    this.addFooter();
    
    // Salvar automaticamente
    const fileName = `comparacao_imagens_${new Date().toISOString().split('T')[0]}.pdf`;
    this.save(fileName);
    
    return this.doc;
  }

  // Salva o PDF com compatibilidade para Safari
  save(filename = 'relatorio-analise-imovel.pdf') {
    if (this.doc) {
      SafariCompatibility.downloadPDF(this.doc, filename);
    }
  }

  // Retorna o PDF como blob
  getBlob() {
    if (this.doc) {
      return this.doc.output('blob');
    }
    return null;
  }

  // Retorna o PDF como data URL
  getDataURL() {
    if (this.doc) {
      return this.doc.output('dataurlstring');
    }
    return null;
  }


}

export default PDFGenerator;