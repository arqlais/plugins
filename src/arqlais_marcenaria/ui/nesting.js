/*
 * Marcenaria Paramétrica — plano de corte
 * Otimizador MaxRects (Best Short Side Fit) com espessura de serra,
 * refilo e respeito ao veio (peças com veio não giram).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarcNesting = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function Bin(w, h) {
    this.w = w; this.h = h;
    this.livres = [{ x: 0, y: 0, w: w, h: h }];
    this.usados = [];
  }

  Bin.prototype.achar = function (w, h, podeGirar) {
    var melhor = null;
    var self = this;
    function testa(rw, rh, rot) {
      for (var i = 0; i < self.livres.length; i++) {
        var f = self.livres[i];
        if (rw <= f.w + 1e-6 && rh <= f.h + 1e-6) {
          var curto = Math.min(f.w - rw, f.h - rh);
          var longo = Math.max(f.w - rw, f.h - rh);
          if (!melhor || curto < melhor.curto || (curto === melhor.curto && longo < melhor.longo)) {
            melhor = { x: f.x, y: f.y, w: rw, h: rh, rot: rot, curto: curto, longo: longo };
          }
        }
      }
    }
    testa(w, h, false);
    if (podeGirar && w !== h) testa(h, w, true);
    return melhor;
  };

  Bin.prototype.colocar = function (r) {
    var novos = [];
    for (var i = 0; i < this.livres.length; i++) {
      var f = this.livres[i];
      if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) { novos.push(f); continue; }
      if (r.x > f.x) novos.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w) novos.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h });
      if (r.y > f.y) novos.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h) novos.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) });
    }
    // remove retângulos contidos em outros
    var limpos = [];
    for (var a = 0; a < novos.length; a++) {
      var contido = false;
      for (var b = 0; b < novos.length; b++) {
        if (a === b) continue;
        var A = novos[a], B = novos[b];
        if (A.x >= B.x && A.y >= B.y && A.x + A.w <= B.x + B.w && A.y + A.h <= B.y + B.h) {
          if (A.x === B.x && A.y === B.y && A.w === B.w && A.h === B.h && a < b) continue;
          contido = true; break;
        }
      }
      if (!contido && novos[a].w > 0.5 && novos[a].h > 0.5) limpos.push(novos[a]);
    }
    this.livres = limpos;
    this.usados.push(r);
  };

  /**
   * pecas: [{c, l, e, mat, material, veio, nome, id}]
   * chapa: {comprimento, largura, refilo, serra}
   * retorno: [{mat, material, esp, w, h, chapas:[{itens:[], aproveitamento}], naoCabem:[]}]
   */
  function otimizar(pecas, chapa) {
    var porMat = {};
    pecas.forEach(function (p) {
      var k = p.material + '|' + p.e;
      (porMat[k] = porMat[k] || { mat: p.mat, material: p.material, esp: p.e, pecas: [] }).pecas.push(p);
    });
    var W = chapa.comprimento - 2 * chapa.refilo;
    var Hh = chapa.largura - 2 * chapa.refilo;
    var s = chapa.serra;
    var res = [];
    Object.keys(porMat).forEach(function (k) {
      var g = porMat[k];
      var lista = g.pecas.slice().sort(function (a, b) {
        var aa = a.c * a.l, bb = b.c * b.l;
        if (bb !== aa) return bb - aa;
        return Math.max(b.c, b.l) - Math.max(a.c, a.l);
      });
      var bins = [];
      var naoCabem = [];
      lista.forEach(function (p) {
        var w = p.c + s, h = p.l + s;
        var podeGirar = !p.veio;
        var feito = false;
        for (var i = 0; i < bins.length && !feito; i++) {
          var r = bins[i].achar(w, h, podeGirar);
          if (r) { r.peca = p; bins[i].colocar(r); feito = true; }
        }
        if (!feito) {
          var nb = new Bin(W + s, Hh + s);
          var r2 = nb.achar(w, h, podeGirar);
          if (r2) { r2.peca = p; nb.colocar(r2); bins.push(nb); }
          else naoCabem.push(p);
        }
      });
      var chapas = bins.map(function (b) {
        var area = 0;
        var itens = b.usados.map(function (r) {
          area += r.peca.c * r.peca.l;
          return {
            x: r.x + chapa.refilo, y: r.y + chapa.refilo,
            w: r.rot ? r.peca.l : r.peca.c, h: r.rot ? r.peca.c : r.peca.l,
            rot: r.rot, nome: r.peca.nome, id: r.peca.id, c: r.peca.c, l: r.peca.l
          };
        });
        return { itens: itens, aproveitamento: area / (chapa.comprimento * chapa.largura) };
      });
      res.push({ mat: g.mat, material: g.material, esp: g.esp, w: chapa.comprimento, h: chapa.largura, chapas: chapas, naoCabem: naoCabem });
    });
    var ordem = ['caixa', 'frente', 'gaveta', 'fundo', 'fundoGaveta'];
    res.sort(function (a, b) { return ordem.indexOf(a.mat) - ordem.indexOf(b.mat); });
    return res;
  }

  // Expande as peças do modelo (uma entrada por unidade) para o otimizador
  function pecasDoModelo(pecas, materiais) {
    return pecas.filter(function (p) { return p.cortavel && p.corte; }).map(function (p) {
      return { id: p.id, nome: p.nome, mat: p.mat, material: (materiais[p.mat] || {}).nome || p.mat,
        c: p.corte.c, l: p.corte.l, e: p.corte.e, veio: p.veio };
    });
  }

  return { otimizar: otimizar, pecasDoModelo: pecasDoModelo };
});
