// Tour em imagens: cada tela da planê.mob, na ordem de uso (test/prints/tour/*.png).
// Uso: node test/tour.js   (gera antes as pranchas com: node test/pranchas.js test/prints)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'prints', 'tour');
fs.mkdirSync(out, { recursive: true });
const UI = path.join(__dirname, '..', 'src', 'marce', 'ui');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 880 }, deviceScaleFactor: 1 });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.addInitScript(() => {
    window.__chamadas = [];
    const reg = (n) => (j) => window.__chamadas.push([n, JSON.parse(j)]);
    window.sketchup = new Proxy({}, { get: (_t, n) => reg(n) });
    try { localStorage.setItem('marce-guia-visto', '1'); } catch (e) { /* */ }
  });
  await p.goto('file://' + path.join(UI, 'index.html'));
  await p.waitForTimeout(300);
  let n = 0;
  const foto = async (nome) => { n++; await p.waitForTimeout(250); await p.screenshot({ path: path.join(out, String(n).padStart(2, '0') + '-' + nome + '.png') }); };
  const clica = async (sel) => { const el = await p.$(sel); if (el) { await el.click(); await p.waitForTimeout(180); } else erros.push('sem ' + sel); };

  // a janela abre com o volume selecionado no modelo (cozinha de 3 m com cuba)
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'novo', versao: '1.14.0', codigo: 'M01', projeto: {}, volume: { L: 3087, D: 600, H: 900, elevacao: 0, tipoSugerido: 'balcao' }, cuba: { centro: 900, largura: 500, profundidade: 400 } }));
  await p.waitForTimeout(300);
  await foto('janela-movel');
  // passo a passo e ajuda ilustrada
  await clica('#btn-guia'); await foto('passo-a-passo'); await clica('.modal [data-fechar-modal]');
  await clica('[data-ajuda="base"]'); await foto('ajuda-ilustrada'); await p.keyboard.press('Escape');
  // montagem: clicar numa frente seleciona a coluna
  const alvos = await p.$$('.alvo');
  if (alvos[0]) { await alvos[0].click(); await p.waitForTimeout(150); }
  await clica('[data-act="secTipo:temperos"]');
  await foto('montagem-porta-temperos');
  if (alvos[3]) { await (await p.$$('.alvo'))[3].click(); await p.waitForTimeout(150); }
  await clica('[data-act="secTipo:gavetas"]');
  await foto('montagem-gavetas');
  // vista interna com prateleiras na altura escolhida, divisória e fundo da cuba com furo do sifão
  await p.evaluate(() => { const c = document.querySelector('[data-act="interno:1"]'); if (c) c.click(); });
  await p.waitForTimeout(150);
  const alvosI = await p.$$('.alvo');
  if (alvosI.length > 1) { await alvosI[alvosI.length - 2].click(); await p.waitForTimeout(150); }
  await clica('[data-act="secTipo:portas"]');
  await p.evaluate(() => { const i = document.querySelector('input[data-path$="pratAlturas.0"]'); if (i) { i.value = '220'; i.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const i = document.querySelector('input[data-path$=".divOn"]'); if (i) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.waitForTimeout(150);
  await foto('vista-interna-prateleiras-divisoria');
  await clica('[data-act="aba:movel"]');
  await p.evaluate(() => { const b = document.querySelector('[data-path="cuba.fundo"][data-val="furo"]'); if (b) b.click(); });
  await p.waitForTimeout(150);
  await foto('vista-interna-sifao');
  await p.evaluate(() => { const c = document.querySelector('[data-act="interno:0"]'); if (c) c.click(); });
  await clica('[data-act="aba:frentes"]'); await foto('frentes');
  await p.evaluate(() => { const c = document.getElementById('conteudo'); c.scrollTop = c.scrollHeight; }); await foto('frentes-iluminacao');
  // ferragens com a minha biblioteca (miniaturas de exemplo)
  await p.evaluate(() => {
    const mini = (cor) => 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect x="6" y="24" width="108" height="12" rx="3" fill="' + cor + '"/><rect x="10" y="27" width="100" height="6" fill="#fff" opacity=".5"/></svg>');
    window.App.receber({ tipo: 'biblioteca', itens: [
      { id: 'b1', nome: 'Perfil Leo M13', marca: 'Leo', categoria: 'puxador', medidas: [3000, 40, 18], encaixe: 'esticar', mini: mini('#a88a80'), existe: true },
      { id: 'b5', nome: 'Puxador concha preto', marca: '', categoria: 'puxador', medidas: [96, 30, 22], encaixe: 'real', mini: mini('#3e4b57'), existe: true },
      { id: 'b2', nome: 'Telescópica c/ amortecedor 350', marca: 'FGV', categoria: 'corredica', medidas: [350, 45, 12.7], encaixe: 'esticar', mini: mini('#9aa3ab'), existe: true },
      { id: 'b3', nome: 'Corrediça invisível', marca: 'FGV', categoria: 'corredica', medidas: [450, 40, 12], encaixe: 'esticar', mini: mini('#7d8792'), existe: true },
      { id: 'b4', nome: 'Dobradiça reta', marca: 'FGV', categoria: 'dobradica', medidas: [100, 45, 18], encaixe: 'real', mini: mini('#b9c0c6'), existe: true }
    ] });
  });
  await clica('[data-act="aba:ferragens"]');
  await clica('[data-act="set"][data-val="meu"]');
  await clica('[data-act="bibUsar"][data-id="b1"]');
  await foto('ferragens-puxador-biblioteca');
  await p.evaluate(() => { const c = document.getElementById('conteudo'); c.scrollTop = 520; });
  await clica('[data-act="bibUsar"][data-id="b2"]');
  await foto('ferragens-corredica-dobradica');
  await clica('[data-act="bibGerenciar"]'); await foto('minha-biblioteca'); await p.keyboard.press('Escape');
  await clica('[data-act="aba:acabamento"]'); await foto('acabamento');
  await clica('[data-act="picker:frente"]'); await foto('acabamento-catalogo'); await p.keyboard.press('Escape');
  await clica('[data-act="aba:relatorio"]'); await foto('aba-relatorio');
  // vistas da prévia
  await clica('[data-act="vista:planta"]'); await foto('previa-planta');
  await clica('[data-act="vista:3d"]'); await foto('previa-3d-fechado');
  await clica('[data-act="aberto:1"]'); await foto('previa-3d-aberto');
  await clica('[data-act="vista:pecas"]'); await foto('previa-lista-de-pecas');
  await clica('[data-act="vista:frontal"]');
  // conferência aberta
  await p.evaluate(() => { const c = document.querySelector('#conferencia'); if (c) c.scrollIntoView(); });
  await foto('conferencia-tecnica');
  // gerar → pergunta antes de abrir o navegador
  await p.evaluate(() => window.App.receber({ tipo: 'gerado', ok: true, msg: 'Móvel gerado no modelo' }));
  await p.evaluate(() => window.App.receber({ tipo: 'pranchaSalva', caminho: 'C:/Projetos/Apto 804/marce-relatorios/Relatorio - Armário balcão.html', ligada: true }));
  await foto('pergunta-abrir-navegador');
  await clica('[data-fechar-modal]');
  // novidades depois de atualizar
  await p.evaluate(() => window.App.receber({ tipo: 'init', modo: 'editar', versao: '1.14.0', spec: (function () { const s = MarceEngine.specPadrao('aereo'); s.nome = 'Aéreo cozinha'; return s; })(), novidades: [{ versao: '1.14.0', notas: ['O plugin agora se chama planê.mob, da família planê', 'Prancha ligada ao móvel: atualiza sozinha'] }, { versao: '1.13.0', notas: ['Botão Atualizar prancha'] }] }));
  await foto('novidades-depois-de-atualizar');

  // editor de pranchas (gerado por test/pranchas.js)
  const rel = path.join(__dirname, 'prints', 'pranchas.html');
  if (fs.existsSync(rel)) {
    const q = await b.newPage({ viewport: { width: 1400, height: 880 } });
    await q.goto('file://' + rel); await q.waitForTimeout(700);
    n++; await q.screenshot({ path: path.join(out, String(n).padStart(2, '0') + '-editor-de-pranchas.png') });
    await q.close();
  }
  // autoteste
  const a = await b.newPage({ viewport: { width: 820, height: 880 } });
  await a.addInitScript(() => {
    window.sketchup = {
      pronto: () => setTimeout(() => window.Auto.iniciar({ versao: '1.14.0', itens: [{ nome: 'SketchUp 26.0', ok: true, detalhe: 'Ruby 3.2' }, { nome: 'arquivos da janela', ok: true, detalhe: 'todos presentes' }, { nome: 'captura de imagem da vista', ok: true, detalhe: 'ok' }] }), 10),
      caso: (j) => { const d = JSON.parse(j); setTimeout(() => window.Auto.resultado({ nome: d.nome, itens: [
        { nome: 'gera o móvel no modelo', ok: true, detalhe: d.modelo.pecas.length + ' peças em 180 ms' }, { nome: 'cada peça virou um componente', ok: true, detalhe: d.modelo.pecas.length + ' de ' + d.modelo.pecas.length },
        { nome: 'abrir tudo abre todas as portas e gavetas', ok: true, detalhe: '' }, { nome: 'editar 2× não acumula componentes velhos', ok: true, detalhe: '' }] }), 5); },
      relatorio: () => setTimeout(() => window.Auto.resultado({ nome: 'relatório', itens: [{ nome: 'relatório gravado em disco', ok: true, detalhe: '' }] }), 5)
    };
  });
  await a.goto('file://' + path.join(UI, 'autoteste.html'));
  await a.waitForFunction(() => !document.getElementById('copiar').disabled, null, { timeout: 60000 });
  await a.waitForTimeout(400);
  n++; await a.screenshot({ path: path.join(out, String(n).padStart(2, '0') + '-autoteste.png') });
  console.log(erros.length ? 'tour com problemas: ' + erros.join(' | ') : 'tour: ' + n + ' telas em test/prints/tour');
  await b.close();
})();
