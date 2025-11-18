// Utilitários para gerenciamento de logomarca nos relatórios
import { API_BASE_URL } from '../config/api';
import logoCache from './logoCache';

/**
 * Obtém as configurações da logomarca do backend ou localStorage
 * @returns {Promise<Object>} Configurações da logo
 */
export const getLogoConfig = async () => {
  // Verificar cache primeiro
  const cachedData = logoCache.get();
  if (cachedData) {
    return cachedData;
  }

  try {
    if (API_BASE_URL.includes('localhost:3001') && !API_BASE_URL.includes('your-backend-url.com')) {
      const response = await fetch(`${API_BASE_URL}/configuracoes/logo`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          logoCache.set(data.data);
          return data.data;
        }
      }
    }
  } catch (error) {
    console.log('Erro ao carregar configurações da API, usando localStorage:', error.message);
  }
  
  // Fallback para localStorage
  const fallbackConfig = {
    logoUrl: localStorage.getItem('logoUrl') || '',
    logoSize: parseInt(localStorage.getItem('logoSize')) || 100,
    logoPosition: localStorage.getItem('logoPosition') || 'top-right',
    logoOpacity: parseInt(localStorage.getItem('logoOpacity')) || 100,
    showInPages: localStorage.getItem('showInPages') !== 'false',
    showInReports: localStorage.getItem('showInReports') !== 'false'
  };
  
  // Salvar fallback no cache também
  logoCache.set(fallbackConfig);
  return fallbackConfig;
};

/**
 * Invalida o cache de logo (usar após salvar configurações)
 */
export const invalidateLogoCache = () => {
  logoCache.invalidate();
};

/**
 * Obtém as configurações da logomarca do localStorage (síncrono)
 * @returns {Object} Configurações da logo
 */
export const getLogoConfigSync = () => {
  return {
    logoUrl: localStorage.getItem('logoUrl') || '',
    logoSize: parseInt(localStorage.getItem('logoSize')) || 100,
    logoPosition: localStorage.getItem('logoPosition') || 'top-right',
    logoOpacity: parseInt(localStorage.getItem('logoOpacity')) || 100,
    showInPages: localStorage.getItem('showInPages') !== 'false',
    showInReports: localStorage.getItem('showInReports') !== 'false'
  };
};

/**
 * Adiciona logomarca ao documento PDF
 * @param {jsPDF} doc - Instância do jsPDF
 * @param {number} pageWidth - Largura da página
 * @param {number} pageHeight - Altura da página
 * @param {number} margin - Margem da página
 * @param {boolean} isReport - Se é um relatório (para verificar showInReports)
 */
export const addLogoToPDF = async (doc, pageWidth, pageHeight, margin = 20, isReport = true) => {
  const logoConfig = await getLogoConfig();
  
  // Verificar se deve mostrar logo em relatórios
  if (isReport && !logoConfig.showInReports) {
    return; // Logo desabilitada para relatórios
  }
  
  if (!logoConfig.logoUrl) {
    return; // Não há logo configurada
  }

  try {
    // Converter base64 para formato compatível com jsPDF
    const logoData = logoConfig.logoUrl;
    
    // Calcular dimensões da logo
    const logoWidth = logoConfig.logoSize * 0.75; // Converter px para pontos PDF
    const logoHeight = logoWidth * 0.6; // Manter proporção aproximada
    
    // Calcular posição baseada na configuração
    const position = calculateLogoPosition(
      logoConfig.logoPosition,
      pageWidth,
      pageHeight,
      logoWidth,
      logoHeight,
      margin
    );
    
    // Adicionar logo ao PDF
    doc.addImage(
      logoData,
      'PNG', // Formato padrão
      position.x,
      position.y,
      logoWidth,
      logoHeight,
      undefined, // alias
      'NONE', // compression
      0 // rotation
    );
    
    // Aplicar opacidade se necessário (simulação através de cor de fundo)
    if (logoConfig.logoOpacity < 100) {
      const opacity = logoConfig.logoOpacity / 100;
      doc.setGState(new doc.GState({ opacity }));
    }
    
  } catch (error) {
    console.error('Erro ao adicionar logo ao PDF:', error);
  }
};

