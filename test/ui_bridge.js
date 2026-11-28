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
    window.sketchup = { verificarAtualizacao: reg('verificarAtualizacao'), atualizar: reg('atualizar'), pronto: reg('pronto'), gerar: reg('gerar'), cancelar: reg('cancelar'), detectarCuba: reg('detectarCuba'), salvarRelatorio: reg('salvarRelatorio'), salvarCsv: reg('salvarCsv'), salvarPadroes: reg('salvarPadroes'), abrirPrancha: reg('abrirPrancha'), atualizarPrancha: reg('atualizarPrancha'), salvarProjeto: reg('salvarProjeto') };
  });
  await p.goto('file://' + path.join(__dirname, '..', 'src', 'marce', 'ui', 'index.html'));
  await p.waitForTimeout(300);
  let ch = await p.evaluate(() => window.__chamadas);
  assert.strictEqual(ch[0][0], 'pronto', 'a janela avisa o Ruby que está pronta');

  // Ruby manda o volume selecionado e a cuba detectada
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'novo', versao: '1.0.0', volume: { L: 3087, D: 580, H: 776, elevacao: 0, tipoSugerido: 'balcao' }, cuba: { centro: 900, largura: 500, profundidade: 400 } }));
  await p.waitForTimeout(150);
  assert.ok(await p.isVisible('.modal.guia'), 'passo a passo abre sozinho no primeiro uso');
  await p.click('.modal.guia [data-fechar-modal]');
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
  assert.ok(r && r[1].html.includes('planê<i>.mob</i> · pranchas') && r[1].html.includes('/*MARCE_FONTES*/') && r[1].html.includes('data:image/png'), 'relatório enviado ao Ruby com marcador de fontes e imagem');
  assert.ok((await p.isVisible('#badge-modo')), 'passa para modo edição');

  // prancha salva: pergunta antes de abrir o navegador
  await p.evaluate(() => window.App.receber({ tipo: 'pranchaSalva', caminho: 'C:/Projetos/marce-relatorios/Relatorio - Balcão.html', ligada: true }));
  await p.waitForTimeout(100);
  assert.ok(await p.isVisible('[data-abrir-prancha]'), 'pergunta se abre o navegador');
  await p.screenshot({ path: require('path').join(__dirname, 'prints', '18-pergunta-navegador.png') });
  await p.click('[data-abrir-prancha]');
  ch = await p.evaluate(() => window.__chamadas);
  assert.ok(ch.some((c) => c[0] === 'abrirPrancha'), 'abre o navegador só depois de confirmar');

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

  // botão de atualização
  await p.evaluate(() => window.App.receber({ tipo: 'atualizacao', atual: '1.1.0', versao: '1.2.0', nova: true, notas: ['teste'] }));
  assert.ok(await p.isVisible('.pilula-atualizar.nova'), 'mostra "nova versão"');
  assert.ok((await p.textContent('.pilula-atualizar.nova')).includes('1.2.0'));
  await p.click('.pilula-atualizar.nova');
  ch = await p.evaluate(() => window.__chamadas);
  const at = ch.find((c) => c[0] === 'atualizar');
  assert.ok(at && at[1].spec && at[1].spec.nome === 'Roupeiro casal', 'envia o móvel atual para reabrir depois');
  assert.ok(await p.isVisible('.pilula-atualizar.ocupado'));
  await p.evaluate(() => window.App.receber({ tipo: 'aviso', msg: 'Falha ao instalar: teste' }));
  assert.ok(await p.isVisible('.pilula-atualizar.nova'), 'volta ao botão se falhar');

  // novidades depois de atualizar
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'novo', versao: '1.2.0', avisoAtualizado: 'ok', novidades: [{ versao: '1.2.0', notas: ['Aviso bonito'] }] }));
  assert.ok(await p.isVisible('.modal'), 'mostra "planê.mob atualizada"');
  assert.ok((await p.textContent('.modal')).includes('Aviso bonito'));
  await p.click('[data-fechar-modal]');
  assert.ok(!(await p.$('.modal')), 'fecha no "entendi"');

  assert.deepStrictEqual(erros, []);
  console.log('ponte JS <-> Ruby: ok');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
