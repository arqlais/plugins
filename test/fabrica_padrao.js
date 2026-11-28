// Móvel novo usa as ferragens de fábrica como padrão; "Padrão" escolhido pela pessoa fica.
// Uso: node test/fabrica_padrao.js
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');

const itens = [
  { id: 'f0', nome: 'Telescópica com amortecedor 350', marca: 'FGV', categoria: 'corredica', medidas: [350, 45, 12.7], encaixe: 'esticar', existe: true, origem: 'fabrica', fabrica_arquivo: 'corredica-telescopica-amortecedor-350.skp' },
  { id: 'f2', nome: 'Invisível com amortecedor', marca: '', categoria: 'corredica', medidas: [450, 40, 12], encaixe: 'esticar', existe: true, origem: 'fabrica', fabrica_arquivo: 'corredica-invisivel.skp' },
  { id: 'f3', nome: 'Dobradiça reta 35 mm', marca: '', categoria: 'dobradica', medidas: [110, 48, 18], encaixe: 'real', existe: true, origem: 'fabrica', fabrica_arquivo: 'dobradica-reta.skp' }
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 880 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript(() => {
    window.__gerar = null;
    window.sketchup = new Proxy({}, { get: (_t, n) => (j) => { if (n === 'gerar') window.__gerar = JSON.parse(j); } });
    try { localStorage.setItem('marce-guia-visto', '1'); } catch (e) { /* */ }
  });
  await p.goto('file://' + path.join(__dirname, '..', 'src', 'marce', 'ui', 'index.html'));
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'novo', versao: 't', codigo: 'M01', projeto: {} }));
  await p.evaluate((it) => window.App.receber({ tipo: 'biblioteca', itens: it }), itens);
  await p.waitForTimeout(200);
  await p.click('[data-act="gerar"]');
  let g = await p.evaluate(() => window.__gerar);
  assert.ok(g, 'mandou gerar');
  assert.strictEqual(g.spec.gavetas.bibTelescopica.id, 'f0', 'corrediça FGV 350 como padrão');
  assert.strictEqual(g.spec.frentes.bibDobradica.id, 'f3', 'dobradiça reta do fabricante como padrão');
  assert.ok(g.modelo.pecas.some((x) => x.biblio && x.biblio.modo === 'dobradica' && x.biblio.alvo), 'bloco da dobradiça encaixado pelo caneco');
  assert.ok(g.modelo.pecas.some((x) => x.biblio && x.biblio.id === 'f0' && x.biblio.mover), 'peças da corrediça do fabricante, com movimento');
  // a pessoa escolhe "Padrão": continua com o desenho da planê.mob
  await p.evaluate(() => window.App.receber({ tipo: 'gerado', ok: true, msg: 'ok' }));
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'novo', versao: 't', codigo: 'M02', projeto: {} }));
  await p.evaluate((it) => window.App.receber({ tipo: 'biblioteca', itens: it }), itens);
  await p.click('[data-act="aba:ferragens"]');
  await p.waitForTimeout(150);
  await p.click('[data-act="bibUsar"][data-path="gavetas.bibTelescopica"][data-id=""]');
  await p.evaluate((it) => window.App.receber({ tipo: 'biblioteca', itens: it }), itens);
  await p.waitForTimeout(150);
  await p.evaluate(() => { window.__gerar = null; });
  await p.click('[data-act="gerar"]');
  g = await p.evaluate(() => window.__gerar);
  assert.strictEqual(g.spec.gavetas.bibTelescopica, null, 'escolha "Padrão" respeitada');
  assert.strictEqual(erros.length, 0, erros.join(' | '));
  console.log('ferragens de fábrica como padrão: ok');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
