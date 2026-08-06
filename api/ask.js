// api/ask.js
//
// Função serverless da Vercel que recebe uma pergunta + um resumo dos dados do
// dashboard (já filtrados) e chama o Google Gemini (gratuito, via Google AI Studio),
// devolvendo a resposta em JSON. A chave NUNCA aparece no navegador — fica só aqui,
// no servidor.
//
// Rota final, depois do deploy: https://SEU-PROJETO.vercel.app/api/ask
//
// Requer a variável de ambiente GEMINI_API_KEY (ver README-DEPLOY-AI.md).
// Pegue a chave grátis em: https://aistudio.google.com/apikey (sem cartão de crédito)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY não configurada nas variáveis de ambiente do projeto na Vercel.' });
      return;
    }

    const { question, context } = req.body || {};
    if (!question || !String(question).trim()) {
      res.status(400).json({ error: 'Pergunta vazia.' });
      return;
    }

    // Limite de tamanho pra evitar abuso/custo alto por engano
    const safeQuestion = String(question).slice(0, 2000);
    const safeContext  = String(context || '').slice(0, 12000);

    const systemPrompt = `Você é um assistente de operações de logística last-mile (entrega de última milha),
ajudando um analista a interpretar os dados de um dashboard operacional.
Você recebe um resumo dos dados JÁ FILTRADOS no dashboard (KPIs, transportadoras fora da meta, etc.)
e deve responder à pergunta do analista com base SÓ nesses dados — não invente números que não estão no resumo.
Se o resumo não tiver informação suficiente pra responder com precisão, diga isso claramente e sugira
que indicador ou filtro o analista poderia checar no próprio dashboard.
Responda em português do Brasil, direto e objetivo, sem enrolação. Pode usar bullet points quando ajudar a clareza.`;

    // Gemini expõe um endpoint compatível com o formato de "chat completions" da OpenAI —
    // por isso o corpo da requisição fica quase igual ao de antes, só muda a URL/chave.
    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash', // rápido e gratuito no tier free
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `DADOS DO DASHBOARD (recorte filtrado no momento):\n${safeContext}\n\nPERGUNTA DO ANALISTA:\n${safeQuestion}` },
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      res.status(geminiRes.status).json({ error: data.error?.message || 'Erro na chamada ao Gemini.' });
      return;
    }

    const answer = data.choices?.[0]?.message?.content || '(sem resposta)';
    res.status(200).json({ answer, usage: data.usage || null });
  } catch (err) {
    console.error('Erro em /api/ask:', err);
    res.status(500).json({ error: 'Falha ao consultar o Gemini.', details: err.message });
  }
};
