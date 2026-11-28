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
    if (typeof require === 'function') return require('./' + { MarceEngine: 'engine', MarceRender: 'render', MarceNesting: 'nesting', MarceDetalhes: 'detalhes' }[n] + '.js');
    return null;
  }

  var ESC_PRANCHA = [10, 20, 25, 50, 75, 100, 200, 250, 500];
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
    'ul.conf{list-style:none;margin:0;padding:0;font-size:.9em}ul.conf li{display:flex;gap:calc(var(--k)*1.6mm);padding:calc(var(--k)*1mm) 0;border-top:calc(var(--k)*.2mm) solid #eee6e2}.ic{flex:none;width:calc(var(--k)*3.2mm);height:calc(var(--k)*3.2mm);border-radius:calc(var(--k)*.8mm);color:#fff;display:grid;place-items:center;margin-top:.05em;padding:calc(var(--k)*.45mm)}.ic.erro{background:#9a5b53}.ic.aviso{background:var(--rose)}.ic.info{background:#4f6475}.ic.dica{background:#6b8a72}',
    'table.lista{width:100%;border-collapse:collapse;font-size:.86em}table.lista th{text-align:left;font-weight:600;color:var(--m);text-transform:lowercase;padding:calc(var(--k)*1mm) calc(var(--k)*1.2mm);border-bottom:calc(var(--k)*.3mm) solid var(--t)}table.lista td{padding:calc(var(--k)*.75mm) calc(var(--k)*1.2mm);border-bottom:calc(var(--k)*.2mm) solid #f0e9e6;white-space:nowrap}table.lista td.o{max-width:calc(var(--k)*78mm);overflow:hidden;text-overflow:ellipsis}table.lista td.n{text-align:right;font-variant-numeric:tabular-nums}table.lista tr.sep td{color:var(--ink);font-weight:600;text-transform:lowercase}',
    '.chapas{display:grid;grid-template-columns:repeat(4,1fr);gap:calc(var(--k)*3mm)}.chapas figure{margin:0}.chapas figcaption{font-size:.8em;color:var(--m);margin-bottom:calc(var(--k)*.6mm)}.chapas svg{width:100%;height:auto}',
    'ul.check{list-style:none;margin:0;padding:0;font-size:.92em}ul.check li{display:flex;gap:calc(var(--k)*1.8mm);padding:calc(var(--k)*1.1mm) 0;border-top:calc(var(--k)*.2mm) solid #eee6e2}ul.check li:before{content:"";width:calc(var(--k)*2.8mm);height:calc(var(--k)*2.8mm);border:calc(var(--k)*.35mm) solid var(--rose);border-radius:calc(var(--k)*.7mm);flex:none;margin-top:.15em}ul.check b{font-weight:600}',
    '.nota{color:var(--m);font-size:.82em}',
    '.fr-baixo{display:grid;gap:calc(var(--k)*3mm);min-height:0}.cortes{display:flex;gap:calc(var(--k)*3mm);min-width:0;align-items:stretch}.corte{flex:1;min-width:0;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.corte .img{min-height:0;display:flex;align-items:center;justify-content:center}',
    '.leg .bal{display:inline-grid;place-items:center;width:calc(var(--k)*4.2mm);height:calc(var(--k)*4.2mm);border:calc(var(--k)*.3mm) solid var(--t);border-radius:50%;font-size:.86em;letter-spacing:0;margin-right:calc(var(--k)*.4mm)}.leg.sem:before{display:none}',
    '.simb{border:calc(var(--k)*.25mm) solid var(--b);border-radius:calc(var(--k)*2.5mm);padding:calc(var(--k)*2.2mm) calc(var(--k)*3mm);align-self:end}.simb h2{margin-bottom:calc(var(--k)*1.4mm)}.simb ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--k)*1mm) calc(var(--k)*3mm);font-size:.8em;line-height:1.2}.simb li{display:flex;align-items:center;gap:calc(var(--k)*1.6mm)}.simb svg{flex:none;width:calc(var(--k)*9mm);height:calc(var(--k)*6mm)}',
    '.det h3 .bal{display:inline-grid;place-items:center;width:1.7em;height:1.7em;border:calc(var(--k)*.3mm) solid var(--t);border-radius:50%;font-size:.78em;margin-right:.4em;vertical-align:middle}',
    '.ic svg{width:100%;height:100%;display:block}',
    '.dt{flex:1;min-height:0;display:grid;gap:calc(var(--k)*4mm)}.dt-esq{display:grid;grid-template-rows:1fr auto;gap:calc(var(--k)*3mm);min-height:0;min-width:0}.dt-lin{display:flex;gap:calc(var(--k)*4mm);min-height:0;min-width:0;align-items:stretch}',
    '.vista{margin:0;display:flex;flex-direction:column;min-height:0;min-width:0}.vista .img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.vista .img img,.vista .img>svg.perspectiva{max-width:100%;max-height:100%;width:auto;height:100%;object-fit:contain}',
    '.tv{display:flex;align-items:center;gap:calc(var(--k)*1.8mm);margin-top:calc(var(--k)*1.2mm)}.tv .n{flex:none;min-width:calc(var(--k)*8mm);height:calc(var(--k)*8mm);padding:0 calc(var(--k)*1mm);border:calc(var(--k)*.3mm) solid var(--t);border-radius:99px;display:grid;place-items:center;font-size:calc(var(--k)*2.6mm);font-weight:600;background:var(--tint)}.tv b{display:block;font-size:calc(var(--k)*3.3mm);font-weight:500;border-bottom:calc(var(--k)*.3mm) solid var(--t);padding:0 calc(var(--k)*8mm) calc(var(--k)*.2mm) 0;line-height:1.2;white-space:nowrap}.tv small{display:block;font-size:calc(var(--k)*2.1mm);font-style:italic;text-transform:uppercase;letter-spacing:.03em;margin-top:calc(var(--k)*.4mm)}',
    '.vistas2{flex:1;min-height:0;display:flex;flex-direction:column;gap:calc(var(--k)*2mm)}.vistas2 .vista{flex:1;justify-content:center;align-items:center}.vistas2 .vista .img,.lat .vista .img{flex:none}.vistas2 .tv{align-self:center}.lat{display:flex;gap:calc(var(--k)*5mm);align-items:center;justify-content:center;flex:1;min-height:0}.lat .vista{align-items:flex-start}.lat-simb{display:grid;grid-template-columns:1fr;gap:calc(var(--k)*3mm)}.lat-simb .simb ul{grid-template-columns:repeat(3,1fr)}',
    '.dt-dir{display:flex;flex-direction:column;gap:calc(var(--k)*2.2mm);min-height:0;border-left:calc(var(--k)*.25mm) solid var(--b);padding-left:calc(var(--k)*3.5mm)}.dt-dir h2{font-size:calc(var(--k)*2.2mm);text-transform:uppercase;letter-spacing:.05em;text-align:center;line-height:1.25}',
    '.md{background:#fbf7f5;border:calc(var(--k)*.25mm) solid var(--b);border-radius:calc(var(--k)*2.6mm);padding:calc(var(--k)*1.6mm) calc(var(--k)*2mm) calc(var(--k)*1.2mm);display:flex;flex-direction:column;gap:calc(var(--k)*.6mm);min-width:0}.md header{display:flex;align-items:center;gap:calc(var(--k)*1.5mm)}.md header span{flex:none;background:var(--t);color:#fff;border-radius:99px;padding:calc(var(--k)*.25mm) calc(var(--k)*1.6mm);font-size:calc(var(--k)*1.9mm);font-weight:600;letter-spacing:.04em}.md header b{font-size:calc(var(--k)*2.35mm);font-weight:600;text-transform:lowercase;line-height:1.15}.md svg{width:100%;height:auto;display:block}.md footer{display:flex;justify-content:space-between;font-size:calc(var(--k)*1.75mm);color:var(--m);text-transform:lowercase}.md footer i{font-style:normal;color:var(--ink)}',
    '.mapa{position:relative;margin:0 auto;max-width:100%}.mapa img{position:absolute;inset:0;width:100%;height:100%;display:block}.mapa svg{position:absolute;inset:0;width:100%;height:100%}',
    '.pm{flex:1;min-height:0;display:grid;grid-template-columns:1fr calc(var(--k)*62mm);gap:calc(var(--k)*5mm)}.pm .lado{display:flex;flex-direction:column;gap:calc(var(--k)*2mm)}.pm table{border-collapse:collapse;font-size:.9em;width:100%}.pm td{padding:calc(var(--k)*1mm) calc(var(--k)*1.2mm);border-top:calc(var(--k)*.2mm) solid #eee6e2}.pm td:first-child{width:calc(var(--k)*13mm)}.pm .cod{display:inline-block;background:#9a3b2f;color:#fff;border-radius:99px;padding:0 calc(var(--k)*1.6mm);font-weight:600;font-size:.86em}.pm tr.atual td{background:var(--tint);font-weight:600}.loc{margin-top:calc(var(--k)*1mm)}.loc h2{margin-bottom:calc(var(--k)*1mm)}',
    '.vista{margin:0;display:flex;align-items:center;justify-content:center;min-height:0;min-width:0}.vw{display:flex;flex-direction:column;align-items:flex-start;max-width:100%;max-height:100%;min-height:0}.vw>svg,.vw>img{display:block;flex:none;max-width:100%}.vw .tv{margin-top:calc(var(--k)*1.4mm)}',
    '.pk{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly}.pk-l{display:flex;justify-content:space-evenly;align-items:flex-end;gap:calc(var(--k)*5mm)}.pk-l>.vista{flex:none}.pk-l .simb{align-self:center}',
    '.tv small i{font-style:normal;text-transform:none;letter-spacing:0;color:var(--m);margin-left:calc(var(--k)*1.2mm)}',
    '.mds{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--k)*4mm);align-content:start;flex:1;min-height:0}',
    '.dc{display:flex;flex-direction:column;align-items:center;gap:calc(var(--k)*.6mm)}.dc svg{width:calc(var(--k)*var(--dc)*1mm);height:calc(var(--k)*var(--dc)*1mm)}.dc.cx svg{width:100%;height:auto}.dc small{color:var(--m);font-size:calc(var(--k)*1.9mm);text-transform:lowercase}',
    '.sw{display:flex;flex-wrap:wrap;justify-content:center;gap:calc(var(--k)*2mm) calc(var(--k)*3mm)}.sw div{width:calc(var(--k)*17mm);text-align:center;font-size:calc(var(--k)*1.9mm);line-height:1.2}.sw span{display:block;width:calc(var(--k)*9mm);height:calc(var(--k)*9mm);border-radius:50%;margin:0 auto calc(var(--k)*.8mm);border:calc(var(--k)*.25mm) solid rgba(0,0,0,.25)}.sw .veio{background-image:repeating-linear-gradient(100deg,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.1) 2px 3px,rgba(255,255,255,.07) 3px 5px)}.sw small{display:block;color:var(--m)}',
    '.obs{margin-top:auto;font-size:calc(var(--k)*1.95mm);color:var(--m);line-height:1.35}.obs b{color:var(--t);font-weight:600}',
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
    if (el.tipo === 'led') {
      // corte da chapa: rasgo 12 × 10, perfil e difusor, cone de luz
      var cx0 = 14, cy0 = 40, cw = 122, ch = 36, emb = el.montagem === 'embutido';
      var px = cx0 + (el.posicao === 'fundo' ? cw - 34 : el.posicao === 'frente' ? 22 : cw / 2 - 12), pw = 24, ph = 18;
      s += '<defs><pattern id="hl" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#aaa" stroke-width=".7"/></pattern></defs>';
      if (emb) {
        s += '<path d="M' + cx0 + ' ' + cy0 + 'H' + (cx0 + cw) + 'V' + (cy0 + ch) + 'H' + (px + pw) + 'V' + (cy0 + ch - ph - 2) + 'H' + px + 'V' + (cy0 + ch) + 'H' + cx0 + 'Z" fill="url(#hl)" stroke="' + linha + '"/>';
        s += '<rect x="' + (px + 1.5) + '" y="' + (cy0 + ch - ph) + '" width="' + (pw - 3) + '" height="' + (ph - 4) + '" fill="#c9cdd1" stroke="#6b6b6b"/><rect x="' + (px + 1.5) + '" y="' + (cy0 + ch - 4) + '" width="' + (pw - 3) + '" height="4" fill="#fff6dc" stroke="#d9a400"/>';
      } else {
        s += '<rect x="' + cx0 + '" y="' + cy0 + '" width="' + cw + '" height="' + ch + '" fill="url(#hl)" stroke="' + linha + '"/>';
        s += '<rect x="' + px + '" y="' + (cy0 + ch) + '" width="' + pw + '" height="' + (ph - 6) + '" fill="#c9cdd1" stroke="#6b6b6b"/><rect x="' + px + '" y="' + (cy0 + ch + ph - 6) + '" width="' + pw + '" height="4" fill="#fff6dc" stroke="#d9a400"/>';
      }
      var ly = cy0 + ch + (emb ? 0 : ph - 2), lc = px + pw / 2;
      s += '<path d="M' + lc + ' ' + ly + 'L' + (lc - 38) + ' ' + (ly + 70) + 'H' + (lc + 38) + 'Z" fill="#d9a400" opacity=".16"/>';
      s += '<text x="' + cx0 + '" y="' + (cy0 - 22) + '" font-size="8">' + (emb ? 'chapa 18 mm com rasgo' : 'chapa 18 mm') + '</text>';
      s += '<text x="' + lc + '" y="' + (ly + 52) + '" font-size="8" text-anchor="middle">luz ' + el.temperatura + 'K</text>';
      var ref = el.posicao === 'fundo' ? [px + pw, cx0 + cw, 20] : el.posicao === 'frente' ? [cx0, px, 40] : null;
      if (ref) s += dcH(ref[0], ref[1], cy0 - 6, ref[2]);
      if (emb) s += dcV(cy0 + ch - ph - 2, cy0 + ch, px - 6, 10) + dcH(px, px + pw, cy0 + ch + 14, 12);
      return detSvg(W, H, s);
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

  // Ícones de status em SVG (sem caracteres que viram emoji)
  var ICONE = {
    erro: '<svg viewBox="0 0 10 10"><path d="M5 2v3.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="5" cy="7.8" r=".85" fill="#fff"/></svg>',
    aviso: '<svg viewBox="0 0 10 10"><path d="M5 2v3.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="5" cy="7.8" r=".85" fill="#fff"/></svg>',
    info: '<svg viewBox="0 0 10 10"><circle cx="5" cy="2.4" r=".85" fill="#fff"/><path d="M5 4.4v3.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    dica: '<svg viewBox="0 0 10 10"><path d="M2.4 5.2l1.8 1.8 3.5-3.8" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // Quadro de simbologia: o que cada traço da prancha quer dizer
  function simbologia(M, cor, comCorte) {
    var t = '#2b2b2b', f = '#5a5a5a';
    function sv(x) { return '<svg viewBox="0 0 30 20">' + x + '</svg>'; }
    var it = [
      [sv('<circle cx="15" cy="10" r="7" fill="#fff" stroke="#3e4b57" stroke-width="1.2"/><text x="15" y="13" font-size="8" font-weight="600" text-anchor="middle" fill="#3e4b57" font-family="Poppins,sans-serif">C1</text>'), 'coluna — mesma numeração no corte, na planta e nos detalhes'],
      [sv('<rect x="6" y="2" width="18" height="16" fill="#fff" stroke="' + t + '" stroke-width="1.3"/><path d="M6 2L24 10L6 18" fill="none" stroke="' + f + '" stroke-width=".8" stroke-dasharray="2.4 1.4"/>'), 'porta de giro — as linhas saem do lado da dobradiça'],
      [sv('<rect x="4" y="3" width="22" height="14" fill="#fff" stroke="' + t + '" stroke-width="1.3"/><path d="M4 3L15 17L26 3" fill="none" stroke="' + f + '" stroke-width=".8" stroke-dasharray="2.4 1.4"/>'), 'basculante — abre para cima, dobradiças no topo'],
      [sv('<rect x="4" y="2" width="22" height="7" fill="#fff" stroke="' + t + '" stroke-width="1.3"/><rect x="4" y="11" width="22" height="7" fill="#fff" stroke="' + t + '" stroke-width="1.3"/>'), 'gaveta — frente lisa, sem traço de abertura'],
      [sv('<path d="M3 12H27" stroke="' + cor + '" stroke-width=".8"/><path d="M3 7v8M27 7v8" stroke="' + cor + '" stroke-width=".6"/><path d="M1.5 13.5l3-3M25.5 13.5l3-3" stroke="' + cor + '" stroke-width=".9"/><text x="15" y="9.5" font-size="6" text-anchor="middle" fill="' + cor + '" font-family="Poppins,sans-serif">0,60</text>'), 'cota — medida da peça ou do vão'],
      [sv('<path d="M3 4H27" stroke="' + f + '" stroke-width="1.1"/><path d="M3 10H27M3 16H27" stroke="' + f + '" stroke-width=".55"/>'), 'linha cheia — peça vista; fina — prateleira']
    ];
    if (M.pecas.some(function (p) { return p.nome === 'Ripa'; })) it.push([sv('<rect x="4" y="2" width="22" height="16" fill="#fff" stroke="' + t + '" stroke-width="1.2"/><path d="M8 2v16M12 2v16M16 2v16M20 2v16" stroke="' + f + '" stroke-width=".55"/>'), 'ripado — ripas coladas sobre a frente']);
    if (M.pecas.some(function (p) { return p.grupo === 'led'; })) it.push([sv('<path d="M3 7H27" stroke="#d9a400" stroke-width="2" stroke-dasharray="3 1.5"/><path d="M15 8L9 18H21Z" fill="#d9a400" opacity=".25"/>'), 'perfil de LED — linha amarela, luz para baixo']);
    if (M.cuba) {
      it.push([sv('<rect x="5" y="4" width="20" height="12" fill="none" stroke="#4d6f99" stroke-width=".9" stroke-dasharray="2.4 1.4"/>'), 'cuba — projeção sob o tampo']);
      it.push([sv('<path d="M15 1V19" stroke="' + cor + '" stroke-width=".8" stroke-dasharray="4 1 .6 1"/>'), 'eixo hidráulico — centro da cuba e do sifão']);
    }
    if (comCorte) it.push([sv('<path d="M15 2V18" stroke="' + t + '" stroke-width="1" stroke-dasharray="4 1 .7 1"/><path d="M15 3h-7" stroke="' + t + '" stroke-width="1.6"/><path d="M8 3l3 -2v4z" fill="' + t + '"/><circle cx="20" cy="4" r="3.4" fill="#fff" stroke="' + t + '" stroke-width=".8"/><text x="20" y="5.6" font-size="4.5" font-weight="600" text-anchor="middle" fill="' + t + '" font-family="Poppins,sans-serif">A</text>'), 'linha de corte na planta — a seta mostra para onde o corte olha']);
    if (comCorte) it.push([sv('<rect x="4" y="4" width="22" height="5" fill="#cfc6c0" stroke="' + t + '" stroke-width=".8"/><rect x="4" y="11" width="22" height="5" fill="#a89f99" stroke="' + t + '" stroke-width=".8"/>'), 'no corte: peça cortada preenchida (frente mais escura)']);
    return '<div class="simb"><h2>simbologia</h2><ul>' + it.map(function (i) { return '<li>' + i[0] + '<span>' + esc(i[1]) + '</span></li>'; }).join('') + '</ul></div>';
  }

  // planta com a posição dos móveis (imagem do SketchUp + códigos desenhados por cima)
  function mapaHtml(mapa, maxW, maxH, so) {
    var w = mapa.w || 1600, h = mapa.h || 1000;
    var esc2 = Math.min(maxW / w, maxH / h);
    var r = w * 0.016;
    var sv = (mapa.itens || []).map(function (it) {
      var pts = (it.cantos || []).map(function (c) { return [c[0] * w, c[1] * h]; });
      if (pts.length < 3) return '';
      var cx = pts.reduce(function (a, p) { return a + p[0]; }, 0) / pts.length, cy = pts.reduce(function (a, p) { return a + p[1]; }, 0) / pts.length;
      var dest = so ? it.atual : true;
      var cor = it.atual ? '#9a3b2f' : '#c98f84';
      return '<polygon points="' + pts.map(function (p) { return n1(p[0]) + ',' + n1(p[1]); }).join(' ') + '" fill="' + (dest ? cor : '#ffffff') + '" fill-opacity="' + (dest ? 0.38 : 0.2) + '" stroke="' + cor + '" stroke-width="' + n1(w * 0.0022) + '"/>' +
        (dest || !so ? '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(r) + '" fill="' + cor + '" stroke="#fff" stroke-width="' + n1(w * 0.002) + '"/><text x="' + n1(cx) + '" y="' + n1(cy + r * 0.36) + '" font-size="' + n1(r * 0.95) + '" font-weight="600" text-anchor="middle" fill="#fff" font-family="Poppins,sans-serif">' + esc(it.codigo || '') + '</text>' : '');
    }).join('');
    return '<div class="mapa" style="width:' + n1(w * esc2) + 'mm;height:' + n1(h * esc2) + 'mm"><img src="' + esc(mapa.img) + '" alt="planta"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + sv + '</svg></div>';
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
    var codigo = String(spec.codigo || 'M01');
    function tv(titulo, escala, selo, sub) { return '<div class="tv">' + (selo ? '<span class="n">' + esc(selo) + '</span>' : '') + '<div><b>' + esc(titulo) + '</b><small>' + (escala ? 'escala 1:' + escala : 'sem escala') + (sub ? '<i>' + esc(sub) + '</i>' : '') + '</small></div></div>'; }
    function vfig(conteudo, titulo, escala, selo, sub, estilo) { return '<figure class="vista"' + (estilo ? ' style="' + estilo + '"' : '') + '><div class="vw">' + conteudo + tv(titulo, escala, selo, sub) + '</div></figure>'; }
    var oc = { unidade: est.unidade, corCota: est.corCota, corCotaTexto: est.corNumero || est.corCota };

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

    // 01 · prancha de detalhamento (no formato dos detalhamentos de escritório):
    // isométricas fechada e aberta, vista frontal colorida cotada, corte, detalhes em círculo e MDFs
    var img = dados.imagens || {};
    var D = dep('MarceDetalhes');
    var wDir = 46 * k, gap = 4 * k;
    var wEsq = areaW - wDir - gap - 4 * k;
    var hTit = 9 * k;
    var hBx = (areaH - 7 * k) * 0.5 - hTit;
    function peso(c) { return c.secoes.reduce(function (t, sm) { var cf = sm.cfg || {}; return t + 1 + (cf.tipo === 'gavetas' && cf.itens ? cf.itens.length * 2 : 0) + (cf.prateleiras || 0); }, 0) - (c.cuba ? 3 : 0); }
    var cPrinc = (M.colunas || []).slice().sort(function (a, b) { return peso(b) - peso(a) || a.idx - b.idx; })[0];
    var cT1 = cPrinc ? R.corteTecnico(M, cPrinc.idx, { areaW: wEsq * 0.3, areaH: hBx, unidade: est.unidade, corCota: est.corCota, corCotaTexto: oc.corCotaTexto, colorido: true }) : null;
    var fT1 = R.frontalTecnico(M, { areaW: wEsq - (cT1 ? cT1.w : 0) - gap, areaH: hBx, unidade: est.unidade, corCota: est.corCota, corCotaTexto: oc.corCotaTexto, colorido: true });
    var hIso = areaH - 7 * k - (hBx + hTit) - 3 * k - hTit - 3 * k;
    var tamIso = 'height:' + n1(hIso) + 'mm;width:auto;max-width:100%';
    var isoF = img.iso ? '<img src="' + img.iso + '" alt="isométrica fechada" style="' + tamIso + ';object-fit:contain">' : R.perspectiva(M, { aberto: false }).replace('<svg ', '<svg style="' + tamIso + '" ');
    var isoA = img.aberto ? '<img src="' + img.aberto + '" alt="isométrica aberta" style="' + tamIso + ';object-fit:contain">' : R.perspectiva(M, { aberto: true }).replace('<svg ', '<svg style="' + tamIso + '" ');
    var topo = '<div class="dt-lin" style="min-height:0">' + vfig(isoF, 'Isométrica fechada', 0, codigo, null, 'flex:1') + vfig(isoA, 'Isométrica aberta', 0, null, null, 'flex:1') + '</div>';
    var baixo = '<div class="dt-lin" style="height:' + n1(hBx + hTit) + 'mm">' + vfig(fT1.svg, 'Vista Frontal', fT1.escala, null, null, 'flex:1') +
      (cT1 ? vfig(cT1.svg, 'Corte', cT1.escala, null, 'coluna C' + (cPrinc.idx + 1)) : '') + '</div>';
    var dets = D ? D.doMovel(M, est.corCota, oc.corCotaTexto) : [];
    function cartaoMd(dt, i) { return '<div class="md"><header><span>D' + (i + 1) + '</span><b>' + esc(dt.titulo) + '</b></header>' + dt.svg + '<footer><span>sem escala</span><i>marcê</i></footer></div>'; }
    var mats = [['frentes', 'frente'], ['caixaria', 'caixa']];
    if (spec.caixaInternaBranca) mats.push(['interno', 'caixaInterna']);
    if (spec.materiais.gaveta && spec.materiais.gaveta.nome !== spec.materiais.caixa.nome) mats.push(['gavetas', 'gaveta']);
    var grupos = [];
    mats.forEach(function (m) {
      var mt = spec.materiais[m[1]]; if (!mt) return;
      var g = grupos.filter(function (x) { return x.mt.nome === mt.nome && x.mt.cor === mt.cor; })[0];
      if (g) g.usos.push(m[0]); else grupos.push({ mt: mt, usos: [m[0]] });
    });
    var sw = grupos.map(function (g) {
      var mt = g.mt;
      return '<div><span class="' + (mt.veio ? 'veio' : '') + '" style="background-color:' + esc(mt.cor) + '"></span>' + esc(mt.nome) + (mt.marca && mt.marca !== 'Genérico' ? '<small>' + esc(mt.marca) + '</small>' : '') + '<small>' + g.usos.join(' · ') + '</small></div>';
    });
    if (M.pecas.some(function (p) { return p.nome === 'Vidro canelado'; })) sw.push('<div><span style="background:#cfdde2"></span>Vidro canelado<small>temperado</small></div>');
    if (M.pecas.some(function (p) { return p.grupo === 'pedra'; })) sw.push('<div><span style="background:' + esc(R.corMat ? R.corMat(spec, 'pedra') : '#dcd9d2') + '"></span>Tampo em pedra<small>a definir</small></div>');
    var dir = '<div class="dt-dir">' + dets.slice(0, 2).map(cartaoMd).join('') + (dets.length > 2 ? '<p class="nota" style="text-align:center;margin:0">+ ' + (dets.length - 2) + ' detalhes na prancha de detalhes construtivos</p>' : '') +
      (img.mapa ? '<div class="loc"><h2>planta de localização</h2>' + mapaHtml(img.mapa, wDir - 4 * k, 34 * k, true) + '</div>' : '') +
      '<h2 style="margin-top:' + n1(1 * k) + 'mm">materiais</h2><div class="sw">' + sw.join('') + '</div>' +
      '<div class="obs"><b>' + cm(d.L) + ' × ' + cm(d.D) + ' × ' + cm(d.H) + ' cm</b> · ' + esc(amb.label.toLowerCase()) + ' · ' + M.resumo.pecas + ' peças<br>' + M.resumo.portas + ' portas · ' + M.resumo.gavetas + ' gavetas' +
      (spec.led && spec.led.ativo ? ' · LED ' + spec.led.temperatura + 'K' : '') + '<br>Conferir todas as medidas no local antes da execução. Cotas em ' + ({ m: 'metros', cm: 'centímetros', mm: 'milímetros' }[est.unidade]) + '.</div></div>';
    pagina('<p class="ey"><span style="text-transform:none">' + esc(codigo) + '</span> · detalhamento · ' + esc(tipoLabel.toLowerCase()) + '</p><div class="dt" style="grid-template-columns:1fr ' + n1(wDir) + 'mm"><div class="dt-esq">' + topo + baixo + '</div>' + dir + '</div>', fT1.escala);

    // planta de marcenaria (todos os móveis do marcê no arquivo, com código)
    if (img.mapa && img.mapa.itens && img.mapa.itens.length) {
      var itensM = img.mapa.itens.slice().sort(function (a, b) { return String(a.codigo).localeCompare(String(b.codigo)); });
      pagina(cabeca('planta de marcenaria') + '<div class="pm">' + vfig(mapaHtml(img.mapa, areaW - 67 * k, areaH - 26 * k, false), 'Planta Marcenaria', 0) +
        '<div class="lado"><h2>quadro de marcenaria</h2><table>' + itensM.map(function (it) { return '<tr' + (it.atual ? ' class="atual"' : '') + '><td><span class="cod">' + esc(it.codigo || '—') + '</span></td><td>' + esc(it.nome) + '</td></tr>'; }).join('') + '</table><p class="nota">Destaque: o móvel desta prancha. Os outros móveis do marcê no arquivo aparecem com o código de cada um.</p></div></div>');
    }

    // vistas e cortes: o marcê monta na prancha o máximo de vistas na mesma escala (a maior que couber).
    // Planta com as linhas de corte A, B, C...; cortes de cada tipo de coluna; simbologia no fim.
    var letras = 'ABCDEFGH';
    var tipicas = R.colunasTipicas(M, est.folha === 'A4' ? 3 : 4);
    var cortesP = tipicas.map(function (ci, ii) { var c = M.colunas[ci]; return { col: ci, letra: letras[ii], x: (c.x0 + c.x1) / 2 }; });
    var hT = 9.5 * k, gapP = 4 * k, Wp = areaW - 2 * k, Hp = areaH - 9 * k;
    var nSimb = 6 + (M.pecas.some(function (p) { return p.nome === 'Ripa'; }) ? 1 : 0) + (M.pecas.some(function (p) { return p.grupo === 'led'; }) ? 1 : 0) + (M.cuba ? 2 : 0) + (cortesP.length ? 1 : 0);
    var simbItem = { html: '<div class="lat-simb" style="width:' + n1(Math.min(Wp, 190 * k)) + 'mm">' + simbologia(M, est.corCota, cortesP.length > 0) + '</div>', w: Math.min(Wp, 190 * k), h: 11 * k + Math.ceil(nSimb / 3) * 6.2 * k, simb: true };
    function vistasEm(E) {
      var o = Object.assign({}, oc, { escala: E });
      var lst = [
        { r: R.frontalTecnico(M, Object.assign({ colorido: true }, o)), t: 'Vista Frontal' },
        { r: R.frontalInterna(M, o), t: 'Corte Frontal', sub: 'vista interna, sem as frentes' },
        { r: R.plantaTecnica(M, Object.assign({ cortes: cortesP }, o)), t: 'Planta Baixa' },
        { r: R.lateralExterna(M, o), t: 'Vista Lateral' }
      ];
      cortesP.forEach(function (ct) { lst.push({ r: R.corteTecnico(M, ct.col, Object.assign({ colorido: true }, o)), t: 'Corte ' + ct.letra, sub: 'coluna C' + (ct.col + 1) }); });
      return lst.map(function (v) { return { html: vfig(v.r.svg, v.t, E, null, v.sub), w: Math.max(v.r.w, 42 * k), h: v.r.h + hT }; });
    }
    function empacotar(itens) {
      var rows = [], row = null, ok = true;
      itens.forEach(function (it) {
        if (it.w > Wp) ok = false;
        if (!row || row.w + gapP + it.w > Wp) { row = { itens: [], w: -gapP, h: 0 }; rows.push(row); }
        row.itens.push(it); row.w += gapP + it.w; row.h = Math.max(row.h, it.h);
      });
      var tot = rows.reduce(function (a, r) { return a + r.h; }, 0) + gapP * (rows.length - 1);
      return ok && tot <= Hp ? rows : null;
    }
    // escolhe a maior escala em que um grupo de vistas cabe numa prancha
    function melhor(sel, comSimb, limite) {
      for (var ie = 0; ie < ESC_PRANCHA.length; ie++) {
        var E = ESC_PRANCHA[ie];
        if (limite && E > limite) break;
        var vs = vistasEm(E);
        var its = sel.map(function (ix) { return vs[ix]; }).filter(Boolean);
        if (comSimb) its.push(simbItem);
        var rows = empacotar(its);
        if (rows) return { E: E, rows: rows };
      }
      return null;
    }
    var nV = vistasEm(25).length, idx = [];
    for (var iv = 0; iv < nV; iv++) idx.push(iv);
    var folhasV = [];
    var uma = melhor(idx, true, 50);
    if (uma) folhasV.push(uma);
    else {
      // duas pranchas: testa divisões e fica com a de maior escala (desempate: menor soma)
      var resto = idx.filter(function (ix) { return ix > 1; });
      var semLat = resto.filter(function (ix) { return ix !== 3; });
      var opcoes = [
        [[0, 1], true, resto, false], [[0, 1], false, resto, true],
        [[0, 1, 3], true, semLat, false], [[0, 1, 3], false, semLat, true]
      ];
      var melhorPar = null;
      opcoes.forEach(function (op2) {
        var a = melhor(op2[0], op2[1]), b = melhor(op2[2], op2[3]);
        if (!a || !b) return;
        var nota = Math.max(a.E, b.E) * 1000 + a.E + b.E;
        if (!melhorPar || nota < melhorPar.nota) melhorPar = { nota: nota, fs: [a, b] };
      });
      if (melhorPar) folhasV = melhorPar.fs;
      else idx.forEach(function (ix) { var aa = melhor([ix], ix === nV - 1); if (aa) folhasV.push(aa); });
    }
    folhasV.forEach(function (fv, nf) {
      pagina(cabeca('<span style="text-transform:none">' + esc(codigo) + '</span> · vistas e cortes' + (folhasV.length > 1 ? ' · ' + (nf + 1) + '/' + folhasV.length : '')) +
        '<div class="pk">' + fv.rows.map(function (r) { return '<div class="pk-l">' + r.itens.map(function (it) { return it.html; }).join('') + '</div>'; }).join('') + '</div>', fv.E);
    });

    // detalhes construtivos (todos os que valem para o móvel), 6 por prancha
    for (var di = 0; di < dets.length; di += 6) {
      pagina(cabeca('<span style="text-transform:none">' + esc(codigo) + '</span> · detalhes construtivos' + (dets.length > 6 ? ' · ' + (di / 6 + 1) + '/' + Math.ceil(dets.length / 6) : '')) +
        '<div class="mds">' + dets.slice(di, di + 6).map(function (dt, i) { return cartaoMd(dt, di + i); }).join('') + '</div>');
    }

    // 03 · planta baixa + detalhes
    var els = (M.elementos || []).slice();
    (M.eletros || []).forEach(function (e) { els.push({ tipo: 'eletro', nome: 'Nicho ' + e.tipo.toLowerCase(), col: e.col, largura: e.largura, altura: e.altura, prof: e.prof, recomendado: e.recomendado, texto: e.obs }); });
    var cards = els.map(function (el) {
      var t = '<table>' + (el.col === null || el.col === undefined ? tr2('onde', esc(el.local || '')) : '');
      if (el.tipo === 'led') t += tr2('posição', esc({ fundo: 'no fundo (20 mm da borda)', frente: 'na frente (40 mm da borda)', meio: 'no meio da profundidade' }[el.posicao] || el.posicao)) + tr2('fita', String(el.metros).replace('.', ',') + ' m · ' + el.temperatura + 'K') + tr2('perfil', el.montagem === 'embutido' ? 'embutido no rasgo 12 × 10 mm' : 'sobreposto, colado');
      else if (el.tipo === 'eletro') t += tr2('interno', Math.round(el.largura) + ' × ' + Math.round(el.altura) + ' mm') + tr2('padrão', esc(el.recomendado));
      else {
        t += tr2('frente', Math.round(el.frenteW) + ' × ' + Math.round(el.frenteH) + ' mm');
        if (el.cestos) t += tr2('interior', el.cestos + ' cesto(s) aramado(s)');
        if (el.litros) t += tr2('cesto', el.baldes + ' × ~' + el.litros + ' L no total');
        if (el.alturaInterna) t += tr2('interna', el.alturaInterna + ' mm · recuo 15 mm');
        t += tr2('ferragem', 'corrediça ' + el.corredica + ' mm' + (el.corredicaInterna ? ' + ' + el.corredicaInterna : ''));
      }
      t += tr2('obs.', esc(el.texto || '')) + '</table>';
      var bal = el.col === null || el.col === undefined ? '' : '<span class="bal">C' + (el.col + 1) + '</span>';
      return '<div class="det">' + detalhe(el) + '<div><h3>' + bal + esc(el.nome) + '</h3>' + t + '</div></div>';
    });
    for (var ci = 0; ci < cards.length; ci += 6) pagina(cabeca('detalhamento dos elementos' + (cards.length > 6 ? ' · ' + (ci / 6 + 1) + '/' + Math.ceil(cards.length / 6) : '')) + '<div class="dets">' + cards.slice(ci, ci + 6).join('') + '</div>');

    // 04 · especificação + conferência
    var pux = E.PUXADORES[spec.puxador.tipo] + (spec.puxador.tipo === 'alca' ? ' ' + spec.puxador.comprimento + ' mm' : '');
    var base = { rodape: 'Rodapé recuado ' + spec.base.altura + ' mm (recuo ' + spec.base.recuo + ' mm)', pes: 'Pés reguláveis com saia (' + spec.base.altura + ' mm)', suspenso: 'Suspenso — fixação oculta na parede', nenhum: 'Sobre base existente na obra' }[spec.base.tipo];
    var fer = M.ferragens.map(function (f) { return f.qtd + (f.un === 'm' || f.un === 'm²' ? ' ' + f.un : '') + ' × ' + esc(f.item); }).join('<br>');
    pagina(cabeca('especificação e conferência técnica') + '<div class="col2"><table class="spec">' +
      tr2('tipo', esc(tipoLabel)) + tr2('ambiente', esc(amb.label)) +
      tr2('medidas totais', cm(d.L) + ' × ' + cm(d.D) + ' × ' + cm(d.H) + ' cm') +
      tr2('materiais sugeridos', 'Caixaria: ' + esc(amb.caixa) + '<br>Frentes: ' + esc(amb.frentes) + '<br>Fundo: ' + esc(amb.fundo)) +
      tr2('materiais escolhidos', 'Frentes: ' + esc(E.nomeMaterial(spec.materiais, 'frente')) + '<br>Caixaria: ' + esc(E.nomeMaterial(spec.materiais, 'caixa'))) +
      tr2('espessuras', 'Caixaria ' + spec.esp.caixa + ' · frentes ' + spec.esp.frente + ' · fundo ' + spec.esp.fundo + ' · gavetas ' + spec.esp.gaveta + ' mm') +
      tr2('portas', spec.frentes.montagem === 'embutida' ? 'Embutidas — dobradiça super curva' : 'Sobrepostas — reta na lateral externa, curva na divisória') +
      tr2('puxador', esc(pux)) + tr2('base', esc(base)) + tr2('ferragens', fer) +
      '</table><div><h2 style="margin-bottom:' + n1(2 * k) + 'mm">conferência técnica</h2><ul class="conf">' +
      M.avisos.map(function (a) { return '<li><span class="ic ' + a.nivel + '">' + (ICONE[a.nivel] || ICONE.info) + '</span><span>' + esc(a.msg) + '</span></li>'; }).join('') + '</ul></div></div>');

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
    var est = Object.assign({ folha: 'A4', visual: 'marce', unidade: 'cm', corCota: '#c0392b', corNumero: '' }, dados.prancha || {});
    if (!est.corNumero) est.corNumero = est.corCota;
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
    doc.getElementById('cor-num').addEventListener('change', function (ev) { est.corNumero = ev.target.value; desenhar(); });
    doc.getElementById('cor-num').value = est.corNumero;
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
      grupo('unidade', 'cotas', [['cm', 'cm'], ['m', 'metros'], ['mm', 'mm']]) +
      '<div class="grp"><span>linha da cota</span><input type="color" id="cor-cota" value="#c0392b"></div>' +
      '<div class="grp"><span>número</span><input type="color" id="cor-num" value="#c0392b"></div>' +
      '<button class="pri" onclick="window.print()">imprimir / salvar pdf</button><span class="dica" id="dica-papel"></span></div>';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório executivo · ' + esc(spec.nome) + '</title><style>' + CSS + '</style><style id="pagina"></style></head><body>' +
      barra + '<div id="pranchas"></div>' +
      '<script data-marce="engine.js" src="engine.js"></script><script data-marce="nesting.js" src="nesting.js"></script><script data-marce="render.js" src="render.js"></script><script data-marce="detalhes.js" src="detalhes.js"></script><script data-marce="report.js" src="report.js"></script>' +
      '<script>window.__MARCE__=' + json + ';MarceRelatorio.montar(window.__MARCE__);</script></body></html>';
  }

  return { gerar: gerar, montar: montar, montarPranchas: montarPranchas, detalhe: detalhe, FOLHAS: FOLHAS };
});
