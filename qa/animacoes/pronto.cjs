// Foto do lanche pronto (destaque): node qa/animacoes/pronto.cjs <arquivo.png> <porta> <lanche> <largura>x<altura>
const path = require("path");
const { chromium } = require("playwright");
const [saida, porta = "3311", lanche = "costela", tela = "390x844"] = process.argv.slice(2);
const [w, h] = tela.split("x").map(Number);
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`http://localhost:${porta}/bancada?lanche=${lanche}&debug=1`);
  await p.waitForSelector('[data-testid="monta-pra-mim"]:not([disabled])', { timeout: 180000 });
  await p.waitForTimeout(1000);
  await p.click('[data-testid="monta-pra-mim"]');
  await p.waitForSelector('[data-testid="pronto"]', { timeout: 240000 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: path.resolve(saida) });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
