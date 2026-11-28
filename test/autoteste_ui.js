// Janela do autoteste: roda todos os casos do motor com uma ponte simulada do SketchUp.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 820, height: 900 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript(() => {
    window.__env = [];
    window.sketchup = {
      pronto: () => setTimeout(() => window.Auto.iniciar({ versao: 'teste', itens: [{ nome: 'SketchUp 26', ok: true, detalhe: '' }] }), 10),
      caso: (j) => { const d = JSON.parse(j); window.__env.push(d.nome); setTimeout(() => window.Auto.resultado({ nome: d.nome, itens: [{ nome: 'gera o móvel no modelo', ok: d.modelo.pecas.length > 5, detalhe: d.modelo.pecas.length + ' peças' }] }), 5); },
      relatorio: (j) => { const d = JSON.parse(j); setTimeout(() => window.Auto.resultado({ nome: 'relatório', itens: [{ nome: 'html', ok: d.html.length > 1000 && d.csv.startsWith('Nº;Peça'), detalhe: '' }] }), 5); },
      salvar: () => {}
    };
  });
  await p.goto('file://' + path.join(__dirname, '..', 'src', 'marce', 'ui', 'autoteste.html'));
  await p.waitForFunction(() => !document.getElementById('copiar').disabled, null, { timeout: 60000 });
  const r = await p.evaluate(() => ({ status: document.getElementById('status').textContent, casos: window.__env.length, falhas: document.querySelectorAll('li.falha').length }));
  await p.screenshot({ path: path.join(__dirname, 'prints', '17-autoteste.png'), fullPage: false });
  const ok = !erros.length && r.falhas === 0 && r.casos >= 20 && /tudo certo/.test(r.status);
  console.log(ok ? 'autoteste (janela): ok · ' + r.casos + ' móveis' : 'autoteste (janela) FALHOU ' + JSON.stringify({ r, erros }));
  await b.close();
  process.exitCode = ok ? 0 : 1;
})();
