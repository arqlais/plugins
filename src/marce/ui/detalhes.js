/* marcê — detalhes em círculo (seções típicas, sem escala) para a prancha de detalhamento.
   Cada desenho fica num viewBox 100 × 100, recortado por um círculo tracejado, como nos
   detalhamentos de marcenaria feitos à mão: puxador, frente, iluminação. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MarceDetalhes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var n = 0;
  var T = '#2b2b2b', COTA = '#c0392b', LED = '#d9a400', METAL = '#c9cdd1';

  function hach(id) {
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#9a9a9a" stroke-width=".6"/></pattern>';
  }
  function circulo(conteudo, cor) {
    var id = 'dc' + (++n);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="det-circ"><defs><clipPath id="' + id + 'c"><circle cx="50" cy="50" r="45"/></clipPath>' + hach(id + 'h') + '</defs>' +
      '<g clip-path="url(#' + id + 'c)">' + conteudo.replace(/HACH/g, 'url(#' + id + 'h)').replace(/MDF/g, cor || '#e6dcd2') + '</g>' +
      '<circle cx="50" cy="50" r="45" fill="none" stroke="' + T + '" stroke-width=".7" stroke-dasharray="4 2.5"/></svg>';
  }
  function txt(x, y, t, anc) { return '<text x="' + x + '" y="' + y + '" font-size="5.2" fill="#555" font-family="Poppins,sans-serif"' + (anc ? ' text-anchor="' + anc + '"' : '') + '>' + t + '</text>'; }
  function cota(x0, x1, y, t) { return '<path d="M' + x0 + ' ' + y + 'H' + x1 + 'M' + (x0 - 1.5) + ' ' + (y + 1.5) + 'l3 -3M' + (x1 - 1.5) + ' ' + (y + 1.5) + 'l3 -3" stroke="' + COTA + '" stroke-width=".6"/>' + '<text x="' + (x0 + x1) / 2 + '" y="' + (y - 2) + '" font-size="5" text-anchor="middle" fill="' + COTA + '" font-family="Poppins,sans-serif">' + t + '</text>'; }
  function mdf(x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="MDF" stroke="' + T + '" stroke-width=".8"/>'; }
  function cortado(x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="HACH" stroke="' + T + '" stroke-width=".8"/>'; }

  // Corte lateral no topo de uma frente, mostrando como a mão abre a porta/gaveta
  var DES = {
    cava: function () {
      // tampo/caixa em cima, travessa recuada, frente com chanfro de 45° no topo
      return cortado(8, 18, 90, 10) + cortado(40, 28, 10, 26) +
        '<path d="M14 82V40L22 32H30V82Z" fill="MDF" stroke="' + T + '" stroke-width=".8"/>' +
        '<path d="M14 40L22 32" stroke="' + COTA + '" stroke-width=".6" stroke-dasharray="2 1.4"/>' + txt(32, 46, '45°') + txt(56, 46, 'travessa') + txt(56, 53, 'recuada');
    },
    perfil: function () {
      return cortado(8, 18, 90, 10) + mdf(16, 40, 16, 50) +
        '<path d="M14 40H34V34H16V30" fill="' + METAL + '" stroke="#6b6b6b" stroke-width=".8"/>' + txt(38, 38, 'perfil de') + txt(38, 45, 'alumínio');
    },
    passante: function () {
      // prateleira/caixa passa à frente e a porta para abaixo dela: a mão entra pelo vão
      return cortado(8, 22, 90, 10) + mdf(18, 44, 16, 50) +
        '<path d="M18 38H34" stroke="' + COTA + '" stroke-width=".5" stroke-dasharray="2 1.4"/>' +
        '<path d="M40 32V44" stroke="' + COTA + '" stroke-width=".6"/>' + txt(44, 41, 'vão para a mão') + txt(44, 60, 'porta') + txt(44, 67, 'passante');
    },
    alca: function () {
      return mdf(30, 6, 16, 90) + '<path d="M30 32H20V62H30" fill="none" stroke="#6b6b6b" stroke-width="3" stroke-linejoin="round"/>' + txt(50, 50, 'puxador') + txt(50, 57, 'aparente');
    },
    barra: function () { return DES.alca(); },
    botao: function () {
      return mdf(30, 6, 16, 90) + '<path d="M30 46H24V54H30" fill="#6b6b6b"/><circle cx="20" cy="50" r="6" fill="' + METAL + '" stroke="#6b6b6b"/>' + txt(50, 52, 'botão');
    },
    testeira: function () {
      return cortado(8, 18, 90, 10) + mdf(16, 40, 16, 50) +
        '<path d="M14 40V32H34L38 28" fill="none" stroke="#6b6b6b" stroke-width="2.4" stroke-linejoin="round"/>' + txt(40, 44, 'perfil 45°') + txt(40, 51, '(testeira)');
    },
    toque: function () {
      return cortado(54, 6, 10, 90) + mdf(30, 6, 16, 90) +
        '<rect x="46" y="44" width="8" height="12" fill="' + METAL + '" stroke="#6b6b6b"/><path d="M40 50H28" stroke="' + COTA + '" stroke-width=".6"/><path d="M28 50l4 -2.4v4.8z" fill="' + COTA + '"/>' + txt(66, 48, 'fecho') + txt(66, 55, 'toque');
    },
    led: function (o) {
      var emb = o.montagem !== 'sobreposto';
      var s = '';
      if (emb) s += '<path d="M4 34H96V50H60V40H46V50H4Z" fill="HACH" stroke="' + T + '" stroke-width=".8"/><rect x="47.5" y="41.5" width="11" height="7" fill="' + METAL + '" stroke="#6b6b6b" stroke-width=".6"/><rect x="47.5" y="48" width="11" height="2" fill="#fff6dc" stroke="' + LED + '" stroke-width=".6"/>';
      else s += cortado(4, 34, 92, 16) + '<rect x="46" y="50" width="14" height="6" fill="' + METAL + '" stroke="#6b6b6b" stroke-width=".6"/><rect x="46" y="55" width="14" height="2" fill="#fff6dc" stroke="' + LED + '" stroke-width=".6"/>';
      var y = emb ? 50 : 57;
      s += '<path d="M53 ' + y + 'L26 96H80Z" fill="' + LED + '" opacity=".2"/>';
      s += txt(50, 28, 'prateleira / base', 'middle') + txt(53, 82, (o.temperatura || 4000) + 'K', 'middle');
      if (emb) s += cota(46, 60, 64, '12');
      return s;
    },
    ripada: function (o) {
      // planta (vista de cima) da frente com ripas coladas
      var r = o.ripa || { largura: 20, espaco: 10, espessura: 9 };
      var esc = 1.6, w = r.largura * esc / 2, e = r.espaco * esc / 2, h = Math.max(4, r.espessura * esc / 2);
      var s = mdf(4, 56, 92, 12);
      for (var x = 8; x + w < 96; x += w + e) s += '<rect x="' + x + '" y="' + (56 - h) + '" width="' + w + '" height="' + h + '" fill="MDF" stroke="' + T + '" stroke-width=".7"/>';
      return s + cota(8, 8 + w, 40, r.largura) + cota(8 + w, 8 + w + e, 32, r.espaco) + txt(50, 80, 'frente (vista de cima)', 'middle');
    },
    moldura: function () {
      return mdf(30, 6, 14, 90) + mdf(44, 6, 6, 18) + mdf(44, 76, 6, 18) + txt(54, 18, 'quadro') + txt(54, 25, 'aplicado') + txt(54, 52, 'almofada');
    },
    rodape: function (o) {
      return mdf(20, 10, 16, 40) + cortado(10, 50, 86, 10) + cortado(10 + Math.min(30, (o.recuo || 50) / 3), 60, 8, 26) +
        '<path d="M2 86H98" stroke="' + T + '" stroke-width="1.4"/>' + cota(10, 10 + Math.min(30, (o.recuo || 50) / 3), 78, o.recuo || 50) + txt(46, 74, 'rodapé') + txt(46, 81, 'recuado');
    },
    pes: function () {
      return mdf(20, 10, 16, 40) + cortado(10, 50, 86, 10) + '<rect x="40" y="60" width="10" height="20" fill="' + METAL + '" stroke="#6b6b6b"/><rect x="36" y="80" width="18" height="5" fill="#6b6b6b"/>' +
        '<path d="M2 86H98" stroke="' + T + '" stroke-width="1.4"/>' + txt(58, 72, 'pé regulável');
    },
    suspenso: function () {
      return cortado(84, 0, 12, 100) + cortado(10, 50, 74, 10) + mdf(10, 60, 16, 30) +
        '<path d="M84 46H70V50" fill="none" stroke="#6b6b6b" stroke-width="2.4"/>' + txt(40, 40, 'suporte oculto') + txt(40, 47, 'na parede');
    },
    vidro: function () {
      return '<rect x="34" y="6" width="10" height="20" fill="' + METAL + '" stroke="#6b6b6b"/><rect x="34" y="74" width="10" height="20" fill="' + METAL + '" stroke="#6b6b6b"/><rect x="37" y="26" width="4" height="48" fill="#dfeaee" stroke="#6f8fb6" stroke-width=".7"/>' + txt(48, 18, 'perfil de alumínio') + txt(48, 52, 'vidro canelado') + txt(48, 59, '4 mm temperado');
    }
  };

  // Detalhe com linhas de chamada (moldura tracejada): parede, fundo do armário, driver, fiação e perfil de LED
  function caixaLed(o) {
    var id = 'dl' + (++n), emb = o.montagem !== 'sobreposto', temp = o.temperatura || 4000;
    var pos = o.posicao || 'fundo';
    var s = '<defs><pattern id="' + id + 'c" patternUnits="userSpaceOnUse" width="6" height="6"><circle cx="1.5" cy="1.5" r=".5" fill="#9a9a9a"/><path d="M4 4l1.4 -1.4" stroke="#9a9a9a" stroke-width=".4"/></pattern>' + hach(id + 'h') + '</defs>';
    s += '<rect x="2" y="2" width="116" height="86" fill="none" stroke="#a8433a" stroke-width=".7" stroke-dasharray="4 2.5"/>';
    // parede (à esquerda), caixa do armário à direita da parede
    s += '<rect x="54" y="6" width="14" height="80" fill="url(#' + id + 'c)" stroke="' + T + '" stroke-width=".7"/>';
    var bx = 68, by = 50, bw = 48, bh = 5;
    s += '<path d="M' + bx + ' 12H' + (bx + bw) + 'V' + (by + bh) + 'H' + bx + '" fill="none" stroke="#7a5230" stroke-width="1.6"/>';
    s += '<path d="M' + bx + ' 30H' + (bx + bw) + '" stroke="#7a5230" stroke-width="1.2"/>';
    var lx = pos === 'fundo' ? bx + 3 : (pos === 'frente' ? bx + bw - 12 : bx + bw / 2 - 4);
    if (emb) s += '<rect x="' + lx + '" y="' + (by + 1) + '" width="7" height="' + (bh - 1) + '" fill="' + METAL + '" stroke="#6b6b6b" stroke-width=".5"/>';
    else s += '<rect x="' + lx + '" y="' + (by + bh) + '" width="7" height="3" fill="' + METAL + '" stroke="#6b6b6b" stroke-width=".5"/>';
    var ly = by + bh + (emb ? 0 : 3);
    s += '<rect x="' + lx + '" y="' + (ly - 1) + '" width="7" height="1.2" fill="' + LED + '"/>';
    s += '<path d="M' + (lx + 3.5) + ' ' + ly + 'L' + (lx - 6) + ' 84H' + (lx + 18) + 'Z" fill="' + LED + '" opacity=".35"/>';
    // driver dentro do armário e fiação até o perfil
    s += '<rect x="' + (bx + 2) + '" y="' + (by - 8) + '" width="8" height="8" fill="#b9bec3" stroke="#6b6b6b" stroke-width=".5"/>';
    s += '<path d="M' + (bx + 6) + ' ' + by + 'C' + (bx + 6) + ' ' + (by + 3) + ' ' + (lx + 3) + ' ' + (by + 1) + ' ' + (lx + 3.5) + ' ' + (by + 2) + '" fill="none" stroke="#555" stroke-width=".5"/>';
    function cham(px, py, ty, t1, t2) {
      return '<circle cx="' + px + '" cy="' + py + '" r=".9" fill="#a8433a"/><path d="M' + px + ' ' + py + 'L50 ' + ty + 'H6" fill="none" stroke="#a8433a" stroke-width=".45"/>' +
        '<text x="6" y="' + (ty - 1.6) + '" font-size="4.3" fill="#333" font-family="Poppins,sans-serif">' + t1 + '</text>' + (t2 ? '<text x="6" y="' + (ty + 4.4) + '" font-size="4.3" fill="#333" font-family="Poppins,sans-serif">' + t2 + '</text>' : '');
    }
    s += cham(bx + 6, by - 4, 32, 'Driver da fita de LED', 'dentro do armário');
    s += cham(bx + 8, by + 1.5, 50, 'Fiação', '');
    s += cham(lx + 3.5, ly, 66, 'Fita de LED ' + temp + 'K', 'em perfil ' + (emb ? 'embutido' : 'sobreposto'));
    if (pos === 'fundo') s += '<path d="M' + bx + ' 59H' + lx + 'M' + bx + ' 57v4M' + lx + ' 57v4" stroke="' + COTA + '" stroke-width=".5"/><path d="M' + (lx + 1) + ' 46H' + (bx + 26) + '" stroke="' + COTA + '" stroke-width=".35"/><text x="' + (bx + 27) + '" y="47.5" font-size="4.3" fill="' + COTA + '" font-family="Poppins,sans-serif">2 cm</text>';
    return '<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" class="det-caixa">' + s + '</svg>';
  }

  var TITULOS = {
    cava: 'puxador cava 45°', perfil: 'puxador perfil', passante: 'porta passante', alca: 'puxador alça', barra: 'puxador barra',
    botao: 'puxador botão', testeira: 'perfil 45° (testeira)', toque: 'abertura por toque',
    led: 'perfil de LED', rodape: 'rodapé recuado', pes: 'pés reguláveis', suspenso: 'fixação suspensa', ripada: 'frente ripada', moldura: 'frente com moldura', vidro: 'porta de vidro canelado'
  };

  // Lista dos detalhes que valem para este móvel (máx. 3)
  function doMovel(M) {
    var spec = M.spec, out = [];
    var cor = (spec.materiais.frente || {}).cor;
    var pux = spec.puxador.tipo;
    if (DES[pux]) out.push({ chave: pux, titulo: TITULOS[pux], svg: circulo(DES[pux]({}), cor) });
    var est = (spec.frentes && spec.frentes.estilo) || 'lisa';
    if (est !== 'lisa' && DES[est]) out.push({ chave: est, titulo: TITULOS[est], svg: circulo(DES[est]({ ripa: spec.frentes.ripa }), cor) });
    if (spec.led && spec.led.ativo && M.pecas.some(function (p) { return p.grupo === 'led'; })) out.push({ chave: 'led', titulo: 'iluminação', caixa: true, svg: caixaLed({ montagem: spec.led.tipo, temperatura: spec.led.temperatura, posicao: spec.led.posicao }) });
    var b = spec.base && spec.base.tipo;
    if (DES[b]) out.push({ chave: b, titulo: TITULOS[b], svg: circulo(DES[b]({ recuo: spec.base.recuo }), cor) });
    return out.slice(0, 3);
  }

  return { doMovel: doMovel, circulo: circulo, caixaLed: caixaLed, DES: DES, TITULOS: TITULOS };
});
