// Testes do motor da planê.mob (node --test test/)
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/marce/ui/engine.js');
const N = require('../src/marce/ui/nesting.js');

const BIB_PUX = { id: 'b1', nome: 'Leo M13', marca: 'Leo', medidas: [3000, 40, 18], encaixe: 'esticar' };
const BIB_CORR = { id: 'b2', nome: 'telescópica 350 FGV', marca: 'FGV', medidas: [350, 45, 12.7], encaixe: 'esticar' };
const BIB_OCU = { id: 'b3', nome: 'invisível', medidas: [450, 40, 12], encaixe: 'esticar' };
const BIB_DOB = { id: 'b4', nome: 'reta', medidas: [100, 45, 18], encaixe: 'real' };

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
  for (const est of ['ripada', 'moldura', 'vidro', 'palhinha']) for (const px of ['barra', 'botao', 'testeira', 'passante', 'cava']) {
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
  // ferragens da minha biblioteca (.skp): puxador, corrediças e dobradiça
  for (const corr of ['telescopica', 'oculta']) {
    const b = E.specPadrao('balcao');
    b.puxador = Object.assign(b.puxador, { tipo: 'meu', bib: BIB_PUX });
    b.gavetas = { corredica: corr, bibTelescopica: BIB_CORR, bibOculta: BIB_OCU };
    b.frentes.bibDobradica = BIB_DOB;
    lista.push(['biblioteca:' + corr, b]);
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
  if (/^Dobradiça /.test(a.nome) && a.biblio && /^Lateral|^Divisória|^Porta/.test(b.nome)) return true; // dobradiça do fabricante: caneco no furo e calço na lateral
  if (/^Dobradiça /.test(b.nome) && b.biblio && /^Lateral|^Divisória|^Porta/.test(a.nome)) return true;
  if (um(/^Perfil LED/) && um(/^Base|^Prateleira/)) return true; // perfil de LED embutido em rasgo // caneco embutido no furo de 35 mm da porta
  if (a.mat === 'aramado' && b.mat === 'aramado') return true; // arames soldados entre si
  if (/^Corrediça oculta/.test(a.nome) && /^Corrediça oculta/.test(b.nome) && a.vao === b.vao && a.secao === b.secao) return true; // trilho móvel corre sobre o fixo
  if (/^Corrediça telescópica/.test(a.nome) && /^Corrediça telescópica/.test(b.nome) && a.vao === b.vao && a.secao === b.secao) return true; // perfis encaixados um dentro do outro (seções em C que não se tocam)
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

test('corrediça telescópica: 3 perfis encaixados (fixo, intermediário que anda a metade, interno) e folga de 12,5 mm', () => {
  const s = E.specPadrao('gaveteiro');
  const m = E.calcular(s);
  const fixos = m.pecas.filter((p) => /perfil fixo/.test(p.nome));
  const meios = m.pecas.filter((p) => /perfil intermediário/.test(p.nome));
  const internos = m.pecas.filter((p) => /perfil interno/.test(p.nome));
  assert.ok(fixos.length > 0 && fixos.length === meios.length && fixos.length === internos.length);
  assert.ok(fixos.every((p) => !p.conj), 'perfil fixo não anda');
  const cj = {}; m.conjuntos.forEach((c) => { cj[c.id] = c; });
  assert.ok(internos.every((p) => p.conj && cj[p.conj].curso > 0), 'interno anda com a gaveta');
  assert.ok(meios.every((p) => cj[p.conj].segue && cj[p.conj].pai && Math.abs(cj[p.conj].curso + cj[cj[p.conj].pai].curso / 2) <= 1), 'intermediário anda a metade');
  const lat = m.pecas.filter((p) => p.nome === 'Lateral gaveta');
  const v = m.vaos[0];
  assert.ok(lat.some((p) => Math.abs(p.x - (v.il + 12.5)) < 0.01), 'caixa a 12,5 mm da lateral');
  // a seção dos 3 perfis de um lado não se cruza (pontos a cada 0,2 mm)
  const dentro = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const sec = (p) => p.forma.pts.map((q) => [p.x + q[0], p.z + q[1]]);
  const tri = [fixos[0], meios[0], internos[0]].map(sec);
  for (let x = v.il; x <= v.il + 12.5; x += 0.2) for (let z = fixos[0].z; z <= fixos[0].z + fixos[0].dz; z += 0.2) {
    const n = tri.filter((poly) => dentro([x + 0.05, z + 0.05], poly)).length;
    assert.ok(n <= 1, 'perfis se cruzam em x=' + x.toFixed(1) + ' z=' + z.toFixed(1));
  }
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

test('ferragens da minha biblioteca: viram peças com "biblio" no lugar das desenhadas', () => {
  for (const corr of ['telescopica', 'oculta']) {
    const b = cenarios().find((c) => c[0] === 'biblioteca:' + corr)[1];
    const m = E.calcular(b);
    assert.ok(m.ok, 'gera sem erro');
    const pux = m.pecas.filter((p) => p.biblio && /^Puxador/.test(p.nome));
    const cor = m.pecas.filter((p) => p.biblio && /^Corrediça/.test(p.nome));
    const dob = m.pecas.filter((p) => p.biblio && /^Dobradiça/.test(p.nome));
    assert.ok(pux.length > 0 && cor.length > 0 && dob.length > 0, corr + ': puxador, corrediça e dobradiça da biblioteca');
    assert.ok(!m.pecas.some((p) => /perfil (fixo|interno|intermediário)|trilho/.test(p.nome)), 'não desenha a corrediça genérica junto');
    pux.forEach((p) => { assert.strictEqual(p.biblio.longo, 'x'); assert.ok(p.dx <= 600); assert.strictEqual(p.dy, 40); });
    cor.forEach((p) => { assert.strictEqual(p.biblio.longo, 'y'); assert.ok(p.biblio.mover && p.biblio.mover.movel && p.biblio.mover.meio, 'corrediça do fabricante abre com a gaveta'); });
    assert.ok(m.conjuntos.some((c) => c.segue && c.curso < 0), 'perfil intermediário segue a gaveta voltando a metade');
    dob.forEach((p) => assert.strictEqual(p.biblio.mover.tipo, 'dobradica'));
    assert.ok(m.ferragens.some((f) => /Leo M13/.test(f.item)), 'lista de ferragens cita o puxador');
  }
  // sem modelo escolhido: volta para alça e avisa
  const s = E.specPadrao('balcao'); s.puxador.tipo = 'meu';
  const m2 = E.calcular(s);
  assert.ok(m2.pecas.some((p) => p.nome === 'Puxador alça'));
});

test('frente com tela (palhinha) e vidros: quadro de 70 mm, tela no rebaixo e item na lista', () => {
  const s = E.specPadrao('aereo'); s.frentes.estilo = 'palhinha'; s.materiais.tela = E.TELAS.rattan;
  const m = E.calcular(s);
  const telas = m.pecas.filter((p) => p.mat === 'tela');
  assert.ok(telas.length > 0, 'tem tela');
  assert.ok(m.pecas.some((p) => /montante/.test(p.nome) && p.dx === 70 && p.cortavel), 'montante de 70 mm vai para o plano de corte');
  assert.ok(m.ferragens.some((f) => /rattan/.test(f.item)), 'tela na lista');
  const v = E.specPadrao('aereo'); v.frentes.estilo = 'vidro'; v.frentes.vidro = 'fume';
  const mv = E.calcular(v);
  assert.ok(mv.pecas.some((p) => p.nome === 'Vidro fumê 4 mm'));
  assert.ok(mv.ferragens.some((f) => f.item === 'Vidro fumê 4 mm'));
});

test('porta-temperos e lixeira do fabricante (.skp): kit no vão, sem desenhar cestos nem corrediças genéricas', () => {
  const s = E.specPadrao('balcao');
  s.colunas[0].secoes = [E.novaSecao('temperos', { bib: { id: 'b9', nome: 'Kit temperos 200', marca: 'Masutti', medidas: [600, 450, 180], encaixe: 'real' } })];
  s.colunas[0].largura = 250;
  const m = E.calcular(s);
  const kit = m.pecas.filter((p) => p.biblio && /^Porta-temperos/.test(p.nome));
  assert.strictEqual(kit.length, 1);
  assert.strictEqual(kit[0].biblio.apoiar, 'z');
  assert.ok(!m.pecas.some((p) => p.col === 0 && /Borda do cesto|Cesto/.test(p.nome)), 'não desenha cestos genéricos');
  assert.ok(m.ferragens.some((f) => /Kit temperos 200 \(Masutti\)/.test(f.item)));
});

test('prateleiras nas alturas escolhidas, divisória interna e fundo da cuba com furo do sifão', () => {
  const s = E.specPadrao('balcao');
  s.colunas = [E.novaColuna(800, [E.novaSecao('portas', { prateleiras: 2, pratAlturas: [200, 450], divOn: true, divInterna: 300 })]), E.novaColuna(null, [E.novaSecao('portas', { prateleiras: 1 })])];
  s.cuba.ativa = true; s.cuba.centro = 1200; s.cuba.fundo = 'furo'; s.cuba.furo = 110; s.cuba.alturaFuro = 480;
  const m = E.calcular(s);
  const vm = m.vaos.filter((v) => v.colunas.some((c) => c.idx === 0))[0];
  const sm = vm.secoes[0];
  const prs = m.pecas.filter((p) => p.nome === 'Prateleira' && p.col === 0);
  assert.strictEqual(prs.length, 4, 'duas alturas × dois lados da divisória');
  const alts = [...new Set(prs.map((p) => Math.round(p.z + p.dz - sm.ib)))].sort((a, b) => a - b);
  assert.deepStrictEqual(alts, [200, 450]);
  assert.ok(m.pecas.some((p) => p.nome === 'Divisória interna' && p.col === 0));
  const fc = m.pecas.find((p) => p.nome === 'Fundo da cuba');
  assert.ok(fc && fc.furo && fc.furo.d === 110, 'fundo com furo');
  assert.ok(Math.abs(fc.z + fc.furo.z - 480) < 1, 'centro do furo a 480 mm');
  assert.ok(Math.abs(fc.x + fc.furo.x - 1200) < 1, 'no eixo da cuba');
});
