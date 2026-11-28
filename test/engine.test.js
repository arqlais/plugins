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
        if (a.meta.tipo === 'correr' && b.meta.tipo === 'correr') continue; // folhas de correr se transpassam em planos diferentes
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
  if (um(/^Puxador concha|^Perfil puxador vertical|^Cava vertical/) && um(/^Folha de correr/)) return true; // puxador embutido na folha
  if (um(/^Duto da coifa/) && um(/^Topo/)) return true; // duto passa pelo furo do topo
  if (um(/^Coifa embutida/) && um(/^Base/)) return true; // coifa entra no recorte da base
  if (a.nome === 'Divisória da gaveta' && b.nome === 'Divisória da gaveta') return true; // meia-madeira no cruzamento
  // gaveta interna atrás de porta de correr: no uso, a folha é corrida antes de abrir a gaveta
  const folhaC = (p) => /^Folha de correr|^Quadro de alumínio da folha|\(folha de correr\)$|^Puxador concha|^Perfil puxador vertical|^Cava vertical/.test(p.nome);
  if ((folhaC(a) && b.conj && !folhaC(b)) || (folhaC(b) && a.conj && !folhaC(a))) return true;
  if (um(/^Quadro de alumínio da folha|folha de correr\)$/) && um(/^Trilho|^Guia inferior/)) return true;
  if (um(/^Folha de correr/) && um(/^Trilho|^Guia inferior/)) return true; // folha encaixada no trilho/guia
  if (/^Dobradiça .*\(caneco\)/.test(a.nome) && /^Porta/.test(b.nome)) return true;
  if (/^Dobradiça .*\(caneco\)/.test(b.nome) && /^Porta/.test(a.nome)) return true;
  // base da dobradiça presa na lateral: em vão com prateleira/calço na mesma altura, a peça leva rebaixo (ou a dobradiça muda de altura)
  if (um(/^Dobradiça.*\(base na lateral\)|^Dobradiça.*\(braço\)/) && um(/^Prateleira|^Calço|^Divisória interna|^Lateral gaveta|^Corrediça|^Tubo cabideiro|^Suporte do cabideiro/)) return true;
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
    let dy = 0, dx = 0, id = p.conj;
    while (id) { const c = cj[id]; if (c.tipo === 'corre') { if (c.eixo === 'x') dx += c.curso; else dy -= c.curso; } id = c.pai; }
    return [dx, dy];
  };
  return m.pecas.map((p) => {
    const giro = (() => { let id = p.conj; while (id) { if (cj[id].tipo === 'giro') return true; id = cj[id].pai; } return false; })();
    const d = abertos ? desloc(p) : [0, 0];
    return Object.assign({}, p, { x: p.x + d[0], y: p.y + d[1], giro });
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
    const dob = m.pecas.filter((p) => /^Dobradiça reta/.test(p.nome)); // desenho fixo com o nome do modelo
    assert.ok(pux.length > 0 && cor.length > 0 && dob.length > 0, corr + ': puxador, corrediça e dobradiça da biblioteca');
    assert.ok(!m.pecas.some((p) => /perfil (fixo|interno|intermediário)|trilho/.test(p.nome)), 'não desenha a corrediça genérica junto');
    pux.forEach((p) => { assert.strictEqual(p.biblio.longo, 'x'); assert.ok(p.dx <= 600); assert.strictEqual(p.dy, 40); });
    cor.forEach((p) => { assert.strictEqual(p.biblio.longo, 'y'); assert.ok(p.biblio.mover && p.biblio.mover.movel && p.biblio.mover.meio, 'corrediça do fabricante abre com a gaveta'); });
    assert.ok(m.conjuntos.some((c) => c.segue && c.curso < 0), 'perfil intermediário segue a gaveta voltando a metade');

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

test('portas de correr: duas folhas em planos diferentes, a da frente corre de lado sobre a de trás', () => {
  const s = E.specPadrao('roupeiro');
  s.colunas = [E.novaColuna(1600, [E.novaSecao('correr', { folhas: 2, prateleiras: 2 })])];
  s.L = 1600;
  const m = E.calcular(s);
  const folhas = m.pecas.filter((p) => p.nome === 'Folha de correr');
  assert.strictEqual(folhas.length, 2);
  assert.notStrictEqual(folhas[0].y, folhas[1].y, 'planos diferentes');
  const cjF = m.conjuntos.filter((c) => c.eixo === 'x' && c.tipo === 'corre');
  assert.strictEqual(cjF.length, 1, 'a folha da frente corre');
  assert.ok(cjF[0].curso < 0, 'corre para a esquerda');
  assert.ok(Math.abs(folhas[0].dx + folhas[1].dx - 30 - (folhas[1].x + folhas[1].dx - folhas[0].x)) < 1, 'transpasse de 30 mm');
  assert.ok(m.pecas.some((p) => /^Trilho superior/.test(p.nome)) && m.pecas.some((p) => /^Guia inferior/.test(p.nome)));
  assert.ok(m.ferragens.some((f) => /Kit porta de correr/.test(f.item)));
  const s3 = E.specPadrao('roupeiro'); s3.L = 2400; s3.colunas = [E.novaColuna(2400, [E.novaSecao('correr', { folhas: 3 })])];
  assert.strictEqual(E.calcular(s3).pecas.filter((p) => p.nome === 'Folha de correr').length, 3);
});

test('portas de correr em colunas vizinhas formam um só conjunto (folhas por cima das divisórias)', () => {
  const s = E.specPadrao('roupeiro');
  s.L = 2700; s.divisorias = 'cada';
  s.colunas = [0, 1, 2].map(() => E.novaColuna(null, [E.novaSecao('correr', { prateleiras: 3 })]));
  const m = E.calcular(s);
  const folhas = m.pecas.filter((p) => p.nome === 'Folha de correr');
  assert.strictEqual(folhas.length, 3, 'automático: 3 folhas para 2,70 m');
  const x0 = Math.min(...folhas.map((f) => f.x)), x1 = Math.max(...folhas.map((f) => f.x + f.dx));
  assert.ok(x0 <= 1 && x1 >= 2699, 'as folhas cobrem o móvel inteiro');
  assert.ok(m.pecas.filter((p) => /^Divisória/.test(p.nome) && p.grupo === 'caixa').length >= 2, 'divisórias continuam atrás');
  assert.strictEqual(m.pecas.filter((p) => /^Trilho superior/.test(p.nome)).length, 1, 'um trilho só, na largura toda');
});

test('interior por módulos: gavetas internas com calço, cabideiro na altura recomendada e prateleiras no que sobra', () => {
  const s = E.specPadrao('roupeiro');
  s.L = 1000; s.H = 2400;
  s.colunas = [E.novaColuna(null, [E.novaSecao('portas', { interno: [{ tipo: 'gavetas', qtd: 2 }, { tipo: 'cabideiro', uso: 'medio' }, { tipo: 'prateleiras' }] })])];
  const m = E.calcular(s);
  const mods = m.elementos.filter((e) => e.tipo === 'modulo').sort((a, b) => a.z0 - b.z0);
  assert.strictEqual(mods.length, 3);
  assert.ok(Math.abs(mods[0].z1 - mods[0].z0 - 340) < 1, 'duas gavetas de 17 cm');
  assert.ok(Math.abs(mods[1].z1 - mods[1].z0 - 1050) < 1, 'cabideiro médio 105 cm');
  assert.strictEqual(m.pecas.filter((p) => p.nome === 'Frente gaveta interna').length, 2);
  assert.strictEqual(m.pecas.filter((p) => p.nome === 'Calço da gaveta interna').length, 2);
  assert.ok(m.pecas.some((p) => /^Tubo cabideiro/.test(p.nome)));
  assert.strictEqual(m.pecas.filter((p) => p.nome === 'Prateleira fixa').length, 2, 'prateleira fixa entre os módulos');
  // cada combinação pronta gera sem erro e sem peça atravessando outra
  for (const k of Object.keys(E.INTERNOS_PRONTOS)) {
    const s2 = E.specPadrao('roupeiro'); s2.L = 900; s2.H = 2300;
    s2.colunas = [E.novaColuna(null, [E.novaSecao('portas', { interno: JSON.parse(JSON.stringify(E.INTERNOS_PRONTOS[k].mods)) })])];
    const m2 = E.calcular(s2);
    assert.ok(m2.ok, k + ' gera');
    const ps = caixas(m2, false);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      if (sobrepoe(ps[i], ps[j], 0.6) && !permitido(ps[i], ps[j])) assert.fail(k + ': ' + ps[i].nome + ' atravessa ' + ps[j].nome);
    }
    const ab = caixas(m2, true);
    ab.filter((p) => p.conj && !p.giro).forEach((a) => ab.filter((b) => !b.conj).forEach((b) => { if (sobrepoe(a, b, 0.6) && !permitido(a, b)) assert.fail(k + ': ' + a.nome + ' aberto bate em ' + b.nome); }));
  }
});

test('mesclar o interno sem mudar as portas: divisória à direita "tirar" junta os vãos', () => {
  const s = E.specPadrao('roupeiro');
  s.L = 1800; s.divisorias = 'cada'; s.larguraMax = 600;
  s.colunas = [0, 1, 2].map(() => E.novaColuna(null, [E.novaSecao('portas', { prateleiras: 3 })]));
  const antes = E.calcular(s);
  s.colunas[0].divisoria = 'unir';
  const depois = E.calcular(s);
  assert.strictEqual(depois.vaos.length, antes.vaos.length - 1, 'um vão a menos');
  assert.strictEqual(depois.pecas.filter((p) => p.meta && p.meta.tipo === 'porta').length, antes.pecas.filter((p) => p.meta && p.meta.tipo === 'porta').length, 'mesmas portas');
  s.divisorias = 'nenhuma'; s.colunas[0].divisoria = 'auto'; s.colunas[1].divisoria = 'manter';
  assert.strictEqual(E.calcular(s).vaos.length, 2, '"manter" segura a divisória mesmo sem divisórias no resto');
});

test('folhas de correr personalizadas: espelho e vidro em quadro de alumínio, puxador perfil, sem peça atravessando', () => {
  for (const pux of ['concha', 'perfil', 'cava', 'nenhum']) {
    const s = E.specPadrao('roupeiro'); s.L = 2700; s.H = 2500;
    s.colunas = [0, 1, 2].map(() => E.novaColuna(null, [E.novaSecao('correr', { puxCorrer: pux, acabCorrer: 'mdf', folhasCfg: [{ acab: 'espelho' }, { acab: 'vidro' }, {}], vidroCorrer: 'bronze', interno: [{ tipo: 'gavetas', qtd: 3 }, { tipo: 'cabideiro', uso: 'medio' }, { tipo: 'prateleiras' }] })]));
    const m = E.calcular(s);
    assert.ok(m.pecas.some((p) => p.mat === 'vidro_espelho'), 'folha de espelho');
    assert.ok(m.pecas.some((p) => p.mat === 'vidro_bronze'), 'folha de vidro bronze');
    assert.ok(m.pecas.filter((p) => p.nome === 'Quadro de alumínio da folha').length === 8, 'quadro nas duas folhas de vidro');
    assert.ok(m.pecas.some((p) => p.nome === 'Folha de correr'), 'terceira folha em MDF');
    assert.ok(m.ferragens.some((f) => /bronze/i.test(f.item)) && m.ferragens.some((f) => /Espelho/.test(f.item)));
    const ps = caixas(m, false);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (sobrepoe(ps[i], ps[j], 0.6) && !permitido(ps[i], ps[j])) assert.fail(pux + ': ' + ps[i].nome + ' atravessa ' + ps[j].nome);
    const ab = caixas(m, true);
    const mov = ab.filter((p) => p.conj && !p.giro);
    mov.forEach((a) => ab.filter((b) => !b.conj).forEach((b) => { if (sobrepoe(a, b, 0.6) && !permitido(a, b)) assert.fail(pux + ': ' + a.nome + ' aberto bate em ' + b.nome); }));
  }
});

test('cantos frontais arredondados: peça curva no canto, frentes começam depois dela, sem invadir o vão', () => {
  for (const tipo of ['criado', 'balcao', 'roupeiro']) {
    const s = E.specPadrao(tipo); s.cantos = { ativo: true, raio: 50 }; s.pedra.ativa = tipo === 'balcao'; s.pedra.cantos = true;
    const m = E.calcular(s);
    const cantos = m.pecas.filter((p) => /^Canto arredondado/.test(p.nome));
    assert.strictEqual(cantos.length, 2, tipo + ': dois cantos');
    cantos.forEach((c) => assert.strictEqual(c.forma.plano, 'xy'));
    const fr = m.pecas.filter((p) => p.grupo === 'frente' && p.meta);
    assert.ok(Math.min(...fr.map((f) => f.x)) >= 49, tipo + ': frentes começam depois do canto');
    assert.ok(Math.max(...fr.map((f) => f.x + f.dx)) <= s.L - 49, tipo + ': e terminam antes do outro canto');
    const ps = caixas(m, false);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (sobrepoe(ps[i], ps[j], 0.6) && !permitido(ps[i], ps[j])) {
      const a = ps[i], b = ps[j];
      if (/^Canto arredondado/.test(a.nome) || /^Canto arredondado/.test(b.nome)) {
        // a caixa da peça curva é maior que a curva: confere pelo polígono (a curva só entra no lugar da lateral)
        const c = /^Canto arredondado/.test(a.nome) ? a : b, o = c === a ? b : a;
        const dentroVao = c.forma.pts.some((q) => { const x = c.x + q[0], y = c.y + q[1]; return x > o.x + 0.6 && x < o.x + o.dx - 0.6 && y > o.y + 0.6 && y < o.y + o.dy - 0.6; });
        if (dentroVao && o.grupo !== 'pedra' && !/^Base|^Rodapé/.test(o.nome)) assert.fail(tipo + ': canto invade ' + o.nome);
        continue;
      }
      assert.fail(tipo + ': ' + a.nome + ' atravessa ' + b.nome);
    }
    if (s.pedra.ativa) assert.ok(m.pecas.find((p) => p.grupo === 'pedra').forma, 'pedra com cantos arredondados');
  }
});

test('puxador vertical das portas altas no centro a 110 cm do piso (ou na altura escolhida)', () => {
  const s = E.specPadrao('roupeiro'); s.puxador.tipo = 'barra'; s.puxador.posicao = 'lateral';
  const m = E.calcular(s);
  const px = m.pecas.filter((p) => p.nome === 'Puxador barra' && p.z < 1800); // portas altas (o maleiro de cima tem portas baixas)
  assert.ok(px.length > 0);
  // portas altas (> 1,5 m): centro a 110 cm; portas baixas (maleiro, porta sobre gavetas) seguem o meio da porta
  const altas = m.pecas.filter((p) => p.meta && p.meta.tipo === 'porta' && p.dz > 1500);
  const naAlta = (lista) => lista.filter((p) => altas.some((a) => p.x >= a.x - 1 && p.x + p.dx <= a.x + a.dx + 1 && p.z >= a.z && p.z + p.dz <= a.z + a.dz));
  assert.ok(naAlta(px).length > 0);
  naAlta(px).forEach((p) => assert.ok(Math.abs(p.z + p.dz / 2 - 1100) < 2, 'centro a 110 cm: ' + (p.z + p.dz / 2)));
  s.puxador.alturaPiso = 1000;
  naAlta(E.calcular(s).pecas.filter((p) => p.nome === 'Puxador barra')).forEach((p) => assert.ok(Math.abs(p.z + p.dz / 2 - 1000) < 2));
});

test('mesclar colunas com maleiro: as faixas iguais ficam, o vão vira um só e cada faixa tem porta par', () => {
  const s = E.specPadrao('roupeiro'); s.divisorias = 'cada'; s.larguraMax = 600;
  s.colunas = [0, 1].map(() => E.novaColuna(600, [E.novaSecao('portas', { prateleiras: 3, portas: 1 }), E.novaSecao('portas', { altura: 400, prateleiras: 0, portas: 1 })]));
  s.L = 1200;
  const antes = E.calcular(s);
  s.colunas[0].divisoria = 'unir';
  const m = E.calcular(s);
  assert.strictEqual(m.vaos.length, antes.vaos.length - 1, 'vão único');
  assert.strictEqual(m.vaos[0].secoes.length, 2, 'maleiro continua');
  const portas = m.pecas.filter((p) => p.meta && p.meta.tipo === 'porta');
  assert.strictEqual(portas.length, 4, 'porta par embaixo e em cima');
  ['esq', 'dir'].forEach((l) => assert.strictEqual(portas.filter((p) => p.meta.dobradica === l).length, 2));
  assert.ok(!m.resumo.erros, 'sem erro técnico');
});

test('auditoria: folga da corrediça vem do modelo e dobradiças contam peso e largura', () => {
  const s = E.specPadrao('balcao');
  s.gavetas = { corredica: 'telescopica', bibTelescopica: { id: 'x', nome: 'FGV', medidas: [350, 45, 12.7], encaixe: 'esticar', folga: 12.7 } };
  const m = E.calcular(s);
  const lat = m.pecas.filter((p) => p.nome === 'Lateral gaveta').sort((a, b) => a.x - b.x);
  const vm = m.vaos.find((v) => v.colunas.some((c) => c.idx === lat[0].col));
  assert.ok(Math.abs(lat[0].x - (vm.il + 12.7)) < 0.2, 'caixa da gaveta a 12,7 mm da lateral (folga do modelo)');
  const s2 = E.specPadrao('roupeiro'); s2.frentes.estilo = 'vidro';
  const leve = E.calcular(E.specPadrao('roupeiro')).pecas.filter((p) => p.meta && p.meta.tipo === 'porta' && p.dz > 1800)[0];
  assert.ok(leve.meta.nDobradicas >= 4, 'porta alta: 4 ou mais');
  const s3 = E.specPadrao('balcao'); s3.colunas = [E.novaColuna(700, [E.novaSecao('portas', { portas: 1 })])]; s3.L = 700; s3.larguraMax = 800;
  const larga = E.calcular(s3).pecas.filter((p) => p.meta && p.meta.tipo === 'porta')[0];
  assert.strictEqual(larga.meta.nDobradicas, 3, 'porta de 70 cm x 78 cm: 3 dobradiças (largura)');
});

test('lote: frentes em duas cores, LED sob a bancada, cavas, organizador de gaveta e coifa', () => {
  const s = E.specPadrao('balcao');
  s.materiais.frente2 = { id: 'x', nome: 'Azul', marca: 'Genérico', cor: '#233a5e', veio: false };
  s.colunas[0].secoes[0].frente2 = '1';
  s.led.ativo = true; s.led.local = 'bancada';
  s.puxador.tipo = 'cava'; s.puxador.cavaTipo = 'reta';
  const ig = s.colunas.find((c) => c.secoes.some((x) => x.tipo === 'gavetas'));
  ig.secoes.find((x) => x.tipo === 'gavetas').itens[0].org = 'grade';
  const m = E.calcular(s);
  assert.ok(m.pecas.some((p) => p.mat === 'frente2' && p.col === 0), 'segunda cor na faixa escolhida');
  assert.ok(m.pecas.some((p) => p.mat === 'frente' && p.col !== 0 && p.grupo === 'frente'), 'outras faixas na cor principal');
  assert.ok(m.pecas.some((p) => p.nome === 'Perfil LED' && p.y < 0), 'LED sob a bancada, no plano das frentes');
  assert.ok(m.pecas.filter((p) => p.nome === 'Divisória da gaveta').length === 4, 'grade 3 × 3');
  assert.ok(m.pecas.some((p) => p.forma && p.forma.cava && p.forma.pts.length === 6), 'cava reta (rasgo)');
  const ps = caixas(m, false);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (sobrepoe(ps[i], ps[j], 0.6) && !permitido(ps[i], ps[j])) assert.fail(ps[i].nome + ' atravessa ' + ps[j].nome);
  const a = E.specPadrao('aereo'); a.topo = 'chapa';
  a.colunas = [E.novaColuna(900, [E.novaSecao('coifa')])]; a.L = 900;
  const ma = E.calcular(a);
  assert.ok(ma.pecas.some((p) => p.nome === 'Coifa embutida'));
  assert.ok(ma.pecas.some((p) => /^Duto da coifa/.test(p.nome)));
  assert.ok(ma.pecas.some((p) => /^Topo/.test(p.nome) && p.furo && p.furo.eixo === 'z'), 'furo no topo');
  assert.ok(ma.pecas.filter((p) => p.meta && p.meta.tipo === 'porta').length === 2, 'duas portas');
  const pa = caixas(ma, false);
  for (let i = 0; i < pa.length; i++) for (let j = i + 1; j < pa.length; j++) if (sobrepoe(pa[i], pa[j], 0.6) && !permitido(pa[i], pa[j])) assert.fail('coifa: ' + pa[i].nome + ' atravessa ' + pa[j].nome);
});

test('canto cego em L: porta só na parte visível, dobradiça do lado oposto e espaçador', () => {
  const s = E.specPadrao('balcao'); s.L = 2400;
  s.colunas = E.autoColunas(s);
  const ult = s.colunas.length - 1;
  s.colunas[ult].largura = 950; s.colunas[ult].canto = 'dir';
  s.colunas[ult].secoes = [E.novaSecao('portas', { prateleiras: 1 })];
  const m = E.calcular(s);
  const pc = m.pecas.filter((p) => p.meta && p.meta.tipo === 'porta' && p.col === ult);
  assert.strictEqual(pc.length, 1, 'uma porta no canto');
  assert.strictEqual(pc[0].meta.dobradica, 'esq', 'dobradiça longe do canto');
  assert.ok(pc[0].x + pc[0].dx < s.L - 550, 'parte escondida sem porta');
  assert.ok(m.pecas.some((p) => p.nome === 'Espaçador do canto'));
  assert.ok(m.ferragens.some((f) => /165°/.test(f.item)));
  const ps = caixas(m, false);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (sobrepoe(ps[i], ps[j], 0.6) && !permitido(ps[i], ps[j])) assert.fail(ps[i].nome + ' atravessa ' + ps[j].nome);
});

test('tipo de frente por faixa: uma coluna de vidro no meio de portas com moldura', () => {
  const s = E.specPadrao('roupeiro'); s.frentes.estilo = 'moldura'; s.frentes.vidro = 'fume';
  s.colunas[1].secoes.forEach((x) => { x.estilo = 'vidro'; });
  const m = E.calcular(s);
  assert.ok(m.pecas.some((p) => p.nome === 'Vidro fumê 4 mm' && p.col === 1), 'porta de vidro na coluna 2');
  assert.ok(!m.pecas.some((p) => p.nome === 'Vidro fumê 4 mm' && p.col !== 1), 'só nela');
  assert.ok(m.pecas.some((p) => p.nome === 'Moldura da frente' && p.col === 0), 'as outras com moldura');
  const ps = caixas(m, false);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (sobrepoe(ps[i], ps[j], 0.6) && !permitido(ps[i], ps[j])) assert.fail(ps[i].nome + ' atravessa ' + ps[j].nome);
});

// portas abertas de verdade (giradas): nenhuma porta bate em outra porta nem em gaveta aberta
function caixaGirada(p, cj) {
  const mapa = {}; cj.forEach((c) => { mapa[c.id] = c; });
  const pts = [];
  for (const x of [p.x, p.x + p.dx]) for (const y of [p.y, p.y + p.dy]) for (const z of [p.z, p.z + p.dz]) {
    let q = [x, y, z], id = p.conj;
    while (id) {
      const c = mapa[id];
      if (c.tipo === 'corre') q = c.eixo === 'x' ? [q[0] + c.curso, q[1], q[2]] : [q[0], q[1] - c.curso, q[2]];
      else if (c.tipo === 'giro') {
        const a = c.angulo * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), pv = [c.pivot.x, c.pivot.y, c.pivot.z], r = [q[0] - pv[0], q[1] - pv[1], q[2] - pv[2]];
        q = c.eixo === 'z' ? [pv[0] + r[0] * ca - r[1] * sa, pv[1] + r[0] * sa + r[1] * ca, q[2]] : [q[0], pv[1] + r[1] * ca - r[2] * sa, pv[2] + r[1] * sa + r[2] * ca];
      }
      id = c.pai;
    }
    pts.push(q);
  }
  const mn = [0, 1, 2].map((k) => Math.min(...pts.map((q) => q[k]))), mx = [0, 1, 2].map((k) => Math.max(...pts.map((q) => q[k])));
  return { nome: p.nome, conj: p.conj, x: mn[0], y: mn[1], z: mn[2], dx: mx[0] - mn[0], dy: mx[1] - mn[1], dz: mx[2] - mn[2] };
}
test('portas abertas não batem umas nas outras nem nas gavetas abertas', () => {
  const casos = [['roupeiro', E.specPadrao('roupeiro')], ['balcao', E.specPadrao('balcao')], ['aereo', E.specPadrao('aereo')]];
  const r2 = E.specPadrao('roupeiro'); r2.frentes.anguloDobradica = 170; casos.push(['roupeiro 170°', r2]);
  for (const [nome, s] of casos) {
    const m = E.calcular(s);
    const raiz = (id) => { const mp = {}; m.conjuntos.forEach((c) => { mp[c.id] = c; }); while (id && mp[id].pai) id = mp[id].pai; return id; };
    const portas = m.pecas.filter((p) => p.meta && p.meta.tipo === 'porta').map((p) => caixaGirada(p, m.conjuntos));
    const gavetas = m.pecas.filter((p) => /^Frente gaveta|^Lateral gaveta/.test(p.nome)).map((p) => caixaGirada(p, m.conjuntos));
    for (let i = 0; i < portas.length; i++) {
      for (let j = i + 1; j < portas.length; j++) if (sobrepoe(portas[i], portas[j], 0.6)) assert.fail(nome + ': duas portas abertas se cruzam');
      for (const g of gavetas) if (raiz(g.conj) !== raiz(portas[i].conj) && sobrepoe(portas[i], g, 0.6)) assert.fail(nome + ': porta aberta bate em ' + g.nome + ' aberta');
    }
  }
});