/**
 * Calcula a posição da logo baseada na configuração
 * @param {string} position - Posição configurada
 * @param {number} pageWidth - Largura da página
 * @param {number} pageHeight - Altura da página
 * @param {number} logoWidth - Largura da logo
 * @param {number} logoHeight - Altura da logo
 * @param {number} margin - Margem da página
 * @returns {Object} Coordenadas x e y
 */
const calculateLogoPosition = (position, pageWidth, pageHeight, logoWidth, logoHeight, margin) => {
  let x, y;
  
  switch (position) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'top-center':
      x = (pageWidth - logoWidth) / 2;
      y = margin;
      break;
    case 'top-right':
      x = pageWidth - logoWidth - margin;
      y = margin;
      break;
    case 'center-left':
      x = margin;
      y = (pageHeight - logoHeight) / 2;
      break;
    case 'center':
      x = (pageWidth - logoWidth) / 2;
      y = (pageHeight - logoHeight) / 2;
      break;
    case 'center-right':
      x = pageWidth - logoWidth - margin;
      y = (pageHeight - logoHeight) / 2;
      break;
    case 'bottom-left':
      x = margin;
      y = pageHeight - logoHeight - margin;
      break;
    case 'bottom-center':
      x = (pageWidth - logoWidth) / 2;
      y = pageHeight - logoHeight - margin;
      break;
    case 'bottom-right':
      x = pageWidth - logoWidth - margin;
      y = pageHeight - logoHeight - margin;
      break;
    default:
      // Padrão: top-right
      x = pageWidth - logoWidth - margin;
      y = margin;
  }
  
  return { x, y };
};

/**
 * Adiciona logomarca a componentes React (para visualização)
 * @param {string} containerClass - Classe CSS do container
 * @returns {JSX.Element|null} Elemento da logo ou null
 */
export const renderLogoForPreview = (containerClass = '') => {
  const logoConfig = getLogoConfigSync();
  
  if (!logoConfig.logoUrl) {
    return null;
  }
  
  const logoStyle = {
    position: 'absolute',
    width: `${logoConfig.logoSize}px`,
    height: 'auto',
    opacity: logoConfig.logoOpacity / 100,
    zIndex: 10,
    ...getPositionStylesForReact(logoConfig.logoPosition)
  };
  
  return (
    <img
      src={logoConfig.logoUrl}
      alt="Logo da empresa"
      style={logoStyle}
      className={containerClass}
    />
  );
};

/**
 * Converte posição para estilos CSS React
 * @param {string} position - Posição configurada
 * @returns {Object} Estilos CSS
 */
const getPositionStylesForReact = (position) => {
  const styles = {};
  
  switch (position) {
    case 'top-left':
      styles.top = '10px';
      styles.left = '10px';
      break;
    case 'top-center':
      styles.top = '10px';
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
      break;
    case 'top-right':
      styles.top = '10px';
      styles.right = '10px';
      break;
    case 'center-left':
      styles.top = '50%';
      styles.left = '10px';
      styles.transform = 'translateY(-50%)';
      break;
    case 'center':
      styles.top = '50%';
      styles.left = '50%';
      styles.transform = 'translate(-50%, -50%)';
      break;
    case 'center-right':
      styles.top = '50%';
      styles.right = '10px';
      styles.transform = 'translateY(-50%)';
      break;
    case 'bottom-left':
      styles.bottom = '10px';
      styles.left = '10px';
      break;
    case 'bottom-center':
      styles.bottom = '10px';
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
      break;
    case 'bottom-right':
      styles.bottom = '10px';
      styles.right = '10px';
      break;
    default:
      styles.top = '10px';
      styles.right = '10px';
  }
  
  return styles;
};

/**
 * Verifica se há uma logo configurada
 * @returns {boolean} True se há logo configurada
 */
export const hasLogo = () => {
  const logoConfig = getLogoConfigSync();
  return !!logoConfig.logoUrl;
};

/**
 * Verifica se há uma logo configurada (versão assíncrona)
 * @returns {Promise<boolean>} True se há logo
 */
export const hasLogoAsync = async () => {
  const logoConfig = await getLogoConfig();
  return !!logoConfig.logoUrl;
};

/**
 * Remove todas as configurações de logo
 */
export const clearLogoConfig = () => {
  localStorage.removeItem('logoUrl');
  localStorage.removeItem('logoSize');
  localStorage.removeItem('logoPosition');
  localStorage.removeItem('logoOpacity');
};