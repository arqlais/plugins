/*
 * planê.mob — interface (janela HtmlDialog do SketchUp)
 * Comunicação:
 *   JS -> Ruby : sketchup.<acao>(JSON)  (pronto, gerar, cancelar, detectarCuba, salvarRelatorio, salvarCsv, salvarPadroes)
 *   Ruby -> JS : App.receber({tipo, ...})
 * Fora do SketchUp (navegador) funciona em modo demonstração.
 */
(function () {
  'use strict';
  var ILU = window.MarceIlustra || {};
  var E = window.MarceEngine, R = window.MarceRender, C = window.MarceCatalogo, N = window.MarceNesting, REL = window.MarceRelatorio;
  var emSketchUp = typeof window.sketchup !== 'undefined';

  var st = {
    spec: null, modelo: null, modo: 'novo', volume: null,
    sel: { col: 0, secao: 0 }, aba: 'movel', vista: 'frontal', aberto3d: false,
    picker: null, marcaPicker: 'Todas', busca: '', confAberta: false, relatorioJunto: false, bib: [], bibBusca: {}, bibFiltro: 'todos',
    padroes: null, projeto: {}, versao: '1.22.6', gerando: false, atualizacao: null, atualizando: false
  };

  // ---------------------------------------------------------------- utilidades
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function m3(mm) { return (mm / 1000).toFixed(3).replace('.', ','); }
  function m2(mm) { return (mm / 1000).toFixed(2).replace('.', ','); }
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a === undefined || a === null ? undefined : a[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'); var a = o;
    for (var i = 0; i < ks.length - 1; i++) { if (a[ks[i]] === undefined || a[ks[i]] === null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; }
    a[ks[ks.length - 1]] = v;
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('vis');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('vis'); }, 2600);
  }
  function enviar(acao, dados) {
    if (emSketchUp && window.sketchup[acao]) { window.sketchup[acao](JSON.stringify(dados || {})); return true; }
    return false;
  }
  function baixar(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function nomeArquivo(base) { return String(base || 'movel').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'movel'; }

  // ---------------------------------------------------------------- ícones
  var IC = {
    balcao: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="10" width="24" height="16" rx="1.5"/><path d="M4 13h24M16 13v13M12 18v3M20 18v3"/></svg>',
    aereo: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="24" height="12" rx="1.5"/><path d="M16 5v12M13 13v2M19 13v2M4 26h24"/></svg>',
    torre: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="14" height="26" rx="1.5"/><rect x="11" y="11" width="10" height="6" rx="1"/><path d="M9 21h14M9 25h14"/></svg>',
    gaveteiro: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="6" width="18" height="21" rx="1.5"/><path d="M7 11.5h18M7 17h18M7 22h18M14 9h4M14 14h4M14 19.5h4M14 24.5h4"/></svg>',
    roupeiro: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="22" height="26" rx="1.5"/><path d="M5 9h22M16 9v20M14 17v3M18 17v3"/></svg>',
    estante: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="3" width="20" height="26" rx="1"/><path d="M6 10h20M6 16h20M6 22h20M16 3v26"/></svg>',
    rack: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="15" width="26" height="9" rx="1"/><path d="M12 15v9M20 15v9M14 19h4M6 24v2M26 24v2"/><rect x="9" y="5" width="14" height="8" rx="1"/></svg>',
    escrivaninha: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h26M5 11v15M27 11v15"/><rect x="18" y="11" width="9" height="10"/><path d="M21 14h3M21 18h3"/></svg>',
    criado: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="10" width="16" height="14" rx="1"/><path d="M8 17h16M14 13.5h4M14 20.5h4M10 24v2M22 24v2"/></svg>',
    geladeira: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="22" height="26" rx="1"/><rect x="8" y="10" width="13" height="19"/><path d="M5 10h22M18 18v4"/></svg>',
    c_cozinha: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="16" width="24" height="11" rx="1"/><path d="M4 20h24M10 16v-3M8 13h4M20 9c0-2 3-2 3-4M25 9c0-2 3-2 3-4"/></svg>',
    c_sala: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21v-5a3 3 0 013-3h14a3 3 0 013 3v5"/><rect x="3" y="19" width="26" height="6" rx="2"/><path d="M6 25v2M26 25v2"/></svg>',
    c_quarto: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 25V10M28 25v-6M4 19h24M4 25h24"/><rect x="7" y="14" width="7" height="5" rx="1.5"/></svg>',
    c_escritorio: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="5" width="18" height="12" rx="1"/><path d="M13 21h6M16 17v4M4 25h24"/></svg>',
    c_banheiro: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16h24v3a6 6 0 01-6 6H10a6 6 0 01-6-6v-3zM8 16V7a2 2 0 014 0M10 25l-1 3M22 25l1 3"/></svg>',
    c_lavanderia: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="20" height="24" rx="2"/><circle cx="16" cy="17" r="6"/><path d="M10 8h4"/></svg>',
    c_closet: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6a2 2 0 112 2c-1 0-2 .8-2 2v1l11 7H5l11-7"/><path d="M5 18h22"/></svg>',
    gabinete: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h24"/><rect x="6" y="12" width="20" height="11" rx="1"/><path d="M11 9h10l-1 3h-8z M16 12v11"/></svg>',
    personalizado: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="4" width="22" height="24" rx="1"/><path d="M5 18h22M12 18V8a4 4 0 0 1 8 0v10M16 18v10"/></svg>',
    // seções
    portas: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="4" width="14" height="24" rx="1"/><path d="M9 4l14 12L9 28" stroke-dasharray="2 2"/><path d="M19 15v3"/></svg>',
    gavetas: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="5" width="18" height="22" rx="1"/><path d="M7 12h18M7 19h18M14 8.5h4M14 15.5h4M14 23h4"/></svg>',
    basculante: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="9" width="22" height="14" rx="1"/><path d="M5 9l11 14L27 9" stroke-dasharray="2 2"/></svg>',
    temperos: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="11" y="4" width="10" height="24" rx="1"/><path d="M13 10h6M13 16h6M13 22h6"/><circle cx="14.5" cy="8.5" r="1"/><circle cx="17.5" cy="14.5" r="1"/></svg>',
    lixeira: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 9h12l-1.5 18h-9z"/><path d="M8 9h16M14 6h4"/></svg>',
    fruteira: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 11h20l-2 6H8zM6 20h20l-2 6H8z"/><circle cx="13" cy="9" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    nicho: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="4" width="18" height="24" rx="1"/><path d="M7 12h18M7 20h18"/></svg>',
    arco: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 28V12a8 8 0 0 1 16 0v16z"/><path d="M8 20h16"/></svg>',
    espelho: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 28V12a7 7 0 0 1 14 0v16z"/><path d="M13 14l4-4M13 19l7-7"/></svg>',
    painel: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="4" width="20" height="24" rx="1"/><path d="M10 4v24M14 4v24M18 4v24M22 4v24"/></svg>',
    forno: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="6" width="22" height="20" rx="1.5"/><rect x="8" y="12" width="16" height="11" rx="1"/><path d="M9 9h2M13 9h2"/></svg>',
    geladeira: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="3" width="16" height="26" rx="1.5"/><path d="M8 12h16M11 7v3M11 15v4"/></svg>',
    micro: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="9" width="24" height="14" rx="1.5"/><rect x="7" y="12" width="13" height="8" rx="1"/><path d="M23 13v1M23 17v1"/></svg>',
    // puxadores
    cava: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 26V9h12l4-4v21z"/><path d="M20 9l4-4"/></svg>',
    perfil: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="9" width="16" height="18" rx="1"/><rect x="8" y="6" width="16" height="3" rx="1"/></svg>',
    passante: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6h20v18H6z"/><path d="M9 8h14v22H9z" stroke-dasharray="0"/><path d="M9 24v6h14v-6" stroke="#d6b3ab" stroke-width="2"/></svg>',
    barra: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="14" height="26" rx="1"/><path d="M19 6v20" stroke-width="2.5"/></svg>',
    botao: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="4" width="14" height="24" rx="1"/><circle cx="18.5" cy="16" r="2.4" fill="currentColor"/></svg>',
    testeira: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="8" width="14" height="20" rx="1"/><path d="M8 8l4-4h16l-5 4z" fill="#d6b3ab" fill-opacity=".5"/></svg>',
    alca: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="4" width="14" height="24" rx="1"/><path d="M19 10v10" stroke-width="2.5"/></svg>',
    coifa: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 4h6v8l7 6v3H6v-3l7-6z"/><path d="M8 25h16"/></svg>',
    correr: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="13" height="22"/><rect x="14" y="6" width="13" height="22" fill="#fff"/><path d="M17 17h7M17 17l2-2M17 17l2 2"/></svg>',
    livre: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 27V6h18v21"/><path d="M7 10h18"/><path d="M12 27v-8l4-3 4 3v8" stroke-dasharray="2 2"/></svg>',
    meu: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="4" width="14" height="24" rx="1"/><path d="M18 10h3v12h-3"/><path d="M4 26l4-4M4 22v4h4" stroke-width="1.3"/></svg>',
    bibArq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/></svg>',
    bibSel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 5h4M5 5v4M19 5h-4M19 5v4M5 19h4M5 19v-4M19 19h-4M19 19v-4"/><rect x="9" y="9" width="6" height="6"/></svg>',
    bibPasta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h6l2 2h10v10H3z"/><path d="M12 12v5M9.5 14.5h5"/></svg>',
    bibGer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/></svg>',
    bibVazio: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 22l10 5 10-5V10L16 5 6 10z"/><path d="M6 10l10 5 10-5M16 15v12"/></svg>',
    toque: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="4" width="14" height="24" rx="1"/><path d="M14 16a2 2 0 1 1 4 0v5" /><path d="M12 13a4 4 0 0 1 8 0"/></svg>',
    nenhum: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="4" width="14" height="24" rx="1"/><path d="M6 6l20 20"/></svg>',
    // abas
    abaMovel: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 10h18M12 10v10"/></svg>',
    abaMontagem: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 4v16M15 4v16M15 10h6M15 15h6"/></svg>',
    abaFrentes: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M15 10v4"/></svg>',
    abaAcab: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1.3"/><circle cx="14" cy="9" r="1.3"/><circle cx="15.5" cy="13.5" r="1.3"/></svg>',
    abaFer: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5"/><circle cx="8" cy="8" r="1"/><path d="M11 9.5l8 4M11 11l6.5 6"/><rect x="15" y="15" width="5" height="5" rx="1"/></svg>',
    abaBib: '<svg viewBox="0 0 24 24"><path d="M4 19V5M8 19V5M12 19l3-14 4 1-3 14z"/><path d="M3 19h18"/></svg>',
    abaGuia: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.7M12 17h.01"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    abaRel: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h4"/></svg>'
  };

  // ---------------------------------------------------------------- estado / cálculo
  // Móvel novo usa as ferragens que vêm com a planê.mob (corrediça FGV 350, invisível e dobradiça reta),
  // assim que a biblioteca de fábrica estiver pronta. Quem escolher "Padrão" (desenho da planê.mob) fica
  // com a escolha (o campo vira null); móveis já gerados não mudam sozinhos.
  var FABRICA_PADRAO = [
    ['gavetas', 'bibTelescopica', 'corredica-telescopica-amortecedor-350.skp'],
    ['gavetas', 'bibOculta', 'corredica-invisivel.skp'],
    ['frentes', 'bibDobradica', 'dobradica-reta.skp']
  ];
  function aplicarFabricaPadrao(spec) {
    if (!spec || st.modo === 'editar' || !(st.bib || []).length) return;
    FABRICA_PADRAO.forEach(function (f) {
      spec[f[0]] = spec[f[0]] || {};
      if (spec[f[0]][f[1]] !== undefined) return;
      var it = (st.bib || []).filter(function (i) { return i.origem === 'fabrica' && i.fabrica_arquivo === f[2] && i.existe !== false; })[0];
      if (it) spec[f[0]][f[1]] = { id: it.id, nome: it.nome, marca: it.marca || '', medidas: it.medidas, encaixe: it.encaixe || 'real', folga: it.folga || null, virar: false, deitar: false };
    });
  }

  function recalcular() {
    aplicarFabricaPadrao(st.spec);
    st.modelo = E.calcular(st.spec);
    var nC = st.spec.colunas.length;
    if (st.sel.col >= nC) st.sel.col = nC - 1;
    if (st.sel.col < 0) st.sel.col = 0;
    var ns = st.spec.colunas[st.sel.col].secoes.length;
    if (st.sel.secao >= ns) st.sel.secao = ns - 1;
    if (st.sel.secao < 0) st.sel.secao = 0;
  }
  function colSel() { return st.spec.colunas[st.sel.col]; }
  function secSel() { return colSel().secoes[st.sel.secao]; }

  function atualizar(parcial) {
    recalcular();
    renderCabecalho(); renderVisao(); renderChips(); renderConferencia(); renderRodape();
    if (!parcial) renderPainel();
  }

  function redistribuir(manter) {
    var antigas = st.spec.colunas;
    var novas = E.autoColunas(st.spec);
    if (manter) {
      novas = novas.map(function (c, i) {
        if (antigas[i] && !(antigas[i].secoes.length === 1 && antigas[i].secoes[0].tipo === 'portas')) return E.novaColuna(null, JSON.parse(JSON.stringify(antigas[i].secoes)));
        return c;
      });
    }
    st.spec.colunas = novas;
  }

  // ---------------------------------------------------------------- cabeçalho / vistas
  function renderCabecalho() {
    var s = st.spec;
    var nome = $('#nome');
    if (document.activeElement !== nome) nome.value = s.nome;
    $('#badge-modo').hidden = st.modo !== 'editar';
    $('#subtitulo').textContent = m3(s.L) + ' m × ' + m2(s.D) + ' m · altura ' + m3(s.H) + ' m' + (s.origemVolume ? ' · volume do modelo' : '');
    var vs = [['frontal', 'Vista frontal'], ['planta', 'Planta'], ['3d', '3D'], ['pecas', 'Peças']];
    $('#vistas').innerHTML = vs.map(function (v) { return '<button data-act="vista:' + v[0] + '" class="' + (st.vista === v[0] ? 'ativo' : '') + '">' + v[1] + '</button>'; }).join('');
    if (!$('#btn-guia')) {
      var bg = document.createElement('button');
      bg.id = 'btn-guia'; bg.className = 'btn-guia'; bg.type = 'button'; bg.title = 'Como usar a planê.mob'; bg.textContent = '?';
      bg.setAttribute('data-guia', '1');
      $('.cabecalho').appendChild(bg);
    }
  }

  function renderVisao() {
    var M = st.modelo, el = $('#visao');
    var html = '';
    if (st.vista === 'frontal') {
      html = '<div class="barra-visao"><span class="dica-clique">' + (st.interno ? 'Vista interna: prateleiras, divisórias, gavetas e sifão · clique num vão para editar' : 'Clique numa frente para editar a coluna') + '</span>' +
        '<div class="segmentado mini"><button data-act="interno:0" class="' + (!st.interno ? 'ativo' : '') + '">com frentes</button><button data-act="interno:1" class="' + (st.interno ? 'ativo' : '') + '">interno</button></div></div>' +
        '<div class="area-desenho">' + R.frontal(M, { clicavel: true, sel: st.sel, interno: st.interno }) + '</div>';
    } else if (st.vista === 'planta') {
      html = '<div class="barra-visao"></div><div class="area-desenho">' + R.planta(M, {}) + '</div>';
    } else if (st.vista === '3d') {
      var algumAberto = st.aberto3d || Object.keys(st.abertos || {}).some(function (k) { return st.abertos[k]; });
      html = '<div class="barra-visao"><span class="dica-clique">Arraste para girar · clique numa porta ou gaveta para abrir · duplo clique para editar</span><div class="segmentado mini"><button data-act="cam:reset" title="Voltar para a isométrica">iso</button><button data-act="aberto:0" class="' + (!algumAberto ? 'ativo' : '') + '">fechado</button><button data-act="aberto:1" class="' + (st.aberto3d ? 'ativo' : '') + '">tudo aberto</button></div></div>' +
        '<div class="area-desenho orbita"><canvas class="cv3d"></canvas></div>';
    } else {
      html = vistaPecas(M);
    }
    el.innerHTML = html;
    var cv = el.querySelector('canvas.cv3d');
    if (cv) R.desenharCanvas(cv, M, { aberto: st.aberto3d ? true : (st.abertos || {}), camera: st.cam, clicavel: true });
  }

  function vistaPecas(M) {
    var spec = M.spec;
    var linhas = E.listaDePecas(M.pecas, spec.materiais);
    var est = E.estimativaChapas(M.pecas, spec.chapa);
    var h = '<div class="tabela-wrap"><table class="tab"><thead><tr><th>Nº</th><th>Peça</th><th>Qtd</th><th>Comp.</th><th>Larg.</th><th>Esp.</th><th>Material</th><th>Fita</th><th>Obs.</th></tr></thead><tbody>';
    var espAnt = null;
    linhas.forEach(function (l) {
      if (l.e !== espAnt) { h += '<tr class="sep"><td colspan="9">Chapas de ' + l.e + ' mm</td></tr>'; espAnt = l.e; }
      h += '<tr><td class="n">' + l.n + '</td><td>' + esc(l.nome) + '</td><td class="n">' + l.qtd + '</td><td class="n">' + Math.round(l.c) + '</td><td class="n">' + Math.round(l.l) + '</td><td class="n">' + l.e + '</td><td>' + esc(l.material) + '</td><td>' + (l.fitaC + l.fitaL ? l.fitaC + 'C ' + l.fitaL + 'L' : '—') + '</td><td>' + esc(l.obs) + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<h4 style="margin:14px 4px 4px">Estimativa de chapas (' + m2(spec.chapa.comprimento) + ' × ' + m2(spec.chapa.largura) + ' m, 80% de aproveitamento)</h4><table class="tab"><thead><tr><th>Espessura</th><th>Área (m²)</th><th>Chapas</th></tr></thead><tbody>';
    est.forEach(function (e) { h += '<tr><td>' + e.esp + ' mm</td><td class="n">' + e.area.toFixed(2).replace('.', ',') + '</td><td class="n">' + e.chapas + '</td></tr>'; });
    h += '</tbody></table>';
    var plano = N.otimizar(N.pecasDoModelo(M.pecas, spec.materiais), spec.chapa);
    h += '<h4 style="margin:14px 4px 4px">Plano de corte sugerido</h4><div class="chapas-grade">';
    plano.forEach(function (g) {
      g.chapas.forEach(function (ch, i) {
        h += '<figure><figcaption>' + esc(g.material) + ' ' + g.esp + ' mm — chapa ' + (i + 1) + '/' + g.chapas.length + ' · ' + Math.round(ch.aproveitamento * 100) + '%</figcaption>' + R.chapaSvg(g, ch, spec.chapa) + '</figure>';
      });
      if (g.naoCabem.length) h += '<figure><figcaption>' + esc(g.material) + ' — ' + g.naoCabem.length + ' peça(s) maiores que a chapa (emenda)</figcaption><div style="font-size:12px;padding:6px">' + g.naoCabem.map(function (p) { return esc(p.nome) + ' ' + Math.round(p.c) + '×' + Math.round(p.l); }).join('<br>') + '</div></figure>';
    });
    h += '</div></div>';
    return h;
  }

  function renderChips() {
    var r = st.modelo.resumo;
    var c = ['<span class="chip"><b>' + r.frentes + '</b> frente</span>'];
    c.push('<span class="chip"><b>' + r.portas + '</b> portas</span>');
    if (r.basculantes) c.push('<span class="chip"><b>' + r.basculantes + '</b> basculantes</span>');
    c.push('<span class="chip"><b>' + r.gavetas + '</b> gavetas</span>');
    if (r.especiais) c.push('<span class="chip"><b>' + r.especiais + '</b> aramados/lixeira</span>');
    c.push('<span class="chip"><b>' + r.vaos + '</b> vãos</span>');
    c.push('<span class="chip"><b>' + r.pecas + '</b> peças</span>');
    c.push('<span class="chip"><b>' + m3(r.frenteMm) + ' m</b> de frente</span>');
    $('#chips').innerHTML = c.join('');
  }

  // "… Por quê: …" vira a explicação em linha própria, mais leve
  function msgPorque(m) {
    var i = String(m).indexOf(' Por quê: ');
    if (i < 0) return esc(m);
    return esc(m.slice(0, i)) + '<small class="porque"><b>por quê</b> ' + esc(m.slice(i + 10)) + '</small>';
  }

  function renderConferencia() {
    var M = st.modelo, r = M.resumo;
    var cont = '';
    if (r.erros) cont += '<span class="contador erro">' + r.erros + ' erro' + (r.erros > 1 ? 's' : '') + '</span>';
    if (r.avisos) cont += '<span class="contador aviso">' + r.avisos + ' aviso' + (r.avisos > 1 ? 's' : '') + '</span>';
    if (!r.erros && !r.avisos) cont += '<span class="contador ok">tudo certo</span>';
    var ic = { erro: ILU.st_erro, aviso: ILU.st_aviso, info: ILU.st_info, dica: ILU.st_dica };
    var itens = M.avisos.map(function (a) {
      var cl = a.ref && a.ref.col !== undefined && a.ref.col !== null;
      return '<li class="' + (cl ? 'clicavel' : '') + '"' + (cl ? ' data-act="irpara:' + a.ref.col + ':' + (a.ref.secao || 0) + '"' : '') + '><span class="ic-svg">' + ic[a.nivel] + '</span><span>' + msgPorque(a.msg) + '</span></li>';
    }).join('');
    var el = $('#conferencia');
    el.className = 'cartao conferencia' + (st.confAberta ? '' : ' fechada');
    el.innerHTML = '<div class="topo-conf" data-act="conf"><h3>Conferência técnica</h3>' + aj('conferencia') + cont + '<span class="seta">' + ILU.seta + '</span></div><ul class="lista-conf">' + itens + '</ul>';
  }

  function renderRodape() {
    var r = st.modelo.resumo;
    var txt = st.modo === 'editar' ? 'Atualizar móvel' : 'Gerar móvel';
    var at = st.atualizacao;
    var htmlVersao = '<span class="versao">planê<i>.mob</i> ' + esc(st.versao) + '</span>';
    if (st.atualizando) htmlVersao += '<span class="pilula-atualizar ocupado">atualizando…</span>';
    else if (at && at.nova) htmlVersao += '<button class="pilula-atualizar nova" data-act="atualizar" title="' + esc((at.notas || []).join(' · ')) + '">atualizar para ' + esc(at.versao) + '</button>';
    else htmlVersao += '<button class="pilula-atualizar" data-act="verificarAtualizacao">' + (at && at.verificado ? (at.erro ? 'sem conexão · tentar de novo' : 'está atualizado') : 'verificar atualização') + '</button>';
    $('#rodape').innerHTML = '<div class="rodape-topo"><button class="resumo-conf" data-act="confAbrir" title="Ver a conferência técnica">' +
      (r.erros ? '<span class="contador erro">' + r.erros + ' erro' + (r.erros > 1 ? 's' : '') + '</span>' : '<span class="contador ok">' + ILU.st_ok + 'pronto para gerar</span>') +
      (r.avisos ? '<span class="contador aviso">' + r.avisos + ' aviso' + (r.avisos === 1 ? '' : 's') + '</span>' : '') + '</button>' +
      '<div class="bloco-versao">' + htmlVersao + '</div></div>' +
      '<div class="rodape-botoes"><button class="botao fantasma pequeno" data-act="cancelar">cancelar</button>' +
      '<button class="botao" data-act="relatorio" title="Monta as pranchas e a lista de peças, sem mexer no modelo"' + (r.erros ? ' disabled' : '') + '>' + IC.abaRel + 'relatório</button>' +
      '<button class="botao primario" data-act="gerar"' + (r.erros || st.gerando ? ' disabled' : '') + '>' + (st.gerando ? 'gerando…' : esc(txt.toLowerCase())) + '</button></div>';
  }

  // ---------------------------------------------------------------- painel
  // menu lateral: as etapas na ordem de uso, ligadas por uma linha (as já visitadas ficam marcadas)
  var ABAS = [
    ['movel', 'Móvel', IC.abaMovel, 'tipo, medidas e base'],
    ['montagem', 'Montagem', IC.abaMontagem, 'colunas, portas, gavetas'],
    ['frentes', 'Frentes', IC.abaFrentes, 'estilo, folgas, LED'],
    ['ferragens', 'Ferragens', IC.abaFer, 'puxador, corrediça, dobradiça'],
    ['acabamento', 'Acabamento', IC.abaAcab, 'MDF, cores, chapa'],
    ['relatorio', 'Relatório', IC.abaRel, 'pranchas e lista']
  ];
  var TITULO_ABA = { movel: ['o', 'móvel'], montagem: ['a', 'montagem'], frentes: ['as', 'frentes'], ferragens: ['as', 'ferragens'], acabamento: ['o', 'acabamento'], relatorio: ['o', 'relatório'] };

  function renderMenu() {
    st.visitadas = st.visitadas || {};
    st.visitadas[st.aba] = true;
    var r = (st.modelo && st.modelo.resumo) || {};
    var h = '<div class="trilho-logo" title="planê.mob"><svg viewBox="0 0 100 100"><path d="M17 79C18 62 18 46 21 38C25 27 37 27 41 38C44 47 44 62 43 71C42 80 35 82 34 75C33 66 43 40 52 32C60 25 71 28 73 40C75 52 74 65 75 74C76 83 83 85 89 77" fill="none" stroke="#f5f1ee" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>planê<i>.mob</i></span></div>';
    h += '<div class="trilho-etapas">' + ABAS.map(function (a, k) {
      var alerta = a[0] === 'montagem' && r.erros ? '<i class="trilho-alerta" title="' + r.erros + ' erro(s) na conferência"></i>' : '';
      return '<button data-act="aba:' + a[0] + '" class="etapa' + (st.aba === a[0] ? ' ativo' : '') + (st.visitadas[a[0]] ? ' visitada' : '') + '" title="' + esc(a[1] + ' · ' + a[3]) + '">' +
        '<span class="bolinha">' + a[2] + alerta + '</span><span class="num">' + (k + 1) + '</span><span class="rot">' + a[1] + '</span></button>';
    }).join('') + '</div>';
    h += '<div class="trilho-pe"><button class="etapa extra" data-act="bibGerenciar" title="Minha biblioteca de ferragens (.skp)"><span class="bolinha">' + IC.abaBib + '</span><span class="rot">biblioteca</span></button>' +
      '<button class="etapa extra" data-guia="1" title="Como usar a planê.mob"><span class="bolinha">' + IC.abaGuia + '</span><span class="rot">guia</span></button></div>';
    $('#abas').innerHTML = h;
  }

  // configurações avançadas: ficam recolhidas no fim de cada etapa (o essencial aparece primeiro)
  var AVANCADAS = {
    movel: ['umidade', 'estrutura', 'roda-teto', 'chapa'],
    montagem: [],
    frentes: ['montagem das frentes', 'prateleiras', 'desempenho'],
    ferragens: ['dobradiças', 'minha biblioteca'],
    acabamento: ['gavetas e fundos', 'padrão próprio', 'meus padrões'],
    relatorio: ['código do móvel', 'no modelo']
  };
  try { st.avancadas = localStorage.getItem('marce-avancadas') === '1'; } catch (e) { st.avancadas = false; }
  function organizarAvancadas(cont, aba) {
    var lista = AVANCADAS[aba] || [];
    var grupos = Array.prototype.filter.call(cont.children, function (g) {
      if (!g.classList || !g.classList.contains('grupo')) return false;
      var t = ((g.querySelector('h4') || {}).textContent || '').toLowerCase().trim();
      return lista.some(function (n) { return t.indexOf(n) === 0; });
    });
    if (!grupos.length) return;
    var nomes = grupos.map(function (g) { return ((g.querySelector('h4') || {}).textContent || '').replace('?', '').trim().toLowerCase(); });
    var box = document.createElement('div');
    box.className = 'avancadas' + (st.avancadas ? ' aberto' : '');
    box.innerHTML = '<button class="botao-avancadas" data-act="avancadas">' + IC.ajustes + '<span><b>configurações avançadas</b><small>' + esc(nomes.join(' · ')) + '</small></span>' + IC.seta + '</button><div class="corpo-avancadas"></div>';
    var corpo = box.querySelector('.corpo-avancadas');
    var prox = cont.querySelector('.proxima-etapa');
    cont.insertBefore(box, prox || null);
    grupos.forEach(function (g) { corpo.appendChild(g); });
  }

  function renderPainel() {
    renderMenu();
    var aba = ABAS.filter(function (a) { return a[0] === st.aba; })[0] || ABAS[0];
    var k = ABAS.indexOf(aba), tt = TITULO_ABA[aba[0]];
    var prox = ABAS[k + 1];
    var cont = $('#conteudo');
    var top = cont.scrollTop;
    var f = { movel: abaMovel, montagem: abaMontagem, frentes: abaFrentes, ferragens: abaFerragens, acabamento: abaAcabamento, relatorio: abaRelatorio }[aba[0]];
    cont.innerHTML = '<div class="cab-etapa"><span class="eyebrow-etapa">etapa ' + (k + 1) + ' de ' + ABAS.length + '</span><h3>' + tt[0] + ' <em>' + tt[1] + '</em></h3><p>' + aba[3] + '</p></div>' + f() +
      (prox ? '<button class="proxima-etapa" data-act="aba:' + prox[0] + '"><span>próxima etapa</span><b>' + prox[1] + '</b>' + IC.seta + '</button>' : '');
    organizarAvancadas(cont, aba[0]);
    cont.scrollTop = top;
  }

  // componentes de formulário
  function campoNum(rot, path, un, extra) {
    var v = getPath(st.spec, path);
    return '<div class="campo"><label>' + rot + '</label><input type="number" data-path="' + path + '" data-tipo="num" value="' + (v === null || v === undefined ? '' : Math.round(v * 10) / 10) + '"' + (extra || '') + '><span class="un">' + (un || '') + '</span></div>';
  }
  function deslizante(rot, path, min, max, passo, fmt) {
    var v = getPath(st.spec, path);
    return '<div class="deslizante"><div class="rot"><span>' + rot + '</span><b data-rot="' + path + '">' + (fmt ? fmt(v) : v) + '</b></div><input type="range" min="' + min + '" max="' + max + '" step="' + passo + '" value="' + v + '" data-path="' + path + '" data-tipo="num"></div>';
  }
  function interruptor(rot, path, ajuda, chaveAjuda) {
    var v = !!getPath(st.spec, path);
    return '<div class="linha-interruptor"><label class="interruptor"><input type="checkbox" data-path="' + path + '" data-tipo="bool"' + (v ? ' checked' : '') + '><span class="trilho"></span><span class="txt">' + rot + '</span></label>' + (chaveAjuda ? aj(chaveAjuda) : '') + '</div>' + (ajuda ? '<p class="ajuda">' + ajuda + '</p>' : '');
  }
  function ajudaTexto(txt) { return txt ? '<p class="ajuda">' + txt + '</p>' : ''; }
  function aj(chave) { return '<button type="button" class="ajuda-btn" data-ajuda="' + chave + '" aria-label="Ajuda: como usar">?</button>'; }
  function pilulas(path, ops, pequena) {
    var v = getPath(st.spec, path);
    return '<div class="pilulas">' + ops.map(function (o) { return '<button class="pilula' + (pequena ? ' pequena' : '') + (String(v) === String(o[0]) ? ' ativo' : '') + '" data-act="set" data-path="' + path + '" data-val="' + esc(o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function cartoes(path, ops) {
    var v = getPath(st.spec, path);
    return '<div class="grade-ilus c' + ops.length + '">' + ops.map(function (o) {
      return '<button class="card-ilus' + (String(v) === String(o[0]) ? ' ativo' : '') + '" data-act="set" data-path="' + path + '" data-val="' + esc(o[0]) + '" title="' + esc(o[1]) + '">' + (ILU[o[2]] || '') + '<span>' + o[1] + '</span></button>';
    }).join('') + '</div>';
  }
  // ---------------------------------------------------------------- minha biblioteca (.skp)
  var BIB_CAT = { puxador: 'Puxador', corredica: 'Corrediça', dobradica: 'Dobradiça', aramado: 'Aramado e lixeira', correr: 'Porta de correr', outro: 'Outro' };
  function semAcento(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function bibBate(i, busca) {
    if (!busca) return true;
    var alvo = semAcento([i.nome, i.marca, BIB_CAT[i.categoria], i.notas, (i.medidas || []).join(' ')].join(' '));
    return semAcento(busca).split(/\s+/).every(function (p) { return !p || alvo.indexOf(p) >= 0; });
  }
  function bibMedidas(m) { return (m || []).map(function (v) { return Math.round(v * 10) / 10; }).join(' × ') + ' mm'; }
  function bibMini(i) { return i && i.mini ? '<img src="' + i.mini + '" alt="">' : IC.bibVazio; }
  function bibBotoes(cat) {
    return '<div class="bib-anexar">' +
      '<button class="botao pequeno" data-act="bibAnexar:arquivo:' + cat + '">' + IC.bibArq + 'Anexar .skp</button>' +
      '<button class="botao pequeno" data-act="bibAnexar:selecao:' + cat + '" title="Selecione no modelo o componente da ferragem e clique aqui">' + IC.bibSel + 'Usar o selecionado</button>' +
      '<button class="botao pequeno" data-act="bibAnexar:pasta:' + cat + '" title="Anexa todos os .skp de uma pasta">' + IC.bibPasta + 'Anexar pasta</button>' +
      '<button class="botao pequeno fantasma" data-act="bibGerenciar">' + IC.bibGer + 'Minha biblioteca</button></div>';
  }
  // escolha da ferragem de uma categoria (cartões com miniatura, busca por nome, marca ou medida)
  function bibEscolha(cat, path, padraoTxt, opcoes) {
    var atual = getPath(st.spec, path) || null;
    var busca = st.bibBusca[cat] || '';
    var todos = (st.bib || []).filter(function (i) { return i.categoria === cat; });
    var itens = todos.filter(function (i) { return bibBate(i, busca); });
    var h = '<div class="bib">';
    if (todos.length > 4) h += '<input class="bib-busca" type="search" placeholder="Buscar por nome, marca ou medida" data-bib-busca="' + cat + '" value="' + esc(busca) + '">';
    h += '<div class="bib-grade">';
    if (padraoTxt) h += '<button class="bib-card' + (!atual ? ' ativo' : '') + '" data-act="bibUsar" data-path="' + path + '" data-id="">' + IC.bibVazio + '<b>' + padraoTxt + '</b><small>desenho da planê.mob</small></button>';
    itens.forEach(function (i) {
      h += '<button class="bib-card' + (atual && atual.id === i.id ? ' ativo' : '') + (i.existe === false ? ' faltando' : '') + '" data-act="bibUsar" data-path="' + path + '" data-id="' + esc(i.id) + '" title="' + esc(i.nome + (i.marca ? ' · ' + i.marca : '')) + '">' +
        bibMini(i) + (i.origem === 'fabrica' ? '<i class="selo-fabrica">planê</i>' : '') + '<b>' + esc(i.nome) + '</b><small>' + esc((i.marca ? i.marca + ' · ' : '') + bibMedidas(i.medidas)) + '</small></button>';
    });
    h += '<button class="bib-card anexar" data-act="bibAnexar:arquivo:' + cat + '" title="Anexar arquivo do SketchUp (.skp)"><span class="mais">+</span><b>anexar .skp</b><small>do fabricante ou seu</small></button>';
    h += '</div>';
    if (!todos.length) h += '<p class="ajuda">Sua biblioteca ainda não tem ' + BIB_CAT[cat].toLowerCase() + '. Anexe o arquivo do SketchUp (.skp) do fabricante, de uma pasta ou o componente que já está no seu modelo.</p>';
    else if (!itens.length) h += '<p class="ajuda">Nada encontrado para "' + esc(busca) + '".</p>';
    h += '<p class="bib-mais"><button class="link" data-act="bibAnexar:selecao:' + cat + '">usar o componente selecionado</button> · <button class="link" data-act="bibAnexar:pasta:' + cat + '">anexar pasta</button> · <button class="link" data-act="bibGerenciar">organizar</button></p>';
    if (atual && opcoes) {
      if (atual.existe === false) h += '<p class="ajuda">O arquivo desta ferragem não está mais na biblioteca: o móvel usa o desenho da planê.mob.</p>';
      if (opcoes.encaixe) h += '<div class="campo"><label>Tamanho no móvel</label></div>' + pilulas(path + '.encaixe', [['real', 'Tamanho real'], ['esticar', 'Esticar no comprimento']], true);
      if (opcoes.comprimento && atual.encaixe === 'esticar') h += deslizante('Comprimento', opcoes.comprimento, 60, 1200, 10, fmtMm);
      h += '<details class="ajuste-peca"><summary>a peça entrou de lado ou virada?</summary>' + interruptor('Girar 180° (virar)', path + '.virar') +
        (opcoes.deitar ? interruptor('Deitar (troca altura e profundidade)', path + '.deitar') : '') + '<p class="ajuda">Cada arquivo do fabricante é desenhado numa posição; ajuste aqui se precisar.</p></details>';
    }
    return h + '</div>';
  }
  function bibItem(id) { return (st.bib || []).filter(function (i) { return i.id === id; })[0]; }
  // anexou um arquivo com várias peças soltas (ex.: puxador + logotipo): escolhe o que entra
  function bibEscolherPartes(an) {
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><p class="eyebrow-m">minha biblioteca</p><h2>o arquivo tem <em>' + an.partes.length + ' peças</em></h2>' +
      '<p class="sub-m">' + esc(an.nome) + ' · marque só o que é ferragem (cada uma vira um item da biblioteca).</p><div class="lista-m bib-partes">' +
      an.partes.map(function (p) { return '<label class="bib-parte"><input type="checkbox" value="' + p.indice + '"' + (an.partes.length <= 3 ? ' checked' : '') + '><span><b>' + esc(p.nome) + '</b><small>' + bibMedidas(p.medidas) + '</small></span></label>'; }).join('') +
      '</div><div class="botoes-m"><button class="botao" data-fechar-modal>cancelar</button><button class="botao primario" data-anexar-partes>anexar marcadas</button></div></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', function (ev) {
      if (ev.target.hasAttribute('data-anexar-partes')) {
        var idx = Array.prototype.map.call(fundo.querySelectorAll('input:checked'), function (c) { return +c.value; });
        if (!idx.length) { toast('Marque pelo menos uma peça'); return; }
        enviar('bibAnexar', { modo: 'partes', arquivo: an.arquivo, indices: idx, categoria: an.categoria });
        fundo.remove(); return;
      }
      if (ev.target === fundo || ev.target.hasAttribute('data-fechar-modal')) fundo.remove();
    });
  }
  // organizar texturas: nome, pasta e tamanho real
  function texGerenciar() {
    var fundo = document.querySelector('.modal-fundo.tex-ger');
    if (!fundo) {
      fundo = document.createElement('div');
      fundo.className = 'modal-fundo tex-ger';
      document.body.appendChild(fundo);
      fundo.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-tex-rem],[data-fechar-modal]');
        if (ev.target === fundo || (t && t.hasAttribute('data-fechar-modal'))) { fundo.remove(); return; }
        if (t && t.hasAttribute('data-tex-rem')) { var it = texItem(t.getAttribute('data-tex-rem')); if (it && window.confirm('Remover a textura "' + it.nome + '"?')) enviar('texRemover', { id: it.id }); }
      });
      fundo.addEventListener('change', function (ev) {
        var el = ev.target, k = el.getAttribute('data-tex-campo');
        if (!k) return;
        var d = { id: el.closest('[data-tex-id]').getAttribute('data-tex-id') };
        d[k] = el.value;
        enviar('texEditar', d);
      });
    }
    var pastas = [];
    (st.texturas || []).forEach(function (t) { if (pastas.indexOf(t.pasta) < 0) pastas.push(t.pasta); });
    fundo.innerHTML = '<div class="modal largo" role="dialog" aria-modal="true"><p class="eyebrow-m">minhas texturas</p><h2>organizar <em>texturas</em></h2>' +
      '<p class="sub-m">Mude a pasta para separar por fornecedor ou coleção: cada pasta vira um botão no seletor de materiais.</p><datalist id="tex-pastas">' + pastas.map(function (p0) { return '<option value="' + esc(p0) + '">'; }).join('') + '</datalist>' +
      '<div class="lista-m bib-lista">' + (st.texturas || []).map(function (t) {
        return '<div class="bib-linha" data-tex-id="' + esc(t.id) + '"><div class="bib-mini"><span class="amostra foto grande" style="background-color:' + esc(t.cor || '#cfc6bd') + ';background-image:url(\'' + esc(t.img || '') + '\')"></span></div><div class="bib-campos">' +
          '<input data-tex-campo="nome" value="' + esc(t.nome) + '" aria-label="Nome"><input data-tex-campo="pasta" list="tex-pastas" value="' + esc(t.pasta) + '" aria-label="Pasta">' +
          '<label class="tex-larg">largura real (mm)<input data-tex-campo="largura" type="number" min="50" step="50" value="' + Math.round(t.largura || 1200) + '"></label>' +
          '<small>' + (t.existe === false ? 'arquivo não encontrado' : 'a imagem se repete a cada ' + m2(t.largura || 1200) + ' m') + '</small></div>' +
          '<button class="bib-rem" data-tex-rem="' + esc(t.id) + '" aria-label="Remover" title="Remover">' + IC.lixo + '</button></div>';
      }).join('') + '</div><div class="botoes-m"><button class="botao primario" data-fechar-modal>pronto</button></div></div>';
  }

  // gerenciar: renomear, marca, categoria, tamanho, remover
  function bibGerenciar() {
    var fundo = document.querySelector('.modal-fundo.bib-ger');
    if (!fundo) {
      fundo = document.createElement('div');
      fundo.className = 'modal-fundo bib-ger';
      document.body.appendChild(fundo);
      fundo.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-bib-rem],[data-bib-cat-f],[data-fechar-modal],[data-act]');
        if (ev.target === fundo || (t && t.hasAttribute('data-fechar-modal'))) { fundo.remove(); return; }
        if (!t) return;
        if (t.hasAttribute('data-bib-cat-f')) { st.bibFiltro = t.getAttribute('data-bib-cat-f'); bibGerenciar(); return; }
        if (t.hasAttribute('data-bib-rem')) {
          var it = bibItem(t.getAttribute('data-bib-rem'));
          if (it && window.confirm('Remover "' + it.nome + '" da biblioteca? Os móveis que usam voltam ao desenho da planê.mob.')) enviar('bibRemover', { id: it.id });
        }
      });
      fundo.addEventListener('change', function (ev) {
        var el = ev.target, k = el.getAttribute('data-bib-campo');
        if (!k) return;
        var d = { id: el.closest('[data-bib-id]').getAttribute('data-bib-id') };
        d[k] = el.type === 'checkbox' ? el.checked : el.value;
        enviar('bibEditar', d);
      });
      fundo.addEventListener('input', function (ev) {
        if (ev.target.id !== 'bib-ger-busca') return;
        st.bibBusca._ger = ev.target.value;
        var pos = ev.target.selectionStart; bibGerenciar();
        var nb = document.getElementById('bib-ger-busca'); if (nb) { nb.focus(); nb.setSelectionRange(pos, pos); }
      });
    }
    var filtro = st.bibFiltro || 'todos', busca = st.bibBusca._ger || '';
    var lista = (st.bib || []).filter(function (i) { return (filtro === 'todos' || i.categoria === filtro) && bibBate(i, busca); });
    var opCat = function (v) { return Object.keys(BIB_CAT).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + BIB_CAT[k] + '</option>'; }).join(''); };
    fundo.innerHTML = '<div class="modal largo" role="dialog" aria-modal="true"><p class="eyebrow-m">minha biblioteca</p><h2>ferragens do <em>meu SketchUp</em></h2>' +
      '<p class="sub-m">' + (st.bib || []).length + ' itens · os arquivos ficam no seu computador e valem para todos os projetos.</p>' +
      '<input id="bib-ger-busca" class="bib-busca" type="search" placeholder="Buscar por nome, marca, categoria ou medida" value="' + esc(busca) + '">' +
      '<div class="pilulas">' + [['todos', 'Todos']].concat(Object.keys(BIB_CAT).map(function (k) { return [k, BIB_CAT[k]]; })).map(function (o) { return '<button class="pilula pequena' + (filtro === o[0] ? ' ativo' : '') + '" data-bib-cat-f="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="lista-m bib-lista">' + (lista.length ? lista.map(function (i) {
        return '<div class="bib-linha" data-bib-id="' + esc(i.id) + '"><div class="bib-mini">' + bibMini(i) + '</div><div class="bib-campos">' +
          '<input data-bib-campo="nome" value="' + esc(i.nome) + '" aria-label="Nome"><input data-bib-campo="marca" value="' + esc(i.marca || '') + '" placeholder="marca" aria-label="Marca">' +
          '<select data-bib-campo="categoria" aria-label="Categoria">' + opCat(i.categoria) + '</select>' +
          '<select data-bib-campo="encaixe" aria-label="Tamanho"><option value="real"' + (i.encaixe !== 'esticar' ? ' selected' : '') + '>tamanho real</option><option value="esticar"' + (i.encaixe === 'esticar' ? ' selected' : '') + '>esticar no comprimento</option></select>' +
          (i.categoria === 'corredica' ? '<label class="tex-larg">folga de cada lado (mm)<input data-bib-campo="folga" type="number" min="1" step="0.1" value="' + (i.folga || '') + '" placeholder="12,5"></label>' : '') +
          '<small>' + bibMedidas(i.medidas) + (i.existe === false ? ' · arquivo não encontrado' : '') + '</small></div>' +
          '<button class="bib-rem" data-bib-rem="' + esc(i.id) + '" aria-label="Remover" title="Remover">' + IC.lixo + '</button></div>';
      }).join('') : '<p class="ajuda">Nenhum item' + (busca ? ' para "' + esc(busca) + '"' : '') + '.</p>') + '</div>' +
      bibBotoes(filtro === 'todos' ? 'outro' : filtro).replace(/<button class="botao pequeno fantasma" data-act="bibGerenciar">[\s\S]*?<\/button>/, '') +
      '<div class="botoes-m"><button class="botao primario" data-fechar-modal>pronto</button></div></div>';
  }

  // altura recomendada da frente (mm): gaveta de talheres/utensílios, gavetão de panelas, gavetão com gaveta interna
  var GAV_REC = { gaveta: [100, 300], gavetao: [250, 450], interna: [300, 450] };
  // ---------- interior por módulos (de baixo para cima)
  var IC_MOD = {
    prateleiras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18"/><path d="M4 9h16M4 15h16"/></svg>',
    gavetas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="6"/><rect x="4" y="13" width="16" height="6"/><path d="M10 8h4M10 16h4"/></svg>',
    cabideiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18"/><path d="M12 6v2a2 2 0 1 0-2 2l-6 5h16l-6-5"/></svg>',
    sapateira: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 10h16M4 17h16"/><path d="M6 10V8h4l3 2M7 17v-2h4l3 2"/></svg>',
    maleiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="8" width="14" height="10" rx="1.5"/><path d="M9 8V6h6v2"/></svg>',
    vazio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" stroke-dasharray="2 2"/></svg>'
  };
  function interiorHtml(sec, base) {
    var mods = sec.interno || [];
    var h = '<div class="int-bloco"><div class="campo"><label>Interior por módulos' + aj('interior') + '</label></div>';
    h += '<div class="int-prontos">' + Object.keys(E.INTERNOS_PRONTOS).map(function (k) { return '<button class="pilula pequena" data-act="intPronto:' + k + '">' + esc(E.INTERNOS_PRONTOS[k].nome) + '</button>'; }).join('') + '</div>';
    if (!mods.length) return h + '<p class="ajuda">Escolha uma combinação pronta ou monte do zero: gavetas internas, cabideiro (alto, médio, baixo, infantil), sapateira, prateleiras, maleiro. <button class="link" data-act="intAdd:prateleiras">montar por módulos</button></p></div>';
    // alturas reais calculadas
    var reais = (st.modelo.elementos || []).filter(function (el) { return el.tipo === 'modulo' && el.col === st.sel.col; }).sort(function (x, y) { return x.z0 - y.z0; });
    h += '<div class="int-lista">';
    for (var k = mods.length - 1; k >= 0; k--) {
      var m = mods[k], real = reais[k] ? Math.round(reais[k].z1 - reais[k].z0) : null;
      var rec = m.tipo === 'gavetas' ? (m.qtd || 2) * E.REC_INTERNO.gaveta : m.tipo === 'sapateira' ? (m.qtd ? m.qtd * E.REC_INTERNO.sapateira : null) : m.tipo === 'cabideiro' ? E.USOS_CABIDEIRO[m.uso || 'medio'].altura : null;
      h += '<div class="int-mod"><div class="int-topo"><span class="int-n">' + (mods.length - k) + '</span><div class="int-tipos">' + Object.keys(E.MODULOS_INTERNOS).map(function (t) {
        return '<button class="int-tipo' + (m.tipo === t ? ' ativo' : '') + '" data-act="intTipo:' + k + ':' + t + '" title="' + esc(E.MODULOS_INTERNOS[t]) + '">' + IC_MOD[t] + '</button>';
      }).join('') + '</div><div class="int-acoes"><button data-act="intMover:' + k + ':1" title="Subir"' + (k === mods.length - 1 ? ' disabled' : '') + '>↑</button><button data-act="intMover:' + k + ':-1" title="Descer"' + (k === 0 ? ' disabled' : '') + '>↓</button><button data-act="intDel:' + k + '" title="Tirar">×</button></div></div>';
      h += '<div class="int-corpo"><b>' + esc(E.MODULOS_INTERNOS[m.tipo]) + (m.tipo === 'cabideiro' ? ' ' + esc(m.uso || 'medio') : '') + '</b>';
      if (m.tipo === 'cabideiro') h += '<div class="pilulas">' + Object.keys(E.USOS_CABIDEIRO).map(function (u) { return '<button class="pilula pequena' + ((m.uso || 'medio') === u ? ' ativo' : '') + '" data-act="intUso:' + k + ':' + u + '" title="' + esc(E.USOS_CABIDEIRO[u].nome) + '">' + u + '</button>'; }).join('') + '</div>';
      if (m.tipo === 'gavetas' || m.tipo === 'sapateira' || m.tipo === 'prateleiras' || m.tipo === 'maleiro') h += '<div class="campo"><label>' + (m.tipo === 'gavetas' ? 'Gavetas' : m.tipo === 'sapateira' ? 'Níveis' : 'Prateleiras') + '</label><span class="passo"><button data-act="intQtd:' + k + ':-1">−</button><span>' + (m.qtd || 'auto') + '</span><button data-act="intQtd:' + k + ':1">+</button></span></div>';
      h += '<div class="int-alt"><small>' + (real !== null ? 'altura livre <b>' + real + ' mm</b>' : '') + (rec ? ' · recomendado ' + rec + ' mm' : (m.tipo === 'prateleiras' || m.tipo === 'maleiro' || m.tipo === 'vazio' ? ' · ocupa o que sobra' : '')) + '</small>' +
        '<input type="number" min="60" step="10" data-path="' + base + 'interno.' + k + '.altura" data-tipo="numnull" value="' + (m.altura || '') + '" placeholder="' + (real !== null ? real : 'auto') + '" title="Altura livre do módulo (mm). Vazio = recomendada"></div></div></div>';
    }
    h += '</div><div class="int-add">' + ['gavetas', 'cabideiro', 'prateleiras', 'sapateira', 'maleiro'].map(function (t) { return '<button class="botao pequeno" data-act="intAdd:' + t + '">' + IC_MOD[t] + '+ ' + esc(E.MODULOS_INTERNOS[t].toLowerCase()) + '</button>'; }).join('') +
      '<button class="link" data-act="intLimpar">voltar ao interior simples</button></div>';
    h += '<p class="ajuda">Módulo 1 é o de baixo. Gavetas internas levam calço de 25 mm de cada lado para passar da dobradiça. Entre os módulos vai uma prateleira fixa.</p></div>';
    return h;
  }

  function fmtMm(v) { return Math.round(v) + ' mm'; }
  function fmtM(v) { return m2(v) + ' m'; }

  // ---------- aba Móvel
  function abaMovel() {
    var s = st.spec;
    var com = E.COMODOS[s.comodo] ? s.comodo : E.comodoDoTipo(s.tipo, s.ambiente);
    // 1 · o cômodo decide quais móveis aparecem
    var h = '<div class="grupo"><h4>Ambiente' + aj('comodo') + '</h4><div class="grade-cards comodos">';
    Object.keys(E.COMODOS).forEach(function (k) {
      h += '<button class="card-op' + (com === k ? ' ativo' : '') + '" data-act="comodo:' + k + '">' + (IC['c_' + k] || '') + '<span>' + E.COMODOS[k].label + '</span></button>';
    });
    h += '</div></div>';
    // 2 · móveis daquele ambiente (ou todos)
    var lista = st.todosTipos ? Object.keys(E.TIPOS) : E.COMODOS[com].tipos.slice();
    if (lista.indexOf(s.tipo) < 0) lista.push(s.tipo);
    h += '<div class="grupo"><h4>Móvel · ' + esc(E.COMODOS[com].label.toLowerCase()) + aj('tipo') + '</h4><div class="grade-cards">';
    lista.forEach(function (k) {
      h += '<button class="card-op' + (s.tipo === k ? ' ativo' : '') + '" data-act="tipo:' + k + '">' + (IC[k] || '') + '<span>' + E.TIPOS[k].label + '</span></button>';
    });
    h += '</div><p class="ajuda"><a href="#" data-act="todosTipos">' + (st.todosTipos ? 'mostrar só os móveis de ' + esc(E.COMODOS[com].label.toLowerCase()) : 'ver todos os tipos de móvel') + '</a></p></div>';
    h += '<div class="grupo"><h4>Umidade do ambiente <span style="text-transform:none;letter-spacing:0;font-weight:400">(define os materiais)</span>' + aj('ambiente') + '</h4>' + pilulas('ambiente', Object.keys(E.AMBIENTES).map(function (k) { return [k, E.AMBIENTES[k].label]; }), true) +
      '<p class="ajuda amb">' + esc(E.AMBIENTES[s.ambiente].texto) + '</p></div>';
    if (s.tipo === 'personalizado') {
      h += '<div class="grupo"><h4>Composição <span style="text-transform:none;letter-spacing:0;font-weight:400">de cima para baixo</span>' + aj('composicao') + '</h4><div class="pilulas">' +
        Object.keys(E.COMPOSICOES).map(function (k) { return '<button class="pilula' + (s.composicao === k ? ' ativo' : '') + '" data-act="comp:' + k + '">' + E.COMPOSICOES[k] + '</button>'; }).join('') + '</div></div>';
    }
    var ro = s.origemVolume ? ' readonly title="Medida do volume selecionado no modelo"' : '';
    h += '<div class="grupo"><h4>Medidas principais' + aj('medidas') + '</h4><div class="tres-campos">' +
      '<div><label>Largura (L) mm</label><input type="number" data-path="L" data-tipo="num" value="' + Math.round(s.L) + '"' + ro + '></div>' +
      '<div><label>Profund. (P) mm</label><input type="number" data-path="D" data-tipo="num" value="' + Math.round(s.D) + '"' + ro + '></div>' +
      '<div><label>Altura (A) mm</label><input type="number" data-path="H" data-tipo="num" value="' + Math.round(s.H) + '"' + ro + '></div></div>' +
      (s.origemVolume ? '<p class="ajuda">Medidas do volume selecionado no modelo. <a href="#" data-act="liberarMedidas">Editar mesmo assim</a></p>' : '<p class="ajuda">Dica: selecione um volume (caixa) no SketchUp antes de abrir a planê.mob para puxar as medidas e a posição.</p>') + '</div>';

    h += '<div class="grupo"><h4>Base · rodapé' + aj('base') + '</h4>' + cartoes('base.tipo', [['rodape', 'Rodapé recuado', 'base_rodape'], ['suspenso', 'Suspenso', 'base_suspenso'], ['pes', 'Pés', 'base_pes'], ['nenhum', 'Sem base', 'base_nenhum']]);
    if (s.base.tipo === 'rodape' || s.base.tipo === 'pes') h += deslizante('Altura', 'base.altura', 40, 200, 5, fmtMm) + deslizante('Recuo', 'base.recuo', 0, 120, 5, fmtMm);
    if (s.base.tipo === 'suspenso') h += campoNum('Altura do piso até o móvel', 'elevacao', 'mm');
    h += '</div>';
    h += '<div class="grupo"><h4>Roda-teto' + aj('rodaTeto') + '</h4>' + interruptor('Fechar até o teto com roda-teto', 'rodaTeto.ativo');
    if (s.rodaTeto.ativo) h += deslizante('Altura', 'rodaTeto.altura', 20, 300, 5, fmtMm) + deslizante('Recuo', 'rodaTeto.recuo', 0, 80, 5, fmtMm);
    h += '</div>';
    h += '<div class="grupo"><h4>Estrutura' + aj('estrutura') + '</h4><div class="campo"><label>Topo</label></div>' + cartoes('topo', [['travessas', 'Travessas sob o tampo', 'topo_travessas'], ['chapa', 'Chapa inteira', 'topo_chapa']]);
    if (s.topo === 'travessas') h += campoNum('Largura das travessas', 'travessaLargura', 'mm');
    h += '<div class="campo"><label>Fundo</label></div>' + cartoes('fundo.tipo', [['sobreposto', 'Sobreposto', 'fundo_sobreposto'], ['encaixado', 'Encaixado', 'fundo_encaixado'], ['nenhum', 'Sem fundo', 'fundo_nenhum']]);
    h += '<div class="tres-campos" style="margin-top:10px"><div><label>Caixaria</label><input type="number" data-path="esp.caixa" data-tipo="num" value="' + s.esp.caixa + '"></div><div><label>Frentes</label><input type="number" data-path="esp.frente" data-tipo="num" value="' + s.esp.frente + '"></div><div><label>Fundo</label><input type="number" data-path="esp.fundo" data-tipo="num" value="' + s.esp.fundo + '"></div></div>';
    h += '<p class="ajuda">Espessuras em mm. Gavetas: ' + s.esp.gaveta + ' mm (lateral) e ' + s.esp.fundoGaveta + ' mm (fundo).</p></div>';

    var cubaPossivel = s.tipo === 'balcao' || s.tipo === 'gabinete' || s.tipo === 'personalizado';
    if (cubaPossivel) {
      h += '<div class="grupo"><h4>Cuba e tampo' + aj('cuba') + '</h4>' + interruptor('Tem cuba sobre este móvel', 'cuba.ativa');
      if (s.pedra && s.pedra.ativa) h += interruptor('Tampo com cantos da frente arredondados', 'pedra.cantos') + (s.pedra.cantos ? deslizante('Raio do tampo', 'pedra.raio', 10, 150, 5, fmtMm) : '');
      if (s.cuba.ativa) {
        h += campoNum('Centro da cuba (a partir da esquerda)', 'cuba.centro', 'mm') + campoNum('Largura da cuba', 'cuba.largura', 'mm') + campoNum('Profundidade da cuba', 'cuba.profundidade', 'mm');
        if (s.cuba.origem === 'modelo') h += '<p class="ajuda ok-linha">' + ILU.st_ok + 'Posição detectada no modelo.</p>';
        h += '<div class="campo"><label>Fundo do módulo da cuba</label></div>' + pilulas('cuba.fundo', [['sem', 'Sem fundo'], ['furo', 'Fundo com furo p/ sifão']], true);
        if (s.cuba.fundo === 'furo') h += '<div class="tres-campos"><div><label>Ø do furo</label><input type="number" data-path="cuba.furo" data-tipo="num" value="' + (s.cuba.furo || 100) + '"></div><div><label>Altura do furo</label><input type="number" data-path="cuba.alturaFuro" data-tipo="num" value="' + (s.cuba.alturaFuro || 500) + '"></div><div></div></div><p class="ajuda">Altura medida do piso até o centro do furo (confira a saída de esgoto na obra). O fundo fica removível (parafusado) para a manutenção.</p>';
      }
      h += '<div class="linha-botoes">' + (emSketchUp ? '<button class="botao pequeno" data-act="detectarCuba">Detectar cuba no modelo</button>' : '') + '<button class="botao pequeno" data-act="redistribuir">Redistribuir colunas</button></div>';
      h += interruptor('Desenhar tampo de pedra', 'pedra.ativa', 'Deixe desligado se o tampo já está modelado no projeto.');
      if (s.pedra.ativa) h += campoNum('Espessura', 'pedra.espessura', 'mm') + campoNum('Avanço frontal', 'pedra.avancoFrente', 'mm') + campoNum('Avanço nas laterais', 'pedra.avancoLados', 'mm');
      h += '</div>';
    }
    h += '<div class="grupo"><h4>Chapa' + aj('chapa') + '</h4>' + campoNum('Comprimento', 'chapa.comprimento', 'mm') + campoNum('Largura', 'chapa.largura', 'mm') + campoNum('Refilo (cada lado)', 'chapa.refilo', 'mm') + campoNum('Espessura da serra', 'chapa.serra', 'mm') +
      interruptor('Emendar peças longas sobre divisórias', 'emendaAuto', 'Desligado: a conferência avisa para o marceneiro decidir a emenda.', 'emenda') + '</div>';
    return h;
  }

  // ---------- aba Montagem
  function nomeSecao(sec) {
    if (sec.tipo === 'gavetas') return sec.itens.length + ' gaveta' + (sec.itens.length > 1 ? 's' : '') + (sec.itens.some(function (i) { return i.tipo === 'interna'; }) ? ' (c/ interna)' : '');
    return E.TIPOS_SECAO[sec.tipo] || sec.tipo;
  }

  function abaMontagem() {
    var s = st.spec, M = st.modelo;
    var h = '<div class="grupo"><h4>Portas, gavetas e interior' + aj('larguraMax') + '</h4>';
    h += deslizante('Largura máxima de porta', 'larguraMax', 300, 1000, 10, fmtM);
    h += '<div class="campo"><label>Divisórias internas' + aj('divisorias') + '</label></div>' + cartoes('divisorias', [['cada', 'Cada porta', 'div_cada'], ['par', 'Cada par', 'div_par'], ['nenhuma', 'Nenhuma', 'div_nenhuma']]);
    h += '<div class="campo" style="margin-top:10px"><label>Prateleiras por vão' + aj('prateleiras') + '</label><span class="passo"><button data-act="pratTodas:-1">−</button><span>' + pratComum() + '</span><button data-act="pratTodas:1">+</button></span></div>';
    h += '<div class="linha-botoes"><button class="botao pequeno" data-act="redistribuir">Redistribuir colunas pela largura máxima</button></div></div>';

    h += '<div class="grupo"><h4>Montagem das colunas' + aj('colunas') + '</h4><div class="colunas-barra">';
    s.colunas.forEach(function (c, i) {
      h += '<button class="col-btn' + (i === st.sel.col ? ' ativo' : '') + (M.colunas[i] && M.colunas[i].cuba ? ' cuba' : '') + '" data-act="col:' + i + '" title="' + esc(c.secoes.map(nomeSecao).join(' / ')) + '">' + (i + 1) + '</button>';
    });
    h += '<button class="col-btn" data-act="colAdd" title="Adicionar coluna">+</button><button class="col-btn" data-act="colDel" title="Remover coluna selecionada">−</button></div>';

    var c = colSel(), mc = M.colunas[st.sel.col] || {};
    var sec = secSel();
    h += '<div class="cartao-col"><div class="topo-col"><strong>Coluna ' + (st.sel.col + 1) + '</strong><span>' + (mc.larg ? m2(mc.larg) + ' m' : '') + (mc.cuba ? ' · sob a cuba' : '') + '</span></div>';
    h += '<div class="campo"><label>Largura' + aj('largura') + '</label></div><div class="pilulas">';
    var larguras = [[null, 'Auto'], [150, '0,15'], [300, '0,30'], [400, '0,40'], [450, '0,45'], [600, '0,60']];
    larguras.forEach(function (l) { h += '<button class="pilula pequena' + ((c.largura || null) === l[0] ? ' ativo' : '') + '" data-act="larg:' + (l[0] || 'auto') + '">' + l[1] + '</button>'; });
    h += '</div><div class="campo"><label>Largura exata</label><input type="number" data-path="colunas.' + st.sel.col + '.largura" data-tipo="numnull" value="' + (c.largura || '') + '" placeholder="' + (mc.larg ? Math.round(mc.larg) : '') + '"><span class="un">mm</span></div>';
    if (st.sel.col === 0 || st.sel.col === st.spec.colunas.length - 1) {
      h += '<div class="campo"><label>Canto em L (canto cego)</label></div>' + pilulas('colunas.' + st.sel.col + '.canto', [['', 'Não'], [st.sel.col === 0 ? 'esq' : 'dir', st.sel.col === 0 ? 'Canto à esquerda' : 'Canto à direita']], true);
      if (c.canto) h += campoNum('Parte escondida (atrás do outro balcão)', 'colunas.' + st.sel.col + '.cego', 'mm', ' placeholder="' + (st.spec.D + 20) + '"') + '<p class="ajuda">Sem porta na parte escondida; a porta fica na parte visível com dobradiça de 165° e um espaçador de 70 mm para não bater no puxador do outro balcão. Coluna de canto costuma ter 90 a 100 cm.</p>';
    }
    if (st.sel.col < st.spec.colunas.length - 1) {
      h += '<div class="linha-botoes">' + (c.divisoria === 'unir' ? '<button class="botao pequeno" data-act="separarProx">' + IC_MOD.vazio + 'Separar da coluna ' + (st.sel.col + 2) + '</button>' : '<button class="botao pequeno" data-act="mesclarProx">' + IC.abaMontagem + 'Mesclar com a coluna ' + (st.sel.col + 2) + ' (porta par)</button>') + '</div>';
      h += '<div class="campo"><label>Divisória à direita' + aj('divisorias') + '</label></div>' + pilulas('colunas.' + st.sel.col + '.divisoria', [['auto', 'Automática'], ['unir', 'Tirar (mesclar o interno)'], ['manter', 'Manter']], true);
      if (c.divisoria === 'unir') h += '<p class="ajuda">O interior desta coluna e o da próxima viram um vão só; as portas continuam iguais. Vale quando as duas colunas têm as mesmas faixas (portas, correr, nicho ou basculante).</p>';
    }

    // faixas
    h += '<div class="campo"><label>Faixas' + aj('faixas') + '</label><button class="botao pequeno" data-act="faixaAdd">+ faixa no topo</button></div><div class="faixas">';
    for (var j = c.secoes.length - 1; j >= 0; j--) {
      var sj = c.secoes[j], msj = (mc.secoes || [])[j];
      h += '<div class="faixa' + (j === st.sel.secao ? ' ativo' : '') + '" data-act="faixa:' + j + '"><span class="nfx">' + (c.secoes.length - j) + '</span><span class="tfx">' + esc(nomeSecao(sj)) + '</span>' +
        (c.secoes.length > 1 ? '<input type="number" data-path="colunas.' + st.sel.col + '.secoes.' + j + '.altura" data-tipo="numnull" value="' + (sj.altura || '') + '" placeholder="' + (msj ? Math.round(msj.alt) : 'auto') + '" title="Altura da faixa (mm)">' : '') +
        (c.secoes.length > 1 ? '<button class="x" data-act="faixaDel:' + j + '" title="Remover faixa">×</button>' : '') + '</div>';
    }
    h += '</div>';

    h += '<div class="campo"><label>Esta faixa é' + aj('tipoFaixa') + '</label></div><div class="icone-tipo">';
    Object.keys(E.TIPOS_SECAO).forEach(function (k) {
      h += '<button class="card-op' + (sec.tipo === k ? ' ativo' : '') + '" data-act="secTipo:' + k + '">' + (IC[k] || IC['sec_' + k] || '') + '<span>' + E.TIPOS_SECAO[k] + '</span></button>';
    });
    h += '</div>';
    h += opcoesSecao(sec);
    h += '</div></div>';
    return h;
  }

  function pratComum() {
    var v = null;
    st.spec.colunas.forEach(function (c) { c.secoes.forEach(function (s) { if (s.tipo === 'portas' && s.interior === 'prateleiras' && v === null) v = s.prateleiras; }); });
    return v === null ? 0 : v;
  }

  function opcoesSecao(sec) {
    var base = 'colunas.' + st.sel.col + '.secoes.' + st.sel.secao + '.';
    var h = '';
    function pil(path, ops) { return pilulas(base + path, ops, true); }
    function passo(path, min, max) {
      var v = getPath(st.spec, base + path);
      return '<span class="passo"><button data-act="passo:' + base + path + ':-1:' + min + ':' + max + '">−</button><span>' + v + '</span><button data-act="passo:' + base + path + ':1:' + min + ':' + max + '">+</button></span>';
    }
    if (sec.tipo === 'portas') {
      h += '<div class="campo"><label>Portas na coluna' + aj('portas') + '</label></div>' + pil('portas', [[0, 'Auto'], [1, '1 porta'], [2, '2 portas']]);
      h += '<div class="campo"><label>Dobradiça (porta única)</label></div>' + pil('dobradica', [['auto', 'Auto'], ['esq', 'Esquerda'], ['dir', 'Direita']]);
    }
    if (sec.tipo === 'portas' && sec.interno && sec.interno.length) h += interiorHtml(sec, base);
    else if (sec.tipo === 'portas' || sec.tipo === 'basculante' || sec.tipo === 'nicho') {
      if (sec.tipo === 'portas') h += interiorHtml(sec, base);
      h += '<div class="campo"><label>Interior' + aj('interior') + '</label></div>' + pil('interior', [['prateleiras', 'Prateleiras'], ['cabideiro', 'Cabideiro'], ['vazio', 'Vazio']]);
      if (sec.interior === 'prateleiras') {
        h += '<div class="campo"><label>Prateleiras</label>' + passo('prateleiras', 0, 8) + '</div>';
        if (sec.prateleiras > 0) {
          // alturas reais calculadas (mm do piso do vão até a face de cima de cada prateleira)
          var prs = (st.modelo.pecas || []).filter(function (p) { return p.nome === 'Prateleira' && p.col === st.sel.col && p.secao === st.sel.secao; });
          var vmS = (st.modelo.vaos || []).filter(function (v) { return v.colunas.some(function (c) { return c.idx === st.sel.col; }); })[0];
          var smS = vmS && vmS.secoes.filter(function (x) { return x.idx === st.sel.secao; })[0];
          var altsReais = [];
          prs.forEach(function (p) { var a = Math.round(p.z + p.dz - (smS ? smS.ib : 0)); if (altsReais.indexOf(a) < 0) altsReais.push(a); });
          altsReais.sort(function (a, b) { return a - b; });
          h += '<div class="prat-alturas"><label>Altura de cada prateleira <small>(mm, do piso do vão até a face de cima' + (smS ? '; vão de ' + Math.round(smS.altInt) + ' mm' : '') + ')</small></label><div class="prat-lista">';
          for (var kp = 0; kp < sec.prateleiras; kp++) {
            var vp = (sec.pratAlturas || [])[kp];
            h += '<span class="prat-item"><i>' + (kp + 1) + '</i><input type="number" min="60" step="10" data-path="' + base + 'pratAlturas.' + kp + '" data-tipo="numnull" value="' + (vp || '') + '" placeholder="' + (altsReais[kp] !== undefined ? altsReais[kp] : 'auto') + '"></span>';
          }
          h += '</div>' + (Object.keys(sec.pratAlturas || {}).some(function (kk) { return sec.pratAlturas[kk]; }) ? '<button class="gav-auto" data-act="pratAuto">igualar (automático)</button>' : '') + '<p class="ajuda">Vazio = espaçamento igual. Veja na vista frontal → interno.</p></div>';
        }
      }
      if (sec.tipo === 'portas' || sec.tipo === 'correr') {
        h += interruptor('Divisória interna (atrás das portas)', base + 'divOn');
        if (sec.divOn) {
          var vmD = (st.modelo.vaos || []).filter(function (v) { return v.colunas.some(function (c) { return c.idx === st.sel.col; }); })[0];
          h += campoNum('Posição (a partir da lateral esquerda interna)', base + 'divInterna', 'mm', vmD ? ' placeholder="' + Math.round(vmD.largInt / 2) + ' (meio)"' : '') + '<p class="ajuda">As prateleiras ficam dos dois lados, na mesma altura.' + (vmD ? ' Vão interno de ' + Math.round(vmD.largInt) + ' mm.' : '') + '</p>';
        }
      }
    }
    if (['portas', 'gavetas', 'basculante', 'correr', 'temperos', 'lixeira', 'fruteira'].indexOf(sec.tipo) >= 0) {
      h += '<div class="campo"><label>Tipo de frente desta faixa</label></div>' + pil('estilo', [['', 'Igual às outras'], ['lisa', 'Lisa'], ['ripada', 'Ripada'], ['moldura', 'Moldura'], ['vidro', 'Vidro'], ['palhinha', 'Palhinha']]);
      if (sec.estilo === 'vidro') h += '<p class="ajuda">O vidro é o escolhido na etapa Frentes (canelado, fumê, bronze...). Gavetas continuam em MDF.</p>';
      h += '<div class="campo"><label>Cor das frentes desta faixa</label></div>' + pil('frente2', [['', 'Principal'], ['1', 'Segunda cor']]);
      if (sec.frente2 && !st.spec.materiais.frente2) h += '<p class="ajuda">Escolha a segunda cor na etapa Acabamento (enquanto isso, fica igual à principal).</p>';
    }
    if (sec.tipo === 'coifa') {
      var cfU = sec.coifa || {};
      h += '<div class="tres-campos"><div><label>Largura da coifa</label><input type="number" data-path="' + base + 'coifa.largura" data-tipo="num" value="' + (cfU.largura || 520) + '"></div><div><label>Profundidade</label><input type="number" data-path="' + base + 'coifa.profundidade" data-tipo="num" value="' + (cfU.profundidade || 280) + '"></div><div><label>Duto Ø</label><input type="number" data-path="' + base + 'coifa.duto" data-tipo="num" value="' + (cfU.duto || 150) + '"></div></div>';
      h += '<p class="ajuda">A coifa fica embaixo (a base leva o recorte dela) e o duto sobe pelo meio do vão, saindo por um furo no topo. Confira as medidas no manual do aparelho.</p>';
    }
    if (sec.tipo === 'nicho') h += interruptor('Moldura frontal no nicho', base + 'moldura');
    if (sec.tipo === 'arco') h += '<div class="campo"><label>Prateleiras abaixo do arco</label>' + passo('prateleiras', 0, 8) + '</div>';
    if (sec.tipo === 'gavetas') {
      h += '<div class="campo"><label>Quantidade' + aj('gavetas') + '</label><span class="passo"><button data-act="gavQtd:-1">−</button><span>' + sec.itens.length + '</span><button data-act="gavQtd:1">+</button></span></div>';
      // altura real de cada frente (calculada pelo motor), de baixo para cima
      var frentesG = (st.modelo.pecas || []).filter(function (p) { return p.nome === 'Frente gaveta' && p.col === st.sel.col && p.secao === st.sel.secao; }).sort(function (a, b) { return a.z - b.z; });
      h += '<div class="gav-lista">';
      for (var k = sec.itens.length - 1; k >= 0; k--) {
        var it = sec.itens[k], rec = GAV_REC[it.tipo] || GAV_REC.gaveta;
        var real = frentesG[k] ? Math.round(frentesG[k].dz) : null;
        var fora = real !== null && (real < rec[0] || real > rec[1]);
        h += '<div class="gav-item' + (fora ? ' fora' : '') + '"><span class="ngv">' + (sec.itens.length - k) + '</span><div class="gav-meio"><div class="pilulas">' +
          Object.keys(E.TIPOS_ITEM_GAVETA).map(function (t) { return '<button class="mini-ilus' + (it.tipo === t ? ' ativo' : '') + '" data-act="gavTipo:' + k + ':' + t + '" title="' + E.TIPOS_ITEM_GAVETA[t] + '">' + (ILU['gav_' + t] || '') + '<span>' + E.TIPOS_ITEM_GAVETA[t] + '</span></button>'; }).join('') +
          '</div><small class="gav-rec">' + (real !== null ? 'frente com <b>' + real + ' mm</b>' + (it.altura ? '' : ' (automática)') + ' · ' : '') + 'recomendado ' + rec[0] + ' a ' + rec[1] + ' mm' + (fora ? ' · ' + (real < rec[0] ? 'baixa demais' : 'alta demais') : '') + '</small></div>' +
          '<select class="gav-org" data-path="' + base + 'itens.' + k + '.org" title="Organizador dentro da gaveta"><option value=""' + (!it.org ? ' selected' : '') + '>sem divisória</option><option value="talheres"' + (it.org === 'talheres' ? ' selected' : '') + '>talheres (4)</option><option value="grade"' + (it.org === 'grade' ? ' selected' : '') + '>grade (3 × 3)</option></select>' +
          '<div class="gav-alt"><label>altura (mm)</label><input type="number" min="60" max="1200" step="5" data-path="' + base + 'itens.' + k + '.altura" data-tipo="numnull" value="' + (it.altura || '') + '" placeholder="' + (real !== null ? real : 'auto') + '" title="Altura da frente em mm. Vazio = automática (divide o espaço que sobra)">' +
          (it.altura ? '<button class="gav-auto" data-act="gavAuto:' + k + '" title="Voltar para automática">auto</button>' : '') + '</div></div>';
      }
      h += '</div><p class="ajuda">Gaveta 1 é a de cima. Digite a altura da frente para fixar; vazio fica automática e divide o espaço que sobra entre as outras. Recomendado: gaveta ' + GAV_REC.gaveta.join(' a ') + ' mm, gavetão ' + GAV_REC.gavetao.join(' a ') + ' mm, gavetão c/ interna ' + GAV_REC.interna.join(' a ') + ' mm (cria uma gaveta oculta de 80 mm dentro).</p>';
    }
    if ((sec.tipo === 'temperos' || sec.tipo === 'fruteira') && !(sec.bib && sec.bib.id)) h += '<div class="campo"><label>Cestos aramados' + aj('aramados') + '</label>' + passo('cestos', 1, 6) + '</div>';
    if (sec.tipo === 'lixeira' && !(sec.bib && sec.bib.id)) h += '<div class="campo"><label>Cestos' + aj('lixeira') + '</label></div>' + pil('baldes', [[1, '1 cesto'], [2, '2 cestos (seletiva)']]);
    if (sec.tipo === 'correr') {
      h += '<div class="campo"><label>Folhas</label></div>' + pil('folhas', [[0, 'Auto'], [2, '2'], [3, '3'], [4, '4']]);
      // personalizar cada folha
      var elC = (st.modelo.elementos || []).filter(function (el) { return el.tipo === 'correr' && el.col === st.sel.col; })[0];
      var nFol = elC ? elC.folhas : (sec.folhas || 2);
      var ACABS = [['mdf', 'MDF'], ['vidro', 'Vidro'], ['reflecta', 'Reflecta'], ['espelho', 'Espelho'], ['palhinha', 'Palhinha']];
      h += '<div class="campo"><label>Todas as folhas</label></div>' + pil('acabCorrer', ACABS);
      if ((sec.acabCorrer || 'mdf') === 'vidro') h += '<div class="pilulas">' + Object.keys(E.VIDROS).filter(function (k) { return k !== 'espelho' && k !== 'reflecta'; }).map(function (k) { return '<button class="pilula pequena com-cor' + ((sec.vidroCorrer || 'incolor') === k ? ' ativo' : '') + '" data-act="set" data-path="' + base + 'vidroCorrer" data-val="' + k + '"><i style="background:' + E.VIDROS[k].cor + '"></i>' + esc(E.VIDROS[k].nome.replace(/ 4 mm$/, '').replace(/^Vidro /, '')) + '</button>'; }).join('') + '</div>';
      h += '<div class="folhas-lista">';
      for (var kf2 = 0; kf2 < nFol; kf2++) {
        var fc = (sec.folhasCfg || [])[kf2] || {};
        h += '<div class="folha-item"><span class="int-n">' + (kf2 + 1) + '</span><div class="pilulas">' + [['', 'igual']].concat(ACABS).map(function (o) {
          return '<button class="pilula pequena' + ((fc.acab || '') === o[0] ? ' ativo' : '') + '" data-act="folhaAcab:' + kf2 + ':' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div></div>';
      }
      h += '</div><p class="ajuda">Vidro, reflecta e espelho vão num quadro de alumínio de 25 mm; reflecta é o vidro espelhado que deixa ver pouco por dentro. Para outro acabamento, escolha o mais próximo e pinte no SketchUp.</p>';
      h += '<div class="campo"><label>Puxador das folhas</label></div>' + pil('puxCorrer', [['concha', 'Concha embutida'], ['perfil', 'Perfil vertical'], ['cava', 'Cava vertical'], ['nenhum', 'Sem puxador']]);
      if ((sec.puxCorrer === 'perfil' || sec.puxCorrer === 'cava')) h += '<p class="ajuda">Perfil e cava vertical só nas folhas de MDF; nas de vidro o próprio quadro de alumínio serve de pega.</p>';
      h += '<div class="linha-botoes"><button class="botao pequeno" data-act="correrTodas">Portas de correr em todas as colunas</button></div>';
      h += '<p class="ajuda">Colunas vizinhas com portas de correr formam um só conjunto: as folhas passam por cima das divisórias, que ficam atrás segurando as prateleiras.</p>';
      h += '<p class="ajuda">As folhas correm num trilho superior duplo (roldanas) com guia embaixo, em dois planos: a da frente passa por cima da de trás, com 30 mm de transpasse. Ficam ' + (2 * st.spec.esp.frente + 6) + ' mm à frente da caixa.</p>';
      h += interiorHtml(sec, base);
      if (!(sec.interno && sec.interno.length)) {
        h += '<div class="campo"><label>Interior' + aj('interior') + '</label></div>' + pil('interior', [['prateleiras', 'Prateleiras'], ['cabideiro', 'Cabideiro'], ['vazio', 'Vazio']]);
        if (sec.interior === 'prateleiras') h += '<div class="campo"><label>Prateleiras</label>' + passo('prateleiras', 0, 8) + '</div>';
      }
      h += '<div class="campo"><label>Kit do trilho</label></div>' + bibEscolha('correr', base + 'bibCorrer', 'Padrão', {});
    }
    if (sec.tipo === 'temperos' || sec.tipo === 'fruteira' || sec.tipo === 'lixeira') h += '<div class="campo"><label>Modelo do fabricante</label></div>' + bibEscolha('aramado', base + 'bib', 'Padrão', {});
    if (sec.tipo === 'forno') h += '<p class="ajuda">Nicho para forno de embutir: interno ~56–57 × 59–60 cm, profundidade ≥ 55 cm.</p>';
    if (sec.tipo === 'micro') h += '<p class="ajuda">Nicho para micro-ondas: interno ≥ 50 × 38–46 cm, com ventilação.</p>';
    if (sec.tipo === 'geladeira') {
      if (!sec.eletro) sec.eletro = { largura: 700, altura: 1800, profundidade: 700 };
      h += '<div class="campo"><label>Medidas da geladeira' + aj('geladeira') + '</label></div>' +
        campoNum('Largura', base + 'eletro.largura', 'mm') + campoNum('Altura', base + 'eletro.altura', 'mm') + campoNum('Profundidade', base + 'eletro.profundidade', 'mm') +
        '<p class="ajuda">O nicho vai até o piso (sem base nem rodapé). A planê.mob confere 2 cm de folga de cada lado e 5 cm em cima. Use a medida do manual do modelo escolhido.</p>';
    }
    if (sec.tipo === 'espelho') h += '<p class="ajuda">Espelho 4 mm recortado em arco, colado no fundo do nicho.</p>';
    if (sec.tipo === 'painel') h += '<p class="ajuda">Faixa aberta com painel de fundo no material das frentes (ex.: entre balcão e aéreo, ou painel de TV).</p>';
    return h;
  }

  // ---------- aba Frentes
  // Ferragens: puxador, corrediças e dobradiças (genéricas da planê.mob ou da minha biblioteca .skp)
  function abaFerragens() {
    var s = st.spec;
    var est = s.frentes.estilo || 'lisa';
    var h = '';
    h += '<div class="grupo"><h4>Puxador' + aj('puxador') + '</h4><div class="grade-cards">';
    Object.keys(E.PUXADORES).forEach(function (k) {
      var bloqueado = est === 'ripada' && k === 'cava';
      h += '<button class="card-op' + (s.puxador.tipo === k ? ' ativo' : '') + (bloqueado ? ' desativado' : '') + '" data-act="set" data-path="puxador.tipo" data-val="' + k + '"' + (bloqueado ? ' disabled title="Cava não se aplica no ripado"' : '') + '>' + (IC[k] || '') + '<span>' + E.PUXADORES[k] + '</span></button>';
    });
    h += '</div>';
    if (s.puxador.tipo !== 'toque' && s.puxador.tipo !== 'nenhum') h += '<div class="campo"><label>Posição' + aj('posicao') + '</label></div>' + pilulas('puxador.posicao', [['auto', 'Auto'], ['topo', 'Topo'], ['base', 'Base'], ['lateral', 'Lateral']], true);
    if (s.puxador.tipo === 'cava') {
      h += '<div class="campo"><label>Tipo de cava</label></div>' + pilulas('puxador.cavaTipo', [['45', '45° usinada'], ['reta', 'Rasgo reto'], ['perfilJ', 'Perfil J de alumínio']], true);
      if ((s.puxador.cavaTipo || '45') === '45') h += deslizante('Vão da cava 45°', 'puxador.tamanho', 8, 14, 1, fmtMm);
      h += '<p class="ajuda">45°: chanfro atrás da borda. Rasgo reto: canal de 12 mm na frente, deixando 6 mm atrás. Perfil J: alumínio no lugar da borda (a chapa fica 22 mm menor).</p>';
    }
    if (s.puxador.tipo === 'passante') h += deslizante('Quanto a porta passa da caixa', 'puxador.passa', 10, 60, 1, fmtMm) + '<p class="ajuda">A frente passa além da caixa e vira a pega. Em aéreo, passa por baixo; em torre e roupeiro, por cima.</p>';
    if (s.puxador.tipo === 'meu') h += bibEscolha('puxador', 'puxador.bib', null, { encaixe: true, comprimento: 'puxador.comprimento', deitar: true });
    if (['alca', 'barra', 'meu'].indexOf(s.puxador.tipo) >= 0 && s.puxador.posicao !== 'topo' && s.puxador.posicao !== 'base') h += campoNum('Altura do puxador nas portas (centro, do piso)', 'puxador.alturaPiso', 'mm', ' placeholder="1100 em porta alta"');
    if (s.puxador.tipo === 'alca') h += '<div class="campo"><label>Comprimento da alça</label></div>' + pilulas('puxador.comprimento', [[96, '96'], [128, '128'], [160, '160'], [192, '192'], [256, '256'], [320, '320']], true);
    h += '</div>';
    h += '<div class="grupo"><h4>Gavetas' + aj('corredica') + '</h4>' + cartoes('gavetas.corredica', [['telescopica', 'Telescópica', 'corr_telescopica'], ['oculta', 'Oculta', 'corr_oculta']]) +
      '<p class="ajuda">Telescópica: 12,5 mm de cada lado. Oculta com amortecedor: 5 mm de cada lado, fica embaixo da gaveta.</p>' +
      '<div class="campo"><label>Modelo da corrediça ' + (s.gavetas.corredica === 'oculta' ? 'oculta' : 'telescópica') + '</label></div>' +
      bibEscolha('corredica', s.gavetas.corredica === 'oculta' ? 'gavetas.bibOculta' : 'gavetas.bibTelescopica', 'Padrão', {}) +
      '<div class="tres-campos" style="margin-top:8px"><div><label>Lateral gaveta</label><input type="number" data-path="esp.gaveta" data-tipo="num" value="' + s.esp.gaveta + '"></div><div><label>Fundo gaveta</label><input type="number" data-path="esp.fundoGaveta" data-tipo="num" value="' + s.esp.fundoGaveta + '"></div><div></div></div></div>';
    h += '<div class="grupo"><h4>Dobradiças' + aj('biblioteca') + '</h4><p class="ajuda">Caneco de 35 mm. Reta (porta bate pela frente da lateral), curva (no centro da lateral, entre duas portas) ou super curva (por dentro, porta embutida): a planê.mob escolhe pela posição de cada porta.</p>' +
      '<div class="campo"><label>Abertura</label></div>' + pilulas('frentes.anguloDobradica', [['auto', 'Auto'], [110, '110° comum'], [155, '155° ampla'], [170, '170° total']], true) +
      '<p class="ajuda">Auto: 155° na porta com gaveta interna atrás (a porta abre mais e a gaveta passa); 110° nas demais.</p>' + bibEscolha('dobradica', 'frentes.bibDobradica', 'Padrão', { deitar: true }) + '</div>';
    h += '<div class="grupo"><h4>Minha biblioteca' + aj('biblioteca') + '</h4><p class="ajuda">' + (st.bib || []).length + ' ferragens do seu SketchUp. Anexe os arquivos .skp dos fabricantes (puxadores, corrediças, dobradiças) e use em qualquer móvel; a lista de peças sai com o nome e a marca.</p>' + bibBotoes('outro') + '</div>';
    return h;
  }

  function abaFrentes() {
    var s = st.spec;
    var est = s.frentes.estilo || 'lisa';
    var h = '<div class="grupo"><h4>Tipo de frente' + aj('estiloFrente') + '</h4>' +
      cartoes('frentes.estilo', [['lisa', 'Lisa', 'porta_lisa'], ['ripada', 'Ripada', 'porta_ripada'], ['moldura', 'Moldura', 'porta_moldura'], ['vidro', 'Vidro', 'porta_vidro'], ['palhinha', 'Tela / palhinha', 'porta_palhinha']]);
    if (est === 'ripada') h += deslizante('Largura da ripa', 'frentes.ripa.largura', 10, 60, 1, fmtMm) + deslizante('Espaçamento entre ripas', 'frentes.ripa.espaco', 3, 40, 1, fmtMm) + deslizante('Espessura da ripa', 'frentes.ripa.espessura', 6, 20, 1, fmtMm) + '<p class="ajuda">Ripas aplicadas sobre todas as frentes (portas, gavetas, porta-temperos e lixeira). Cava usinada não se aplica no ripado: fica com toque, perfil ou puxador aplicado.</p>';
    if (est === 'moldura') h += '<p class="ajuda">Quadro de 6 mm aplicado sobre a frente, com largura proporcional ao tamanho da porta (25 a 60 mm).</p>';
    h += '<p class="ajuda amb">Este é o tipo de frente de todas. Para uma porta diferente (vidro no meio de molduras, por exemplo), clique nela na prévia e escolha em "Tipo de frente desta faixa", na etapa Montagem.</p>';
    if (est === 'vidro') {
      h += '<div class="campo"><label>Vidro</label></div><div class="pilulas">' + Object.keys(E.VIDROS).map(function (k) {
        var v = E.VIDROS[k];
        return '<button class="pilula pequena com-cor' + ((s.frentes.vidro || 'canelado') === k ? ' ativo' : '') + '" data-act="set" data-path="frentes.vidro" data-val="' + k + '"><i style="background:' + v.cor + '"></i>' + esc(v.nome.replace(/ 4 mm$/, '').replace(/^Vidro /, '')) + '</button>';
      }).join('') + '</div>';
      h += '<p class="ajuda">Portas e basculantes em quadro de alumínio de 20 mm com vidro 4 mm. Gavetas e aramados continuam em MDF.</p>';
      h += '<p class="ajuda amb">Outro vidro (serigrafado, laca, aramado...)? Escolha o mais parecido: a lista de compras sai com o nome, e no SketchUp é só pintar com a cor ou a textura desejada.</p>';
    }
    if (est === 'palhinha') {
      var telaAt = (s.materiais.tela && s.materiais.tela.id) || 'tela-palhinha';
      h += '<div class="campo"><label>Tela</label></div><div class="grade-amostras compacta">' + Object.keys(E.TELAS).map(function (k) {
        var t = E.TELAS[k];
        return '<button class="amostra-op' + (telaAt === t.id ? ' ativo' : '') + '" data-act="tela:' + k + '"><span class="amostra tela" style="background-color:' + t.cor + '"></span>' + esc(t.nome) + '</button>';
      }).join('') + (s.materiais.tela && s.materiais.tela.textura ? '<button class="amostra-op ativo" data-act="picker:tela">' + amostraHtml(s.materiais.tela) + esc(s.materiais.tela.nome) + '<small>minha textura</small></button>' : '') + '</div>';
      h += '<p class="ajuda">Quadro de MDF com montantes de 70 mm (cabe o caneco da dobradiça) e a tela presa num rebaixo de 8 × 6 mm por trás. Portas com menos de 24 cm ficam lisas. Cava usinada não se aplica.</p>';
      h += '<p class="ajuda amb">A tela entra com a cor aproximada. Para o render, use a sua textura: <button class="link" data-act="picker:tela">escolher ou anexar textura da tela</button> (ou pinte direto no SketchUp).</p>';
    }
    h += '</div>';
    h += '<div class="grupo"><h4>Montagem das frentes' + aj('montagem') + '</h4>' + cartoes('frentes.montagem', [['sobreposta', 'Sobreposta', 'mont_sobreposta'], ['embutida', 'Embutida', 'mont_embutida']]);
    h += deslizante('Folga entre frentes' + aj('folgas'), 'frentes.folga', 1, 6, 0.5, fmtMm);
    h += deslizante('Folga no topo (sob o tampo)', 'frentes.folgaTopo', 0, 10, 1, fmtMm);
    h += '<div class="campo"><label>Veio das frentes' + aj('veio') + '</label></div>' + pilulas('frentes.veio', [['vertical', 'Vertical'], ['horizontal', 'Horizontal']], true) + '</div>';
    h += '<div class="grupo"><h4>Prateleiras' + aj('prateleiras') + '</h4>' + deslizante('Recuo frontal', 'prateleiras.recuo', 0, 60, 5, fmtMm) + '</div>';
    var led = s.led || {};
    h += '<div class="grupo"><h4>Desempenho no SketchUp' + aj('leve') + '</h4>' + interruptor('Modo leve (ferragens simplificadas)', 'leve', 'Desenha corrediças, dobradiças e aramados de forma simples, com bem menos geometria. Use em projetos grandes; as pranchas e a lista de peças continuam iguais.') + '</div>';
    h += '<div class="grupo"><h4>Cantos arredondados</h4>' + interruptor('Cantos frontais arredondados', 'cantos.ativo', 'Uma peça curva (MDF curvado ou maciço) em cada canto da frente, alinhada com as frentes; as frentes começam depois dela.');
    if (s.cantos && s.cantos.ativo) h += deslizante('Raio do canto', 'cantos.raio', 30, 80, 5, fmtMm) + '<p class="ajuda">Com lateral de ' + s.esp.caixa + ' mm cabe até uns 6 cm de raio; para mais, use lateral dupla. O tampo de pedra acompanha a curva.</p>';
    h += '</div>';
    h += '<div class="grupo"><h4>Iluminação' + aj('iluminacao') + '</h4>' + interruptor('Fita de LED em perfil de alumínio', 'led.ativo');
    if (led.ativo) {
      h += '<div class="campo"><label>Onde</label></div>' + cartoes('led.local', [['base', 'Sob o móvel', 'led_fundo'], ['prateleiras', 'Nas prateleiras dos nichos', 'nicho_led'], ['bancada', 'Sob a bancada', 'led_frente']]);
      if (led.local === 'bancada') h += '<p class="ajuda">Perfil de sobrepor logo abaixo do tampo, no plano das portas: as frentes de cima descem 30 mm e a luz lava as portas.</p>';
      h += '<div class="campo"><label>Posição na profundidade</label></div>' + cartoes('led.posicao', [['frente', 'Frente', 'led_frente'], ['meio', 'Meio', 'led_meio'], ['fundo', 'Fundo', 'led_fundo']]);
      h += '<div class="campo"><label>Perfil</label></div>' + cartoes('led.tipo', [['embutido', 'Embutido', 'led_embutido'], ['sobreposto', 'Sobreposto', 'led_sobreposto']]);
      h += '<div class="campo"><label>Temperatura da luz</label></div><div class="pilulas">' + [[2700, 'quente'], [3000, 'quente'], [4000, 'neutra'], [6000, 'fria']].map(function (t) {
        return '<button class="pilula pequena com-cor' + (Number(led.temperatura) === t[0] ? ' ativo' : '') + '" data-act="set" data-path="led.temperatura" data-val="' + t[0] + '"><i style="background:' + E.TEMP_LED[t[0]] + '"></i>' + t[0] + 'K ' + t[1] + '</button>';
      }).join('') + '</div>';
      h += '<p class="ajuda">' + (led.posicao === 'fundo' ? 'No fundo, a 20 mm da borda: lava a parede e valoriza o revestimento.' : led.posicao === 'frente' ? 'Na frente: luz de tarefa direta sobre a bancada.' : 'No meio: luz difusa, sem ofuscar.') + ' A fonte (driver) é calculada e entra na lista de ferragens.</p>';
    }
    h += '</div>';
    return h;
  }

  // ---------- aba Acabamento
  function amostraHtml(m) {
    var img = m.img || (m.textura && texItem(m.textura) && texItem(m.textura).img);
    return '<span class="amostra' + (m.veio && !img ? ' veio' : '') + (img ? ' foto' : '') + '" style="background-color:' + esc(m.cor || '#cfc6bd') + (img ? ';background-image:url(\'' + esc(img) + '\')' : '') + '"></span>';
  }
  // ---------- minhas texturas (imagens anexadas, separadas por pasta)
  function texItem(id) { return (st.texturas || []).filter(function (t) { return t.id === id; })[0]; }
  function texComoMaterial(t) { return { id: 'tex-' + t.id, nome: t.nome, marca: t.pasta || 'minhas texturas', cor: t.cor || '#cfc6bd', veio: false, img: t.img, textura: t.id, texturaLargura: t.largura || 1200, minha: true }; }
  // cor média da textura (para a prévia e os desenhos); tenta uma vez por imagem
  function texCores() {
    st.texCorTentou = st.texCorTentou || {};
    (st.texturas || []).forEach(function (t) {
      if (t.cor || !t.img || st.texCorTentou[t.id]) return;
      st.texCorTentou[t.id] = true;
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 16; c.height = 16;
          var g = c.getContext('2d'); g.drawImage(im, 0, 0, 16, 16);
          var d = g.getImageData(0, 0, 16, 16).data, r = 0, gg = 0, b = 0;
          for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
          var n = d.length / 4, hx = function (v) { return ('0' + Math.round(v / n).toString(16)).slice(-2); };
          t.cor = '#' + hx(r) + hx(gg) + hx(b);
          enviar('texEditar', { id: t.id, cor: t.cor, silencioso: true });
        } catch (e) { /* imagem sem leitura de pixels: fica a cor neutra */ }
      };
      im.src = t.img;
    });
  }
  function abaAcabamento() {
    var s = st.spec;
    var h = '<div class="grupo"><h4>Materiais' + aj('materiais') + '</h4>';
    [['frente', 'Frentes'], ['frente2', 'Frentes · 2ª cor'], ['caixa', 'Caixaria']].forEach(function (p) {
      if (p[0] === 'frente2' && !s.materiais.frente2) {
        h += '<div class="mat-linha"><span>' + p[1] + '</span><button class="swatch-btn" data-act="picker:frente2"><span class="amostra" style="background:repeating-linear-gradient(45deg,#f4e8e5 0 4px,#fff 4px 8px)"></span><span>escolher (para frentes em duas cores)</span></button></div>';
        return;
      }
      var m = s.materiais[p[0]];
      h += '<div class="mat-linha"><span>' + p[1] + '</span><button class="swatch-btn' + (st.picker === p[0] ? ' ativo' : '') + '" data-act="picker:' + p[0] + '">' + amostraHtml(m) + '<span>' + esc((m.marca && m.marca !== 'Genérico' ? m.marca + ' · ' : '') + m.nome) + '</span></button></div>';
    });
    if (s.frentes.estilo === 'palhinha') {
      var mt = s.materiais.tela || E.TELAS.palhinha;
      h += '<div class="mat-linha"><span>Tela das portas</span><button class="swatch-btn' + (st.picker === 'tela' ? ' ativo' : '') + '" data-act="picker:tela">' + amostraHtml(mt) + '<span>' + esc(mt.nome) + '</span></button></div>';
    }
    h += '<div class="linha-botoes"><button class="botao pequeno" data-act="mesmoMaterial">Caixaria igual às frentes</button></div>';
    if (st.picker) h += pickerHtml();
    h += interruptor('MDF interno branco (economia)', 'caixaInternaBranca', null, 'internaBranca') + ajudaTexto( 'Divisórias, prateleiras, base e travessas internas saem em branco; só as laterais aparentes no padrão escolhido.');
    h += deslizante('Tamanho real da textura' + aj('textura'), 'materiais.frente.texturaLargura', 400, 2400, 50, function (v) { return m2(v) + ' m'; });
    h += '<p class="ajuda">Define a escala da textura de veio aplicada no SketchUp.</p></div>';
    h += '<div class="grupo"><h4>Gavetas e fundos</h4>';
    [['gaveta', 'Caixa das gavetas'], ['fundo', 'Fundos']].forEach(function (p) {
      var m = s.materiais[p[0]];
      h += '<div class="mat-linha"><span>' + p[1] + '</span><button class="swatch-btn' + (st.picker === p[0] ? ' ativo' : '') + '" data-act="picker:' + p[0] + '">' + amostraHtml(m) + '<span>' + esc(m.nome) + '</span></button></div>';
    });
    h += '</div>';
    h += '<div class="grupo"><h4>Padrão próprio</h4><div class="campo"><label>Nome</label><input type="text" id="novo-nome" placeholder="ex.: Laca Verde Musgo"></div>' +
      '<div class="campo"><label>Cor</label><input type="color" id="novo-cor" value="#8b6c4a" style="width:60px;height:30px;border:0;background:none"></div>' +
      '<label class="interruptor"><input type="checkbox" id="novo-veio"><span class="trilho"></span><span class="txt">Tem veio de madeira</span></label>' +
      '<div class="linha-botoes"><button class="botao pequeno" data-act="novoPadrao:frente">Aplicar nas frentes</button><button class="botao pequeno" data-act="novoPadrao:caixa">Aplicar na caixaria</button></div></div>';
    h += '<div class="grupo"><h4>Meus padrões' + aj('padrao') + '</h4><p class="ajuda">Salva materiais, puxador, espessuras, folgas e chapa para os próximos móveis.</p><div class="linha-botoes"><button class="botao pequeno" data-act="salvarPadrao">Salvar como meu padrão</button><button class="botao pequeno fantasma" data-act="restaurarPadrao">Restaurar padrão de fábrica</button></div></div>';
    return h;
  }

  function listaMateriais(chave) {
    var minhas = (st.texturas || []).map(texComoMaterial);
    if (chave === 'tela') return Object.keys(E.TELAS).map(function (k) { return E.TELAS[k]; }).concat(minhas);
    return C.LISTA.concat(st.padroes && st.padroes.personalizados ? st.padroes.personalizados : []).concat(minhas);
  }
  function pickerHtml() {
    var chave = st.picker;
    var atual = st.spec.materiais[chave];
    var pastas = [];
    (st.texturas || []).forEach(function (t) { var p0 = t.pasta || 'minhas texturas'; if (pastas.indexOf(p0) < 0) pastas.push(p0); });
    var marcas = ['Todas'].concat(chave === 'tela' ? ['Tela'] : C.MARCAS).concat(pastas);
    if (marcas.indexOf(st.marcaPicker) < 0) st.marcaPicker = 'Todas';
    var lista = listaMateriais(chave).filter(function (m) {
      if (st.marcaPicker !== 'Todas' && m.marca !== st.marcaPicker) return false;
      if (st.busca && (m.nome + ' ' + m.marca).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf(st.busca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')) < 0) return false;
      return true;
    });
    var nomes = { frente: 'das frentes', frente2: 'da 2ª cor das frentes', caixa: 'da caixaria', gaveta: 'das gavetas', fundo: 'dos fundos', tela: 'da tela' };
    var h = '<div class="picker"><div class="topo-picker"><span>Material ' + nomes[chave] + '</span><button class="botao pequeno fantasma" data-act="picker:">fechar</button></div><div class="pilulas">';
    marcas.forEach(function (m) { h += '<button class="pilula pequena' + (pastas.indexOf(m) >= 0 ? ' pasta' : '') + (st.marcaPicker === m ? ' ativo' : '') + '" data-act="marca:' + esc(m) + '">' + (pastas.indexOf(m) >= 0 ? IC.bibPasta : '') + esc(m === 'Genérico' ? 'Genéricos' : m) + '</button>'; });
    h += '</div><input class="busca" id="busca-mat" placeholder="Buscar padrão (ex.: carvalho, freijó, cinza)" value="' + esc(st.busca) + '"><div class="grade-amostras">';
    lista.forEach(function (m) {
      h += '<button class="amostra-op' + (atual && atual.id === m.id ? ' ativo' : '') + '" data-act="mat:' + m.id + '">' + amostraHtml(m) + esc(m.nome) + '<small>' + esc(m.marca) + '</small></button>';
    });
    h += '<button class="amostra-op anexar" data-act="texAnexar:arquivo"><span class="amostra mais">+</span>anexar textura<small>imagem jpg ou png</small></button>';
    h += '<button class="amostra-op anexar" data-act="texAnexar:pasta"><span class="amostra mais">' + IC.bibPasta + '</span>anexar pasta<small>vira um botão de pasta</small></button>';
    if (!lista.length) h += '<p class="ajuda">Nenhum padrão encontrado.</p>';
    h += '</div>';
    if (atual && atual.textura) h += deslizante('Tamanho real da imagem (largura)', 'materiais.' + chave + '.texturaLargura', 100, 3000, 50, function (v) { return m2(v) + ' m'; });
    h += '<p class="ajuda">Cores aproximadas — confira o mostruário do fornecedor. Não achou o padrão? Anexe a foto da textura (ela fica na sua biblioteca, separada por pasta) ou crie uma cor em "Padrão próprio".</p>';
    if ((st.texturas || []).length) h += '<div class="linha-botoes"><button class="botao pequeno fantasma" data-act="texGerenciar">Organizar minhas texturas</button></div>';
    h += '</div>';
    return h;
  }

  // ---------- aba Relatório
  function campoTexto(rot, grupo, chave, valor, ph) {
    return '<div class="campo campo-txt"><label>' + rot + '</label><input type="text" data-' + grupo + '="' + chave + '" value="' + esc(valor || '') + '" placeholder="' + esc(ph || '') + '"></div>';
  }

  function abaRelatorio() {
    var h = '<div class="grupo"><h4>Relatório executivo' + aj('relatorio') + '</h4><p class="ajuda amb">O relatório abre no navegador como um <b>editor de pranchas</b>: lá você escolhe folha, cores, cota, logotipo, dados do escritório e do projeto e quais pranchas entram. Fica salvo no navegador e não pesa no SketchUp.</p><p class="ajuda">A prancha aberta acompanha o móvel: ao atualizar o móvel, ela se redesenha sozinha (ou use <b>Atualizar prancha</b>).</p>';
    h += '<div class="linha-botoes"><button class="botao" data-act="relatorio">Abrir editor de pranchas</button><button class="botao" data-act="atualizarPrancha">Atualizar prancha</button>' + (st.prancha ? '<button class="botao" data-act="abrirPrancha">Abrir prancha salva</button>' : '') + '<button class="botao" data-act="csv">Exportar lista de peças (CSV)</button></div></div>';
    h += '<div class="grupo"><h4>Código do móvel</h4><div class="campo"><label>Código na planta de marcenaria</label><input type="text" data-path="codigo" value="' + esc(st.spec.codigo || 'M01') + '" placeholder="M01" maxlength="8" style="max-width:90px"></div><p class="ajuda">Cada móvel novo recebe o próximo código livre (M01, M02...). Ele aparece no selo da isométrica, no topo das pranchas e na planta de marcenaria.</p></div>';
    h += '<div class="grupo"><h4>No modelo</h4><p class="ajuda">Depois de gerar: use <b>Extensões → planê.mob → Abrir/fechar portas e gavetas</b> e clique numa porta ou gaveta para ver o interior. Para editar, selecione o móvel e clique em <b>Editar móvel</b> (ou botão direito → planê.mob).</p></div>';
    return h;
  }

  // ---------------------------------------------------------------- eventos
  function acao(nome, el) {
    var p = nome.split(':');
    var s = st.spec;
    switch (p[0]) {
      case 'vista': st.vista = p[1]; renderCabecalho(); renderVisao(); return;
      case 'aberto': st.aberto3d = p[1] === '1'; st.abertos = {}; renderVisao(); return;
      case 'cam': st.cam = { az: 31.8, el: 27.7 }; renderVisao(); return;
      case 'interno': st.interno = p[1] === '1'; renderVisao(); return;
      case 'avancadas': st.avancadas = !st.avancadas; try { localStorage.setItem('marce-avancadas', st.avancadas ? '1' : '0'); } catch (e) { /* */ } renderPainel(); return;
      case 'confAbrir': st.confAberta = true; renderConferencia(); var ce = $('#conferencia'); if (ce && ce.scrollIntoView) ce.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return;
      case 'aba': st.aba = p[1]; renderPainel(); return;
      case 'conf': st.confAberta = !st.confAberta; renderConferencia(); return;
      case 'comodo': {
        var cm = E.COMODOS[p[1]];
        if (!cm) return;
        s.comodo = p[1];
        if (cm.tipos.indexOf(s.tipo) < 0) { st.spec = E.aplicarTipo(Object.assign(s, { ambiente: cm.ambiente }), cm.tipos[0]); st.spec.nome = E.TIPOS[cm.tipos[0]].nome; st.sel = { col: 0, secao: 0 }; }
        else s.ambiente = cm.ambiente;
        st.spec.comodo = p[1]; st.spec.ambiente = cm.ambiente;
        break;
      }
      case 'todosTipos': st.todosTipos = !st.todosTipos; renderPainel(); return;
      case 'tipo':
        if (p[1] === s.tipo) return;
        var comAtual = s.comodo;
        st.spec = E.aplicarTipo(s, p[1]); st.spec.nome = E.TIPOS[p[1]].nome; st.sel = { col: 0, secao: 0 };
        if (comAtual && E.COMODOS[comAtual] && E.COMODOS[comAtual].tipos.indexOf(p[1]) >= 0) { st.spec.comodo = comAtual; st.spec.ambiente = E.COMODOS[comAtual].ambiente; }
        break;
      case 'comp': s.composicao = p[1]; s.colunas = E.composicao(s, p[1]); st.sel = { col: 0, secao: 0 }; break;
      case 'set': {
        var path = el.getAttribute('data-path'), val = el.getAttribute('data-val');
        var atual = getPath(s, path);
        var v = typeof atual === 'number' ? parseFloat(val) : val;
        setPath(s, path, v);
        if (path === 'ambiente') {
          var lm = E.AMBIENTES[val].larguraMax; if (lm < s.larguraMax) s.larguraMax = lm;
        }
        if (path === 'base.tipo' && v === 'suspenso' && s.tipo === 'aereo' && !s.elevacao) s.elevacao = 1500;
        if (path === 'divisorias' || path === 'larguraMax') { /* sem efeito extra */ }
        break;
      }
      case 'bibUsar': {
        var pth = el.getAttribute('data-path'), it = bibItem(el.getAttribute('data-id'));
        setPath(s, pth, it ? { id: it.id, nome: it.nome, marca: it.marca || '', medidas: it.medidas, encaixe: it.encaixe || 'real', folga: it.folga || null, virar: false, deitar: false } : null);
        if (it && pth === 'puxador.bib' && it.encaixe === 'esticar' && !(s.puxador.comprimento > 60)) s.puxador.comprimento = 300;
        break;
      }
      case 'bibAnexar':
        if (!enviar('bibAnexar', { modo: p[1], categoria: p[2] })) toast('Anexar arquivos funciona dentro do SketchUp');
        return;
      case 'bibGerenciar': bibGerenciar(); return;
      case 'folhaAcab': {
        var sF = colSel().secoes[st.sel.secao];
        if (!sF) break;
        sF.folhasCfg = Array.isArray(sF.folhasCfg) ? sF.folhasCfg : [];
        sF.folhasCfg[+p[1]] = Object.assign(sF.folhasCfg[+p[1]] || {}, { acab: p[2] || null });
        break;
      }
      case 'correrTodas': {
        // a faixa escolhida vira portas de correr em todas as colunas (mesma altura)
        var secR = colSel().secoes[st.sel.secao];
        // em cada coluna, a faixa que está na mesma altura da escolhida (ex.: a faixa alta, não o maleiro)
        var vmR = (st.modelo.vaos || []).filter(function (v) { return v.colunas.some(function (c) { return c.idx === st.sel.col; }); })[0];
        var smR = vmR && vmR.secoes.filter(function (x) { return x.idx === st.sel.secao; })[0];
        s.colunas.forEach(function (c, ci) {
          var vmC = (st.modelo.vaos || []).filter(function (v) { return v.colunas.some(function (cc) { return cc.idx === ci; }); })[0];
          (vmC ? vmC.secoes : []).forEach(function (sc) {
            var mesma = smR && Math.abs(sc.z0 - smR.z0) < 30 && Math.abs(sc.z1 - smR.z1) < 30;
            var alvoS = c.secoes[sc.idx];
            if (mesma && alvoS && (alvoS.tipo === 'portas' || alvoS.tipo === 'correr')) { alvoS.tipo = 'correr'; alvoS.folhas = secR ? secR.folhas : 0; }
          });
        });
        toast('Portas de correr em todas as colunas');
        break;
      }
      case 'intPronto': case 'intLimpar': case 'intAdd': case 'intDel': case 'intMover': case 'intTipo': case 'intUso': case 'intQtd': {
        var si = colSel().secoes[st.sel.secao];
        if (!si) break;
        si.interno = Array.isArray(si.interno) ? si.interno : [];
        var ki = +p[1];
        if (p[0] === 'intPronto') si.interno = JSON.parse(JSON.stringify(E.INTERNOS_PRONTOS[p[1]].mods));
        else if (p[0] === 'intLimpar') si.interno = [];
        else if (p[0] === 'intAdd') si.interno.push(p[1] === 'cabideiro' ? { tipo: 'cabideiro', uso: 'medio' } : p[1] === 'gavetas' ? { tipo: 'gavetas', qtd: 2 } : { tipo: p[1] });
        else if (p[0] === 'intDel') si.interno.splice(ki, 1);
        else if (p[0] === 'intMover') { var kj = ki + (+p[2]); if (kj >= 0 && kj < si.interno.length) { var tm = si.interno[ki]; si.interno[ki] = si.interno[kj]; si.interno[kj] = tm; } }
        else if (p[0] === 'intTipo') { si.interno[ki].tipo = p[2]; if (p[2] === 'cabideiro' && !si.interno[ki].uso) si.interno[ki].uso = 'medio'; si.interno[ki].qtd = p[2] === 'gavetas' ? 2 : 0; si.interno[ki].altura = null; }
        else if (p[0] === 'intUso') { si.interno[ki].uso = p[2]; si.interno[ki].altura = null; }
        else if (p[0] === 'intQtd') { var mq = si.interno[ki]; mq.qtd = Math.max(0, Math.min(12, (mq.qtd || 0) + (+p[2]))); mq.altura = null; }
        break;
      }
      case 'mesclarProx': case 'separarProx': {
        var ca = s.colunas[st.sel.col], cb = s.colunas[st.sel.col + 1];
        if (!ca || !cb) break;
        if (p[0] === 'separarProx') { ca.divisoria = 'manter'; toast('Colunas separadas: a divisória volta'); break; }
        // mesmas faixas: só tira a divisória e deixa uma porta em cada coluna (porta par em cada faixa)
        var compat = ca.secoes.length === cb.secoes.length && ca.secoes.every(function (sa, k) { var sb = cb.secoes[k]; return sa.tipo === sb.tipo && ['portas', 'correr', 'nicho', 'basculante'].indexOf(sa.tipo) >= 0 && (sa.altura || 0) === (sb.altura || 0); });
        if (compat) {
          ca.secoes.forEach(function (sa, k) { if (sa.tipo === 'portas') { sa.portas = 1; cb.secoes[k].portas = 1; } });
          ca.divisoria = 'unir';
          toast('Colunas ' + (st.sel.col + 1) + ' e ' + (st.sel.col + 2) + ' mescladas: interior único com porta par');
          break;
        }
        // faixas diferentes: as duas viram uma faixa de portas só (uma porta em cada) e dividem o mesmo interior
        var base0 = ca.secoes.filter(function (x) { return x.tipo === 'portas' || x.tipo === 'correr'; })[0] || ca.secoes[0];
        var tipoM = base0 && base0.tipo === 'correr' ? 'correr' : 'portas';
        var novaA = E.novaSecao(tipoM, { prateleiras: base0 ? base0.prateleiras : 1, interior: base0 ? base0.interior : 'prateleiras', interno: base0 && base0.interno ? JSON.parse(JSON.stringify(base0.interno)) : undefined, portas: 1 });
        var novaB = E.novaSecao(tipoM, { prateleiras: novaA.prateleiras, interior: novaA.interior, interno: novaA.interno ? JSON.parse(JSON.stringify(novaA.interno)) : undefined, portas: 1 });
        if (ca.secoes.length > 1 || cb.secoes.length > 1) toast('As duas colunas viraram uma faixa só de portas para poder mesclar');
        ca.secoes = [novaA]; cb.secoes = [novaB];
        ca.divisoria = 'unir';
        st.sel.secao = 0;
        toast('Colunas ' + (st.sel.col + 1) + ' e ' + (st.sel.col + 2) + ' mescladas: interior único com porta par');
        break;
      }
      case 'pratAuto': { var sp = colSel().secoes[st.sel.secao]; if (sp) sp.pratAlturas = []; break; }
      case 'gavAuto': { var sg = colSel().secoes[st.sel.secao]; if (sg && sg.itens[+p[1]]) sg.itens[+p[1]].altura = null; break; }
      case 'liberarMedidas': s.origemVolume = false; break;
      case 'redistribuir': redistribuir(true); toast('Colunas redistribuídas pela largura máxima de porta'); break;
      case 'pratTodas': {
        var nv = Math.max(0, Math.min(8, pratComum() + parseInt(p[1], 10)));
        s.colunas.forEach(function (c) { c.secoes.forEach(function (sc) { if (sc.tipo === 'portas' && sc.interior === 'prateleiras') sc.prateleiras = nv; }); });
        break;
      }
      case 'col': st.sel = { col: parseInt(p[1], 10), secao: 0 }; break;
      case 'colAdd': s.colunas.splice(st.sel.col + 1, 0, E.novaColuna(null, [E.novaSecao('portas', { prateleiras: pratComum() })])); st.sel = { col: st.sel.col + 1, secao: 0 }; break;
      case 'colDel': if (s.colunas.length > 1) { s.colunas.splice(st.sel.col, 1); st.sel.col = Math.max(0, st.sel.col - 1); st.sel.secao = 0; } break;
      case 'larg': colSel().largura = p[1] === 'auto' ? null : parseFloat(p[1]); break;
      case 'faixa': st.sel.secao = parseInt(p[1], 10); break;
      case 'faixaAdd': colSel().secoes.push(E.novaSecao('nicho', { prateleiras: 1 })); st.sel.secao = colSel().secoes.length - 1; break;
      case 'faixaDel': { var c = colSel(); if (c.secoes.length > 1) { c.secoes.splice(parseInt(p[1], 10), 1); st.sel.secao = 0; } break; }
      case 'secTipo': {
        var sc = secSel(); var t = p[1];
        var nova = E.novaSecao(t, { altura: sc.altura });
        if (t === 'portas') nova.prateleiras = colSel().secoes.length > 1 ? 1 : pratComum();
        if (t === 'gavetas') nova.itens = E.itensGaveta(colSel().secoes.length > 1 ? 2 : 3);
        if (t === 'temperos' && !colSel().largura) colSel().largura = 250;
        if (t === 'lixeira' && !colSel().largura) colSel().largura = 400;
        colSel().secoes[st.sel.secao] = nova;
        break;
      }
      case 'passo': {
        var pp = p[1], dlt = parseInt(p[2], 10), mn = parseInt(p[3], 10), mx = parseInt(p[4], 10);
        setPath(s, pp, Math.max(mn, Math.min(mx, (getPath(s, pp) || 0) + dlt)));
        break;
      }
      case 'gavQtd': {
        var it = secSel().itens; var d = parseInt(p[1], 10);
        if (d > 0 && it.length < 8) it.push({ tipo: 'gaveta', altura: null });
        if (d < 0 && it.length > 1) it.pop();
        break;
      }
      case 'gavTipo': secSel().itens[parseInt(p[1], 10)].tipo = p[2]; break;
      case 'irpara': st.sel = { col: parseInt(p[1], 10), secao: parseInt(p[2], 10) }; st.aba = 'montagem'; st.vista = 'frontal'; break;
      case 'picker': st.picker = p[1] || null; st.busca = ''; if (p[1] === 'tela') st.aba = 'acabamento'; renderPainel(); return;
      case 'marca': st.marcaPicker = nome.slice(6); renderPainel(); return;
      case 'texAnexar':
        if (!enviar('texAnexar', { modo: p[1] })) toast('Anexar texturas funciona dentro do SketchUp');
        return;
      case 'texGerenciar': texGerenciar(); return;
      case 'mat': {
        var id = nome.slice(4);
        var m = listaMateriais(st.picker).filter(function (x) { return x.id === id; })[0];
        if (m) {
          var tl = (s.materiais[st.picker] && s.materiais[st.picker].texturaLargura) || 1200;
          s.materiais[st.picker] = m.textura ? { id: m.id, nome: m.nome, marca: m.marca, cor: m.cor, veio: false, texturaLargura: m.texturaLargura || 1200, textura: m.textura }
            : { id: m.id, nome: m.nome, marca: m.marca, cor: m.cor, veio: !!m.veio, texturaLargura: tl };
          if (st.picker === 'caixa' && !s.caixaInternaBranca) { /* ok */ }
        }
        break;
      }
      case 'tela': { var tl2 = E.TELAS[p[1]]; if (tl2) s.materiais.tela = JSON.parse(JSON.stringify(tl2)); break; }
      case 'mesmoMaterial': { var f = JSON.parse(JSON.stringify(s.materiais.frente)); s.materiais.caixa = f; toast('Caixaria no mesmo padrão das frentes'); break; }
      case 'novoPadrao': {
        var nm = ($('#novo-nome').value || '').trim() || 'Padrão próprio';
        var nv2 = { id: 'proprio-' + Date.now(), marca: 'Próprio', nome: nm, cor: $('#novo-cor').value, veio: $('#novo-veio').checked };
        st.padroes = st.padroes || {}; st.padroes.personalizados = (st.padroes.personalizados || []).concat([nv2]);
        s.materiais[p[1]] = { id: nv2.id, nome: nv2.nome, marca: nv2.marca, cor: nv2.cor, veio: nv2.veio, texturaLargura: s.materiais.frente.texturaLargura };
        enviar('salvarPadroes', { padroes: st.padroes });
        break;
      }
      case 'salvarPadrao': {
        st.padroes = st.padroes || {};
        st.padroes.spec = { materiais: s.materiais, puxador: s.puxador, esp: s.esp, frentes: s.frentes, chapa: s.chapa, gavetas: s.gavetas, caixaInternaBranca: s.caixaInternaBranca, divisorias: s.divisorias, prateleiras: s.prateleiras };
        if (!enviar('salvarPadroes', { padroes: st.padroes })) { try { localStorage.setItem('marce-padroes', JSON.stringify(st.padroes)); } catch (e) { /* sem armazenamento */ } }
        toast('Padrão salvo para os próximos móveis'); return;
      }
      case 'restaurarPadrao': {
        var limpo = E.specPadrao(s.tipo, s.ambiente);
        ['materiais', 'puxador', 'esp', 'frentes', 'chapa', 'gavetas', 'caixaInternaBranca', 'divisorias', 'prateleiras'].forEach(function (k) { s[k] = limpo[k]; });
        if (st.padroes) { delete st.padroes.spec; enviar('salvarPadroes', { padroes: st.padroes }); }
        toast('Padrões de fábrica restaurados');
        break;
      }
      case 'tirarLogo':
        if (st.padroes && st.padroes.escritorio) { delete st.padroes.escritorio.logo; enviar('salvarPadroes', { padroes: st.padroes }); }
        renderPainel(); return;
      case 'detectarCuba': enviar('detectarCuba', { L: s.L, D: s.D, H: s.H }); toast('Procurando cuba no modelo…'); return;
      case 'relatorio':
        // móvel já no modelo: tira as fotos dele antes de montar as pranchas
        if (st.modo === 'editar' && enviar('pedirFotos', {})) { toast('Preparando o relatório…'); return; }
        abrirRelatorio(null); return;
      case 'abrirPrancha': enviar('abrirPrancha', {}); return;
      case 'atualizarPrancha': if (!enviar('atualizarPrancha', {})) toast('Abra pelo SketchUp para atualizar a prancha.'); return;
      case 'csv': exportarCsv(); return;
      case 'gerar': gerar(); return;
      case 'cancelar': if (!enviar('cancelar', {})) toast('Fora do SketchUp: nada para cancelar'); return;
      case 'verificarAtualizacao':
        if (!enviar('verificarAtualizacao', {})) { toast('A atualização funciona dentro do SketchUp'); return; }
        toast('Procurando versão nova…'); return;
      case 'atualizar':
        if (!enviar('atualizar', { spec: st.spec })) { toast('A atualização funciona dentro do SketchUp'); return; }
        st.atualizando = true; renderRodape(); return;
      default: return;
    }
    atualizar();
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    if (el.tagName === 'A') ev.preventDefault();
    var a = el.getAttribute('data-act');
    if (el.classList.contains('alvo')) {
      st.sel = { col: parseInt(el.getAttribute('data-col'), 10), secao: parseInt(el.getAttribute('data-sec'), 10) };
      st.aba = 'montagem';
      renderVisao(); renderPainel();
      return;
    }
    acao(a, el);
  });
  // alvos SVG não têm data-act: trata separadamente
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('.alvo');
    if (!el || el.hasAttribute('data-act')) return;
    st.sel = { col: parseInt(el.getAttribute('data-col'), 10), secao: parseInt(el.getAttribute('data-sec'), 10) };
    st.aba = 'montagem';
    renderVisao(); renderPainel();
  });

  function lerCampo(el) {
    var t = el.getAttribute('data-tipo');
    if (t === 'bool') return el.checked;
    if (t === 'numnull') { var v = parseFloat(el.value); return isFinite(v) && v > 0 ? v : null; }
    if (t === 'num') { var n = parseFloat(String(el.value).replace(',', '.')); return isFinite(n) ? n : getPath(st.spec, el.getAttribute('data-path')); }
    return el.value;
  }
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.hasAttribute('data-bib-busca')) {
      var cb = el.getAttribute('data-bib-busca'), pb = el.selectionStart;
      st.bibBusca[cb] = el.value;
      renderPainel();
      var nbb = document.querySelector('[data-bib-busca="' + cb + '"]'); if (nbb) { nbb.focus(); nbb.setSelectionRange(pb, pb); }
      return;
    }
    if (el.id === 'busca-mat') {
      st.busca = el.value;
      var pos = el.selectionStart;
      renderPainel();
      var nb = $('#busca-mat'); if (nb) { nb.focus(); nb.setSelectionRange(pos, pos); }
      return;
    }
    if (el.type === 'range' && el.hasAttribute('data-path')) {
      var path = el.getAttribute('data-path');
      setPath(st.spec, path, lerCampo(el));
      var rot = document.querySelector('[data-rot="' + path + '"]');
      if (rot) {
        var v = getPath(st.spec, path);
        rot.textContent = path === 'larguraMax' || path === 'materiais.frente.texturaLargura' ? m2(v) + ' m' : Math.round(v * 10) / 10 + ' mm';
      }
      if (path === 'larguraMax') redistribuir(true);
      atualizar(true);
    }
  });
  var salvarDepois = {};
  function agendar(acao, dados) {
    clearTimeout(salvarDepois[acao]);
    salvarDepois[acao] = setTimeout(function () { enviar(acao, dados()); }, 400);
  }
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.hasAttribute('data-proj')) { st.projeto = st.projeto || {}; st.projeto[el.getAttribute('data-proj')] = el.value; agendar('salvarProjeto', function () { return { projeto: st.projeto }; }); }
    if (el.hasAttribute('data-escr')) { st.padroes = st.padroes || {}; st.padroes.escritorio = st.padroes.escritorio || {}; st.padroes.escritorio[el.getAttribute('data-escr')] = el.value; agendar('salvarPadroes', function () { return { padroes: st.padroes }; }); }
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'logo-arquivo' && el.files && el.files[0]) { carregarLogo(el.files[0]); return; }
    if (el.id === 'nome') { st.spec.nome = el.value.trim() || 'Móvel'; renderCabecalho(); return; }
    if (el.hasAttribute('data-act-chk')) { st.relatorioJunto = el.checked; renderRodape(); return; }
    if (!el.hasAttribute('data-path')) return;
    var path = el.getAttribute('data-path');
    setPath(st.spec, path, lerCampo(el));
    if (path === 'L' && st.spec.cuba && !st.spec.cuba.ativa) st.spec.cuba.centro = Math.round(st.spec.L / 2);
    if (path === 'cuba.ativa' && el.checked) { redistribuir(false); }
    atualizar();
  });

  // logo do escritório: reduzida para no máximo 600 px (não pesa no arquivo)
  function carregarLogo(arquivo) {
    var leitor = new FileReader();
    leitor.onload = function () {
      var img = new Image();
      img.onload = function () {
        var esc2 = Math.min(1, 600 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * esc2)); c.height = Math.max(1, Math.round(img.height * esc2));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        st.padroes = st.padroes || {}; st.padroes.escritorio = st.padroes.escritorio || {};
        st.padroes.escritorio.logo = c.toDataURL('image/png');
        enviar('salvarPadroes', { padroes: st.padroes });
        renderPainel(); toast('Logo aplicada no carimbo');
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  }

  // ---------------------------------------------------------------- exportações
  function exportarCsv() {
    var M = st.modelo;
    var csv = '﻿' + E.csvLista(E.listaDePecas(M.pecas, M.spec.materiais));
    var nome = 'Lista de pecas - ' + nomeArquivo(M.spec.nome) + '.csv';
    if (!enviar('salvarCsv', { csv: csv, nome: nome })) baixar(nome, csv, 'text/csv;charset=utf-8');
  }

  function abrirRelatorio(imagens) {
    var opts = { imagens: imagens, versao: st.versao, prancha: st.spec.prancha, projeto: st.projeto || {}, escritorio: (st.padroes && st.padroes.escritorio) || {}, arquivo: st.arquivo || '' };
    var html = REL.gerar(st.modelo, opts);
    var nome = 'Relatorio - ' + nomeArquivo(st.spec.nome) + '.html';
    var dados = { spec: st.modelo.spec, imagens: imagens || null, versao: st.versao, prancha: st.spec.prancha || {}, projeto: opts.projeto, escritorio: opts.escritorio, arquivo: opts.arquivo };
    if (!enviar('salvarRelatorio', { html: html, nome: nome, dados: dados })) {
      var w = window.open('', '_blank');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
      else baixar(nome, html, 'text/html;charset=utf-8');
    }
  }

  function gerar() {
    var M = st.modelo;
    if (!M.ok) { toast('Resolva os erros da conferência antes de gerar'); return; }
    var dados = {
      spec: st.spec,
      relatorio: st.relatorioJunto,
      modelo: { pecas: M.pecas, conjuntos: M.conjuntos, dims: M.dims, resumo: M.resumo },
      lista: E.listaDePecas(M.pecas, M.spec.materiais)
    };
    if (!enviar('gerar', dados)) {
      toast('Prévia no navegador: no SketchUp este botão cria o móvel no modelo');
      if (st.relatorioJunto) abrirRelatorio(null);
      return;
    }
    st.gerando = true; renderRodape();
  }

  // ---------------------------------------------------------------- Ruby -> JS
  // ---------------------------------------------------------------- prévia 3D: girar, abrir e editar
  st.cam = { az: 31.8, el: 27.7 };
  st.abertos = {};
  (function () {
    var arr = null, quadro = 0;
    document.addEventListener('pointerdown', function (ev) {
      var area = ev.target.closest && ev.target.closest('.area-desenho.orbita');
      if (!area || ev.button !== 0) return;
      arr = { x: ev.clientX, y: ev.clientY, cx: ev.clientX, cy: ev.clientY, az: st.cam.az, el: st.cam.el, moveu: false, alvo: ev.target };
    });
    document.addEventListener('pointermove', function (ev) {
      if (!arr) return;
      var dx = ev.clientX - arr.x, dy = ev.clientY - arr.y;
      if (!arr.moveu && Math.abs(dx) + Math.abs(dy) < 4) return;
      arr.moveu = true;
      st.cam = { az: arr.az - dx * 0.4, el: Math.max(-10, Math.min(80, arr.el + dy * 0.3)) };
      if (!quadro) quadro = requestAnimationFrame(function () { quadro = 0; renderVisao(); });
    });
    document.addEventListener('pointerup', function () {
      if (!arr) return;
      var a2 = arr; arr = null;
      if (a2.moveu) return;
      // clique: abre/fecha a porta ou gaveta
      var info = pegar3d(a2.cx, a2.cy, a2.alvo);
      // espera um instante: se vier o segundo clique (duplo clique = editar), não abre a porta
      clearTimeout(st.cliqueEspera);
      if (info && info.conj) st.cliqueEspera = setTimeout(function () { st.aberto3d = false; st.abertos[info.conj] = !st.abertos[info.conj]; renderVisao(); }, 260);
    });
    function pegar3d(cx, cy, alvo) {
      var cv = document.querySelector('.area-desenho.orbita canvas.cv3d'); // o canvas é redesenhado a cada clique
      if (!cv || !cv.__pegar) return null;
      var bb = cv.getBoundingClientRect();
      return cv.__pegar(cx - bb.left, cy - bb.top);
    }
    document.addEventListener('dblclick', function (ev) {
      var info = pegar3d(ev.clientX, ev.clientY, ev.target);
      if (!info || info.col === null || info.col === undefined) return;
      clearTimeout(st.cliqueEspera);
      st.sel = { col: +info.col, secao: +info.secao || 0 };
      st.aba = 'montagem';
      renderPainel(); renderVisao();
      toast('Coluna ' + (st.sel.col + 1) + ' selecionada para editar');
    });
  })();

  // ---------------------------------------------------------------- ajuda ("?")
  var AJ_ILUS = {
    base: [['base_rodape', 'rodapé recuado'], ['base_suspenso', 'suspenso'], ['base_pes', 'pés']],
    estrutura: [['topo_travessas', 'travessas'], ['topo_chapa', 'chapa'], ['fundo_sobreposto', 'fundo sobreposto'], ['fundo_encaixado', 'fundo encaixado']],
    divisorias: [['div_cada', 'cada porta'], ['div_par', 'cada par'], ['div_nenhuma', 'nenhuma']],
    montagem: [['mont_sobreposta', 'sobreposta'], ['mont_embutida', 'embutida']],
    corredica: [['corr_telescopica', 'telescópica'], ['corr_oculta', 'oculta']],
    gavetas: [['gav_gaveta', 'gaveta'], ['gav_gavetao', 'gavetão'], ['gav_interna', 'c/ interna']],
    portas: [['div_par', 'par de portas'], ['porta_lisa', 'porta única']]
  };
  var abertoEm = 0;
  function fecharAjuda() { var p = document.querySelector('.pop-ajuda'); if (p) p.remove(); }
  function abrirAjuda(btn) {
    var ja = document.querySelector('.pop-ajuda');
    if (ja && ja.dataset.chave === btn.getAttribute('data-ajuda')) { fecharAjuda(); return; }
    fecharAjuda();
    var item = (window.MarceAjuda && window.MarceAjuda.itens[btn.getAttribute('data-ajuda')]) || null;
    if (!item) return;
    var pop = document.createElement('div');
    pop.className = 'pop-ajuda'; abertoEm = Date.now(); pop.dataset.chave = btn.getAttribute('data-ajuda'); pop.setAttribute('role', 'dialog');
    var ilus = (AJ_ILUS[btn.getAttribute('data-ajuda')] || []).map(function (k) { return '<figure>' + (ILU[k[0]] || '') + '<figcaption>' + k[1] + '</figcaption></figure>'; }).join('');
    pop.innerHTML = '<div class="pop-topo"><b>' + esc(item.titulo) + '</b><button type="button" class="pop-x" aria-label="Fechar">×</button></div>' + (ilus ? '<div class="pop-ilus">' + ilus + '</div>' : '') + '<p>' + esc(item.texto) + '</p>' + (item.dica ? '<p class="pop-dica"><span>dica</span>' + esc(item.dica) + '</p>' : '');
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    var y = r.bottom + 8;
    if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function abrirGuia() {
    fecharAjuda();
    var g = (window.MarceAjuda && window.MarceAjuda.guia) || [];
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal guia" role="dialog" aria-modal="true"><p class="eyebrow-m">passo a passo</p><h2>como usar o <em>planê.mob</em></h2><p class="sub-m">do volume no SketchUp ao relatório do marceneiro</p><ol class="passos">' +
      g.map(function (p) { return '<li><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></li>'; }).join('') +
      '</ol><p class="sub-m" style="margin-top:12px">Em qualquer opção, clique no <span class="ajuda-btn falso">?</span> para ver para que serve e uma dica de marcenaria.</p><div class="botoes-m"><button class="botao primario" data-fechar-modal>começar</button></div></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', function (ev) { if (ev.target === fundo || ev.target.hasAttribute('data-fechar-modal')) fundo.remove(); });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ajuda]');
    if (b) { ev.preventDefault(); ev.stopPropagation(); abrirAjuda(b); return; }
    if (ev.target.closest('[data-guia]')) { ev.stopPropagation(); abrirGuia(); return; }
    if (ev.target.closest('.pop-x') || !ev.target.closest('.pop-ajuda')) fecharAjuda();
  }, true);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { fecharAjuda(); var m = document.querySelector('.modal-fundo'); if (m) m.remove(); } });
  document.getElementById('conteudo').addEventListener('scroll', function () { if (Date.now() - abertoEm > 500) fecharAjuda(); });

  // prancha salva: pergunta antes de levar a pessoa para o navegador
  function perguntarNavegador(msg) {
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal pequeno" role="dialog" aria-modal="true"><p class="eyebrow-m">prancha salva</p><h2>abrir o <em>editor de pranchas</em>?</h2>' +
      '<p class="sub-m">As pranchas abrem no navegador, onde você ajusta folha, cores, cotas, logotipo e carimbo e imprime ou salva em PDF.' + (msg.ligada ? ' Ela fica ligada a este móvel e se atualiza sozinha quando você editar.' : '') + '</p>' +
      '<div class="caminho-m">' + esc(String(msg.caminho || '').split(/[\\/]/).pop()) + '</div>' +
      '<div class="botoes-m"><button class="botao" data-fechar-modal>depois</button><button class="botao primario" data-abrir-prancha>abrir no navegador</button></div>' +
      '<p class="sub-m" style="margin:10px 0 0;font-size:11.5px">Para abrir depois: aba Relatório → Abrir prancha salva.</p></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', function (ev) {
      if (ev.target.hasAttribute('data-abrir-prancha')) { enviar('abrirPrancha', {}); fundo.remove(); return; }
      if (ev.target === fundo || ev.target.hasAttribute('data-fechar-modal')) fundo.remove();
    });
  }

  function mostrarNovidades(versoes, versao) {
    if (!versoes || !versoes.length) return;
    var fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    var lista = versoes.map(function (v) {
      return '<div class="ver"><span class="tag">versão ' + esc(v.versao) + '</span><ul>' + (v.notas || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    fundo.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><p class="eyebrow-m">novidades</p><h2>planê.mob <em>atualizada</em></h2><p class="sub-m">você está na versão ' + esc(versao || st.versao) + ' · veja o que mudou</p><div class="lista-m">' + lista + '</div><div class="botoes-m"><button class="botao primario" data-fechar-modal>entendi</button></div></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', function (ev) { if (ev.target === fundo || ev.target.hasAttribute('data-fechar-modal')) fundo.remove(); });
  }

  function aplicarPadroes(spec, padroes) {
    if (padroes && padroes.spec) {
      Object.keys(padroes.spec).forEach(function (k) { spec[k] = E.util.deepMerge(spec[k], padroes.spec[k]); });
    }
    return spec;
  }

  window.App = {
    receber: function (msg) {
      if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
      switch (msg.tipo) {
        case 'init': {
          st.modo = msg.modo || 'novo';
          st.padroes = msg.padroes || null;
          st.projeto = msg.projeto || st.projeto || {};
          st.arquivo = msg.arquivo || st.arquivo || '';
          st.prancha = msg.prancha || null;
          st.versao = msg.versao || st.versao;
          var spec;
          if (msg.spec) spec = E.normalizar(msg.spec);
          else {
            var tipo = (msg.volume && msg.volume.tipoSugerido) || 'balcao';
            spec = aplicarPadroes(E.specPadrao(tipo), st.padroes);
            if (msg.volume) {
              spec.L = Math.round(msg.volume.L); spec.D = Math.round(msg.volume.D); spec.H = Math.round(msg.volume.H);
              spec.elevacao = Math.round(msg.volume.elevacao || 0);
              spec.origemVolume = true;
              if (spec.elevacao > 600 && tipo === 'balcao') { spec = aplicarPadroes(E.aplicarTipo(spec, 'aereo'), st.padroes); spec.nome = E.TIPOS.aereo.nome; }
            }
            if (msg.cuba) { spec.cuba = Object.assign(spec.cuba, msg.cuba, { ativa: true, origem: 'modelo' }); }
            if (msg.codigo) spec.codigo = msg.codigo;
            spec.colunas = E.autoColunas(spec);
          }
          st.spec = spec;
          st.volume = msg.volume || null;
          st.sel = { col: 0, secao: 0 };
          atualizar();
          if (msg.cuba && !msg.spec) toast('Cuba detectada no modelo');
          st.atualizando = false;
          if (msg.novidades && msg.novidades.length) mostrarNovidades(msg.novidades, msg.versao);
          else if (!msg.spec && !msg.avisoAtualizado) { try { if (!localStorage.getItem('marce-guia-visto')) { localStorage.setItem('marce-guia-visto', '1'); abrirGuia(); } } catch (e) { /* sem armazenamento */ } }
          if (msg.avisoAtualizado) { st.atualizacao = { verificado: true, nova: false }; renderRodape(); if (!(msg.novidades && msg.novidades.length)) toast(msg.avisoAtualizado); }
          else if (emSketchUp && !st.atualizacao) setTimeout(function () { enviar('verificarAtualizacao', {}); }, 1200);
          enviar('bibListar', {});
          enviar('texListar', {});
          if (msg.acao === 'relatorio') { st.aba = 'relatorio'; renderPainel(); abrirRelatorio(msg.imagens || null); }
          break;
        }
        case 'cuba':
          if (msg.cuba) { st.spec.cuba = Object.assign(st.spec.cuba, msg.cuba, { ativa: true, origem: 'modelo' }); redistribuir(false); atualizar(); toast('Cuba detectada no modelo'); }
          else toast(msg.msg || 'Nenhuma cuba encontrada sobre o volume');
          break;
        case 'texturas': {
          st.texturas = msg.itens || [];
          if (msg.novos && msg.novos.length) {
            toast(msg.novos.length === 1 ? 'Textura "' + msg.novos[0].nome + '" anexada' : msg.novos.length + ' texturas anexadas na pasta "' + msg.novos[0].pasta + '"');
            if (st.picker) st.marcaPicker = msg.novos[0].pasta;
          } else if (msg.novos) toast('Nenhuma imagem encontrada');
          // materiais em uso acompanham a cor média calculada
          ['frente', 'caixa', 'gaveta', 'fundo', 'tela'].forEach(function (k) { var mm = st.spec && st.spec.materiais[k]; var t = mm && mm.textura && texItem(mm.textura); if (t && t.cor) mm.cor = t.cor; });
          texCores();
          if (document.querySelector('.modal-fundo.tex-ger')) texGerenciar();
          if (st.spec && !msg.silencioso) renderPainel();
          break;
        }
        case 'biblioteca': {
          st.bib = msg.itens || [];
          // ferragens escolhidas cujo arquivo sumiu ficam marcadas (o móvel volta ao desenho da planê.mob)
          [['puxador', 'bib'], ['gavetas', 'bibTelescopica'], ['gavetas', 'bibOculta'], ['frentes', 'bibDobradica']].forEach(function (pp) {
            var o = st.spec && st.spec[pp[0]] && st.spec[pp[0]][pp[1]];
            if (o && o.id) { var it = bibItem(o.id); o.existe = !!(it && it.existe !== false); if (it) { o.nome = it.nome; o.marca = it.marca || ''; o.folga = it.folga || null; } }
          });
          if (msg.fabrica === 'baixando') toast('Preparando as ferragens que vêm com a planê.mob (só na primeira vez)…');
          if (msg.fabrica === 'pronta') toast(msg.novosFabrica ? msg.novosFabrica + ' ferragens da planê.mob prontas na biblioteca' + (msg.erros && msg.erros.length ? ' · ' + msg.erros.length + ' não baixaram (tenta de novo ao reabrir)' : '') : (msg.erros && msg.erros.length ? 'Sem internet para baixar as ferragens: tenta de novo ao reabrir' : 'Biblioteca pronta'));
          var an = msg.anexo;
          if (an && an.partes) bibEscolherPartes(an);
          else if (an && an.itens) toast(an.itens.length ? (an.itens.length === 1 ? '"' + an.itens[0].nome + '" anexado à biblioteca' : an.itens.length + ' ferragens anexadas à biblioteca') + (an.erros && an.erros.length ? ' · ' + an.erros.length + ' com erro' : '') : 'Nenhum arquivo .skp anexado');
          if (document.querySelector('.modal-fundo.bib-ger')) bibGerenciar();
          if (st.spec && (msg.fabrica === 'pronta' || st.modo !== 'editar')) { atualizar(); }
          else if (st.spec) { renderPainel(); }
          break;
        }
        case 'fotos':
          abrirRelatorio(msg.imagens || null);
          break;
        case 'gerado':
          st.gerando = false;
          if (msg.ok) {
            st.modo = 'editar';
            atualizar();
            toast(msg.msg || 'Móvel gerado no modelo');
            if (msg.relatorio) abrirRelatorio(msg.imagens || null);
          } else { renderRodape(); toast(msg.msg || 'Não foi possível gerar'); }
          break;
        case 'atualizacao':
          st.atualizacao = { verificado: true, nova: !!msg.nova, versao: msg.versao, notas: msg.notas || [], erro: msg.erro || null };
          renderRodape();
          if (msg.nova) toast('Tem versão nova da planê.mob: ' + msg.versao);
          break;
        case 'salvo': toast(msg.msg || 'Arquivo salvo'); break;
        case 'pranchaSalva': st.prancha = msg.caminho; renderPainel(); perguntarNavegador(msg); break;
        case 'aviso':
          if (st.atualizando && !/Baixando/.test(msg.msg || '')) { st.atualizando = false; renderRodape(); }
          toast(msg.msg); break;
      }
    }
  };

  // ---------------------------------------------------------------- inicialização
  function iniciarDemo() {
    var padroes = null;
    try { padroes = JSON.parse(localStorage.getItem('marce-padroes') || 'null'); } catch (e) { padroes = null; }
    var spec = E.specPadrao('balcao');
    spec.nome = 'Armário reto';
    spec.L = 3087; spec.D = 580; spec.H = 776; spec.base.tipo = 'suspenso'; spec.elevacao = 100; spec.origemVolume = false;
    spec.cuba.ativa = true; spec.cuba.centro = 900; spec.cuba.largura = 500; spec.cuba.origem = 'modelo';
    spec.colunas = E.autoColunas(spec);
    window.App.receber({ tipo: 'init', modo: 'novo', spec: aplicarPadroes(spec, padroes), padroes: padroes });
  }

  if (emSketchUp) window.sketchup.pronto('{}');
  else iniciarDemo();
})();
