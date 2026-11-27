// Gera o relatório em pranchas (como o Ruby salva: scripts embutidos) e fotografa cada folha.
// Uso: node test/pranchas.js <pasta> [A4|A3...] [marce|neutro]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const UI = path.join(__dirname, '..', 'src', 'marce', 'ui');
const E = require(path.join(UI, 'engine.js'));
const REL = require(path.join(UI, 'report.js'));

function embutir(html) {
  return html.replace(/<script data-marce="([a-z.]+)" src="[a-z.]+"><\/script>/g, (_m, f) => '<script>' + fs.readFileSync(path.join(UI, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>')
    .replace(/url\(fonts\//g, 'url(file://' + path.join(UI, 'fonts') + '/');
}

(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'prints'));
  const folha = process.argv[3] || 'A4';
  const visual = process.argv[4] || 'marce';
  fs.mkdirSync(out, { recursive: true });
  const s = E.specPadrao('balcao');
  s.nome = 'Armário balcão'; s.L = 3087; s.D = 580; s.H = 776; s.base.tipo = 'suspenso';
  s.cuba.ativa = true; s.cuba.centro = 900; s.cuba.origem = 'modelo';
  s.colunas = E.autoColunas(s);
  s.colunas[0].secoes = [E.novaSecao('temperos')]; s.colunas[0].largura = 250;
  s.colunas[3].secoes = [E.novaSecao('gavetas', { itens: [{ tipo: 'interna' }, { tipo: 'gaveta' }, { tipo: 'gaveta' }] })];
  s.colunas[5].secoes = [E.novaSecao('lixeira')];
  const html = embutir(REL.gerar(E.calcular(s), {
    versao: 'teste', prancha: { folha, visual, unidade: 'm', corCota: '#c0392b' },
    projeto: { cliente: 'Laura e Pedro', obra: 'Apto 1203 · Integrada', etapa: 'Detalhamento de marcenaria', revisao: 'R00' },
    escritorio: { nome: 'Estúdio Exemplo', responsavel: 'Arq. Fulana', registro: 'CAU A000000', email: 'contato@exemplo.com', contato: '@estudio' }
  }));
  const arq = path.join(out, 'pranchas.html');
  fs.writeFileSync(arq, html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto('file://' + arq);
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, 'pranchas-tela.png') });
  await p.evaluate(() => { document.getElementById('pranchas').style.zoom = 1; });
  const folhas = await p.$$('.folha');
  for (let i = 0; i < folhas.length; i++) await folhas[i].screenshot({ path: path.join(out, 'prancha-' + (i + 1) + '.png') });
  // estouro: conteúdo que não cabe na área da prancha
  const estouro = await p.evaluate(() => Array.from(document.querySelectorAll('.area')).map((a, i) => (a.scrollHeight > a.clientHeight + 2 ? 'prancha ' + (i + 1) : null)).filter(Boolean));
  await p.pdf({ path: path.join(out, 'pranchas.pdf'), preferCSSPageSize: true, printBackground: true });
  console.log(folhas.length + ' pranchas', estouro.length ? 'ESTOURO: ' + estouro.join(', ') : 'sem estouro', erros.length ? 'ERROS: ' + erros.join(' | ') : 'sem erros');
  await b.close();
  process.exit(erros.length || estouro.length ? 1 : 0);
})();
