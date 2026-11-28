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
  for (const est of ['ripada', 'moldura', 'vidro']) for (const px of ['barra', 'botao', 'testeira', 'passante']) {
    const a = E.specPadrao('aereo'); a.frentes.estilo = est; a.puxador.tipo = px; a.led.ativo = true; a.led.tipo = 'embutido';
    lista.push(['aereo:' + est + ':' + px, a]);
    const n = E.specPadrao('estante'); n.frentes.estilo = est; n.puxador.tipo = px; n.led.ativo = true; n.led.local = 'prateleiras'; n.led.tipo = 'sobreposto';
    lista.push(['estante-led:' + est + ':' + px, n]);
  }
  // móvel com todos os tipos de faixa, em todas as combinações de puxador/montagem/corrediça/fundo
  const tipos = Object.keys(E.TIPOS_SECAO).filter((t) => t !== 'geladeira');
  for (const pux of Object.keys(E.PUXADORES)) for (const mont of ['sobreposta', 'embutida']) for (const corr of ['telescopica', 'oculta']) for (const fundo of ['sobreposto', 'encaixado']) {
    const t = E.specPadrao('balcao');
    t.L = 4800; t.H = 2300; t.D = 600; t.topo = 'travessas'; t.puxador.tipo = pux; t.frentes.montagem = mont; t.gavetas.corredica = corr; t.fundo.tipo = fundo;
    t.colunas = [];
    for (let k = 0; k < tipos.length; k += 2) {
      t.colunas.push(E.novaColuna(400, [E.novaSecao(tipos[k], { altura: 900, itens: [{ tipo: 'interna' }, { tipo: 'gaveta' }] }), E.novaSecao(tipos[k + 1] || 'nicho', { itens: [{ tipo: 'gavetao' }, { tipo: 'gaveta' }, { tipo: 'gaveta' }] })]));
    }
    t.colunas.push(E.novaColuna(800, [E.novaSecao('geladeira', { altura: 1950 }), E.novaSecao('basculante', { prateleiras: 0, interior: 'vazio' })]));
    t.colunas.push(E.novaColuna(null, [E.novaSecao('gavetas', { itens: [{ tipo: 'interna' }, { tipo: 'gaveta' }, { tipo: 'gaveta' }] })]));
    lista.push(['tudo:' + pux + ':' + mont + ':' + corr + ':' + fundo, t]);
  }
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
  assert.ok(m.conjuntos.some((c) => c.requer && /interna/i.test(c.nome)), 'gaveta interna depende do gavetão');
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

// ---------------------------------------------------------------- colisões
// Peças que atravessam outras piscam no SketchUp (faces coincidentes) e gavetas
// que batem em peças fixas não abrem. Exceções intencionais: encaixes em rasgo.
function sobrepoe(a, b, tol) {
  return a.x < b.x + b.dx - tol && b.x < a.x + a.dx - tol &&
         a.y < b.y + b.dy - tol && b.y < a.y + a.dy - tol &&
         a.z < b.z + b.dz - tol && b.z < a.z + a.dz - tol;
}
function permitido(a, b) {
  const n = [a.nome, b.nome].sort().join(' | ');
  const um = (re) => re.test(a.nome) || re.test(b.nome);
  if (um(/^Fundo gaveta/) && um(/gaveta|Contrafrente/i)) return true; // fundo da gaveta em rasgo
  if (um(/^Fundo$/) && a.grupo !== b.grupo && (um(/^Lateral|^Divisória|^Base|^Topo|^Travessa superior/))) return true; // fundo encaixado em rasgo
  if (um(/^Travessa da cava/) && um(/^Divisória/)) return true; // divisória entalhada para a travessa da cava
  if (um(/^Dobradiça \(caneco\)/) && um(/^Porta/)) return true;
  if (um(/^Perfil LED/) && um(/^Base|^Prateleira/)) return true; // perfil de LED embutido em rasgo // caneco embutido no furo de 35 mm da porta
  if (a.mat === 'aramado' && b.mat === 'aramado') return true; // arames soldados entre si
  if (um(/^Pedra/)) return false;
  return false && n;
}
function caixas(m, abertos) {
  const cj = {};
  m.conjuntos.forEach((c) => { cj[c.id] = c; });
  const desloc = (p) => {
    let dy = 0, id = p.conj;
    while (id) { const c = cj[id]; if (c.tipo === 'corre') dy -= c.curso; id = c.pai; }
    return dy;
  };
  return m.pecas.map((p) => {
    const giro = (() => { let id = p.conj; while (id) { if (cj[id].tipo === 'giro') return true; id = cj[id].pai; } return false; })();
    return Object.assign({}, p, { y: abertos ? p.y + desloc(p) : p.y, giro });
  });
}

