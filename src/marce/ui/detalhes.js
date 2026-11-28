/* marcê — detalhes construtivos (desenhos próprios, sem escala).
   Linguagem visual do marcê: peças cortadas com hachura no tom "ink" sobre rosé claro,
   ferragens em cinza metálico, notas com marcador redondo e linha fina, cotas na cor
   escolhida para a prancha. Cada detalhe é um SVG 120 × 90. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MarceDetalhes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TX = '#3e4b57', INK = '#a88a80', TINT = '#f6ecea', MET = '#c3c8cd', METL = '#6f777e', LED = '#e0ad1f';
  var n = 0;

  function Desenho(cor, corCota) {
    var id = 'md' + (++n), s = [];
    var cFr = cor.frente || '#c9a27a', cCx = cor.caixa || '#d8c3a5', cGv = cor.gaveta || '#eeeeee', cc = corCota || '#c0392b';
    s.push('<defs><pattern id="' + id + 'h" patternUnits="userSpaceOnUse" width="3.2" height="3.2" patternTransform="rotate(45)"><rect width="3.2" height="3.2" fill="' + TINT + '"/><line x1="0" y1="0" x2="0" y2="3.2" stroke="' + INK + '" stroke-width=".55"/></pattern>' +
      '<pattern id="' + id + 'p" patternUnits="userSpaceOnUse" width="7" height="7"><rect width="7" height="7" fill="#ecebe8"/><circle cx="2" cy="2" r=".55" fill="#9c9a94"/><circle cx="5.2" cy="4.6" r=".4" fill="#9c9a94"/><path d="M4.5 1.2l1.2 .9" stroke="#9c9a94" stroke-width=".35"/></pattern>' +
      '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe3e6"/><stop offset="1" stop-color="' + MET + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + LED + '" stop-opacity=".55"/><stop offset="1" stop-color="' + LED + '" stop-opacity="0"/></linearGradient></defs>');
    function txt(x, y, t, anc, cor, tam, peso) { return '<text x="' + x + '" y="' + y + '" font-size="' + (tam || 3.9) + '" fill="' + (cor || TX) + '" text-anchor="' + (anc || 'start') + '" font-family="Poppins,sans-serif"' + (peso ? ' font-weight="' + peso + '"' : '') + '>' + t + '</text>'; }
    var api = {
      corte: function (x, y, w, h) { s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#' + id + 'h)" stroke="' + TX + '" stroke-width=".6"/>'); return api; },
      vista: function (x, y, w, h, qual) { var f = qual === 'frente' ? cFr : qual === 'gaveta' ? cGv : cCx; s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '" stroke="' + TX + '" stroke-width=".6"/>'); return api; },
      frente: function (x, y, w, h) { return api.vista(x, y, w, h, 'frente'); },
      poli: function (pts, qual) {
        var f = qual === 'corte' ? 'url(#' + id + 'h)' : qual === 'frente' ? cFr : qual === 'metal' ? 'url(#' + id + 'm)' : qual === 'plastico' ? '#7b7f84' : cCx;
        s.push('<path d="M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'Z" fill="' + f + '" stroke="' + (qual === 'metal' ? METL : TX) + '" stroke-width=".6" stroke-linejoin="round"/>'); return api;
      },
      metal: function (x, y, w, h) { s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx=".6" fill="url(#' + id + 'm)" stroke="' + METL + '" stroke-width=".5"/>'); return api; },
      vidro: function (x, y, w, h) { s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#dce9ee" stroke="#6f8fb6" stroke-width=".5"/>'); return api; },
      parede: function (x, y, w, h) { s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#' + id + 'p)" stroke="' + TX + '" stroke-width=".6"/>'); return api; },
      piso: function (x0, x1, y) { s.push('<path d="M' + x0 + ' ' + y + 'H' + x1 + '" stroke="' + TX + '" stroke-width="1.1"/>'); for (var x = x0 + 2; x < x1; x += 4) s.push('<path d="M' + x + ' ' + (y + .6) + 'l-2.5 3" stroke="' + TX + '" stroke-width=".35"/>'); return api; },
      luz: function (x, y, abre, alt) { s.push('<path d="M' + x + ' ' + y + 'L' + (x - abre) + ' ' + (y + alt) + 'H' + (x + abre) + 'Z" fill="url(#' + id + 'l)"/>'); return api; },
      fita: function (x, y, w) { s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1.4" rx=".5" fill="' + LED + '"/>'); return api; },
      linha: function (d, cor, w, tr) { s.push('<path d="' + d + '" fill="none" stroke="' + (cor || TX) + '" stroke-width="' + (w || 0.6) + '"' + (tr ? ' stroke-dasharray="' + tr + '"' : '') + ' stroke-linecap="round" stroke-linejoin="round"/>'); return api; },
      seta: function (x, y, dx, dy) {
        var l = Math.sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l, ex = x + dx, ey = y + dy;
        s.push('<path d="M' + x + ' ' + y + 'L' + ex + ' ' + ey + '" stroke="' + INK + '" stroke-width=".7"/><path d="M' + ex + ' ' + ey + 'L' + (ex - ux * 3 - uy * 1.6) + ' ' + (ey - uy * 3 + ux * 1.6) + 'L' + (ex - ux * 3 + uy * 1.6) + ' ' + (ey - uy * 3 - ux * 1.6) + 'Z" fill="' + INK + '"/>'); return api;
      },
      // nota: marcador redondo no ponto, linha em cotovelo e texto (1 ou 2 linhas) para o lado indicado
      nota: function (px, py, tx, ty, linhas, lado) {
        linhas = [].concat(linhas); lado = lado || (tx < px ? 'e' : 'd');
        var fim = lado === 'e' ? 4 : 116;
        s.push('<path d="M' + px + ' ' + py + 'L' + tx + ' ' + ty + 'H' + fim + '" fill="none" stroke="' + INK + '" stroke-width=".45"/><circle cx="' + px + '" cy="' + py + '" r="1.05" fill="' + INK + '" stroke="#fff" stroke-width=".45"/>');
        linhas.forEach(function (t, i) { s.push(txt(fim, i ? ty + 4.4 : ty - 1.3, t, lado === 'e' ? 'start' : 'end', i ? '#66717b' : TX, i ? 3.5 : 3.9, i ? null : 500)); });
        return api;
      },
      cotaH: function (x0, x1, y, t, embaixo) {
        s.push('<path d="M' + x0 + ' ' + y + 'H' + x1 + 'M' + (x0 - 1.2) + ' ' + (y + 1.2) + 'l2.4 -2.4M' + (x1 - 1.2) + ' ' + (y + 1.2) + 'l2.4 -2.4" stroke="' + cc + '" stroke-width=".45"/>');
        var curta = Math.abs(x1 - x0) < 8;
        s.push(txt(curta ? x1 + 1.6 : (x0 + x1) / 2, embaixo ? y + 4.4 : y - 1.3, t, curta ? 'start' : 'middle', cc, 3.6));
        return api;
      },
      cotaV: function (y0, y1, x, t, direita) {
        s.push('<path d="M' + x + ' ' + y0 + 'V' + y1 + 'M' + (x - 1.2) + ' ' + (y0 + 1.2) + 'l2.4 -2.4M' + (x - 1.2) + ' ' + (y1 + 1.2) + 'l2.4 -2.4" stroke="' + cc + '" stroke-width=".45"/>');
        var my = (y0 + y1) / 2, tx = direita ? x + 4 : x - 1.4;
        s.push('<text x="' + tx + '" y="' + my + '" font-size="3.6" fill="' + cc + '" text-anchor="middle" font-family="Poppins,sans-serif" transform="rotate(-90 ' + tx + ' ' + my + ')">' + t + '</text>');
        return api;
      },
      rotulo: function (x, y, t, anc) { s.push(txt(x, y, t, anc, '#8b939a', 3.4)); return api; },
      svg: function () { return '<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" class="md-svg">' + s.join('') + '</svg>'; }
    };
    return api;
  }

  // ------------------------------------------------------------------ desenhos
  var D = {};

  // corrediça telescópica: corte transversal pela lateral do móvel e da gaveta
  D.telescopica = function (d) {
    d.corte(8, 10, 10.8, 72).rotulo(13.4, 88, 'lateral', 'middle');
    d.metal(18.8, 36, 3.7, 27.6).metal(22.5, 39, 3.8, 21.6);
    d.vista(26.3, 24, 9, 50, 'gaveta').corte(35.3, 66, 28, 3.6).vista(35.3, 24, 28, 3, 'gaveta');
    d.cotaH(18.8, 26.3, 19, '12,5').cotaV(36, 63.6, 46, '46', true);
    d.nota(31, 30, 70, 16, ['lateral da gaveta'], 'd');
    d.nota(20.6, 44, 70, 34, ['perfil fixo', 'na lateral do móvel'], 'd');
    d.nota(24.4, 56, 70, 54, ['perfil móvel', 'na gaveta'], 'd');
    d.nota(52, 67.8, 70, 76, ['fundo em rasgo'], 'd');
    return d;
  };
  D.oculta = function (d) {
    d.corte(8, 10, 10.8, 72).rotulo(13.4, 88, 'lateral', 'middle');
    d.vista(21.8, 26, 9, 40, 'gaveta').corte(30.8, 58, 32, 3.6).vista(30.8, 26, 32, 3, 'gaveta');
    d.metal(21.8, 66, 16, 5).metal(18.8, 63, 3, 10);
    d.cotaH(18.8, 21.8, 20, '5');
    d.nota(26, 34, 70, 30, ['amortecimento', 'integrado'], 'd');
    d.nota(30, 68.5, 70, 70, ['corrediça oculta', 'sob a gaveta'], 'd');
    return d;
  };
  // dobradiça de caneco: planta (corte horizontal) na altura da dobradiça
  D.dobradica = function (d, o) {
    var tipo = o.dobradica || 'reta';
    var px = tipo === 'superCurva' ? 20.8 : (tipo === 'curva' ? 15.4 : 10);
    d.corte(10, 8, 10.8, 50).rotulo(15.4, 6, 'lateral', 'middle');
    d.frente(px, 58, 46, 10.8);
    var cx = px + 2.6;
    d.poli([[cx, 58], [cx + 21, 58], [cx + 21, 64.4], [cx, 64.4]], 'metal');
    d.metal(20.8, 38, 2.4, 14).poli([[23.2, 43], [cx + 15, 53], [cx + 15, 58], [cx + 8, 58], [23.2, 48.5]], 'metal');
    d.cotaH(cx, cx + 21, 74, 'Ø 35', true).cotaH(px, cx, 82, '3 a 6', true);
    d.nota(22, 41, 70, 26, ['calço na lateral'], 'd');
    d.nota(cx + 12, 61, 70, 50, ['caneco furado', 'na porta'], 'd');
    d.rotulo(116, 88, { reta: 'sobreposta · reta', curva: 'sobre divisória · curva', superCurva: 'embutida · super curva' }[tipo], 'end');
    return d;
  };
  // puxadores: corte vertical no topo da frente
  D.cava = function (d) {
    d.corte(6, 14, 108, 9).rotulo(8, 11, 'tampo ou travessa');
    d.corte(50, 23, 10.8, 22).poli([[30, 84], [30, 34], [37, 27], [41, 27], [41, 84]], 'frente');
    d.linha('M30 34L37 27', '#c0392b', 0.5, '1.6 1');
    d.cotaV(23, 27, 26, '25').cotaH(30, 41, 89, '18');
    d.nota(33.5, 30.5, 22, 50, ['cava 45°', 'na frente'], 'e');
    d.nota(55, 38, 70, 52, ['travessa recuada'], 'd');
    return d;
  };
  D.perfil = function (d) {
    d.corte(6, 14, 108, 9).frente(36, 38, 11, 48);
    d.poli([[34, 38], [49, 38], [49, 34], [36.5, 34], [36.5, 29], [34, 29]], 'metal');
    d.nota(42, 36, 70, 46, ['perfil de alumínio', 'no topo da frente'], 'd');
    return d;
  };
  D.passante = function (d) {
    d.corte(6, 18, 108, 10).frente(36, 40, 11, 46);
    d.linha('M41.5 28V40', '#c0392b', 0.45, '1.4 1');
    d.cotaV(28, 40, 56, '25', true);
    d.nota(36, 34, 24, 52, ['vão para', 'a mão'], 'e');
    d.nota(41.5, 64, 70, 64, ['porta passante'], 'd');
    return d;
  };
  D.alca = function (d, o) {
    var b = o.tipo === 'barra', y0 = b ? 18 : 32, y1 = b ? 74 : 60;
    d.frente(40, 6, 11, 80);
    d.poli([[40, y0], [30, y0], [30, y1], [40, y1], [40, y1 - 3], [33, y1 - 3], [33, y0 + 3], [40, y0 + 3]], 'metal');
    d.cotaV(y0 + 3, y1 - 3, 22, b ? 'barra' : 'entre furos');
    d.nota(31.5, 46, 70, 46, [b ? 'puxador barra' : 'puxador alça', 'parafusado por trás'], 'd');
    return d;
  };
  D.barra = function (d) { return D.alca(d, { tipo: 'barra' }); };
  D.botao = function (d) {
    d.frente(40, 6, 11, 80).metal(34, 44, 6, 4).poli([[26, 40.5], [34, 40.5], [34, 51.5], [26, 51.5]], 'metal');
    d.nota(30, 46, 70, 46, ['puxador botão', 'Ø 25 a 30 mm'], 'd');
    return d;
  };
  D.testeira = function (d) {
    d.corte(6, 14, 108, 9).frente(36, 40, 11, 46);
    d.poli([[34, 40], [49, 40], [49, 36], [53, 31], [51, 29.6], [46.5, 35.5], [34, 35.5]], 'metal');
    d.nota(49, 36, 70, 48, ['perfil 45°', 'a mão puxa por cima'], 'd');
    return d;
  };
  D.toque = function (d) {
    d.frente(30, 6, 11, 80).metal(41, 40, 11, 12).corte(52, 6, 10.8, 80);
    d.seta(10, 46, 16, 0);
    d.nota(46.5, 46, 70, 36, ['fecho toque', 'preso na lateral'], 'd');
    d.rotulo(4, 58, 'empurra');
    d.rotulo(4, 62.5, 'e abre');
    return d;
  };
  // iluminação: corte pelo fundo do armário, junto à parede
  D.led = function (d, o) {
    var emb = o.montagem !== 'sobreposto', pos = o.posicao || 'fundo';
    d.parede(4, 6, 12, 80).rotulo(10, 89, 'parede', 'middle');
    d.corte(16, 12, 4, 32);
    var by = 44;
    var lx = pos === 'fundo' ? 26 : pos === 'frente' ? 96 : 60;
    if (emb) d.poli([[16, by], [116, by], [116, by + 10.8], [lx + 7, by + 10.8], [lx + 7, by + 4.8], [lx, by + 4.8], [lx, by + 10.8], [16, by + 10.8]], 'corte');
    else d.corte(16, by, 100, 10.8);
    var ly = emb ? by + 10.8 : by + 14;
    if (emb) d.metal(lx + 0.3, by + 5, 6.4, 5.6); else d.metal(lx, by + 10.8, 7, 3.2);
    d.fita(lx + 0.6, ly - 1.4, 5.8).luz(lx + 3.5, ly, 14, 31);
    d.metal(46, by - 9, 12, 9).linha('M52 ' + by + 'C52 ' + (by + 3) + ' ' + (lx + 3.5) + ' ' + (by + 1) + ' ' + (lx + 3.5) + ' ' + (by + 5), '#555', 0.45);
    d.nota(52, by - 4.5, 70, 24, ['driver no armário', 'acesso pela porta'], 'd');
    d.nota(lx + 3.5, ly - 0.6, 70, 74, ['fita ' + (o.temperatura || 4000) + 'K', emb ? 'perfil embutido' : 'perfil sobreposto'], 'd');
    if (pos === 'fundo') d.cotaH(16, lx, by - 13, '20');
    return d;
  };
  // base
  D.rodape = function (d, o) {
    var r = Math.min(30, (o.recuo || 50) / 2);
    d.frente(10, 6, 9, 40).corte(19, 36, 90, 9.6);
    d.corte(19 + r, 45.6, 9, 32).piso(4, 116, 77.6);
    d.cotaH(19, 19 + r, 86, o.recuo || 50, false).cotaV(45.6, 77.6, 66, o.altura || 100, true);
    d.nota(23.5 + r, 62, 70, 58, ['rodapé recuado'], 'd');
    return d;
  };
  D.pes = function (d, o) {
    d.frente(10, 6, 9, 40).corte(19, 36, 90, 9.6);
    d.metal(40, 45.6, 9, 24).metal(36, 69.6, 17, 6).piso(4, 116, 75.6);
    d.cotaV(45.6, 75.6, 30, o.altura || 100);
    d.nota(44.5, 58, 70, 56, ['pé regulável', 'com saia na frente'], 'd');
    return d;
  };
  D.suspenso = function (d) {
    d.parede(104, 4, 12, 82).corte(16, 50, 88, 9.6).frente(8, 50, 8, 34).corte(16, 59.6, 9.6, 24);
    d.metal(94, 38, 10, 4).metal(94, 42, 3, 8);
    d.nota(98, 40, 40, 26, ['suporte oculto', 'na parede'], 'e');
    d.rotulo(18, 89, 'móvel suspenso');
    return d;
  };
  // fundo encaixado em rasgo (planta)
  D.fundo = function (d) {
    d.poli([[20, 8], [30.8, 8], [30.8, 70], [28.2, 70], [28.2, 82], [20, 82]], 'corte');
    d.corte(23.8, 30, 4.4, 44);
    d.linha('M30.8 70H108', TX, 0.6);
    d.cotaH(28.2, 30.8, 87, '10').cotaH(23.8, 28.2, 26, '6');
    d.nota(26, 50, 70, 46, ['fundo HDF 6 mm', 'em rasgo'], 'd');
    d.rotulo(36, 66, 'lateral (planta)');
    return d;
  };
  // prateleira regulável em pinos
  D.prateleira = function (d, o) {
    d.corte(16, 8, 10.8, 76);
    for (var y = 16; y < 80; y += 8) d.linha('M27 ' + y + 'h2', TX, 0.5);
    d.vista(26.8, 44, 76, 10.8);
    d.metal(26.8, 54.8, 5, 2.6);
    d.cotaH(92.8, 102.8, 40, o.recuo || 20);
    d.nota(29, 56, 70, 68, ['pino metálico', 'furos a cada 32 mm'], 'd');
    d.nota(64, 49, 70, 28, ['prateleira recuada'], 'd');
    return d;
  };
  // porta-temperos / fruteira: vista lateral do aramado de correr
  D.temperos = function (d, o) {
    var nc = Math.max(1, Math.min(4, o.cestos || 3));
    d.frente(8, 6, 8, 80).rotulo(12, 4.5, 'frente', 'middle');
    d.metal(18, 10, 2.6, 68).metal(60, 10, 2.6, 68).metal(18, 10, 44.6, 2.6);
    for (var k = 0; k < nc; k++) {
      var y = nc === 1 ? 70 : 72 - k * (52 / (nc - 1));
      d.linha('M22 ' + y + 'H58', METL, 1).linha('M22 ' + (y - 6) + 'H58', METL, 0.6).linha('M22 ' + y + 'V' + (y - 9) + 'M58 ' + y + 'V' + (y - 9), METL, 0.7);
    }
    d.metal(18, 78, 44, 3);
    d.nota(61.3, 30, 70, 20, ['quadro e cestos', 'aramado cromado'], 'd');
    d.nota(40, 79.5, 70, 74, ['corrediça', 'extração total'], 'd');
    return d;
  };
  D.fruteira = D.temperos;
  D.lixeira = function (d) {
    d.frente(8, 6, 8, 80);
    d.poli([[22, 24], [58, 24], [56, 74], [24, 74]], 'plastico');
    d.linha('M20 24H60', '#555', 1.6);
    d.metal(18, 76, 44, 3);
    d.nota(40, 48, 70, 40, ['cesto com aba', 'apoiado no quadro'], 'd');
    d.nota(40, 77.5, 70, 74, ['corrediça', 'extração total'], 'd');
    return d;
  };
  D.ripada = function (d, o) {
    var r = o.ripa || { largura: 20, espaco: 10, espessura: 9 };
    var k = 1.4, w = r.largura * k / 2, e = r.espaco * k / 2, h = Math.max(3, r.espessura * k / 2);
    d.frente(6, 52, 108, 9);
    for (var x = 10; x + w < 112; x += w + e) d.frente(x, 52 - h, w, h);
    d.cotaH(10, 10 + w, 52 - h - 4, r.largura).cotaH(10 + w, 10 + w + e, 52 - h - 11, r.espaco);
    d.nota(60, 56.5, 70, 74, ['frente com', 'ripas coladas'], 'd');
    d.rotulo(6, 88, 'planta');
    return d;
  };
  D.moldura = function (d) {
    d.frente(40, 6, 11, 80).frente(51, 6, 6, 16).frente(51, 70, 6, 16);
    d.nota(54, 14, 70, 22, ['quadro aplicado'], 'd');
    d.nota(45, 46, 70, 54, ['almofada lisa'], 'd');
    return d;
  };
  D.vidro = function (d) {
    d.metal(40, 6, 10, 22).metal(40, 64, 10, 22).vidro(43, 28, 4, 36);
    d.nota(45, 16, 70, 22, ['perfil de alumínio'], 'd');
    d.nota(45, 46, 70, 54, ['vidro canelado', '4 mm temperado'], 'd');
    return d;
  };

  var TITULOS = {
    telescopica: 'corrediça telescópica', oculta: 'corrediça oculta', dobradica: 'dobradiça de caneco',
    cava: 'puxador cava 45°', perfil: 'puxador perfil', passante: 'porta passante', alca: 'puxador alça', barra: 'puxador barra',
    botao: 'puxador botão', testeira: 'perfil 45° (testeira)', toque: 'abertura por toque', led: 'iluminação em LED',
    rodape: 'rodapé recuado', pes: 'pés reguláveis', suspenso: 'fixação suspensa', fundo: 'fundo encaixado',
    prateleira: 'prateleira regulável', temperos: 'porta-temperos', fruteira: 'fruteira', lixeira: 'lixeira embutida',
    ripada: 'frente ripada', moldura: 'frente com moldura', vidro: 'porta de vidro canelado'
  };

  function desenhar(chave, M, o, corCota) {
    var mats = M.spec.materiais || {};
    var d = Desenho({ frente: (mats.frente || {}).cor, caixa: (mats.caixa || {}).cor, gaveta: (mats.gaveta || {}).cor }, corCota);
    D[chave](d, o || {});
    return d.svg();
  }

  // Detalhes que valem para este móvel, em ordem de importância
  function doMovel(M, corCota) {
    var sp = M.spec, out = [];
    function add(chave, o) { if (D[chave] && !out.some(function (x) { return x.chave === chave; })) out.push({ chave: chave, titulo: TITULOS[chave], svg: desenhar(chave, M, o, corCota) }); }
    function tem(re) { return M.pecas.some(function (p) { return re.test(p.nome); }); }
    if (tem(/^Frente gaveta|^Frente porta-temperos|^Frente lixeira|^Frente fruteira/)) add(sp.gavetas && sp.gavetas.corredica === 'oculta' ? 'oculta' : 'telescopica');
    if (tem(/^Porta/)) add('dobradica', { dobradica: sp.frentes.montagem === 'embutida' ? 'superCurva' : 'reta' });
    add(sp.puxador.tipo, { tipo: sp.puxador.tipo });
    var est = (sp.frentes && sp.frentes.estilo) || 'lisa';
    if (est !== 'lisa') add(est, { ripa: sp.frentes.ripa });
    if (sp.led && sp.led.ativo && M.pecas.some(function (p) { return p.grupo === 'led'; })) add('led', { montagem: sp.led.tipo, temperatura: sp.led.temperatura, posicao: sp.led.posicao });
    (M.elementos || []).forEach(function (el) { if (el.tipo === 'temperos' || el.tipo === 'fruteira' || el.tipo === 'lixeira') add(el.tipo, { cestos: el.cestos }); });
    if (sp.base) add(sp.base.tipo, { recuo: sp.base.recuo, altura: sp.base.altura });
    if (tem(/^Fundo$/)) add('fundo');
    if (tem(/^Prateleira$/)) add('prateleira', { recuo: sp.prateleiras && sp.prateleiras.recuo });
    return out;
  }

  return { doMovel: doMovel, desenhar: desenhar, TITULOS: TITULOS, D: D };
});
