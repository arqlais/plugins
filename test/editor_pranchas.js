// Editor de pranchas (no navegador): campos, cores, logotipo, pranchas escolhidas e o que fica salvo.
// Rode depois de test/pranchas.js (usa test/prints/pranchas.html).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const arq = path.resolve('test/prints/pranchas.html');
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + arq); await p.waitForTimeout(500);
  const n0 = await p.$$eval('.folha', f => f.length);
  await p.fill('[data-e="escritorio.nome"]', 'Estúdio Teste');
  await p.evaluate(() => { const i = document.querySelector('[data-e="est.corDestaque"]'); i.value = '#2f6f5e'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => { const i = document.querySelector('[data-e="est.corNumero"]'); i.value = '#1d4ed8'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.uncheck('[data-e="paginas.lista"]');
  await p.click('[data-f="folha"][data-v="A3"]');
  // logotipo
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAGklEQVR42mNk+M9Qz0AEYBxVSF+FjKMKGQAAcQ0E/2N8xQkAAAAASUVORK5CYII=', 'base64');
  const lp = path.join(require('os').tmpdir(), 'marce-logo-teste.png'); fs.writeFileSync(lp, png);
  await p.setInputFiles('#ed-logo', lp);
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({
    folhas: document.querySelectorAll('.folha').length,
    nomeNoCarimbo: document.querySelector('.carimbo').textContent.includes('Estúdio Teste'),
    logo: !!document.querySelector('.carimbo .lg img'),
    numeroAzul: document.querySelector('.folha svg.tecnico text[fill="#1d4ed8"]') !== null,
    destaque: getComputedStyle(document.querySelector('.folha')).getPropertyValue('--ink').trim(),
    a3: document.querySelector('.folha').style.width
  }));
  // persistência: recarrega a página
  await p.reload(); await p.waitForTimeout(600);
  const r2 = await p.evaluate(() => ({ folhas: document.querySelectorAll('.folha').length, nome: document.querySelector('[data-e="escritorio.nome"]').value, logo: !!document.querySelector('.carimbo .lg img'), a3: document.querySelector('.folha').style.width }));
  await p.screenshot({ path: 'test/prints/16-editor-pranchas.png' });
  const ok = r.nomeNoCarimbo && r.logo && r.numeroAzul && r.destaque === '#2f6f5e' && r.a3 === '420mm' && r.folhas < n0 && r2.nome === 'Estúdio Teste' && r2.logo && r2.a3 === '420mm' && !erros.length;
  console.log(ok ? 'editor de pranchas: ok' : 'editor de pranchas FALHOU ' + JSON.stringify({ n0, r, r2, erros }));
  process.exitCode = ok ? 0 : 1;
  await b.close();
})();