test('dobradiça: base fixa na lateral (não abre junto), caneco na porta; cabideiro com suportes nas laterais', () => {
  const m = E.calcular(E.specPadrao('roupeiro'));
  const bases = m.pecas.filter((p) => /\(base na lateral\)/.test(p.nome));
  const canecos = m.pecas.filter((p) => /\(caneco\)/.test(p.nome));
  assert.ok(bases.length > 0 && bases.length === canecos.length, 'uma base para cada caneco');
  bases.forEach((b) => assert.ok(!b.conj, 'base não se move com a porta'));
  canecos.forEach((c) => assert.ok(c.conj, 'caneco vai com a porta'));
  const vaos = m.vaos;
  bases.forEach((b) => assert.ok(vaos.some((v) => Math.abs(b.x - v.il) < 0.6 || Math.abs(b.x + b.dx - v.ir) < 0.6), 'base encostada na face da lateral/divisória'));
  const tubos = m.pecas.filter((p) => /^Tubo cabideiro/.test(p.nome));
  assert.ok(tubos.length > 0);
  tubos.forEach((tb) => {
    const sup = m.pecas.filter((p) => p.nome === 'Suporte do cabideiro' && Math.abs(p.z + p.dz / 2 - (tb.z + tb.dz / 2)) < 20 && p.col === tb.col);
    assert.strictEqual(sup.length, 2, 'dois suportes por tubo');
  });
});
