/*
 * marcê — relatório executivo em PRANCHAS (A4…A0 deitadas, com carimbo)
 *
 * gerar(M, opts) devolve um HTML "vivo": ele traz o spec do móvel e os scripts
 * do marcê, e monta as pranchas no navegador. A barra do topo troca folha,
 * visual, unidade e cor da cota sem voltar ao SketchUp. Os desenhos técnicos
 * saem em escala real (imprima em 100%, sem margens).
 *
 * opts: { imagens:{iso,topo}, versao, prancha:{folha,visual,unidade,corCota},
 *         projeto:{cliente,obra,etapa,revisao}, escritorio:{nome,responsavel,registro,email,contato,logo,cor} }
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarceRelatorio = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  function dep(n) {
    if (root && root[n]) return root[n];
    if (typeof require === 'function') return require('./' + { MarceEngine: 'engine', MarceRender: 'render', MarceNesting: 'nesting' }[n] + '.js');
    return null;
  }

  var FOLHAS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
  var LACO = 'M17 79C18 62 18 46 21 38C25 27 37 27 41 38C44 47 44 62 43 71C42 80 35 82 34 75C33 66 43 40 52 32C60 25 71 28 73 40C75 52 74 65 75 74C76 83 83 85 89 77';
  function logoSvg(fundo, traco) { return '<svg viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="' + fundo + '"/><path d="' + LACO + '" fill="none" stroke="' + traco + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cm(mm) { var v = Math.round(mm) / 10; return String(v).replace('.', ','); }
  function n1(v) { return Math.round(v * 10) / 10; }
  function dataHoje() { var a = new Date(); return ('0' + a.getDate()).slice(-2) + '/' + ('0' + (a.getMonth() + 1)).slice(-2) + '/' + a.getFullYear(); }

  // ------------------------------------------------------------ estilos
  var CSS = [
    '@font-face{font-family:Poppins;font-weight:400;src:url(fonts/poppins-400.woff2) format("woff2")}',
    '@font-face{font-family:Poppins;font-weight:500;src:url(fonts/poppins-500.woff2) format("woff2")}',
    '@font-face{font-family:Poppins;font-weight:600;src:url(fonts/poppins-600.woff2) format("woff2")}',
    '@font-face{font-family:"The Seasons";font-style:italic;font-weight:400;src:url(fonts/the-seasons-italic.woff2) format("woff2")}',
    '/*MARCE_FONTES*/',
    ':root{--t:#3e4b57;--m:#8b939a;--b:#e3d9d4;--rose:#d6b3ab;--ink:#a88a80;--tint:#f4e8e5;--fundo:#f5f1ee}',
    'body.neutro{--t:#1f1f1f;--m:#6b6b6b;--b:#d0d0d0;--rose:#9a9a9a;--ink:#555;--tint:#f2f2f2;--fundo:#e9e9e9}',
    '*{box-sizing:border-box}html,body{margin:0}body{background:var(--fundo);color:var(--t);font-family:Poppins,"Segoe UI",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.barra{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 18px;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--b);font-size:12px}',
    '.barra .marca{display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:-.02em;margin-right:6px}.barra .marca svg{width:26px;height:26px}.barra .marca i{font-style:normal;color:var(--rose)}',
    '.barra .grp{display:flex;align-items:center;gap:4px}.barra .grp>span{color:var(--m);margin-right:4px;text-transform:lowercase}',
    '.barra button{border:1px solid var(--b);background:#fff;border-radius:99px;padding:4px 11px;font:600 11.5px Poppins,sans-serif;color:var(--t);cursor:pointer;text-transform:lowercase}',
    '.barra button[data-f=folha]{text-transform:none}.barra button.ativo{background:var(--t);border-color:var(--t);color:#fff}.barra .pri{background:var(--t);color:#fff;border-color:var(--t);padding:7px 16px;margin-left:auto}',
    '.barra input[type=color]{width:28px;height:24px;border:1px solid var(--b);border-radius:6px;padding:1px;background:#fff}',
    '.barra .dica{flex-basis:100%;color:var(--m);font-size:11px}',
    '#pranchas{padding:22px 0 60px;display:flex;flex-direction:column;align-items:center;gap:22px}',
    '.folha{position:relative;background:#fff;box-shadow:0 10px 40px -12px rgba(62,75,87,.35);overflow:hidden;font-size:calc(var(--k)*2.75mm);line-height:1.4}',
    '.moldura{position:absolute;border:calc(var(--k)*.35mm) solid var(--t);display:flex;flex-direction:column}',
    '.area{flex:1;min-height:0;position:relative;padding:calc(var(--k)*5mm) calc(var(--k)*6mm) calc(var(--k)*3mm);display:flex;flex-direction:column;gap:calc(var(--k)*3mm);overflow:hidden}',
    '.carimbo{height:calc(var(--k)*27mm);border-top:calc(var(--k)*.35mm) solid var(--t);display:grid;grid-template-columns:1.25fr 1.2fr 1fr 1.35fr 1.25fr .55fr;font-size:calc(var(--k)*2.15mm)}',
    '.carimbo>div{padding:calc(var(--k)*2mm) calc(var(--k)*2.6mm);border-left:calc(var(--k)*.2mm) solid var(--b);display:flex;flex-direction:column;gap:calc(var(--k)*.6mm);min-width:0;overflow:hidden}.carimbo>div:first-child{border-left:0}',
    '.carimbo small{display:block;color:var(--m);font-size:.82em;text-transform:lowercase;letter-spacing:.04em;line-height:1.1}.carimbo b{font-weight:600}',
    '.carimbo .tit{justify-content:center}.carimbo .tit .lg{height:calc(var(--k)*8mm);display:flex;align-items:center;gap:calc(var(--k)*1.6mm);margin-bottom:calc(var(--k)*1mm)}.carimbo .tit .lg svg,.carimbo .tit .lg img{height:100%;width:auto;max-width:calc(var(--k)*30mm);object-fit:contain}',
    '.carimbo .tit .nome{font-size:1.75em;font-weight:600;letter-spacing:-.02em;line-height:1.05}.carimbo .tit .nome em{font-family:"The Seasons",Georgia,serif;font-weight:400;color:var(--ink)}',
    '.carimbo .kv{display:grid;grid-template-columns:auto 1fr;column-gap:calc(var(--k)*2mm);row-gap:calc(var(--k)*.5mm);align-content:start}.carimbo .kv small{padding-top:.15em}',
    '.carimbo .notas{color:var(--m);font-size:.92em;line-height:1.3}',
    '.carimbo .num{align-items:center;justify-content:center;text-align:center;background:var(--tint)}.carimbo .num b{font-size:3.4em;line-height:1;font-weight:600;letter-spacing:-.04em}.carimbo .num small{text-align:center}',
    '.ey{display:flex;align-items:center;gap:calc(var(--k)*2.5mm);font-size:calc(var(--k)*2.3mm);font-weight:600;letter-spacing:.14em;text-transform:lowercase;color:var(--ink);margin:0}.ey:before{content:"";width:calc(var(--k)*7mm);height:calc(var(--k)*.4mm);background:var(--ink)}',
    'h1{margin:0;font-size:calc(var(--k)*7mm);font-weight:600;letter-spacing:-.025em;line-height:1.1}h1 em{font-family:"The Seasons",Georgia,serif;font-weight:400;font-style:italic;color:var(--ink);letter-spacing:0}',
    'h2{margin:0;font-size:calc(var(--k)*3.4mm);font-weight:600;text-transform:lowercase;letter-spacing:-.01em}',
    '.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:calc(var(--k)*2mm)}.cards div{border:calc(var(--k)*.25mm) solid var(--b);border-radius:calc(var(--k)*2.5mm);padding:calc(var(--k)*1.6mm) calc(var(--k)*2.6mm)}.cards small{display:block;color:var(--m);font-size:.8em;text-transform:lowercase}.cards b{font-weight:600}',
    '.mats{display:flex;gap:calc(var(--k)*2.4mm);flex-wrap:wrap}.mat{display:flex;align-items:center;gap:calc(var(--k)*2mm)}.mat span{width:calc(var(--k)*7mm);height:calc(var(--k)*7mm);border-radius:calc(var(--k)*1.6mm);border:1px solid rgba(0,0,0,.1)}.mat .veio{background-image:repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 3px,rgba(0,0,0,.09) 3px 4px,rgba(255,255,255,.06) 4px 7px)}.mat small{display:block;color:var(--m);font-size:.78em;text-transform:lowercase}',
    '.duas{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1.25fr;gap:calc(var(--k)*4mm)}.duas figure{margin:0;display:flex;flex-direction:column;min-height:0}.duas .img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.duas img,.duas .img svg{max-width:100%;max-height:100%;width:auto;height:auto}',
    '.leg{display:flex;align-items:center;gap:calc(var(--k)*1.6mm);font-size:calc(var(--k)*2.3mm);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-top:calc(var(--k)*1.5mm)}.leg:before{content:"";width:calc(var(--k)*2.2mm);height:calc(var(--k)*2.2mm);border-radius:50%;background:var(--t)}.leg small{font-weight:400;color:var(--m);text-transform:none;letter-spacing:0;margin-left:calc(var(--k)*1mm)}',
    '.desenho-escala{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.desenho-escala .lg2{align-self:flex-start}',
    '.planta-det{display:grid;grid-template-rows:auto 1fr;gap:calc(var(--k)*3mm);flex:1;min-height:0}',
    '.dets{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--k)*2.5mm);align-content:start}.det{border:calc(var(--k)*.25mm) solid var(--b);border-radius:calc(var(--k)*2.5mm);padding:calc(var(--k)*2mm);display:grid;grid-template-columns:34% 1fr;gap:calc(var(--k)*2mm);font-size:.86em}.det svg{width:100%;height:auto}.det h3{margin:0 0 calc(var(--k)*1mm);font-size:1.08em;font-weight:600}.det table{border-collapse:collapse}.det td{padding:.1em 0;vertical-align:top}.det td:first-child{color:var(--m);padding-right:calc(var(--k)*1.5mm);text-transform:lowercase;white-space:nowrap}',
    '.col2{display:grid;grid-template-columns:1.25fr 1fr;gap:calc(var(--k)*5mm);flex:1;min-height:0}',
    'table.spec{width:100%;border-collapse:collapse;font-size:.92em}table.spec td{padding:calc(var(--k)*1.1mm) calc(var(--k)*1.5mm);border-top:calc(var(--k)*.2mm) solid #eee6e2;vertical-align:top}table.spec td:first-child{width:30%;color:var(--m);text-transform:lowercase}',
    'ul.conf{list-style:none;margin:0;padding:0;font-size:.9em}ul.conf li{display:flex;gap:calc(var(--k)*1.6mm);padding:calc(var(--k)*1mm) 0;border-top:calc(var(--k)*.2mm) solid #eee6e2}.ic{flex:none;width:calc(var(--k)*3mm);height:calc(var(--k)*3mm);border-radius:calc(var(--k)*.7mm);color:#fff;font-size:.72em;font-weight:700;display:grid;place-items:center;margin-top:.1em}.ic.erro{background:#9a5b53}.ic.aviso{background:var(--rose)}.ic.info{background:#4f6475}.ic.dica{background:#6b8a72}',
    'table.lista{width:100%;border-collapse:collapse;font-size:.86em}table.lista th{text-align:left;font-weight:600;color:var(--m);text-transform:lowercase;padding:calc(var(--k)*1mm) calc(var(--k)*1.2mm);border-bottom:calc(var(--k)*.3mm) solid var(--t)}table.lista td{padding:calc(var(--k)*.75mm) calc(var(--k)*1.2mm);border-bottom:calc(var(--k)*.2mm) solid #f0e9e6;white-space:nowrap}table.lista td.o{max-width:calc(var(--k)*78mm);overflow:hidden;text-overflow:ellipsis}table.lista td.n{text-align:right;font-variant-numeric:tabular-nums}table.lista tr.sep td{color:var(--ink);font-weight:600;text-transform:lowercase}',
    '.chapas{display:grid;grid-template-columns:repeat(4,1fr);gap:calc(var(--k)*3mm)}.chapas figure{margin:0}.chapas figcaption{font-size:.8em;color:var(--m);margin-bottom:calc(var(--k)*.6mm)}.chapas svg{width:100%;height:auto}',
    'ul.check{list-style:none;margin:0;padding:0;font-size:.92em}ul.check li{display:flex;gap:calc(var(--k)*1.8mm);padding:calc(var(--k)*1.1mm) 0;border-top:calc(var(--k)*.2mm) solid #eee6e2}ul.check li:before{content:"";width:calc(var(--k)*2.8mm);height:calc(var(--k)*2.8mm);border:calc(var(--k)*.35mm) solid var(--rose);border-radius:calc(var(--k)*.7mm);flex:none;margin-top:.15em}ul.check b{font-weight:600}',
    '.nota{color:var(--m);font-size:.82em}',
    '.desenho text{font-family:Poppins,sans-serif;fill:#66717b}.desenho .rotulo{fill:#3e4b57;font-weight:600}.desenho .piso{stroke:#b9b0a6;stroke-width:1.2;vector-effect:non-scaling-stroke}.desenho .cota line{stroke:#8f857d;stroke-width:.7;vector-effect:non-scaling-stroke}.desenho .abertura{fill:none;stroke-width:.8;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.8}.desenho .cuba-linha{stroke:#6f8fb6;stroke-width:1.4;stroke-dasharray:5 3;vector-effect:non-scaling-stroke}.desenho .cuba-txt{fill:#4d6f99}.desenho .tracejado{fill:none;stroke:#fff;stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}.desenho .rotulo-frente{fill:#fff;font-weight:600}.desenho .rotulo-claro{fill:#ddd}.desenho .alvo{display:none}',
    '.det line,.det rect,.det path{vector-effect:non-scaling-stroke}.det text{font-family:Poppins,sans-serif;fill:#66717b}',
    '@media print{body{background:#fff}.barra{display:none}#pranchas{padding:0;gap:0;zoom:1!important}.folha{box-shadow:none;break-after:page;page-break-after:always}.folha:last-child{break-after:auto}}'
  ].join('\n');

  // ------------------------------------------------------------ desenhos de detalhe
  function detSvg(w, h, inner) { return '<svg class="det-svg" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
  function dcH(x0, x1, y, txt) { return '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="#c0392b" stroke-width=".8"/><line x1="' + (x0 - 2) + '" y1="' + (y + 2) + '" x2="' + (x0 + 2) + '" y2="' + (y - 2) + '" stroke="#c0392b"/><line x1="' + (x1 - 2) + '" y1="' + (y + 2) + '" x2="' + (x1 + 2) + '" y2="' + (y - 2) + '" stroke="#c0392b"/><text x="' + n1((x0 + x1) / 2) + '" y="' + (y - 3) + '" font-size="8.5" text-anchor="middle" fill="#c0392b">' + txt + '</text>'; }
  function dcV(y0, y1, x, txt) { var my = n1((y0 + y1) / 2); return '<line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + y1 + '" stroke="#c0392b" stroke-width=".8"/><line x1="' + (x - 2) + '" y1="' + (y0 + 2) + '" x2="' + (x + 2) + '" y2="' + (y0 - 2) + '" stroke="#c0392b"/><line x1="' + (x - 2) + '" y1="' + (y1 + 2) + '" x2="' + (x + 2) + '" y2="' + (y1 - 2) + '" stroke="#c0392b"/><text x="' + (x - 4) + '" y="' + my + '" font-size="8.5" text-anchor="middle" fill="#c0392b" transform="rotate(-90 ' + (x - 4) + ' ' + my + ')">' + txt + '</text>'; }

  function detalhe(el) {
    var W = 150, H = 190, s = '', fw, fh;
    var linha = '#2b2b2b';
    if (el.tipo === 'temperos' || el.tipo === 'fruteira') {
      var e2 = Math.min(90 / el.frenteW, 150 / el.frenteH);
      fw = el.frenteW * e2; fh = el.frenteH * e2;
      var x0 = (W - fw) / 2 + 8, y0 = 14;
      s += '<rect x="' + n1(x0) + '" y="' + y0 + '" width="' + n1(fw) + '" height="' + n1(fh) + '" fill="#fff" stroke="' + linha + '"/>';
      for (var i = 0; i < el.cestos; i++) { var yy = y0 + fh * (i + 0.75) / el.cestos; s += '<rect x="' + n1(x0 + 5) + '" y="' + n1(yy - 10) + '" width="' + n1(fw - 10) + '" height="10" fill="none" stroke="#777" stroke-dasharray="2 2"/>'; }
      return detSvg(W, H, s + dcH(x0, x0 + fw, y0 + fh + 9, Math.round(el.frenteW)) + dcV(y0, y0 + fh, x0 - 8, Math.round(el.frenteH)));
    }
    if (el.tipo === 'lixeira') {
      var e3 = Math.min(110 / el.frenteW, 150 / el.frenteH);
      fw = el.frenteW * e3; fh = el.frenteH * e3;
      var x1 = (W - fw) / 2 + 6, y1 = 14, bh = el.alturaBalde * e3, bw = (fw - 14 - (el.baldes - 1) * 6) / el.baldes;
      s += '<rect x="' + n1(x1) + '" y="' + y1 + '" width="' + n1(fw) + '" height="' + n1(fh) + '" fill="#fff" stroke="' + linha + '"/>';
      for (var b = 0; b < el.baldes; b++) s += '<rect x="' + n1(x1 + 7 + b * (bw + 6)) + '" y="' + n1(y1 + fh - bh - 6) + '" width="' + n1(bw) + '" height="' + n1(bh) + '" fill="none" stroke="#555" stroke-dasharray="3 2"/>';
      s += '<text x="' + n1(x1 + fw / 2) + '" y="' + n1(y1 + fh - bh / 2) + '" font-size="8.5" text-anchor="middle">cesto ' + el.litros + ' L</text>';
      return detSvg(W, H, s + dcH(x1, x1 + fw, y1 + fh + 9, Math.round(el.frenteW)) + dcV(y1 + fh - bh - 6, y1 + fh - 6, x1 + fw + 10, Math.round(el.alturaBalde)));
    }
    if (el.tipo === 'interna') {
      var e4 = Math.min(118 / (el.corredica + 30), 140 / el.frenteH);
      var dw = el.corredica * e4, dh = el.frenteH * e4, ft = 18 * e4 + 2, x2 = 22, y2 = 18, ih = el.alturaInterna * e4;
      s += '<rect x="' + x2 + '" y="' + y2 + '" width="' + n1(ft) + '" height="' + n1(dh) + '" fill="#ddd" stroke="' + linha + '"/>';
      s += '<rect x="' + n1(x2 + ft + 2) + '" y="' + n1(y2 + 8) + '" width="' + n1(dw) + '" height="' + n1(dh - 14) + '" fill="none" stroke="' + linha + '"/>';
      s += '<rect x="' + n1(x2 + ft + 8) + '" y="' + n1(y2 + 11) + '" width="' + n1(dw - 12) + '" height="' + n1(ih) + '" fill="#f4f4f4" stroke="#888" stroke-dasharray="3 2"/>';
      s += '<text x="' + n1(x2 + ft + 2 + dw / 2) + '" y="' + n1(y2 + 11 + ih / 2 + 3) + '" font-size="8" text-anchor="middle">gaveta interna</text><text x="' + n1(x2 + ft + 2 + dw / 2) + '" y="' + n1(y2 + dh * 0.7) + '" font-size="8.5" text-anchor="middle">gavetão</text>';
      return detSvg(W, H, s + dcH(x2 + ft + 2, x2 + ft + 2 + dw, y2 + dh + 10, 'corrediça ' + el.corredica) + dcV(y2, y2 + dh, x2 - 8, Math.round(el.frenteH)) + dcV(y2 + 11, y2 + 11 + ih, x2 + ft + dw + 12, el.alturaInterna));
    }
    if (el.tipo === 'eletro') {
      var e5 = Math.min(110 / el.largura, 150 / el.altura);
      fw = el.largura * e5; fh = el.altura * e5;
      var x3 = (W - fw) / 2 + 8, y3 = 14;
      s += '<rect x="' + n1(x3) + '" y="' + y3 + '" width="' + n1(fw) + '" height="' + n1(fh) + '" fill="#f3f3f3" stroke="' + linha + '"/><rect x="' + n1(x3 + 6) + '" y="' + n1(y3 + 6) + '" width="' + n1(fw - 12) + '" height="' + n1(fh - 12) + '" rx="4" fill="none" stroke="#555" stroke-dasharray="3 2"/>';
      return detSvg(W, H, s + dcH(x3, x3 + fw, y3 + fh + 9, Math.round(el.largura)) + dcV(y3, y3 + fh, x3 - 8, Math.round(el.altura)));
    }
    return '';
  }

  function tr2(r, v) { return '<tr><td>' + esc(r) + '</td><td>' + v + '</td></tr>'; }

  // ------------------------------------------------------------ montagem das pranchas
  function montarPranchas(dados, est) {
    var E = dep('MarceEngine'), R = dep('MarceRender'), N = dep('MarceNesting');
    var spec = dados.spec;
    var M = E.calcular(spec);
    var d = M.dims;
    var dim = FOLHAS[est.folha] || FOLHAS.A4;
    var Wf = dim[0], Hf = dim[1], k = Wf / 297;
    var mE = 15 * k, mO = 7 * k, carH = 27 * k;
    var areaW = Wf - mE - mO - 12 * k, areaH = Hf - 2 * mO - carH - 8 * k;
    var amb = E.AMBIENTES[spec.ambiente] || E.AMBIENTES.seco;
    var tipoLabel = E.TIPOS[spec.tipo].label;
    var proj = dados.projeto || {}, escr = dados.escritorio || {};
    var neutro = est.visual === 'neutro';
    var paginas = [];

    function carimbo(num, total, escala) {
      var logo = escr.logo ? '<img src="' + esc(escr.logo) + '" alt="">' : logoSvg(neutro ? '#1f1f1f' : '#3e4b57', '#f5f1ee');
      return '<div class="carimbo">' +
        '<div class="tit"><div class="lg">' + logo + '</div><small>' + esc(proj.etapa || 'detalhamento de marcenaria') + '</small><div class="nome">' + esc(spec.nome) + '</div></div>' +
        '<div class="kv"><small>cliente</small><span>' + esc(proj.cliente || '—') + '</span><small>obra</small><span>' + esc(proj.obra || '—') + '</span><small>ambiente</small><span>' + esc(amb.label) + '</span><small>móvel</small><span>' + esc(tipoLabel) + '</span></div>' +
        '<div class="kv"><small>data</small><span>' + dataHoje() + '</span><small>escala</small><span>' + (escala ? '1/' + escala : 'indicada') + '</span><small>folha</small><span>' + esc(est.folha) + '</span><small>revisão</small><span>' + esc(proj.revisao || 'R00') + '</span></div>' +
        '<div class="notas"><small>notas</small>Conferir medidas no local antes da produção. Cotas em ' + ({ m: 'metros', cm: 'centímetros', mm: 'milímetros' }[est.unidade]) + '. Imprimir em 100% (escala real). Detalhamento a ser revisado com o marceneiro.</div>' +
        '<div class="kv"><small>escritório</small><span><b>' + esc(escr.nome || '—') + '</b></span><small>resp.</small><span>' + esc(escr.responsavel || '—') + '</span><small>registro</small><span>' + esc(escr.registro || '—') + '</span><small>contato</small><span>' + esc([escr.email, escr.contato].filter(Boolean).join(' · ') || '—') + '</span></div>' +
        '<div class="num"><b>' + ('0' + num).slice(-2) + '</b><small>de ' + ('0' + total).slice(-2) + '</small></div></div>';
    }
    function pagina(conteudo, escala) { paginas.push({ c: conteudo, e: escala }); }
    function cabeca(ey, titulo) { return '<p class="ey">' + ey + '</p>' + (titulo ? '<h1>' + titulo + '</h1>' : ''); }

    // 01 · resumo
    var img = dados.imagens || {};
    var persp = img.iso ? '<img src="' + img.iso + '" alt="perspectiva">' : R.perspectiva(M, { aberto: false });
    var mats = [['frentes', 'frente'], ['caixaria', 'caixa']];
    if (spec.caixaInternaBranca) mats.push(['caixaria interna', 'caixaInterna']);
    mats.push(['gavetas', 'gaveta'], ['fundos', 'fundo']);
    pagina(cabeca('resumo', esc(tipoLabel) + ' · <em>' + esc(spec.nome) + '</em>') +
      '<div class="cards"><div><small>ambiente</small><b>' + esc(amb.label) + '</b></div><div><small>medidas (l × p × a)</small><b>' + cm(d.L) + ' × ' + cm(d.D) + ' × ' + cm(d.H) + ' cm</b></div><div><small>peças</small><b>' + M.resumo.pecas + '</b></div><div><small>colunas · vãos</small><b>' + M.resumo.colunas + ' · ' + M.resumo.vaos + '</b></div><div><small>frentes</small><b>' + M.resumo.portas + ' portas · ' + M.resumo.gavetas + ' gavetas</b></div></div>' +
      '<div class="mats">' + mats.map(function (m) { var mt = spec.materiais[m[1]]; return '<div class="mat"><span class="' + (mt.veio ? 'veio' : '') + '" style="background-color:' + esc(mt.cor) + '"></span><div><small>' + m[0] + '</small>' + esc(mt.nome) + (mt.marca && mt.marca !== 'Genérico' ? ' · ' + esc(mt.marca) : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="duas"><figure><div class="img">' + persp + '</div><div class="leg">perspectiva</div></figure><figure><div class="img">' + R.frontal(M, { rotulo: ' ' }) + '</div><div class="leg">vista frontal <small>(acabamentos)</small></div></figure></div>');

    // 02 · vista frontal cotada (escala real)
    var fT = R.frontalTecnico(M, { areaW: areaW, areaH: areaH - 12 * k, unidade: est.unidade, corCota: est.corCota });
    pagina(cabeca('vista frontal') + '<div class="desenho-escala">' + fT.svg + '<div class="leg">vista frontal <small>escala 1/' + fT.escala + '</small></div></div>', fT.escala);

    // 03 · planta baixa + detalhes
    var els = (M.elementos || []).slice();
    (M.eletros || []).forEach(function (e) { els.push({ tipo: 'eletro', nome: 'Nicho ' + e.tipo.toLowerCase(), col: e.col, largura: e.largura, altura: e.altura, prof: e.prof, recomendado: e.recomendado, texto: e.obs }); });
    var cards = els.map(function (el) {
      var t = '<table>' + tr2('coluna', el.col + 1);
      if (el.tipo === 'eletro') t += tr2('interno', Math.round(el.largura) + ' × ' + Math.round(el.altura) + ' mm') + tr2('padrão', esc(el.recomendado));
      else {
        t += tr2('frente', Math.round(el.frenteW) + ' × ' + Math.round(el.frenteH) + ' mm');
        if (el.cestos) t += tr2('interior', el.cestos + ' cesto(s) aramado(s)');
        if (el.litros) t += tr2('cesto', el.baldes + ' × ~' + el.litros + ' L no total');
        if (el.alturaInterna) t += tr2('interna', el.alturaInterna + ' mm · recuo 15 mm');
        t += tr2('ferragem', 'corrediça ' + el.corredica + ' mm' + (el.corredicaInterna ? ' + ' + el.corredicaInterna : ''));
      }
      t += tr2('obs.', esc(el.texto || '')) + '</table>';
      return '<div class="det">' + detalhe(el) + '<div><h3>' + esc(el.nome) + '</h3>' + t + '</div></div>';
    });
    var alturaPlanta = els.length ? areaH * 0.55 : areaH - 12 * k;
    var pT = R.plantaTecnica(M, { areaW: areaW, areaH: alturaPlanta, unidade: est.unidade, corCota: est.corCota, escala: fT.escala <= 25 && els.length ? null : null });
    var porPagina = 3;
    pagina(cabeca('planta baixa' + (els.length ? ' e detalhes' : '')) + '<div class="planta-det"><div class="desenho-escala">' + pT.svg + '<div class="leg">planta baixa <small>escala 1/' + pT.escala + '</small></div></div>' +
      (els.length ? '<div class="dets">' + cards.slice(0, porPagina).join('') + '</div>' : '') + '</div>', pT.escala);
    for (var ci = porPagina; ci < cards.length; ci += 6) pagina(cabeca('detalhamento dos elementos') + '<div class="dets">' + cards.slice(ci, ci + 6).join('') + '</div>');

    // 04 · especificação + conferência
    var pux = E.PUXADORES[spec.puxador.tipo] + (spec.puxador.tipo === 'alca' ? ' ' + spec.puxador.comprimento + ' mm' : '');
    var base = { rodape: 'Rodapé recuado ' + spec.base.altura + ' mm (recuo ' + spec.base.recuo + ' mm)', pes: 'Pés reguláveis com saia (' + spec.base.altura + ' mm)', suspenso: 'Suspenso — fixação oculta na parede', nenhum: 'Sobre base existente na obra' }[spec.base.tipo];
    var fer = M.ferragens.map(function (f) { return f.qtd + (f.un === 'm' || f.un === 'm²' ? ' ' + f.un : '') + ' × ' + esc(f.item); }).join('<br>');
    var ic = { erro: '!', aviso: '!', info: 'i', dica: '✓' };
    pagina(cabeca('especificação e conferência técnica') + '<div class="col2"><table class="spec">' +
      tr2('tipo', esc(tipoLabel)) + tr2('ambiente', esc(amb.label)) +
      tr2('medidas totais', cm(d.L) + ' × ' + cm(d.D) + ' × ' + cm(d.H) + ' cm') +
      tr2('materiais sugeridos', 'Caixaria: ' + esc(amb.caixa) + '<br>Frentes: ' + esc(amb.frentes) + '<br>Fundo: ' + esc(amb.fundo)) +
      tr2('materiais escolhidos', 'Frentes: ' + esc(E.nomeMaterial(spec.materiais, 'frente')) + '<br>Caixaria: ' + esc(E.nomeMaterial(spec.materiais, 'caixa'))) +
      tr2('espessuras', 'Caixaria ' + spec.esp.caixa + ' · frentes ' + spec.esp.frente + ' · fundo ' + spec.esp.fundo + ' · gavetas ' + spec.esp.gaveta + ' mm') +
      tr2('portas', spec.frentes.montagem === 'embutida' ? 'Embutidas — dobradiça super curva' : 'Sobrepostas — reta na lateral externa, curva na divisória') +
      tr2('puxador', esc(pux)) + tr2('base', esc(base)) + tr2('ferragens', fer) +
      '</table><div><h2 style="margin-bottom:' + n1(2 * k) + 'mm">conferência técnica</h2><ul class="conf">' +
      M.avisos.map(function (a) { return '<li><span class="ic ' + a.nivel + '">' + ic[a.nivel] + '</span><span>' + esc(a.msg) + '</span></li>'; }).join('') + '</ul></div></div>');

    // 05 · lista de peças (paginada)
    var linhas = E.listaDePecas(M.pecas, spec.materiais);
    var linhaMm = 5.15 * k, cabMm = 18 * k;
    var porPag = Math.max(8, Math.floor((areaH - cabMm) / linhaMm));
    var cab = '<table class="lista"><thead><tr><th>nº</th><th>peça</th><th>qtd</th><th>compr.</th><th>larg.</th><th>esp.</th><th>material</th><th>fita</th><th>obs.</th></tr></thead><tbody>';
    var blocos = [], atual = [], eAnt = null, usadas = 0;
    linhas.forEach(function (l) {
      var extra = l.e !== eAnt ? 1 : 0;
      if (usadas + 1 + extra > porPag) { blocos.push(atual); atual = []; usadas = 0; eAnt = null; extra = 1; }
      if (l.e !== eAnt) { atual.push('<tr class="sep"><td colspan="9">chapas de ' + l.e + ' mm</td></tr>'); eAnt = l.e; usadas++; }
      atual.push('<tr><td class="n">' + l.n + '</td><td>' + esc(l.nome) + '</td><td class="n">' + l.qtd + '</td><td class="n">' + Math.round(l.c) + '</td><td class="n">' + Math.round(l.l) + '</td><td class="n">' + l.e + '</td><td>' + esc(l.material) + '</td><td>' + (l.fitaC + l.fitaL ? l.fitaC + 'C ' + l.fitaL + 'L' : '—') + '</td><td class="o">' + esc(l.obs) + '</td></tr>');
      usadas++;
    });
    if (atual.length) blocos.push(atual);
    blocos.forEach(function (b, i) {
      pagina(cabeca('lista de peças' + (blocos.length > 1 ? ' · ' + (i + 1) + '/' + blocos.length : '')) + cab + b.join('') + '</tbody></table>' + (i === blocos.length - 1 ? '<p class="nota">Medidas em mm, brutas (sem desconto de fita). Fita: lados no comprimento (C) e na largura (L).</p>' : ''));
    });

    // 06 · estimativa e plano de corte
    var estC = E.estimativaChapas(M.pecas, spec.chapa);
    var plano = N.otimizar(N.pecasDoModelo(M.pecas, spec.materiais), spec.chapa);
    var figs = [];
    plano.forEach(function (g) { g.chapas.forEach(function (ch, i) { figs.push('<figure><figcaption>' + esc(g.material) + ' ' + g.esp + ' mm · chapa ' + (i + 1) + '/' + g.chapas.length + ' · ' + Math.round(ch.aproveitamento * 100) + '%</figcaption>' + R.chapaSvg(g, ch, spec.chapa) + '</figure>'); }); });
    var tab = '<table class="lista" style="width:auto"><thead><tr><th>espessura</th><th>área (m²)</th><th>chapas ' + (spec.chapa.comprimento / 1000).toFixed(2).replace('.', ',') + ' × ' + (spec.chapa.largura / 1000).toFixed(2).replace('.', ',') + ' m (80%)</th></tr></thead><tbody>' + estC.map(function (e) { return '<tr><td>' + e.esp + ' mm</td><td class="n">' + e.area.toFixed(2).replace('.', ',') + '</td><td class="n">' + e.chapas + '</td></tr>'; }).join('') + '</tbody></table>';
    var fi = 0, primeira = true;
    do {
      var nFig = primeira ? 4 : 8;
      pagina(cabeca('estimativa de chapas' + (primeira ? '' : ' · continuação')) + (primeira ? tab + '<p class="nota">Plano de corte sugerido (serra ' + spec.chapa.serra + ' mm, refilo ' + spec.chapa.refilo + ' mm). Peças com veio não giram.</p>' : '') + '<div class="chapas">' + figs.slice(fi, fi + nFig).join('') + '</div>');
      fi += nFig; primeira = false;
    } while (fi < figs.length);

    // 07 · verificações e checklist
    var ver = E.VERIFICACOES[spec.ambiente] || E.VERIFICACOES.seco;
    pagina(cabeca('verificações e checklist de entrega') + '<div class="col2" style="grid-template-columns:1fr 1fr"><div><h2>verificações · ' + esc(amb.label.toLowerCase()) + '</h2><p class="nota">' + esc(ver.titulo.toLowerCase()) + '</p><ul class="check">' + ver.itens.map(function (i) { return '<li><span>' + esc(i) + '</span></li>'; }).join('') + '</ul></div><div><h2>checklist de entrega</h2><ul class="check">' + E.CHECKLIST.map(function (c) { return '<li><span><b>' + esc(c[0]) + '</b> — ' + esc(c[1]) + '</span></li>'; }).join('') + '</ul></div></div>');

    var total = paginas.length;
    return paginas.map(function (p, i) {
      return '<section class="folha" style="width:' + Wf + 'mm;height:' + Hf + 'mm;--k:' + k + '"><div class="moldura" style="left:' + n1(mE) + 'mm;top:' + n1(mO) + 'mm;right:' + n1(mO) + 'mm;bottom:' + n1(mO) + 'mm"><div class="area">' + p.c + '</div>' + carimbo(i + 1, total, p.e) + '</div></section>';
    }).join('');
  }

  // Monta e liga a barra (roda dentro do relatório aberto no navegador)
  function montar(dados) {
    var doc = root.document;
    var est = Object.assign({ folha: 'A4', visual: 'marce', unidade: 'm', corCota: '#c0392b' }, dados.prancha || {});
    function desenhar() {
      var dim = FOLHAS[est.folha];
      doc.body.className = est.visual === 'neutro' ? 'neutro' : '';
      doc.getElementById('pagina').textContent = '@page{size:' + dim[0] + 'mm ' + dim[1] + 'mm;margin:0}';
      doc.getElementById('pranchas').innerHTML = montarPranchas(dados, est);
      ajustarZoom();
      Array.prototype.forEach.call(doc.querySelectorAll('[data-f]'), function (b) { b.classList.toggle('ativo', b.getAttribute('data-v') === String(est[b.getAttribute('data-f')])); });
      doc.getElementById('dica-papel').textContent = 'Na impressão: papel ' + est.folha + ' deitado, margens "nenhuma", escala 100% — assim os desenhos saem na escala indicada.';
    }
    function ajustarZoom() {
      var dim = FOLHAS[est.folha];
      var px = dim[0] * 96 / 25.4;
      var z = Math.min(1, (root.innerWidth - 40) / px);
      doc.getElementById('pranchas').style.zoom = z;
    }
    doc.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-f]');
      if (!b) return;
      est[b.getAttribute('data-f')] = b.getAttribute('data-v');
      desenhar();
    });
    doc.getElementById('cor-cota').addEventListener('change', function (ev) { est.corCota = ev.target.value; desenhar(); });
    doc.getElementById('cor-cota').value = est.corCota;
    root.addEventListener('resize', ajustarZoom);
    desenhar();
  }

  // HTML "vivo" do relatório
  function gerar(M, opts) {
    opts = opts || {};
    var spec = M.spec;
    var dados = { spec: spec, imagens: opts.imagens || null, versao: opts.versao || '', prancha: opts.prancha || spec.prancha || {}, projeto: opts.projeto || {}, escritorio: opts.escritorio || {} };
    var json = JSON.stringify(dados).replace(/</g, '\\u003c');
    function grupo(campo, rotulo, ops) { return '<div class="grp"><span>' + rotulo + '</span>' + ops.map(function (o) { return '<button data-f="' + campo + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
    var barra = '<div class="barra"><span class="marca">' + logoSvg('#3e4b57', '#f5f1ee') + '<span>marc<i>ê</i></span></span>' +
      grupo('folha', 'prancha', Object.keys(FOLHAS).map(function (f) { return [f, f]; })) +
      grupo('visual', 'visual', [['marce', 'identidade marcê'], ['neutro', 'neutro']]) +
      grupo('unidade', 'cotas', [['m', 'metros'], ['cm', 'cm'], ['mm', 'mm']]) +
      '<div class="grp"><span>cor da cota</span><input type="color" id="cor-cota" value="#c0392b"></div>' +
      '<button class="pri" onclick="window.print()">imprimir / salvar pdf</button><span class="dica" id="dica-papel"></span></div>';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório executivo · ' + esc(spec.nome) + '</title><style>' + CSS + '</style><style id="pagina"></style></head><body>' +
      barra + '<div id="pranchas"></div>' +
      '<script data-marce="engine.js" src="engine.js"></script><script data-marce="nesting.js" src="nesting.js"></script><script data-marce="render.js" src="render.js"></script><script data-marce="report.js" src="report.js"></script>' +
      '<script>window.__MARCE__=' + json + ';MarceRelatorio.montar(window.__MARCE__);</script></body></html>';
  }

  return { gerar: gerar, montar: montar, montarPranchas: montarPranchas, detalhe: detalhe, FOLHAS: FOLHAS };
});
