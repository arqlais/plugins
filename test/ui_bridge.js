// Testa a ponte JS <-> Ruby simulando o objeto `sketchup` do HtmlDialog.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 820 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript(() => {
    window.__chamadas = [];
    const reg = (n) => (j) => window.__chamadas.push([n, JSON.parse(j)]);
    window.sketchup = { pronto: reg('pronto'), gerar: reg('gerar'), cancelar: reg('cancelar'), detectarCuba: reg('detectarCuba'), salvarRelatorio: reg('salvarRelatorio'), salvarCsv: reg('salvarCsv'), salvarPadroes: reg('salvarPadroes') };
  });
  await p.goto('file://' + path.join(__dirname, '..', 'src', 'marce', 'ui', 'index.html'));
  await p.waitForTimeout(300);
  let ch = await p.evaluate(() => window.__chamadas);
  assert.strictEqual(ch[0][0], 'pronto', 'a janela avisa o Ruby que está pronta');

  // Ruby manda o volume selecionado e a cuba detectada
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'novo', versao: '1.0.0', volume: { L: 3087, D: 580, H: 776, elevacao: 0, tipoSugerido: 'balcao' }, cuba: { centro: 900, largura: 500, profundidade: 400 } }));
  await p.waitForTimeout(150);
  const sub = await p.textContent('#subtitulo');
  assert.ok(sub.includes('3,087') && sub.includes('volume do modelo'), 'medidas do volume: ' + sub);
  assert.ok(await p.$('.cuba-linha'), 'a cuba aparece na vista frontal');
  assert.ok(await p.$('input[data-path="L"][readonly]'), 'medida travada no volume');

  // gerar
  await p.click('[data-act="gerar"]');
  ch = await p.evaluate(() => window.__chamadas);
  const g = ch.find((c) => c[0] === 'gerar');
  assert.ok(g, 'chamou gerar');
  assert.ok(g[1].modelo.pecas.length > 30 && g[1].modelo.conjuntos.length > 3, 'enviou peças e conjuntos');
  assert.strictEqual(g[1].spec.cuba.origem, 'modelo');
  assert.strictEqual(await p.textContent('[data-act="gerar"]'), 'Gerando…');

  // resposta do Ruby com imagens -> abre relatório (salvarRelatorio)
  await p.evaluate(() => window.App.receber({ tipo: 'gerado', ok: true, msg: 'Móvel gerado', relatorio: true, imagens: { iso: 'data:image/png;base64,iVBORw0KGgo=', topo: null } }));
  await p.waitForTimeout(200);
  ch = await p.evaluate(() => window.__chamadas);
  const r = ch.find((c) => c[0] === 'salvarRelatorio');
  assert.ok(r && r[1].html.includes('Relatório executivo') && r[1].html.includes('/*MARCE_FONTES*/') && r[1].html.includes('data:image/png'), 'relatório enviado ao Ruby com marcador de fontes e imagem');
  assert.ok((await p.isVisible('#badge-modo')), 'passa para modo edição');

  // edição de um móvel existente
  const spec = await p.evaluate(() => { const s = MarceEngine.specPadrao('roupeiro'); s.nome = 'Roupeiro casal'; return s; });
  await p.evaluate((s) => window.App.receber({ tipo: 'init', modo: 'editar', spec: s }), spec);
  assert.strictEqual(await p.inputValue('#nome'), 'Roupeiro casal');
  assert.ok((await p.textContent('[data-act="gerar"]')).toLowerCase().includes('atualizar'));

  // CSV e detectar cuba
  await p.click('[data-act="aba:relatorio"]');
  await p.click('[data-act="csv"]');
  ch = await p.evaluate(() => window.__chamadas);
  const csv = ch.find((c) => c[0] === 'salvarCsv');
  assert.ok(csv && csv[1].csv.startsWith('﻿Nº;Peça;Qtd'), 'CSV com BOM e cabeçalho');

  assert.deepStrictEqual(erros, []);
  console.log('ponte JS <-> Ruby: ok');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
