// Verificador de sobreposição nas pranchas: mede cada texto de cada desenho (posição real na
// página) e acusa textos que se tocam. Uso: node test/sobreposicao.js [pasta-com-pranchas.html ...]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verificar(pagina, arquivo) {
  await pagina.goto('file://' + arquivo);
  await pagina.waitForTimeout(700);
  await pagina.evaluate(() => document.fonts && document.fonts.ready);
  await pagina.waitForTimeout(300);
  return pagina.evaluate(() => {
    const out = [];
    document.querySelectorAll('.folha').forEach((folha, nf) => {
      const titulo = (folha.querySelector('.ey') || {}).textContent || '';
      folha.querySelectorAll('svg').forEach((svg) => {
        const ts = Array.from(svg.querySelectorAll('text')).filter((t) => t.textContent.trim() && t.getBBox().width > 0);
        const r = ts.map((t) => { const b = t.getBoundingClientRect(); return { t: t.textContent.trim(), x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }; });
        for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
          const a = r[i], b = r[j];
          const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          // tolerância: encostar 0,5 px (anti-serrilhado) não conta
          if (ox > 0.8 && oy > 0.8) out.push({ prancha: nf + 1, titulo: titulo.trim(), a: a.t, b: b.t });
        }
      });
    });
    return out;
  });
}

(async () => {
  const arquivos = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(__dirname, 'prints', 'pranchas.html')];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  let total = 0;
  for (const arq of arquivos) {
    if (!fs.existsSync(arq)) continue;
    const res = await verificar(p, path.resolve(arq));
    total += res.length;
    console.log(path.basename(path.dirname(arq)) + '/' + path.basename(arq) + ': ' + (res.length ? res.length + ' sobreposições' : 'nenhuma sobreposição'));
    res.slice(0, 40).forEach((r) => console.log('  prancha ' + r.prancha + ' (' + r.titulo + '): "' + r.a + '" × "' + r.b + '"'));
  }
  await b.close();
  process.exitCode = total ? 1 : 0;
})();