test('nenhuma peça atravessa outra (fechado)', () => {
  for (const [nome, s] of cenarios()) {
    const ps = caixas(E.calcular(s), false);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (sobrepoe(a, b, 0.6) && !permitido(a, b)) assert.fail(nome + ': ' + a.nome + ' (' + a.id + ') atravessa ' + b.nome + ' (' + b.id + ')');
    }
  }
});

test('gavetas e aramados abertos não batem em peças fixas', () => {
  for (const [nome, s] of cenarios()) {
    const m = E.calcular(s);
    const ab = caixas(m, true);
    const moveis = ab.filter((p) => p.conj && !p.giro);
    const fixas = ab.filter((p) => !p.conj);
    for (const a of moveis) for (const b of fixas) {
      if (b.grupo === 'pedra') continue; // tampo fica acima das frentes
      if (sobrepoe(a, b, 0.6) && !permitido(a, b)) assert.fail(nome + ': ' + a.nome + ' aberto bate em ' + b.nome);
    }
  }
});

test('com tudo aberto, nada que se move bate em outra peça que se move', () => {
  for (const [nome, s] of cenarios()) {
    const m = E.calcular(s);
    const ab = caixas(m, true);
    const cj = {}; m.conjuntos.forEach((c) => { cj[c.id] = c; });
    const raiz = (id) => { while (id && cj[id].pai) id = cj[id].pai; return id; };
    const moveis = ab.filter((p) => p.conj && !p.giro);
    for (let i = 0; i < moveis.length; i++) for (let j = i + 1; j < moveis.length; j++) {
      const a = moveis[i], b = moveis[j];
      if (raiz(a.conj) === raiz(b.conj)) continue;
      if (sobrepoe(a, b, 0.6) && !permitido(a, b)) assert.fail(nome + ': ' + a.nome + ' (aberto) bate em ' + b.nome + ' (aberto)');
    }
  }
});

test('corrediça telescópica: perfil fixo no móvel e perfil móvel na gaveta, com folga de 12,5 mm', () => {
  const s = E.specPadrao('gaveteiro');
  const m = E.calcular(s);
  const fixos = m.pecas.filter((p) => /perfil fixo/.test(p.nome));
  const moveis = m.pecas.filter((p) => /perfil móvel/.test(p.nome));
  assert.ok(fixos.length > 0 && fixos.length === moveis.length);
  assert.ok(fixos.every((p) => !p.conj), 'perfil fixo não anda');
  assert.ok(moveis.every((p) => p.conj), 'perfil móvel anda com a gaveta');
  const lat = m.pecas.filter((p) => p.nome === 'Lateral gaveta');
  const v = m.vaos[0];
  assert.ok(lat.some((p) => Math.abs(p.x - (v.il + 12.5)) < 0.01), 'caixa a 12,5 mm da lateral');
});

test('torre de geladeira: nicho sem base nem rodapé e folgas conferidas', () => {
  const s = E.specPadrao('personalizado'); s.L = 1600; s.D = 600; s.H = 2400; s.composicao = 'torre_geladeira'; s.colunas = E.autoColunas(s);
  const m = E.calcular(s);
  assert.ok(m.ok);
  const v = m.vaos[0];
  assert.ok(!m.pecas.some((p) => /^Base|^Rodapé|^Saia/.test(p.nome) && p.x < v.ir - 1 && p.x + p.dx > v.il + 1), 'nada embaixo da geladeira');
  const g = m.eletros.find((e) => e.tipo === 'Geladeira');
  assert.ok(g && g.folgaLateral >= 20 && g.folgaTopo >= 50);
  s.colunas[0].secoes[0].eletro.largura = 900;
  assert.ok(!E.calcular(s).ok, 'geladeira maior que o vão dá erro');
});
