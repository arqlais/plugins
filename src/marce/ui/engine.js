/*
 * planê.mob — motor de marcenaria paramétrica
 * ------------------------------------------------------------------
 * JavaScript puro (sem DOM, sem SketchUp). Recebe a especificação do
 * móvel (spec) e devolve o modelo completo: vãos, peças 3D, conjuntos
 * móveis (portas/gavetas que abrem), conferência técnica, ferragens,
 * detalhamento de elementos e resumo.
 *
 * Unidades: milímetros. Coordenadas do móvel, visto de frente:
 *   x -> direita  (0 = face externa da lateral esquerda)
 *   y -> fundo    (0 = face frontal da caixaria; frentes sobrepostas em y<0)
 *   z -> cima     (0 = base do volume / piso)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarceEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function deepMerge(base, over) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base) || Array.isArray(over) || typeof base !== 'object' || typeof over !== 'object' || base === null) return over;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) { out[k] = (k in base) ? deepMerge(base[k], over[k]) : over[k]; });
    return out;
  }
  function fmtNum(v, dec) { return Number(v).toFixed(dec).replace('.', ','); }
  function fmtM(mm) { return fmtNum(mm / 1000, 3) + ' m'; }
  function fmtCm(mm) {
    var cm = mm / 10;
    return (Math.abs(cm - Math.round(cm)) < 0.05 ? String(Math.round(cm)) : fmtNum(cm, 1)) + ' cm';
  }
  function fmtMm(mm) { return (Math.abs(mm - Math.round(mm)) < 0.05 ? String(Math.round(mm)) : fmtNum(mm, 1)) + ' mm'; }

  var CORREDICAS = [250, 300, 350, 400, 450, 500, 550, 600];

  // ------------------------------------------------------------------
  // Catálogos de opções
  // ------------------------------------------------------------------
  var TIPOS = {
    balcao: { label: 'Balcão', nome: 'Armário balcão', L: 2400, D: 580, H: 880, base: 'rodape', baseAltura: 100, topo: 'travessas', folgaTopo: 3, prateleiras: 1, larguraMax: 600 },
    aereo: { label: 'Aéreo', nome: 'Armário aéreo', L: 2400, D: 350, H: 700, base: 'suspenso', baseAltura: 0, topo: 'chapa', folgaTopo: 0, prateleiras: 1, larguraMax: 600, elevacao: 1500 },
    torre: { label: 'Torre', nome: 'Torre quente', L: 640, D: 580, H: 2200, base: 'rodape', baseAltura: 100, topo: 'chapa', folgaTopo: 0, prateleiras: 1, larguraMax: 640 },
    gaveteiro: { label: 'Gaveteiro', nome: 'Gaveteiro', L: 900, D: 500, H: 800, base: 'rodape', baseAltura: 100, topo: 'chapa', folgaTopo: 0, prateleiras: 0, larguraMax: 600 },
    roupeiro: { label: 'Guarda-roupa', nome: 'Guarda-roupa', L: 2700, D: 600, H: 2500, base: 'rodape', baseAltura: 100, topo: 'chapa', folgaTopo: 0, prateleiras: 2, larguraMax: 500 },
    estante: { label: 'Estante', nome: 'Estante', L: 1800, D: 350, H: 2000, base: 'rodape', baseAltura: 80, topo: 'chapa', folgaTopo: 0, prateleiras: 3, larguraMax: 600 },
    gabinete: { label: 'Gabinete banheiro', nome: 'Gabinete', L: 800, D: 480, H: 550, base: 'suspenso', baseAltura: 0, topo: 'travessas', folgaTopo: 3, prateleiras: 0, larguraMax: 600, elevacao: 300 },
    rack: { label: 'Rack', nome: 'Rack', L: 1800, D: 450, H: 550, base: 'suspenso', baseAltura: 0, topo: 'chapa', folgaTopo: 0, prateleiras: 0, larguraMax: 600, elevacao: 250 },
    escrivaninha: { label: 'Escrivaninha', nome: 'Escrivaninha', L: 1400, D: 600, H: 750, base: 'nenhum', baseAltura: 0, topo: 'chapa', folgaTopo: 0, prateleiras: 0, larguraMax: 900 },
    criado: { label: 'Criado-mudo', nome: 'Criado-mudo', L: 500, D: 400, H: 450, base: 'suspenso', baseAltura: 0, topo: 'chapa', folgaTopo: 0, prateleiras: 0, larguraMax: 600, elevacao: 200 },
    geladeira: { label: 'Torre de geladeira', nome: 'Torre de geladeira', L: 800, D: 600, H: 2300, base: 'rodape', baseAltura: 100, topo: 'chapa', folgaTopo: 0, prateleiras: 0, larguraMax: 900 },
    personalizado: { label: 'Personalizado', nome: 'Móvel personalizado', L: 3000, D: 500, H: 2500, base: 'rodape', baseAltura: 100, topo: 'chapa', folgaTopo: 0, prateleiras: 2, larguraMax: 900 }
  };

  // Cômodo: decide quais móveis aparecem primeiro e a umidade (materiais) do ambiente
  var COMODOS = {
    cozinha: { label: 'Cozinha', ambiente: 'cozinha', tipos: ['balcao', 'aereo', 'torre', 'geladeira', 'gaveteiro', 'personalizado'] },
    sala: { label: 'Sala', ambiente: 'seco', tipos: ['rack', 'estante', 'aereo', 'personalizado'] },
    quarto: { label: 'Quarto', ambiente: 'seco', tipos: ['roupeiro', 'criado', 'gaveteiro', 'escrivaninha', 'estante', 'personalizado'] },
    escritorio: { label: 'Escritório', ambiente: 'seco', tipos: ['escrivaninha', 'estante', 'aereo', 'gaveteiro', 'personalizado'] },
    banheiro: { label: 'Banheiro', ambiente: 'banheiro', tipos: ['gabinete', 'aereo', 'torre', 'personalizado'] },
    lavanderia: { label: 'Lavanderia', ambiente: 'lavanderia', tipos: ['balcao', 'aereo', 'torre', 'personalizado'] },
    closet: { label: 'Closet', ambiente: 'seco', tipos: ['roupeiro', 'gaveteiro', 'estante', 'personalizado'] }
  };
  function comodoDoTipo(tipo, ambiente) {
    if (ambiente === 'banheiro') return 'banheiro';
    if (ambiente === 'lavanderia') return 'lavanderia';
    if (ambiente === 'cozinha' || ['balcao', 'torre', 'geladeira'].indexOf(tipo) >= 0) return 'cozinha';
    return { rack: 'sala', estante: 'sala', escrivaninha: 'escritorio', criado: 'quarto', roupeiro: 'quarto', gabinete: 'banheiro', gaveteiro: 'quarto' }[tipo] || 'sala';
  }

  var AMBIENTES = {
    seco: { label: 'Seco', texto: 'Caixaria em MDP/MDF BP; portas em MDF (aceita laca e lâmina natural).',
      caixa: 'MDP ou MDF BP 18 mm', frentes: 'MDF BP 18 mm (aceita laca e lâmina natural)', fundo: 'HDF 6 mm', larguraMax: 600 },
    cozinha: { label: 'Cozinha', texto: 'MDP BP ou MDF RU com laminado nas frentes; sóculo 10 × 10 cm; bancada final 85–95 cm; portas até 60 cm.',
      caixa: 'MDP BP ou MDF RU (resistente à umidade) 18 mm', frentes: 'MDF BP ou MDF com laminado de alta pressão nas áreas de água e cocção', fundo: 'HDF 6 mm (módulo da pia sem fundo ou com fundo removível)', larguraMax: 600 },
    banheiro: { label: 'Banheiro', texto: 'MDF RU obrigatório, fitas seladas; gabinete suspenso ou com rodapé em pedra; portas até 50 cm.',
      caixa: 'MDF RU (resistente à umidade) 18 mm', frentes: 'MDF RU 18 mm com fita de borda selada (PVC/ABS)', fundo: 'MDF RU 6 mm ou sem fundo no módulo da cuba', larguraMax: 500 },
    lavanderia: { label: 'Lavanderia', texto: 'MDF RU na caixaria e frentes; nicho de máquina com folga ≥ 2 cm; ventilação para secadora.',
      caixa: 'MDF RU 18 mm', frentes: 'MDF RU 18 mm', fundo: 'HDF 6 mm', larguraMax: 600 }
  };

  var TIPOS_SECAO = {
    portas: 'Porta',
    gavetas: 'Gavetas',
    basculante: 'Basculante',
    temperos: 'Porta-temperos',
    lixeira: 'Lixeira',
    fruteira: 'Fruteira',
    nicho: 'Nicho',
    arco: 'Nicho em arco',
    espelho: 'Espelho em arco',
    painel: 'Painel',
    forno: 'Forno',
    micro: 'Micro-ondas',
    geladeira: 'Nicho geladeira',
    livre: 'Vão livre (até o piso)'
  };
  var TIPOS_ITEM_GAVETA = { gaveta: 'Gaveta', gavetao: 'Gavetão', interna: 'Gavetão c/ interna' };

  var PUXADORES = {
    cava: 'Cava 45° usinada',
    perfil: 'Perfil de alumínio',
    passante: 'Porta passante',
    alca: 'Alça',
    barra: 'Barra longa',
    botao: 'Botão',
    testeira: 'Perfil 45° (testeira)',
    toque: 'Toque (push)',
    nenhum: 'Sem puxador'
  };

  var COMPOSICOES = {
    estante_balcao: 'Estante + balcão',
    portas_nichos: 'Portas + nichos',
    rack_painel: 'Rack + painel',
    balcao_aereo: 'Balcão + aéreo',
    estante_molduras: 'Estante com molduras',
    nichos_arco: 'Nichos em arco',
    espelho_arco: 'Espelho em arco + nichos',
    torre_geladeira: 'Torre de geladeira + torre quente'
  };

  var MATERIAIS_PADRAO = {
    frente: { id: 'arauco-carvalho', nome: 'Carvalho', marca: 'Arauco', cor: '#b8946a', veio: true, texturaLargura: 1200 },
    caixa: { id: 'arauco-carvalho', nome: 'Carvalho', marca: 'Arauco', cor: '#b8946a', veio: true, texturaLargura: 1200 },
    caixaInterna: { id: 'gen-branco', nome: 'Branco TX', marca: 'Genérico', cor: '#f2f1ec', veio: false, texturaLargura: 1200 },
    fundo: { id: 'gen-hdf-branco', nome: 'HDF Branco', marca: 'Genérico', cor: '#ecebe6', veio: false, texturaLargura: 1200 },
    gaveta: { id: 'gen-branco', nome: 'Branco TX', marca: 'Genérico', cor: '#f2f1ec', veio: false, texturaLargura: 1200 },
    fundoGaveta: { id: 'gen-hdf-branco', nome: 'HDF Branco', marca: 'Genérico', cor: '#ecebe6', veio: false, texturaLargura: 1200 }
  };
  var ESTILOS_FRENTE = { lisa: 'Lisa', ripada: 'Ripada', moldura: 'Moldura', vidro: 'Vidro canelado' };
  var TEMP_LED = { 2700: '#ffcf8a', 3000: '#ffd9a0', 4000: '#fff1d6', 6000: '#eef4ff' };
  var MATERIAIS_FIXOS = {
    metal: { nome: 'Metal', cor: '#9a9ea3' },
    vidro: { nome: 'Vidro canelado', cor: '#cfdde2' },
    led: { nome: 'LED', cor: '#fff1d6' },
    aramado: { nome: 'Aramado cromado', cor: '#c3c7cc' },
    espelho: { nome: 'Espelho', cor: '#bcd3dc' },
    pedra: { nome: 'Pedra', cor: '#d9d6cf' },
    plastico: { nome: 'Plástico', cor: '#5b5b5b' }
  };

  // ------------------------------------------------------------------
  // Fábricas de seções / colunas / spec
  // ------------------------------------------------------------------
  function itensGaveta(n) {
    var it = [];
    for (var i = 0; i < n; i++) it.push({ tipo: 'gaveta', altura: null });
    return it;
  }

  function novaSecao(tipo, extra) {
    var s = {
      tipo: tipo || 'portas',
      altura: null,           // altura de frente da faixa (mm) ou null = automática
      portas: 0,              // 0 = auto (1 por coluna; 2 se passar da largura máx.)
      dobradica: 'auto',      // auto | esq | dir
      itens: itensGaveta(3),  // gavetas (de baixo para cima)
      prateleiras: 1,
      interior: 'prateleiras', // prateleiras | cabideiro | vazio
      cestos: 3,              // temperos/fruteira
      baldes: 1,              // lixeira
      moldura: false,         // nicho com moldura frontal
      eletro: { largura: 700, altura: 1800, profundidade: 700 } // geladeira: medidas do aparelho (mm)
    };
    if (tipo === 'gavetas') s.prateleiras = 0;
    var r = extra ? deepMerge(s, extra) : s;
    if (extra && typeof extra.gavetas === 'number' && !extra.itens) r.itens = itensGaveta(extra.gavetas);
    return r;
  }

  function novaColuna(largura, secoes) {
    return { largura: isNum(largura) && largura > 0 ? largura : null, secoes: secoes || [novaSecao('portas')] };
  }

  function specPadrao(tipo, ambiente) {
    tipo = TIPOS[tipo] ? tipo : 'balcao';
    var t = TIPOS[tipo];
    ambiente = AMBIENTES[ambiente] ? ambiente : (tipo === 'balcao' || tipo === 'aereo' || tipo === 'torre' || tipo === 'geladeira' ? 'cozinha' : (tipo === 'gabinete' ? 'banheiro' : 'seco'));
    var spec = {
      versao: 2,
      nome: t.nome,
      tipo: tipo,
      composicao: tipo === 'personalizado' ? 'estante_balcao' : null,
      ambiente: ambiente,
      comodo: comodoDoTipo(tipo, ambiente),
      L: t.L, D: t.D, H: t.H,
      elevacao: t.elevacao || 0,
      origemVolume: false,
      base: { tipo: t.base, altura: t.baseAltura || 100, recuo: 50 },
      rodaTeto: { ativo: false, altura: 50, recuo: 0 },
      topo: t.topo,
      travessaLargura: 100,
      esp: { caixa: 18, frente: 18, fundo: 6, gaveta: 15, fundoGaveta: 6 },
      fundo: { tipo: 'sobreposto', recuoEncaixe: 10, rasgo: 8 },
      frentes: { montagem: 'sobreposta', folga: 3, folgaTopo: t.folgaTopo, folgaEmbutida: 2, veio: 'vertical', estilo: 'lisa', ripa: { largura: 20, espaco: 10, espessura: 9 } },
      puxador: { tipo: 'cava', tamanho: 25, comprimento: 160, posicao: 'auto', passa: 25 },
      led: { ativo: false, local: 'base', posicao: 'fundo', tipo: 'embutido', temperatura: 4000 },
      larguraMax: Math.min(t.larguraMax, AMBIENTES[ambiente].larguraMax === 500 ? 500 : t.larguraMax),
      divisorias: 'cada',     // cada | par | nenhuma
      gavetas: { corredica: 'telescopica' },
      prateleiras: { recuo: 20, folga: 1 },
      pedra: { ativa: false, espessura: 20, avancoFrente: 20, avancoLados: 0 },
      cuba: { ativa: false, centro: Math.round(t.L / 2), largura: 500, profundidade: 400, origem: 'manual' },
      chapa: { comprimento: 2750, largura: 1850, refilo: 10, serra: 4 },
      emendaAuto: false,
      caixaInternaBranca: false,
      codigo: 'M01',
      prancha: { folha: 'A4', visual: 'marce', unidade: 'cm', corCota: '#c0392b', corNumero: '#c0392b' },
      materiais: clone(MATERIAIS_PADRAO),
      colunas: []
    };
    spec.colunas = autoColunas(spec);
    return spec;
  }

  function aplicarTipo(spec, tipo) {
    var novo = specPadrao(tipo, spec.ambiente);
    ['materiais', 'chapa', 'esp', 'puxador', 'caixaInternaBranca', 'prancha', 'codigo'].forEach(function (k) { if (spec[k] !== undefined) novo[k] = clone(spec[k]); });
    novo.frentes.montagem = spec.frentes ? spec.frentes.montagem : novo.frentes.montagem;
    novo.frentes.veio = spec.frentes ? spec.frentes.veio : novo.frentes.veio;
    if (spec.origemVolume) {
      novo.L = spec.L; novo.D = spec.D; novo.H = spec.H; novo.elevacao = spec.elevacao; novo.origemVolume = true;
      if (novo.base.tipo === 'suspenso') novo.elevacao = spec.elevacao;
    }
    novo.cuba = clone(spec.cuba || novo.cuba);
    if (tipo !== 'balcao' && tipo !== 'gabinete') novo.cuba.ativa = false;
    novo.colunas = autoColunas(novo);
    return novo;
  }

  function normalizar(spec) {
    var tipo = spec && TIPOS[spec.tipo] ? spec.tipo : 'balcao';
    var base = specPadrao(tipo, spec && spec.ambiente);
    var s = deepMerge(base, spec || {});
    if (!Array.isArray(s.colunas) || !s.colunas.length) s.colunas = autoColunas(s);
    s.colunas = s.colunas.map(function (c) {
      var cc = deepMerge(novaColuna(null), c || {});
      if (!Array.isArray(cc.secoes) || !cc.secoes.length) cc.secoes = [novaSecao('portas')];
      cc.secoes = cc.secoes.map(function (sec) {
        var ns = novaSecao(sec && sec.tipo, sec);
        if (!Array.isArray(ns.itens) || !ns.itens.length) ns.itens = itensGaveta(3);
        ns.itens = ns.itens.map(function (it) { return { tipo: TIPOS_ITEM_GAVETA[it && it.tipo] ? it.tipo : 'gaveta', altura: it && isNum(it.altura) && it.altura > 0 ? it.altura : null }; });
        return ns;
      });
      return cc;
    });
    ['L', 'D', 'H', 'elevacao', 'travessaLargura', 'larguraMax'].forEach(function (k) { s[k] = num(s[k], base[k]); });
    return s;
  }

  // ------------------------------------------------------------------
  // Distribuição automática de colunas
  // ------------------------------------------------------------------
  function nColunas(L, max) { return Math.max(1, Math.ceil((L - 0.5) / Math.max(150, max))); }

  function autoColunas(spec) {
    var t = TIPOS[spec.tipo] || TIPOS.balcao;
    var L = spec.L, H = spec.H;
    var n = nColunas(L, spec.larguraMax || t.larguraMax);
    var cols = [];
    var i;
    var P = t.prateleiras;
    function add(secoes) { cols.push(novaColuna(null, secoes)); }

    switch (spec.tipo) {
      case 'torre':
        for (i = 0; i < n; i++) add([
          novaSecao('gavetas', { altura: 520, gavetas: 2 }),
          novaSecao('forno', { altura: 620 }),
          novaSecao('micro', { altura: 450 }),
          novaSecao('portas', { prateleiras: 1 })
        ]);
        return cols;
      case 'gaveteiro':
        for (i = 0; i < n; i++) add([novaSecao('gavetas', { gavetas: 4 })]);
        return cols;
      case 'roupeiro':
        for (i = 0; i < n; i++) {
          var maleiro = novaSecao('portas', { altura: 450, prateleiras: 0, interior: 'vazio' });
          if (n >= 3 && i === n - 1) add([novaSecao('gavetas', { altura: 600, gavetas: 3 }), novaSecao('portas', { prateleiras: 3 }), maleiro]);
          else add([novaSecao('portas', { prateleiras: 0, interior: 'cabideiro' }), maleiro]);
        }
        return cols;
      case 'estante':
        for (i = 0; i < n; i++) add([novaSecao('nicho', { prateleiras: P })]);
        return cols;
      case 'rack':
        // porta de um lado, gavetas do outro e o meio aberto para os aparelhos
        if (n <= 2) { for (i = 0; i < n; i++) add([i === 0 ? novaSecao('portas', { prateleiras: 1 }) : novaSecao('gavetas', { itens: itensGaveta(2) })]); return cols; }
        for (i = 0; i < n; i++) add([i === Math.floor(n / 2) ? novaSecao('nicho', { prateleiras: 0 }) : (i < n / 2 ? novaSecao('portas', { prateleiras: 1 }) : novaSecao('gavetas', { itens: itensGaveta(2) }))]);
        return cols;
      case 'escrivaninha':
        // gaveteiro de um lado e vão livre para as pernas (mínimo 60 cm)
        add([novaSecao('gavetas', { itens: itensGaveta(3) })], Math.min(450, Math.max(350, Math.round(L * 0.32))));
        add([novaSecao('livre')]);
        return cols;
      case 'criado':
        add([novaSecao('gavetas', { itens: itensGaveta(H >= 520 ? 3 : 2) })]);
        return cols;
      case 'geladeira':
        add([novaSecao('geladeira', { altura: Math.max(1500, Math.min(H - 350, 1900)) }), novaSecao('basculante', { prateleiras: 0, interior: 'vazio' })]);
        return cols;
      case 'personalizado':
        return composicao(spec, spec.composicao || 'estante_balcao');
    }

    // balcão / aéreo / gabinete
    var cuba = spec.cuba && spec.cuba.ativa && (spec.tipo === 'balcao' || spec.tipo === 'gabinete');
    var largura = L / n;
    for (i = 0; i < n; i++) {
      var x0 = i * largura, x1 = (i + 1) * largura;
      var sobCuba = cuba && x1 > spec.cuba.centro - spec.cuba.largura / 2 && x0 < spec.cuba.centro + spec.cuba.largura / 2;
      add([novaSecao('portas', { prateleiras: sobCuba ? 0 : P, interior: sobCuba ? 'vazio' : 'prateleiras' })]);
    }
    if (spec.tipo === 'balcao' && n >= 4) {
      // um gaveteiro fora da área da cuba, à direita do centro
      var alvo = -1;
      for (i = Math.floor(n / 2); i < n; i++) {
        var c0 = i * largura, c1 = (i + 1) * largura;
        if (!(cuba && c1 > spec.cuba.centro - spec.cuba.largura / 2 - 50 && c0 < spec.cuba.centro + spec.cuba.largura / 2 + 50)) { alvo = i; break; }
      }
      if (alvo >= 0) cols[alvo].secoes = [novaSecao('gavetas', { itens: itensGaveta(H - (spec.base && spec.base.tipo !== 'suspenso' ? spec.base.altura : 0) > 820 ? 4 : 3) })];
    }
    return cols;
  }

  function composicao(spec, chave) {
    var L = spec.L, H = spec.H;
    var n = nColunas(L, spec.larguraMax || 900);
    var hBalcao = H > 1600 ? 750 : Math.round(H * 0.4);
    var cols = [], i;
    function add(s, w) { cols.push(novaColuna(w || null, s)); }
    switch (chave) {
      case 'portas_nichos':
        for (i = 0; i < n; i++) add(i % 2 === 0 ? [novaSecao('portas', { prateleiras: 3 })] : [novaSecao('nicho', { prateleiras: 4 })]);
        break;
      case 'rack_painel':
        for (i = 0; i < n; i++) add([novaSecao(i % 2 ? 'gavetas' : 'basculante', { altura: Math.min(550, Math.round(H * 0.3)), gavetas: 2, prateleiras: 0, interior: 'vazio' }), novaSecao('painel')]);
        break;
      case 'balcao_aereo':
        for (i = 0; i < n; i++) add([novaSecao('portas', { altura: 880, prateleiras: 1 }), novaSecao('painel', { altura: Math.max(300, H - 880 - 700) }), novaSecao('portas', { prateleiras: 1 })]);
        break;
      case 'estante_molduras':
        for (i = 0; i < n; i++) add([novaSecao('portas', { altura: hBalcao, prateleiras: 1 }), novaSecao('nicho', { prateleiras: 3, moldura: true })]);
        break;
      case 'nichos_arco':
        for (i = 0; i < n; i++) add([novaSecao('portas', { altura: hBalcao, prateleiras: 1 }), novaSecao('arco', { prateleiras: 3 })]);
        break;
      case 'espelho_arco':
        var wEsp = Math.min(900, Math.round(L / (n + 1)));
        add([novaSecao('espelho', { prateleiras: 0 })], wEsp);
        var n2 = Math.max(1, nColunas(L - wEsp, spec.larguraMax || 900));
        for (i = 0; i < n2; i++) add([novaSecao('portas', { altura: hBalcao, prateleiras: 1 }), novaSecao('arco', { prateleiras: 3 })]);
        break;
      case 'torre_geladeira':
        add([novaSecao('geladeira', { altura: Math.max(1500, Math.min(H - 350, 1900)) }), novaSecao('basculante', { prateleiras: 0, interior: 'vazio' })], 800);
        var n3 = Math.max(1, nColunas(L - 800, spec.larguraMax || 900));
        for (i = 0; i < n3; i++) add([novaSecao('gavetas', { altura: 520, gavetas: 2 }), novaSecao('forno', { altura: 620 }), novaSecao('micro', { altura: 450 }), novaSecao('portas', { prateleiras: 1 })]);
        break;
      default: // estante_balcao
        for (i = 0; i < n; i++) add([novaSecao('portas', { altura: hBalcao, prateleiras: 1 }), novaSecao('nicho', { prateleiras: 3 })]);
    }
    return cols;
  }

  // ------------------------------------------------------------------
  // Resolução de medidas
  // ------------------------------------------------------------------
  function resolverMedidas(itens, total, chave, minimo) {
    var fixo = 0, nAuto = 0;
    itens.forEach(function (it) { var v = it[chave]; if (isNum(v) && v > 0) fixo += v; else nAuto++; });
    var resto = total - fixo;
    var autoV = nAuto ? resto / nAuto : 0;
    var res = { medidas: [], erro: null };
    if (nAuto === 0 && Math.abs(resto) > 0.5) res.erro = 'soma';
    if (nAuto > 0 && autoV < minimo) res.erro = 'pouco';
    itens.forEach(function (it) { var v = it[chave]; res.medidas.push(isNum(v) && v > 0 ? v : autoV); });
    if (nAuto === 0 && res.medidas.length) res.medidas[res.medidas.length - 1] += resto;
    return res;
  }

  function dividirSobreApoios(a, b, apoios, maxLen) {
    var pedacos = [], ini = a, semApoio = false, guard = 0;
    while (b - ini > maxLen + 0.01 && guard++ < 50) {
      var cand = apoios.filter(function (s) { return s > ini + 50 && s - ini <= maxLen; });
      if (!cand.length) { semApoio = true; break; }
      var s = cand[cand.length - 1];
      pedacos.push([ini, s]); ini = s;
    }
    pedacos.push([ini, b]);
    return { pedacos: pedacos, semApoio: semApoio };
  }

  // Agrupa colunas em vãos conforme a regra de divisórias
  function agruparVaos(spec, xs, cubaCols) {
    var cols = spec.colunas;
    var grupos = [];
    function mesclavel(c) {
      return c.secoes.length === 1 && c.secoes[0].tipo === 'portas';
    }
    function mesmaConfig(a, b) {
      var sa = a.secoes[0], sb = b.secoes[0];
      return sa.interior === sb.interior && sa.prateleiras === sb.prateleiras;
    }
    var i = 0;
    while (i < cols.length) {
      var g = [i];
      if (spec.divisorias !== 'cada' && mesclavel(cols[i])) {
        var lim = spec.divisorias === 'par' ? 2 : 99;
        while (g.length < lim && i + g.length < cols.length) {
          var j = i + g.length;
          if (mesclavel(cols[j]) && mesmaConfig(cols[i], cols[j]) && cubaCols[j] === cubaCols[i]) g.push(j); else break;
        }
      }
      grupos.push(g);
      i += g.length;
    }
    return grupos;
  }

  // ------------------------------------------------------------------
  // Fábrica de peças e conjuntos
  // ------------------------------------------------------------------
  function criarFabrica(spec) {
    var lista = [], conjuntos = [], seq = 0, seqC = 0;
    function matInfo(k) { return spec.materiais[k] || MATERIAIS_FIXOS[k] || { veio: false }; }
    function chapa(o) {
      if (!(o.dx > 0.05 && o.dy > 0.05 && o.dz > 0.05)) return null;
      var tam = { x: o.dx, y: o.dy, z: o.dz };
      var eixos = ['x', 'y', 'z'].filter(function (a) { return a !== o.eixoEsp; });
      var mat = matInfo(o.mat);
      var eixoC = (mat.veio && o.veio && o.veio !== o.eixoEsp) ? o.veio : (tam[eixos[0]] >= tam[eixos[1]] ? eixos[0] : eixos[1]);
      var eixoL = eixos[0] === eixoC ? eixos[1] : eixos[0];
      var fitaC = 0, fitaL = 0;
      (o.fitas || []).forEach(function (a) { if (a === eixoC) fitaC++; else if (a === eixoL) fitaL++; });
      var p = {
        id: 'P' + (++seq), nome: o.nome, grupo: o.grupo, mat: o.mat, cortavel: true,
        x: r1(o.x), y: r1(o.y), z: r1(o.z), dx: r1(o.dx), dy: r1(o.dy), dz: r1(o.dz),
        corte: { c: r1(tam[eixoC]), l: r1(tam[eixoL]), e: r1(tam[o.eixoEsp]) },
        eixoEsp: o.eixoEsp, eixoVeio: eixoC,
        veio: !!mat.veio, fitaC: Math.min(2, fitaC), fitaL: Math.min(2, fitaL),
        vao: isNum(o.vao) ? o.vao : null, col: isNum(o.col) ? o.col : null, secao: isNum(o.secao) ? o.secao : null,
        conj: o.conj || null, forma: o.forma || null, obs: o.obs || '', meta: o.meta || null
      };
      lista.push(p);
      return p;
    }
    function objeto(o) {
      if (!(o.dx > 0.05 && o.dy > 0.05 && o.dz > 0.05)) return null;
      var p = {
        id: 'P' + (++seq), nome: o.nome, grupo: o.grupo || 'ferragem', mat: o.mat, cortavel: false,
        x: r1(o.x), y: r1(o.y), z: r1(o.z), dx: r1(o.dx), dy: r1(o.dy), dz: r1(o.dz),
        corte: null, veio: false, fitaC: 0, fitaL: 0,
        vao: isNum(o.vao) ? o.vao : null, col: isNum(o.col) ? o.col : null, secao: isNum(o.secao) ? o.secao : null,
        conj: o.conj || null, forma: o.forma || null, obs: o.obs || '', meta: o.meta || null
      };
      lista.push(p);
      return p;
    }
    function conjunto(o) {
      var c = { id: 'C' + (++seqC), nome: o.nome, tipo: o.tipo, pivot: o.pivot || null, eixo: o.eixo || null,
        angulo: o.angulo || 0, curso: o.curso || 0, pai: o.pai || null, requer: o.requer || null, segue: !!o.segue, vao: o.vao, col: o.col, secao: o.secao };
      conjuntos.push(c);
      return c.id;
    }
    return { chapa: chapa, objeto: objeto, conjunto: conjunto, lista: lista, conjuntos: conjuntos };
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
    function dica(msg, ref) { avisos.push({ nivel: 'dica', msg: msg, ref: ref || null }); }

    var L = spec.L, D = spec.D, H = spec.H;
    var T = spec.esp.caixa, Tf = spec.esp.frente, F = spec.esp.fundo;
    var Tg = spec.esp.gaveta, Fg = spec.esp.fundoGaveta;
    var fr = spec.frentes, g = fr.folga;
    var pux = deepMerge({ tipo: 'cava', tamanho: 25, comprimento: 160, posicao: 'auto', passa: 25 }, spec.puxador || {});
    var estilo = ESTILOS_FRENTE[fr.estilo] ? fr.estilo : 'lisa';
    var ripa = deepMerge({ largura: 20, espaco: 10, espessura: 9 }, fr.ripa || {});
    var led = deepMerge({ ativo: false, local: 'base', posicao: 'fundo', tipo: 'embutido', temperatura: 4000 }, spec.led || {});
    if (estilo === 'ripada' && pux.tipo === 'cava') {
      pux = deepMerge(pux, { tipo: 'toque' });
      info('Frente ripada: cava usinada não se aplica nas ripas — as frentes ficam com abertura por toque (ou escolha perfil, barra ou botão).');
    }
    var yApar = estilo === 'ripada' ? ripa.espessura : (estilo === 'moldura' ? 6 : 0); // espessura aplicada à frente
    var embutida = fr.montagem === 'embutida';
    var usavelC = spec.chapa.comprimento - 2 * spec.chapa.refilo;
    var usavelL = spec.chapa.largura - 2 * spec.chapa.refilo;
    var fab = criarFabrica(spec);
    var tipo = spec.tipo;
    var amb = AMBIENTES[spec.ambiente] || AMBIENTES.seco;
    var matExt = 'caixa';
    var matInt = spec.caixaInternaBranca ? 'caixaInterna' : 'caixa';
    var aereoLike = tipo === 'aereo';

    var R = {
      spec: spec, pecas: fab.lista, conjuntos: fab.conjuntos, avisos: avisos, vaos: [], colunas: [], ok: false,
      dims: { L: L, D: D, H: H }, ferragens: [], elementos: [], eletros: [], resumo: {}, cuba: null
    };

    if (!(L >= 100)) { erro('Comprimento inválido (mínimo 100 mm).'); return fim(); }
    if (!(D >= 150)) { erro('Profundidade inválida (mínimo 150 mm).'); return fim(); }
    if (!(H >= 150)) { erro('Altura inválida (mínimo 150 mm).'); return fim(); }
    if (!(T >= 6 && T <= 40)) { erro('Espessura da caixaria fora do intervalo (6 a 40 mm).'); return fim(); }
    if (!spec.colunas.length) { erro('Nenhuma coluna definida.'); return fim(); }

    var bt = spec.base.tipo;
    var temBase = (bt === 'rodape' || bt === 'pes');
    var z0 = temBase ? Math.max(30, spec.base.altura) : 0;
    var hRT = spec.rodaTeto.ativo ? Math.max(10, spec.rodaTeto.altura) : 0;
    var zTop = H - hRT;
    var Hc = zTop - z0;
    if (Hc < 2 * T + 80) { erro('Altura da caixaria muito baixa (' + fmtMm(Hc) + '). Reduza rodapé/roda-teto ou aumente a altura.'); return fim(); }
    var fundoTipo = spec.fundo.tipo;
    var Dc = D - (fundoTipo === 'sobreposto' ? F : 0);
    var profUtil = fundoTipo === 'encaixado' ? D - spec.fundo.recuoEncaixe - F : Dc;
    var yInt = embutida ? Tf : 0;
    var topoTravessas = spec.topo === 'travessas';
    var frenteY0 = embutida ? 0 : -Tf;
    R.dims = { L: L, D: D, H: H, z0: z0, zTop: zTop, Hc: Hc, Dc: Dc, frenteY0: frenteY0, profUtil: profUtil, hRT: hRT };

    // --- colunas (larguras) ---
    var rc = resolverMedidas(spec.colunas, L, 'largura', 100);
    if (rc.erro === 'pouco') erro('As larguras fixas das colunas somam mais que o comprimento disponível (' + fmtMm(L) + '). Deixe alguma coluna automática.');
    if (rc.erro === 'soma') dica('Todas as colunas têm largura fixa: a última foi ajustada para fechar ' + fmtMm(L) + '.');
    var xs = [0];
    rc.medidas.forEach(function (w) { xs.push(xs[xs.length - 1] + w); });
    var nC = spec.colunas.length;

    // cuba
    var cubaAtiva = spec.cuba.ativa && (tipo === 'balcao' || tipo === 'gabinete' || tipo === 'personalizado');
    var cuba0 = spec.cuba.centro - spec.cuba.largura / 2, cuba1 = spec.cuba.centro + spec.cuba.largura / 2;
    var cubaCols = [];
    for (var ci = 0; ci < nC; ci++) cubaCols.push(!!(cubaAtiva && xs[ci + 1] > cuba0 + 1 && xs[ci] < cuba1 - 1));
    if (cubaAtiva) {
      R.cuba = { x0: cuba0, x1: cuba1, centro: spec.cuba.centro, prof: spec.cuba.profundidade, larg: spec.cuba.largura };
      if (cuba1 < 0 || cuba0 > L) aviso('A cuba está fora do comprimento do móvel.');
    }

    // --- vãos ---
    var grupos = agruparVaos(spec, xs, cubaCols);
    var nV = grupos.length;
    var divs = [];
    var vaosM = [];
    grupos.forEach(function (gr, vi) {
      var x0 = xs[gr[0]], x1 = xs[gr[gr.length - 1] + 1];
      var il = vi === 0 ? T : x0 + T / 2;
      var ir = vi === nV - 1 ? L - T : x1 - T / 2;
      if (vi > 0) divs.push(x0);
      var col0 = spec.colunas[gr[0]];
      var vm = { idx: vi, x0: x0, x1: x1, il: il, ir: ir, larg: x1 - x0, largInt: ir - il,
        cuba: gr.some(function (c) { return cubaCols[c]; }),
        colunas: gr.map(function (c) { return { idx: c, x0: xs[c], x1: xs[c + 1] }; }), secoes: [] };
      if (vm.largInt < 80) erro('Coluna ' + (gr[0] + 1) + ' ficou com só ' + fmtMm(vm.largInt) + ' de largura interna.', { col: gr[0] });
      var secs = col0.secoes;
      var rs = resolverMedidas(secs, Hc, 'altura', 2 * T + 40);
      if (rs.erro === 'pouco') erro('Coluna ' + (gr[0] + 1) + ': as alturas fixas das faixas passam da altura da caixaria (' + fmtMm(Hc) + ').', { col: gr[0] });
      var zs = [z0];
      rs.medidas.forEach(function (h) { zs.push(zs[zs.length - 1] + h); });
      for (var j = 0; j < secs.length; j++) {
        var ib = j === 0 ? z0 + T : zs[j] + T / 2;
        var it = j === secs.length - 1 ? zTop - T : zs[j + 1] - T / 2;
        vm.secoes.push({ idx: j, tipo: secs[j].tipo, z0: zs[j], z1: zs[j + 1], ib: ib, it: it, alt: zs[j + 1] - zs[j], altInt: it - ib, cfg: secs[j] });
        if (it - ib < 60) erro('Coluna ' + (gr[0] + 1) + ', faixa ' + (j + 1) + ': altura interna de ' + fmtMm(it - ib) + ' é pequena demais.', { col: gr[0], secao: j });
      }
      vaosM.push(vm);
    });
    R.vaos = vaosM;
    R.colunas = spec.colunas.map(function (c, i) {
      var vm = null; vaosM.forEach(function (v) { v.colunas.forEach(function (cc) { if (cc.idx === i) vm = v; }); });
      return { idx: i, x0: xs[i], x1: xs[i + 1], larg: xs[i + 1] - xs[i], vao: vm ? vm.idx : null, cuba: cubaCols[i], secoes: vm ? vm.secoes : [] };
    });
    if (avisos.some(function (a) { return a.nivel === 'erro'; })) return fim();

    var cont = { portas: 0, gavetas: 0, basculantes: 0, prateleirasMoveis: 0, prateleirasFixas: 0,
      dobradicas: { reta: 0, curva: 0, superCurva: 0 }, corredicas: {}, corredicasOcultas: {}, puxadores: 0, puxadorPerfilMm: 0,
      pistoes: 0, cabideiroMm: 0, suportesCabideiro: 0, temperos: 0, lixeiras: [], fruteiras: 0, espelhoM2: 0, travessasCava: 0,
      ripas: 0, vidroM2: 0, perfilVidroMm: 0, ledMm: 0, botoes: 0 };

    // ================================================================
    // CAIXARIA
    // ================================================================
    var maxEmenda = spec.emendaAuto ? usavelC : 1e9;
    // nicho de geladeira (faixa de baixo): sem base, sem rodapé — o aparelho apoia no piso
    var semBase = vaosM.filter(function (v) { return v.secoes[0] && v.secoes[0].cfg && (v.secoes[0].cfg.tipo === 'geladeira' || v.secoes[0].cfg.tipo === 'livre'); }).map(function (v) { return [v.il, v.ir]; });
    function tirarSemBase(pedacos) {
      var out = [];
      pedacos.forEach(function (pc) {
        var partes = [[pc[0], pc[1]]];
        semBase.forEach(function (sb) {
          var nv = [];
          partes.forEach(function (pt) {
            if (sb[1] <= pt[0] || sb[0] >= pt[1]) { nv.push(pt); return; }
            if (sb[0] - pt[0] > 1) nv.push([pt[0], sb[0]]);
            if (pt[1] - sb[1] > 1) nv.push([sb[1], pt[1]]);
          });
          partes = nv;
        });
        out = out.concat(partes);
      });
      return out;
    }
    var baseDiv = dividirSobreApoios(0, L, divs, maxEmenda);
    if (semBase.length) baseDiv.pedacos = tirarSemBase(baseDiv.pedacos);
    baseDiv.pedacos.forEach(function (pc, k) {
      fab.chapa({ nome: baseDiv.pedacos.length > 1 ? 'Base ' + (k + 1) : 'Base', grupo: 'caixa', mat: aereoLike ? matExt : matInt, eixoEsp: 'z',
        x: pc[0], y: 0, z: z0, dx: pc[1] - pc[0], dy: Dc, dz: T, veio: 'x', fitas: ['x'],
        obs: baseDiv.pedacos.length > 1 ? 'Emenda sobre divisória' : (L > usavelC ? 'Peça de chapa emendada' : '') });
    });
    if (L > usavelC) {
      if (spec.emendaAuto && !baseDiv.semApoio) info('Base com ' + fmtCm(L) + ' passa do comprimento útil da chapa (' + fmtCm(usavelC) + '): dividida em ' + baseDiv.pedacos.length + ' peças com emenda sobre divisória.');
      else aviso('Base com ' + fmtCm(L) + ' passam do comprimento da chapa (' + fmtCm(usavelC) + '): o marceneiro precisará de emenda — prefira posicioná-la sobre uma divisória.');
    }

    var hLat = Hc - T;
    [0, L - T].forEach(function (x, k) {
      var adj = (k === 0 && vaosM[0].cuba) || (k === 1 && vaosM[nV - 1].cuba);
      fab.chapa({ nome: k === 0 ? 'Lateral esquerda' : 'Lateral direita', grupo: 'caixa', mat: matExt, eixoEsp: 'x',
        x: x, y: 0, z: z0 + T, dx: T, dy: Dc, dz: hLat, veio: 'z', fitas: ['z'], obs: adj ? 'Recorte p/ cuba (2 cm de folga)' : '' });
    });
    if (hLat > usavelC) aviso('Laterais com ' + fmtCm(hLat) + ' passam do comprimento útil da chapa (' + fmtCm(usavelC) + ').');
    if (Dc > usavelL) aviso('Profundidade de ' + fmtCm(Dc) + ' passa da largura útil da chapa (' + fmtCm(usavelL) + ').');

    var topoDiv = dividirSobreApoios(T, L - T, divs, maxEmenda);
    if (topoTravessas) {
      var tl = Math.min(spec.travessaLargura, Dc / 2);
      topoDiv.pedacos.forEach(function (pc, k) {
        var suf = topoDiv.pedacos.length > 1 ? ' ' + (k + 1) : '';
        var longo = (pc[1] - pc[0]) > usavelC ? 'Peça de chapa emendada' : '';
        fab.chapa({ nome: 'Travessa superior frontal' + suf, grupo: 'caixa', mat: matInt, eixoEsp: 'z',
          x: pc[0], y: 0, z: zTop - T, dx: pc[1] - pc[0], dy: tl, dz: T, veio: 'x', fitas: ['x'], obs: longo });
        fab.chapa({ nome: 'Travessa superior traseira' + suf, grupo: 'caixa', mat: matInt, eixoEsp: 'z',
          x: pc[0], y: Dc - tl, z: zTop - T, dx: pc[1] - pc[0], dy: tl, dz: T, veio: 'x', fitas: [], obs: longo });
      });
      info('Sem chapa de cima: duas travessas (frente e fundo) amarram a caixaria' + (tipo === 'balcao' || tipo === 'gabinete' ? ' e apoiam a pedra.' : '.'));
    } else {
      topoDiv.pedacos.forEach(function (pc, k) {
        fab.chapa({ nome: topoDiv.pedacos.length > 1 ? 'Topo ' + (k + 1) : 'Topo', grupo: 'caixa', mat: (aereoLike || tipo === 'gaveteiro') ? matExt : matInt, eixoEsp: 'z',
          x: pc[0], y: 0, z: zTop - T, dx: pc[1] - pc[0], dy: Dc, dz: T, veio: 'x', fitas: ['x'] });
      });
    }

    divs.forEach(function (xc, k) {
      var adjCuba = vaosM[k].cuba || vaosM[k + 1].cuba;
      fab.chapa({ nome: 'Divisória', grupo: 'caixa', mat: matInt, eixoEsp: 'x',
        x: xc - T / 2, y: 0, z: z0 + T, dx: T, dy: Dc, dz: Hc - 2 * T, veio: 'z', fitas: ['z'],
        obs: adjCuba ? 'Recorte p/ cuba (2 cm de folga)' : '' });
    });

    // Fundo (o vão livre das pernas fica sem fundo; leva uma travessa de fundo no alto que trava o móvel)
    function vaoLivre(vm) { return vm.secoes[0] && vm.secoes[0].cfg && vm.secoes[0].cfg.tipo === 'livre'; }
    vaosM.forEach(function (vm) {
      if (!vaoLivre(vm)) return;
      var hT2 = Math.min(250, Math.max(120, (zTop - z0) * 0.3));
      fab.chapa({ nome: 'Travessa de fundo', grupo: 'caixa', mat: matInt, eixoEsp: 'y', x: vm.il, y: Dc - T, z: zTop - T - hT2, dx: vm.largInt, dy: T, dz: hT2, veio: 'x', fitas: ['x'], vao: vm.idx, obs: 'Trava o móvel no vão das pernas' });
    });
    if (fundoTipo !== 'nenhum') {
      if (fundoTipo === 'sobreposto') {
        var runs = [], atual = null;
        var maxRun = Hc > usavelL ? usavelL : usavelC;
        vaosM.forEach(function (vm) {
          if (vm.cuba || vaoLivre(vm)) { atual = null; return; }
          var a = vm.idx === 0 ? 0 : vm.x0, b = vm.idx === nV - 1 ? L : vm.x1;
          if (atual && (b - atual[0]) <= maxRun && Math.abs(atual[1] - a) < 0.01) atual[1] = b;
          else { atual = [a, b]; runs.push(atual); }
        });
        runs.forEach(function (rn) {
          fab.chapa({ nome: 'Fundo', grupo: 'fundo', mat: 'fundo', eixoEsp: 'y',
            x: rn[0], y: Dc, z: z0, dx: rn[1] - rn[0], dy: F, dz: Hc, fitas: [], obs: 'Pregado/grampeado atrás' });
        });
      } else {
        var rasgo = spec.fundo.rasgo;
        vaosM.forEach(function (vm) {
          if (vm.cuba || vaoLivre(vm)) return;
          var zb = z0 + T - rasgo, zt = topoTravessas ? zTop : zTop - T + rasgo;
          fab.chapa({ nome: 'Fundo', grupo: 'fundo', mat: 'fundo', eixoEsp: 'y',
            x: vm.il - rasgo, y: D - spec.fundo.recuoEncaixe - F, z: zb, dx: vm.largInt + 2 * rasgo, dy: F, dz: zt - zb,
            fitas: [], vao: vm.idx, obs: 'Encaixado em rasgo de ' + rasgo + ' mm' });
        });
      }
    }
    if (cubaAtiva && vaosM.some(function (v) { return v.cuba; })) {
      info('Cuba detectada' + (spec.cuba.origem === 'modelo' ? ' no modelo' : '') + ': o módulo da pia fica sem fundo, sem prateleira na altura do sifão e laterais, divisórias, travessas e gavetas recortadas com 2 cm de folga.');
    }

    // ================================================================
    // INTERIOR + FRENTES
    // ================================================================
    var vaosLargosPrat = [];
    var seqGav = 0;
    // com puxador cava em balcão, a travessa da cava ocupa os 76 mm de cima atrás das frentes
    var temTravCava = pux.tipo === 'cava' && (tipo === 'balcao' || tipo === 'gabinete') && topoTravessas;
    var topoTravCava = zTop - T - 76;
    var puxPos = pux.posicao === 'auto' ? (aereoLike ? 'base' : (tipo === 'balcao' || tipo === 'gabinete' || tipo === 'gaveteiro' ? 'topo' : 'lateral')) : pux.posicao;

    function puxadorConta() { if (pux.tipo !== 'toque' && pux.tipo !== 'nenhum') cont.puxadores++; }

    // Puxador / cava em uma frente (px..px+pw, pz..pz+ph)
    function aplicarPuxador(frenteP, info2) {
      // info2: {x, z, w, h, y0, conj, tipoFrente:'porta'|'gaveta'|'basculante', lado:'esq'|'dir'|'topo', vao, col, secao}
      var w = info2.w, h = info2.h, x = info2.x, z = info2.z, y0 = info2.y0 - (info2.vidro ? 0 : yApar);
      var refs = { vao: info2.vao, col: info2.col, secao: info2.secao, conj: info2.conj };
      var posV = info2.tipoFrente === 'gaveta' || info2.tipoFrente === 'basculante' ? (puxPos === 'base' ? 'base' : 'topo') : puxPos;
      if (pux.tipo === 'passante') return; // a própria porta passa da caixa
      if (pux.tipo === 'cava' && frenteP) {
        // chanfro 45° na borda superior (ou inferior) traseira da frente
        var c = clamp(pux.tamanho, 8, Tf - 4);
        var yF = 0, yB = Tf; // local ao perfil (y para trás)
        var pts;
        if (posV === 'base') pts = [[yF, 0], [yB - c, 0], [yB, c], [yB, h], [yF, h]];
        else pts = [[yF, 0], [yB, 0], [yB, h - c], [yB - c, h], [yF, h]];
        if (posV === 'lateral') pts = [[yF, 0], [yB, 0], [yB, h - c], [yB - c, h], [yF, h]];
        frenteP.forma = { plano: 'yz', pts: pts, cava: posV };
        return;
      }
      if (pux.tipo === 'botao') {
        var bxB = info2.tipoFrente === 'porta' ? (info2.lado === 'esq' ? x + w - 55 : x + 25) : x + w / 2 - 15;
        var bzB = info2.tipoFrente === 'porta' ? (tipo === 'aereo' || posV === 'base' ? z + 50 : (tipo === 'balcao' ? z + h - 80 : z + h / 2 - 15)) : (posV === 'base' ? z + 30 : z + h - 60);
        fab.objeto({ nome: 'Puxador botão', grupo: 'ferragem', mat: 'metal', x: bxB, y: y0 - 25, z: bzB, dx: 30, dy: 25, dz: 30, vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj });
        cont.botoes++;
        return;
      }
      if (pux.tipo === 'testeira') {
        fab.objeto({ nome: 'Perfil testeira 45°', grupo: 'ferragem', mat: 'metal', x: x, y: y0 - 18, z: posV === 'base' ? z : z + h - 18, dx: w, dy: 18, dz: 18, vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj, forma: { plano: 'yz', pts: posV === 'base' ? [[0, 18], [18, 18], [18, 0]] : [[0, 0], [18, 0], [18, 18]] } });
        cont.puxadorPerfilMm += w;
        return;
      }
      if (pux.tipo === 'alca' || pux.tipo === 'barra') {
        var compMax = pux.tipo === 'barra' ? 800 : pux.comprimento;
        var comp = Math.min(compMax, (info2.tipoFrente === 'porta' && posV === 'lateral') ? h - 80 : w - 60);
        var bx, bz, bw, bh;
        if (info2.tipoFrente === 'porta' && posV === 'lateral') {
          bw = 12; bh = comp;
          bx = info2.lado === 'esq' ? x + w - 45 : x + 33;
          bz = z + (tipo === 'balcao' ? h - comp - 60 : (tipo === 'aereo' ? 60 : (h - comp) / 2));
        } else {
          bw = comp; bh = 12;
          bx = x + (w - comp) / 2;
          bz = posV === 'base' ? z + 35 : z + h - 47;
        }
        fab.objeto({ nome: pux.tipo === 'barra' ? 'Puxador barra' : 'Puxador alça', grupo: 'ferragem', mat: 'metal', x: bx, y: y0 - 28, z: bz, dx: bw, dy: 28, dz: bh,
          vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj });
        return;
      }
      if (pux.tipo === 'perfil') {
        var ph = 22;
        var pzp = posV === 'base' ? z : z + h - ph;
        if (info2.tipoFrente === 'porta' && posV === 'lateral') {
          var pxp = info2.lado === 'esq' ? x + w - 20 : x;
          fab.objeto({ nome: 'Perfil puxador', grupo: 'ferragem', mat: 'metal', x: pxp, y: y0 - 16, z: z + 40, dx: 20, dy: 16, dz: h - 80, vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj });
          cont.puxadorPerfilMm += h - 80;
        } else {
          fab.objeto({ nome: 'Perfil puxador', grupo: 'ferragem', mat: 'metal', x: x, y: y0 - 16, z: pzp, dx: w, dy: 16, dz: ph, vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj });
          cont.puxadorPerfilMm += w;
        }
      }
    }

    // Frente com estilo: lisa, ripada (ripas aplicadas), moldura (quadro aplicado) ou vidro canelado (quadro de alumínio)
    function frente(o) {
      var rf = { vao: o.vao, col: o.col, secao: o.secao, conj: o.conj };
      function comRef(obj) { obj.vao = rf.vao; obj.col = rf.col; obj.secao = rf.secao; obj.conj = rf.conj; return obj; }
      if (estilo === 'vidro' && o.vidroOk) {
        var pf = 20;
        fab.objeto(comRef({ nome: 'Perfil alumínio da porta', grupo: 'frente', mat: 'metal', x: o.x, y: o.y0, z: o.z, dx: pf, dy: Tf, dz: o.h }));
        fab.objeto(comRef({ nome: 'Perfil alumínio da porta', grupo: 'frente', mat: 'metal', x: o.x + o.w - pf, y: o.y0, z: o.z, dx: pf, dy: Tf, dz: o.h }));
        fab.objeto(comRef({ nome: 'Perfil alumínio da porta', grupo: 'frente', mat: 'metal', x: o.x + pf, y: o.y0, z: o.z, dx: o.w - 2 * pf, dy: Tf, dz: pf }));
        fab.objeto(comRef({ nome: 'Perfil alumínio da porta', grupo: 'frente', mat: 'metal', x: o.x + pf, y: o.y0, z: o.z + o.h - pf, dx: o.w - 2 * pf, dy: Tf, dz: pf }));
        fab.objeto(comRef({ nome: 'Vidro canelado 4 mm', grupo: 'frente', mat: 'vidro', x: o.x + pf, y: o.y0 + Tf / 2 - 2, z: o.z + pf, dx: o.w - 2 * pf, dy: 4, dz: o.h - 2 * pf, meta: o.meta, obs: o.obs }));
        cont.vidroM2 += (o.w - 2 * pf) * (o.h - 2 * pf) / 1e6; cont.perfilVidroMm += 2 * (o.w + o.h);
        return null;
      }
      var b = fab.chapa(comRef({ nome: o.nome, grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: o.x, y: o.y0, z: o.z, dx: o.w, dy: Tf, dz: o.h, veio: o.veio, fitas: ['x', 'x', 'z', 'z'], obs: o.obs, meta: o.meta }));
      if (estilo === 'ripada') {
        var passo = ripa.largura + ripa.espaco;
        var nR = Math.max(1, Math.floor((o.w + ripa.espaco) / passo));
        var usado = nR * ripa.largura + (nR - 1) * ripa.espaco;
        var xr = o.x + (o.w - usado) / 2;
        for (var kr = 0; kr < nR; kr++) fab.chapa(comRef({ nome: 'Ripa', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: xr + kr * passo, y: o.y0 - ripa.espessura, z: o.z, dx: ripa.largura, dy: ripa.espessura, dz: o.h, veio: 'z', fitas: ['z', 'z'], obs: 'Ripa colada na frente' }));
        cont.ripas += nR;
      } else if (estilo === 'moldura') {
        var mw = Math.max(25, Math.min(60, o.w / 4, o.h / 4)), me = 6;
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: o.x, y: o.y0 - me, z: o.z + o.h - mw, dx: o.w, dy: me, dz: mw, veio: 'x', fitas: ['x', 'x'] }));
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: o.x, y: o.y0 - me, z: o.z, dx: o.w, dy: me, dz: mw, veio: 'x', fitas: ['x', 'x'] }));
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: o.x, y: o.y0 - me, z: o.z + mw, dx: mw, dy: me, dz: o.h - 2 * mw, veio: 'z', fitas: ['z', 'z'] }));
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: o.x + o.w - mw, y: o.y0 - me, z: o.z + mw, dx: mw, dy: me, dz: o.h - 2 * mw, veio: 'z', fitas: ['z', 'z'] }));
      }
      return b;
    }

    function dobradicasVisuais(px, pw, pz, ph, lado, nd, conj, refs) {
      if (estilo === 'vidro') return; // porta de vidro usa dobradiça própria do perfil de alumínio
      for (var k = 0; k < nd; k++) {
        var zz = nd === 1 ? pz + ph / 2 : pz + 90 + (ph - 180) * k / (nd - 1);
        var xc = lado === 'esq' ? px + 22 : px + pw - 22 - 35;
        var yBack = embutida ? Tf : 0;
        var circ = [];
        for (var kc = 0; kc < 24; kc++) { var ac = kc * Math.PI / 12; circ.push([r1(17.5 + 17.5 * Math.cos(ac)), r1(17.5 + 17.5 * Math.sin(ac))]); }
        fab.objeto({ nome: 'Dobradiça (caneco)', grupo: 'ferragem', mat: 'metal', x: xc, y: yBack - 11, z: zz - 17.5, dx: 35, dy: 12.5, dz: 35, conj: conj, vao: refs.vao, col: refs.col, secao: refs.secao, forma: spec.leve ? null : { plano: 'xz', pts: circ } });
      }
    }

    // Corrediça telescópica de extração total (46 × 12,7 mm, aço 1,2 mm), com os 3 perfis da peça real:
    //  - perfil fixo (em "C"), parafusado na lateral do móvel;
    //  - perfil intermediário, que corre dentro do fixo e anda metade do curso;
    //  - perfil interno, parafusado na lateral da gaveta.
    // Folga total de 12,5 mm entre a lateral do móvel e a lateral da gaveta.
    function perfilC(w, h, t, abreParaMais) {
      // seção em "C" no plano xz (x = espessura do conjunto, z = altura); abre para +x ou para −x
      var pts = [[0, 0], [w, 0], [w, t], [t, t], [t, h - t], [w, h - t], [w, h], [0, h]];
      return abreParaMais ? pts : pts.map(function (q) { return [r1(w - q[0]), q[1]]; });
    }
    function corredicasVisuais(xL, xR, zc, y0, len, conj, refs, hMax) {
      var h = Math.max(27, Math.min(45, hMax || 45));
      var r = { vao: refs.vao, col: refs.col, secao: refs.secao };
      if (spec.leve) {
        // modo leve: um bloco fixo e um móvel por lado (bem menos geometria)
        [[xL, 1], [xR, -1]].forEach(function (ld) {
          fab.objeto(Object.assign({ nome: 'Corrediça telescópica (perfil fixo)', grupo: 'ferragem', mat: 'metal', x: ld[1] > 0 ? ld[0] : ld[0] - 6.2, y: y0, z: zc, dx: 6.2, dy: len, dz: h }, r));
          fab.objeto(Object.assign({ nome: 'Corrediça telescópica (perfil interno)', grupo: 'ferragem', mat: 'metal', x: ld[1] > 0 ? ld[0] + 6.2 : ld[0] - 12.5, y: y0, z: zc + 5, dx: 6.3, dy: len, dz: h - 10, conj: conj }, r));
        });
        return;
      }
      var cj = fab.conjuntos.filter(function (c) { return c.id === conj; })[0];
      // o intermediário segue a gaveta, voltando metade do curso: no fim anda só a metade
      var meio = cj ? fab.conjunto({ nome: 'Corrediça (perfil intermediário)', tipo: 'corre', curso: -Math.round(cj.curso / 2), pai: conj, segue: true, vao: refs.vao, col: refs.col, secao: refs.secao }) : conj;
      var t = 1.2;
      // seções encaixadas (esquerda; a direita é espelhada): o metal de um perfil corre dentro do
      // outro sem encostar — fixo x 0–6,4 · intermediário x 1,6–9,0 · interno x 3,6–12,5 (lado da gaveta)
      [[xL, 1], [xR, -1]].forEach(function (lado) {
        var b = lado[0], sg = lado[1];
        function px(a, w) { return sg > 0 ? b + a : b - a - w; }
        fab.objeto(Object.assign({ nome: 'Corrediça telescópica (perfil fixo)', grupo: 'ferragem', mat: 'metal', x: px(0, 6.4), y: y0, z: zc, dx: 6.4, dy: len, dz: h, forma: { plano: 'xz', pts: perfilC(6.4, h, t, sg > 0) } }, r));
        fab.objeto(Object.assign({ nome: 'Corrediça telescópica (perfil intermediário)', grupo: 'ferragem', mat: 'metal', x: px(1.6, 7.4), y: y0 + 8, z: zc + 3, dx: 7.4, dy: len - 16, dz: h - 6, conj: meio, forma: { plano: 'xz', pts: perfilC(7.4, h - 6, t, sg > 0) } }, r));
        fab.objeto(Object.assign({ nome: 'Corrediça telescópica (perfil interno)', grupo: 'ferragem', mat: 'metal', x: px(3.6, 8.9), y: y0, z: zc + 6, dx: 8.9, dy: len - 4, dz: h - 12, conj: conj, forma: { plano: 'xz', pts: perfilC(8.9, h - 12, t, sg < 0) } }, r));
      });
    }

    function compCorredica(disp) {
      var c = CORREDICAS.filter(function (v) { return v <= disp; });
      return c.length ? c[c.length - 1] : 0;
    }

    vaosM.forEach(function (vm) {
      var vi = vm.idx;
      var nS = vm.secoes.length;
      var colIdx0 = vm.colunas[0].idx;
      vm.secoes.forEach(function (sm) {
        var j = sm.idx, cfg = sm.cfg;
        var ref = { vao: vi, col: colIdx0, secao: j };
        var rot = 'Coluna ' + (colIdx0 + 1) + (nS > 1 ? ', faixa ' + (j + 1) : '');
        var refs = { vao: vi, col: colIdx0, secao: j };

        if (j < nS - 1) {
          fab.chapa({ nome: 'Prateleira fixa', grupo: 'caixa', mat: matInt, eixoEsp: 'z',
            x: vm.il, y: yInt, z: sm.z1 - T / 2, dx: vm.largInt, dy: profUtil - yInt, dz: T, veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, obs: 'Estrutural' });
          cont.prateleirasFixas++;
        }

        var extEsq = vi === 0, extDir = vi === nV - 1, extBaixo = j === 0, extTopo = j === nS - 1;
        var itCorre = (temTravCava && extTopo) ? Math.min(sm.it, topoTravCava - 3) : sm.it; // topo livre para o que corre
        var folgaTopoCorre = (temTravCava && extTopo) ? 2 : 15;
        // região de cobertura de toda a faixa
        var reg;
        if (embutida) {
          var fe = fr.folgaEmbutida;
          reg = { x0: vm.il + fe, x1: vm.ir - fe, z0: sm.ib + fe, z1: sm.it - fe, y0: 0 };
        } else {
          reg = { x0: vm.x0 + (extEsq ? 0 : g / 2), x1: vm.x1 - (extDir ? 0 : g / 2),
            z0: sm.z0 + (extBaixo ? 0 : g / 2), z1: sm.z1 - (extTopo ? fr.folgaTopo : g / 2), y0: -Tf };
        }
        if (pux.tipo === 'passante' && !embutida) {
          var posP = pux.posicao === 'auto' ? (aereoLike ? 'base' : 'topo') : pux.posicao;
          if (posP === 'base' && extBaixo) reg.z0 -= pux.passa;
          if (posP === 'topo' && extTopo) {
            if (tipo === 'balcao' || tipo === 'gabinete') { if (j === nS - 1 && vi === 0) info('Porta passante no topo de balcão encosta no tampo: prefira cava ou passante na base.'); }
            else reg.z1 += pux.passa;
          }
        }
        var regW = reg.x1 - reg.x0, regH = reg.z1 - reg.z0;
        var veioF = fr.veio === 'horizontal' ? 'x' : 'z';
        function tipoHinge(lado, interno) {
          if (embutida) return 'superCurva';
          if (interno) return 'curva';
          if (lado === 'esq') return extEsq ? 'reta' : 'curva';
          if (lado === 'dir') return extDir ? 'reta' : 'curva';
          if (lado === 'topo') return extTopo ? 'reta' : 'curva';
          return 'reta';
        }
        var nomeHinge = { reta: 'reta', curva: 'curva', superCurva: 'super curva' };

        function prateleirasMoveis(n, topoLim) {
          if (n <= 0 || vm.cuba) return;
          var itop = isNum(topoLim) ? Math.min(topoLim, sm.it) : sm.it;
          var pw = vm.largInt - 2 * spec.prateleiras.folga;
          var pd = profUtil - yInt - spec.prateleiras.recuo;
          for (var k = 1; k <= n; k++) {
            var zc = sm.ib + (itop - sm.ib) * k / (n + 1);
            fab.chapa({ nome: 'Prateleira', grupo: 'caixa', mat: matInt, eixoEsp: 'z',
              x: vm.il + spec.prateleiras.folga, y: yInt + spec.prateleiras.recuo, z: zc - T / 2, dx: pw, dy: pd, dz: T,
              veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, obs: 'Móvel (4 pinos)' });
            cont.prateleirasMoveis++;
          }
          if (vm.largInt > 800) vaosLargosPrat.push(colIdx0);
        }
        function cabideiro() {
          var zt = sm.it - 60;
          fab.objeto({ nome: 'Tubo cabideiro', grupo: 'ferragem', mat: 'metal', x: vm.il, y: (yInt + profUtil) / 2 - 12.5, z: zt - 15, dx: vm.largInt, dy: 25, dz: 15, vao: vi, col: colIdx0, secao: j });
          cont.cabideiroMm += vm.largInt; cont.suportesCabideiro += 2;
          if (sm.altInt < 900) aviso(rot + ': cabideiro com ' + fmtCm(sm.altInt) + ' de altura interna (camisas pedem ~100 cm; vestidos longos ~150 cm).', ref);
          if (profUtil < 520) aviso(rot + ': profundidade útil de ' + fmtCm(profUtil) + ' é pouca para cabides (ideal ≥ 55 cm).', ref);
        }
        function interior() {
          if (cfg.interior === 'cabideiro') cabideiro();
          else if (cfg.interior === 'prateleiras') prateleirasMoveis(cfg.prateleiras);
        }

        // ------------------------------------------------ PORTAS
        if (cfg.tipo === 'portas') {
          interior();
          var portasLista = [];
          vm.colunas.forEach(function (cc, kc) {
            var cx0, cx1;
            if (embutida) { cx0 = kc === 0 ? reg.x0 : cc.x0 + g / 2; cx1 = kc === vm.colunas.length - 1 ? reg.x1 : cc.x1 - g / 2; }
            else { cx0 = kc === 0 ? reg.x0 : cc.x0 + g / 2; cx1 = kc === vm.colunas.length - 1 ? reg.x1 : cc.x1 - g / 2; }
            var cw = cx1 - cx0;
            var nP = vm.colunas.length > 1 ? 1 : (cfg.portas > 0 ? Math.min(2, cfg.portas) : (cw > Math.min(spec.larguraMax, 600) + 1 ? 2 : 1));
            var pw = nP === 2 ? (cw - g) / 2 : cw;
            for (var k = 0; k < nP; k++) portasLista.push({ x: cx0 + k * (pw + g), w: pw, col: cc.idx });
          });
          var nTot = portasLista.length;
          portasLista.forEach(function (pp, k) {
            var lado;
            if (nTot === 1) {
              lado = cfg.dobradica === 'dir' ? 'dir' : (cfg.dobradica === 'esq' ? 'esq' : (extDir && !extEsq ? 'dir' : 'esq'));
            } else if (nTot === 2) lado = k === 0 ? 'esq' : 'dir';
            else lado = (k % 2 === 0) ? 'esq' : 'dir';
            var interno = nTot > 2 && ((lado === 'esq' && k > 0) || (lado === 'dir' && k < nTot - 1));
            var th = tipoHinge(lado, false);
            var nd = nDobradicas(regH);
            cont.dobradicas[th] += nd; cont.portas++; puxadorConta();
            var pivX = lado === 'esq' ? pp.x : pp.x + pp.w;
            var cj = fab.conjunto({ nome: 'Porta', tipo: 'giro', eixo: 'z', pivot: { x: pivX, y: reg.y0, z: reg.z0 }, angulo: lado === 'esq' ? -95 : 95, vao: vi, col: pp.col, secao: j });
            var porta = frente({ nome: 'Porta', x: pp.x, y0: reg.y0, z: reg.z0, w: pp.w, h: regH, veio: veioF, vidroOk: true,
              vao: vi, col: pp.col, secao: j, conj: cj,
              obs: 'De abrir, dobradiça ' + nomeHinge[th] + ' à ' + (lado === 'esq' ? 'esquerda' : 'direita') + ' (' + nd + ' un)' + (vm.cuba ? ' · lado da cuba abaixo do fundo dela' : ''),
              meta: { tipo: 'porta', dobradica: lado, nDobradicas: nd, hinge: th } });
            aplicarPuxador(porta, { x: pp.x, z: reg.z0, w: pp.w, h: regH, y0: reg.y0, vidro: !porta && estilo === 'vidro', conj: cj, tipoFrente: 'porta', lado: lado, vao: vi, col: pp.col, secao: j });
            dobradicasVisuais(pp.x, pp.w, reg.z0, regH, lado, nd, cj, { vao: vi, col: pp.col, secao: j });
            if (interno) erro(rot + ': sem divisória entre as portas, a ' + (k + 1) + 'ª porta não tem onde fixar a dobradiça — use divisórias "cada par" ou "cada porta".', ref);
            if (pp.w > 600) aviso(rot + ': porta com ' + fmtCm(pp.w) + ' de largura passa do recomendado (até 60 cm). Por quê: o peso e a alavanca forçam as dobradiças, a porta cai com o tempo e abre muito sobre a circulação. Divida em duas portas ou aumente o número de colunas.', ref);
            if (regH > 2200) aviso(rot + ': porta com ' + fmtCm(regH) + ' de altura. Por quê: porta alta empena com a umidade e o próprio peso. Use ' + nd + ' dobradiças, endireitador de porta (ou puxador perfil, que trava) e, se possível, MDF de 25 mm.', ref);
            if (pp.w < 250) aviso(rot + ': porta com ' + fmtCm(pp.w) + ' de largura não é recomendada (mínimo 25 cm). Por quê: a dobradiça e o puxador quase se encontram, a porta abre pouco e o espaço interno fica difícil de usar. Use nicho, porta-temperos ou junte com a coluna ao lado.', ref);
          });
          if (vm.cuba && nTot) info(rot + ': portas sob a cuba — as dobradiças do lado da cuba ficam abaixo do fundo dela (2 cm de folga); redistribua na altura se o sifão invadir.', ref);
        }

        // ------------------------------------------------ BASCULANTE
        else if (cfg.tipo === 'basculante') {
          interior();
          var thB = tipoHinge('topo');
          var ndB = regW <= 900 ? 2 : 3;
          cont.dobradicas[thB] += ndB; cont.basculantes++; cont.pistoes += regW > 600 ? 2 : 1; puxadorConta();
          var cjB = fab.conjunto({ nome: 'Basculante', tipo: 'giro', eixo: 'x', pivot: { x: reg.x0, y: reg.y0, z: reg.z1 }, angulo: -100, vao: vi, col: colIdx0, secao: j });
          var pb = frente({ nome: 'Porta basculante', x: reg.x0, y0: reg.y0, z: reg.z0, w: regW, h: regH, veio: veioF, vidroOk: true,
            vao: vi, col: colIdx0, secao: j, conj: cjB, obs: 'Abre para cima · ' + ndB + ' dobradiças ' + nomeHinge[thB] + ' + pistão a gás',
            meta: { tipo: 'basculante', dobradica: 'topo', nDobradicas: ndB, hinge: thB } });
          aplicarPuxador(pb, { x: reg.x0, z: reg.z0, w: regW, h: regH, y0: reg.y0, vidro: !pb && estilo === 'vidro', conj: cjB, tipoFrente: 'basculante', vao: vi, col: colIdx0, secao: j });
          if (regH > 500) aviso(rot + ': basculante com ' + fmtCm(regH) + ' de altura passa do recomendado (até 50 cm). Por quê: o pistão tem de vencer o peso da porta, que abre para cima e pode bater na cabeça. Use articulador (tipo Aventos) ou portas de giro.', ref);
          if (regW > 1000) aviso(rot + ': basculante com ' + fmtCm(regW) + ' de largura passa do recomendado (até 1 m). Por quê: a porta torce na abertura e um pistão de cada lado não segura. Use pistões reforçados ou divida em dois basculantes.', ref);
        }

        // ------------------------------------------------ GAVETAS
        else if (cfg.tipo === 'gavetas') {
          var itens = cfg.itens;
          var nG = itens.length;
          var pesos = itens.map(function (it) { return it.tipo === 'gaveta' ? 1 : 2; });
          var fixoH = 0, pesoAuto = 0;
          itens.forEach(function (it, k) { if (isNum(it.altura) && it.altura > 0) fixoH += it.altura; else pesoAuto += pesos[k]; });
          var livre = regH - (nG - 1) * g - fixoH;
          var hs = itens.map(function (it, k) { return isNum(it.altura) && it.altura > 0 ? it.altura : (pesoAuto ? livre * pesos[k] / pesoAuto : 0); });
          if (pesoAuto === 0 && Math.abs(livre) > 1) { hs[nG - 1] += livre; }
          var oculta = spec.gavetas.corredica === 'oculta';
          var clear = oculta ? 5 : 12.5;
          var yBox = yInt;
          var lenC = compCorredica(profUtil - yBox - 10);
          if (!lenC) erro(rot + ': profundidade útil (' + fmtMm(profUtil - yBox) + ') não comporta corrediça (mínimo 250 mm).', ref);
          var bx0 = vm.il + clear, bx1 = vm.ir - clear, bW = bx1 - bx0;
          if (vm.largInt < 300) aviso(rot + ': gaveta com ' + fmtCm(vm.largInt) + ' de vão interno não é recomendada (mínimo 30 cm). Por quê: a corrediça ocupa 2,5 cm e as laterais da caixa mais 3 cm, sobrando só ' + fmtCm(Math.max(0, vm.largInt - 25 - 2 * Tg)) + ' por dentro: não cabe talher nem utensílio e a gaveta fica instável. Para vãos de 15 a 30 cm use porta-temperos (aramado de correr) ou nicho.', ref);
          if (vm.largInt > 900) aviso(rot + ': gaveta com ' + fmtCm(vm.largInt) + ' de vão interno passa do recomendado (até 90 cm). Por quê: o fundo de 6 mm enverga com o peso e as corrediças comuns (até 35 kg) ficam no limite. Use fundo de 15 mm, corrediça reforçada (45 kg ou mais) ou divida em duas colunas.', ref);
          if (vm.cuba) aviso(rot + ': gavetas no módulo da cuba precisam de recorte em "U" para o sifão — confirme com o marceneiro.', ref);
          var zf = reg.z0, fz = [];
          for (var q = 0; q < nG; q++) { fz.push([zf, zf + hs[q]]); zf += hs[q] + g; }
          for (var k3 = 0; k3 < nG; k3++) {
            var it3 = itens[k3];
            var f0 = fz[k3][0], f1 = fz[k3][1], fh = f1 - f0;
            seqGav++;
            var nomeG = (it3.tipo === 'gaveta' ? 'Gaveta' : 'Gavetão') + ' ' + seqGav;
            cont.gavetas++; puxadorConta();
            var cjG = fab.conjunto({ nome: nomeG, tipo: 'corre', curso: Math.round(lenC * 0.85), vao: vi, col: colIdx0, secao: j });
            var fg = frente({ nome: 'Frente gaveta', x: reg.x0, y0: reg.y0, z: f0, w: regW, h: fh, veio: veioF,
              vao: vi, col: colIdx0, secao: j, conj: cjG, obs: nomeG,
              meta: { tipo: 'gaveta', ordem: k3, item: it3.tipo } });
            aplicarPuxador(fg, { x: reg.x0, z: f0, w: regW, h: fh, y0: reg.y0, conj: cjG, tipoFrente: 'gaveta', vao: vi, col: colIdx0, secao: j });
            if (fh < 100) aviso(rot + ': frente de gaveta com ' + fmtCm(fh) + ' de altura não é recomendada (mínimo 10 cm). Por quê: sobra pouca caixa por dentro e não há altura para o puxador.', ref);
            if (k3 > 0 && pux.tipo === 'cava') {
              fab.chapa({ nome: 'Travessa entre gavetas', grupo: 'caixa', mat: matInt, eixoEsp: 'y', x: vm.il, y: yInt + 2, z: f0 - g / 2 - 20, dx: vm.largInt, dy: T, dz: 40, veio: 'x', fitas: [], vao: vi, col: colIdx0, secao: j });
              cont.travessasCava++;
            }
            if (!lenC) continue;
            cont.corredicas[lenC] = (cont.corredicas[lenC] || 0) + 1;
            var cavaTrav = pux.tipo === 'cava';
            var zBox = Math.max(f0 + (cavaTrav && k3 > 0 ? (oculta ? 32 : 21) : 20), sm.ib + 12);
            var lim = k3 === nG - 1 ? itCorre - folgaTopoCorre : fz[k3 + 1][0] - (cavaTrav ? 25 : -8);
            var hb = Math.min(fh - 40, lim - zBox);
            if (hb < 60) { aviso(rot + ': ' + nomeG.toLowerCase() + ' com caixa de só ' + fmtMm(hb) + ' de altura. Por quê: abaixo de 6 cm a gaveta não guarda quase nada (talher deitado já pede uns 6 cm). Aumente a frente ou use menos gavetas na coluna.', ref); hb = Math.max(hb, 40); }
            var obsG = nomeG + (vm.cuba ? ' · recorte p/ sifão' : '');
            var hI = 80, temInterna = it3.tipo === 'interna' && hb - hI - 25 >= 100;
            if (it3.tipo === 'interna' && !temInterna) aviso(rot + ': o gavetão não tem altura para gaveta interna (precisa de ~' + fmtCm(hI + 25 + 100 + 40) + ' de frente).', ref);
            var hbG = temInterna ? hb - hI - 25 : hb; // caixa do gavetão fica abaixo da interna
            fab.chapa({ nome: 'Lateral gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: bx0, y: yBox, z: zBox, dx: Tg, dy: lenC, dz: hbG, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: obsG });
            fab.chapa({ nome: 'Lateral gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: bx1 - Tg, y: yBox, z: zBox, dx: Tg, dy: lenC, dz: hbG, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: obsG });
            fab.chapa({ nome: 'Contrafrente', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: bx0 + Tg, y: yBox, z: zBox, dx: bW - 2 * Tg, dy: Tg, dz: hbG, veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: obsG });
            fab.chapa({ nome: 'Traseira gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: bx0 + Tg, y: yBox + lenC - Tg, z: zBox, dx: bW - 2 * Tg, dy: Tg, dz: hbG, veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: obsG });
            fab.chapa({ nome: 'Fundo gaveta', grupo: 'gaveta', mat: 'fundoGaveta', eixoEsp: 'z', x: bx0 + Tg - 8, y: yBox + Tg - 8, z: zBox + 10, dx: bW - 2 * Tg + 16, dy: lenC - 2 * Tg + 16, dz: Fg, fitas: [], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: nomeG + ' · rasgo 8 mm' });
            if (oculta) {
              // corrediça oculta (tipo Tandem): trilho fixo em "L" na lateral do móvel e trilho móvel em "U"
              // sob a lateral da gaveta (folga de 5 mm de cada lado)
              [[vm.il, 1], [vm.ir, -1]].forEach(function (ld) {
                var lw = clear + Tg, sgo = ld[1];
                var xF = sgo > 0 ? ld[0] : ld[0] - lw;
                var ptsL = [[0, 0], [lw, 0], [lw, 1.5], [1.5, 1.5], [1.5, 12], [0, 12]];
                if (sgo < 0) ptsL = ptsL.map(function (q) { return [r1(lw - q[0]), q[1]]; });
                fab.objeto({ nome: 'Corrediça oculta (trilho fixo)', grupo: 'ferragem', mat: 'metal', x: xF, y: yBox, z: zBox - 12.5, dx: lw, dy: lenC, dz: 12, vao: vi, col: colIdx0, secao: j, forma: { plano: 'xz', pts: ptsL } });
                var xM = sgo > 0 ? ld[0] + clear : ld[0] - clear - Tg;
                fab.objeto({ nome: 'Corrediça oculta (trilho móvel)', grupo: 'ferragem', mat: 'metal', x: xM, y: yBox, z: zBox - 10.5, dx: Tg, dy: lenC, dz: 10, conj: cjG, vao: vi, col: colIdx0, secao: j,
                  forma: { plano: 'xz', pts: [[0, 0], [Tg, 0], [Tg, 10], [r1(Tg - 1.2), 10], [r1(Tg - 1.2), 1.2], [1.2, 1.2], [1.2, 10], [0, 10]] } });
              });
            } else corredicasVisuais(vm.il, vm.ir, zBox + Math.max(4, (hbG - Math.min(45, hbG - 10)) / 2), yBox, lenC, cjG, refs, hbG - 10);

            if (temInterna) {
              // gaveta interna oculta: presa nas laterais do móvel, acima da caixa do gavetão e atrás da frente dele.
              // Só abre com o gavetão aberto e para 20 mm antes da frente do gavetão.
              var yI = yBox + 15;
              var lenI = compCorredica(profUtil - yI - 10);
              var zI = zBox + hbG + 25;
              var ix0 = vm.il + 12.5, ix1 = vm.ir - 12.5, iW = ix1 - ix0;
              var cursoG = Math.round(lenC * 0.85);
              var cursoI = Math.round(Math.min(lenI * 0.85, cursoG + yI - (reg.y0 < 0 ? 0 : reg.y0) - 20));
              if (lenI && cursoI > 80) {
                var cjI = fab.conjunto({ nome: 'Gaveta interna ' + seqGav, tipo: 'corre', curso: cursoI, requer: cjG, vao: vi, col: colIdx0, secao: j });
                cont.corredicas[lenI] = (cont.corredicas[lenI] || 0) + 1;
                var oi = 'Gaveta interna do ' + nomeG.toLowerCase();
                fab.chapa({ nome: 'Lateral gaveta interna', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: ix0, y: yI, z: zI, dx: Tg, dy: lenI, dz: hI, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjI, obs: oi });
                fab.chapa({ nome: 'Lateral gaveta interna', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: ix1 - Tg, y: yI, z: zI, dx: Tg, dy: lenI, dz: hI, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjI, obs: oi });
                fab.chapa({ nome: 'Frente gaveta interna', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: ix0 + Tg, y: yI, z: zI, dx: iW - 2 * Tg, dy: Tg, dz: hI, veio: 'x', fitas: ['x', 'x'], vao: vi, col: colIdx0, secao: j, conj: cjI, obs: oi });
                fab.chapa({ nome: 'Traseira gaveta interna', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: ix0 + Tg, y: yI + lenI - Tg, z: zI, dx: iW - 2 * Tg, dy: Tg, dz: hI, veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, conj: cjI, obs: oi });
                fab.chapa({ nome: 'Fundo gaveta interna', grupo: 'gaveta', mat: 'fundoGaveta', eixoEsp: 'z', x: ix0 + Tg - 8, y: yI + Tg - 8, z: zI + 8, dx: iW - 2 * Tg + 16, dy: lenI - 2 * Tg + 16, dz: Fg, fitas: [], vao: vi, col: colIdx0, secao: j, conj: cjI, obs: oi });
                corredicasVisuais(vm.il, vm.ir, zI + 8, yI, lenI, cjI, refs, hI - 16);
                R.elementos.push({ tipo: 'interna', nome: 'Gaveta interna oculta', col: colIdx0, frenteW: regW, frenteH: fh, alturaInterna: hI, larguraInterna: iW, corredica: lenC, corredicaInterna: lenI,
                  texto: 'Fica atrás da frente do gavetão, presa nas laterais do móvel com corrediças próprias (' + lenI + ' mm). Abre depois do gavetão e para 20 mm antes da frente dele. Recuo de 15 mm.' });
                info(rot + ': gavetão com gaveta interna — a interna (80 mm) fica presa nas laterais, acima da caixa do gavetão, e só abre com ele aberto.', ref);
              } else aviso(rot + ': o gavetão não tem profundidade para gaveta interna.', ref);
            }
          }
        }

        // ------------------------------------------------ TEMPEROS / FRUTEIRA / LIXEIRA (aramados de correr)
        else if (cfg.tipo === 'temperos' || cfg.tipo === 'fruteira' || cfg.tipo === 'lixeira') {
          puxadorConta();
          var lenA = compCorredica(profUtil - yInt - 10);
          if (!lenA) erro(rot + ': profundidade insuficiente para aramado de correr.', ref);
          var nomeA = { temperos: 'Porta-temperos', fruteira: 'Fruteira', lixeira: 'Lixeira' }[cfg.tipo];
          var cjA = fab.conjunto({ nome: nomeA, tipo: 'corre', curso: Math.round(lenA * 0.85), vao: vi, col: colIdx0, secao: j });
          var fa = frente({ nome: 'Frente ' + nomeA.toLowerCase(), x: reg.x0, y0: reg.y0, z: reg.z0, w: regW, h: regH, veio: veioF,
            vao: vi, col: colIdx0, secao: j, conj: cjA, obs: nomeA + ' de correr', meta: { tipo: cfg.tipo } });
          aplicarPuxador(fa, { x: reg.x0, z: reg.z0, w: regW, h: regH, y0: reg.y0, conj: cjA, tipoFrente: 'gaveta', vao: vi, col: colIdx0, secao: j });
          if (lenA) {
            cont.corredicas[lenA] = (cont.corredicas[lenA] || 0) + 1;
            var ax0 = vm.il + 12.5, ax1 = vm.ir - 12.5, aW = ax1 - ax0;
            corredicasVisuais(vm.il, vm.ir, sm.ib + 15, yInt, lenA, cjA, refs);
            if (cfg.tipo === 'lixeira') {
              var nb = Math.max(1, Math.min(2, cfg.baldes || 1));
              var hBalde = Math.min(itCorre - sm.ib - 80, 420);
              var bwid = (aW - 30 - (nb - 1) * 10) / nb;
              var bdep = Math.min(lenA - 40, 330);
              var litrosTot = 0;
              for (var b = 0; b < nb; b++) {
                var litros = Math.round(bwid * bdep * hBalde / 1e6 * 0.85);
                litrosTot += litros;
                var bxl = ax0 + 15 + b * (bwid + 10);
                fab.objeto({ nome: 'Cesto lixeira ' + litros + ' L', grupo: 'ferragem', mat: 'plastico', x: bxl + 4, y: yInt + 34, z: sm.ib + 46, dx: bwid - 8, dy: bdep - 8, dz: hBalde - 14, conj: cjA, vao: vi, col: colIdx0, secao: j });
                fab.objeto({ nome: 'Aba do cesto lixeira', grupo: 'ferragem', mat: 'plastico', x: bxl, y: yInt + 30, z: sm.ib + 46 + hBalde - 14, dx: bwid, dy: bdep, dz: 12, conj: cjA, vao: vi, col: colIdx0, secao: j });
                cont.lixeiras.push(litros);
              }
              // base aramada: dois trilhos laterais sobre as corrediças e varões transversais que seguram os cestos
              var rA = { grupo: 'ferragem', mat: 'aramado', conj: cjA, vao: vi, col: colIdx0, secao: j };
              fab.objeto(Object.assign({ nome: 'Trilho aramado', x: ax0, y: yInt + 10, z: sm.ib + 30, dx: 10, dy: lenA - 20, dz: 10 }, rA));
              fab.objeto(Object.assign({ nome: 'Trilho aramado', x: ax1 - 10, y: yInt + 10, z: sm.ib + 30, dx: 10, dy: lenA - 20, dz: 10 }, rA));
              for (var tv2 = 0; tv2 < 4; tv2++) fab.objeto(Object.assign({ nome: 'Varão aramado', x: ax0 + 10, y: yInt + 25 + (lenA - 60) * tv2 / 3, z: sm.ib + 34, dx: aW - 20, dy: 5, dz: 5 }, rA));
              R.elementos.push({ tipo: 'lixeira', nome: 'Lixeira embutida', col: colIdx0, frenteW: regW, frenteH: regH, baldes: nb, litros: litrosTot, alturaBalde: hBalde, corredica: lenA,
                texto: nb + ' cesto(s) com tampa basculante, total ~' + litrosTot + ' L; corrediça de extração total de ' + lenA + ' mm. Não instalar sob a cuba sem conferir sifão e registros.' });
              if (sm.altInt < 450) aviso(rot + ': lixeira com só ' + fmtCm(sm.altInt) + ' de altura interna (cestos comuns pedem ≥ 45 cm).', ref);
              if (vm.largInt < 300) aviso(rot + ': lixeira em vão de ' + fmtCm(vm.largInt) + ' interno (mín. ~30 cm).', ref);
            } else {
              var nc = Math.max(1, Math.min(6, cfg.cestos || 3));
              var hCesto = cfg.tipo === 'fruteira' ? 140 : 90;
              var vaoLiv = itCorre - sm.ib - 60;
              var rT = { grupo: 'ferragem', mat: 'aramado', conj: cjA, vao: vi, col: colIdx0, secao: j };
              var zQ0 = sm.ib + 15, zQ1 = itCorre - 30, hQ = zQ1 - zQ0;
              var yQf = yInt + 4, yQt = yInt + lenA - 14;
              // quadros (frontal, preso atrás da frente, e traseiro): dois montantes + travessas em cima e embaixo
              [yQf, yQt].forEach(function (yq) {
                fab.objeto(Object.assign({ nome: 'Montante aramado', x: ax0, y: yq, z: zQ0, dx: 10, dy: 10, dz: hQ }, rT));
                fab.objeto(Object.assign({ nome: 'Montante aramado', x: ax1 - 10, y: yq, z: zQ0, dx: 10, dy: 10, dz: hQ }, rT));
                fab.objeto(Object.assign({ nome: 'Travessa aramado', x: ax0 + 10, y: yq, z: zQ1 - 10, dx: aW - 20, dy: 10, dz: 10 }, rT));
                fab.objeto(Object.assign({ nome: 'Travessa aramado', x: ax0 + 10, y: yq, z: zQ0, dx: aW - 20, dy: 10, dz: 10 }, rT));
              });
              // trilhos inferiores ligando os quadros (correm sobre as corrediças)
              fab.objeto(Object.assign({ nome: 'Trilho aramado', x: ax0, y: yQf + 10, z: zQ0, dx: 10, dy: yQt - yQf - 10, dz: 10 }, rT));
              fab.objeto(Object.assign({ nome: 'Trilho aramado', x: ax1 - 10, y: yQf + 10, z: zQ0, dx: 10, dy: yQt - yQf - 10, dz: 10 }, rT));
              var bordaC = cfg.tipo === 'fruteira' ? 110 : 60;
              var cx0 = ax0 + 12, cx1 = ax1 - 12, cW = cx1 - cx0, cy0 = yQf + 12, cy1 = yQt - 2, cL = cy1 - cy0;
              var nVar = Math.max(3, Math.floor(cW / 22));
              for (var cc2 = 0; cc2 < nc; cc2++) {
                var zc2 = zQ0 + 20 + (vaoLiv - hCesto) * (nc === 1 ? 0 : cc2 / (nc - 1));
                // fundo: varões no sentido da profundidade, sobre duas travessas
                fab.objeto(Object.assign({ nome: 'Travessa do cesto', x: cx0, y: cy0 + 10, z: zc2, dx: cW, dy: 5, dz: 5 }, rT));
                fab.objeto(Object.assign({ nome: 'Travessa do cesto', x: cx0, y: cy1 - 15, z: zc2, dx: cW, dy: 5, dz: 5 }, rT));
                for (var vv = 0; vv < (spec.leve ? 0 : nVar); vv++) fab.objeto(Object.assign({ nome: 'Varão do cesto', x: cx0 + 2 + (cW - 8) * vv / (nVar - 1), y: cy0, z: zc2 + 5, dx: 4, dy: cL, dz: 4 }, rT));
                // borda: grade baixa nas laterais, mais alta na frente e atrás (segura os frascos)
                fab.objeto(Object.assign({ nome: 'Borda do cesto', x: cx0, y: cy0, z: zc2 + 5, dx: 5, dy: cL, dz: bordaC * 0.6 }, rT));
                fab.objeto(Object.assign({ nome: 'Borda do cesto', x: cx1 - 5, y: cy0, z: zc2 + 5, dx: 5, dy: cL, dz: bordaC * 0.6 }, rT));
                fab.objeto(Object.assign({ nome: 'Borda do cesto', x: cx0 + 5, y: cy0, z: zc2 + 5, dx: cW - 10, dy: 5, dz: bordaC }, rT));
                fab.objeto(Object.assign({ nome: 'Borda do cesto', x: cx0 + 5, y: cy1 - 5, z: zc2 + 5, dx: cW - 10, dy: 5, dz: bordaC }, rT));
              }
              if (cfg.tipo === 'temperos') { cont.temperos++; if (vm.largInt > 350) dica(rot + ': porta-temperos costuma ter 15–30 cm de largura.', ref); if (vm.largInt < 120) aviso(rot + ': porta-temperos com ' + fmtCm(vm.largInt) + ' interno é estreito demais.', ref); }
              else cont.fruteiras++;
              R.elementos.push({ tipo: cfg.tipo, nome: nomeA, col: colIdx0, frenteW: regW, frenteH: regH, cestos: nc, corredica: lenA,
                texto: nc + ' cesto(s) aramado(s) cromado(s); corrediça de extração total de ' + lenA + ' mm, montada no fundo/lateral.' + (cfg.tipo === 'temperos' ? ' Frasco de até ~' + Math.round(vaoLiv / nc - 20) + ' mm de altura por nível.' : '') });
            }
          }
        }

        // ------------------------------------------------ NICHOS
        else if (cfg.tipo === 'nicho') {
          interior();
          if (cfg.moldura) {
            var mw = 40;
            var mx0 = vm.x0 + (extEsq ? 0 : 0), mx1 = vm.x1;
            var mz0 = sm.z0, mz1 = sm.z1;
            var mwE = extEsq ? mw : mw / 2, mwD = extDir ? mw : mw / 2, mwB = extBaixo ? mw : mw / 2, mwT = extTopo ? mw : mw / 2;
            fab.chapa({ nome: 'Moldura horizontal', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: mx0, y: -Tf, z: mz1 - mwT, dx: mx1 - mx0, dy: Tf, dz: mwT, veio: 'x', fitas: ['x', 'x'], vao: vi, col: colIdx0, secao: j });
            fab.chapa({ nome: 'Moldura horizontal', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: mx0, y: -Tf, z: mz0, dx: mx1 - mx0, dy: Tf, dz: mwB, veio: 'x', fitas: ['x', 'x'], vao: vi, col: colIdx0, secao: j });
            fab.chapa({ nome: 'Moldura vertical', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: mx0, y: -Tf, z: mz0 + mwB, dx: mwE, dy: Tf, dz: mz1 - mz0 - mwB - mwT, veio: 'z', fitas: ['z', 'z'], vao: vi, col: colIdx0, secao: j });
            fab.chapa({ nome: 'Moldura vertical', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: mx1 - mwD, y: -Tf, z: mz0 + mwB, dx: mwD, dy: Tf, dz: mz1 - mz0 - mwB - mwT, veio: 'z', fitas: ['z', 'z'], vao: vi, col: colIdx0, secao: j });
          }
        }
        else if (cfg.tipo === 'arco' || cfg.tipo === 'espelho') {
          var aw = vm.largInt;
          var rr = aw / 2;
          var ah = Math.min(sm.altInt, rr + 80);
          var nSeg = 24;
          var pts = [[0, 0]];
          for (var sgi = 1; sgi < nSeg; sgi++) {
            var ang = Math.PI - Math.PI * sgi / nSeg;
            pts.push([r1(rr + rr * Math.cos(ang)), r1(rr * Math.sin(ang))]);
          }
          pts.push([aw, 0], [aw, ah], [0, ah]);
          fab.chapa({ nome: 'Arco frontal', grupo: 'caixa', mat: matExt, eixoEsp: 'y', x: vm.il, y: yInt, z: sm.it - ah, dx: aw, dy: T, dz: ah, veio: 'x', fitas: [],
            vao: vi, col: colIdx0, secao: j, forma: { plano: 'xz', pts: pts, arco: true }, obs: 'Usinado em CNC (raio ' + fmtMm(rr) + ')' });
          if (cfg.tipo === 'espelho') {
            var ez0 = sm.ib + 20, ez1 = sm.it - 4;
            var eh = ez1 - ez0, ew = aw - 8;
            var er = ew / 2, ebase = eh - er;
            // garante polígono (0,0) -> (ew,0) -> arco de (ew,ebase) até (0,ebase)
            var poly = [[0, 0], [ew, 0]];
            for (var sk = 0; sk <= nSeg; sk++) { var a3 = Math.PI * sk / nSeg; poly.push([r1(er + er * Math.cos(a3)), r1(ebase + er * Math.sin(a3))]); }
            fab.objeto({ nome: 'Espelho em arco 4 mm', grupo: 'ferragem', mat: 'espelho', x: vm.il + 4, y: profUtil - 6, z: ez0, dx: ew, dy: 4, dz: eh, vao: vi, col: colIdx0, secao: j,
              forma: { plano: 'xz', pts: poly, arco: true }, obs: 'Espelho lapidado colado no fundo' });
            cont.espelhoM2 += ew * eh / 1e6;
          } else {
            prateleirasMoveis(Math.min(cfg.prateleiras, Math.max(0, Math.floor((sm.altInt - ah) / 250))), sm.it - ah);
          }
        }
        else if (cfg.tipo === 'painel') {
          fab.chapa({ nome: 'Painel', grupo: 'frente', mat: 'frente', eixoEsp: 'y', x: vm.il, y: profUtil - Tf, z: sm.ib, dx: vm.largInt, dy: Tf, dz: sm.altInt, veio: veioF, fitas: [], vao: vi, col: colIdx0, secao: j, obs: 'Painel de fundo no material das frentes' });
        }
        else if (cfg.tipo === 'forno') {
          if (vm.largInt < 560) aviso(rot + ': nicho de forno com ' + fmtCm(vm.largInt) + ' de largura interna — fornos de embutir pedem em geral 56–57 cm.', ref);
          if (sm.altInt < 585) aviso(rot + ': nicho de forno com ' + fmtCm(sm.altInt) + ' de altura interna — o padrão é ~59–60 cm.', ref);
          if (profUtil < 550) aviso(rot + ': profundidade útil de ' + fmtCm(profUtil) + ' pode ser insuficiente para forno (≥ 55 cm).', ref);
          R.eletros.push({ tipo: 'Forno de embutir', col: colIdx0, largura: vm.largInt, altura: sm.altInt, prof: profUtil, recomendado: '560–570 × 590–600 × ≥ 550 mm', obs: 'Respiro atrás/abaixo; tomada 20 A ao lado do nicho' });
        }
        else if (cfg.tipo === 'livre') {
          if (j !== 0) erro(rot + ': o vão livre precisa ser a faixa de baixo da coluna (ele vai até o piso).', ref);
          if (spec.tipo === 'escrivaninha') {
            if (vm.largInt < 600) aviso(rot + ': vão para as pernas com ' + fmtCm(vm.largInt) + '. O recomendado é pelo menos 60 cm (ideal 80 cm), para a cadeira entrar e as pernas não baterem nas laterais.', ref);
            if (sm.it < 650) aviso(rot + ': altura livre de ' + fmtCm(sm.it) + ' embaixo do tampo. Escrivaninha pede 65–70 cm livres para as pernas e o braço da cadeira.', ref);
            if (H < 700 || H > 780) dica('Escrivaninha com ' + fmtCm(H) + ' de altura: o confortável para trabalhar é entre 72 e 76 cm (tampo pronto).');
          }
        }
        else if (cfg.tipo === 'geladeira') {
          var ge = cfg.eletro || { largura: 700, altura: 1800, profundidade: 700 };
          var livreH = sm.it; // vai até o piso
          var folgaL = (vm.largInt - ge.largura) / 2, folgaT = livreH - ge.altura;
          if (j !== 0) erro(rot + ': o nicho de geladeira precisa ser a faixa de baixo da coluna (a geladeira apoia no piso).', ref);
          if (folgaL < 0) erro(rot + ': geladeira de ' + fmtCm(ge.largura) + ' não cabe no vão de ' + fmtCm(vm.largInt) + '.', ref);
          else if (folgaL < 20) aviso(rot + ': folga lateral de ' + fmtCm(folgaL) + ' de cada lado — deixe pelo menos 2 cm (e confira o manual do aparelho).', ref);
          if (folgaT < 0) erro(rot + ': geladeira de ' + fmtCm(ge.altura) + ' de altura não cabe (vão livre ' + fmtCm(livreH) + ').', ref);
          else if (folgaT < 50) aviso(rot + ': folga em cima de ' + fmtCm(folgaT) + ' — deixe pelo menos 5 cm para ventilação.', ref);
          if (ge.profundidade > D) info(rot + ': a geladeira (' + fmtCm(ge.profundidade) + ' de profundidade) fica ' + fmtCm(ge.profundidade + 50 - D) + ' à frente do móvel, contando 5 cm atrás para ventilação.', ref);
          dica(rot + ': do lado da dobradiça da geladeira, deixe espaço para a porta abrir 90° e as gavetas internas saírem (confira no manual).', ref);
          R.eletros.push({ tipo: 'Geladeira', col: colIdx0, largura: vm.largInt, altura: livreH, prof: D, aparelho: ge, folgaLateral: folgaL, folgaTopo: folgaT,
            recomendado: 'aparelho + 2 cm de cada lado e + 5 cm em cima', obs: 'Sem base nem rodapé no nicho; tomada a 20–30 cm do piso, atrás, fora do eixo do compressor.' });
        }
        else if (cfg.tipo === 'micro') {
          if (sm.altInt < 380) aviso(rot + ': nicho de micro-ondas com ' + fmtCm(sm.altInt) + ' de altura interna (comum 38–46 cm).', ref);
          if (vm.largInt < 500) aviso(rot + ': nicho de micro-ondas com ' + fmtCm(vm.largInt) + ' de largura interna (comum ≥ 50 cm).', ref);
          R.eletros.push({ tipo: 'Micro-ondas', col: colIdx0, largura: vm.largInt, altura: sm.altInt, prof: profUtil, recomendado: '≥ 500 × 380–460 mm', obs: 'Deixe ~5 cm livres atrás/acima para ventilação; tomada acessível' });
        }
      });
    });

    if (vaosLargosPrat.length) {
      var uq = vaosLargosPrat.filter(function (v, k, a) { return a.indexOf(v) === k; });
      aviso('Prateleira com vão livre acima de 80 cm (coluna ' + uq.map(function (v) { return v + 1; }).join(', ') + '). Por quê: MDF 18 mm com livros ou louça faz barriga com o tempo. Adicione divisória ou use 25 mm.');
    }
    if (temTravCava) {
      // só atrás das colunas que têm frente na faixa de cima (porta, gaveta, aramado...)
      var comFrente = { portas: 1, gavetas: 1, basculante: 1, temperos: 1, lixeira: 1, fruteira: 1 };
      var trechos = [], tr0 = null;
      vaosM.forEach(function (vm) {
        var top = vm.secoes[vm.secoes.length - 1];
        if (comFrente[top.cfg.tipo]) {
          var a0 = Math.max(T, vm.x0), a1 = Math.min(L - T, vm.x1);
          if (tr0 && Math.abs(tr0[1] - a0) < 0.01) tr0[1] = a1; else { tr0 = [a0, a1]; trechos.push(tr0); }
        } else tr0 = null;
      });
      trechos.forEach(function (tq) {
        var tc = dividirSobreApoios(tq[0], tq[1], divs, maxEmenda);
        tc.pedacos.forEach(function (pc) {
          fab.chapa({ nome: 'Travessa da cava', grupo: 'caixa', mat: matInt, eixoEsp: 'y', x: pc[0], y: yInt + 2, z: topoTravCava, dx: pc[1] - pc[0], dy: T, dz: 76, veio: 'x', fitas: ['x'], obs: (pc[1] - pc[0]) > usavelC ? 'Peça de chapa emendada' : 'Fecha o vão da cava' });
        });
      });
    }

    // ================================================================
    // BASE / RODAPÉ / PÉS / RODA-TETO
    // ================================================================
    var nPes = 0;
    if (temBase) {
      var rec = spec.base.recuo;
      if (bt === 'rodape') {
        var rdDiv = dividirSobreApoios(0, L, divs, maxEmenda);
        tirarSemBase(rdDiv.pedacos).forEach(function (pc) {
          fab.chapa({ nome: 'Rodapé frontal', grupo: 'rodape', mat: matExt, eixoEsp: 'y', x: pc[0], y: rec, z: 0, dx: pc[1] - pc[0], dy: T, dz: z0, veio: 'x', fitas: ['x'] });
        });
        tirarSemBase(L > usavelC ? [[0, usavelC], [usavelC, L]] : [[0, L]]).forEach(function (pc) {
          fab.chapa({ nome: 'Rodapé traseiro', grupo: 'rodape', mat: matInt, eixoEsp: 'y', x: pc[0], y: Dc - T - 20, z: 0, dx: pc[1] - pc[0], dy: T, dz: z0, veio: 'x', fitas: [] });
        });
        var apoiosX = [0].concat(divs.map(function (d) { return d - T / 2; })).concat([L - T]);
        apoiosX.forEach(function (ax) {
          fab.chapa({ nome: 'Travessa de rodapé', grupo: 'rodape', mat: matInt, eixoEsp: 'x', x: ax, y: rec + T, z: 0, dx: T, dy: Dc - T - 20 - rec - T, dz: z0, veio: 'y', fitas: [] });
        });
        if (spec.ambiente === 'cozinha' && (z0 < 80 || rec < 40)) dica('Cozinha: sóculo de ~10 × 10 cm (altura × recuo) evita chutes e facilita a limpeza.');
      } else {
        nPes = 2 * (divs.length + 2);
        var pxs = [T / 2].concat(divs).concat([L - T / 2]);
        pxs.forEach(function (px) {
          [rec + 40, Dc - 60].forEach(function (py) {
            fab.objeto({ nome: 'Pé regulável', grupo: 'ferragem', mat: 'plastico', x: px - 20, y: py - 20, z: 0, dx: 40, dy: 40, dz: z0 });
          });
        });
        tirarSemBase(L > usavelC ? [[0, usavelC], [usavelC, L]] : [[0, L]]).forEach(function (pc) {
          fab.chapa({ nome: 'Saia de rodapé', grupo: 'rodape', mat: matExt, eixoEsp: 'y', x: pc[0], y: rec, z: 0, dx: pc[1] - pc[0], dy: T, dz: z0 - 5, veio: 'x', fitas: ['x'], obs: 'Fixada com clipes nos pés' });
        });
        info(nPes + ' pés reguláveis (um em cada canto de lateral/divisória) com saia de rodapé clipada.');
      }
    }
    if (bt === 'suspenso') {
      if (tipo === 'balcao' || tipo === 'gabinete') info('Móvel suspenso: fixe na parede com suporte oculto/cantoneira reforçada e confira a alvenaria.');
    }
    if (hRT) {
      var rtr = spec.rodaTeto.recuo;
      var rtDiv = dividirSobreApoios(0, L, divs, maxEmenda);
      rtDiv.pedacos.forEach(function (pc) {
        fab.chapa({ nome: 'Roda-teto', grupo: 'rodape', mat: matExt, eixoEsp: 'y', x: pc[0], y: rtr, z: zTop, dx: pc[1] - pc[0], dy: T, dz: hRT, veio: 'x', fitas: ['x'] });
      });
      [0, L - T].forEach(function (x) {
        fab.chapa({ nome: 'Apoio roda-teto', grupo: 'rodape', mat: matInt, eixoEsp: 'x', x: x, y: rtr + T, z: zTop, dx: T, dy: Math.max(50, Dc - rtr - T - 20), dz: hRT, veio: 'y', fitas: [] });
      });
      dica('Roda-teto de ' + fmtCm(hRT) + ': deixe folga para nivelar com o forro e acabamento recortado no local.');
    }

    // ================================================================
    // ILUMINAÇÃO (fita de LED em perfil de alumínio)
    // ================================================================
    if (led.ativo) {
      var corLed = TEMP_LED[led.temperatura] || TEMP_LED[4000];
      MATERIAIS_FIXOS.led = { nome: 'LED ' + led.temperatura + 'K', cor: corLed };
      var ledW = 12, ledH = led.tipo === 'embutido' ? 10 : 8;
      var yLed = function (y0, prof) { return led.posicao === 'frente' ? y0 + 40 : (led.posicao === 'meio' ? y0 + prof / 2 - ledW / 2 : y0 + prof - 20 - ledW); };
      var trechosLed = [];
      if (led.local === 'base') {
        trechosLed.push({ x0: T + 20, x1: L - T - 20, zFace: z0 + (temBase ? T : 0), y0: 0, prof: Dc, nome: 'sob o móvel' });
        if (temBase) trechosLed[0].zFace = z0; // com rodapé, o perfil fica sob a base, aparente acima do rodapé
      } else {
        vaosM.forEach(function (vm) {
          vm.secoes.forEach(function (sm) {
            if (!/nicho|arco|painel/.test(sm.cfg.tipo)) return;
            var tetos = [sm.it];
            fab.lista.forEach(function (p) { if ((p.nome === 'Prateleira' || p.nome === 'Prateleira fixa') && p.col === vm.colunas[0].idx && p.secao === sm.idx) tetos.push(p.z); });
            tetos.forEach(function (zt) { trechosLed.push({ x0: vm.il + 20, x1: vm.ir - 20, zFace: zt, y0: yInt, prof: profUtil - yInt, teto: true, col: vm.colunas[0].idx }); });
          });
        });
      }
      trechosLed.forEach(function (tq) {
        if (tq.x1 - tq.x0 < 80) return;
        var zl = led.tipo === 'embutido' ? (tq.teto ? tq.zFace - ledH : tq.zFace) : (tq.teto ? tq.zFace - ledH : tq.zFace - ledH);
        if (!tq.teto && led.tipo === 'embutido') zl = tq.zFace; // rasgo na face de baixo da base
        fab.objeto({ nome: 'Perfil LED', grupo: 'led', mat: 'led', x: tq.x0, y: yLed(tq.y0, tq.prof), z: zl, dx: tq.x1 - tq.x0, dy: ledW, dz: ledH, col: tq.col,
          obs: 'Fita ' + led.temperatura + 'K em perfil ' + (led.tipo === 'embutido' ? 'embutido (rasgo 12 × 10 mm)' : 'sobreposto') + ' com difusor leitoso' });
        cont.ledMm += tq.x1 - tq.x0;
      });
      if (cont.ledMm) {
        R.elementos.push({ tipo: 'led', nome: 'Perfil de LED ' + (led.tipo === 'embutido' ? 'embutido' : 'sobreposto'), col: null,
          local: led.local === 'base' ? 'Embaixo do móvel' : 'Sob as prateleiras dos nichos', posicao: led.posicao, temperatura: led.temperatura, montagem: led.tipo, metros: Math.round(cont.ledMm / 100) / 10,
          texto: (led.posicao === 'fundo' ? 'A 20 mm da borda do fundo: lava a parede e valoriza o revestimento. ' : led.posicao === 'frente' ? 'A 40 mm da frente: luz de tarefa sobre a bancada. ' : 'No meio da profundidade: luz difusa. ') +
            (led.tipo === 'embutido' ? 'Rasgo de 12 × 10 mm na face de baixo, parando 20 mm antes das laterais; perfil de alumínio rente à face, com difusor leitoso.' : 'Perfil sobreposto colado na face de baixo, com difusor leitoso.') });
        info('Iluminação: fita de LED ' + led.temperatura + 'K (' + (Math.round(cont.ledMm / 100) / 10).toString().replace('.', ',') + ' m) — prever a fonte (driver) em local ventilado e acessível e a passagem do fio pelo fundo.');
      }
    }

    // ================================================================
    // PEDRA
    // ================================================================
    if (spec.pedra.ativa && (tipo === 'balcao' || tipo === 'gabinete')) {
      var p = spec.pedra;
      var yp0 = frenteY0 - p.avancoFrente;
      fab.objeto({ nome: 'Pedra / bancada', grupo: 'pedra', mat: 'pedra', x: -p.avancoLados, y: yp0, z: H, dx: L + 2 * p.avancoLados, dy: D - yp0, dz: p.espessura, obs: cubaAtiva ? 'Com recorte para cuba' : '' });
    }
    var tampo = spec.pedra.ativa ? spec.pedra.espessura : 0;
    var bancada = H + tampo + (spec.base.tipo === 'suspenso' ? spec.elevacao : 0);
    if (tipo === 'balcao') {
      if (!spec.pedra.ativa && (H < 830 || H > 930)) aviso('Altura de ' + fmtCm(H) + ': a bancada pronta (com o tampo) costuma ficar entre 85 e 95 cm, conforme a estatura do usuário.');
      else if (spec.pedra.ativa && (bancada < 850 || bancada > 950)) aviso('Altura final da bancada: ' + fmtCm(bancada) + ' (o confortável fica entre 85 e 95 cm).');
    }
    if (tipo === 'gabinete' && spec.pedra.ativa && (bancada < 780 || bancada > 950)) aviso('Altura final do tampo do banheiro: ' + fmtCm(bancada) + ' (usual 80–92 cm).');
    if (tipo === 'balcao' && D < 500) aviso('Balcão com ' + fmtCm(D) + ' de profundidade (recomendado 55–60 cm). Por quê: cooktop, cuba e eletros de embutir pedem 55 cm ou mais, e a bancada fica estreita para trabalhar.');
    if (tipo === 'aereo') {
      if (D > 400) aviso('Aéreo com ' + fmtCm(D) + ' de profundidade (recomendado 30–35 cm). Por quê: acima de 40 cm a pessoa bate a cabeça ao usar a bancada e a luz do teto não chega nela.');
      if (spec.elevacao > 0 && spec.elevacao < 1400) aviso('Aéreo a ' + fmtCm(spec.elevacao) + ' do piso (recomendado 145–155 cm). Por quê: fica a menos de 50 cm de uma bancada de 90 cm, sem espaço para cafeteira, liquidificador e para trabalhar.');
    }
    if (tipo === 'roupeiro' && D < 550) aviso('Guarda-roupa com ' + fmtCm(D) + ' de profundidade (recomendado 60 cm). Por quê: o cabide tem uns 45 cm e a roupa precisa de folga para não amassar na porta.');
    if ((spec.ambiente === 'banheiro' || spec.ambiente === 'lavanderia' || spec.ambiente === 'cozinha') && fundoTipo === 'sobreposto' && cubaAtiva) dica('Área molhada: prefira fita de borda selada e MDF RU nos módulos próximos à água.');

    // mensagens de frentes / ferragens
    if (cont.portas || cont.basculantes) {
      if (embutida) info('Portas embutidas (internas à caixaria): dobradiça super curva, folga de ' + fr.folgaEmbutida + ' mm no contorno.');
      else {
        var partes = [];
        if (cont.dobradicas.reta) partes.push('reta (a porta cobre a lateral)');
        if (cont.dobradicas.curva) partes.push('curva (divide divisória/prateleira com outra frente)');
        info('Portas sobrepostas: dobradiça ' + partes.join(' e ') + '.');
      }
    }
    if (cont.gavetas) {
      info('Gavetas com corrediça ' + (spec.gavetas.corredica === 'oculta' ? 'oculta com amortecedor (5 mm de cada lado)' : 'telescópica (12,5 mm de cada lado)') + '.');
    }
    if (pux.tipo === 'cava') info('Puxador cava 45° usinada nas frentes' + (tipo === 'balcao' ? ' com travessa da cava atrás' : '') + ' (frentes de no mínimo 18 mm).');
    if (pux.tipo === 'toque') info('Abertura por toque: um fecho toque por porta/gaveta; dobradiças e corrediças sem amortecedor.');

    // peças que não cabem
    var longas = [];
    fab.lista.forEach(function (pc) {
      if (!pc.cortavel) return;
      var c = pc.corte;
      var cabe = (c.c <= usavelC && c.l <= usavelL) || (!pc.veio && c.c <= usavelL && c.l <= usavelC);
      pc.emenda = !cabe;
      if (!cabe && pc.nome.indexOf('Base') !== 0 && longas.indexOf(pc.nome) < 0) longas.push(pc.nome);
    });
    if (!spec.leve && fab.lista.length > 600) info('Móvel com ' + fab.lista.length + ' peças: para o SketchUp ficar leve, ligue o "modo leve" na aba Detalhes (ferragens simplificadas, mesmo detalhamento nas pranchas).');
    if (longas.length) aviso((longas.length === 1 ? longas[0] + ' também passa' : longas.join(', ') + ' também passam') + ' da chapa ' + fmtCm(spec.chapa.comprimento) + ' × ' + fmtCm(spec.chapa.largura) + ' — peças de chapa emendada.');
    // remove avisos repetidos idênticos
    var vistos = {};
    for (var ai = avisos.length - 1; ai >= 0; ai--) { var k = avisos[ai].nivel + avisos[ai].msg; if (vistos[k]) avisos.splice(ai, 1); else vistos[k] = 1; }

    // ================================================================
    // Ferragens (quantidades)
    // ================================================================
    var fer = [];
    var amort = pux.tipo === 'toque' ? 'sem amortecedor' : 'com amortecedor';
    if (estilo === 'vidro') amort += ' para perfil de alumínio';
    if (cont.dobradicas.reta) fer.push({ item: 'Dobradiça reta 35 mm ' + amort, qtd: cont.dobradicas.reta, un: 'un' });
    if (cont.dobradicas.curva) fer.push({ item: 'Dobradiça curva 35 mm ' + amort, qtd: cont.dobradicas.curva, un: 'un' });
    if (cont.dobradicas.superCurva) fer.push({ item: 'Dobradiça super curva 35 mm ' + amort, qtd: cont.dobradicas.superCurva, un: 'un' });
    var nomeCorr = spec.gavetas.corredica === 'oculta' ? 'Corrediça oculta' : 'Corrediça telescópica';
    Object.keys(cont.corredicas).map(Number).sort(function (a, b) { return a - b; }).forEach(function (len) {
      fer.push({ item: nomeCorr + ' ' + len + ' mm (par)', qtd: cont.corredicas[len], un: 'par' });
    });
    if (cont.pistoes) fer.push({ item: 'Pistão a gás para basculante', qtd: cont.pistoes, un: 'un' });
    if (cont.lixeiras.length) fer.push({ item: 'Lixeira embutida de extração (' + cont.lixeiras.map(function (l) { return l + ' L'; }).join(' + ') + ', tampa basculante)', qtd: 1, un: 'cj' });
    if (cont.temperos) fer.push({ item: 'Porta-temperos aramado cromado', qtd: cont.temperos, un: 'cj' });
    if (cont.fruteiras) fer.push({ item: 'Fruteira aramada de correr', qtd: cont.fruteiras, un: 'cj' });
    if (cont.puxadores) {
      if (pux.tipo === 'alca') fer.push({ item: 'Puxador alça ' + pux.comprimento + ' mm', qtd: cont.puxadores, un: 'un' });
      else if (pux.tipo === 'barra') fer.push({ item: 'Puxador barra longa', qtd: cont.puxadores, un: 'un' });
      else if (pux.tipo === 'botao') fer.push({ item: 'Puxador botão', qtd: cont.puxadores, un: 'un' });
      else if (pux.tipo === 'testeira') fer.push({ item: 'Perfil puxador 45° (testeira) em alumínio', qtd: r1(cont.puxadorPerfilMm / 1000), un: 'm' });
      else if (pux.tipo === 'perfil') fer.push({ item: 'Perfil puxador de alumínio', qtd: r1(cont.puxadorPerfilMm / 1000), un: 'm' });
      else if (pux.tipo === 'passante') fer.push({ item: 'Frentes passantes ' + pux.passa + ' mm (sem puxador)', qtd: cont.puxadores, un: 'frente' });
      else if (pux.tipo === 'cava') fer.push({ item: 'Usinagem cava 45° nas frentes', qtd: cont.puxadores, un: 'frente' });
    }
    if (pux.tipo === 'toque') fer.push({ item: 'Fecho toque (push)', qtd: cont.portas + cont.gavetas + cont.basculantes, un: 'un' });
    if (cont.prateleirasMoveis) fer.push({ item: 'Suporte de prateleira (pino)', qtd: cont.prateleirasMoveis * 4, un: 'un' });
    if (cont.cabideiroMm) { fer.push({ item: 'Tubo cabideiro oblongo', qtd: r1(cont.cabideiroMm / 1000), un: 'm' }); fer.push({ item: 'Suporte de tubo cabideiro', qtd: cont.suportesCabideiro, un: 'un' }); }
    if (cont.vidroM2) { fer.push({ item: 'Perfil de alumínio para porta de vidro', qtd: r1(cont.perfilVidroMm / 1000), un: 'm' }); fer.push({ item: 'Vidro canelado 4 mm', qtd: r1(cont.vidroM2 * 100) / 100, un: 'm²' }); }
    if (cont.ripas) fer.push({ item: 'Ripas ' + ripa.largura + ' × ' + ripa.espessura + ' mm coladas nas frentes', qtd: cont.ripas, un: 'un' });
    if (cont.ledMm) { var mLed = r1(cont.ledMm / 1000); fer.push({ item: 'Fita de LED ' + led.temperatura + 'K 12 V + perfil de alumínio ' + led.tipo + ' com difusor leitoso', qtd: mLed, un: 'm' }); fer.push({ item: 'Fonte (driver) 12 V ' + Math.max(30, Math.ceil(mLed * 9.6 * 1.25 / 10) * 10) + ' W', qtd: 1, un: 'un' }); }
    if (cont.espelhoM2) fer.push({ item: 'Espelho 4 mm lapidado (recorte em arco)', qtd: r1(cont.espelhoM2 * 100) / 100, un: 'm²' });
    if (nPes) fer.push({ item: 'Pé regulável plástico + clipe de rodapé', qtd: nPes, un: 'un' });
    if (spec.topo === 'travessas' && (tipo === 'balcao' || tipo === 'gabinete')) fer.push({ item: 'Cantoneira para fixação do tampo', qtd: Math.max(4, (divs.length + 2) * 2), un: 'un' });
    if (bt === 'suspenso') fer.push({ item: 'Suporte oculto / cantoneira de parede', qtd: Math.max(2, divs.length + 2), un: 'un' });
    var nCx = fab.lista.filter(function (p) { return p.grupo === 'caixa' || p.grupo === 'rodape'; }).length;
    fer.push({ item: 'Parafuso 4,0 × 40 mm (estimativa)', qtd: Math.ceil(nCx * 6 / 10) * 10, un: 'un' });
    R.ferragens = fer;

    return fim();

    function fim() {
      var pecas = fab.lista;
      var frentesP = pecas.filter(function (p) { return p.grupo === 'frente' && p.meta; });
      var nErros = avisos.filter(function (a) { return a.nivel === 'erro'; }).length;
      R.ok = nErros === 0;
      R.resumo = {
        frentes: 1,
        vaos: R.vaos.length || spec.colunas.length,
        colunas: spec.colunas.length,
        portas: frentesP.filter(function (p) { return p.meta.tipo === 'porta'; }).length,
        basculantes: frentesP.filter(function (p) { return p.meta.tipo === 'basculante'; }).length,
        gavetas: frentesP.filter(function (p) { return p.meta.tipo === 'gaveta'; }).length,
        especiais: frentesP.filter(function (p) { return /temperos|lixeira|fruteira/.test(p.meta.tipo); }).length,
        pecas: pecas.filter(function (p) { return p.cortavel; }).length,
        erros: nErros,
        avisos: avisos.filter(function (a) { return a.nivel === 'aviso'; }).length,
        infos: avisos.filter(function (a) { return a.nivel === 'info'; }).length,
        dicas: avisos.filter(function (a) { return a.nivel === 'dica'; }).length,
        frenteMm: L
      };
      var ord = { erro: 0, aviso: 1, info: 2, dica: 3 };
      avisos.sort(function (a, b) { return ord[a.nivel] - ord[b.nivel]; });
      return R;
    }
  }

  // ------------------------------------------------------------------
  // Lista de peças / totais / CSV
  // ------------------------------------------------------------------
  function nomeMaterial(materiais, k) {
    var m = materiais[k] || MATERIAIS_FIXOS[k];
    if (!m) return k;
    return (m.marca && m.marca !== 'Genérico' ? m.marca + ' · ' : '') + m.nome;
  }

  function listaDePecas(pecas, materiais) {
    var grupos = {};
    pecas.forEach(function (p) {
      if (!p.cortavel || !p.corte) return;
      var mn = nomeMaterial(materiais, p.mat);
      var k = [mn, p.corte.e, p.corte.c, p.corte.l, p.fitaC, p.fitaL, p.nome, p.forma ? 'f' : ''].join('|');
      if (!grupos[k]) grupos[k] = { nome: p.nome, mat: p.mat, material: mn, qtd: 0, c: p.corte.c, l: p.corte.l, e: p.corte.e, fitaC: p.fitaC, fitaL: p.fitaL, veio: p.veio, obs: [] };
      grupos[k].qtd++;
      var o = p.obs;
      if (o && /^(Gaveta|Gavetão)( interna)? \d/.test(o)) o = '';
      if (o && /^De abrir/.test(o)) o = o.replace(/ \(\d+ un\)/, '');
      if (o && grupos[k].obs.indexOf(o) < 0 && grupos[k].obs.length < 2) grupos[k].obs.push(o);
    });
    var linhas = Object.keys(grupos).map(function (k) { var x = grupos[k]; x.obs = x.obs.join('; '); return x; });
    var ordem = ['frente', 'caixa', 'caixaInterna', 'gaveta', 'fundo', 'fundoGaveta'];
    linhas.sort(function (a, b) {
      if (a.e !== b.e) return b.e - a.e;
      var ma = ordem.indexOf(a.mat), mb = ordem.indexOf(b.mat);
      if (ma !== mb) return ma - mb;
      if (b.c !== a.c) return b.c - a.c;
      return b.l - a.l;
    });
    linhas.forEach(function (l, i) { l.n = i + 1; });
    return linhas;
  }

  function estimativaChapas(pecas, chapa) {
    var porEsp = {};
    pecas.forEach(function (p) {
      if (!p.cortavel || !p.corte) return;
      var e = p.corte.e;
      porEsp[e] = (porEsp[e] || 0) + p.corte.c * p.corte.l / 1e6;
    });
    var areaChapa = chapa.comprimento * chapa.largura / 1e6;
    return Object.keys(porEsp).map(Number).sort(function (a, b) { return b - a; }).map(function (e) {
      return { esp: e, area: porEsp[e], chapas: Math.ceil(porEsp[e] / (areaChapa * 0.8)) };
    });
  }

  function totaisMateriais(pecas, materiais) {
    var t = {};
    pecas.forEach(function (p) {
      if (!p.cortavel || !p.corte) return;
      var mn = nomeMaterial(materiais, p.mat);
      var key = mn + '|' + p.corte.e;
      if (!t[key]) t[key] = { mat: p.mat, material: mn, esp: p.corte.e, area: 0, fitaMm: 0, pecas: 0 };
      t[key].area += p.corte.c * p.corte.l / 1e6;
      t[key].fitaMm += p.fitaC * p.corte.c + p.fitaL * p.corte.l;
      t[key].pecas++;
    });
    return Object.keys(t).map(function (k) { return t[k]; });
  }

  function csvLista(linhas, sep) {
    sep = sep || ';';
    var cab = ['Nº', 'Peça', 'Qtd', 'Comprimento (mm)', 'Largura (mm)', 'Espessura (mm)', 'Material', 'Veio', 'Fita comp. (lados)', 'Fita larg. (lados)', 'Observações'];
    function esc(v) {
      var s = String(v === null || v === undefined ? '' : v);
      if (typeof v === 'number') s = s.replace('.', ',');
      if (s.indexOf(sep) >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var out = [cab.join(sep)];
    linhas.forEach(function (l) { out.push([l.n, l.nome, l.qtd, l.c, l.l, l.e, l.material, l.veio ? 'Sim' : 'Não', l.fitaC, l.fitaL, l.obs].map(esc).join(sep)); });
    return out.join('\r\n');
  }

  // Verificações por ambiente e checklist de entrega
  var VERIFICACOES = {
    cozinha: { titulo: 'Gordura, calor, vapor, respingos e cargas concentradas', itens: [
      'Talheres: frente de 120–200 mm; panelas: profundidade útil 500–550 mm',
      'Lava-louças aberta, acesso ao gás e às válvulas, calor e vapor do forno e do cooktop',
      'Sob a pia: fundo removível ou sem fundo, com travamento; reservar sifão, registros, cuba e lixeira',
      'Forno, cooktop e geladeira: nicho, respiro e isolamento conforme o manual do modelo'] },
    banheiro: { titulo: 'Umidade, vapor e respingos', itens: [
      'MDF RU em caixaria e frentes; fitas de borda seladas (PVC/ABS) e furos vedados',
      'Sob a cuba: espaço livre para sifão e registros; fundo removível ou sem fundo',
      'Gabinete suspenso: altura livre do piso 15–30 cm facilita a limpeza; fixação reforçada',
      'Tampo final entre 80 e 92 cm; puxadores sem quinas na altura do quadril'] },
    lavanderia: { titulo: 'Água, produtos químicos e vibração', itens: [
      'Nicho de máquina com folga ≥ 2 cm nas laterais e ventilação traseira',
      'Tanque/cuba: sifão, registros e ralo acessíveis',
      'Prateleiras para produtos de limpeza com borda/fita selada',
      'Secadora: duto de exaustão e tomada exclusiva conforme manual'] },
    seco: { titulo: 'Uso e conforto', itens: [
      'Prateleiras de livros: vão livre ≤ 80 cm em MDF 18 mm',
      'Cabideiro: profundidade ≥ 55 cm; altura livre 100–150 cm conforme uso',
      'Gavetas de roupas: altura interna 12–20 cm',
      'Tomadas e iluminação de LED previstas antes da montagem'] }
  };
  var CHECKLIST = [
    ['Levantamento', 'Paredes, esquadro, piso acabado, teto, pontos elétricos/hidráulicos/gás, equipamentos e estrutura de apoio.'],
    ['Desenhos', 'Planta, elevações externa e interna, cortes críticos, detalhes de união, apoio, bordas, abertura, recorte e tamponamento.'],
    ['Lista de peças', 'ID, quantidade, medidas, espessura, substrato, padrão das faces, veio, bordas, usinagem e revisão.'],
    ['Memorial', 'Marca e código de materiais e ferragens, montagem conforme fichas, equipamentos e responsabilidades de instalação.'],
    ['Conferência final', 'Abertura e extração, folgas, acesso técnico, estabilidade, limpeza, exposição à água e instalações.']
  ];

  return {
    TIPOS: TIPOS, AMBIENTES: AMBIENTES, TIPOS_SECAO: TIPOS_SECAO, TIPOS_ITEM_GAVETA: TIPOS_ITEM_GAVETA,
    PUXADORES: PUXADORES, COMPOSICOES: COMPOSICOES, COMODOS: COMODOS, comodoDoTipo: comodoDoTipo, ESTILOS_FRENTE: ESTILOS_FRENTE, TEMP_LED: TEMP_LED, CORREDICAS: CORREDICAS,
    MATERIAIS_PADRAO: MATERIAIS_PADRAO, MATERIAIS_FIXOS: MATERIAIS_FIXOS,
    VERIFICACOES: VERIFICACOES, CHECKLIST: CHECKLIST,
    specPadrao: specPadrao, aplicarTipo: aplicarTipo, normalizar: normalizar,
    autoColunas: autoColunas, composicao: composicao, novaColuna: novaColuna, novaSecao: novaSecao, itensGaveta: itensGaveta,
    calcular: calcular, listaDePecas: listaDePecas, estimativaChapas: estimativaChapas,
    totaisMateriais: totaisMateriais, csvLista: csvLista, nomeMaterial: nomeMaterial, nDobradicas: nDobradicas,
    fmt: { num: fmtNum, m: fmtM, cm: fmtCm, mm: fmtMm },
    util: { clone: clone, deepMerge: deepMerge }
  };
});
