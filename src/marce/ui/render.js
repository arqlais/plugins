/*
 * marcê — desenhos em SVG: vista frontal, planta e perspectiva 3D.
 * Usado na janela do plugin e no relatório executivo.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarceRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- cores
  function hex2rgb(h) {
    h = String(h || '#cccccc').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r) {
    return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  function shade(h, f) { return rgb2hex(hex2rgb(h).map(function (v) { return v * f; })); }
  function lighten(h, f) { return rgb2hex(hex2rgb(h).map(function (v) { return v + (255 - v) * f; })); }
  function lum(h) { var c = hex2rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function n1(v) { return Math.round(v * 10) / 10; }

  var FIXOS = { metal: '#9a9ea3', aramado: '#c3c7cc', espelho: '#bcd3dc', pedra: '#dcd9d2', plastico: '#5b5b5b' };
  function corMat(spec, k) {
    if (spec.materiais[k]) return spec.materiais[k].cor;
    return FIXOS[k] || '#cccccc';
  }

  // padrão de veio de madeira (unidades em mm)
  function padraoVeio(id, cor, horizontal) {
    var base = cor, esc1 = shade(cor, 0.86), esc2 = shade(cor, 0.78), cla = lighten(cor, 0.12);
    var linhas = '';
    var xs = [3, 7.5, 9, 14, 19.5, 22, 27, 31, 33.5, 38, 43, 46.5, 51, 55];
    xs.forEach(function (x, i) {
      var c = i % 3 === 0 ? esc2 : (i % 3 === 1 ? esc1 : cla);
      var w = i % 4 === 0 ? 1.4 : 0.7;
      var dx = (i % 2 ? 1.2 : -1.0);
      linhas += '<path d="M' + x + ' 0 C ' + (x + dx) + ' 120, ' + (x - dx) + ' 260, ' + x + ' 400" stroke="' + c + '" stroke-width="' + w + '" fill="none" opacity="0.75"/>';
    });
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="58" height="400"' + (horizontal ? ' patternTransform="rotate(90)"' : '') + '>' +
      '<rect width="58" height="400" fill="' + base + '"/>' + linhas + '</pattern>';
  }

  function preenchimento(spec, k, defs, horizontal) {
    var m = spec.materiais[k];
    if (!m) return corMat(spec, k);
    if (!m.veio) return m.cor;
    var id = 'veio-' + k + (horizontal ? '-h' : '');
    if (!defs[id]) defs[id] = padraoVeio(id, m.cor, horizontal);
    return 'url(#' + id + ')';
  }

  function defsStr(defs) {
    return '<defs>' + Object.keys(defs).map(function (k) { return defs[k]; }).join('') +
      '<marker id="mseta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>' +
      '</defs>';
  }

  function fmtCota(mm) { return String(Math.round(mm)); }

  // linha de cota horizontal (y fixo) em coordenadas SVG
  function cotaH(x0, x1, y, txt, fs, cls, acima) {
    if (Math.abs(x1 - x0) < 1) return '';
    var t = fs * 0.35;
    var ty = acima ? y - fs * 0.45 : y + fs * 1.05;
    return '<g class="cota ' + (cls || '') + '">' +
      '<line x1="' + n1(x0) + '" y1="' + n1(y) + '" x2="' + n1(x1) + '" y2="' + n1(y) + '"/>' +
      '<line x1="' + n1(x0) + '" y1="' + n1(y - t) + '" x2="' + n1(x0) + '" y2="' + n1(y + t) + '"/>' +
      '<line x1="' + n1(x1) + '" y1="' + n1(y - t) + '" x2="' + n1(x1) + '" y2="' + n1(y + t) + '"/>' +
      '<text x="' + n1((x0 + x1) / 2) + '" y="' + n1(ty) + '" font-size="' + n1(fs) + '" text-anchor="middle">' + esc(txt) + '</text></g>';
  }
  function cotaV(y0, y1, x, txt, fs, cls, esquerda) {
    if (Math.abs(y1 - y0) < 1) return '';
    var t = fs * 0.35;
    var tx = esquerda ? x - fs * 0.5 : x + fs * 0.5;
    var my = (y0 + y1) / 2;
    return '<g class="cota ' + (cls || '') + '">' +
      '<line x1="' + n1(x) + '" y1="' + n1(y0) + '" x2="' + n1(x) + '" y2="' + n1(y1) + '"/>' +
      '<line x1="' + n1(x - t) + '" y1="' + n1(y0) + '" x2="' + n1(x + t) + '" y2="' + n1(y0) + '"/>' +
      '<line x1="' + n1(x - t) + '" y1="' + n1(y1) + '" x2="' + n1(x + t) + '" y2="' + n1(y1) + '"/>' +
      '<text x="' + n1(tx) + '" y="' + n1(my) + '" font-size="' + n1(fs) + '" text-anchor="middle" transform="rotate(-90 ' + n1(tx) + ' ' + n1(my) + ')">' + esc(txt) + '</text></g>';
  }

  // ================================================================
  // VISTA FRONTAL
  // ================================================================
  function frontal(M, opts) {
    opts = opts || {};
    var spec = M.spec, d = M.dims;
    var L = d.L, H = d.H;
    var completo = opts.cotas === 'completo';
    var pedra = M.pecas.filter(function (p) { return p.grupo === 'pedra'; })[0];
    var topoZ = pedra ? pedra.z + pedra.dz : H;
    var fs = Math.max(L, topoZ) / (completo ? 70 : 55);
    var mL = completo ? fs * 5.5 : fs * 2, mR = completo ? fs * 5.5 : fs * 2;
    var mT = fs * (M.cuba ? (completo ? 7 : 3.6) : 2.6), mB = completo ? fs * 6.2 : fs * 3.2;
    var xMin = pedra ? Math.min(0, pedra.x) : 0, xMax = pedra ? Math.max(L, pedra.x + pedra.dx) : L;
    var W = (xMax - xMin) + mL + mR, Ht = topoZ + mT + mB;
    var ox = mL - xMin, oy = mT + topoZ;
    function X(x) { return n1(ox + x); }
    function Y(z) { return n1(oy - z); }
    var defs = {};
    var s = [];
    var caixaCor = corMat(spec, 'caixa');
    var intCor = corMat(spec, spec.caixaInternaBranca ? 'caixaInterna' : 'caixa');

    // piso
    s.push('<line class="piso" x1="' + n1(ox - fs) + '" y1="' + Y(0) + '" x2="' + n1(ox + L + fs) + '" y2="' + Y(0) + '"/>');
    // corpo escuro (aparece nas folgas)
    s.push('<rect x="' + X(0) + '" y="' + Y(d.zTop) + '" width="' + n1(L) + '" height="' + n1(d.zTop - d.z0) + '" fill="' + shade(caixaCor, 0.45) + '"/>');

    // rodapé / roda-teto / outros do grupo rodape
    M.pecas.forEach(function (p) {
      if (p.grupo !== 'rodape' || p.nome.indexOf('Travessa') === 0 || p.nome.indexOf('Apoio') === 0 || p.nome.indexOf('traseiro') > 0) return;
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" fill="' + shade(caixaCor, p.nome.indexOf('Roda-teto') === 0 ? 0.9 : 0.62) + '" stroke="' + shade(caixaCor, 0.5) + '" stroke-width="0.6" vector-effect="non-scaling-stroke"/>');
    });
    // pés
    M.pecas.forEach(function (p) {
      if (p.nome !== 'Pé regulável' || p.y > 200) return;
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" fill="#555"/>');
    });

    // laterais/divisórias/base/topo vistos de frente (borda frontal)
    M.pecas.forEach(function (p) {
      if (p.grupo !== 'caixa' || p.y > 1) return;
      if (/^(Lateral|Divisória|Base|Topo|Travessa superior frontal|Prateleira fixa)/.test(p.nome)) {
        var c = /^Lateral|^Base|^Topo/.test(p.nome) ? caixaCor : intCor;
        s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" fill="' + shade(c, 0.95) + '"/>');
      }
    });

    // interiores visíveis (nichos etc.)
    (M.vaos || []).forEach(function (vm) {
      vm.secoes.forEach(function (sm) {
        var t = sm.cfg.tipo;
        if (t === 'nicho' || t === 'arco' || t === 'espelho' || t === 'painel' || t === 'forno' || t === 'micro') {
          s.push('<rect x="' + X(vm.il) + '" y="' + Y(sm.it) + '" width="' + n1(vm.largInt) + '" height="' + n1(sm.altInt) + '" fill="' + shade(intCor, 0.8) + '"/>');
          if (t === 'forno' || t === 'micro') {
            var ew = Math.min(vm.largInt - 20, 595), eh = Math.min(sm.altInt - 20, t === 'forno' ? 595 : 380);
            var ex = vm.il + (vm.largInt - ew) / 2, ez = sm.ib + (sm.altInt - eh) / 2;
            s.push('<rect x="' + X(ex) + '" y="' + Y(ez + eh) + '" width="' + n1(ew) + '" height="' + n1(eh) + '" rx="' + n1(fs * 0.3) + '" fill="#2b2b2d" stroke="#555" vector-effect="non-scaling-stroke"/>');
            s.push('<rect x="' + X(ex + ew * 0.1) + '" y="' + Y(ez + eh * 0.85) + '" width="' + n1(ew * (t === 'forno' ? 0.8 : 0.6)) + '" height="' + n1(eh * 0.6) + '" fill="#3c3c40"/>');
            s.push('<text class="rotulo-claro" x="' + X(vm.il + vm.largInt / 2) + '" y="' + Y(ez + eh * 0.92) + '" font-size="' + n1(fs * 0.8) + '" text-anchor="middle">' + (t === 'forno' ? 'forno' : 'micro-ondas') + '</text>');
          }
        }
      });
    });
    // prateleiras visíveis em nichos
    M.pecas.forEach(function (p) {
      if (p.nome !== 'Prateleira' && p.nome !== 'Prateleira fixa') return;
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" fill="' + shade(intCor, 1.02) + '" stroke="' + shade(intCor, 0.7) + '" stroke-width="0.5" vector-effect="non-scaling-stroke"/>');
    });
    // painel / espelho / arco
    M.pecas.forEach(function (p) {
      if (p.nome === 'Painel') s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" fill="' + preenchimento(spec, 'frente', defs, spec.frentes.veio === 'horizontal') + '" opacity="0.92"/>');
      if (p.forma && p.forma.plano === 'xz') {
        var pts = p.forma.pts.map(function (q) { return X(p.x + q[0]) + ',' + Y(p.z + q[1]); }).join(' ');
        var fill = p.mat === 'espelho' ? 'url(#espelho)' : shade(corMat(spec, p.mat), 1);
        if (p.mat === 'espelho' && !defs.espelho) defs.espelho = '<linearGradient id="espelho" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9e8ee"/><stop offset="0.5" stop-color="#a9c3cd"/><stop offset="1" stop-color="#cfe0e6"/></linearGradient>';
        s.push('<polygon points="' + pts + '" fill="' + fill + '" stroke="' + shade(corMat(spec, p.mat), 0.6) + '" stroke-width="0.7" vector-effect="non-scaling-stroke"/>');
      }
    });

    // frentes
    var frentes = M.pecas.filter(function (p) { return p.grupo === 'frente' && p.nome !== 'Painel'; });
    var linhaFrente = shade(corMat(spec, 'frente'), lum(corMat(spec, 'frente')) > 0.5 ? 0.55 : 1.6);
    frentes.forEach(function (p) {
      var horiz = spec.frentes.veio === 'horizontal' || /Moldura horizontal/.test(p.nome);
      var fill = preenchimento(spec, 'frente', defs, horiz);
      var x = p.x, z = p.z, w = p.dx, h = p.dz;
      s.push('<rect class="frente" x="' + X(x) + '" y="' + Y(z + h) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + fill + '" stroke="' + shade(corMat(spec, 'frente'), 0.55) + '" stroke-width="0.8" vector-effect="non-scaling-stroke"/>');
      var meta = p.meta || {};
      // cava
      if (p.forma && p.forma.cava) {
        var ch = Math.max(8, spec.puxador.tamanho * 0.7);
        var cz = p.forma.cava === 'base' ? z : z + h - ch;
        s.push('<rect x="' + X(x) + '" y="' + Y(cz + ch) + '" width="' + n1(w) + '" height="' + n1(ch) + '" fill="' + shade(corMat(spec, 'frente'), 0.55) + '" opacity="0.55"/>');
      }
      // símbolo de abertura
      if (meta.tipo === 'porta') {
        var hx = meta.dobradica === 'esq' ? x : x + w, ox2 = meta.dobradica === 'esq' ? x + w : x;
        s.push('<path class="abertura" d="M' + X(hx) + ' ' + Y(z + h) + ' L' + X(ox2) + ' ' + Y(z + h / 2) + ' L' + X(hx) + ' ' + Y(z) + '" stroke="' + linhaFrente + '"/>');
      } else if (meta.tipo === 'basculante') {
        s.push('<path class="abertura" d="M' + X(x) + ' ' + Y(z + h) + ' L' + X(x + w / 2) + ' ' + Y(z) + ' L' + X(x + w) + ' ' + Y(z + h) + '" stroke="' + linhaFrente + '"/>');
      }
      if (completo && meta.tipo && meta.tipo !== 'porta' && meta.tipo !== 'gaveta' && meta.tipo !== 'basculante') {
        var rot = { temperos: 'porta-temperos', lixeira: 'lixeira', fruteira: 'fruteira' }[meta.tipo] || '';
        s.push('<text class="rotulo-frente" x="' + X(x + w / 2) + '" y="' + Y(z + h / 2) + '" font-size="' + n1(fs * 0.75) + '" text-anchor="middle" transform="rotate(-90 ' + X(x + w / 2) + ' ' + Y(z + h / 2) + ')">' + rot + '</text>');
      }
      if (completo && meta.tipo === 'gaveta' && meta.item === 'interna') {
        s.push('<rect class="tracejado" x="' + X(x + w * 0.08) + '" y="' + Y(z + h - h * 0.12) + '" width="' + n1(w * 0.84) + '" height="' + n1(Math.min(80, h * 0.25)) + '"/>');
        s.push('<text class="rotulo-frente" x="' + X(x + w / 2) + '" y="' + Y(z + h * 0.55) + '" font-size="' + n1(fs * 0.7) + '" text-anchor="middle">c/ gaveta interna</text>');
      }
    });
    // puxadores visíveis
    M.pecas.forEach(function (p) {
      if (p.nome !== 'Puxador alça' && p.nome !== 'Perfil puxador') return;
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" rx="' + n1(Math.min(p.dx, p.dz) / 2) + '" fill="#8f949a" stroke="#5d6166" stroke-width="0.5" vector-effect="non-scaling-stroke"/>');
    });
    // pedra
    if (pedra) s.push('<rect x="' + X(pedra.x) + '" y="' + Y(pedra.z + pedra.dz) + '" width="' + n1(pedra.dx) + '" height="' + n1(pedra.dz) + '" fill="' + FIXOS.pedra + '" stroke="#9c988f" stroke-width="0.7" vector-effect="non-scaling-stroke"/>');

    // cuba
    if (M.cuba) {
      var cy = Y(topoZ) - fs * 0.9;
      s.push('<line class="cuba-linha" x1="' + X(M.cuba.x0) + '" y1="' + n1(cy) + '" x2="' + X(M.cuba.x1) + '" y2="' + n1(cy) + '"/>');
      s.push('<text class="cuba-txt" x="' + X(M.cuba.centro) + '" y="' + n1(cy - fs * 0.4) + '" font-size="' + n1(fs * 0.8) + '" text-anchor="middle">cuba</text>');
      if (completo) {
        var cubaH = Math.min(220, d.Hc * 0.35);
        s.push('<rect class="cuba-proj" x="' + X(M.cuba.x0) + '" y="' + Y(d.zTop) + '" width="' + n1(M.cuba.x1 - M.cuba.x0) + '" height="' + n1(cubaH) + '"/>');
        s.push('<line class="eixo" x1="' + X(M.cuba.centro) + '" y1="' + n1(cy - fs * 1.6) + '" x2="' + X(M.cuba.centro) + '" y2="' + Y(d.zTop - cubaH) + '"/>');
        s.push('<text class="eixo-txt" x="' + X(M.cuba.centro) + '" y="' + n1(cy - fs * 1.9) + '" font-size="' + n1(fs * 0.7) + '" text-anchor="middle">eixo hidráulico</text>');
      }
    }

    // seleção e alvos clicáveis
    if (opts.clicavel) {
      (M.colunas || []).forEach(function (c) {
        (c.secoes || []).forEach(function (sm) {
          var sel = opts.sel && opts.sel.col === c.idx && opts.sel.secao === sm.idx;
          s.push('<rect class="alvo' + (sel ? ' sel' : '') + '" data-col="' + c.idx + '" data-sec="' + sm.idx + '" x="' + X(c.x0) + '" y="' + Y(sm.z1) + '" width="' + n1(c.x1 - c.x0) + '" height="' + n1(sm.z1 - sm.z0) + '"/>');
        });
      });
    }

    // rótulo e cotas
    if (!(completo && M.cuba)) s.push('<text class="rotulo" x="' + X(xMin) + '" y="' + n1(Y(topoZ) - fs * (M.cuba ? 2.2 : 1)) + '" font-size="' + n1(fs * 0.9) + '">' + esc(opts.rotulo || 'Frente 1') + '</text>');
    var yC = Y(0) + fs * 1.3;
    if (completo) {
      (M.colunas || []).forEach(function (c) { s.push(cotaH(ox + c.x0, ox + c.x1, yC, fmtCota(c.larg), fs * 0.75, 'fina')); });
      s.push(cotaH(ox, ox + L, yC + fs * 2.4, fmtCota(L), fs * 0.9));
      s.push(cotaV(Y(H), Y(0), ox - fs * 1.6, fmtCota(H), fs * 0.9, '', true));
      if (d.z0 > 0) s.push(cotaV(Y(d.z0), Y(0), ox + L + fs * 1.4, fmtCota(d.z0), fs * 0.7, 'fina'));
      // alturas das faixas da última coluna com várias faixas
      var cm = (M.colunas || []).filter(function (c) { return c.secoes.length > 1; })[0];
      if (cm) cm.secoes.forEach(function (sm) { s.push(cotaV(Y(sm.z1), Y(sm.z0), ox + L + fs * 3.2, fmtCota(sm.alt), fs * 0.7, 'fina')); });
      if (M.cuba) {
        s.push(cotaH(ox, ox + M.cuba.x0, Y(topoZ) - fs * 3.0, fmtCota(M.cuba.x0), fs * 0.7, 'fina', true));
        s.push(cotaH(ox, ox + M.cuba.centro, Y(topoZ) - fs * 4.6, fmtCota(M.cuba.centro), fs * 0.7, 'fina', true));
      }
    } else {
      s.push(cotaH(ox, ox + L, yC, (L / 1000).toFixed(3).replace('.', ',') + ' m', fs * 0.8));
    }

    return '<svg class="desenho frontal" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" preserveAspectRatio="xMidYMid meet">' + defsStr(defs) + s.join('') + '</svg>';
  }

  // ================================================================
  // PLANTA (vista superior)
  // ================================================================
  function planta(M, opts) {
    opts = opts || {};
    var spec = M.spec, d = M.dims;
    var L = d.L, D = d.D;
    var completo = opts.cotas === 'completo';
    var fy = d.frenteY0;
    var pedra = M.pecas.filter(function (p) { return p.grupo === 'pedra'; })[0];
    var maxPorta = 0;
    M.pecas.forEach(function (p) { if (p.meta && p.meta.tipo === 'porta') maxPorta = Math.max(maxPorta, p.dx); });
    var frenteExtra = Math.max(maxPorta * 0.75, 120);
    var fs = Math.max(L, D + frenteExtra) / (completo ? 60 : 48);
    var mL = fs * 4, mR = fs * 3, mT = fs * (completo ? 6 : 3), mB = fs * 4.5;
    var yMin = Math.min(fy, pedra ? pedra.y : fy) - frenteExtra;
    var W = L + mL + mR, Ht = (D - yMin) + mT + mB;
    var ox = mL, oy = mT + D; // svgY = oy - y  (parede em cima)
    function X(x) { return n1(ox + x); }
    function Y(y) { return n1(oy - y); }
    var s = [];
    var caixaCor = corMat(spec, 'caixa');
    var defs = {};
    // parede
    s.push('<rect class="parede" x="' + n1(ox - fs) + '" y="' + n1(Y(D) - fs * 0.8) + '" width="' + n1(L + 2 * fs) + '" height="' + n1(fs * 0.8) + '"/>');
    // corpo
    s.push('<rect x="' + X(0) + '" y="' + Y(D) + '" width="' + n1(L) + '" height="' + n1(D) + '" fill="' + lighten(caixaCor, 0.55) + '" stroke="' + shade(caixaCor, 0.5) + '" stroke-width="0.8" vector-effect="non-scaling-stroke"/>');
    M.pecas.forEach(function (p) {
      if (p.grupo === 'caixa' && (/^Lateral|^Divisória/.test(p.nome))) s.push('<rect x="' + X(p.x) + '" y="' + Y(p.y + p.dy) + '" width="' + n1(p.dx) + '" height="' + n1(p.dy) + '" fill="' + shade(caixaCor, 0.8) + '"/>');
      if (p.grupo === 'fundo') s.push('<rect x="' + X(p.x) + '" y="' + Y(p.y + p.dy) + '" width="' + n1(p.dx) + '" height="' + n1(Math.max(p.dy, 3)) + '" fill="' + shade(caixaCor, 0.6) + '"/>');
    });
    // frentes
    M.pecas.forEach(function (p) {
      if (p.grupo !== 'frente' || p.y > 1) return;
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.y + p.dy) + '" width="' + n1(p.dx) + '" height="' + n1(p.dy) + '" fill="' + preenchimento(spec, 'frente', defs, true) + '" stroke="' + shade(corMat(spec, 'frente'), 0.5) + '" stroke-width="0.6" vector-effect="non-scaling-stroke"/>');
      var m = p.meta || {};
      if (m.tipo === 'porta') {
        var r = p.dx;
        var px = m.dobradica === 'esq' ? p.x : p.x + p.dx;
        var sx = m.dobradica === 'esq' ? 1 : -1;
        var y0 = p.y;
        // porta aberta a 90° e arco
        s.push('<line class="giro" x1="' + X(px) + '" y1="' + Y(y0) + '" x2="' + X(px) + '" y2="' + Y(y0 - r) + '"/>');
        s.push('<path class="giro" d="M' + X(px + sx * r) + ' ' + Y(y0) + ' A ' + n1(r) + ' ' + n1(r) + ' 0 0 ' + (sx > 0 ? 1 : 0) + ' ' + X(px) + ' ' + Y(y0 - r) + '"/>');
      } else if (m.tipo === 'gaveta' || m.tipo === 'temperos' || m.tipo === 'lixeira' || m.tipo === 'fruteira') {
        var cj = (M.conjuntos || []).filter(function (c) { return c.id === p.conj; })[0];
        var curso = cj ? cj.curso : 400;
        if (m.tipo === 'gaveta' && m.ordem > 0) return;
        s.push('<rect class="giro" x="' + X(p.x + 10) + '" y="' + Y(p.y) + '" width="' + n1(p.dx - 20) + '" height="' + n1(Math.min(curso, frenteExtra * 0.95)) + '"/>');
      }
    });
    if (pedra) s.push('<rect class="pedra" x="' + X(pedra.x) + '" y="' + Y(pedra.y + pedra.dy) + '" width="' + n1(pedra.dx) + '" height="' + n1(pedra.dy) + '"/>');
    if (M.cuba) {
      var cp = Math.min(M.cuba.prof, D - 120);
      var cy0 = (D - cp) / 2 + 20;
      s.push('<rect class="cuba-planta" x="' + X(M.cuba.x0) + '" y="' + Y(cy0 + cp) + '" width="' + n1(M.cuba.x1 - M.cuba.x0) + '" height="' + n1(cp) + '" rx="' + n1(fs * 0.6) + '"/>');
      s.push('<text class="cuba-txt" x="' + X(M.cuba.x0 + fs * 0.5) + '" y="' + n1(Y(cy0 + cp) + fs * 1.2) + '" font-size="' + n1(fs * 0.8) + '">cuba</text>');
      s.push('<circle class="ponto-hidr" cx="' + X(M.cuba.centro) + '" cy="' + Y(cy0 + cp / 2) + '" r="' + n1(fs * 0.6) + '"/>');
      s.push('<line class="ponto-hidr" x1="' + X(M.cuba.centro) + '" y1="' + n1(Y(cy0 + cp / 2) - fs) + '" x2="' + X(M.cuba.centro) + '" y2="' + n1(Y(cy0 + cp / 2) + fs) + '"/>');
      if (completo) {
        s.push(cotaH(ox, ox + M.cuba.x0, Y(D) - fs * 2, fmtCota(M.cuba.x0), fs * 0.7, 'fina', true));
        s.push(cotaH(ox, ox + M.cuba.centro, Y(D) - fs * 3.8, fmtCota(M.cuba.centro), fs * 0.7, 'fina', true));
        s.push('<text class="eixo-txt" x="' + X(M.cuba.centro) + '" y="' + n1(Y(D) - fs * 5) + '" font-size="' + n1(fs * 0.7) + '" text-anchor="middle">eixo hidráulico</text>');
        s.push(cotaV(Y(D), Y(cy0 + cp), ox + M.cuba.x1 + fs, fmtCota(D - cy0 - cp), fs * 0.6, 'fina'));
      }
    }
    // cotas
    s.push(cotaH(ox, ox + L, Y(yMin) + fs * 1.2, completo ? fmtCota(L) : (L / 1000).toFixed(3).replace('.', ',') + ' m', fs * 0.85));
    s.push(cotaV(Y(D), Y(0), ox - fs * 1.4, fmtCota(D), fs * 0.8, '', true));
    s.push('<text class="rotulo" x="' + n1(ox + L / 2) + '" y="' + n1(Y(yMin) + fs * 3.6) + '" font-size="' + n1(fs * 0.75) + '" text-anchor="middle">frente</text>');
    return '<svg class="desenho planta" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" preserveAspectRatio="xMidYMid meet">' + defsStr(defs) + s.join('') + '</svg>';
  }

  // ================================================================
  // PERSPECTIVA 3D (ortográfica, algoritmo do pintor)
  // ================================================================
  function v3(x, y, z) { return [x, y, z]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  function transformador(M, aberto) {
    var mapa = {};
    (M.conjuntos || []).forEach(function (c) { mapa[c.id] = c; });
    function aplicar(cid, p) {
      if (!cid || !aberto) return p;
      var c = mapa[cid];
      if (!c) return p;
      var q = p;
      if (c.tipo === 'corre') q = [p[0], p[1] - c.curso, p[2]];
      else if (c.tipo === 'giro') {
        var a = c.angulo * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        var pv = [c.pivot.x, c.pivot.y, c.pivot.z];
        var r = sub(p, pv);
        if (c.eixo === 'z') q = [pv[0] + r[0] * ca - r[1] * sa, pv[1] + r[0] * sa + r[1] * ca, p[2]];
        else q = [p[0], pv[1] + r[1] * ca - r[2] * sa, pv[2] + r[1] * sa + r[2] * ca];
      }
      return c.pai ? aplicar(c.pai, q) : q;
    }
    return aplicar;
  }

  function perspectiva(M, opts) {
    opts = opts || {};
    var spec = M.spec;
    var vista = opts.vista || 'iso'; // iso | superior
    var dir = vista === 'superior' ? norm([0.35, 0.9, -1.6]) : norm([0.62, 1, -0.62]);
    var up = [0, 0, 1];
    var right = norm(cross(dir, up));
    var sup = cross(right, dir);
    var aplicar = transformador(M, !!opts.aberto);
    var faces = [];
    var luz = norm([-0.4, -0.7, 0.9]);
    M.pecas.forEach(function (p) {
      if (opts.semPedra && p.grupo === 'pedra') return;
      if (p.dx < 0.5 || p.dy < 0.5 || p.dz < 0.5) return;
      var x0 = p.x, x1 = p.x + p.dx, y0 = p.y, y1 = p.y + p.dy, z0 = p.z, z1 = p.z + p.dz;
      var P = [v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y1, z0), v3(x0, y1, z0), v3(x0, y0, z1), v3(x1, y0, z1), v3(x1, y1, z1), v3(x0, y1, z1)]
        .map(function (q) { return aplicar(p.conj, q); });
      var F = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]];
      var cor = p.mat === 'espelho' ? '#b9d0d8' : corMat(spec, p.mat);
      if (p.grupo === 'frente' && spec.materiais.frente.veio) cor = shade(cor, 0.97);
      var centro = P.reduce(function (a, q) { return [a[0] + q[0] / 8, a[1] + q[1] / 8, a[2] + q[2] / 8]; }, [0, 0, 0]);
      F.forEach(function (f) {
        var a = P[f[0]], b = P[f[1]], c = P[f[2]];
        var n = norm(cross(sub(b, a), sub(c, a)));
        if (dot(n, dir) >= -1e-6) return;
        var fc = [0, 1, 2, 3].reduce(function (acc, k) { var q = P[f[k]]; return [acc[0] + q[0] / 4, acc[1] + q[1] / 4, acc[2] + q[2] / 4]; }, [0, 0, 0]);
        var l = 0.62 + 0.38 * Math.max(0, dot(n, luz));
        faces.push({ pts: f.map(function (k) { return P[k]; }), prof: dot(fc, dir) * 0.35 + dot(centro, dir) * 0.65, cor: shade(cor, l), linha: shade(cor, 0.55) });
      });
    });
    faces.sort(function (a, b) { return b.prof - a.prof; });
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    faces.forEach(function (f) {
      f.p2 = f.pts.map(function (q) { var X = dot(q, right), Y = -dot(q, sup); minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y); return [X, Y]; });
    });
    if (!faces.length) return '<svg class="desenho perspectiva" viewBox="0 0 10 10"></svg>';
    var m = Math.max(maxX - minX, maxY - minY) * 0.04;
    var s = faces.map(function (f) {
      return '<polygon points="' + f.p2.map(function (q) { return n1(q[0] - minX + m) + ',' + n1(q[1] - minY + m); }).join(' ') + '" fill="' + f.cor + '" stroke="' + f.linha + '" stroke-width="0.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    });
    return '<svg class="desenho perspectiva" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(maxX - minX + 2 * m) + ' ' + n1(maxY - minY + 2 * m) + '" preserveAspectRatio="xMidYMid meet">' + s.join('') + '</svg>';
  }

  // ================================================================
  // Plano de corte (uma chapa)
  // ================================================================
  function chapaSvg(g, ch, chapaCfg) {
    var fs = g.w / 60;
    var s = ['<rect x="0" y="0" width="' + g.w + '" height="' + g.h + '" fill="#f6f3ee" stroke="#8a8378" stroke-width="1" vector-effect="non-scaling-stroke"/>'];
    s.push('<rect x="' + chapaCfg.refilo + '" y="' + chapaCfg.refilo + '" width="' + (g.w - 2 * chapaCfg.refilo) + '" height="' + (g.h - 2 * chapaCfg.refilo) + '" fill="none" stroke="#c9c1b4" stroke-dasharray="6 6" stroke-width="0.6" vector-effect="non-scaling-stroke"/>');
    ch.itens.forEach(function (it, k) {
      var hue = (k * 47) % 360;
      s.push('<rect x="' + n1(it.x) + '" y="' + n1(it.y) + '" width="' + n1(it.w) + '" height="' + n1(it.h) + '" fill="hsl(' + hue + ',35%,86%)" stroke="#5c4a3d" stroke-width="0.8" vector-effect="non-scaling-stroke"/>');
      var tf = Math.min(fs, it.h * 0.32, it.w / Math.max(6, it.nome.length * 0.62));
      if (tf > fs * 0.35) {
        s.push('<text x="' + n1(it.x + it.w / 2) + '" y="' + n1(it.y + it.h / 2 - tf * 0.1) + '" font-size="' + n1(tf) + '" text-anchor="middle" fill="#3a2e26">' + esc(it.nome) + '</text>');
        s.push('<text x="' + n1(it.x + it.w / 2) + '" y="' + n1(it.y + it.h / 2 + tf * 1.0) + '" font-size="' + n1(tf * 0.85) + '" text-anchor="middle" fill="#6b5b4f">' + Math.round(it.c) + '×' + Math.round(it.l) + (it.rot ? ' ↻' : '') + '</text>');
      }
    });
    return '<svg class="desenho chapa" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ' + (g.w + 8) + ' ' + (g.h + 8) + '">' + s.join('') + '</svg>';
  }

  return { frontal: frontal, planta: planta, perspectiva: perspectiva, chapaSvg: chapaSvg, cor: { shade: shade, lighten: lighten, lum: lum }, esc: esc, cotaH: cotaH, cotaV: cotaV };
});
