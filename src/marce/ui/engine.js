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
    banheiro: { label: 'Banheiro', ambiente: 'banheiro', tipos: ['gabinete', 'aereo', 'personalizado'] },
    lavanderia: { label: 'Lavanderia', ambiente: 'lavanderia', tipos: ['balcao', 'aereo', 'personalizado'] },
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
    livre: 'Vão livre (até o piso)',
    correr: 'Portas de correr',
    coifa: 'Coifa embutida'
  };
  // Interior por módulos (de baixo para cima), com as alturas recomendadas
  var MODULOS_INTERNOS = {
    prateleiras: 'Prateleiras', gavetas: 'Gavetas internas', cabideiro: 'Cabideiro', sapateira: 'Sapateira', maleiro: 'Maleiro', vazio: 'Vazio'
  };
  var USOS_CABIDEIRO = {
    alto: { nome: 'alto · vestidos longos e casacos', altura: 1600 },
    medio: { nome: 'médio · camisas, blusas, paletós', altura: 1050 },
    baixo: { nome: 'baixo · calças e saias', altura: 850 },
    infantil: { nome: 'infantil · roupas de criança', altura: 800 },
    bebe: { nome: 'bebê', altura: 600 }
  };
  var REC_INTERNO = { gaveta: 170, sapateira: 190, prateleira: 330, maleiro: 400 };
  // combinações prontas (de baixo para cima)
  var INTERNOS_PRONTOS = {
    prateleiras: { nome: 'Prateleiras', mods: [{ tipo: 'prateleiras' }] },
    cabGav: { nome: 'Cabideiro + gavetas', mods: [{ tipo: 'gavetas', qtd: 2 }, { tipo: 'cabideiro', uso: 'medio' }, { tipo: 'prateleiras' }] },
    duplo: { nome: 'Cabideiro duplo', mods: [{ tipo: 'cabideiro', uso: 'baixo' }, { tipo: 'cabideiro', uso: 'medio' }] },
    vestidos: { nome: 'Vestidos longos', mods: [{ tipo: 'sapateira', qtd: 2 }, { tipo: 'cabideiro', uso: 'alto' }] },
    sapateira: { nome: 'Sapateira', mods: [{ tipo: 'sapateira' }] },
    infantil: { nome: 'Infantil', mods: [{ tipo: 'gavetas', qtd: 2 }, { tipo: 'cabideiro', uso: 'infantil' }, { tipo: 'prateleiras' }] }
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
    meu: 'Da minha biblioteca',
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
  var ESTILOS_FRENTE = { lisa: 'Lisa', ripada: 'Ripada', moldura: 'Moldura', vidro: 'Vidro', palhinha: 'Tela / palhinha' };
  // vidros das portas em quadro de alumínio (cor aproximada; no SketchUp dá para pintar com a textura desejada)
  var VIDROS = {
    canelado: { nome: 'Vidro canelado 4 mm', cor: '#cfdde2' },
    incolor: { nome: 'Vidro incolor 4 mm', cor: '#dcebf0' },
    fume: { nome: 'Vidro fumê 4 mm', cor: '#7f8891' },
    bronze: { nome: 'Vidro bronze 4 mm', cor: '#a08c7c' },
    reflecta: { nome: 'Vidro reflecta prata 4 mm', cor: '#aab4ba' },
    jateado: { nome: 'Vidro jateado (acetinado) 4 mm', cor: '#e6ecee' },
    espelho: { nome: 'Espelho 4 mm', cor: '#bcd3dc' }
  };
  // telas das portas em quadro de MDF (palhinha e afins)
  var TELAS = {
    palhinha: { id: 'tela-palhinha', nome: 'Palhinha natural', marca: 'Tela', cor: '#d8c39a' },
    sintetica: { id: 'tela-sintetica', nome: 'Palhinha sintética', marca: 'Tela', cor: '#e3d5b4' },
    rattan: { id: 'tela-rattan', nome: 'Rattan sextavado', marca: 'Tela', cor: '#c4a175' },
    metalica: { id: 'tela-metalica', nome: 'Tela metálica', marca: 'Tela', cor: '#9aa2a9' },
    tecido: { id: 'tela-tecido', nome: 'Tecido / linho', marca: 'Tela', cor: '#d6cdc2' }
  };
  var TEMP_LED = { 2700: '#ffcf8a', 3000: '#ffd9a0', 4000: '#fff1d6', 6000: '#eef4ff' };
  var MATERIAIS_FIXOS = {
    metal: { nome: 'Metal', cor: '#9a9ea3' },
    vidro: { nome: 'Vidro canelado', cor: '#cfdde2' },
    tela: { nome: 'Palhinha natural', cor: '#d8c39a' },
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

  // canto arredondado (planta, coordenadas da peça): quarto de círculo de raio r alinhado com a face das frentes,
  // recortado onde entraria no vão (fica só na frente da caixa ou no lugar da lateral)
  function cantoArredondado(r, T, Tf, direita) {
    var pts = [], n = 12, cy = r; // centro em (r, r) da peça (a peça começa em y = -Tf)
    for (var k = 0; k <= n; k++) {
      var a = Math.PI * 1.5 - (Math.PI / 2) * k / n; // de baixo (r, 0) até a esquerda (0, r)
      pts.push([Math.round((r + r * Math.cos(a)) * 10) / 10, Math.round((cy + r * Math.sin(a)) * 10) / 10]);
    }
    pts.push([T, r], [T, Tf], [r, Tf]);
    return direita ? pts.map(function (q) { return [Math.round((r - q[0]) * 10) / 10, q[1]]; }).reverse() : pts;
  }
  // retângulo com os dois cantos da frente (y = 0) arredondados
  function retanguloArredondado(w, d, r) {
    var pts = [], n = 10;
    r = Math.max(0, Math.min(r, w / 2, d / 2));
    for (var k = 0; k <= n; k++) { var a = Math.PI + (Math.PI / 2) * k / n; pts.push([Math.round((r + r * Math.cos(a)) * 10) / 10, Math.round((r + r * Math.sin(a)) * 10) / 10]); }
    for (k = 0; k <= n; k++) { var b = Math.PI * 1.5 + (Math.PI / 2) * k / n; pts.push([Math.round((w - r + r * Math.cos(b)) * 10) / 10, Math.round((r + r * Math.sin(b)) * 10) / 10]); }
    pts.push([w, d], [0, d]);
    return pts;
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
      folhas: 0,              // portas de correr: 0 = automático, 2, 3 ou 4 folhas
      estilo: '',             // tipo de frente desta faixa (vazio = igual ao do móvel)
      frente2: '',            // '1' = usa a segunda cor das frentes
      coifa: { largura: 520, profundidade: 280, altura: 160, duto: 150 }, // coifa embutida (mm)
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
      divisorias: 'par',      // cada | par | nenhuma (padrão: portas em par, divisória a cada par)
      gavetas: { corredica: 'telescopica' },
      prateleiras: { recuo: 20, folga: 1 },
      pedra: { ativa: false, espessura: 20, avancoFrente: 20, avancoLados: 0, cantos: false, raio: 50 },
      cantos: { ativo: false, raio: 50 },
      cuba: { ativa: false, centro: Math.round(t.L / 2), largura: 500, profundidade: 400, origem: 'manual', fundo: 'sem', furo: 100, alturaFuro: 500 },
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
        ns.itens = ns.itens.map(function (it) { return { tipo: TIPOS_ITEM_GAVETA[it && it.tipo] ? it.tipo : 'gaveta', altura: it && isNum(it.altura) && it.altura > 0 ? it.altura : null, org: it && (it.org === 'talheres' || it.org === 'grade') ? it.org : '' }; });
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
        // o mais comum: portas na altura toda, em pares, com gavetas embaixo (por dentro) e o interior
        // variando de par em par: cabideiro + gavetas, vestidos longos com gavetas, gavetas + prateleiras
        var interiores = [
          [{ tipo: 'gavetas', qtd: 2 }, { tipo: 'cabideiro', uso: 'medio' }, { tipo: 'prateleiras' }],
          [{ tipo: 'gavetas', qtd: 2 }, { tipo: 'cabideiro', uso: 'alto' }],
          [{ tipo: 'gavetas', qtd: 3 }, { tipo: 'prateleiras' }]
        ];
        for (i = 0; i < n; i++) {
          var par = Math.floor(i / 2) % interiores.length;
          add([novaSecao('portas', { prateleiras: 3, interior: 'prateleiras', interno: JSON.parse(JSON.stringify(interiores[par])) })]);
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
      return c.secoes.length === 1 && (c.secoes[0].tipo === 'portas' || c.secoes[0].tipo === 'correr');
    }
    // mesclar à mão: as duas colunas com as mesmas faixas (mesmo tipo e mesma altura), de portas, correr, nicho ou basculante
    function mesmasFaixas(a, b) {
      if (a.secoes.length !== b.secoes.length) return false;
      return a.secoes.every(function (sa, k) {
        var sb = b.secoes[k];
        return sa.tipo === sb.tipo && ['portas', 'correr', 'nicho', 'basculante'].indexOf(sa.tipo) >= 0 && (sa.altura || 0) === (sb.altura || 0);
      });
    }
    function mesmaConfig(a, b) {
      var sa = a.secoes[0], sb = b.secoes[0];
      return sa.interior === sb.interior && sa.prateleiras === sb.prateleiras;
    }
    var i = 0;
    while (i < cols.length) {
      var g = [i];
      // cada coluna pode escolher a divisória à direita: 'unir' (tira, mescla o interno sem mudar as portas),
      // 'manter' (sempre tem) ou automática (segue a regra geral cada/par/nenhuma)
      var lim = spec.divisorias === 'par' ? 2 : (spec.divisorias === 'nenhuma' ? 99 : 1);
      while (i + g.length < cols.length) {
        var ult = cols[g[g.length - 1]], j = i + g.length;
        var escolha = ult.divisoria || 'auto';
        if (escolha === 'manter' || cubaCols[j] !== cubaCols[i]) break;
        if (escolha === 'unir' && mesmasFaixas(ult, cols[j])) { g.push(j); continue; }
        if (!mesclavel(ult) || !mesclavel(cols[j])) break;
        if (g.length < lim && mesmaConfig(cols[i], cols[j])) g.push(j); else break;
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
      if (o.biblio) p.biblio = o.biblio;
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

  // Quantidade de dobradiças: o que for maior entre a regra da altura e a do peso (caneco 35 mm aguenta
  // com folga ~4 kg por dobradiça); porta larga (> 60 cm) ganha mais uma, pela alavanca.
  function nDobradicas(altura, largura, pesoKg) {
    var n = altura <= 900 ? 2 : (altura <= 1600 ? 3 : (altura <= 2100 ? 4 : 5));
    if (pesoKg) n = Math.max(n, Math.ceil(pesoKg / 4));
    if (largura > 600) n++;
    return Math.min(6, n);
  }
  // peso aproximado da porta (kg): MDF ~750 kg/m³; vidro 4 mm ~10 kg/m²; quadro de alumínio ~0,6 kg/m
  function pesoPorta(w, h, esp, estiloF) {
    if (estiloF === 'vidro') return (w * h / 1e6) * 10 + 2 * (w + h) / 1000 * 0.6;
    return (w * h * esp / 1e9) * 750;
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
    // ferragem da minha biblioteca (.skp): precisa de id e das 3 medidas (mm, da maior para a menor)
    function bibOk(b) { return b && b.id && b.medidas && b.medidas.length === 3 && b.medidas.every(function (v) { return +v > 0; }) ? b : null; }
    function bibDe(b, extra) { var o = { id: b.id, encaixe: b.encaixe === 'esticar' ? 'esticar' : 'real', virar: !!b.virar }; for (var k in extra) o[k] = extra[k]; return o; }
    if (pux.tipo === 'meu' && !bibOk(pux.bib)) { info('Puxador da biblioteca: escolha um modelo (aba Detalhes). Enquanto isso, o desenho usa alça.'); pux.tipo = 'alca'; }
    var bibCorr = spec.leve ? null : bibOk((spec.gavetas || {})[spec.gavetas && spec.gavetas.corredica === 'oculta' ? 'bibOculta' : 'bibTelescopica']);
    var bibDob = spec.leve ? null : bibOk(fr.bibDobradica);
    var estilo = ESTILOS_FRENTE[fr.estilo] ? fr.estilo : 'lisa';
    var cantosArred = !!(spec.cantos && spec.cantos.ativo);
    var matFrenteAtual = 'frente'; // segunda cor das frentes: escolhida faixa a faixa
    // LED sob a bancada: as frentes de cima descem para abrir a faixa de luz
    var ledBancada = !!(spec.led && spec.led.ativo && spec.led.local === 'bancada');
    var folgaTopoF = ledBancada ? Math.max(fr.folgaTopo, 30) : fr.folgaTopo;
    var vidroTipo = VIDROS[(spec.frentes || {}).vidro] ? spec.frentes.vidro : 'canelado';
    var telaInfo = (spec.materiais && spec.materiais.tela) || TELAS.palhinha;
    var ripa = deepMerge({ largura: 20, espaco: 10, espessura: 9 }, fr.ripa || {});
    var led = deepMerge({ ativo: false, local: 'base', posicao: 'fundo', tipo: 'embutido', temperatura: 4000 }, spec.led || {});
    if (pux.tipo === 'cava' && pux.cavaTipo === 'perfilJ') { pux = deepMerge(pux, { tipo: 'perfil' }); info('Cava com perfil J de alumínio: o perfil entra no lugar da borda da frente (a chapa fica 22 mm menor).'); }
    if (estilo === 'palhinha' && pux.tipo === 'cava') {
      pux = deepMerge(pux, { tipo: 'toque' });
      info('Frente com tela: o quadro de 70 mm não comporta cava usinada — as portas ficam com abertura por toque (gavetas lisas seguem com a cava escolhida em outro móvel; aqui escolha perfil, alça, barra ou botão).');
    }
    if (estilo === 'ripada' && pux.tipo === 'cava') {
      pux = deepMerge(pux, { tipo: 'toque' });
      info('Frente ripada: cava usinada não se aplica nas ripas — as frentes ficam com abertura por toque (ou escolha perfil, barra ou botão).');
    }
    var yApar = estilo === 'ripada' ? ripa.espessura : (estilo === 'moldura' ? 6 : 0); // espessura aplicada à frente
    // tipo de frente por faixa ou por coluna (ex.: uma porta de vidro no meio de portas com moldura)
    var estiloGlobal = estilo;
    function usarEstilo(c) {
      estilo = c && ESTILOS_FRENTE[c.estilo] ? c.estilo : estiloGlobal;
      yApar = estilo === 'ripada' ? ripa.espessura : (estilo === 'moldura' ? 6 : 0);
    }
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
    // cantos frontais arredondados: uma peça curva (MDF curvado ou maciço) no canto, alinhada com as frentes;
    // a lateral começa atrás dela
    var raioC = cantosArred ? clamp(+spec.cantos.raio || 50, Tf + 10, Math.min(200, Dc / 2)) : 0;
    // a curva só pode entrar na caixa no lugar da lateral (senão invade o vão): limita o raio
    var raioMax = Tf + 10;
    for (var rr = Tf + 10; rr <= 200; rr++) { if (rr - Math.sqrt(rr * rr - (rr - Tf) * (rr - Tf)) <= T) raioMax = rr; else break; }
    if (raioC > raioMax) { info('Canto arredondado de R' + Math.round(raioC / 10) + ' cm não cabe com lateral de ' + T + ' mm: ficou R' + (raioMax / 10).toFixed(1).replace('.', ',') + ' cm. Para raio maior, use lateral dupla (36 mm) ou coluna de canto.'); raioC = raioMax; }
    [0, L - T].forEach(function (x, k) {
      var adj = (k === 0 && vaosM[0].cuba) || (k === 1 && vaosM[nV - 1].cuba);
      var yL = raioC ? raioC - Tf : 0;
      fab.chapa({ nome: k === 0 ? 'Lateral esquerda' : 'Lateral direita', grupo: 'caixa', mat: matExt, eixoEsp: 'x',
        x: x, y: yL, z: z0 + T, dx: T, dy: Dc - yL, dz: hLat, veio: 'z', fitas: ['z'], obs: (adj ? 'Recorte p/ cuba (2 cm de folga)' : '') + (raioC ? (adj ? ' · ' : '') + 'Começa atrás do canto arredondado' : '') });
      if (raioC) {
        var pts = cantoArredondado(raioC, T, Tf, k === 1);
        fab.objeto({ nome: 'Canto arredondado R' + Math.round(raioC / 10) + ' cm', grupo: 'caixa', mat: matExt, x: k === 0 ? 0 : L - raioC, y: -Tf, z: z0 + T, dx: raioC, dy: raioC, dz: hLat,
          forma: { plano: 'xy', pts: pts }, obs: 'MDF curvado (flexível) ou maciço torneado, colado na lateral; a frente começa depois dele' });
      }
    });
    if (raioC && embutida) info('Cantos arredondados com frentes embutidas: o canto fica na frente da caixa e as frentes começam depois dele.');
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
    // módulo da cuba: sem fundo (padrão) ou com fundo e furo para o sifão / esgoto
    var cubaFundo = spec.cuba && spec.cuba.fundo === 'furo';
    function furoSifao(px, pz, pdx, pdz) {
      var d = clamp(+spec.cuba.furo || 100, 40, 200);
      var zf = (+spec.cuba.alturaFuro || 500) - (spec.base && spec.base.tipo === 'suspenso' ? (+spec.elevacao || 0) : 0);
      var cx = clamp(+spec.cuba.centro - px, d / 2 + 10, pdx - d / 2 - 10), cz = clamp(zf - pz, d / 2 + 10, pdz - d / 2 - 10);
      return { x: r1(cx), z: r1(cz), d: d };
    }
    if (fundoTipo !== 'nenhum' && cubaFundo) {
      vaosM.forEach(function (vm) {
        if (!vm.cuba) return;
        var px = fundoTipo === 'sobreposto' ? vm.il : vm.il - spec.fundo.rasgo, pdx = fundoTipo === 'sobreposto' ? vm.largInt : vm.largInt + 2 * spec.fundo.rasgo;
        var zb2 = fundoTipo === 'sobreposto' ? z0 + T : z0 + T - spec.fundo.rasgo, zt2 = fundoTipo === 'sobreposto' ? zTop - T : (topoTravessas ? zTop : zTop - T + spec.fundo.rasgo);
        var yF2 = fundoTipo === 'sobreposto' ? Dc - F : D - spec.fundo.recuoEncaixe - F;
        // o furo vai só no vão onde está o eixo da cuba; os outros vãos sob a cuba ganham fundo liso removível
        var temFuro = +spec.cuba.centro >= vm.il && +spec.cuba.centro <= vm.ir;
        var fu = temFuro ? furoSifao(px, zb2, pdx, zt2 - zb2) : null;
        var pf2 = fab.chapa({ nome: 'Fundo da cuba', grupo: 'fundo', mat: 'fundo', eixoEsp: 'y', x: px, y: yF2, z: zb2, dx: pdx, dy: F, dz: zt2 - zb2, fitas: [], vao: vm.idx,
          obs: 'Removível (parafusos)' + (fu ? ' · furo Ø' + fu.d + ' mm p/ sifão a ' + Math.round(fu.z + zb2) + ' mm da base' : '') });
        if (pf2 && fu) pf2.furo = fu;
      });
    }
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
      info('Cuba detectada' + (spec.cuba.origem === 'modelo' ? ' no modelo' : '') + ': o módulo da pia fica ' + (spec.cuba.fundo === 'furo' ? 'com fundo removível furado para o sifão' : 'sem fundo') + ', sem prateleira na altura do sifão e laterais, divisórias, travessas e gavetas recortadas com 2 cm de folga.');
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
    // centro do puxador vertical medido do piso: o escolhido ou, em porta alta, 110 cm (altura da mão)
    function centroPuxadorPiso(z, h) {
      var elev = spec.base && spec.base.tipo === 'suspenso' ? (+spec.elevacao || 0) : 0;
      var c = isNum(+pux.alturaPiso) && +pux.alturaPiso > 0 ? +pux.alturaPiso - elev : (h > 1500 ? 1100 - elev : null);
      return c !== null && c > z + 100 && c < z + h - 100 ? c : null; // só se a porta passa por essa altura
    }
    function aplicarPuxador(frenteP, info2) {
      // info2: {x, z, w, h, y0, conj, tipoFrente:'porta'|'gaveta'|'basculante', lado:'esq'|'dir'|'topo', vao, col, secao}
      var w = info2.w, h = info2.h, x = info2.x, z = info2.z, y0 = info2.y0 - (info2.vidro ? 0 : yApar);
      var refs = { vao: info2.vao, col: info2.col, secao: info2.secao, conj: info2.conj };
      var posV = info2.tipoFrente === 'gaveta' || info2.tipoFrente === 'basculante' ? (puxPos === 'base' ? 'base' : 'topo') : puxPos;
      if (pux.tipo === 'passante') return; // a própria porta passa da caixa
      if (pux.tipo === 'cava' && (estilo === 'ripada' || estilo === 'palhinha')) return; // abre por toque nessas frentes
      if (pux.tipo === 'cava' && frenteP) {
        // chanfro 45° na borda superior (ou inferior) traseira da frente
        var c = clamp(pux.tamanho, 8, Tf - 4);
        var yF = 0, yB = Tf; // local ao perfil (y para trás)
        var pts;
        if (posV === 'base') pts = [[yF, 0], [yB - c, 0], [yB, c], [yB, h], [yF, h]];
        else pts = [[yF, 0], [yB, 0], [yB, h - c], [yB - c, h], [yF, h]];
        if (posV === 'lateral') pts = [[yF, 0], [yB, 0], [yB, h - c], [yB - c, h], [yF, h]];
        if (pux.cavaTipo === 'reta') {
          // rasgo reto na frente (12 mm de altura), deixando 6 mm atrás: os dedos entram por cima/por baixo
          var hc = 12, lip = 6;
          pts = posV === 'base' ? [[0, hc], [yB - lip, hc], [yB - lip, 0], [yB, 0], [yB, h], [0, h]] : [[0, 0], [yB, 0], [yB, h], [yB - lip, h], [yB - lip, h - hc], [0, h - hc]];
        }
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
      if (pux.tipo === 'meu') {
        // puxador da biblioteca: comprimento real (ou esticado, se for perfil), saindo da frente
        var md = pux.bib.medidas.map(Number), est = pux.bib.encaixe === 'esticar';
        var vertP = info2.tipoFrente === 'porta' && posV === 'lateral';
        var dispP = vertP ? h - 80 : w - 60;
        var longo = Math.max(10, Math.min(dispP, est ? (+pux.comprimento || md[0]) : md[0]));
        var proj = pux.bib.deitar ? md[2] : md[1], altP = pux.bib.deitar ? md[1] : md[2];
        var mx, mz, mw, mh;
        if (vertP) {
          mw = altP; mh = longo;
          mx = info2.lado === 'esq' ? x + w - 33 - altP : x + 33;
          mz = z + (tipo === 'balcao' ? h - longo - 60 : (tipo === 'aereo' ? 60 : (h - longo) / 2));
          var cPisoM = centroPuxadorPiso(z, h);
          if (cPisoM !== null) mz = clamp(cPisoM - longo / 2, z + 40, z + h - longo - 40);
        } else {
          mw = longo; mh = altP;
          mx = x + (w - longo) / 2;
          mz = posV === 'base' ? z + 35 : z + h - 35 - altP;
        }
        fab.objeto({ nome: 'Puxador ' + pux.bib.nome, grupo: 'ferragem', mat: 'metal', x: mx, y: y0 - proj, z: mz, dx: mw, dy: proj, dz: mh,
          vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj, biblio: bibDe(pux.bib, { longo: vertP ? 'z' : 'x' }) });
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
          var cPiso = centroPuxadorPiso(z, h);
          if (cPiso !== null) bz = clamp(cPiso - comp / 2, z + 40, z + h - comp - 40);
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
        // frente lisa/moldura: o perfil entra NO LUGAR da borda da frente (a chapa fica 22 mm menor), alinhado
        // com a face dela; é assim que o perfil de alumínio é parafusado na marcenaria. Sem nada sobrando para fora.
        var embutePerfil = frenteP && frenteP.cortavel && frenteP.mat === 'frente' && (estilo === 'lisa' || estilo === 'moldura');
        if (embutePerfil) {
          var vertical = info2.tipoFrente === 'porta' && posV === 'lateral';
          var redu = vertical ? 20 : ph;
          var eixoR = vertical ? 'dx' : 'dz';
          var antes = frenteP[eixoR];
          if (antes - redu > 60) {
            frenteP[eixoR] = r1(antes - redu);
            if (vertical && info2.lado !== 'esq') frenteP.x = r1(frenteP.x + redu);
            if (!vertical && posV === 'base') frenteP.z = r1(frenteP.z + redu);
            if (frenteP.corte) { if (frenteP.corte.c === antes) frenteP.corte.c = frenteP[eixoR]; else if (frenteP.corte.l === antes) frenteP.corte.l = frenteP[eixoR]; }
            frenteP.obs = (frenteP.obs ? frenteP.obs + ' · ' : '') + 'descontado ' + redu + ' mm do perfil puxador';
            var yF = frenteP.y, dyF = frenteP.dy;
            if (vertical) {
              fab.objeto({ nome: 'Perfil puxador', grupo: 'ferragem', mat: 'metal', x: info2.lado === 'esq' ? x + w - redu : x, y: yF, z: z, dx: redu, dy: dyF, dz: h, vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj,
                forma: { plano: 'xz', pts: info2.lado === 'esq' ? [[0, 0], [redu, 0], [redu, h], [0, h]] : [[0, 0], [redu, 0], [redu, h], [0, h]] } });
              cont.puxadorPerfilMm += h;
            } else {
              // seção em "J": aba na face da frente e o vão para os dedos atrás
              var pts = posV === 'base' ? [[0, 0], [dyF, 0], [dyF, 2], [4, 2], [4, ph], [0, ph]] : [[0, 0], [4, 0], [4, ph - 2], [dyF, ph - 2], [dyF, ph], [0, ph]];
              fab.objeto({ nome: 'Perfil puxador', grupo: 'ferragem', mat: 'metal', x: x, y: yF, z: posV === 'base' ? z : z + h - ph, dx: w, dy: dyF, dz: ph, vao: refs.vao, col: refs.col, secao: refs.secao, conj: refs.conj,
                forma: { plano: 'yz', pts: pts } });
              cont.puxadorPerfilMm += w;
            }
            return;
          }
        }
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
        fab.objeto(comRef({ nome: VIDROS[vidroTipo].nome, grupo: 'frente', mat: 'vidro', x: o.x + pf, y: o.y0 + Tf / 2 - 2, z: o.z + pf, dx: o.w - 2 * pf, dy: 4, dz: o.h - 2 * pf, meta: o.meta, obs: o.obs }));
        cont.vidroM2 += (o.w - 2 * pf) * (o.h - 2 * pf) / 1e6; cont.perfilVidroMm += 2 * (o.w + o.h);
        return null;
      }
      if (estilo === 'palhinha' && o.vidroOk && o.w >= 240 && o.h >= 240) {
        // quadro de MDF (montantes de 70 mm, largos para o caneco da dobradiça) com a tela presa num rebaixo
        var qm = 70, ytela = o.y0 + Tf / 2 - 1.5;
        var mE = fab.chapa(comRef({ nome: o.nome + ' · montante', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x, y: o.y0, z: o.z, dx: qm, dy: Tf, dz: o.h, veio: 'z', fitas: ['z', 'z', 'x', 'x'], obs: 'quadro p/ tela · rebaixo 8 × 6 mm', meta: o.meta }));
        fab.chapa(comRef({ nome: o.nome + ' · montante', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x + o.w - qm, y: o.y0, z: o.z, dx: qm, dy: Tf, dz: o.h, veio: 'z', fitas: ['z', 'z', 'x', 'x'], obs: 'quadro p/ tela · rebaixo 8 × 6 mm' }));
        fab.chapa(comRef({ nome: o.nome + ' · travessa', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x + qm, y: o.y0, z: o.z, dx: o.w - 2 * qm, dy: Tf, dz: qm, veio: 'x', fitas: ['x'], obs: 'quadro p/ tela · cavilha/cola' }));
        fab.chapa(comRef({ nome: o.nome + ' · travessa', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x + qm, y: o.y0, z: o.z + o.h - qm, dx: o.w - 2 * qm, dy: Tf, dz: qm, veio: 'x', fitas: ['x'], obs: 'quadro p/ tela · cavilha/cola' }));
        fab.objeto(comRef({ nome: 'Tela ' + telaInfo.nome.toLowerCase(), grupo: 'frente', mat: 'tela', x: o.x + qm, y: ytela, z: o.z + qm, dx: o.w - 2 * qm, dy: 3, dz: o.h - 2 * qm, obs: o.obs }));
        cont.telaM2 = (cont.telaM2 || 0) + (o.w - 2 * qm + 16) * (o.h - 2 * qm + 16) / 1e6;
        return mE;
      }
      if (estilo === 'palhinha' && o.vidroOk && !cont.avisoTelaPequena) { cont.avisoTelaPequena = true; info('Portas com menos de 24 cm ficam lisas: o quadro de 70 mm de cada lado não deixa espaço para a tela.'); }
      var b = fab.chapa(comRef({ nome: o.nome, grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x, y: o.y0, z: o.z, dx: o.w, dy: Tf, dz: o.h, veio: o.veio, fitas: ['x', 'x', 'z', 'z'], obs: o.obs, meta: o.meta }));
      if (estilo === 'ripada') {
        var passo = ripa.largura + ripa.espaco;
        var nR = Math.max(1, Math.floor((o.w + ripa.espaco) / passo));
        var usado = nR * ripa.largura + (nR - 1) * ripa.espaco;
        var xr = o.x + (o.w - usado) / 2;
        for (var kr = 0; kr < nR; kr++) fab.chapa(comRef({ nome: 'Ripa', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xr + kr * passo, y: o.y0 - ripa.espessura, z: o.z, dx: ripa.largura, dy: ripa.espessura, dz: o.h, veio: 'z', fitas: ['z', 'z'], obs: 'Ripa colada na frente' }));
        cont.ripas += nR;
      } else if (estilo === 'moldura') {
        var mw = Math.max(25, Math.min(60, o.w / 4, o.h / 4)), me = 6;
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x, y: o.y0 - me, z: o.z + o.h - mw, dx: o.w, dy: me, dz: mw, veio: 'x', fitas: ['x', 'x'] }));
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x, y: o.y0 - me, z: o.z, dx: o.w, dy: me, dz: mw, veio: 'x', fitas: ['x', 'x'] }));
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x, y: o.y0 - me, z: o.z + mw, dx: mw, dy: me, dz: o.h - 2 * mw, veio: 'z', fitas: ['z', 'z'] }));
        fab.chapa(comRef({ nome: 'Moldura da frente', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: o.x + o.w - mw, y: o.y0 - me, z: o.z + mw, dx: mw, dy: me, dz: o.h - 2 * mw, veio: 'z', fitas: ['z', 'z'] }));
      }
      return b;
    }

    function dobradicasVisuais(px, pw, pz, ph, lado, nd, conj, refs) {
      if (estilo === 'vidro') return; // porta de vidro usa dobradiça própria do perfil de alumínio
      for (var k = 0; k < nd; k++) {
        var zz = nd === 1 ? pz + ph / 2 : pz + 90 + (ph - 180) * k / (nd - 1);
        var xc = lado === 'esq' ? px + 22 : px + pw - 22 - 35;
        var yBack = embutida ? Tf : 0;
        if (bibDob) {
          // dobradiça da biblioteca, no tamanho real: o braço (medida maior) entra no móvel a partir do caneco
          var mdD = bibDob.medidas.map(Number), lD = bibDob.deitar ? mdD[1] : mdD[2], aD = bibDob.deitar ? mdD[2] : mdD[1];
          fab.objeto({ nome: 'Dobradiça ' + bibDob.nome, grupo: 'ferragem', mat: 'metal', x: xc + 17.5 - lD / 2, y: yBack, z: zz - aD / 2, dx: lD, dy: mdD[0], dz: aD, conj: conj, vao: refs.vao, col: refs.col, secao: refs.secao,
            biblio: bibDe(bibDob, { longo: 'y', virar: lado === 'esq' ? !!bibDob.virar : !bibDob.virar, mover: { tipo: 'dobradica', eixo: 'y', parede: 'max' } }),
            previa: { x: xc, y: yBack - 11, z: zz - 17.5, dx: 35, dy: 12.5, dz: 35 } });
          continue;
        }
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
      if (bibCorr && spec.gavetas.corredica !== 'oculta') {
        // corrediça da biblioteca: ocupa os 12,5 mm de folga, no comprimento da corrediça. Funciona como a
        // de verdade: o perfil junto da lateral fica no móvel, o do meio anda a metade e o de dentro sai com a gaveta.
        var cjB = fab.conjuntos.filter(function (c) { return c.id === conj; })[0];
        var meioB = cjB ? fab.conjunto({ nome: 'Corrediça (perfil intermediário)', tipo: 'corre', curso: -Math.round(cjB.curso / 2), pai: conj, segue: true, vao: refs.vao, col: refs.col, secao: refs.secao }) : null;
        [[xL, 1], [xR, -1]].forEach(function (ld) {
          var fC = +bibCorr.folga > 0 ? +bibCorr.folga : 12.5;
          fab.objeto(Object.assign({ nome: 'Corrediça ' + bibCorr.nome, grupo: 'ferragem', mat: 'metal', x: ld[1] > 0 ? ld[0] : ld[0] - fC, y: y0, z: zc, dx: fC, dy: len, dz: h,
            biblio: bibDe(bibCorr, { encaixe: 'esticar', longo: 'y', virar: ld[1] > 0 ? !!bibCorr.virar : !bibCorr.virar,
              mover: { tipo: 'trilho', eixo: 'x', parede: ld[1] > 0 ? 'min' : 'max', movel: conj, meio: meioB } }) }, r));
        });
        return;
      }
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
        matFrenteAtual = cfg.frente2 && spec.materiais.frente2 ? 'frente2' : 'frente';
        usarEstilo(cfg);
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
          reg = { x0: vm.x0 + (extEsq ? (cantosArred ? raioC + g / 2 : 0) : g / 2), x1: vm.x1 - (extDir ? (cantosArred ? raioC + g / 2 : 0) : g / 2),
            z0: sm.z0 + (extBaixo ? 0 : g / 2), z1: sm.z1 - (extTopo ? folgaTopoF : g / 2), y0: -Tf };
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

        // alturas das prateleiras: escolhidas (mm do piso interno do vão até a face de cima) ou iguais
        function alturasPrat(n, itop) {
          var bruto = cfg.pratAlturas || [], alt = [];
          for (var ka = 0; ka < n; ka++) alt.push(Number(bruto[ka]));
          var out = [];
          for (var k = 1; k <= n; k++) {
            var auto = (itop - sm.ib) * k / (n + 1) + T / 2;
            var v = isNum(alt[k - 1]) && alt[k - 1] > 0 ? alt[k - 1] : auto;
            out.push(clamp(v, T + 60, itop - sm.ib - 60));
          }
          out.sort(function (a, b) { return a - b; });
          for (var q = 1; q < out.length; q++) if (out[q] - out[q - 1] < T + 40) { aviso(rot + ': prateleiras com só ' + fmtCm(out[q] - out[q - 1] - T) + ' de vão entre elas. Por quê: abaixo de 4 cm não cabe nada nem a mão.', ref); break; }
          return out;
        }
        function prateleirasMoveis(n, topoLim) {
          if (vm.cuba) return;
          var itop = isNum(topoLim) ? Math.min(topoLim, sm.it) : sm.it;
          var pd = profUtil - yInt - spec.prateleiras.recuo;
          // divisória interna (atrás das portas): posição em mm a partir da lateral esquerda interna
          var faixas = [[vm.il, vm.ir]];
          if (cfg.divOn) {
            var posD = isNum(cfg.divInterna) && cfg.divInterna > 0 ? cfg.divInterna : vm.largInt / 2; // padrão: no meio
            var xd = clamp(vm.il + posD - T / 2, vm.il + 100, vm.ir - 100 - T);
            fab.chapa({ nome: 'Divisória interna', grupo: 'caixa', mat: matInt, eixoEsp: 'x', x: xd, y: yInt + spec.prateleiras.recuo, z: sm.ib, dx: T, dy: pd, dz: itop - sm.ib,
              veio: 'z', fitas: ['z'], vao: vi, col: colIdx0, secao: j, obs: 'Fixa por cavilhas na base e no topo do vão' });
            faixas = [[vm.il, xd], [xd + T, vm.ir]];
            if (Math.min(xd - vm.il, vm.ir - xd - T) < 150) aviso(rot + ': a divisória interna deixa um lado com menos de 15 cm. Por quê: vão estreito demais para guardar e para a mão.', ref);
          }
          if (n <= 0) return;
          var alts = alturasPrat(n, itop);
          faixas.forEach(function (fx) {
            var pw = fx[1] - fx[0] - 2 * spec.prateleiras.folga;
            alts.forEach(function (a) {
              fab.chapa({ nome: 'Prateleira', grupo: 'caixa', mat: matInt, eixoEsp: 'z',
                x: fx[0] + spec.prateleiras.folga, y: yInt + spec.prateleiras.recuo, z: sm.ib + a - T, dx: pw, dy: pd, dz: T,
                veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, obs: 'Móvel (4 pinos) · ' + Math.round(a) + ' mm do piso do vão' });
              cont.prateleirasMoveis++;
            });
            if (fx[1] - fx[0] > 800) vaosLargosPrat.push(colIdx0);
          });
        }
        function cabideiro() {
          var zt = sm.it - 60;
          fab.objeto({ nome: 'Tubo cabideiro', grupo: 'ferragem', mat: 'metal', x: vm.il, y: (yInt + profUtil) / 2 - 12.5, z: zt - 15, dx: vm.largInt, dy: 25, dz: 15, vao: vi, col: colIdx0, secao: j });
          cont.cabideiroMm += vm.largInt; cont.suportesCabideiro += 2;
          if (sm.altInt < 900) aviso(rot + ': cabideiro com ' + fmtCm(sm.altInt) + ' de altura interna (camisas pedem ~100 cm; vestidos longos ~150 cm).', ref);
          if (profUtil < 520) aviso(rot + ': profundidade útil de ' + fmtCm(profUtil) + ' é pouca para cabides (ideal ≥ 55 cm).', ref);
        }
        // Coifa embutida no aéreo: o aparelho embaixo (a base leva o recorte dele), o duto subindo pelo meio
        // do vão e furo no topo para ele passar. Medidas do aparelho editáveis (confira no manual da coifa).
        function coifaEmbutida() {
          var cf = deepMerge({ largura: 520, profundidade: 280, altura: 160, duto: 150 }, cfg.coifa || {});
          var cw = Math.min(cf.largura, vm.largInt - 10), cd = Math.min(cf.profundidade, profUtil - yInt - 10), ch = Math.min(cf.altura, sm.altInt - 60);
          var cx0 = vm.il + (vm.largInt - cw) / 2, cy0 = yInt + (profUtil - yInt - cd) / 2;
          fab.objeto({ nome: 'Coifa embutida', grupo: 'ferragem', mat: 'metal', x: cx0, y: cy0, z: sm.ib - T, dx: cw, dy: cd, dz: ch + T, vao: vi, col: colIdx0, secao: j, obs: 'Conforme o fabricante · a base leva recorte de ' + Math.round(cw) + ' × ' + Math.round(cd) + ' mm' });
          var dd = clamp(cf.duto, 100, 200), dcx = cx0 + cw / 2, dcy = cy0 + cd / 2;
          var circ = []; for (var kq = 0; kq < 20; kq++) { var aq = kq * Math.PI / 10; circ.push([r1(dd / 2 + dd / 2 * Math.cos(aq)), r1(dd / 2 + dd / 2 * Math.sin(aq))]); }
          var zDuto = sm.ib + ch, sobe = extTopo ? zTop - zDuto + 40 : sm.it - zDuto;
          if (!extTopo) aviso(rot + ': a coifa não está na faixa de cima: o duto precisa atravessar as faixas acima (preveja furo Ø' + (dd + 10) + ' nas peças).', ref);
          fab.objeto({ nome: 'Duto da coifa Ø' + dd, grupo: 'ferragem', mat: 'metal', x: dcx - dd / 2, y: dcy - dd / 2, z: zDuto, dx: dd, dy: dd, dz: sobe, vao: vi, col: colIdx0, secao: j, forma: { plano: 'xy', pts: circ }, obs: 'Sai pelo topo do móvel até a saída do forro/parede' });
          cont.coifas = (cont.coifas || []).concat([{ w: cw, d: cd, duto: dd }]);
          // furo no topo e recorte na base (anotados nas peças; o furo do topo é desenhado)
          fab.lista.forEach(function (p) {
            if (extTopo && /^Topo/.test(p.nome) && p.x <= dcx && p.x + p.dx >= dcx) {
              p.furo = { eixo: 'z', x: r1(dcx - p.x), y: r1(dcy - p.y), d: dd + 10 };
              p.obs = (p.obs ? p.obs + ' · ' : '') + 'furo Ø' + (dd + 10) + ' p/ duto da coifa';
            }
            if (/^Base/.test(p.nome) && p.x <= dcx && p.x + p.dx >= dcx) p.obs = (p.obs ? p.obs + ' · ' : '') + 'recorte ' + Math.round(cw) + ' × ' + Math.round(cd) + ' mm p/ coifa';
          });
          R.elementos.push({ tipo: 'coifa', nome: 'Coifa embutida', col: colIdx0, texto: 'Coifa de ' + Math.round(cw) + ' × ' + Math.round(cd) + ' mm na base do aéreo, duto Ø' + dd + ' mm saindo por furo no topo. Confirme as medidas no manual do aparelho.' });
          if (tipo !== 'aereo') aviso(rot + ': coifa embutida é para armário aéreo sobre o cooktop.', ref);
        }
        function interior() {
          if (Array.isArray(cfg.interno) && cfg.interno.length) return interiorModulos(cfg.interno);
          if (cfg.interior === 'cabideiro') cabideiro();
          else if (cfg.interior === 'prateleiras') prateleirasMoveis(cfg.prateleiras);
        }

        // Interior montado por módulos, de baixo para cima, separados por prateleiras fixas.
        // Altura de cada módulo: a digitada; senão a recomendada (gavetas, sapateira, cabideiro);
        // prateleiras, maleiro e vazio dividem o que sobra.
        function interiorModulos(lista) {
          if (vm.cuba) { info(rot + ': módulo da cuba fica livre para o sifão (o interior por módulos não se aplica).', ref); return; }
          var mods = lista.map(function (m) { return { tipo: MODULOS_INTERNOS[m.tipo] ? m.tipo : 'prateleiras', qtd: +m.qtd || 0, uso: USOS_CABIDEIRO[m.uso] ? m.uso : 'medio', altura: +m.altura > 0 ? +m.altura : 0 }; });
          var tot = sm.it - sm.ib, nDiv = mods.length - 1;
          function pref(m) {
            if (m.tipo === 'gavetas') return (m.qtd || 2) * REC_INTERNO.gaveta;
            if (m.tipo === 'sapateira' && m.qtd) return m.qtd * REC_INTERNO.sapateira;
            if (m.tipo === 'cabideiro') return USOS_CABIDEIRO[m.uso].altura;
            return 0; // flexível
          }
          var hs = mods.map(function (m) { return m.altura || pref(m); });
          var flex = mods.map(function (m, k) { return !m.altura && !pref(m); });
          var soma = hs.reduce(function (a, b) { return a + b; }, 0);
          var sobra = tot - nDiv * T - soma, nFlex = flex.filter(Boolean).length;
          if (sobra >= 0) {
            if (nFlex) hs = hs.map(function (h, k) { return flex[k] ? sobra / nFlex : h; });
            else { // sem módulo flexível: a sobra vai para o cabideiro de cima (ou o último módulo)
              var kc = -1; mods.forEach(function (m, k) { if (m.tipo === 'cabideiro' && !m.altura) kc = k; });
              if (kc < 0) kc = mods.length - 1;
              hs[kc] += sobra;
            }
          } else {
            aviso(rot + ': os módulos internos somam ' + fmtCm(soma + nDiv * T) + ' e o vão tem ' + fmtCm(tot) + '. Por quê: não cabe tudo; as alturas foram reduzidas na proporção. Tire um módulo ou diminua as alturas.', ref);
            var fator = (tot - nDiv * T) / Math.max(1, soma);
            hs = hs.map(function (h) { return Math.max(60, h * fator); });
          }
          var pd = profUtil - yInt - spec.prateleiras.recuo;
          var z = sm.ib;
          mods.forEach(function (m, k) {
            var h = hs[k];
            moduloInterno(m, z, z + h);
            R.elementos.push({ tipo: 'modulo', nome: MODULOS_INTERNOS[m.tipo] + (m.tipo === 'cabideiro' ? ' ' + m.uso : ''), col: colIdx0, vao: vi, x0: vm.il, x1: vm.ir, z0: z, z1: z + h,
              texto: MODULOS_INTERNOS[m.tipo] + (m.tipo === 'cabideiro' ? ' ' + USOS_CABIDEIRO[m.uso].nome : '') + ' · ' + fmtCm(h) + ' de altura livre' });
            z += h;
            if (k < mods.length - 1) {
              fab.chapa({ nome: 'Prateleira fixa', grupo: 'caixa', mat: matInt, eixoEsp: 'z', x: vm.il, y: yInt + spec.prateleiras.recuo, z: z, dx: vm.largInt, dy: pd, dz: T,
                veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, obs: 'Fixa (cavilha) · divide os módulos internos' });
              z += T;
            }
          });
        }
        function moduloInterno(m, z0, z1) {
          var h = z1 - z0, pd = profUtil - yInt - spec.prateleiras.recuo;
          var r0 = { vao: vi, col: colIdx0, secao: j };
          if (m.tipo === 'prateleiras' || m.tipo === 'maleiro') {
            var n = m.tipo === 'maleiro' ? (m.qtd || 0) : (m.qtd || Math.max(0, Math.round(h / REC_INTERNO.prateleira) - 1));
            for (var k = 1; k <= n; k++) {
              var zc = z0 + h * k / (n + 1) - T / 2;
              fab.chapa(Object.assign({ nome: 'Prateleira', grupo: 'caixa', mat: matInt, eixoEsp: 'z', x: vm.il + spec.prateleiras.folga, y: yInt + spec.prateleiras.recuo, z: zc, dx: vm.largInt - 2 * spec.prateleiras.folga, dy: pd, dz: T,
                veio: 'x', fitas: ['x'], obs: 'Móvel (4 pinos)' }, r0));
              cont.prateleirasMoveis++;
            }
            if (vm.largInt > 800 && n) vaosLargosPrat.push(colIdx0);
          } else if (m.tipo === 'sapateira') {
            // prateleiras a cada ~19 cm com barra na frente para o salto não escorregar
            var ns = m.qtd || Math.max(1, Math.floor(h / REC_INTERNO.sapateira));
            var passoS = h / ns;
            for (var q = 0; q < ns; q++) {
              var zs = z0 + q * passoS;
              if (q > 0) fab.chapa(Object.assign({ nome: 'Prateleira', grupo: 'caixa', mat: matInt, eixoEsp: 'z', x: vm.il + spec.prateleiras.folga, y: yInt + spec.prateleiras.recuo, z: zs - T, dx: vm.largInt - 2 * spec.prateleiras.folga, dy: pd, dz: T,
                veio: 'x', fitas: ['x'], obs: 'Sapateira (4 pinos)' }, r0));
              fab.objeto(Object.assign({ nome: 'Barra da sapateira', grupo: 'ferragem', mat: 'metal', x: vm.il, y: yInt + spec.prateleiras.recuo + 30, z: zs + 35, dx: vm.largInt, dy: 10, dz: 10 }, r0));
            }
            cont.sapateiras = (cont.sapateiras || 0) + ns;
            if (passoS < 150) aviso(rot + ': sapateira com ' + fmtCm(passoS) + ' por nível. Por quê: abaixo de 15 cm só cabe rasteirinha; tênis e botinhas pedem 18 a 20 cm.', ref);
          } else if (m.tipo === 'cabideiro') {
            var zt = z1 - 60;
            fab.objeto(Object.assign({ nome: 'Tubo cabideiro', grupo: 'ferragem', mat: 'metal', x: vm.il, y: (yInt + profUtil) / 2 - 12.5, z: zt - 15, dx: vm.largInt, dy: 25, dz: 15, obs: 'Cabideiro ' + USOS_CABIDEIRO[m.uso].nome }, r0));
            cont.cabideiroMm += vm.largInt; cont.suportesCabideiro += 2;
            var rec = USOS_CABIDEIRO[m.uso].altura;
            if (h < rec - 80) aviso(rot + ': cabideiro ' + m.uso + ' com ' + fmtCm(h) + ' de altura livre (recomendado ' + fmtCm(rec) + '). Por quê: a roupa encosta embaixo e amassa.', ref);
            if (profUtil < 520) aviso(rot + ': profundidade útil de ' + fmtCm(profUtil) + ' é pouca para cabides (ideal ≥ 55 cm).', ref);
          } else if (m.tipo === 'gavetas') {
            // gavetas internas atrás das portas: calço de 25 mm de cada lado para passar da dobradiça e da porta aberta
            var calco = 25, nG2 = m.qtd || Math.max(1, Math.min(4, Math.floor(h / REC_INTERNO.gaveta)));
            var xi0 = vm.il + calco, xi1 = vm.ir - calco, yG = yInt + 20;
            fab.chapa(Object.assign({ nome: 'Calço da gaveta interna', grupo: 'caixa', mat: matInt, eixoEsp: 'x', x: vm.il, y: yG, z: z0, dx: calco, dy: profUtil - yG - 5, dz: h, veio: 'y', fitas: ['y'], obs: 'Afasta a gaveta da dobradiça (pode ser 2 chapas de 12,5)' }, r0));
            fab.chapa(Object.assign({ nome: 'Calço da gaveta interna', grupo: 'caixa', mat: matInt, eixoEsp: 'x', x: vm.ir - calco, y: yG, z: z0, dx: calco, dy: profUtil - yG - 5, dz: h, veio: 'y', fitas: ['y'], obs: 'Afasta a gaveta da dobradiça (pode ser 2 chapas de 12,5)' }, r0));
            var fhI = h / nG2;
            var lenI2 = compCorredica(profUtil - yG - Tg - 10);
            if (!lenI2) { erro(rot + ': profundidade insuficiente para gaveta interna.', ref); return; }
            for (var gk = 0; gk < nG2; gk++) {
              var zf0 = z0 + gk * fhI + 2, hfI = fhI - 4;
              var hbI = Math.max(60, hfI - 30);
              var cjI2 = fab.conjunto({ nome: 'Gaveta interna ' + (gk + 1), tipo: 'corre', curso: Math.round(lenI2 * 0.85), vao: vi, col: colIdx0, secao: j });
              var bx0I = xi0 + 12.5, bWI = xi1 - xi0 - 25, yBI = yG + Tg;
              fab.chapa({ nome: 'Frente gaveta interna', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: xi0 + 1, y: yG, z: zf0, dx: xi1 - xi0 - 2, dy: Tg, dz: hfI, veio: 'x', fitas: ['x', 'x', 'z', 'z'], vao: vi, col: colIdx0, secao: j, conj: cjI2, obs: 'Gaveta interna atrás da porta' });
              fab.chapa({ nome: 'Lateral gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: bx0I, y: yBI, z: zf0 + 10, dx: Tg, dy: lenI2, dz: hbI, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjI2 });
              fab.chapa({ nome: 'Lateral gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: bx0I + bWI - Tg, y: yBI, z: zf0 + 10, dx: Tg, dy: lenI2, dz: hbI, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjI2 });
              fab.chapa({ nome: 'Traseira gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: bx0I + Tg, y: yBI + lenI2 - Tg, z: zf0 + 10, dx: bWI - 2 * Tg, dy: Tg, dz: hbI, veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, conj: cjI2 });
              fab.chapa({ nome: 'Fundo gaveta', grupo: 'gaveta', mat: 'fundoGaveta', eixoEsp: 'z', x: bx0I + Tg - 8, y: yBI + Tg - 8, z: zf0 + 20, dx: bWI - 2 * Tg + 16, dy: lenI2 - 2 * Tg + 16, dz: Fg, fitas: [], vao: vi, col: colIdx0, secao: j, conj: cjI2, obs: 'Gaveta interna · rasgo 8 mm' });
              corredicasVisuais(xi0, xi1, zf0 + 10 + Math.max(4, (hbI - Math.min(45, hbI - 10)) / 2), yBI, lenI2, cjI2, r0, hbI - 10);
              cont.corredicas[lenI2] = (cont.corredicas[lenI2] || 0) + 1;
              cont.gavetas++;
            }
            if (fhI < 120) aviso(rot + ': gaveta interna com ' + fmtCm(fhI) + ' de altura. Por quê: abaixo de 12 cm não cabe nem roupa dobrada; use menos gavetas.', ref);
          }
        }

        // ------------------------------------------------ PORTAS
        if (cfg.tipo === 'portas' || cfg.tipo === 'coifa') {
          if (cfg.tipo === 'coifa') coifaEmbutida(); else interior();
          var portasLista = [], cantos = [];
          vm.colunas.forEach(function (cc, kc) {
            var cx0, cx1;
            if (embutida) { cx0 = kc === 0 ? reg.x0 : cc.x0 + g / 2; cx1 = kc === vm.colunas.length - 1 ? reg.x1 : cc.x1 - g / 2; }
            else { cx0 = kc === 0 ? reg.x0 : cc.x0 + g / 2; cx1 = kc === vm.colunas.length - 1 ? reg.x1 : cc.x1 - g / 2; }
            // canto cego (cozinha em L): a parte escondida atrás do outro balcão fica sem porta
            var colC = spec.colunas[cc.idx] || {};
            var cego = 0;
            if (colC.canto === 'esq' || colC.canto === 'dir') {
              cego = clamp(+colC.cego || (D + 20), 300, cx1 - cx0 - 250);
              var esp = 70; // espaçador: a porta do outro balcão (e o puxador) não bate nesta
              if (colC.canto === 'dir') { cx1 -= cego; } else { cx0 += cego; }
              // espaçador de frente, no plano das portas, colado logo depois da porta
              var xEsp = colC.canto === 'dir' ? cx1 + g : cx0 - g - esp;
              fab.chapa({ nome: 'Espaçador do canto', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xEsp, y: reg.y0, z: reg.z0, dx: esp, dy: Tf, dz: regH, veio: 'z', fitas: ['z', 'z'], vao: vi, col: cc.idx, secao: j, obs: 'Canto cego · fixo · o balcão do outro lado encosta aqui' });
              cantos.push({ col: cc.idx, lado: colC.canto, cego: cego });
            }
            var cw = cx1 - cx0;
            // cada coluna decide as próprias portas (mesclar o interno não muda o externo)
            var cfgC = (spec.colunas[cc.idx] && spec.colunas[cc.idx].secoes[j]) || cfg;
            var nP = cego ? 1 : (cfgC.portas > 0 ? Math.min(2, cfgC.portas) : (cw > Math.min(spec.larguraMax, 600) + 1 ? 2 : 1));
            var pw = nP === 2 ? (cw - g) / 2 : cw;
            for (var k = 0; k < nP; k++) portasLista.push({ x: cx0 + k * (pw + g), w: pw, col: cc.idx, canto: cego ? colC.canto : null });
          });
          var nTot = portasLista.length;
          // ângulo da dobradiça: escolhido (110°, 155°, 170°) ou automático (155° quando há gaveta interna atrás)
          var temGavInt = Array.isArray(cfg.interno) && cfg.interno.some(function (m) { return m.tipo === 'gavetas'; });
          var angDob = [110, 155, 170].indexOf(+fr.anguloDobradica) >= 0 ? +fr.anguloDobradica : (temGavInt ? 155 : 110);
          if (temGavInt && angDob < 155) aviso(rot + ': gaveta interna atrás de porta com dobradiça de ' + angDob + '°. Por quê: a porta aberta a 95° fica na frente da gaveta; use dobradiça de 155° ou 165°.', ref);
          cont.angulosDob = cont.angulosDob || {};
          portasLista.forEach(function (pp, k) {
            var lado;
            if (pp.canto) lado = pp.canto === 'dir' ? 'esq' : 'dir'; // dobradiça do lado oposto ao canto
            else if (nTot === 1) {
              lado = cfg.dobradica === 'dir' ? 'dir' : (cfg.dobradica === 'esq' ? 'esq' : (extDir && !extEsq ? 'dir' : 'esq'));
            } else if (nTot === 2) lado = k === 0 ? 'esq' : 'dir';
            else lado = (k % 2 === 0) ? 'esq' : 'dir';
            var interno = nTot > 2 && ((lado === 'esq' && k > 0) || (lado === 'dir' && k < nTot - 1));
            var th = tipoHinge(lado, false);
            var pesoP = pesoPorta(pp.w, regH, Tf, estilo) + (estilo === 'ripada' ? (pp.w * regH * ripa.espessura / 1e9) * 750 * ripa.largura / (ripa.largura + ripa.espaco) : 0);
            var nd = nDobradicas(regH, pp.w, pesoP);
            if (pesoP > 16) aviso(rot + ': porta de ~' + Math.round(pesoP) + ' kg. Por quê: passa do que as dobradiças comuns seguram bem por muito tempo; use ' + nd + ' dobradiças, MDF mais leve ou divida em duas portas.', ref);
            cont.dobradicas[th] += nd; cont.portas++; puxadorConta();
            var pivX = lado === 'esq' ? pp.x : pp.x + pp.w;
            var abre = pp.canto ? 160 : { 110: 95, 155: 150, 170: 165 }[angDob]; // canto: 165° para abrir o vão todo
            if (pp.canto) cont.angulosDob[165] = (cont.angulosDob[165] || 0) + 0;
            cont.angulosDob[angDob] = (cont.angulosDob[angDob] || 0) + nd;
            var cj = fab.conjunto({ nome: 'Porta', tipo: 'giro', eixo: 'z', pivot: { x: pivX, y: reg.y0, z: reg.z0 }, angulo: lado === 'esq' ? -abre : abre, vao: vi, col: pp.col, secao: j });
            var cfgPorta = (spec.colunas[pp.col] && spec.colunas[pp.col].secoes[j]) || cfg;
            usarEstilo(cfgPorta);
            matFrenteAtual = cfgPorta.frente2 && spec.materiais.frente2 ? 'frente2' : 'frente';
            var porta = frente({ nome: 'Porta', x: pp.x, y0: reg.y0, z: reg.z0, w: pp.w, h: regH, veio: veioF, vidroOk: true,
              vao: vi, col: pp.col, secao: j, conj: cj,
              obs: 'De abrir, dobradiça ' + nomeHinge[th] + ' à ' + (lado === 'esq' ? 'esquerda' : 'direita') + ' (' + nd + ' un)' + (vm.cuba ? ' · lado da cuba abaixo do fundo dela' : ''),
              meta: { tipo: 'porta', dobradica: lado, nDobradicas: nd, hinge: th } });
            aplicarPuxador(porta, { x: pp.x, z: reg.z0, w: pp.w, h: regH, y0: reg.y0, vidro: !porta && estilo === 'vidro', conj: cj, tipoFrente: 'porta', lado: lado, vao: vi, col: pp.col, secao: j });
            dobradicasVisuais(pp.x, pp.w, reg.z0, regH, lado, nd, cj, { vao: vi, col: pp.col, secao: j });
            if (interno) erro(rot + ': sem divisória entre as portas, a ' + (k + 1) + 'ª porta não tem onde fixar a dobradiça. Por quê: a dobradiça precisa de uma lateral ou divisória. Use divisórias "cada par"/"cada porta" ou, ao mesclar o interno, deixe no máximo 2 portas no vão (uma abre para cada lado).', ref);
            if (pp.w > 600) aviso(rot + ': porta com ' + fmtCm(pp.w) + ' de largura passa do recomendado (até 60 cm). Por quê: o peso e a alavanca forçam as dobradiças, a porta cai com o tempo e abre muito sobre a circulação. Divida em duas portas ou aumente o número de colunas.', ref);
            if (regH > 2200) aviso(rot + ': porta com ' + fmtCm(regH) + ' de altura. Por quê: porta alta empena com a umidade e o próprio peso. Use ' + nd + ' dobradiças, endireitador de porta (ou puxador perfil, que trava) e, se possível, MDF de 25 mm.', ref);
            if (pp.w < 250) aviso(rot + ': porta com ' + fmtCm(pp.w) + ' de largura não é recomendada (mínimo 25 cm). Por quê: a dobradiça e o puxador quase se encontram, a porta abre pouco e o espaço interno fica difícil de usar. Use nicho, porta-temperos ou junte com a coluna ao lado.', ref);
          });
          cantos.forEach(function (ct) {
            R.elementos.push({ tipo: 'canto', nome: 'Canto cego', col: ct.col, texto: 'Canto cego de ' + fmtCm(ct.cego) + ' à ' + (ct.lado === 'dir' ? 'direita' : 'esquerda') + ' (fica atrás do balcão do outro lado); porta com dobradiça de 165° e espaçador de 70 mm.' });
            info('Coluna ' + (ct.col + 1) + ': canto cego de ' + fmtCm(ct.cego) + ' — use dobradiça de 165° na porta e, se quiser aproveitar o fundo, um aramado de canto (canto mágico ou bandejas giratórias).');
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

        // ------------------------------------------------ PORTAS DE CORRER
        // Folhas sobrepostas em dois planos, correndo num trilho superior (roldanas) com guia embaixo.
        // As folhas da frente correm por cima das de trás; transpasse de 30 mm entre elas.
        else if (cfg.tipo === 'correr') {
          interior();
          // colunas vizinhas com portas de correr na mesma faixa formam um só conjunto: as folhas
          // atravessam as divisórias (que ficam atrás, segurando as prateleiras)
          var correrEm = function (v) { return v && v.secoes.filter(function (s2) { return s2.cfg.tipo === 'correr' && Math.abs(s2.z0 - sm.z0) < 1 && Math.abs(s2.z1 - sm.z1) < 1; })[0]; };
          if (correrEm(vaosM[vi - 1])) return; // as folhas já foram desenhadas a partir do primeiro vão do conjunto
          var ultimo = vm;
          while (correrEm(vaosM[ultimo.idx + 1])) ultimo = vaosM[ultimo.idx + 1];
          var extDirC = ultimo.idx === nV - 1;
          var rc = { x0: vm.x0 + (extEsq ? (cantosArred ? raioC + g / 2 : 0) : g / 2), x1: ultimo.x1 - (extDirC ? (cantosArred ? raioC + g / 2 : 0) : g / 2), z0: sm.z0 + (extBaixo ? 0 : g / 2), z1: sm.z1 - (extTopo ? folgaTopoF : g / 2) };
          var trans = 30, tSup = 18, tInf = 10, folgaPl = 6;
          var wC = rc.x1 - rc.x0, hF = rc.z1 - rc.z0 - tSup - tInf - 4;
          // folhas: escolhidas (2, 3 ou 4) ou automáticas, para cada folha ficar com até ~1 m
          var nF = [2, 3, 4].indexOf(+cfg.folhas) >= 0 ? +cfg.folhas : (wC <= 1900 ? 2 : (wC <= 2800 ? 3 : 4));
          var fw = (wC + (nF - 1) * trans) / nF;
          var yA = -Tf, yB = -2 * Tf - folgaPl, yTr = yB; // planos: de trás (A) e da frente (B)
          var bibK = spec.leve ? null : bibOk(cfg.bibCorrer);
          // trilho superior (duplo) e guia inferior, na largura toda
          fab.objeto({ nome: bibK ? 'Trilho ' + bibK.nome : 'Trilho superior duplo (porta de correr)', grupo: 'ferragem', mat: 'metal', x: rc.x0, y: yTr, z: rc.z1 - tSup, dx: wC, dy: -yTr, dz: tSup, vao: vi, col: colIdx0, secao: j,
            forma: bibK ? null : { plano: 'yz', pts: [[0, 0], [2, 0], [2, tSup - 2], [Tf + folgaPl / 2 - 1, tSup - 2], [Tf + folgaPl / 2 - 1, 0], [Tf + folgaPl / 2 + 1, 0], [Tf + folgaPl / 2 + 1, tSup - 2], [-yTr - 2, tSup - 2], [-yTr - 2, 0], [-yTr, 0], [-yTr, tSup], [0, tSup]] },
            biblio: bibK ? bibDe(bibK, { encaixe: 'esticar', longo: 'x', apoiar: 'z' }) : null });
          fab.objeto({ nome: 'Guia inferior (porta de correr)', grupo: 'ferragem', mat: 'metal', x: rc.x0, y: yTr, z: rc.z0, dx: wC, dy: -yTr, dz: tInf, vao: vi, col: colIdx0, secao: j,
            forma: { plano: 'yz', pts: [[0, 0], [-yTr, 0], [-yTr, tInf], [-yTr - 2, tInf], [-yTr - 2, 2], [Tf + folgaPl / 2 + 1, 2], [Tf + folgaPl / 2 + 1, tInf], [Tf + folgaPl / 2 - 1, tInf], [Tf + folgaPl / 2 - 1, 2], [2, 2], [2, tInf], [0, tInf]] } });
          for (var kf = 0; kf < nF; kf++) {
            var frenteDaFrente = kf % 2 === 1;
            var xf = rc.x0 + kf * (fw - trans);
            var cjF = frenteDaFrente ? fab.conjunto({ nome: 'Porta de correr ' + (kf + 1), tipo: 'corre', eixo: 'x', curso: -Math.round(fw - trans), vao: vi, col: colIdx0, secao: j }) : null;
            var yF = frenteDaFrente ? yB : yA, zF = rc.z0 + tInf + 2;
            var metaF = { tipo: 'correr', folha: kf + 1, folhas: nF, plano: frenteDaFrente ? 'frente' : 'tras' };
            var obsF = 'Correr · ' + nF + ' folhas · transpasse ' + trans + ' mm · roldanas no trilho superior';
            var rF = { vao: vi, col: colIdx0, secao: j, conj: cjF };
            // acabamento de cada folha: MDF, vidro (com o tipo), reflecta ou espelho em quadro de alumínio, ou palhinha
            var cfgF = (cfg.folhasCfg || [])[kf] || {};
            var acab = cfgF.acab || cfg.acabCorrer || 'mdf';
            var folha = null;
            if (acab === 'vidro' || acab === 'reflecta' || acab === 'espelho') {
              var pq = 25, tipoV = acab === 'vidro' ? (VIDROS[cfgF.vidro || cfg.vidroCorrer] ? (cfgF.vidro || cfg.vidroCorrer) : 'incolor') : acab;
              [[xf, zF, pq, hF], [xf + fw - pq, zF, pq, hF], [xf + pq, zF, fw - 2 * pq, pq], [xf + pq, zF + hF - pq, fw - 2 * pq, pq]].forEach(function (q) {
                fab.objeto(Object.assign({ nome: 'Quadro de alumínio da folha', grupo: 'frente', mat: 'metal', x: q[0], y: yF, z: q[1], dx: q[2], dy: Tf, dz: q[3] }, rF));
              });
              folha = fab.objeto(Object.assign({ nome: VIDROS[tipoV].nome + ' (folha de correr)', grupo: 'frente', mat: 'vidro_' + tipoV, x: xf + pq, y: yF + Tf / 2 - 2, z: zF + pq, dx: fw - 2 * pq, dy: 4, dz: hF - 2 * pq, obs: obsF, meta: metaF }, rF));
              cont.vidrosCorrer = cont.vidrosCorrer || {};
              cont.vidrosCorrer[VIDROS[tipoV].nome] = (cont.vidrosCorrer[VIDROS[tipoV].nome] || 0) + (fw - 2 * pq) * (hF - 2 * pq) / 1e6;
              cont.perfilCorrerMm = (cont.perfilCorrerMm || 0) + 2 * (fw + hF);
            } else if (acab === 'palhinha' && fw >= 240) {
              var qm2 = 70;
              folha = fab.chapa(Object.assign({ nome: 'Folha de correr · montante', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xf, y: yF, z: zF, dx: qm2, dy: Tf, dz: hF, veio: 'z', fitas: ['z', 'z', 'x', 'x'], obs: 'quadro p/ tela', meta: metaF }, rF));
              fab.chapa(Object.assign({ nome: 'Folha de correr · montante', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xf + fw - qm2, y: yF, z: zF, dx: qm2, dy: Tf, dz: hF, veio: 'z', fitas: ['z', 'z', 'x', 'x'], obs: 'quadro p/ tela' }, rF));
              fab.chapa(Object.assign({ nome: 'Folha de correr · travessa', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xf + qm2, y: yF, z: zF, dx: fw - 2 * qm2, dy: Tf, dz: qm2, veio: 'x', fitas: ['x'] }, rF));
              fab.chapa(Object.assign({ nome: 'Folha de correr · travessa', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xf + qm2, y: yF, z: zF + hF - qm2, dx: fw - 2 * qm2, dy: Tf, dz: qm2, veio: 'x', fitas: ['x'] }, rF));
              fab.objeto(Object.assign({ nome: 'Tela ' + telaInfo.nome.toLowerCase(), grupo: 'frente', mat: 'tela', x: xf + qm2, y: yF + Tf / 2 - 1.5, z: zF + qm2, dx: fw - 2 * qm2, dy: 3, dz: hF - 2 * qm2 }, rF));
              cont.telaM2 = (cont.telaM2 || 0) + (fw - 2 * qm2 + 16) * (hF - 2 * qm2 + 16) / 1e6;
            } else {
              folha = fab.chapa(Object.assign({ nome: 'Folha de correr', grupo: 'frente', mat: matFrenteAtual, eixoEsp: 'y', x: xf, y: yF, z: zF, dx: fw, dy: Tf, dz: hF, veio: veioF, fitas: ['x', 'x', 'z', 'z'], obs: obsF, meta: metaF }, rF));
            }
            // puxador da folha, na borda que fica livre: concha embutida, perfil vertical, cava vertical ou nenhum
            var puxC = cfg.puxCorrer || 'concha';
            var bordaLivreDir = kf === 0; // a primeira folha puxa pela direita; as outras, pela esquerda
            if (puxC === 'concha') {
              var xc = bordaLivreDir ? xf + fw - trans - 50 : xf + 30;
              fab.objeto(Object.assign({ nome: 'Puxador concha', grupo: 'ferragem', mat: 'metal', x: xc, y: yF - 1, z: zF + hF / 2 - 60, dx: 20, dy: 6, dz: 120 }, rF));
            } else if (puxC === 'perfil' && acab === 'mdf') {
              var xpv = bordaLivreDir ? xf + fw - trans - 22 : xf;
              fab.objeto(Object.assign({ nome: 'Perfil puxador vertical', grupo: 'ferragem', mat: 'metal', x: xpv, y: yF, z: zF, dx: 22, dy: Tf, dz: hF, obs: 'Embutido na borda da folha (não raspa na outra folha)' }, rF));
              cont.puxadorPerfilMm += hF;
            } else if (puxC === 'cava' && acab === 'mdf') {
              var xcv = bordaLivreDir ? xf + fw - trans - 18 : xf + 2;
              fab.objeto(Object.assign({ nome: 'Cava vertical usinada', grupo: 'ferragem', mat: 'plastico', x: xcv, y: yF - 0.5, z: zF + hF * 0.3, dx: 16, dy: 1, dz: hF * 0.4, obs: 'Cava usinada na face, 16 mm' }, rF));
            }
            cont.portasCorrer = (cont.portasCorrer || 0) + 1; cont.portas++;
            if (!folha && estilo !== 'vidro' && estilo !== 'palhinha') aviso(rot + ': folha de correr não desenhada.', ref);
          }
          cont.trilhoCorrerMm = (cont.trilhoCorrerMm || 0) + wC;
          cont.kitsCorrer = (cont.kitsCorrer || []).concat([{ folhas: nF, larg: wC, bib: bibK }]);
          R.elementos.push({ tipo: 'correr', nome: 'Portas de correr', col: colIdx0, frenteW: wC, frenteH: hF, folhas: nF,
            texto: nF + ' folhas de ' + fmtCm(fw) + ' × ' + fmtCm(hF) + ', transpasse de ' + trans + ' mm, trilho superior duplo com roldanas e guia inferior' + (bibK ? ' (' + bibK.nome + ')' : '') + '.' });
          if (fw > 1000) aviso(rot + ': folha de correr com ' + fmtCm(fw) + ' de largura passa do recomendado (até 1 m). Por quê: a folha larga pesa nas roldanas e empena; use 3 folhas.', ref);
          if (hF > 2400) aviso(rot + ': folha de correr com ' + fmtCm(hF) + ' de altura passa do recomendado (até 2,40 m). Por quê: empena com a umidade e sai do trilho; use MDF 25 mm ou perfil de alumínio.', ref);
          if (wC < 800) aviso(rot + ': portas de correr num vão de ' + fmtCm(wC) + '. Por quê: abaixo de ~80 cm cada folha abre menos de 40 cm e quase não dá para usar; prefira portas de giro.', ref);
          if (Array.isArray(cfg.interno) && cfg.interno.some(function (m) { return m.tipo === 'gavetas'; })) info(rot + ': gavetas internas atrás de porta de correr abrem com a folha corrida para o lado; deixe as gavetas no vão que fica livre quando a folha da frente corre.', ref);
          if (D < 450 && !cont.avisoCorrerProf) { cont.avisoCorrerProf = true; info('Portas de correr ficam ' + (2 * Tf + folgaPl) + ' mm à frente da caixa (dois planos de folha): considere isso na circulação.'); }
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
          // folga de cada lado entre a lateral do móvel e a da gaveta: a do modelo de corrediça escolhido
          // (ficha da biblioteca) ou a padrão (telescópica 12,5 mm; oculta 5 mm)
          var clear = bibCorr && +bibCorr.folga > 0 ? +bibCorr.folga : (oculta ? 5 : 12.5);
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
            if (it3.org === 'talheres' || it3.org === 'grade') {
              // divisórias de MDF 10 mm encaixadas (meia-madeira no cruzamento), na altura da caixa até 8 cm
              var dIx0 = bx0 + Tg, dIx1 = bx0 + bW - Tg, dIy0 = yBox + Tg, dIy1 = yBox + lenC - Tg, dZ = zBox + 10 + Fg, dH = Math.min(80, hbG - 30), eD = 10;
              var nL = it3.org === 'talheres' ? 4 : 3; // compartimentos no sentido da largura
              for (var dl = 1; dl < nL; dl++) fab.chapa({ nome: 'Divisória da gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'x', x: dIx0 + (dIx1 - dIx0) * dl / nL - eD / 2, y: dIy0, z: dZ, dx: eD, dy: dIy1 - dIy0, dz: dH, veio: 'y', fitas: ['y'], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: 'Organizador ' + it3.org });
              if (it3.org === 'grade') for (var dc = 1; dc < 3; dc++) fab.chapa({ nome: 'Divisória da gaveta', grupo: 'gaveta', mat: 'gaveta', eixoEsp: 'y', x: dIx0, y: dIy0 + (dIy1 - dIy0) * dc / 3 - eD / 2, z: dZ, dx: dIx1 - dIx0, dy: eD, dz: dH, veio: 'x', fitas: ['x'], vao: vi, col: colIdx0, secao: j, conj: cjG, obs: 'Organizador grade · meia-madeira' });
              if (dH < 40) aviso(rot + ': divisória da gaveta com só ' + fmtCm(dH) + ' de altura (caixa baixa).', ref);
            }
            if (oculta && bibCorr) {
              var meioO = fab.conjunto({ nome: 'Corrediça (trilho intermediário)', tipo: 'corre', curso: -Math.round(lenC * 0.85 / 2), pai: cjG, segue: true, vao: vi, col: colIdx0, secao: j });
              [[vm.il, 1], [vm.ir, -1]].forEach(function (ld) {
                var lwB = clear + Tg;
                fab.objeto({ nome: 'Corrediça ' + bibCorr.nome, grupo: 'ferragem', mat: 'metal', x: ld[1] > 0 ? ld[0] : ld[0] - lwB, y: yBox, z: zBox - 12.5, dx: lwB, dy: lenC, dz: 12, vao: vi, col: colIdx0, secao: j,
                  biblio: bibDe(bibCorr, { encaixe: 'esticar', longo: 'y', virar: ld[1] > 0 ? !!bibCorr.virar : !bibCorr.virar,
                    mover: { tipo: 'trilho', eixo: 'x', parede: ld[1] > 0 ? 'min' : 'max', movel: cjG, meio: meioO } }) });
              });
            } else if (oculta) {
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
          var bibA = spec.leve ? null : bibOk(cfg.bib);
          if (lenA && bibA) {
            // porta-temperos / lixeira do fabricante (.skp): o kit já vem com as corrediças. Entra no tamanho
            // real, centralizado na largura e apoiado na base do vão; anda junto com a frente.
            var hA = itCorre - sm.ib - 20;
            fab.objeto({ nome: nomeA + ' ' + bibA.nome, grupo: 'ferragem', mat: 'aramado', x: vm.il, y: yInt, z: sm.ib + 5, dx: vm.largInt, dy: lenA, dz: hA,
              conj: cjA, vao: vi, col: colIdx0, secao: j, biblio: bibDe(bibA, { apoiar: 'z' }) });
            var mdA = bibA.medidas.map(Number);
            if (Math.min(mdA[0], mdA[1], mdA[2]) > vm.largInt + 1) aviso(rot + ': o modelo "' + bibA.nome + '" (' + mdA.map(Math.round).join(' × ') + ' mm) não cabe no vão de ' + fmtCm(vm.largInt) + ' interno. Por quê: o kit do fabricante tem largura fixa; aumente a coluna ou escolha outro modelo.', ref);
            cont.bibAramados = cont.bibAramados || [];
            cont.bibAramados.push(nomeA + ' ' + bibA.nome + (bibA.marca ? ' (' + bibA.marca + ')' : ''));
            R.elementos.push({ tipo: cfg.tipo, nome: nomeA + ' ' + bibA.nome, col: colIdx0, frenteW: regW, frenteH: regH, corredica: lenA, cestos: cfg.cestos || 0, baldes: cfg.baldes || 0,
              texto: nomeA + ' ' + bibA.nome + (bibA.marca ? ' (' + bibA.marca + ')' : '') + ', kit do fabricante com corrediças próprias; confira a medida mínima do vão no catálogo.' });
          } else if (lenA) {
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
      if (led.local === 'bancada') {
        // perfil de sobrepor no plano das frentes, logo abaixo do tampo: as frentes descem 30 mm e a luz lava as portas
        fab.objeto({ nome: 'Perfil LED', grupo: 'led', mat: 'led', x: T + 20, y: -Tf, z: H - folgaTopoF + 6, dx: L - 2 * T - 40, dy: ledW, dz: ledH,
          obs: 'Fita ' + led.temperatura + 'K em perfil de sobrepor sob o tampo, com difusor leitoso; frentes 30 mm abaixo do tampo' });
        cont.ledMm += L - 2 * T - 40;
        if (fr.folgaTopo < 30) info('LED sob a bancada: as frentes de cima ficaram 30 mm abaixo do tampo para abrir a faixa de luz.');
      } else if (led.local === 'base') {
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
          local: led.local === 'base' ? 'Embaixo do móvel' : (led.local === 'bancada' ? 'Sob a bancada, sobre as frentes' : 'Sob as prateleiras dos nichos'), posicao: led.posicao, temperatura: led.temperatura, montagem: led.tipo, metros: Math.round(cont.ledMm / 100) / 10,
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
      var rP = p.cantos ? clamp(+p.raio || 50, 5, 300) : (cantosArred ? raioC + (p.avancoFrente || 0) : 0);
      fab.objeto({ nome: 'Pedra / bancada', grupo: 'pedra', mat: 'pedra', x: -p.avancoLados, y: yp0, z: H, dx: L + 2 * p.avancoLados, dy: D - yp0, dz: p.espessura,
        forma: rP ? { plano: 'xy', pts: retanguloArredondado(L + 2 * p.avancoLados, D - yp0, rP) } : null,
        obs: (cubaAtiva ? 'Com recorte para cuba' : '') + (rP ? (cubaAtiva ? ' · ' : '') + 'cantos frontais arredondados R' + Math.round(rP / 10) + ' cm' : '') });
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
    var angTxt = Object.keys(cont.angulosDob || {}).filter(function (a) { return +a !== 110 && cont.angulosDob[a] > 0; });
    var nCanto = fab.lista.filter(function (p) { return p.nome === 'Espaçador do canto'; }).length;
    if (nCanto) fer.push({ item: 'Dobradiça 165° para porta de canto', qtd: nCanto * 2, un: 'un', obs: 'no lugar das comuns nessas portas' });
    if (angTxt.length) amort += ' (inclui ' + angTxt.map(function (a) { return cont.angulosDob[a] + ' de ' + a + '°'; }).join(' e ') + ' de abertura ampla)';
    if (!bibDob && cont.dobradicas.reta) fer.push({ item: 'Dobradiça reta 35 mm ' + amort, qtd: cont.dobradicas.reta, un: 'un' });
    if (!bibDob && cont.dobradicas.curva) fer.push({ item: 'Dobradiça curva 35 mm ' + amort, qtd: cont.dobradicas.curva, un: 'un' });
    if (!bibDob && cont.dobradicas.superCurva) fer.push({ item: 'Dobradiça super curva 35 mm ' + amort, qtd: cont.dobradicas.superCurva, un: 'un' });
    var nomeCorr = (spec.gavetas.corredica === 'oculta' ? 'Corrediça oculta' : 'Corrediça telescópica') + (bibCorr ? ' ' + bibCorr.nome + (bibCorr.marca ? ' (' + bibCorr.marca + ')' : '') : '');
    if (bibDob) fer.push({ item: 'Dobradiça ' + bibDob.nome + (bibDob.marca ? ' (' + bibDob.marca + ')' : '') + ' — da biblioteca', qtd: cont.dobradicas.reta + cont.dobradicas.curva + cont.dobradicas.superCurva, un: 'un', obs: 'reta/curva conforme a montagem' });
    Object.keys(cont.corredicas).map(Number).sort(function (a, b) { return a - b; }).forEach(function (len) {
      fer.push({ item: nomeCorr + ' ' + len + ' mm (par)', qtd: cont.corredicas[len], un: 'par' });
    });
    Object.keys(cont.vidrosCorrer || {}).forEach(function (nv) { fer.push({ item: nv + ' para folha de correr', qtd: r1(cont.vidrosCorrer[nv] * 100) / 100, un: 'm²' }); });
    if (cont.perfilCorrerMm) fer.push({ item: 'Perfil de alumínio para folha de correr de vidro', qtd: r1(cont.perfilCorrerMm / 1000), un: 'm' });
    (cont.coifas || []).forEach(function (cf) { fer.push({ item: 'Coifa embutida ' + Math.round(cf.w) + ' mm + duto Ø' + cf.duto + ' mm (conforme fabricante)', qtd: 1, un: 'cj' }); });
    (cont.kitsCorrer || []).forEach(function (kc) {
      fer.push({ item: (kc.bib ? 'Kit ' + kc.bib.nome : 'Kit porta de correr (trilho superior duplo com roldanas, guia inferior, batentes)') + ' · ' + kc.folhas + ' folhas · ' + r1(kc.larg / 1000) + ' m', qtd: 1, un: 'cj' });
    });
    if (cont.pistoes) fer.push({ item: 'Pistão a gás para basculante', qtd: cont.pistoes, un: 'un' });
    if (cont.lixeiras.length) fer.push({ item: 'Lixeira embutida de extração (' + cont.lixeiras.map(function (l) { return l + ' L'; }).join(' + ') + ', tampa basculante)', qtd: 1, un: 'cj' });
    if (cont.bibAramados) { var contA = {}; cont.bibAramados.forEach(function (n) { contA[n] = (contA[n] || 0) + 1; }); Object.keys(contA).forEach(function (n) { fer.push({ item: n, qtd: contA[n], un: 'cj' }); }); }
    if (cont.temperos) fer.push({ item: 'Porta-temperos aramado cromado', qtd: cont.temperos, un: 'cj' });
    if (cont.fruteiras) fer.push({ item: 'Fruteira aramada de correr', qtd: cont.fruteiras, un: 'cj' });
    if (cont.puxadores) {
      if (pux.tipo === 'meu') fer.push({ item: 'Puxador ' + pux.bib.nome + (pux.bib.marca ? ' (' + pux.bib.marca + ')' : ''), qtd: cont.puxadores, un: 'un' });
      else if (pux.tipo === 'alca') fer.push({ item: 'Puxador alça ' + pux.comprimento + ' mm', qtd: cont.puxadores, un: 'un' });
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
    if (cont.vidroM2) { fer.push({ item: 'Perfil de alumínio para porta de vidro', qtd: r1(cont.perfilVidroMm / 1000), un: 'm' }); fer.push({ item: VIDROS[vidroTipo].nome, qtd: r1(cont.vidroM2 * 100) / 100, un: 'm²' }); }
    if (cont.telaM2) fer.push({ item: 'Tela ' + telaInfo.nome.toLowerCase() + ' (com 8 mm de sobra para o rebaixo) + baguete/grampos', qtd: r1(cont.telaM2 * 100) / 100, un: 'm²' });
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
        basculantes: frentesP.filter(function (p) { return p.meta.tipo === 'basculante'; }).length,
        gavetas: frentesP.filter(function (p) { return p.meta.tipo === 'gaveta'; }).length + pecas.filter(function (p) { return p.nome === 'Frente gaveta interna'; }).length, // inclui as internas (atrás das portas)
        portas: frentesP.filter(function (p) { return p.meta.tipo === 'porta' || p.meta.tipo === 'correr'; }).length,
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
    PUXADORES: PUXADORES, COMPOSICOES: COMPOSICOES, COMODOS: COMODOS, comodoDoTipo: comodoDoTipo, ESTILOS_FRENTE: ESTILOS_FRENTE, MODULOS_INTERNOS: MODULOS_INTERNOS, USOS_CABIDEIRO: USOS_CABIDEIRO, REC_INTERNO: REC_INTERNO, INTERNOS_PRONTOS: INTERNOS_PRONTOS, VIDROS: VIDROS, TELAS: TELAS, TEMP_LED: TEMP_LED, CORREDICAS: CORREDICAS,
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
