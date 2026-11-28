// Teste de fumaça da janela do marcê no Chromium (Playwright).
// Uso: node test/ui_smoke.js <pasta-de-prints>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'prints'));
  fs.mkdirSync(out, { recursive: true });
  const ui = path.join(__dirname, '..', 'src', 'marce', 'ui');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.join(ui, 'index.html'));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, '01-frontal.png') });

  const alvos = await p.$$('.alvo');
  if (alvos[3]) await alvos[3].click();
  await p.waitForTimeout(150);
  await p.click('[data-act="secTipo:gavetas"]');
  await p.click('[data-act="gavTipo:2:interna"]');
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, '02-montagem.png') });

  await p.click('[data-act="vista:3d"]');
  await p.click('[data-act="aberto:1"]');
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(out, '03-3d.png') });

  await p.click('[data-act="vista:planta"]');
  await p.click('[data-act="aba:frentes"]');
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, '04-planta-frentes.png') });

  await p.click('[data-act="aba:acabamento"]');
  await p.click('[data-act="picker:frente"]');
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, '05-acabamento.png') });

  await p.click('[data-act="vista:pecas"]');
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(out, '06-pecas.png') });

  await p.click('[data-act="aba:movel"]');
  await p.click('[data-act="tipo:personalizado"]');
  await p.waitForTimeout(150);
  await p.click('[data-act="comp:espelho_arco"]');
  await p.click('[data-act="vista:frontal"]');
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(out, '07-personalizado.png') });

  const html = await p.evaluate(() => {
    const E = window.MarceEngine;
    const s = E.specPadrao('balcao');
    s.nome = 'Armário balcão'; s.L = 3087; s.D = 580; s.H = 776; s.base.tipo = 'suspenso';
    s.cuba.ativa = true; s.cuba.centro = 900; s.cuba.origem = 'modelo';
    s.colunas = E.autoColunas(s);
    s.colunas[0].secoes = [E.novaSecao('temperos')]; s.colunas[0].largura = 250;
    s.colunas[3].secoes = [E.novaSecao('gavetas', { itens: [{ tipo: 'interna' }, { tipo: 'gaveta' }, { tipo: 'gaveta' }] })];
    s.colunas[5].secoes = [E.novaSecao('lixeira')];
    return window.MarceRelatorio.gerar(E.calcular(s), { versao: '1.0.0' });
  });
  const rel = path.join(out, 'relatorio.html');
  const embutido = html
    .replace(/<script data-marce="([a-z.]+)" src="[a-z.]+"><\/script>/g, (_m, f) => '<script>' + fs.readFileSync(path.join(ui, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>')
    .replace(/url\(fonts\//g, 'url(file://' + path.join(ui, 'fonts') + '/');
  fs.writeFileSync(rel, embutido);
  const q = await b.newPage({ viewport: { width: 1100, height: 900 } });
  q.on('pageerror', (e) => errs.push('REL ' + e.message));
  await q.goto('file://' + rel);
  await q.waitForTimeout(400);
  await q.screenshot({ path: path.join(out, '08-relatorio.png') });
  if ((await q.$$('.folha')).length < 6) errs.push('relatório sem pranchas');

  await p.click('[data-act="aba:relatorio"]');
  if (!(await p.$('[data-act="relatorio"]'))) errs.push('sem botão do editor de pranchas');
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(out, '09-aba-relatorio.png') });

  console.log(errs.join('\n') || 'sem erros');
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
