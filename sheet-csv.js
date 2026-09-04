// api/sheet-csv.js
// Proxy serverless (roda no servidor da Vercel, não no navegador do usuário).
// Existe só por causa de uma limitação do próprio Google: o link de "Publicar na Web" em CSV
// redireciona pro CDN dele (googleusercontent.com), e esse CDN não manda o header
// Access-Control-Allow-Origin — então o navegador SEMPRE bloqueia por CORS quando o
// dashboard tenta buscar isso direto via fetch(), não importa se está na Vercel, GitHub
// Pages, etc. Buscando aqui no servidor (sem navegador, sem CORS) e devolvendo pro
// dashboard como se fosse um arquivo do mesmo site, o problema desaparece.
//
// Como usar:
// 1) Coloque este arquivo em `api/sheet-csv.js` na raiz do seu projeto Vercel
//    (ao lado da pasta onde fica o index.html).
// 2) No index.html, deixe REMOTE_CSV_URL = '/api/sheet-csv' (caminho relativo,
//    sem domínio — assim ele chama essa função no mesmo deploy).
// 3) Se um dia trocar a planilha ou a aba publicada, só troque a constante abaixo.

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSg-gcdpvP8aagiJ9q_5naAh63sKBZmsEcm496Yf6xUl8ZQvu5iXqsXuTe_Qeef8RW7VG871RFOdT_T/pub?gid=1727561675&single=true&output=csv';

export default async function handler(req, res) {
  try {
    const response = await fetch(`${SHEET_CSV_URL}&_t=${Date.now()}`, {
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!response.ok) {
      res.status(502).send(`Erro ao buscar a planilha no Google (HTTP ${response.status}).`);
      return;
    }

    const csvText = await response.text();

    // CORS liberado pra qualquer origem, já que o conteúdo em si é público (a planilha
    // já está publicada na web). Isso é o que faltava no CDN do Google.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(csvText);
  } catch (err) {
    res.status(500).send(`Erro no proxy: ${err.message}`);
  }
}
