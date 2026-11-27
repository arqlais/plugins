/*
 * marcê — relatório executivo (HTML pronto para imprimir/salvar em PDF)
 * Identidade: areia, grafite e rosé · Poppins + The Seasons Italic.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarceRelatorio = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  function dep(n) { return (root && root[n]) || (typeof require === 'function' ? require('./' + { MarceEngine: 'engine', MarceRender: 'render', MarceNesting: 'nesting' }[n] + '.js') : null); }

  var LOGO = '<svg viewBox="0 0 100 100" width="34" height="34"><rect width="100" height="100" rx="24" fill="#3e4b57"/><path d="M17 79C18 62 18 46 21 38C25 27 37 27 41 38C44 47 44 62 43 71C42 80 35 82 34 75C33 66 43 40 52 32C60 25 71 28 73 40C75 52 74 65 75 74C76 83 83 85 89 77" fill="none" stroke="#f5f1ee" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cm(mm) { var v = Math.round(mm) / 10; return String(v).replace('.', ','); }
  function n1(v) { return Math.round(v * 10) / 10; }

  var CSS = [
    '@font-face{font-family:Poppins;font-weight:400;src:url(fonts/poppins-400.woff2) format("woff2")}',
    '@font-face{font-family:Poppins;font-weight:500;src:url(fonts/poppins-500.woff2) format("woff2")}',
    '@font-face{font-family:Poppins;font-weight:600;src:url(fonts/poppins-600.woff2) format("woff2")}',
    '@font-face{font-family:"The Seasons";font-style:italic;font-weight:400;src:url(fonts/the-seasons-italic.woff2) format("woff2")}',
    '/*MARCE_FONTES*/',
    ':root{--bg:#f5f1ee;--t:#3e4b57;--m:#8b939a;--b:#ebe1dc;--rose:#d6b3ab;--ink:#a88a80;--tint:#f4e8e5}',
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font-family:Poppins,"Segoe UI",system-ui,sans-serif;font-size:11.5px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.folha{max-width:1060px;margin:0 auto;padding:34px 38px 60px}',
    '.topo{display:flex;align-items:center;gap:12px;margin-bottom:26px}.topo .marca{font-weight:600;letter-spacing:-.03em;font-size:15px}.topo .marca i{font-style:normal;color:var(--rose)}.topo .acoes{margin-left:auto}',
    '.btn{border:1px solid var(--b);background:#fff;border-radius:99px;padding:8px 18px;font:600 12px Poppins,sans-serif;color:var(--t);cursor:pointer;text-transform:lowercase}',
    '.eyebrow{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:lowercase;color:var(--ink);margin:0 0 8px}.eyebrow:before{content:"";width:26px;height:1.5px;background:var(--ink)}',
    'h1{font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1.15;margin:0}h1 em{font-family:"The Seasons","Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:400;color:var(--ink);font-size:1.12em;letter-spacing:0}',
    '.sub{color:var(--m);margin:6px 0 20px}',
    '.cartoes{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}.cartoes div{background:#fff;border:1px solid var(--b);border-radius:14px;padding:10px 14px}.cartoes small{display:block;color:var(--m);font-size:10px;text-transform:lowercase;letter-spacing:.06em}.cartoes b{font-size:13px;font-weight:600}',
    'section{background:#fff;border:1px solid var(--b);border-radius:18px;padding:20px 22px;margin-bottom:16px;box-shadow:0 1px 2px rgba(62,75,87,.04),0 10px 30px -12px rgba(62,75,87,.12);break-inside:avoid}',
    'section.solto{break-inside:auto}',
    'h2{font-size:15px;font-weight:600;margin:0 0 12px;text-transform:lowercase;letter-spacing:-.01em}',
    '.mats{display:flex;gap:10px;flex-wrap:wrap}.mat{display:flex;align-items:center;gap:10px;border:1px solid var(--b);border-radius:14px;padding:8px 14px 8px 8px;min-width:200px}.mat span{width:38px;height:38px;border-radius:10px;border:1px solid rgba(0,0,0,.08)}.mat small{display:block;color:var(--m);font-size:9.5px;text-transform:lowercase;letter-spacing:.08em}.mat .veio{background-image:repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 3px,rgba(0,0,0,.09) 3px 4px,rgba(255,255,255,.06) 4px 7px)}',
    '.duas{display:grid;grid-template-columns:1.4fr 1fr;gap:12px}.duas figure{margin:0;border:1px solid var(--b);border-radius:14px;padding:10px;background:#fbf8f6}.duas figcaption,.rot{font-size:10px;letter-spacing:.08em;text-transform:lowercase;color:var(--ink);font-weight:600;margin-bottom:6px}.duas img,.duas svg{width:100%;height:auto;max-height:320px;display:block}',
    '.vista svg{width:100%;height:auto;max-height:430px;display:block}.vista + .vista{margin-top:16px}.nota{color:var(--m);font-size:10.5px;margin-top:8px}',
    '.elementos{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.el{display:grid;grid-template-columns:150px 1fr;gap:14px;border:1px solid var(--b);border-radius:14px;padding:12px;break-inside:avoid}.el svg{width:100%;height:auto;max-height:190px}.el h3{margin:0 0 6px;font-size:12.5px;font-weight:600}.el table td{padding:2px 0;vertical-align:top}.el table td:first-child{color:var(--m);width:78px;text-transform:lowercase}',
    'table.spec{width:100%;border-collapse:collapse}table.spec td{padding:7px 10px;border-top:1px solid #f1e9e5;vertical-align:top}table.spec td:first-child{width:170px;color:var(--m);text-transform:lowercase}table.spec tr:first-child td{border-top:0}',
    'table.lista{width:100%;border-collapse:collapse;font-size:10.5px}table.lista th{text-align:left;font-weight:600;color:var(--m);text-transform:lowercase;padding:6px 8px;background:#fbf8f6;border-bottom:1px solid var(--b)}table.lista td{padding:5px 8px;border-bottom:1px solid #f4eeeb}table.lista td.n{text-align:right;font-variant-numeric:tabular-nums}table.lista tr.sep td{color:var(--ink);font-weight:600;background:#fdfbfa;text-transform:lowercase}',
    'ul.conf{list-style:none;margin:0;padding:0}ul.conf li{display:flex;gap:10px;padding:6px 0;border-top:1px solid #f4eeeb}ul.conf li:first-child{border-top:0}.ic{flex:none;width:15px;height:15px;border-radius:4px;color:#fff;font-size:9.5px;font-weight:700;display:grid;place-items:center;margin-top:1px}.ic.erro{background:#9a5b53}.ic.aviso{background:#d6b3ab}.ic.info{background:#4f6475}.ic.dica{background:#6b8a72}',
    'ul.check{list-style:none;margin:0;padding:0}ul.check li{display:flex;gap:10px;padding:6px 0;border-top:1px solid #f4eeeb}ul.check li:first-child{border-top:0}ul.check li:before{content:"";width:13px;height:13px;border:1.5px solid var(--rose);border-radius:4px;flex:none;margin-top:2px}ul.check b{font-weight:600}',
    '.chapas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.chapas figure{margin:0;border:1px solid var(--b);border-radius:12px;padding:8px}.chapas figcaption{font-size:9.5px;color:var(--m);margin-bottom:4px}.chapas svg{width:100%;height:auto}',
    '.rodape{color:var(--m);font-size:10px;text-align:center;margin-top:24px}',
    '.desenho text{font-family:Poppins,sans-serif;fill:#66717b}.desenho .rotulo{fill:#3e4b57;font-weight:600}.desenho .piso{stroke:#b9b0a6;stroke-width:1.2;vector-effect:non-scaling-stroke}.desenho .cota line{stroke:#8f857d;stroke-width:.7;vector-effect:non-scaling-stroke}.desenho .cota.fina line{stroke:#aaa197}.desenho .abertura{fill:none;stroke-width:.8;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.8}.desenho .cuba-linha{stroke:#6f8fb6;stroke-width:1.4;stroke-dasharray:5 3;vector-effect:non-scaling-stroke}.desenho .cuba-txt{fill:#4d6f99}.desenho .cuba-proj{fill:rgba(111,143,182,.12);stroke:#6f8fb6;stroke-dasharray:5 3;stroke-width:1;vector-effect:non-scaling-stroke}.desenho .eixo{stroke:#c0392b;stroke-width:1;stroke-dasharray:8 3 2 3;vector-effect:non-scaling-stroke}.desenho .eixo-txt{fill:#b03a2e}.desenho .ponto-hidr{fill:none;stroke:#c0392b;stroke-width:1.4;vector-effect:non-scaling-stroke}.desenho .cuba-planta{fill:rgba(111,143,182,.14);stroke:#6f8fb6;stroke-dasharray:5 3;stroke-width:1.1;vector-effect:non-scaling-stroke}.desenho .giro{fill:none;stroke:#8a7f77;stroke-width:.8;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}.desenho .pedra{fill:none;stroke:#9c988f;stroke-width:1;stroke-dasharray:10 4;vector-effect:non-scaling-stroke}.desenho .parede{fill:#d9d3cb}.desenho .tracejado{fill:none;stroke:#fff;stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}.desenho .rotulo-frente{fill:#fff;font-weight:600}.desenho .rotulo-claro{fill:#ddd}.desenho .alvo{display:none}',
    '.det line,.det rect,.det path{vector-effect:non-scaling-stroke}.det text{font-family:Poppins,sans-serif;fill:#66717b}',
    '@media print{body{background:#fff}.folha{padding:0;max-width:none}.acoes{display:none}section{box-shadow:none}@page{size:A4;margin:12mm}}',
    '@media (max-width:760px){.cartoes{grid-template-columns:repeat(2,1fr)}.duas,.elementos{grid-template-columns:1fr}.chapas{grid-template-columns:1fr 1fr}.el{grid-template-columns:110px 1fr}}'
  ].join('\n');

  // ------------------------------------------------ desenhos de detalhe
  function detSvg(w, h, inner) { return '<svg class="det" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
  function cotaH(x0, x1, y, txt) { return '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="#8f857d" stroke-width=".8"/><line x1="' + x0 + '" y1="' + (y - 3) + '" x2="' + x0 + '" y2="' + (y + 3) + '" stroke="#8f857d"/><line x1="' + x1 + '" y1="' + (y - 3) + '" x2="' + x1 + '" y2="' + (y + 3) + '" stroke="#8f857d"/><text x="' + n1((x0 + x1) / 2) + '" y="' + (y + 11) + '" font-size="9" text-anchor="middle">' + txt + '</text>'; }
  function cotaV(y0, y1, x, txt) { var my = n1((y0 + y1) / 2); return '<line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + y1 + '" stroke="#8f857d" stroke-width=".8"/><line x1="' + (x - 3) + '" y1="' + y0 + '" x2="' + (x + 3) + '" y2="' + y0 + '" stroke="#8f857d"/><line x1="' + (x - 3) + '" y1="' + y1 + '" x2="' + (x + 3) + '" y2="' + y1 + '" stroke="#8f857d"/><text x="' + (x - 5) + '" y="' + my + '" font-size="9" text-anchor="middle" transform="rotate(-90 ' + (x - 5) + ' ' + my + ')">' + txt + '</text>'; }

  function detalhe(el, corFrente) {
    var W = 150, H = 190;
    var fw, fh, s = '';
    if (el.tipo === 'temperos' || el.tipo === 'fruteira') {
      var esc2 = Math.min(90 / el.frenteW, 150 / el.frenteH);
      fw = el.frenteW * esc2; fh = el.frenteH * esc2;
      var x0 = (W - fw) / 2 + 8, y0 = 12;
      s += '<rect x="' + n1(x0) + '" y="' + y0 + '" width="' + n1(fw) + '" height="' + n1(fh) + '" fill="' + corFrente + '" fill-opacity=".25" stroke="#5e5550"/>';
      for (var i = 0; i < el.cestos; i++) {
        var yy = y0 + fh * (i + 0.75) / el.cestos;
        s += '<rect x="' + n1(x0 + 5) + '" y="' + n1(yy - 10) + '" width="' + n1(fw - 10) + '" height="10" fill="none" stroke="#8a9aa8" stroke-dasharray="2 2"/>';
      }
      s += cotaH(x0, x0 + fw, y0 + fh + 8, Math.round(el.frenteW)) + cotaV(y0, y0 + fh, x0 - 8, Math.round(el.frenteH));
      return detSvg(W, H, s);
    }
    if (el.tipo === 'lixeira') {
      var e3 = Math.min(110 / el.frenteW, 150 / el.frenteH);
      fw = el.frenteW * e3; fh = el.frenteH * e3;
      var x1 = (W - fw) / 2 + 8, y1 = 12;
      s += '<rect x="' + n1(x1) + '" y="' + y1 + '" width="' + n1(fw) + '" height="' + n1(fh) + '" fill="' + corFrente + '" fill-opacity=".25" stroke="#5e5550"/>';
      var bh = el.alturaBalde * e3;
      var bw = (fw - 14 - (el.baldes - 1) * 6) / el.baldes;
      for (var b = 0; b < el.baldes; b++) s += '<rect x="' + n1(x1 + 7 + b * (bw + 6)) + '" y="' + n1(y1 + fh - bh - 6) + '" width="' + n1(bw) + '" height="' + n1(bh) + '" fill="none" stroke="#5e5550" stroke-dasharray="3 2"/>';
      s += '<text x="' + n1(x1 + fw / 2) + '" y="' + n1(y1 + fh - bh / 2) + '" font-size="9" text-anchor="middle">cesto ' + el.litros + ' L</text>';
      s += cotaH(x1, x1 + fw, y1 + fh + 8, Math.round(el.frenteW)) + cotaV(y1 + fh - bh - 6, y1 + fh - 6, x1 + fw + 10, Math.round(el.alturaBalde));
      return detSvg(W, H, s);
    }
    if (el.tipo === 'interna') {
      var e4 = Math.min(118 / (el.corredica + 30), 140 / el.frenteH);
      var dw = el.corredica * e4, dh = el.frenteH * e4, ft = 18 * e4 + 2;
      var x2 = 22, y2 = 18;
      s += '<rect x="' + x2 + '" y="' + y2 + '" width="' + n1(ft) + '" height="' + n1(dh) + '" fill="' + corFrente + '" stroke="#5e5550"/>';
      s += '<rect x="' + n1(x2 + ft + 2) + '" y="' + n1(y2 + 8) + '" width="' + n1(dw) + '" height="' + n1(dh - 14) + '" fill="none" stroke="#5e5550"/>';
      var ih = el.alturaInterna * e4;
      s += '<rect x="' + n1(x2 + ft + 8) + '" y="' + n1(y2 + 11) + '" width="' + n1(dw - 12) + '" height="' + n1(ih) + '" fill="#efe5e1" stroke="#a88a80" stroke-dasharray="3 2"/>';
      s += '<text x="' + n1(x2 + ft + 2 + dw / 2) + '" y="' + n1(y2 + 11 + ih / 2 + 3) + '" font-size="8.5" text-anchor="middle">gaveta interna</text>';
      s += '<text x="' + n1(x2 + ft + 2 + dw / 2) + '" y="' + n1(y2 + dh * 0.7) + '" font-size="9" text-anchor="middle">gavetão</text>';
      s += cotaH(x2 + ft + 2, x2 + ft + 2 + dw, y2 + dh + 8, 'corrediça ' + el.corredica);
      s += cotaV(y2, y2 + dh, x2 - 8, 'frente ' + Math.round(el.frenteH));
      s += cotaV(y2 + 11, y2 + 11 + ih, x2 + ft + dw + 12, el.alturaInterna);
      return detSvg(W, H, s);
    }
    if (el.tipo === 'eletro') {
      var e5 = Math.min(110 / el.largura, 150 / el.altura);
      fw = el.largura * e5; fh = el.altura * e5;
      var x3 = (W - fw) / 2 + 8, y3 = 12;
      s += '<rect x="' + n1(x3) + '" y="' + y3 + '" width="' + n1(fw) + '" height="' + n1(fh) + '" fill="#efe5e1" stroke="#5e5550"/>';
      s += '<rect x="' + n1(x3 + 6) + '" y="' + n1(y3 + 6) + '" width="' + n1(fw - 12) + '" height="' + n1(fh - 12) + '" rx="4" fill="#3e4b57" fill-opacity=".85"/>';
      s += cotaH(x3, x3 + fw, y3 + fh + 8, Math.round(el.largura)) + cotaV(y3, y3 + fh, x3 - 8, Math.round(el.altura));
      return detSvg(W, H, s);
    }
    return '';
  }

  function linhaTabela(rot, val) { return '<tr><td>' + esc(rot) + '</td><td>' + val + '</td></tr>'; }

  // ------------------------------------------------ gerador
  function gerar(M, opts) {
    opts = opts || {};
    var E = dep('MarceEngine'), R = dep('MarceRender'), N = dep('MarceNesting');
    var spec = M.spec, d = M.dims;
    var agora = new Date();
    var data = ('0' + agora.getDate()).slice(-2) + '/' + ('0' + (agora.getMonth() + 1)).slice(-2) + '/' + agora.getFullYear() + ' ' + ('0' + agora.getHours()).slice(-2) + ':' + ('0' + agora.getMinutes()).slice(-2);
    var amb = E.AMBIENTES[spec.ambiente];
    var tipoLabel = E.TIPOS[spec.tipo].label;
    var linhas = E.listaDePecas(M.pecas, spec.materiais);
    var est = E.estimativaChapas(M.pecas, spec.chapa);
    var nomeMat = function (k) { return E.nomeMaterial(spec.materiais, k); };
    var corF = spec.materiais.frente.cor;

    var h = [];
    h.push('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório executivo · ' + esc(spec.nome) + '</title><style>' + CSS + '</style></head><body><div class="folha">');
    h.push('<div class="topo">' + LOGO + '<span class="marca">marc<i>ê</i></span><span class="acoes"><button class="btn" onclick="window.print()">imprimir / salvar pdf</button></span></div>');
    h.push('<p class="eyebrow">relatório executivo</p><h1>' + esc(tipoLabel) + ' · <em>' + esc(spec.nome) + '</em></h1>');
    h.push('<p class="sub">Gerado pelo marcê em ' + data + ' para o marceneiro. Confirme sempre as medidas na obra antes de produzir.</p>');
    h.push('<div class="cartoes"><div><small>ambiente</small><b>' + esc(amb.label) + '</b></div><div><small>medidas (L × P × A)</small><b>' + cm(d.L) + ' × ' + cm(d.D) + ' × ' + cm(d.H) + ' cm</b></div><div><small>peças</small><b>' + M.resumo.pecas + '</b></div><div><small>colunas · vãos</small><b>' + M.resumo.colunas + ' · ' + M.resumo.vaos + '</b></div><div><small>frentes</small><b>' + M.resumo.portas + ' portas · ' + M.resumo.gavetas + ' gavetas</b></div></div>');

    // materiais
    var mats = [['frentes', 'frente'], ['caixaria', 'caixa']];
    if (spec.caixaInternaBranca) mats.push(['caixaria interna', 'caixaInterna']);
    mats.push(['gavetas', 'gaveta'], ['fundos', 'fundo']);
    h.push('<section><h2>materiais</h2><div class="mats">' + mats.map(function (m) {
      var mt = spec.materiais[m[1]];
      return '<div class="mat"><span class="' + (mt.veio ? 'veio' : '') + '" style="background-color:' + esc(mt.cor) + '"></span><div><small>' + m[0] + '</small>' + esc(mt.nome) + '<br><small style="letter-spacing:0;text-transform:none">' + esc(mt.marca || '') + '</small></div></div>';
    }).join('') + '</div></section>');

    // perspectivas
    var img = opts.imagens || {};
    var persp1 = img.iso ? '<img src="' + img.iso + '" alt="perspectiva">' : R.perspectiva(M, { aberto: false });
    var persp2 = img.topo ? '<img src="' + img.topo + '" alt="vista superior">' : R.perspectiva(M, { aberto: true });
    h.push('<section><h2>perspectivas do modelo</h2><div class="duas"><figure><figcaption>perspectiva</figcaption>' + persp1 + '</figure><figure><figcaption>' + (img.topo ? 'vista superior (interior)' : 'aberto (portas e gavetas)') + '</figcaption>' + persp2 + '</figure></div></section>');

    // vistas
    h.push('<section class="solto"><h2>vistas</h2><div class="vista"><p class="rot">elevação frontal cotada</p>' + R.frontal(M, { cotas: 'completo', rotulo: 'Frente 1' }) + '</div>');
    h.push('<div class="vista"><p class="rot">planta cotada</p>' + R.planta(M, { cotas: 'completo' }) + '</div>');
    h.push('<p class="nota">Cotas em mm. ' + (M.cuba ? 'Em azul, a cuba (projeção) locada e cotada; em vermelho, o eixo hidráulico (centro da cuba). ' : '') + 'Linhas tracejadas nas portas indicam o lado da dobradiça; na planta, o giro das portas e a extração das gavetas.</p></section>');

    // detalhamento
    var els = (M.elementos || []).slice();
    (M.eletros || []).forEach(function (e) { els.push({ tipo: 'eletro', nome: 'Nicho ' + e.tipo.toLowerCase(), col: e.col, largura: e.largura, altura: e.altura, prof: e.prof, recomendado: e.recomendado, texto: e.obs }); });
    if (els.length) {
      h.push('<section><h2>detalhamento dos elementos</h2><div class="elementos">');
      els.forEach(function (el) {
        var t = '<table>';
        t += linhaTabela('coluna', el.col + 1);
        if (el.tipo === 'eletro') {
          t += linhaTabela('interno', Math.round(el.largura) + ' × ' + Math.round(el.altura) + ' mm (prof. ' + Math.round(el.prof) + ')');
          t += linhaTabela('padrão', esc(el.recomendado));
        } else {
          t += linhaTabela('frente', Math.round(el.frenteW) + ' × ' + Math.round(el.frenteH) + ' mm');
          if (el.cestos) t += linhaTabela('interior', el.cestos + ' cesto(s) aramado(s) cromado(s)');
          if (el.litros) t += linhaTabela('cesto', el.baldes + ' × tampa basculante · ~' + el.litros + ' L');
          if (el.alturaInterna) t += linhaTabela('interna', 'altura ' + el.alturaInterna + ' mm · folga de 15 mm para a mão');
          t += linhaTabela('ferragem', 'corrediça de extração total ' + el.corredica + ' mm' + (el.corredicaInterna ? ' + ' + el.corredicaInterna + ' mm (interna)' : ''));
        }
        t += linhaTabela('observação', esc(el.texto || ''));
        t += '</table>';
        h.push('<div class="el">' + detalhe(el, corF) + '<div><h3>' + esc(el.nome) + '</h3>' + t + '</div></div>');
      });
      h.push('</div></section>');
    }

    // especificação
    var pux = E.PUXADORES[spec.puxador.tipo] + (spec.puxador.tipo === 'alca' ? ' ' + spec.puxador.comprimento + ' mm' : '') + (spec.puxador.tipo === 'cava' ? ' (usinada na porta)' : '');
    var hinge = spec.frentes.montagem === 'embutida' ? 'De abrir, embutidas — dobradiça super curva' : 'De abrir, sobrepostas — dobradiça reta nas laterais externas, curva nas divisórias';
    var base = { rodape: 'Rodapé recuado de ' + spec.base.altura + ' mm (recuo ' + spec.base.recuo + ' mm)', pes: 'Pés reguláveis com saia de rodapé (' + spec.base.altura + ' mm)', suspenso: 'Suspenso — fixação oculta na parede' + (spec.elevacao ? ' (a ' + cm(spec.elevacao) + ' cm do piso)' : ''), nenhum: 'Sobre sóculo/base já existente no projeto (não faz parte da marcenaria)' }[spec.base.tipo];
    var esps = 'Caixaria ' + spec.esp.caixa + ' mm · portas ' + spec.esp.frente + ' mm · fundo ' + spec.esp.fundo + ' mm ' + (spec.fundo.tipo === 'encaixado' ? 'encaixado' : spec.fundo.tipo === 'nenhum' ? '(sem fundo)' : 'sobreposto') + ' · gavetas ' + spec.esp.gaveta + ' mm · prateleiras em vão ≤ 80 cm';
    var fer = M.ferragens.map(function (f) { return f.qtd + (f.un === 'm' || f.un === 'm²' ? ' ' + f.un : '') + ' × ' + esc(f.item); }).join('<br>');
    h.push('<section><h2>especificação</h2><table class="spec">' +
      linhaTabela('tipo', esc(tipoLabel) + (spec.tipo === 'personalizado' && spec.composicao ? ' — ' + esc(E.COMPOSICOES[spec.composicao]) : '')) +
      linhaTabela('ambiente', esc(amb.label)) +
      linhaTabela('medidas totais', cm(d.L) + ' cm × ' + cm(d.D) + ' cm × ' + cm(d.H) + ' cm (largura × profundidade × altura)') +
      linhaTabela('materiais sugeridos', 'Caixaria em ' + esc(amb.caixa) + '<br>Portas e frentes em ' + esc(amb.frentes) + '<br>Fundo em ' + esc(amb.fundo)) +
      linhaTabela('materiais escolhidos', 'Frentes: ' + esc(nomeMat('frente')) + '<br>Caixaria: ' + esc(nomeMat('caixa')) + (spec.caixaInternaBranca ? '<br>Caixaria interna: ' + esc(nomeMat('caixaInterna')) : '')) +
      linhaTabela('espessuras', esps) +
      linhaTabela('portas', hinge) +
      linhaTabela('puxador', esc(pux)) +
      linhaTabela('ferragem', (spec.puxador.tipo === 'toque' ? 'Dobradiças sem amortecedor + fecho toque' : 'Dobradiças com amortecedor') + ' · corrediças ' + (spec.gavetas.corredica === 'oculta' ? 'ocultas com amortecedor' : 'telescópicas') + ' nas gavetas') +
      linhaTabela('base', esc(base)) +
      linhaTabela('ferragens (quantidades)', fer) +
      '</table></section>');

    // conferência
    var ic = { erro: '!', aviso: '!', info: 'i', dica: '✓' };
    h.push('<section><h2>conferência técnica</h2><ul class="conf">' + M.avisos.map(function (a) { return '<li><span class="ic ' + a.nivel + '">' + ic[a.nivel] + '</span><span>' + esc(a.msg) + '</span></li>'; }).join('') + '</ul></section>');

    // lista de peças
    var lt = '<table class="lista"><thead><tr><th>nº</th><th>peça</th><th>qtd</th><th>compr. (mm)</th><th>larg. (mm)</th><th>esp. (mm)</th><th>material</th><th>fita</th><th>obs.</th></tr></thead><tbody>';
    var eAnt = null;
    linhas.forEach(function (l) {
      if (l.e !== eAnt) { lt += '<tr class="sep"><td colspan="9">chapas de ' + l.e + ' mm</td></tr>'; eAnt = l.e; }
      lt += '<tr><td class="n">' + l.n + '</td><td>' + esc(l.nome) + '</td><td class="n">' + l.qtd + '</td><td class="n">' + Math.round(l.c) + '</td><td class="n">' + Math.round(l.l) + '</td><td class="n">' + l.e + '</td><td>' + esc(l.material) + '</td><td>' + (l.fitaC + l.fitaL ? l.fitaC + 'C ' + l.fitaL + 'L' : '—') + '</td><td>' + esc(l.obs) + '</td></tr>';
    });
    lt += '</tbody></table><p class="nota">Medidas brutas das peças como modeladas (sem desconto de fita de borda). Fita: quantidade de lados no comprimento (C) e na largura (L). Peças curvas e usinadas aparecem pelo retângulo envolvente.</p>';
    h.push('<section class="solto"><h2>lista de peças</h2>' + lt + '</section>');

    // chapas
    var plano = N.otimizar(N.pecasDoModelo(M.pecas, spec.materiais), spec.chapa);
    var tc = '<table class="lista"><thead><tr><th>espessura</th><th>área (m²)</th><th>chapas ' + cm(spec.chapa.comprimento / 10) + ' × ' + cm(spec.chapa.largura / 10) + ' m (80% de aproveitamento)</th></tr></thead><tbody>' +
      est.map(function (e) { return '<tr><td>' + e.esp + ' mm</td><td class="n">' + e.area.toFixed(2).replace('.', ',') + '</td><td class="n">' + e.chapas + '</td></tr>'; }).join('') + '</tbody></table>';
    var figs = '';
    plano.forEach(function (g) { g.chapas.forEach(function (ch, i) { figs += '<figure><figcaption>' + esc(g.material) + ' ' + g.esp + ' mm · chapa ' + (i + 1) + '/' + g.chapas.length + ' · ' + Math.round(ch.aproveitamento * 100) + '%</figcaption>' + R.chapaSvg(g, ch, spec.chapa) + '</figure>'; }); });
    h.push('<section class="solto"><h2>estimativa de chapas</h2>' + tc + '<div class="chapas">' + figs + '</div><p class="nota">Plano de corte sugerido (serra ' + spec.chapa.serra + ' mm, refilo ' + spec.chapa.refilo + ' mm). Peças com veio não giram. O marceneiro pode otimizar no software de corte dele.</p></section>');

    // verificações e checklist
    var ver = E.VERIFICACOES[spec.ambiente] || E.VERIFICACOES.seco;
    h.push('<section><h2>verificações · ' + esc(amb.label.toLowerCase()) + '</h2><p class="rot" style="margin-bottom:8px">' + esc(ver.titulo.toLowerCase()) + '</p><ul class="check">' + ver.itens.map(function (i) { return '<li><span>' + esc(i) + '</span></li>'; }).join('') + '</ul></section>');
    h.push('<section><h2>checklist de entrega</h2><ul class="check">' + E.CHECKLIST.map(function (c) { return '<li><span><b>' + esc(c[0]) + '</b> — ' + esc(c[1]) + '</span></li>'; }).join('') + '</ul></section>');

    h.push('<p class="rodape">Medidas de referência: guia de marcenaria do marcê. Detalhamento para ser revisado com o marceneiro e conferido em obra. · marcê ' + esc(opts.versao || '') + '</p>');
    h.push('</div></body></html>');
    return h.join('');
  }

  return { gerar: gerar, detalhe: detalhe };
});
