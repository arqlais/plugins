/*
 * Marcenaria Paramétrica — motor de cálculo
 * ------------------------------------------------------------
 * Tudo aqui é JavaScript puro (sem DOM, sem SketchUp): recebe a
 * especificação do armário (spec) e devolve o modelo completo:
 * vãos, peças 3D, conferência técnica, ferragens e resumo.
 *
 * Unidades: milímetros.
 * Sistema de coordenadas do armário (visto de frente):
 *   x -> para a direita (0 = face externa da lateral esquerda)
 *   y -> para o fundo   (0 = face frontal da caixaria)
 *   z -> para cima      (0 = piso / base do móvel)
 * Portas sobrepostas ficam em y negativo (na frente da caixaria).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarcEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  function deepMerge(base, over) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base) || Array.isArray(over) || typeof base !== 'object' || typeof over !== 'object') return over;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) {
      out[k] = (k in base) ? deepMerge(base[k], over[k]) : over[k];
    });
    return out;
  }
  function fmtNum(v, dec) {
    return Number(v).toFixed(dec).replace('.', ',');
  }
  function fmtM(mm) { return fmtNum(mm / 1000, 3) + ' m'; }
  function fmtCm(mm) {
    var cm = mm / 10;
    return (Math.abs(cm - Math.round(cm)) < 0.05 ? String(Math.round(cm)) : fmtNum(cm, 1)) + ' cm';
  }
  function fmtMm(mm) { return (Math.abs(mm - Math.round(mm)) < 0.05 ? String(Math.round(mm)) : fmtNum(mm, 1)) + ' mm'; }

  // Corrediças de gaveta: comprimentos comerciais (mm)
  var CORREDICAS = [250, 300, 350, 400, 450, 500, 550, 600];

  // ------------------------------------------------------------------
  // Tipos de móvel e predefinições
  // ------------------------------------------------------------------
  var TIPOS = {
    inferior: {
      label: 'Inferior de cozinha', nome: 'Armário inferior',
      L: 2400, D: 580, H: 880, elevacao: 0,
      rodape: { tipo: 'rodape', altura: 100, recuo: 50 },
      topo: 'travessas', folgaTopo: 3,
      pedra: { ativa: true, espessura: 20, avancoFrente: 20, avancoLados: 0 },
      larguraModulo: 700, prateleiras: 1
    },
    aereo: {
      label: 'Aéreo', nome: 'Armário aéreo',
      L: 2400, D: 350, H: 700, elevacao: 1500,
      rodape: { tipo: 'nenhum', altura: 0, recuo: 0 },
      topo: 'chapa', folgaTopo: 0,
      pedra: { ativa: false, espessura: 20, avancoFrente: 20, avancoLados: 0 },
      larguraModulo: 700, prateleiras: 1
    },
    torre: {
      label: 'Torre quente (forno/micro)', nome: 'Torre quente',
      L: 640, D: 580, H: 2200, elevacao: 0,
      rodape: { tipo: 'rodape', altura: 100, recuo: 50 },
      topo: 'chapa', folgaTopo: 0,
      pedra: { ativa: false, espessura: 20, avancoFrente: 20, avancoLados: 0 },
      larguraModulo: 640, prateleiras: 1
    },
    roupeiro: {
      label: 'Roupeiro / guarda-roupa', nome: 'Roupeiro',
      L: 2700, D: 600, H: 2500, elevacao: 0,
      rodape: { tipo: 'rodape', altura: 100, recuo: 50 },
      topo: 'chapa', folgaTopo: 0,
      pedra: { ativa: false, espessura: 20, avancoFrente: 20, avancoLados: 0 },
      larguraModulo: 900, prateleiras: 2
    },
    gabinete: {
      label: 'Gabinete de banheiro (suspenso)', nome: 'Gabinete banheiro',
      L: 800, D: 480, H: 550, elevacao: 300,
      rodape: { tipo: 'nenhum', altura: 0, recuo: 0 },
      topo: 'travessas', folgaTopo: 3,
      pedra: { ativa: true, espessura: 20, avancoFrente: 10, avancoLados: 0 },
      larguraModulo: 800, prateleiras: 0
    },
    estante: {
      label: 'Estante / nichos abertos', nome: 'Estante',
      L: 1800, D: 350, H: 2000, elevacao: 0,
      rodape: { tipo: 'rodape', altura: 80, recuo: 30 },
      topo: 'chapa', folgaTopo: 0,
      pedra: { ativa: false, espessura: 20, avancoFrente: 20, avancoLados: 0 },
      larguraModulo: 600, prateleiras: 3
    }
  };

  var TIPOS_SECAO = {
    portas: 'Portas',
    gavetas: 'Gavetas',
    basculante: 'Basculante',
    nicho: 'Nicho aberto',
    forno: 'Nicho forno',
    micro: 'Nicho micro-ondas'
  };

  var MATERIAIS_PADRAO = {
    caixa: { nome: 'MDF Branco TX 18', cor: '#f1efe9', veio: false },
    frente: { nome: 'MDF Carvalho Malva 18', cor: '#8b6c4a', veio: true },
    fundo: { nome: 'HDF Branco 6', cor: '#e9e7e2', veio: false },
    gaveta: { nome: 'MDF Branco 15', cor: '#f4f2ee', veio: false },
    fundoGaveta: { nome: 'HDF Branco 6', cor: '#e9e7e2', veio: false }
  };

  var PRECOS_PADRAO = {
    chapa: { caixa: 320, frente: 520, fundo: 110, gaveta: 290, fundoGaveta: 110 },
    fitaMetro: { caixa: 1.6, frente: 3.2, gaveta: 1.6 },
    dobradica: 14, corredicaPar: 38, puxador: 25, pe: 4, pistao: 22,
    suportePrateleira: 0.4, cabideiroMetro: 28,
    maoDeObraPct: 0
  };

  function novaSecao(tipo, extra) {
    var s = {
      tipo: tipo || 'portas',
      altura: null,          // altura de frente (mm) ou null = automática
      portas: 0,             // 0 = automático (1 ou 2 conforme largura)
      dobradica: 'esq',      // lado da dobradiça para porta única
      gavetas: 3,
      alturasGavetas: null,  // lista de alturas de frente ou null = iguais
      prateleiras: 1,
      interior: 'prateleiras' // prateleiras | cabideiro | vazio
    };
    return extra ? deepMerge(s, extra) : s;
  }

  function novoVao(largura, secoes) {
    return { largura: isNum(largura) ? largura : null, secoes: secoes || [novaSecao('portas')] };
  }

  function specPadrao(tipo) {
    tipo = TIPOS[tipo] ? tipo : 'inferior';
    var t = TIPOS[tipo];
    var spec = {
      versao: 1,
      nome: t.nome,
      tipo: tipo,
      L: t.L, D: t.D, H: t.H,
      elevacao: t.elevacao,
      rodape: clone(t.rodape),
      topo: t.topo,
      travessaLargura: 100,
      esp: { caixa: 18, frente: 18, fundo: 6, gaveta: 15, fundoGaveta: 6 },
      fundo: { tipo: 'sobreposto', recuoEncaixe: 10, rasgo: 8 },
      frentes: {
        montagem: 'sobreposta',   // sobreposta | embutida
        folga: 3,                 // entre frentes (mm)
        folgaTopo: t.folgaTopo,   // topo da última frente
        folgaEmbutida: 2,         // folga de cada lado na porta embutida
        puxador: 'externo',       // externo | perfil | cava | gola | toque
        veio: 'vertical'          // vertical | horizontal
      },
      gavetas: { corredica: 'telescopica' }, // telescopica | oculta
      prateleiras: { recuo: 20, folga: 1 },
      pedra: clone(t.pedra),
      cuba: { ativa: false, centro: Math.round(t.L / 2), largura: 500, profundidade: 400, origem: 'manual' },
      chapa: { comprimento: 2750, largura: 1850, refilo: 10, serra: 4 },
      emendaAuto: true,
      materiais: clone(MATERIAIS_PADRAO),
      precos: clone(PRECOS_PADRAO),
      vaos: []
    };
    spec.vaos = autoVaos(spec);
    return spec;
  }

  // Aplica a predefinição de um tipo mantendo materiais/preços/chapa
  function aplicarTipo(spec, tipo) {
    var novo = specPadrao(tipo);
    novo.materiais = clone(spec.materiais || novo.materiais);
    novo.precos = clone(spec.precos || novo.precos);
    novo.chapa = clone(spec.chapa || novo.chapa);
    novo.esp = clone(spec.esp || novo.esp);
    novo.frentes.montagem = (spec.frentes && spec.frentes.montagem) || novo.frentes.montagem;
    novo.frentes.puxador = (spec.frentes && spec.frentes.puxador) || novo.frentes.puxador;
    novo.frentes.veio = (spec.frentes && spec.frentes.veio) || novo.frentes.veio;
    if (spec.L) { novo.L = spec.L; }
    novo.cuba.centro = Math.round(novo.L / 2);
    novo.vaos = autoVaos(novo);
    return novo;
  }

  function normalizar(spec) {
    var base = specPadrao(spec && TIPOS[spec.tipo] ? spec.tipo : 'inferior');
    var s = deepMerge(base, spec || {});
    if (!Array.isArray(s.vaos) || !s.vaos.length) s.vaos = autoVaos(s);
    s.vaos = s.vaos.map(function (v) {
      var vv = deepMerge(novoVao(null), v || {});
      if (!Array.isArray(vv.secoes) || !vv.secoes.length) vv.secoes = [novaSecao('portas')];
      vv.secoes = vv.secoes.map(function (sec) { return novaSecao(sec && sec.tipo, sec); });
      return vv;
    });
    ['L', 'D', 'H', 'elevacao', 'travessaLargura'].forEach(function (k) { s[k] = num(s[k], base[k]); });
    return s;
  }

  // ------------------------------------------------------------------
  // Distribuição automática de vãos
  // ------------------------------------------------------------------
  function dividirTrecho(comp, alvo) {
    if (comp <= 0) return [];
    var n = Math.max(1, Math.round(comp / alvo));
    var larg = [];
    var base = Math.floor(comp / n);
    var resto = comp - base * n;
    for (var i = 0; i < n; i++) larg.push(base + (i < resto ? 1 : 0));
    return larg;
  }

  function autoVaos(spec, nVaos) {
    var t = TIPOS[spec.tipo] || TIPOS.inferior;
    var L = spec.L;
    var alvo = t.larguraModulo;
    var vaos = [];
    var nPrat = t.prateleiras;

    if (spec.tipo === 'torre') {
      var larguras = nVaos ? dividirTrecho(L, L / nVaos) : dividirTrecho(L, Math.max(L, 1));
      larguras.forEach(function () {
        vaos.push(novoVao(null, [
          novaSecao('gavetas', { altura: 520, gavetas: 2 }),
          novaSecao('forno', { altura: 620 }),
          novaSecao('micro', { altura: 450 }),
          novaSecao('portas', { prateleiras: 1 })
        ]));
      });
      return vaos;
    }

    if (spec.tipo === 'roupeiro') {
      var lr = nVaos ? dividirTrecho(L, L / nVaos) : dividirTrecho(L, alvo);
      lr.forEach(function (w, i) {
        var maleiro = novaSecao('portas', { altura: 450, prateleiras: 0, interior: 'vazio' });
        var meio;
        if (i === lr.length - 1 && lr.length > 1) {
          vaos.push(novoVao(null, [
            novaSecao('gavetas', { altura: 600, gavetas: 3 }),
            novaSecao('portas', { prateleiras: 3, interior: 'prateleiras' }),
            maleiro
          ]));
          return;
        }
        meio = novaSecao('portas', { prateleiras: 0, interior: 'cabideiro' });
        vaos.push(novoVao(null, [meio, maleiro]));
      });
      return vaos;
    }

    if (spec.tipo === 'estante') {
      dividirTrecho(L, nVaos ? L / nVaos : alvo).forEach(function () {
        vaos.push(novoVao(null, [novaSecao('nicho', { prateleiras: nPrat })]));
      });
      return vaos;
    }

    var cuba = spec.cuba && spec.cuba.ativa;
    if (cuba && (spec.tipo === 'inferior' || spec.tipo === 'gabinete')) {
      var cw = Math.min(L, Math.max(600, Math.min(1200, Math.round((spec.cuba.largura + 300) / 50) * 50)));
      var c0 = spec.cuba.centro - cw / 2;
      var c1 = spec.cuba.centro + cw / 2;
      if (c0 < 250) { c0 = 0; c1 = Math.max(c1, Math.min(L, cw)); }
      if (L - c1 < 250) { c1 = L; c0 = Math.min(c0, Math.max(0, L - cw)); }
      c0 = Math.round(c0); c1 = Math.round(c1);
      var esq = dividirTrecho(c0, alvo);
      var dir = dividirTrecho(L - c1, alvo);
      esq.forEach(function (w) { vaos.push(novoVao(w, [novaSecao('portas', { prateleiras: nPrat })])); });
      vaos.push(novoVao(c1 - c0, [novaSecao('portas', { prateleiras: 0, interior: 'vazio' })]));
      dir.forEach(function (w, i) {
        var gav = (spec.tipo === 'inferior' && i === 0 && dir.length >= 1 && w >= 350 && w <= 900);
        vaos.push(novoVao(w, [gav ? novaSecao('gavetas', { gavetas: 4 }) : novaSecao('portas', { prateleiras: nPrat })]));
      });
      // última largura automática para absorver arredondamentos
      vaos[vaos.length - 1].largura = null;
      return vaos;
    }

    var ls = nVaos ? dividirTrecho(L, L / nVaos) : dividirTrecho(L, alvo);
    ls.forEach(function (w, i) {
      var sec;
      if (spec.tipo === 'inferior' && ls.length >= 3 && i === ls.length - 1 && w <= 900) {
        sec = novaSecao('gavetas', { gavetas: 4 });
      } else {
        sec = novaSecao('portas', { prateleiras: nPrat });
      }
      vaos.push(novoVao(null, [sec]));
    });
    return vaos;
  }

  // ------------------------------------------------------------------
  // Resolução de medidas (larguras de vãos / alturas de seções)
  // ------------------------------------------------------------------
  function resolverMedidas(itens, total, chave, minimo) {
    var fixo = 0, nAuto = 0;
    itens.forEach(function (it) {
      var v = it[chave];
      if (isNum(v) && v > 0) fixo += v; else nAuto++;
    });
    var resto = total - fixo;
    var res = { medidas: [], erro: null };
    var autoV = nAuto ? resto / nAuto : 0;
    if (nAuto === 0 && Math.abs(resto) > 0.5) {
      // sem automáticos: ajusta o último proporcionalmente (mantém soma)
      res.erro = 'soma';
    }
    if (nAuto > 0 && autoV < minimo) res.erro = 'pouco';
    itens.forEach(function (it, i) {
      var v = it[chave];
      var m = (isNum(v) && v > 0) ? v : autoV;
      res.medidas.push(m);
    });
    if (nAuto === 0 && res.medidas.length) {
      res.medidas[res.medidas.length - 1] += resto; // fecha a conta
    }
    return res;
  }

  // Divide um trecho [a,b] em pedaços <= maxLen, emendando sobre apoios
  function dividirSobreApoios(a, b, apoios, maxLen) {
    var pedacos = [];
    var ini = a;
    var semApoio = false;
    var guard = 0;
    while (b - ini > maxLen + 0.01 && guard++ < 50) {
      var cand = apoios.filter(function (s) { return s > ini + 50 && s - ini <= maxLen; });
      if (!cand.length) { semApoio = true; break; }
      var s = cand[cand.length - 1];
      pedacos.push([ini, s]);
      ini = s;
    }
    pedacos.push([ini, b]);
    return { pedacos: pedacos, semApoio: semApoio };
  }

  // ------------------------------------------------------------------
  // Fábrica de peças
  // ------------------------------------------------------------------
  function criarFabrica(spec) {
    var lista = [];
    var seq = 0;
    function chapa(o) {
      // o: {nome, grupo, mat, eixoEsp, x,y,z,dx,dy,dz, veio(eixo), fitas[], vao, secao, obs, meta}
      if (!(o.dx > 0.05 && o.dy > 0.05 && o.dz > 0.05)) return null;
      var tam = { x: o.dx, y: o.dy, z: o.dz };
      var eixos = ['x', 'y', 'z'].filter(function (a) { return a !== o.eixoEsp; });
      var mat = spec.materiais[o.mat] || { veio: false };
      var eixoC;
      if (mat.veio && o.veio && o.veio !== o.eixoEsp) eixoC = o.veio;
      else eixoC = tam[eixos[0]] >= tam[eixos[1]] ? eixos[0] : eixos[1];
      var eixoL = eixos[0] === eixoC ? eixos[1] : eixos[0];
      var fitaC = 0, fitaL = 0;
      (o.fitas || []).forEach(function (a) { if (a === eixoC) fitaC++; else if (a === eixoL) fitaL++; });
      var p = {
        id: 'P' + (++seq),
        nome: o.nome,
        grupo: o.grupo,
        mat: o.mat,
        cortavel: o.cortavel !== false,
        x: r1(o.x), y: r1(o.y), z: r1(o.z),
        dx: r1(o.dx), dy: r1(o.dy), dz: r1(o.dz),
        corte: { c: r1(tam[eixoC]), l: r1(tam[eixoL]), e: r1(tam[o.eixoEsp]) },
        veio: !!mat.veio,
        fitaC: Math.min(2, fitaC), fitaL: Math.min(2, fitaL),
        vao: isNum(o.vao) ? o.vao : null,
        secao: isNum(o.secao) ? o.secao : null,
        obs: o.obs || '',
        meta: o.meta || null
      };
      lista.push(p);
      return p;
    }
    function objeto(o) {
      // peças não cortáveis (pedra, tubo, pés)
      if (!(o.dx > 0.05 && o.dy > 0.05 && o.dz > 0.05)) return null;
      var p = {
        id: 'P' + (++seq), nome: o.nome, grupo: o.grupo, mat: o.mat, cortavel: false,
        x: r1(o.x), y: r1(o.y), z: r1(o.z), dx: r1(o.dx), dy: r1(o.dy), dz: r1(o.dz),
        corte: null, veio: false, fitaC: 0, fitaL: 0,
        vao: isNum(o.vao) ? o.vao : null, secao: isNum(o.secao) ? o.secao : null,
        obs: o.obs || '', meta: o.meta || null
      };
      lista.push(p);
      return p;
    }
    return { chapa: chapa, objeto: objeto, lista: lista };
  }

  function nDobradicas(altura) {
    if (altura <= 900) return 2;
    if (altura <= 1600) return 3;
    if (altura <= 2100) return 4;
    return 5;
  }

  // ------------------------------------------------------------------
  // Cálculo principal
  // ------------------------------------------------------------------
  function calcular(specIn) {
    var spec = normalizar(specIn);
    var avisos = [];
    function erro(msg, ref) { avisos.push({ nivel: 'erro', msg: msg, ref: ref || null }); }
    function aviso(msg, ref) { avisos.push({ nivel: 'aviso', msg: msg, ref: ref || null }); }
    function info(msg, ref) { avisos.push({ nivel: 'info', msg: msg, ref: ref || null }); }

    var L = spec.L, D = spec.D, H = spec.H;
    var T = spec.esp.caixa, Tf = spec.esp.frente, F = spec.esp.fundo;
    var Tg = spec.esp.gaveta, Fg = spec.esp.fundoGaveta;
    var fr = spec.frentes;
    var g = fr.folga;
    var embutida = fr.montagem === 'embutida';
    var usavelC = spec.chapa.comprimento - 2 * spec.chapa.refilo;
    var usavelL = spec.chapa.largura - 2 * spec.chapa.refilo;
    var fab = criarFabrica(spec);
    var tipo = spec.tipo;
    var nomeTipo = (TIPOS[tipo] || TIPOS.inferior).label;

    var resultado = {
      spec: spec, pecas: fab.lista, avisos: avisos, vaos: [], ok: false,
      dims: { L: L, D: D, H: H, z0: 0, Hc: 0, Dc: 0, frenteY0: 0 },
      ferragens: [], resumo: {}
    };

    // --- validações de base (evitam geometria degenerada) ---
    if (!(L >= 100)) { erro('Comprimento inválido (mínimo 100 mm).'); return resultado; }
    if (!(D >= 150)) { erro('Profundidade inválida (mínimo 150 mm).'); return resultado; }
    if (!(H >= 150)) { erro('Altura inválida (mínimo 150 mm).'); return resultado; }
    if (!(T >= 6 && T <= 40)) { erro('Espessura da caixaria fora do intervalo (6 a 40 mm).'); return resultado; }

    var temRodape = spec.rodape.tipo !== 'nenhum' && tipo !== 'aereo' && tipo !== 'gabinete';
    var z0 = temRodape ? Math.max(0, spec.rodape.altura) : 0;
    var Hc = H - z0;
    if (Hc < 2 * T + 80) { erro('Altura da caixaria muito baixa (' + fmtMm(Hc) + '). Reduza o rodapé ou aumente a altura.'); return resultado; }
    var fundoTipo = spec.fundo.tipo;
    var Dc = D - (fundoTipo === 'sobreposto' ? F : 0); // profundidade das peças da caixaria
    var profUtil = fundoTipo === 'encaixado' ? D - spec.fundo.recuoEncaixe - F : Dc;
    var yFrenteInt = embutida ? Tf : 0; // onde começa o interior útil
    var topoTravessas = spec.topo === 'travessas';
    var zTop = z0 + Hc;

    resultado.dims = { L: L, D: D, H: H, z0: z0, Hc: Hc, Dc: Dc, frenteY0: embutida ? 0 : -Tf, profUtil: profUtil };

    // --- vãos (larguras) ---
    var rv = resolverMedidas(spec.vaos, L, 'largura', 2 * T + 60);
    if (rv.erro === 'pouco') erro('As larguras fixas dos vãos somam mais que o comprimento disponível. Ajuste as larguras ou deixe algum vão automático.');
    if (rv.erro === 'soma') info('Todos os vãos têm largura fixa: o último foi ajustado para fechar ' + fmtMm(L) + '.');
    var xs = [0];
    rv.medidas.forEach(function (w) { xs.push(xs[xs.length - 1] + w); });
    var nV = spec.vaos.length;
    var divs = []; // centros das divisórias
    for (var di = 1; di < nV; di++) divs.push(xs[di]);

    // cuba
    var cubaAtiva = spec.cuba.ativa && (tipo === 'inferior' || tipo === 'gabinete');
    var vaoCuba = -1;
    if (cubaAtiva) {
      for (var vi = 0; vi < nV; vi++) {
        if (spec.cuba.centro >= xs[vi] && spec.cuba.centro <= xs[vi + 1]) { vaoCuba = vi; break; }
      }
      if (vaoCuba < 0) aviso('A cuba está fora do comprimento do armário (centro em ' + fmtMm(spec.cuba.centro) + ').');
    }

    // estrutura de vãos com interior
    var vaosM = [];
    for (var i = 0; i < nV; i++) {
      var x0 = xs[i], x1 = xs[i + 1];
      var il = i === 0 ? T : x0 + T / 2;
      var ir = i === nV - 1 ? L - T : x1 - T / 2;
      var vm = { idx: i, x0: x0, x1: x1, il: il, ir: ir, larg: x1 - x0, largInt: ir - il, cuba: i === vaoCuba, secoes: [] };
      if (vm.largInt < 100) erro('Vão ' + (i + 1) + ' ficou com só ' + fmtMm(vm.largInt) + ' de largura interna (mínimo 100 mm).', { vao: i });

      // seções verticais
      var secs = spec.vaos[i].secoes;
      var rs = resolverMedidas(secs, Hc, 'altura', 2 * T + 40);
      if (rs.erro === 'pouco') erro('Vão ' + (i + 1) + ': as alturas fixas das seções somam mais que a altura da caixaria (' + fmtMm(Hc) + ').', { vao: i });
      var zs = [z0];
      rs.medidas.forEach(function (h) { zs.push(zs[zs.length - 1] + h); });
      for (var j = 0; j < secs.length; j++) {
        var sz0 = zs[j], sz1 = zs[j + 1];
        var ib = j === 0 ? z0 + T : sz0 + T / 2;
        var it = j === secs.length - 1 ? zTop - T : sz1 - T / 2;
        vm.secoes.push({ idx: j, tipo: secs[j].tipo, z0: sz0, z1: sz1, ib: ib, it: it, alt: sz1 - sz0, altInt: it - ib, cfg: secs[j], frentes: [] });
        if (it - ib < 60) erro('Vão ' + (i + 1) + ', seção ' + (j + 1) + ': altura interna de ' + fmtMm(it - ib) + ' é pequena demais.', { vao: i, secao: j });
      }
      vaosM.push(vm);
    }
    resultado.vaos = vaosM;
    if (avisos.some(function (a) { return a.nivel === 'erro'; })) { finalizar(); return resultado; }

    // ================================================================
    // CAIXARIA
    // ================================================================
    // Base (chapa de baixo) — corre o comprimento todo; laterais apoiam sobre ela
    var baseDiv = dividirSobreApoios(0, L, divs, spec.emendaAuto ? usavelC : 1e9);
    baseDiv.pedacos.forEach(function (pc, k) {
      fab.chapa({
        nome: baseDiv.pedacos.length > 1 ? 'Base ' + (k + 1) : 'Base', grupo: 'caixa', mat: 'caixa', eixoEsp: 'z',
        x: pc[0], y: 0, z: z0, dx: pc[1] - pc[0], dy: Dc, dz: T, veio: 'x', fitas: ['x'],
        obs: baseDiv.pedacos.length > 1 ? 'Emenda sobre divisória' : ''
      });
    });
    if (L > usavelC) {
      if (spec.emendaAuto && !baseDiv.semApoio) {
        info('Base com ' + fmtCm(L) + ' passa do comprimento útil da chapa (' + fmtCm(usavelC) + '): dividida em ' + baseDiv.pedacos.length + ' peças com emenda sobre divisória.');
      } else {
        aviso('Base com ' + fmtCm(L) + ' passa do comprimento da chapa (' + fmtCm(usavelC) + '): o marceneiro precisará de emenda — prefira posicioná-la sobre uma divisória.');
      }
    }

    // Laterais
    var hLat = Hc - T;
    [0, L - T].forEach(function (x, k) {
      fab.chapa({
        nome: k === 0 ? 'Lateral esquerda' : 'Lateral direita', grupo: 'caixa', mat: 'caixa', eixoEsp: 'x',
        x: x, y: 0, z: z0 + T, dx: T, dy: Dc, dz: hLat, veio: 'z', fitas: ['z'],
        obs: (k === 0 && vaoCuba === 0) || (k === 1 && vaoCuba === nV - 1) ? 'Recorte p/ cuba (2 cm de folga)' : ''
      });
    });
    if (hLat > usavelC) aviso('Laterais com ' + fmtCm(hLat) + ' passam do comprimento útil da chapa (' + fmtCm(usavelC) + ').');
    if (Dc > usavelL) aviso('Profundidade de ' + fmtCm(Dc) + ' passa da largura útil da chapa (' + fmtCm(usavelL) + ').');

    // Topo (chapa) ou travessas
    var topoDiv = dividirSobreApoios(T, L - T, divs, spec.emendaAuto ? usavelC : 1e9);
    if (topoTravessas) {
      var tl = Math.min(spec.travessaLargura, Dc / 2);
      topoDiv.pedacos.forEach(function (pc, k) {
        var suf = topoDiv.pedacos.length > 1 ? ' ' + (k + 1) : '';
        fab.chapa({ nome: 'Travessa frontal' + suf, grupo: 'caixa', mat: 'caixa', eixoEsp: 'z',
          x: pc[0], y: 0, z: zTop - T, dx: pc[1] - pc[0], dy: tl, dz: T, veio: 'x', fitas: ['x'],
          obs: vaoCuba >= 0 ? 'Recorte p/ cuba onde necessário' : '' });
        fab.chapa({ nome: 'Travessa traseira' + suf, grupo: 'caixa', mat: 'caixa', eixoEsp: 'z',
          x: pc[0], y: Dc - tl, z: zTop - T, dx: pc[1] - pc[0], dy: tl, dz: T, veio: 'x', fitas: [] });
      });
      info('Sem chapa de cima: duas travessas (frente e fundo) de ' + fmtCm(tl) + ' amarram a caixaria' + (spec.pedra.ativa ? ' e apoiam a pedra.' : '.'));
    } else {
      topoDiv.pedacos.forEach(function (pc, k) {
        fab.chapa({ nome: topoDiv.pedacos.length > 1 ? 'Topo ' + (k + 1) : 'Topo', grupo: 'caixa', mat: 'caixa', eixoEsp: 'z',
          x: pc[0], y: 0, z: zTop - T, dx: pc[1] - pc[0], dy: Dc, dz: T, veio: 'x', fitas: ['x'] });
      });
    }

    // Divisórias
    divs.forEach(function (xc, k) {
      var adjCuba = (vaoCuba === k || vaoCuba === k + 1);
      fab.chapa({ nome: 'Divisória ' + (k + 1), grupo: 'caixa', mat: 'caixa', eixoEsp: 'x',
        x: xc - T / 2, y: 0, z: z0 + T, dx: T, dy: Dc, dz: Hc - 2 * T, veio: 'z', fitas: ['z'],
        obs: adjCuba ? 'Recorte p/ cuba (2 cm de folga)' : '' });
    });

    // Fundo
    if (fundoTipo !== 'nenhum') {
      if (fundoTipo === 'sobreposto') {
        // agrupa vãos contíguos sem cuba, limitado ao comprimento da chapa
        var runs = [];
        var atual = null;
        var maxRun = Hc > usavelL ? usavelL : usavelC; // se a altura não cabe na largura da chapa, o fundo gira
        vaosM.forEach(function (vm) {
          if (vm.cuba) { atual = null; return; }
          var a = vm.idx === 0 ? 0 : vm.x0;
          var b = vm.idx === nV - 1 ? L : vm.x1;
          if (atual && (b - atual[0]) <= maxRun && atual[1] === a) atual[1] = b;
          else { atual = [a, b]; runs.push(atual); }
        });
        runs.forEach(function (rn, k) {
          fab.chapa({ nome: runs.length > 1 ? 'Fundo ' + (k + 1) : 'Fundo', grupo: 'fundo', mat: 'fundo', eixoEsp: 'y',
            x: rn[0], y: Dc, z: z0, dx: rn[1] - rn[0], dy: F, dz: Hc, fitas: [], obs: 'Pregado/grampeado atrás' });
        });
      } else {
        var rasgo = spec.fundo.rasgo;
        vaosM.forEach(function (vm) {
          if (vm.cuba) return;
          var zb = z0 + T - rasgo;
          var zt = topoTravessas ? zTop : zTop - T + rasgo;
          fab.chapa({ nome: 'Fundo vão ' + (vm.idx + 1), grupo: 'fundo', mat: 'fundo', eixoEsp: 'y',
            x: vm.il - rasgo, y: D - spec.fundo.recuoEncaixe - F, z: zb, dx: vm.largInt + 2 * rasgo, dy: F, dz: zt - zb,
            fitas: [], vao: vm.idx, obs: 'Encaixado em rasgo de ' + rasgo + ' mm' });
        });
      }
    }
    if (vaoCuba >= 0) {
      info('Cuba no vão ' + (vaoCuba + 1) + ': o módulo da pia fica sem fundo, sem prateleira na altura do sifão e laterais, divisórias, travessas e gavetas recortadas com 2 cm de folga.', { vao: vaoCuba });
    }

    // ================================================================
    // INTERIOR + FRENTES (por vão e seção)
    // ================================================================
    var cont = { portas: 0, gavetas: 0, basculantes: 0, prateleirasMoveis: 0, prateleirasFixas: 0, nichos: 0,
      dobradicas: { reta: 0, curva: 0, superCurva: 0 }, corredicas: {}, puxadores: 0, pistoes: 0, cabideiroMm: 0, suportesCabideiro: 0 };
    var vaosLargosPrat = [];

    vaosM.forEach(function (vm) {
      var i = vm.idx;
      var nS = vm.secoes.length;
      vm.secoes.forEach(function (sm) {
        var j = sm.idx;
        var cfg = sm.cfg;
        var ref = { vao: i, secao: j };
        var rotulo = 'Vão ' + (i + 1) + (nS > 1 ? ', seção ' + (j + 1) : '');

        // prateleira fixa entre seções (no topo desta seção)
        if (j < nS - 1) {
          fab.chapa({ nome: 'Prateleira fixa', grupo: 'caixa', mat: 'caixa', eixoEsp: 'z',
            x: vm.il, y: yFrenteInt, z: sm.z1 - T / 2, dx: vm.largInt, dy: Dc - yFrenteInt, dz: T, veio: 'x', fitas: ['x'],
            vao: i, secao: j, obs: 'Fixa (estrutural)' });
          cont.prateleirasFixas++;
        }

        // ---- região de cobertura da frente ----
        var extEsq = i === 0, extDir = i === nV - 1, extBaixo = j === 0, extTopo = j === nS - 1;
        var reg;
        if (embutida) {
          var fe = fr.folgaEmbutida;
          reg = { x0: vm.il + fe, x1: vm.ir - fe, z0: sm.ib + fe, z1: sm.it - fe, y0: 0, y1: Tf };
        } else {
          reg = {
            x0: vm.x0 + (extEsq ? 0 : g / 2), x1: vm.x1 - (extDir ? 0 : g / 2),
            z0: sm.z0 + (extBaixo ? 0 : g / 2), z1: sm.z1 - (extTopo ? fr.folgaTopo : g / 2),
            y0: -Tf, y1: 0
          };
        }
        var regW = reg.x1 - reg.x0, regH = reg.z1 - reg.z0;
        var veioFrente = fr.veio === 'horizontal' ? 'x' : 'z';
        var tipoHinge = function (lado) {
          if (embutida) return 'superCurva';
          if (lado === 'esq') return extEsq ? 'reta' : 'curva';
          if (lado === 'dir') return extDir ? 'reta' : 'curva';
          if (lado === 'topo') return extTopo ? 'reta' : 'curva';
          return 'reta';
        };
        var nomeHinge = { reta: 'reta', curva: 'curva', superCurva: 'super curva' };

        function prateleirasMoveis(n) {
          if (n <= 0) return;
          if (vm.cuba) return;
          var pw = vm.largInt - 2 * spec.prateleiras.folga;
          var pd = profUtil - yFrenteInt - spec.prateleiras.recuo;
          for (var k = 1; k <= n; k++) {
            var zc = sm.ib + (sm.altInt) * k / (n + 1);
            fab.chapa({ nome: 'Prateleira', grupo: 'caixa', mat: 'caixa', eixoEsp: 'z',
              x: vm.il + spec.prateleiras.folga, y: yFrenteInt + spec.prateleiras.recuo, z: zc - T / 2, dx: pw, dy: pd, dz: T,
              veio: 'x', fitas: ['x'], vao: i, secao: j, obs: 'Móvel (4 suportes)' });
            cont.prateleirasMoveis++;
          }
          if (vm.largInt > 800) vaosLargosPrat.push(i);
        }

        function cabideiro() {
          var zt = sm.it - 60;
          fab.objeto({ nome: 'Tubo cabideiro', grupo: 'ferragem', mat: 'metal',
            x: vm.il, y: (yFrenteInt + profUtil) / 2 - 12.5, z: zt - 15, dx: vm.largInt, dy: 25, dz: 15,
            vao: i, secao: j, obs: 'Tubo oblongo + 2 suportes' });
          cont.cabideiroMm += vm.largInt;
          cont.suportesCabideiro += 2;
          if (sm.altInt < 900) aviso(rotulo + ': cabideiro com só ' + fmtCm(sm.altInt) + ' de altura interna (camisas pedem ~100 cm, vestidos longos ~150 cm).', ref);
          if (profUtil < 520) aviso(rotulo + ': profundidade útil de ' + fmtCm(profUtil) + ' é pouca para cabides (ideal ≥ 55 cm).', ref);
        }

        if (cfg.tipo === 'portas' || cfg.tipo === 'basculante') {
          if (cfg.interior === 'cabideiro') cabideiro();
          else if (cfg.interior === 'prateleiras') prateleirasMoveis(cfg.prateleiras);
        }

        if (cfg.tipo === 'portas') {
          var nP = cfg.portas > 0 ? Math.min(2, cfg.portas) : (regW > 600 ? 2 : 1);
          var lados = nP === 2 ? ['esq', 'dir'] : [cfg.dobradica === 'dir' ? 'dir' : 'esq'];
          var pw = nP === 2 ? (regW - g) / 2 : regW;
          for (var k = 0; k < nP; k++) {
            var px = reg.x0 + k * (pw + g);
            var lado = lados[k];
            var th = tipoHinge(lado);
            var nd = nDobradicas(regH);
            cont.dobradicas[th] += nd;
            cont.portas++;
            if (fr.puxador !== 'toque' && fr.puxador !== 'gola') cont.puxadores++;
            var pp = fab.chapa({ nome: 'Porta', grupo: 'frente', mat: 'frente', eixoEsp: 'y',
              x: px, y: reg.y0, z: reg.z0, dx: pw, dy: Tf, dz: regH, veio: veioFrente, fitas: ['x', 'x', 'z', 'z'],
              vao: i, secao: j,
              obs: 'Dobradiça ' + nomeHinge[th] + ' à ' + (lado === 'esq' ? 'esquerda' : 'direita') + ' · ' + nd + ' un',
              meta: { tipo: 'porta', dobradica: lado, nDobradicas: nd, hinge: th } });
            if (pp && pw > 600) aviso(rotulo + ': porta com ' + fmtCm(pw) + ' de largura (acima de 60 cm pesa nas dobradiças e tende a cair).', ref);
            if (pp && regH > 2200) aviso(rotulo + ': porta com ' + fmtCm(regH) + ' de altura — use ' + nd + ' dobradiças e puxador perfil/endireitador para evitar empeno.', ref);
          }
          if (nP === 1 && regW < 150) aviso(rotulo + ': porta muito estreita (' + fmtCm(regW) + ').', ref);
        } else if (cfg.tipo === 'basculante') {
          var thB = tipoHinge('topo');
          var ndB = regW <= 900 ? 2 : 3;
          cont.dobradicas[thB] += ndB;
          cont.basculantes++;
          cont.pistoes += regW > 600 ? 2 : 1;
          if (fr.puxador !== 'toque' && fr.puxador !== 'gola') cont.puxadores++;
          fab.chapa({ nome: 'Porta basculante', grupo: 'frente', mat: 'frente', eixoEsp: 'y',
            x: reg.x0, y: reg.y0, z: reg.z0, dx: regW, dy: Tf, dz: regH, veio: veioFrente, fitas: ['x', 'x', 'z', 'z'],
            vao: i, secao: j, obs: 'Abre para cima · ' + ndB + ' dobradiças ' + nomeHinge[thB] + ' + pistão a gás',
            meta: { tipo: 'basculante', dobradica: 'topo', nDobradicas: ndB, hinge: thB } });
          if (regH > 500) aviso(rotulo + ': basculante com ' + fmtCm(regH) + ' de altura fica pesado/alto para abrir — considere articulador ou portas de giro.', ref);
          if (regW > 1000) aviso(rotulo + ': basculante com ' + fmtCm(regW) + ' de largura: use pistões reforçados ou divida em duas.', ref);
        } else if (cfg.tipo === 'gavetas') {
          var nG = Math.max(1, Math.min(8, Math.round(cfg.gavetas || 1)));
          var hs;
          if (Array.isArray(cfg.alturasGavetas) && cfg.alturasGavetas.length === nG) {
            var somaH = cfg.alturasGavetas.reduce(function (a, b) { return a + num(b, 0); }, 0);
            var esc = (regH - (nG - 1) * g) / somaH;
            hs = cfg.alturasGavetas.map(function (h) { return num(h, 0) * esc; });
          } else {
            var hEq = (regH - (nG - 1) * g) / nG;
            hs = []; for (var q = 0; q < nG; q++) hs.push(hEq);
          }
          var clear = spec.gavetas.corredica === 'oculta' ? 5 : 12.5;
          var yBox = yFrenteInt + (embutida ? 0 : 0);
          var dispProf = profUtil - yBox - 10;
          var comp = CORREDICAS.filter(function (c) { return c <= dispProf; });
          var lenC = comp.length ? comp[comp.length - 1] : 0;
          if (!lenC) erro(rotulo + ': profundidade útil (' + fmtMm(dispProf) + ') não comporta corrediça (mínimo 250 mm).', ref);
          var boxX0 = vm.il + clear, boxX1 = vm.ir - clear, boxW = boxX1 - boxX0;
          if (vm.largInt < 200) aviso(rotulo + ': gaveteiro estreito (' + fmtCm(vm.largInt) + ' interno).', ref);
          if (vm.largInt > 900) aviso(rotulo + ': gaveta com ' + fmtCm(vm.largInt) + ' interno: fundo pode flexionar — use fundo 15 mm ou corrediça reforçada.', ref);
          if (vm.cuba) aviso(rotulo + ': gavetas no módulo da cuba precisam de recorte em "U" para o sifão — confirme com o marceneiro.', ref);

          var zf = reg.z0;
          var frentesZ = [];
          for (var k2 = 0; k2 < nG; k2++) { frentesZ.push([zf, zf + hs[k2]]); zf += hs[k2] + g; }
          if (embutida) {
            // nas embutidas o ponto de partida é o vão interno
          }
          for (var k3 = 0; k3 < nG; k3++) {
            var fz0 = frentesZ[k3][0], fz1 = frentesZ[k3][1], fh = fz1 - fz0;
            cont.gavetas++;
            if (fr.puxador !== 'toque' && fr.puxador !== 'gola') cont.puxadores++;
            fab.chapa({ nome: 'Frente de gaveta', grupo: 'frente', mat: 'frente', eixoEsp: 'y',
              x: reg.x0, y: reg.y0, z: fz0, dx: regW, dy: Tf, dz: fh, veio: veioFrente, fitas: ['x', 'x', 'z', 'z'],
              vao: i, secao: j, obs: 'Gaveta ' + (k3 + 1) + '/' + nG,
              meta: { tipo: 'gaveta', ordem: k3 } });
            if (fh < 100) aviso(rotulo + ': frente de gaveta com ' + fmtCm(fh) + ' de altura é muito baixa (mín. ~10 cm).', ref);
            if (!lenC) continue;
            cont.corredicas[lenC] = (cont.corredicas[lenC] || 0) + 1;
            // caixa da gaveta
            var zBox = Math.max(fz0 + 20, sm.ib + 12);
            var lim = k3 === nG - 1 ? sm.it - 15 : frentesZ[k3 + 1][0] + 8;
            var hb = Math.min(fh - 40, lim - zBox);
            if (hb < 60) { aviso(rotulo + ': gaveta ' + (k3 + 1) + ' com caixa de só ' + fmtMm(hb) + ' de altura.', ref); hb = Math.max(hb, 40); }
            var nomeG = 'Gaveta ' + (i + 1) + '.' + (k3 + 1);
            var obsG = vm.cuba ? 'Recorte p/ sifão' : '';
            fab.chapa({ nome: 'Lateral de gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x',
              x: boxX0, y: yBox, z: zBox, dx: Tg, dy: lenC, dz: hb, veio: 'y', fitas: ['y'], vao: i, secao: j, obs: nomeG });
            fab.chapa({ nome: 'Lateral de gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x',
              x: boxX1 - Tg, y: yBox, z: zBox, dx: Tg, dy: lenC, dz: hb, veio: 'y', fitas: ['y'], vao: i, secao: j, obs: nomeG });
            fab.chapa({ nome: 'Frente interna de gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y',
              x: boxX0 + Tg, y: yBox, z: zBox, dx: boxW - 2 * Tg, dy: Tg, dz: hb, veio: 'x', fitas: ['x'], vao: i, secao: j, obs: nomeG + (obsG ? ' · ' + obsG : '') });
            fab.chapa({ nome: 'Traseira de gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y',
              x: boxX0 + Tg, y: yBox + lenC - Tg, z: zBox, dx: boxW - 2 * Tg, dy: Tg, dz: hb, veio: 'x', fitas: ['x'], vao: i, secao: j, obs: nomeG + (obsG ? ' · ' + obsG : '') });
            fab.chapa({ nome: 'Fundo de gaveta', grupo: 'gaveta', mat: 'fundoGaveta', eixoEsp: 'z',
              x: boxX0 + Tg - 8, y: yBox + Tg - 8, z: zBox + 10, dx: boxW - 2 * Tg + 16, dy: lenC - 2 * Tg + 16, dz: Fg,
              fitas: [], vao: i, secao: j, obs: nomeG + ' · encaixado em rasgo 8 mm' });
          }
        } else if (cfg.tipo === 'nicho') {
          cont.nichos++;
          if (cfg.interior === 'cabideiro') cabideiro();
          else prateleirasMoveis(cfg.prateleiras);
        } else if (cfg.tipo === 'forno') {
          cont.nichos++;
          if (vm.largInt < 560) aviso(rotulo + ': nicho de forno com ' + fmtCm(vm.largInt) + ' de largura interna — fornos de embutir pedem em geral 56–57 cm.', ref);
          if (sm.altInt < 585) aviso(rotulo + ': nicho de forno com ' + fmtCm(sm.altInt) + ' de altura interna — o padrão é ~59–60 cm.', ref);
          if (profUtil < 550) aviso(rotulo + ': profundidade útil de ' + fmtCm(profUtil) + ' pode ser insuficiente para forno (≥ 55 cm).', ref);
          info(rotulo + ': nicho de forno sem fundo atrás ou com recorte para ventilação; confira a medida no manual do fabricante.', ref);
        } else if (cfg.tipo === 'micro') {
          cont.nichos++;
          if (sm.altInt < 380) aviso(rotulo + ': nicho de micro-ondas com ' + fmtCm(sm.altInt) + ' de altura interna (comum 38–46 cm).', ref);
          if (vm.largInt < 500) aviso(rotulo + ': nicho de micro-ondas com ' + fmtCm(vm.largInt) + ' de largura interna (comum ≥ 50 cm).', ref);
          info(rotulo + ': deixe ~5 cm livres atrás/acima do micro-ondas para ventilação e a tomada acessível.', ref);
        }
      });
    });

    if (vaosLargosPrat.length) {
      var uniq = vaosLargosPrat.filter(function (v, k, a) { return a.indexOf(v) === k; });
      aviso('Prateleira com vão livre acima de 80 cm (vão ' + uniq.map(function (v) { return v + 1; }).join(', ') + '): MDF 18 mm tende a flexionar — adicione divisória ou use 25 mm.');
    }

    // ================================================================
    // RODAPÉ / PÉS
    // ================================================================
    var nPes = 0;
    if (temRodape) {
      var rec = spec.rodape.recuo;
      if (spec.rodape.tipo === 'rodape') {
        var rdDiv = dividirSobreApoios(0, L, divs, spec.emendaAuto ? usavelC : 1e9);
        rdDiv.pedacos.forEach(function (pc, k) {
          fab.chapa({ nome: rdDiv.pedacos.length > 1 ? 'Rodapé frontal ' + (k + 1) : 'Rodapé frontal', grupo: 'rodape', mat: 'caixa', eixoEsp: 'y',
            x: pc[0], y: rec, z: 0, dx: pc[1] - pc[0], dy: T, dz: z0, veio: 'x', fitas: ['x'] });
        });
        fab.chapa({ nome: 'Rodapé traseiro', grupo: 'rodape', mat: 'caixa', eixoEsp: 'y',
          x: 0, y: Dc - T - 20, z: 0, dx: Math.min(L, usavelC), dy: T, dz: z0, veio: 'x', fitas: [] });
        if (L > usavelC) fab.chapa({ nome: 'Rodapé traseiro (complemento)', grupo: 'rodape', mat: 'caixa', eixoEsp: 'y',
          x: usavelC, y: Dc - T - 20, z: 0, dx: L - usavelC, dy: T, dz: z0, veio: 'x', fitas: [] });
        var apoiosX = [0].concat(divs.map(function (d) { return d - T / 2; })).concat([L - T]);
        apoiosX.forEach(function (ax, k) {
          fab.chapa({ nome: 'Travessa de rodapé', grupo: 'rodape', mat: 'caixa', eixoEsp: 'x',
            x: ax, y: rec + T, z: 0, dx: T, dy: Dc - T - 20 - rec - T, dz: z0, veio: 'y', fitas: [] });
        });
        info('Rodapé em MDF recuado ' + fmtCm(rec) + ' com ' + apoiosX.length + ' travessas de apoio sob laterais/divisórias.');
      } else if (spec.rodape.tipo === 'pes') {
        nPes = 2 * (divs.length + 2);
        var pxs = [T / 2].concat(divs).concat([L - T / 2]);
        pxs.forEach(function (px) {
          [rec + 40, Dc - 60].forEach(function (py) {
            fab.objeto({ nome: 'Pé regulável', grupo: 'ferragem', mat: 'plastico', x: px - 20, y: py - 20, z: 0, dx: 40, dy: 40, dz: z0 });
          });
        });
        fab.chapa({ nome: 'Saia de rodapé', grupo: 'rodape', mat: 'caixa', eixoEsp: 'y',
          x: 0, y: rec, z: 0, dx: Math.min(L, usavelC), dy: T, dz: z0 - 5, veio: 'x', fitas: ['x'], obs: 'Fixada com clipes nos pés' });
        if (L > usavelC) fab.chapa({ nome: 'Saia de rodapé (complemento)', grupo: 'rodape', mat: 'caixa', eixoEsp: 'y',
          x: usavelC, y: rec, z: 0, dx: L - usavelC, dy: T, dz: z0 - 5, veio: 'x', fitas: ['x'] });
        info(nPes + ' pés reguláveis (um em cada canto de lateral/divisória) com saia de rodapé clipada.');
      }
    }

    // ================================================================
    // PEDRA
    // ================================================================
    if (spec.pedra.ativa && (tipo === 'inferior' || tipo === 'gabinete')) {
      var p = spec.pedra;
      var yp0 = (embutida ? 0 : -Tf) - p.avancoFrente;
      fab.objeto({ nome: 'Pedra / bancada', grupo: 'pedra', mat: 'pedra',
        x: -p.avancoLados, y: yp0, z: H, dx: L + 2 * p.avancoLados, dy: D - yp0, dz: p.espessura,
        obs: cubaAtiva ? 'Com recorte para cuba' : '' });
      var bancada = H + p.espessura + spec.elevacao;
      if (tipo === 'inferior' && (bancada < 850 || bancada > 950)) aviso('Altura final da bancada: ' + fmtCm(bancada) + ' (o confortável fica entre 85 e 95 cm).');
      if (tipo === 'gabinete' && (bancada < 780 || bancada > 950)) aviso('Altura final do tampo do banheiro: ' + fmtCm(bancada) + ' (usual 80–92 cm).');
    }

    // ================================================================
    // Ergonomia / profundidade
    // ================================================================
    if (tipo === 'inferior' && D < 500) aviso('Profundidade de ' + fmtCm(D) + ' é pouca para cooktop/cuba (o padrão é 55–60 cm).');
    if (tipo === 'aereo') {
      if (D > 400) aviso('Aéreo com ' + fmtCm(D) + ' de profundidade: acima de 40 cm atrapalha a cabeça na bancada.');
      if (spec.elevacao > 0 && spec.elevacao < 1400) aviso('Aéreo a ' + fmtCm(spec.elevacao) + ' do piso: fica a menos de 50 cm de uma bancada de 90 cm.');
      if (spec.elevacao + H > 2300) info('Topo do aéreo a ' + fmtCm(spec.elevacao + H) + ' do piso: confira o pé-direito/forro.');
    }
    if (tipo === 'roupeiro' && D < 550) aviso('Roupeiro com ' + fmtCm(D) + ' de profundidade: cabides pedem ≥ 55 cm (padrão 60 cm).');

    // Mensagens sobre frentes e ferragens
    if (cont.portas || cont.basculantes) {
      if (embutida) info('Portas embutidas (internas à caixaria): dobradiça super curva, folga de ' + fr.folgaEmbutida + ' mm em todo o contorno.');
      else {
        var partes = [];
        if (cont.dobradicas.reta) partes.push('reta onde a porta cobre a lateral externa');
        if (cont.dobradicas.curva) partes.push('curva onde divide a divisória/prateleira com outra frente');
        info('Portas sobrepostas: dobradiça ' + partes.join(' e ') + '.');
      }
    }
    if (cont.gavetas) {
      var lens = Object.keys(cont.corredicas).map(Number).sort(function (a, b) { return a - b; });
      info('Gavetas com corrediça ' + (spec.gavetas.corredica === 'oculta' ? 'oculta com amortecedor (5 mm de cada lado)' : 'telescópica (12,5 mm de cada lado)') +
        (lens.length ? ' de ' + lens.map(function (l) { return fmtCm(l); }).join(' / ') : '') + '.');
    }
    if (fr.puxador === 'gola') info('Puxador gola: preveja o perfil de alumínio e reduza a altura das frentes no rebaixo da gola.');
    if (fr.puxador === 'cava') info('Puxador cava: usinagem nas frentes (confira espessura mínima 18 mm).');
    if (fr.puxador === 'toque') info('Abertura por toque: inclua um fecho toque por porta/gaveta e use dobradiça sem amortecedor.');

    // peças longas/largas em geral
    fab.lista.forEach(function (pc) {
      if (!pc.cortavel) return;
      var c = pc.corte;
      var cabe = (c.c <= usavelC && c.l <= usavelL) || (!pc.veio && c.c <= usavelL && c.l <= usavelC);
      if (!cabe && pc.nome.indexOf('Base') !== 0) {
        aviso(pc.nome + ' (' + fmtCm(c.c) + ' × ' + fmtCm(c.l) + ') não cabe na chapa ' + fmtCm(spec.chapa.comprimento) + ' × ' + fmtCm(spec.chapa.largura) + ' — exigirá emenda.');
      }
    });

    // ================================================================
    // Ferragens
    // ================================================================
    var fer = [];
    var pr = spec.precos;
    if (cont.dobradicas.reta) fer.push({ item: 'Dobradiça 35 mm reta (com amortecedor)', qtd: cont.dobradicas.reta, un: 'un', preco: pr.dobradica });
    if (cont.dobradicas.curva) fer.push({ item: 'Dobradiça 35 mm curva (com amortecedor)', qtd: cont.dobradicas.curva, un: 'un', preco: pr.dobradica });
    if (cont.dobradicas.superCurva) fer.push({ item: 'Dobradiça 35 mm super curva (com amortecedor)', qtd: cont.dobradicas.superCurva, un: 'un', preco: pr.dobradica });
    Object.keys(cont.corredicas).map(Number).sort(function (a, b) { return a - b; }).forEach(function (len) {
      fer.push({ item: 'Corrediça ' + (spec.gavetas.corredica === 'oculta' ? 'oculta' : 'telescópica') + ' ' + len + ' mm (par)', qtd: cont.corredicas[len], un: 'par', preco: pr.corredicaPar });
    });
    if (cont.pistoes) fer.push({ item: 'Pistão a gás para basculante', qtd: cont.pistoes, un: 'un', preco: pr.pistao });
    if (cont.puxadores) {
      var nomePux = { externo: 'Puxador externo', perfil: 'Puxador perfil (alumínio)', cava: 'Usinagem cava (puxador)' }[fr.puxador] || 'Puxador';
      fer.push({ item: nomePux, qtd: cont.puxadores, un: 'un', preco: fr.puxador === 'cava' ? 0 : pr.puxador });
    }
    if (fr.puxador === 'toque') fer.push({ item: 'Fecho toque (push)', qtd: cont.portas + cont.gavetas + cont.basculantes, un: 'un', preco: pr.puxador * 0.6 });
    if (cont.prateleirasMoveis) fer.push({ item: 'Suporte de prateleira (pino)', qtd: cont.prateleirasMoveis * 4, un: 'un', preco: pr.suportePrateleira });
    if (cont.cabideiroMm) {
      fer.push({ item: 'Tubo cabideiro oblongo', qtd: r1(cont.cabideiroMm / 1000), un: 'm', preco: pr.cabideiroMetro });
      fer.push({ item: 'Suporte de tubo cabideiro', qtd: cont.suportesCabideiro, un: 'un', preco: 3 });
    }
    if (nPes) fer.push({ item: 'Pé regulável plástico + clipe de rodapé', qtd: nPes, un: 'un', preco: pr.pe });
    var nCaixaPecas = fab.lista.filter(function (p) { return p.grupo === 'caixa' || p.grupo === 'rodape'; }).length;
    fer.push({ item: 'Parafuso 4,0 × 40 mm (estimativa)', qtd: Math.ceil(nCaixaPecas * 6 / 10) * 10, un: 'un', preco: 0.12 });
    if (topoTravessas && spec.pedra.ativa) fer.push({ item: 'Cantoneira para fixação da pedra', qtd: Math.max(4, (divs.length + 2) * 2), un: 'un', preco: 1.5 });
    if (tipo === 'aereo' || tipo === 'gabinete') fer.push({ item: 'Suporte/cantoneira de fixação na parede', qtd: Math.max(2, (divs.length + 2)), un: 'un', preco: 6 });
    resultado.ferragens = fer;

    finalizar();
    return resultado;

    function finalizar() {
      var pecas = fab.lista;
      var frentesP = pecas.filter(function (p) { return p.grupo === 'frente'; });
      var nErros = avisos.filter(function (a) { return a.nivel === 'erro'; }).length;
      resultado.ok = nErros === 0;
      resultado.resumo = {
        vaos: spec.vaos.length,
        portas: frentesP.filter(function (p) { return p.meta && p.meta.tipo === 'porta'; }).length,
        basculantes: frentesP.filter(function (p) { return p.meta && p.meta.tipo === 'basculante'; }).length,
        gavetas: frentesP.filter(function (p) { return p.meta && p.meta.tipo === 'gaveta'; }).length,
        pecas: pecas.filter(function (p) { return p.cortavel; }).length,
        erros: nErros,
        avisos: avisos.filter(function (a) { return a.nivel === 'aviso'; }).length,
        infos: avisos.filter(function (a) { return a.nivel === 'info'; }).length,
        frenteMm: L
      };
      // ordena: erros, avisos, infos
      var ord = { erro: 0, aviso: 1, info: 2 };
      avisos.sort(function (a, b) { return ord[a.nivel] - ord[b.nivel]; });
    }
  }

  // ------------------------------------------------------------------
  // Lista de corte (agrupada)
  // ------------------------------------------------------------------
  function listaDeCorte(pecas, materiais) {
    var grupos = {};
    pecas.forEach(function (p) {
      if (!p.cortavel || !p.corte) return;
      var k = [p.mat, p.corte.e, p.corte.c, p.corte.l, p.fitaC, p.fitaL, p.nome].join('|');
      if (!grupos[k]) {
        grupos[k] = { nome: p.nome, mat: p.mat, material: (materiais[p.mat] || {}).nome || p.mat, qtd: 0,
          c: p.corte.c, l: p.corte.l, e: p.corte.e, fitaC: p.fitaC, fitaL: p.fitaL, veio: p.veio, obs: [] };
      }
      grupos[k].qtd++;
      if (p.obs && grupos[k].obs.indexOf(p.obs) < 0 && grupos[k].obs.length < 3 && !/^Gaveta \d|^Dobradiça/.test(p.obs)) grupos[k].obs.push(p.obs);
    });
    var linhas = Object.keys(grupos).map(function (k) { var g = grupos[k]; g.obs = g.obs.join('; '); return g; });
    var ordemMat = ['caixa', 'frente', 'gaveta', 'fundo', 'fundoGaveta'];
    linhas.sort(function (a, b) {
      var ma = ordemMat.indexOf(a.mat), mb = ordemMat.indexOf(b.mat);
      if (ma !== mb) return (ma < 0 ? 99 : ma) - (mb < 0 ? 99 : mb);
      if (a.material !== b.material) return a.material < b.material ? -1 : 1;
      if (b.c !== a.c) return b.c - a.c;
      return b.l - a.l;
    });
    return linhas;
  }

  // Totais por material: área, fita
  function totaisMateriais(pecas, materiais) {
    var t = {};
    pecas.forEach(function (p) {
      if (!p.cortavel || !p.corte) return;
      var key = ((materiais[p.mat] || {}).nome || p.mat) + '|' + p.corte.e;
      if (!t[key]) t[key] = { mat: p.mat, material: (materiais[p.mat] || {}).nome || p.mat, esp: p.corte.e, area: 0, fitaMm: 0, pecas: 0 };
      t[key].area += p.corte.c * p.corte.l / 1e6;
      t[key].fitaMm += p.fitaC * p.corte.c + p.fitaL * p.corte.l;
      t[key].pecas++;
    });
    return Object.keys(t).map(function (k) { return t[k]; });
  }

  function csvLista(linhas, sep) {
    sep = sep || ';';
    var cab = ['Peça', 'Qtd', 'Comprimento (mm)', 'Largura (mm)', 'Espessura (mm)', 'Material', 'Veio', 'Fita comp. (lados)', 'Fita larg. (lados)', 'Observações'];
    function esc(v) {
      var s = String(v === null || v === undefined ? '' : v);
      if (typeof v === 'number') s = s.replace('.', ',');
      if (s.indexOf(sep) >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var out = [cab.join(sep)];
    linhas.forEach(function (l) {
      out.push([l.nome, l.qtd, l.c, l.l, l.e, l.material, l.veio ? 'Sim' : 'Não', l.fitaC, l.fitaL, l.obs].map(esc).join(sep));
    });
    return out.join('\r\n');
  }

  return {
    TIPOS: TIPOS,
    TIPOS_SECAO: TIPOS_SECAO,
    CORREDICAS: CORREDICAS,
    MATERIAIS_PADRAO: MATERIAIS_PADRAO,
    specPadrao: specPadrao,
    aplicarTipo: aplicarTipo,
    normalizar: normalizar,
    autoVaos: autoVaos,
    novoVao: novoVao,
    novaSecao: novaSecao,
    calcular: calcular,
    listaDeCorte: listaDeCorte,
    totaisMateriais: totaisMateriais,
    csvLista: csvLista,
    nDobradicas: nDobradicas,
    fmt: { num: fmtNum, m: fmtM, cm: fmtCm, mm: fmtMm },
    util: { clone: clone, deepMerge: deepMerge }
  };
});
