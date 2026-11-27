// Testes do motor do marcê (node --test test/)
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/marce/ui/engine.js');
const N = require('../src/marce/ui/nesting.js');

function cenarios() {
  const lista = [];
  Object.keys(E.TIPOS).forEach((t) => lista.push([t, E.specPadrao(t)]));
  Object.keys(E.COMPOSICOES).forEach((c) => { const s = E.specPadrao('personalizado'); s.composicao = c; s.colunas = E.autoColunas(s); lista.push(['comp:' + c, s]); });
  const v = E.specPadrao('balcao');
  v.L = 3087; v.D = 580; v.H = 776; v.base.tipo = 'suspenso'; v.cuba.ativa = true; v.cuba.centro = 900;
  v.colunas = E.autoColunas(v);
  v.colunas[0].secoes = [E.novaSecao('temperos')]; v.colunas[0].largura = 250;
  v.colunas[3].secoes = [E.novaSecao('gavetas', { itens: [{ tipo: 'interna' }, { tipo: 'gaveta' }, { tipo: 'gaveta' }] })];
  v.colunas[5].secoes = [E.novaSecao('lixeira', { baldes: 2 })];
  lista.push(['video', v]);
  const emb = E.specPadrao('aereo'); emb.frentes.montagem = 'embutida'; emb.puxador.tipo = 'alca'; lista.push(['embutida', emb]);
  const rt = E.specPadrao('roupeiro'); rt.rodaTeto.ativo = true; rt.base.tipo = 'pes'; rt.fundo.tipo = 'encaixado'; lista.push(['roda-teto', rt]);
  return lista;
}

test('todos os tipos e composições geram sem erro e com peças válidas', () => {
  for (const [nome, s] of cenarios()) {
    const m = E.calcular(s);
    assert.ok(m.ok, nome + ': ' + m.avisos.filter((a) => a.nivel === 'erro').map((a) => a.msg).join(' | '));
    assert.ok(m.pecas.length > 5, nome + ': poucas peças');
    for (const p of m.pecas) {
      assert.ok(p.dx > 0 && p.dy > 0 && p.dz > 0, nome + ': dimensão inválida em ' + p.nome);
      if (p.cortavel) assert.ok(p.corte.c >= p.corte.l || p.veio, nome + ': comprimento < largura sem veio em ' + p.nome);
    }
  }
});

test('frentes ficam dentro do comprimento e não se sobrepõem', () => {
  for (const [nome, s] of cenarios()) {
    const m = E.calcular(s);
    const fr = m.pecas.filter((p) => p.grupo === 'frente' && p.meta);
    for (const a of fr) {
      assert.ok(a.x >= -0.2 && a.x + a.dx <= s.L + 0.2, nome + ': frente fora');
      for (const b of fr) {
        if (a === b) continue;
        const sobre = a.x < b.x + b.dx - 0.5 && b.x < a.x + a.dx - 0.5 && a.z < b.z + b.dz - 0.5 && b.z < a.z + a.dz - 0.5;
        assert.ok(!sobre, nome + ': frentes sobrepostas ' + a.id + ' ' + b.id);
      }
    }
  }
});

test('larguras das colunas somam o comprimento', () => {
  for (const [nome, s] of cenarios()) {
    const m = E.calcular(s);
    const soma = m.colunas.reduce((t, c) => t + c.larg, 0);
    assert.ok(Math.abs(soma - s.L) < 0.01, nome);
  }
});

test('caso do vídeo: conferência igual à referência', () => {
  const [, s] = cenarios().find((c) => c[0] === 'video');
  const m = E.calcular(s);
  const txt = m.avisos.map((a) => a.msg).join('\n');
  assert.match(txt, /Base com 308,7 cm passam do comprimento da chapa \(273 cm\)/);
  assert.match(txt, /Sem chapa de cima: duas travessas/);
  assert.match(txt, /sem fundo, sem prateleira na altura do sifão/);
  assert.match(txt, /corrediça telescópica \(12,5 mm de cada lado\)/);
  assert.ok(!m.pecas.some((p) => p.grupo === 'fundo' && m.vaos.some((v) => v.cuba && p.x >= v.x0 && p.x + p.dx <= v.x1)), 'módulo da cuba sem fundo');
  assert.ok(m.conjuntos.some((c) => c.pai), 'gaveta interna aninhada');
  const lix = m.elementos.find((e) => e.tipo === 'lixeira');
  assert.ok(lix && lix.baldes === 2 && lix.litros > 20);
});

test('dobradiças: reta na lateral externa, curva na divisória', () => {
  const s = E.specPadrao('aereo');
  const m = E.calcular(s);
  const portas = m.pecas.filter((p) => p.meta && p.meta.tipo === 'porta');
  const primeira = portas.reduce((a, b) => (a.x < b.x ? a : b));
  assert.strictEqual(primeira.meta.hinge, 'reta');
  assert.ok(portas.some((p) => p.meta.hinge === 'curva'));
});

test('divisórias "nenhuma" com 3+ portas é erro técnico', () => {
  const s = E.specPadrao('aereo'); s.divisorias = 'nenhuma';
  const m = E.calcular(s);
  assert.ok(!m.ok);
  s.divisorias = 'par';
  assert.ok(E.calcular(s).ok);
});

test('plano de corte coloca todas as peças que cabem', () => {
  const s = E.specPadrao('roupeiro');
  const m = E.calcular(s);
  const pecas = N.pecasDoModelo(m.pecas, s.materiais);
  const plano = N.otimizar(pecas, s.chapa);
  const colocadas = plano.reduce((t, g) => t + g.chapas.reduce((u, c) => u + c.itens.length, 0) + g.naoCabem.length, 0);
  assert.strictEqual(colocadas, pecas.length);
  for (const g of plano) for (const ch of g.chapas) for (const a of ch.itens) {
    assert.ok(a.x >= s.chapa.refilo - 0.01 && a.x + a.w <= s.chapa.comprimento - s.chapa.refilo + 0.01);
    for (const b of ch.itens) if (a !== b) assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), 'sobreposição no plano');
  }
});

test('CSV com cabeçalho e números com vírgula', () => {
  const s = E.specPadrao('balcao');
  const csv = E.csvLista(E.listaDePecas(E.calcular(s).pecas, s.materiais));
  assert.ok(csv.startsWith('Nº;Peça;Qtd;Comprimento (mm)'));
  assert.ok(csv.split('\r\n').length > 10);
});
