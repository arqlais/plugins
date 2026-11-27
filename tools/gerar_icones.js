// Gera os ícones da barra de ferramentas do marcê (SVG + PNG 24/32 px)
// Uso: node tools/gerar_icones.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, '..', 'src', 'marce', 'icons');
fs.mkdirSync(DIR, { recursive: true });

const FUNDO = '#3e4b57', TRACO = '#f5f1ee', ROSE = '#d6b3ab';
const LACO = 'M17 79C18 62 18 46 21 38C25 27 37 27 41 38C44 47 44 62 43 71C42 80 35 82 34 75C33 66 43 40 52 32C60 25 71 28 73 40C75 52 74 65 75 74C76 83 83 85 89 77';
const base = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="24" fill="${FUNDO}"/>${inner}</svg>`;
const linha = (d, w = 7, cor = TRACO) => `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const ICONES = {
  novo: base(`<g transform="translate(6 10) scale(.72)">${linha(LACO, 10)}</g><circle cx="76" cy="26" r="15" fill="${ROSE}"/>${linha('M76 18v16M68 26h16', 6, FUNDO)}`),
  editar: base(`<g transform="translate(4 14) scale(.62)">${linha(LACO, 11)}</g>${linha('M58 76l6-18 22-22a6 6 0 0 1 9 9L73 67z', 6, ROSE)}`),
  abrir: base(`${linha('M26 22h36v58H26z', 6)}${linha('M62 22l18 8v58l-18-8', 6, ROSE)}${linha('M54 50v6', 6)}`),
  relatorio: base(`${linha('M30 18h28l14 14v50H30z', 6)}${linha('M58 18v14h14', 6)}${linha('M39 50h24M39 61h24M39 72h14', 6, ROSE)}`)
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [nome, svg] of Object.entries(ICONES)) {
    fs.writeFileSync(path.join(DIR, nome + '.svg'), svg);
    for (const px of [24, 32]) {
      await p.setViewportSize({ width: px, height: px });
      await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body></html>`);
      await p.screenshot({ path: path.join(DIR, `${nome}${px === 24 ? '' : '_32'}.png`), omitBackground: true });
    }
  }
  // folha de visualização
  await p.setViewportSize({ width: 420, height: 120 });
  await p.setContent(`<html><body style="margin:0;padding:20px;background:#f5f1ee;display:flex;gap:20px">${Object.values(ICONES).map((s) => s.replace('<svg ', '<svg width="80" height="80" ')).join('')}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, 'icones-preview.png') });
  await b.close();
  console.log('ícones gerados em', DIR);
})();
