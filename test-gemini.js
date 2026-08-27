/* global process */

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testGemini() {
  if (!GEMINI_API_KEY) {
    console.error('VITE_GEMINI_API_KEY não configurada. Defina a variável no ambiente antes de executar este teste.');
    process.exitCode = 1;
    return false;
  }

  try {
    console.log('Testando API do Gemini...');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Teste simples: responda apenas "API funcionando" se você conseguir processar esta mensagem.'
          }]
        }]
      })
    });

    const data = await response.json();

    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('API Gemini funcionando!');
      console.log('Resposta:', data.candidates[0].content.parts[0].text);
      return true;
    }

    console.error('Erro na API Gemini:', data.error?.message || `HTTP ${response.status}`);
    process.exitCode = 1;
    return false;
  } catch (error) {
    console.error('Erro ao testar Gemini:', error.message);
    process.exitCode = 1;
    return false;
  }
}

testGemini();
