/*
 * planê.mob — desenhos em SVG: vista frontal, planta e perspectiva 3D.
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

  var FIXOS = { metal: '#9a9ea3', aramado: '#c3c7cc', espelho: '#bcd3dc', pedra: '#dcd9d2', plastico: '#5b5b5b', vidro: '#cfdde2', led: '#fff1d6' };
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
        if (t === 'geladeira') {
          var gel = sm.cfg.eletro || { largura: 700, altura: 1800 };
          s.push('<rect x="' + X(vm.il) + '" y="' + Y(sm.it) + '" width="' + n1(vm.largInt) + '" height="' + n1(sm.it) + '" fill="' + shade(intCor, 0.8) + '"/>');
          var gw = Math.min(gel.largura, vm.largInt), gh = Math.min(gel.altura, sm.it), gx0 = vm.il + (vm.largInt - gw) / 2;
          s.push('<rect x="' + X(gx0) + '" y="' + Y(gh) + '" width="' + n1(gw) + '" height="' + n1(gh) + '" rx="' + n1(fs * 0.4) + '" fill="#c9ccd0" stroke="#8a8f94" vector-effect="non-scaling-stroke"/>');
          s.push('<line x1="' + X(gx0) + '" y1="' + Y(gh * 0.62) + '" x2="' + X(gx0 + gw) + '" y2="' + Y(gh * 0.62) + '" stroke="#8a8f94" vector-effect="non-scaling-stroke"/>');
          s.push('<rect x="' + X(gx0 + gw * 0.08) + '" y="' + Y(gh * 0.9) + '" width="' + n1(fs * 0.35) + '" height="' + n1(gh * 0.18) + '" fill="#8a8f94"/><rect x="' + X(gx0 + gw * 0.08) + '" y="' + Y(gh * 0.55) + '" width="' + n1(fs * 0.35) + '" height="' + n1(gh * 0.2) + '" fill="#8a8f94"/>');
          s.push('<text class="rotulo" x="' + X(vm.il + vm.largInt / 2) + '" y="' + Y(gh * 0.3) + '" font-size="' + n1(fs * 0.8) + '" text-anchor="middle">geladeira</text>');
          return;
        }
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
      var fill = p.mat === 'frente' ? preenchimento(spec, 'frente', defs, horiz) : (p.mat === 'vidro' ? 'url(#vidro-canelado)' : corMat(spec, p.mat));
      if (p.mat === 'vidro' && !defs['vidro-canelado']) defs['vidro-canelado'] = '<pattern id="vidro-canelado" patternUnits="userSpaceOnUse" width="14" height="400"><rect width="14" height="400" fill="#d6e3e8"/><rect width="5" height="400" fill="#c2d3da"/><rect x="9" width="2" height="400" fill="#e9f1f4"/></pattern>';
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
    // LED (perfil + brilho)
    M.pecas.forEach(function (p) {
      if (p.grupo !== 'led' || p.y > (M.dims.Dc || 1e9)) return;
      if (!defs.brilho) defs.brilho = '<linearGradient id="brilho" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7b5" stop-opacity=".85"/><stop offset="1" stop-color="#ffe7b5" stop-opacity="0"/></linearGradient>';
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z) + '" width="' + n1(p.dx) + '" height="' + n1(Math.min(220, M.dims.H * 0.3)) + '" fill="url(#brilho)"/>');
      s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(Math.max(p.dz, 6)) + '" fill="' + corMat(spec, 'led') + '" stroke="#e0c58e" stroke-width=".6" vector-effect="non-scaling-stroke"/>');
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
    var luz = norm([-0.4, -0.7, 0.9]);
    var grupos = [];
    M.pecas.forEach(function (p) {
      if (opts.semPedra && p.grupo === 'pedra') return;
      if (p.dx < 0.5 || p.dy < 0.5 || p.dz < 0.5) return;
      var faces = [];
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
        faces.push({ pts: f.map(function (k) { return P[k]; }), prof: dot(fc, dir), cor: shade(cor, l), linha: shade(cor, 0.55) });
      });
      faces.sort(function (a, b) { return b.prof - a.prof; });
      var bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
      P.forEach(function (q) { for (var k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], q[k]); bb[k + 3] = Math.max(bb[k + 3], q[k]); } });
      var r2 = [1e9, 1e9, -1e9, -1e9];
      P.forEach(function (q) { var X = dot(q, right), Y = -dot(q, sup); r2[0] = Math.min(r2[0], X); r2[1] = Math.min(r2[1], Y); r2[2] = Math.max(r2[2], X); r2[3] = Math.max(r2[3], Y); });
      grupos.push({ faces: faces, bb: bb, r2: r2, prof: dot(centro, dir) });
    });
    // Ordem de pintura por peça: caixas separadas por um eixo têm ordem exata
    // (a de trás primeiro); as demais seguem a profundidade do centro.
    function atras(A, B) { // 1: A atrás de B, -1: A na frente, 0: indefinido
      for (var k = 0; k < 3; k++) {
        if (Math.abs(dir[k]) < 1e-9) continue;
        if (A.bb[k] >= B.bb[k + 3] - 0.01) return dir[k] > 0 ? 1 : -1;
        if (B.bb[k] >= A.bb[k + 3] - 0.01) return dir[k] > 0 ? -1 : 1;
      }
      return 0;
    }
    var n = grupos.length, deps = grupos.map(function () { return 0; }), suc = grupos.map(function () { return []; });
    // só ordena pares que se sobrepõem na imagem (menos relações = sem ciclos falsos)
    function cruzam(A, B) { return A.r2[0] < B.r2[2] - 0.01 && B.r2[0] < A.r2[2] - 0.01 && A.r2[1] < B.r2[3] - 0.01 && B.r2[1] < A.r2[3] - 0.01; }
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      if (!cruzam(grupos[i], grupos[j])) continue;
      var r = atras(grupos[i], grupos[j]);
      if (r === 1) { suc[i].push(j); deps[j]++; } else if (r === -1) { suc[j].push(i); deps[i]++; }
    }
    var feito = grupos.map(function () { return false; }), ordem = [];
    for (var passo = 0; passo < n; passo++) {
      var esc = -1;
      for (var g = 0; g < n; g++) if (!feito[g] && deps[g] === 0 && (esc < 0 || grupos[g].prof > grupos[esc].prof)) esc = g;
      // ciclo: quebra pela peça com menos pendências (e, no empate, a mais funda)
      if (esc < 0) for (g = 0; g < n; g++) if (!feito[g] && (esc < 0 || deps[g] < deps[esc] || (deps[g] === deps[esc] && grupos[g].prof > grupos[esc].prof))) esc = g;
      feito[esc] = true; ordem.push(esc);
      suc[esc].forEach(function (t) { deps[t]--; });
    }
    var faces = [];
    ordem.forEach(function (g) { faces = faces.concat(grupos[g].faces); });
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
  // DESENHO TÉCNICO EM ESCALA (pranchas) — linhas, cotas ABNT
  // ================================================================
  var ESCALAS = [5, 10, 20, 25, 50, 75, 100, 200, 250, 500];

  function fmtUn(mm, un) {
    if (un === 'm') return (mm / 1000).toFixed(Math.round(mm) % 10 === 0 ? 2 : 3).replace('.', ',');
    if (un === 'cm') return (Math.round(mm) / 10).toFixed(1).replace('.', ',');
    return String(Math.round(mm));
  }

  // cota ABNT: linhas de chamada, tiques a 45° e texto acima da linha
  function cotaT(x0, y0, x1, y1, txt, o) {
    var vert = Math.abs(x1 - x0) < 1e-6;
    var len = vert ? Math.abs(y1 - y0) : Math.abs(x1 - x0);
    if (len < 0.5) return '';
    var t = o.tique, f = o.fs, s = [];
    var sw = 'stroke="' + o.cor + '" stroke-width="' + o.lw + '"';
    s.push('<line x1="' + n1(x0) + '" y1="' + n1(y0) + '" x2="' + n1(x1) + '" y2="' + n1(y1) + '" ' + sw + '/>');
    [[x0, y0], [x1, y1]].forEach(function (p) { s.push('<line x1="' + n1(p[0] - t) + '" y1="' + n1(p[1] + t) + '" x2="' + n1(p[0] + t) + '" y2="' + n1(p[1] - t) + '" ' + sw + '/>'); });
    if (o.chamada) o.chamada.forEach(function (c) { s.push('<line x1="' + n1(c[0]) + '" y1="' + n1(c[1]) + '" x2="' + n1(c[2]) + '" y2="' + n1(c[3]) + '" stroke="' + o.cor + '" stroke-width="' + n1(o.lw * 0.7) + '"/>'); });
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    var cabe = len > f * txt.length * 0.62 + t * 2;
    if (vert) {
      var tx = mx - f * 0.35;
      s.push('<text class="cota-n" x="' + n1(tx) + '" y="' + n1(my) + '" font-size="' + n1(f) + '" fill="' + (o.corTxt || o.cor) + '" text-anchor="middle" transform="rotate(-90 ' + n1(tx) + ' ' + n1(my) + ')">' + esc(txt) + '</text>');
    } else {
      var ty = cabe ? my - f * 0.35 : my - f * 0.35 - f;
      s.push('<text class="cota-n" x="' + n1(mx) + '" y="' + n1(ty) + '" font-size="' + n1(f) + '" fill="' + (o.corTxt || o.cor) + '" text-anchor="middle">' + esc(txt) + '</text>');
    }
    return s.join('');
  }

  function escolherEscala(wMod, hMod, areaW, areaH, margemPapel) {
    for (var i = 0; i < ESCALAS.length; i++) {
      var e = ESCALAS[i];
      if (wMod / e + 2 * margemPapel <= areaW && hMod / e + 2 * margemPapel <= areaH) return e;
    }
    return ESCALAS[ESCALAS.length - 1];
  }

  var COR_LED = '#d9a400';
  var nBrilho = 0;
  function balao(cx, cy, r, txt, sw, fs) {
    return '<g class="balao"><circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(r) + '" fill="#fff" stroke="#3e4b57" stroke-width="' + n1(sw * 1.3) + '"/>' +
      '<text x="' + n1(cx) + '" y="' + n1(cy + fs * 0.36) + '" font-size="' + n1(fs * 0.95) + '" font-weight="600" text-anchor="middle" fill="#3e4b57">' + esc(txt) + '</text></g>';
  }

  // Corte lateral (plano x = meio da coluna), visto do lado direito: frente à esquerda.
  // Peças cortadas aparecem preenchidas, com a mesma geometria que vai para o SketchUp.
  function corteTecnico(M, ci, o) {
    o = o || {};
    var c = M.colunas[ci];
    var d = M.dims, un = o.unidade || 'mm', cor = o.corCota || '#c0392b';
    var xc = (c.x0 + c.x1) / 2;
    var cortadas = M.pecas.filter(function (p) { return p.x < xc - 0.01 && p.x + p.dx > xc + 0.01 && p.dy > 0.4 && p.dz > 0.4; });
    var yMin = 0, yMax = d.D, zMax = d.H;
    cortadas.forEach(function (p) { yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y + p.dy); zMax = Math.max(zMax, p.z + p.dz); });
    var mPapel = 9.5;
    var E = o.escala || escolherEscala(yMax - yMin, zMax, o.areaW || 70, o.areaH || 60, mPapel);
    var fs = 2.0 * E, lw = 0.16 * E, lwF = 0.3 * E, tq = 1 * E, mg = mPapel * E;
    var W = yMax - yMin + 2 * mg, Ht = zMax + 2 * mg;
    var ox = mg - yMin, oy = mg + zMax;
    function X(y) { return n1(ox + y); }
    function Y(z) { return n1(oy - z); }
    var s = [];
    if (d.z0 > 0 || M.spec.base.tipo !== 'suspenso') s.push('<line x1="' + n1(ox + yMin - mg * 0.3) + '" y1="' + Y(0) + '" x2="' + n1(ox + yMax + mg * 0.3) + '" y2="' + Y(0) + '" stroke="#2b2b2b" stroke-width="' + n1(lwF * 1.4) + '"/>');
    s.push('<line x1="' + n1(ox + d.D) + '" y1="' + Y(0) + '" x2="' + n1(ox + d.D) + '" y2="' + Y(zMax + mg * 0.2) + '" stroke="#b9b0a6" stroke-width="' + n1(lw) + '" stroke-dasharray="' + n1(3 * E) + ' ' + n1(1 * E) + '"/>');
    var ordem = { pedra: 0, caixa: 1, fundo: 1, rodape: 1, gaveta: 2, frente: 3, ferragem: 4, led: 5 };
    cortadas.sort(function (a, b) { return (ordem[a.grupo] || 1) - (ordem[b.grupo] || 1); }).forEach(function (p) {
      var fill = '#cfc6c0', st = '#2b2b2b', sw = lw;
      if (p.grupo === 'frente') fill = '#a89f99';
      if (p.grupo === 'gaveta') fill = '#ddd6d1';
      if (o.colorido && M.spec.materiais[p.mat]) fill = p.grupo === 'frente' ? shade(corMat(M.spec, p.mat), 0.88) : corMat(M.spec, p.mat);
      if (p.grupo === 'ferragem' || p.mat === 'metal' || p.mat === 'aramado') { fill = '#c9cdd1'; st = '#6b6b6b'; }
      if (p.mat === 'espelho' || p.mat === 'vidro') fill = '#dfeaee';
      if (p.grupo === 'pedra') fill = '#ececec';
      if (p.grupo === 'led') { fill = COR_LED; st = '#8a6a00'; }
      var r = '<rect x="' + X(p.y) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dy) + '" height="' + n1(p.dz) + '" fill="' + fill + '" stroke="' + st + '" stroke-width="' + n1(sw) + '"/>';
      s.push(r);
      if (p.grupo === 'led') {
        var zl = p.z, yl = p.y + p.dy / 2, ab = Math.min(140, zl - 10);
        if (ab > 30) s.push('<path d="M' + X(yl) + ' ' + Y(zl) + ' L' + X(yl - ab * 0.45) + ' ' + Y(zl - ab) + ' L' + X(yl + ab * 0.45) + ' ' + Y(zl - ab) + 'Z" fill="' + COR_LED + '" opacity=".16"/>');
      }
    });
    var op = { cor: cor, corTxt: o.corCotaTexto || cor, lw: lw, fs: fs, tique: tq };
    var yb = Y(0) + mg * 0.45;
    s.push(cotaT(ox + yMin, yb, ox + yMax, yb, fmtUn(yMax - yMin, un), Object.assign({}, op, { chamada: [[ox + yMin, Y(0) + 1 * E, ox + yMin, yb + tq], [ox + yMax, Y(0) + 1 * E, ox + yMax, yb + tq]] })));
    var xl = ox + yMin - mg * 0.45;
    s.push(cotaT(xl, Y(zMax), xl, Y(0), fmtUn(zMax, un), Object.assign({}, op, { chamada: [[ox + yMin - 1 * E, Y(zMax), xl - tq, Y(zMax)], [ox + yMin - 1 * E, Y(0), xl - tq, Y(0)]] })));
    var xr = ox + yMax + mg * 0.4;
    if (c.secoes.length > 1) c.secoes.forEach(function (sm) { s.push(cotaT(xr, Y(sm.z1), xr, Y(sm.z0), fmtUn(sm.alt, un), op)); });
    if (d.z0 > 0) s.push(cotaT(xr + (c.secoes.length > 1 ? mg * 0.3 : 0), Y(d.z0), xr + (c.secoes.length > 1 ? mg * 0.3 : 0), Y(0), fmtUn(d.z0, un), op));
    s.push('<text x="' + n1(ox + yMin) + '" y="' + n1(Y(zMax) - fs * 0.9) + '" font-size="' + n1(fs * 0.85) + '" fill="#8b939a">frente</text>');
    s.push('<text x="' + n1(ox + d.D) + '" y="' + n1(Y(zMax) - fs * 0.9) + '" font-size="' + n1(fs * 0.85) + '" text-anchor="end" fill="#8b939a">parede</text>');
    var svg = '<svg class="tecnico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" width="' + n1(W / E) + 'mm" height="' + n1(Ht / E) + 'mm" font-family="Poppins, Segoe UI, sans-serif">' + s.join('') + '</svg>';
    return { svg: svg, escala: E, w: W / E, h: Ht / E };
  }

  // Vista frontal interna: o móvel sem as frentes, com prateleiras, caixas de gaveta,
  // ferragens (dobradiças, corrediças, cestos) e os vãos livres cotados por dentro.
  function frontalInterna(M, o) {
    o = o || {};
    var d = M.dims, L = d.L, un = o.unidade || 'mm', cor = o.corCota || '#c0392b', spec = M.spec;
    var pedra = M.pecas.filter(function (p) { return p.grupo === 'pedra'; })[0];
    var topoZ = pedra ? pedra.z + pedra.dz : d.H;
    var chamadas = [];
    (M.vaos || []).forEach(function (vm) {
      if (vm.cuba) chamadas.push({ x: vm.il + vm.largInt / 2, z: vm.secoes[0] ? vm.secoes[0].ib + 120 : d.z0 + 120, t: ['vão para sifão da cuba', 'sem fundo e sem prateleira'] });
      vm.secoes.forEach(function (sm) {
        var t = sm.cfg && sm.cfg.tipo;
        if (t === 'forno') chamadas.push({ x: vm.il + vm.largInt * 0.8, z: sm.ib + sm.altInt / 2, t: ['nicho forno', 'tomada 20 A ao lado'] });
        if (t === 'micro') chamadas.push({ x: vm.il + vm.largInt * 0.8, z: sm.ib + sm.altInt / 2, t: ['nicho micro-ondas', 'ventilação atrás'] });
        if (t === 'geladeira') chamadas.push({ x: vm.il + vm.largInt * 0.8, z: sm.it * 0.75, t: ['nicho geladeira', 'sem base · até o piso'] });
      });
    });
    var ledP = M.pecas.filter(function (p) { return p.grupo === 'led'; })[0];
    if (ledP) chamadas.push({ x: ledP.x + ledP.dx * 0.85, z: ledP.z, t: ['fita de LED ' + spec.led.temperatura + 'K', spec.led.tipo === 'embutido' ? 'perfil embutido' : 'perfil sobreposto'] });
    // mesma chamada em vários vãos: um texto só, com uma linha para cada ponto
    var grupos = {};
    chamadas = chamadas.filter(function (c) { var g = grupos[c.t[0]]; if (g) { g.pts.push({ x: c.x, z: c.z }); return false; } c.pts = [{ x: c.x, z: c.z }]; grupos[c.t[0]] = c; return true; });
    var papelTxt = chamadas.length ? 34 : 0;
    var mPapel = 13;
    var E = o.escala || escolherEscala(L, topoZ, (o.areaW || 260) - papelTxt, o.areaH || 150, mPapel);
    var fs = 2.1 * E, lw = 0.16 * E, tq = 1.1 * E, mg = mPapel * E;
    var xMin = pedra ? Math.min(0, pedra.x) : 0, xMax = pedra ? Math.max(L, pedra.x + pedra.dx) : L;
    var W = xMax - xMin + 2 * mg + papelTxt * E, Ht = topoZ + 2 * mg;
    var ox = mg - xMin, oy = mg + topoZ;
    function X(x) { return n1(ox + x); }
    function Y(z) { return n1(oy - z); }
    var cCx = corMat(spec, 'caixa'), cIn = corMat(spec, spec.caixaInternaBranca ? 'caixaInterna' : 'caixa');
    var s = [];
    if (d.z0 > 0 || spec.base.tipo !== 'suspenso') s.push('<line x1="' + n1(ox - mg * 0.4) + '" y1="' + Y(0) + '" x2="' + n1(ox + L + mg * 0.4) + '" y2="' + Y(0) + '" stroke="#2b2b2b" stroke-width="' + n1(lw * 2.2) + '"/>');
    var vis = M.pecas.filter(function (p) {
      if (p.grupo === 'frente' || p.grupo === 'led') return false;
      if (p.grupo === 'ferragem') return /^Dobradiça|^Corrediça|^Cesto|^Aba do cesto|aramado|^Varão|^Borda|^Travessa do cesto|^Tubo|^Espelho/.test(p.nome);
      return p.dx > 0.4 && p.dz > 0.4;
    });
    // de trás para a frente: o que está mais ao fundo é pintado primeiro
    vis.sort(function (a, b) { return (b.y + b.dy) - (a.y + a.dy) || b.y - a.y; });
    vis.forEach(function (p) {
      var fill, st = '#3a3a3a', sw = lw;
      if (p.grupo === 'fundo') fill = shade(cIn, 0.9);
      else if (p.grupo === 'gaveta') fill = p.mat && spec.materiais[p.mat] ? lighten(corMat(spec, p.mat), 0.25) : '#eeeeee';
      else if (p.grupo === 'ferragem') { fill = p.mat === 'espelho' ? '#dfeaee' : '#b9bec3'; st = '#6b6b6b'; sw = lw * 0.8; }
      else if (p.grupo === 'pedra') fill = '#e6e6e6';
      else if (p.grupo === 'rodape') fill = shade(cCx, 0.8);
      else fill = /^Lateral|^Divisória|^Base|^Chapéu|^Travessa/.test(p.nome) ? cCx : cIn;
      if (p.forma && p.forma.plano === 'xz') s.push('<polygon points="' + p.forma.pts.map(function (q) { return X(p.x + q[0]) + ',' + Y(p.z + q[1]); }).join(' ') + '" fill="' + fill + '" stroke="' + st + '" stroke-width="' + n1(sw) + '"/>');
      else s.push('<rect x="' + X(p.x) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dx) + '" height="' + n1(p.dz) + '" fill="' + fill + '" stroke="' + st + '" stroke-width="' + n1(sw) + '"/>');
    });
    var op = { cor: cor, corTxt: o.corCotaTexto || cor, lw: lw, fs: fs, tique: tq };
    // chamadas escritas numa coluna à direita do desenho: marcador no ponto, linha e texto
    if (chamadas.length) {
      chamadas.sort(function (a, b) { return b.z - a.z; });
      var xTxt = ox + L + mg * 0.75, passo = fs * 3.4, yPrev = -1e9;
      chamadas.forEach(function (c) {
        var ty = Math.max(Number(Y(c.z)), yPrev + passo);
        yPrev = ty;
        c.pts.forEach(function (pt) {
          var px = ox + pt.x, py = Number(Y(pt.z));
          s.push('<path d="M' + n1(px) + ' ' + n1(py) + 'L' + n1(xTxt - fs) + ' ' + n1(ty) + 'H' + n1(xTxt - fs * 0.3) + '" fill="none" stroke="#a88a80" stroke-width="' + n1(lw * 0.9) + '"/><circle cx="' + n1(px) + '" cy="' + n1(py) + '" r="' + n1(0.6 * E) + '" fill="#a88a80" stroke="#fff" stroke-width="' + n1(lw * 0.6) + '"/>');
        });
        c.t.forEach(function (lt, k) { s.push('<text x="' + n1(xTxt) + '" y="' + n1(ty + fs * 0.35 + k * fs * 1.45) + '" font-size="' + n1(fs * (k ? 0.82 : 0.92)) + '" fill="' + (k ? '#66717b' : '#3e4b57') + '"' + (k ? '' : ' font-weight="500"') + '>' + esc(lt) + '</text>'); });
      });
    }
    // vãos livres: largura interna embaixo de cada vão e alturas livres entre prateleiras
    var yc = Y(0) + mg * 0.32;
    (M.vaos || []).forEach(function (vm) {
      s.push(cotaT(ox + vm.il, yc, ox + vm.ir, yc, fmtUn(vm.largInt, un), Object.assign({}, op, { chamada: [[ox + vm.il, Y(d.z0) + 1 * E, ox + vm.il, yc + tq], [ox + vm.ir, Y(d.z0) + 1 * E, ox + vm.ir, yc + tq]] })));
      vm.secoes.forEach(function (sm) {
        var t = sm.cfg && sm.cfg.tipo;
        if (t === 'gavetas' || t === 'lixeira' || t === 'temperos' || t === 'fruteira') return;
        if (t === 'geladeira') {
          var xg = ox + vm.il + vm.largInt / 2;
          s.push('<text x="' + n1(xg) + '" y="' + Y(sm.it / 2) + '" font-size="' + n1(Math.min(fs, vm.largInt * 0.9 / (15 * 0.6))) + '" text-anchor="middle" fill="#5a5a5a">NICHO GELADEIRA</text>');
          s.push(cotaT(ox + vm.il + fs * 1.6, Y(sm.it), ox + vm.il + fs * 1.6, Y(0), fmtUn(sm.it, un), op));
          return;
        }
        var nivs = [sm.ib];
        M.pecas.forEach(function (p) {
          if (!/^Prateleira/.test(p.nome)) return;
          if (p.x < vm.il - 1 || p.x + p.dx > vm.ir + 1 || p.z < sm.ib - 1 || p.z > sm.it + 1) return;
          nivs.push(p.z, p.z + p.dz);
        });
        nivs.push(sm.it);
        nivs.sort(function (a, b) { return a - b; });
        var xv = ox + vm.il + Math.min(vm.largInt * 0.22, 60 * E / 10 + fs * 2);
        for (var i = 0; i + 1 < nivs.length; i += 2) {
          var z0 = nivs[i], z1 = nivs[i + 1];
          if (z1 - z0 > fs * 2.2) s.push(cotaT(xv, Y(z1), xv, Y(z0), fmtUn(z1 - z0, un), op));
        }
      });
    });
    var yt = Y(0) + mg * 0.64;
    s.push(cotaT(ox, yt, ox + L, yt, fmtUn(L, un), Object.assign({}, op, { chamada: [[ox, Y(d.z0) + 1 * E, ox, yt + tq], [ox + L, Y(d.z0) + 1 * E, ox + L, yt + tq]] })));
    var xh = ox - mg * 0.45;
    s.push(cotaT(xh, Y(d.H), xh, Y(0), fmtUn(d.H, un), Object.assign({}, op, { chamada: [[ox - 1.2 * E, Y(d.H), xh - tq, Y(d.H)], [ox - 1.2 * E, Y(0), xh - tq, Y(0)]] })));
    var svg = '<svg class="tecnico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" width="' + n1(W / E) + 'mm" height="' + n1(Ht / E) + 'mm" font-family="Poppins, Segoe UI, sans-serif">' + s.join('') + '</svg>';
    return { svg: svg, escala: E, w: W / E, h: Ht / E };
  }

  // Vista lateral externa (lado direito): silhueta com tampo, base e frentes
  function lateralExterna(M, o) {
    o = o || {};
    var d = M.dims, un = o.unidade || 'mm', cor = o.corCota || '#c0392b', spec = M.spec;
    var yMin = 0, yMax = d.D, zMax = d.H;
    M.pecas.forEach(function (p) { yMin = Math.min(yMin, p.y); if (p.grupo === 'pedra') { yMax = Math.max(yMax, p.y + p.dy); zMax = Math.max(zMax, p.z + p.dz); } });
    var mPapel = 9.5;
    var E = o.escala || escolherEscala(yMax - yMin, zMax, o.areaW || 70, o.areaH || 60, mPapel);
    var fs = 2.0 * E, lw = 0.16 * E, tq = 1 * E, mg = mPapel * E;
    var W = yMax - yMin + 2 * mg, Ht = zMax + 2 * mg;
    var ox = mg - yMin, oy = mg + zMax;
    function X(y) { return n1(ox + y); }
    function Y(z) { return n1(oy - z); }
    var s = [];
    if (d.z0 > 0 || spec.base.tipo !== 'suspenso') s.push('<line x1="' + n1(ox + yMin - mg * 0.3) + '" y1="' + Y(0) + '" x2="' + n1(ox + yMax + mg * 0.3) + '" y2="' + Y(0) + '" stroke="#2b2b2b" stroke-width="' + n1(lw * 2.2) + '"/>');
    // o que aparece olhando o lado direito: a peça mais à direita de cada "fatia"
    var vis = M.pecas.filter(function (p) { return p.x + p.dx > d.L - 25 && p.dy > 0.4 && p.dz > 0.4 && p.grupo !== 'led'; });
    vis.sort(function (a, b) { return (a.x + a.dx) - (b.x + b.dx); });
    vis.forEach(function (p) {
      var fill = p.grupo === 'frente' ? shade(corMat(spec, p.mat), 0.9) : (p.grupo === 'pedra' ? '#e6e6e6' : (p.grupo === 'ferragem' ? '#b9bec3' : corMat(spec, p.mat)));
      s.push('<rect x="' + X(p.y) + '" y="' + Y(p.z + p.dz) + '" width="' + n1(p.dy) + '" height="' + n1(p.dz) + '" fill="' + fill + '" stroke="#3a3a3a" stroke-width="' + n1(lw) + '"/>');
    });
    var op = { cor: cor, corTxt: o.corCotaTexto || cor, lw: lw, fs: fs, tique: tq };
    var yb = Y(0) + mg * 0.45;
    s.push(cotaT(ox + yMin, yb, ox + yMax, yb, fmtUn(yMax - yMin, un), Object.assign({}, op, { chamada: [[ox + yMin, Y(0) + 1 * E, ox + yMin, yb + tq], [ox + yMax, Y(0) + 1 * E, ox + yMax, yb + tq]] })));
    var xr = ox + yMax + mg * 0.4;
    s.push(cotaT(xr, Y(zMax), xr, Y(0), fmtUn(zMax, un), Object.assign({}, op, { chamada: [[ox + yMax + 1 * E, Y(zMax), xr + tq, Y(zMax)], [ox + yMax + 1 * E, Y(0), xr + tq, Y(0)]] })));
    var svg = '<svg class="tecnico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" width="' + n1(W / E) + 'mm" height="' + n1(Ht / E) + 'mm" font-family="Poppins, Segoe UI, sans-serif">' + s.join('') + '</svg>';
    return { svg: svg, escala: E, w: W / E, h: Ht / E };
  }

  // Colunas com montagem diferente (uma de cada tipo) para os cortes
  function colunasTipicas(M, max) {
    var vistas = {}, out = [];
    (M.colunas || []).forEach(function (c) {
      var assin = c.secoes.map(function (sm) { var cf = sm.cfg || {}; return cf.tipo + ':' + (cf.itens || []).map(function (i) { return i.tipo; }).join('') + ':' + (cf.prateleiras || 0); }).join('|') + (c.cuba ? '|cuba' : '');
      if (!vistas[assin]) { vistas[assin] = 1; out.push(c.idx); }
    });
    return out.slice(0, max || 3);
  }

  function frontalTecnico(M, o) {
    o = o || {};
    var d = M.dims, L = d.L, H = d.H, un = o.unidade || 'mm';
    var cor = o.corCota || '#c0392b';
    var pedra = M.pecas.filter(function (p) { return p.grupo === 'pedra'; })[0];
    var topoZ = pedra ? pedra.z + pedra.dz : H;
    var mPapel = 13.5; // mm de papel para cotas e textos em volta
    var E = o.escala || escolherEscala(L, topoZ + (M.cuba ? 5 * 25 : 0), o.areaW || 260, o.areaH || 150, mPapel);
    var fs = 2.2 * E, lw = 0.18 * E, lwF = 0.35 * E, tq = 1.1 * E;
    var mg = mPapel * E;
    var xMin = pedra ? Math.min(0, pedra.x) : 0, xMax = pedra ? Math.max(L, pedra.x + pedra.dx) : L;
    var W = xMax - xMin + 2 * mg, extraTopo = M.cuba ? 5 * E : 0, Ht = topoZ + 2 * mg + extraTopo; // cuba: faixa extra em cima para cota, balões e eixo
    var ox = mg - xMin, oy = mg + extraTopo + topoZ;
    function X(x) { return n1(ox + x); }
    function Y(z) { return n1(oy - z); }
    var linha = '#2b2b2b', fina = '#5a5a5a';
    var s = [];
    var spec = M.spec, col = !!o.colorido;
    var cFr = col ? corMat(spec, 'frente') : '#fff';
    var cCx = col ? corMat(spec, 'caixa') : 'none';
    var cIn = col ? shade(corMat(spec, spec.caixaInternaBranca ? 'caixaInterna' : 'caixa'), 0.86) : '#f3f3f3';
    function ret(x, z, w, h, sw, extra) { return '<rect x="' + X(x) + '" y="' + Y(z + h) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + ((extra && extra.fill) || 'none') + '" stroke="' + ((extra && extra.cor) || linha) + '" stroke-width="' + n1(sw) + '"' + ((extra && extra.dash) ? ' stroke-dasharray="' + extra.dash + '"' : '') + '/>'; }
    var op = { cor: cor, corTxt: o.corCotaTexto || cor, lw: lw, fs: fs, tique: tq };
    // piso
    if (d.z0 > 0 || M.spec.base.tipo !== 'suspenso') s.push('<line x1="' + n1(ox - mg * 0.4) + '" y1="' + Y(0) + '" x2="' + n1(ox + L + mg * 0.4) + '" y2="' + Y(0) + '" stroke="' + linha + '" stroke-width="' + n1(lwF * 1.4) + '"/>');
    // corpo, rodapé e roda-teto
    s.push(ret(0, d.z0, L, d.zTop - d.z0, lw, { fill: cCx }));
    M.pecas.forEach(function (p) {
      if (p.grupo === 'rodape' && (/^Rodapé frontal|^Saia|^Roda-teto/).test(p.nome)) s.push(ret(p.x, p.z, p.dx, p.dz, lw, { fill: col ? shade(corMat(spec, 'caixa'), 0.8) : 'none' }));
    });
    // interiores aparentes
    (M.vaos || []).forEach(function (vm) {
      vm.secoes.forEach(function (sm) {
        var t = sm.cfg.tipo;
        if (t === 'geladeira') {
          var ge = sm.cfg.eletro || { largura: 700, altura: 1800 };
          s.push(ret(vm.il, 0, vm.largInt, sm.it, lw, { fill: cIn }));
          var gx = vm.il + Math.max(0, (vm.largInt - ge.largura) / 2);
          s.push(ret(gx, 0, Math.min(ge.largura, vm.largInt), Math.min(ge.altura, sm.it), lw, { dash: n1(2 * E) + ' ' + n1(1.2 * E) }));
          var fsG = Math.min(fs, vm.largInt * 0.9 / (15 * 0.6));
          s.push('<text x="' + X(vm.il + vm.largInt / 2) + '" y="' + Y(Math.min(ge.altura, sm.it) / 2) + '" font-size="' + n1(fsG) + '" text-anchor="middle" fill="' + fina + '">NICHO GELADEIRA</text>');
          s.push('<text x="' + X(vm.il + vm.largInt / 2) + '" y="' + n1(Number(Y(Math.min(ge.altura, sm.it) / 2)) + fsG * 1.4) + '" font-size="' + n1(fsG * 0.8) + '" text-anchor="middle" fill="' + fina + '">aparelho ' + fmtUn(ge.largura, un) + ' × ' + fmtUn(ge.altura, un) + '</text>');
          return;
        }
        if (t === 'nicho' || t === 'arco' || t === 'espelho' || t === 'painel' || t === 'forno' || t === 'micro') {
          s.push(ret(vm.il, sm.ib, vm.largInt, sm.altInt, lw, { fill: cIn }));
          if (t === 'forno' || t === 'micro') {
            var ew = Math.min(vm.largInt - 20, 595), eh = Math.min(sm.altInt - 20, t === 'forno' ? 595 : 380);
            var ex = vm.il + (vm.largInt - ew) / 2, ez = sm.ib + (sm.altInt - eh) / 2;
            s.push(ret(ex, ez, ew, eh, lw, { dash: n1(2 * E) + ' ' + n1(1.2 * E) }));
            var rotE = t === 'forno' ? 'forno' : 'micro-ondas';
            s.push('<text x="' + X(ex + ew / 2) + '" y="' + Y(ez + eh / 2) + '" font-size="' + n1(Math.min(fs, ew * 0.9 / (rotE.length * 0.56))) + '" text-anchor="middle" fill="' + fina + '">' + rotE + '</text>');
          }
        }
      });
    });
    M.pecas.forEach(function (p) {
      if (p.nome === 'Prateleira' || p.nome === 'Prateleira fixa') s.push(ret(p.x, p.z, p.dx, p.dz, lw * 0.8, { fill: col ? corMat(spec, spec.caixaInternaBranca ? 'caixaInterna' : 'caixa') : 'none' }));
      if (p.forma && p.forma.plano === 'xz') s.push('<polygon points="' + p.forma.pts.map(function (q) { return X(p.x + q[0]) + ',' + Y(p.z + q[1]); }).join(' ') + '" fill="' + (p.mat === 'espelho' ? '#e6eef1' : '#fff') + '" stroke="' + linha + '" stroke-width="' + n1(lw) + '"/>');
    });
    // frentes
    var ripas = [];
    M.pecas.forEach(function (p) {
      if (p.grupo !== 'frente' || p.nome === 'Painel') return;
      if (p.nome === 'Ripa') { ripas.push(p); return; }
      s.push(ret(p.x, p.z, p.dx, p.dz, lwF, { fill: p.nome === 'Vidro canelado' ? (col ? '#cfdde2' : '#eef3f5') : (p.mat === 'frente' ? cFr : (col ? corMat(spec, p.mat) : '#fff')) }));
      var m = p.meta || {};
      var tr = 'stroke="' + fina + '" stroke-width="' + n1(lw) + '" stroke-dasharray="' + n1(2.4 * E) + ' ' + n1(1.4 * E) + '" fill="none"';
      if (m.tipo === 'porta') {
        var hx = m.dobradica === 'esq' ? p.x : p.x + p.dx, ox2 = m.dobradica === 'esq' ? p.x + p.dx : p.x;
        s.push('<path d="M' + X(hx) + ' ' + Y(p.z + p.dz) + ' L' + X(ox2) + ' ' + Y(p.z + p.dz / 2) + ' L' + X(hx) + ' ' + Y(p.z) + '" ' + tr + '/>');
      } else if (m.tipo === 'basculante') {
        s.push('<path d="M' + X(p.x) + ' ' + Y(p.z + p.dz) + ' L' + X(p.x + p.dx / 2) + ' ' + Y(p.z) + ' L' + X(p.x + p.dx) + ' ' + Y(p.z + p.dz) + '" ' + tr + '/>');
      }
      if (p.forma && p.forma.cava) {
        var cz = p.forma.cava === 'base' ? p.z + 12 : p.z + p.dz - 12;
        s.push('<line x1="' + X(p.x) + '" y1="' + Y(cz) + '" x2="' + X(p.x + p.dx) + '" y2="' + Y(cz) + '" stroke="' + fina + '" stroke-width="' + n1(lw * 0.8) + '"/>');
      }
      var rot = { temperos: 'porta-temperos', lixeira: 'lixeira', fruteira: 'fruteira' }[m.tipo] || (m.item === 'interna' ? 'c/ gaveta interna' : '');
      if (rot) {
        var vertical = p.dz > p.dx * 1.4;
        var cx = p.x + p.dx / 2, cz2 = p.z + p.dz / 2;
        var fsR = Math.min(fs * 0.85, (vertical ? p.dz : p.dx) * 0.62 / (rot.length * 0.62), (vertical ? p.dx : p.dz) * 0.55);
        s.push('<text x="' + X(cx) + '" y="' + Y(cz2) + '" font-size="' + n1(fsR) + '" fill="' + fina + '" text-anchor="middle"' + (vertical ? ' transform="rotate(-90 ' + X(cx) + ' ' + Y(cz2) + ')"' : '') + '>' + rot + '</text>');
      }
    });
    ripas.forEach(function (p) { s.push(ret(p.x, p.z, p.dx, p.dz, lw * 0.7, col ? { fill: shade(cFr, 0.93), cor: shade(cFr, 0.62) } : { cor: fina })); });
    if (col) M.pecas.forEach(function (p) {
      if (p.grupo !== 'led') return;
      var gid = 'gl' + (++nBrilho), hz = Math.min(220, p.z - 5);
      if (hz > 20) s.push('<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + COR_LED + '" stop-opacity=".45"/><stop offset="1" stop-color="' + COR_LED + '" stop-opacity="0"/></linearGradient></defs><rect x="' + X(p.x) + '" y="' + Y(p.z) + '" width="' + n1(p.dx) + '" height="' + n1(hz) + '" fill="url(#' + gid + ')"/>');
    });
    M.pecas.forEach(function (p) {
      if (p.nome === 'Puxador alça' || p.nome === 'Perfil puxador') s.push(ret(p.x, p.z, p.dx, p.dz, lw, { fill: '#d9d9d9' }));
      if (p.grupo === 'led') s.push('<line x1="' + X(p.x) + '" y1="' + Y(p.z) + '" x2="' + X(p.x + p.dx) + '" y2="' + Y(p.z) + '" stroke="' + COR_LED + '" stroke-width="' + n1(lwF * 1.6) + '" stroke-dasharray="' + n1(1.6 * E) + ' ' + n1(0.8 * E) + '"/>');
    });
    if (pedra) s.push(ret(pedra.x, pedra.z, pedra.dx, pedra.dz, lw, { fill: '#ececec' }));
    // balões das colunas (mesma numeração do corte, da planta e dos detalhes)
    var yBal = Y(topoZ) - mg * (M.cuba ? 0.66 : 0.55), rBal = 2.1 * E;
    (M.colunas || []).forEach(function (c) {
      var cx = (c.x0 + c.x1) / 2;
      if (M.cuba && Math.abs(cx - M.cuba.centro) < rBal * 1.6) cx = M.cuba.centro + (cx < M.cuba.centro ? -1 : 1) * rBal * 1.8;
      s.push(balao(ox + cx, yBal, rBal, 'C' + (c.idx + 1), lw, fs));
    });
    // cuba (projeção) e eixo hidráulico
    if (M.cuba) {
      var ch = Math.min(220, d.Hc * 0.35);
      s.push(ret(M.cuba.x0, d.zTop - ch, M.cuba.x1 - M.cuba.x0, ch, lw, { cor: '#4d6f99', dash: n1(2 * E) + ' ' + n1(1.2 * E) }));
      s.push('<text x="' + X(M.cuba.x0 + 8 * E / 4) + '" y="' + Y(d.zTop - fs * 1.4) + '" font-size="' + n1(fs * 0.85) + '" fill="#4d6f99">cuba</text>');
      s.push('<line x1="' + X(M.cuba.centro) + '" y1="' + Y(topoZ + mg * 0.92) + '" x2="' + X(M.cuba.centro) + '" y2="' + Y(d.zTop - ch - 5 * E) + '" stroke="' + cor + '" stroke-width="' + n1(lw) + '" stroke-dasharray="' + n1(4 * E) + ' ' + n1(1 * E) + ' ' + n1(0.6 * E) + ' ' + n1(1 * E) + '"/>');
      s.push('<text x="' + n1(ox + M.cuba.centro + fs * 0.4) + '" y="' + Y(topoZ + mg * 0.96) + '" font-size="' + n1(fs * 0.85) + '" fill="' + cor + '">eixo hidráulico</text>');
      s.push(cotaT(ox, Y(topoZ) - mg * 0.24, ox + M.cuba.centro, Y(topoZ) - mg * 0.24, fmtUn(M.cuba.centro, un), Object.assign({}, op, { chamada: [[ox, Y(topoZ) - mg * 0.28, ox, Y(topoZ)]] })));
    }
    // cotas: colunas, total, alturas
    var yc = Y(0) + mg * 0.3;
    (M.colunas || []).forEach(function (c) {
      s.push(cotaT(ox + c.x0, yc, ox + c.x1, yc, fmtUn(c.larg, un), Object.assign({}, op, { chamada: [[ox + c.x0, Y(0) + 1.2 * E, ox + c.x0, yc + tq], [ox + c.x1, Y(0) + 1.2 * E, ox + c.x1, yc + tq]] })));
    });
    var yt = Y(0) + mg * 0.62;
    s.push(cotaT(ox, yt, ox + L, yt, fmtUn(L, un), Object.assign({}, op, { chamada: [[ox, yc, ox, yt + tq], [ox + L, yc, ox + L, yt + tq]] })));
    var xh = ox - mg * 0.45;
    s.push(cotaT(xh, Y(H), xh, Y(0), fmtUn(H, un), Object.assign({}, op, { chamada: [[ox - 1.2 * E, Y(H), xh - tq, Y(H)], [ox - 1.2 * E, Y(0), xh - tq, Y(0)]] })));
    var xd = ox + L + mg * 0.3;
    var cm = (M.colunas || []).filter(function (c) { return c.secoes.length > 1; })[0];
    if (cm) cm.secoes.forEach(function (sm) { s.push(cotaT(xd, Y(sm.z1), xd, Y(sm.z0), fmtUn(sm.alt, un), op)); });
    if (d.z0 > 0) s.push(cotaT(xd + mg * 0.3, Y(d.z0), xd + mg * 0.3, Y(0), fmtUn(d.z0, un), op));
    var svg = '<svg class="tecnico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" width="' + n1(W / E) + 'mm" height="' + n1(Ht / E) + 'mm" font-family="Poppins, Segoe UI, sans-serif">' + s.join('') + '</svg>';
    return { svg: svg, escala: E, w: W / E, h: Ht / E };
  }

  function plantaTecnica(M, o) {
    o = o || {};
    var d = M.dims, L = d.L, D = d.D, un = o.unidade || 'mm';
    var cor = o.corCota || '#c0392b';
    var maxPorta = 0;
    M.pecas.forEach(function (p) { if (p.meta && p.meta.tipo === 'porta') maxPorta = Math.max(maxPorta, p.dx); });
    var frente = Math.max(maxPorta, 150) + 20;
    var pedra = M.pecas.filter(function (p) { return p.grupo === 'pedra'; })[0];
    var yMin = Math.min(d.frenteY0, pedra ? pedra.y : 0) - frente;
    var mPapel = 13.5;
    var E = o.escala || escolherEscala(L, D - yMin, o.areaW || 260, o.areaH || 120, mPapel);
    var fs = 2.2 * E, lw = 0.18 * E, lwF = 0.35 * E, tq = 1.1 * E, mg = mPapel * E;
    var W = L + 2 * mg, Ht = (D - yMin) + 2 * mg;
    var ox = mg, oy = mg + D;
    function X(x) { return n1(ox + x); }
    function Y(y) { return n1(oy - y); }
    var linha = '#2b2b2b', fina = '#5a5a5a', s = [];
    var op = { cor: cor, corTxt: o.corCotaTexto || cor, lw: lw, fs: fs, tique: tq };
    function ret(x, y, w, h, sw, ex) { return '<rect x="' + X(x) + '" y="' + Y(y + h) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + ((ex && ex.fill) || 'none') + '" stroke="' + ((ex && ex.cor) || linha) + '" stroke-width="' + n1(sw) + '"' + ((ex && ex.dash) ? ' stroke-dasharray="' + ex.dash + '"' : '') + '/>'; }
    var tr = n1(2.4 * E) + ' ' + n1(1.4 * E);
    s.push('<line x1="' + n1(ox - mg * 0.3) + '" y1="' + Y(D) + '" x2="' + n1(ox + L + mg * 0.3) + '" y2="' + Y(D) + '" stroke="' + linha + '" stroke-width="' + n1(lwF * 2) + '"/>');
    s.push(ret(0, 0, L, D, lwF));
    M.pecas.forEach(function (p) {
      if (p.grupo === 'caixa' && /^Lateral|^Divisória/.test(p.nome)) s.push(ret(p.x, p.y, p.dx, p.dy, lw, { fill: '#e9e9e9' }));
      if (p.grupo === 'frente' && p.y < 1) {
        s.push(ret(p.x, p.y, p.dx, p.dy, lw, { fill: '#fff' }));
        var m = p.meta || {};
        if (m.tipo === 'porta') {
          var r = p.dx, px = m.dobradica === 'esq' ? p.x : p.x + p.dx, sx = m.dobradica === 'esq' ? 1 : -1;
          s.push('<line x1="' + X(px) + '" y1="' + Y(p.y) + '" x2="' + X(px) + '" y2="' + Y(p.y - r) + '" stroke="' + fina + '" stroke-width="' + n1(lw) + '"/>');
          s.push('<path d="M' + X(px + sx * r) + ' ' + Y(p.y) + ' A ' + n1(r) + ' ' + n1(r) + ' 0 0 ' + (sx > 0 ? 1 : 0) + ' ' + X(px) + ' ' + Y(p.y - r) + '" fill="none" stroke="' + fina + '" stroke-width="' + n1(lw) + '" stroke-dasharray="' + tr + '"/>');
        }
      }
    });
    if (pedra) s.push(ret(pedra.x, pedra.y, pedra.dx, pedra.dy, lw, { dash: n1(5 * E) + ' ' + n1(1.5 * E) }));
    if (M.cuba) {
      var cp = Math.min(M.cuba.prof, D - 120), cy0 = (D - cp) / 2 + 20;
      s.push(ret(M.cuba.x0, cy0, M.cuba.x1 - M.cuba.x0, cp, lw, { cor: '#4d6f99', dash: tr }));
      var cx = M.cuba.centro, cyc = cy0 + cp / 2;
      s.push('<circle cx="' + X(cx) + '" cy="' + Y(cyc) + '" r="' + n1(2.2 * E) + '" fill="none" stroke="' + cor + '" stroke-width="' + n1(lw * 1.4) + '"/>');
      s.push('<line x1="' + X(cx) + '" y1="' + Y(D + mg * 0.7) + '" x2="' + X(cx) + '" y2="' + Y(cyc - 4 * E) + '" stroke="' + cor + '" stroke-width="' + n1(lw) + '" stroke-dasharray="' + n1(4 * E) + ' ' + n1(1 * E) + ' ' + n1(0.6 * E) + ' ' + n1(1 * E) + '"/>');
      s.push('<text x="' + n1(ox + cx + fs * 0.4) + '" y="' + Y(D + mg * 0.72) + '" font-size="' + n1(fs * 0.85) + '" fill="' + cor + '">eixo hidráulico</text>');
      s.push('<text x="' + X(M.cuba.x0 + 2 * E) + '" y="' + Y(cy0 + cp - fs * 1.2) + '" font-size="' + n1(fs * 0.85) + '" fill="#4d6f99">cuba</text>');
      s.push(cotaT(ox, Y(D) - mg * 0.35, ox + cx, Y(D) - mg * 0.35, fmtUn(cx, un), Object.assign({}, op, { chamada: [[ox, Y(D) - mg * 0.4, ox, Y(D)]] })));
    }
    var rB = 1.9 * E;
    (M.colunas || []).forEach(function (c) {
      if (c.larg < rB * 2.6) return;
      s.push(balao(X((c.x0 + c.x1) / 2), Y(Math.min(D * 0.5, rB + 30)), rB, 'C' + (c.idx + 1), lw, fs * 0.92));
    });
    (o.cortes || []).forEach(function (ct) {
      var xc = ox + ct.x, y0c = Y(D) - mg * 0.3, y1c = Y(yMin) + mg * 0.08, rC = 2 * E;
      s.push('<line x1="' + n1(xc) + '" y1="' + n1(y0c) + '" x2="' + n1(xc) + '" y2="' + n1(y1c) + '" stroke="#2b2b2b" stroke-width="' + n1(lw * 1.5) + '" stroke-dasharray="' + n1(5 * E) + ' ' + n1(1 * E) + ' ' + n1(0.8 * E) + ' ' + n1(1 * E) + '"/>');
      [y0c, y1c].forEach(function (yy) {
        s.push('<path d="M' + n1(xc) + ' ' + n1(yy) + 'h' + n1(-4 * E) + '" stroke="#2b2b2b" stroke-width="' + n1(lw * 3) + '"/><path d="M' + n1(xc - 4 * E) + ' ' + n1(yy) + 'l' + n1(1.6 * E) + ' ' + n1(-1 * E) + 'v' + n1(2 * E) + 'z" fill="#2b2b2b"/>');
        s.push('<circle cx="' + n1(xc + rC * 1.2) + '" cy="' + n1(yy) + '" r="' + n1(rC) + '" fill="#fff" stroke="#2b2b2b" stroke-width="' + n1(lw * 1.2) + '"/><text x="' + n1(xc + rC * 1.2) + '" y="' + n1(yy + fs * 0.36) + '" font-size="' + n1(fs) + '" font-weight="600" text-anchor="middle" fill="#2b2b2b">' + esc(ct.letra) + '</text>');
      });
    });
    var yb = Y(yMin) + mg * 0.3;
    s.push(cotaT(ox, yb, ox + L, yb, fmtUn(L, un), Object.assign({}, op, { chamada: [[ox, Y(0), ox, yb + tq], [ox + L, Y(0), ox + L, yb + tq]] })));
    var xl = ox - mg * 0.45;
    s.push(cotaT(xl, Y(D), xl, Y(0), fmtUn(D, un), Object.assign({}, op, { chamada: [[ox, Y(D), xl - tq, Y(D)], [ox, Y(0), xl - tq, Y(0)]] })));
    s.push('<text x="' + n1(ox + L / 2) + '" y="' + n1(yb + fs * 2.6) + '" font-size="' + n1(fs) + '" text-anchor="middle" fill="' + fina + '">FRENTE</text>');
    var svg = '<svg class="tecnico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(Ht) + '" width="' + n1(W / E) + 'mm" height="' + n1(Ht / E) + 'mm" font-family="Poppins, Segoe UI, sans-serif">' + s.join('') + '</svg>';
    return { svg: svg, escala: E, w: W / E, h: Ht / E };
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
      // nome e medida em duas linhas que cabem na peça (com folga entre elas); peça pequena: só a medida
      var med = Math.round(it.c) + '×' + Math.round(it.l) + (it.rot ? ' (girada)' : '');
      var larg = Math.max(it.nome.length, med.length * 0.82) * 0.6;
      var tf = Math.min(fs, it.h / 3.9, it.w * 0.9 / Math.max(4, larg));
      var cx = n1(it.x + it.w / 2), cy = it.y + it.h / 2;
      if (tf > fs * 0.35) {
        s.push('<text x="' + cx + '" y="' + n1(cy - tf * 0.3) + '" font-size="' + n1(tf) + '" text-anchor="middle" fill="#3a2e26">' + esc(it.nome) + '</text>');
        s.push('<text x="' + cx + '" y="' + n1(cy + tf * 1.3) + '" font-size="' + n1(tf * 0.8) + '" text-anchor="middle" fill="#6b5b4f">' + med + '</text>');
      } else {
        var t2 = Math.min(fs, it.h / 1.8, it.w * 0.9 / Math.max(3, med.length * 0.55));
        if (t2 > fs * 0.3) s.push('<text x="' + cx + '" y="' + n1(cy + t2 * 0.35) + '" font-size="' + n1(t2) + '" text-anchor="middle" fill="#6b5b4f">' + med + '</text>');
      }
    });
    return '<svg class="desenho chapa" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ' + (g.w + 8) + ' ' + (g.h + 8) + '">' + s.join('') + '</svg>';
  }

  return { corMat: corMat, frontalInterna: frontalInterna, lateralExterna: lateralExterna, frontalTecnico: frontalTecnico, plantaTecnica: plantaTecnica, corteTecnico: corteTecnico, colunasTipicas: colunasTipicas, balao: balao, COR_LED: COR_LED, escolherEscala: escolherEscala, fmtUn: fmtUn, cotaT: cotaT, frontal: frontal, planta: planta, perspectiva: perspectiva, chapaSvg: chapaSvg, cor: { shade: shade, lighten: lighten, lum: lum }, esc: esc, cotaH: cotaH, cotaV: cotaV };
});
