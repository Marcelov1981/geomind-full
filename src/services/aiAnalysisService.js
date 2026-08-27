import api, { API_ENDPOINTS } from '../config/api';

function toProjectPayload(propertyInfo = {}) {
  return {
    name: propertyInfo.projectName || propertyInfo.nomeProjeto || 'Projeto sem nome',
    address: propertyInfo.projectAddress || propertyInfo.endereco || null,
    city: propertyInfo.projectCity || propertyInfo.cidade || null,
    state: propertyInfo.projectState || propertyInfo.estado || null,
  };

}

export async function uploadEvidence(file, { projectId, evaluationId } = {}) {
  let resolvedProjectId = Number(projectId);
  if (!resolvedProjectId) {
    throw new Error('Selecione um projeto antes de analisar a imagem.');
  }

  const formData = new FormData();
  formData.append('file', file, file.name);
  if (evaluationId) formData.append('evaluation_id', String(evaluationId));

  const response = await api.post(API_ENDPOINTS.projetos.evidences(resolvedProjectId), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return response.data;
}

export async function analyzeImageOnServer(file, { projectId, evaluationId, prompt } = {}) {
  const evidence = await uploadEvidence(file, { projectId, evaluationId });
  const response = await api.post(API_ENDPOINTS.evidencias.ai(evidence.id), { prompt }, { timeout: 120000 });
  const output = response.data.output || {};
  return {
    success: true,
    provider: response.data.provider || 'Google Gemini',
    aiProvider: response.data.provider || 'Google Gemini',
    model: response.data.model,
    analysis: output.descricao || 'A IA não retornou uma descrição.',
    confidence: output.confianca_operacional ?? null,
    structuredOutput: output,
    evidence,
    timestamp: new Date().toISOString(),
    metadata: { source: 'GeoMind API', evidenceId: evidence.id },
  };
}

export async function analyzeImagesOnServer(files, options = {}) {
  const analyses = [];
  for (const file of files) {
    try {
      analyses.push({ fileName: file.name, ...(await analyzeImageOnServer(file, options)) });
    } catch (error) {
      analyses.push({ fileName: file.name, success: false, error: error.response?.data?.error || error.message });
    }
  }
  return {
    success: analyses.some((item) => item.success),
    provider: 'Google Gemini',
    totalImages: files.length,
    successfulAnalyses: analyses.filter((item) => item.success).length,
    analyses,
    analysis: analyses.filter((item) => item.success).map((item) => `${item.fileName}: ${item.analysis}`).join('\n\n'),
    timestamp: new Date().toISOString(),
  };
}

export async function listEvidenceAnalyses(evidenceId) {
  const response = await api.get(API_ENDPOINTS.evidencias.analyses(evidenceId));
  return response.data || [];
}

export async function reviewEvidenceAnalysis(evidenceId, analysisId, { action, output } = {}) {
  const response = await api.patch(API_ENDPOINTS.evidencias.review(evidenceId, analysisId), { action, output });
  return response.data;
}

export function buildGeoContextPayload(propertyInfo = {}) {
  return toProjectPayload(propertyInfo);
}
