// Grava um vídeo curto da bancada (Monta pra mim) e marca, em ms desde o início do vídeo, quando cada etapa termina.
// Uso: node qa/animacoes/video.cjs <prefixo> <porta> [segundos]. Saída: <prefixo>.webm e <prefixo>-marcas.json.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const [prefixo = "video", porta = "3311", seg = "70"] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const dir = path.join(__dirname, `.video-${prefixo}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(`http://localhost:${porta}/bancada?lanche=costela&debug=1`);
  await page.waitForSelector('[data-testid="monta-pra-mim"]:not([disabled])', { timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.click('[data-testid="monta-pra-mim"]');
  const marcas = []; let ultimo = null;
  const fim = Date.now() + Number(seg) * 1000;
  while (Date.now() < fim) {
    const id = await page.evaluate(() => window.__protoId ?? null);
    if (id !== ultimo) { marcas.push({ ms: Date.now() - t0, id }); ultimo = id; }
    if (await page.$('[data-testid="pronto"]') && !marcas.some((m) => m.id === "PRONTO")) marcas.push({ ms: Date.now() - t0, id: "PRONTO" });
    await page.waitForTimeout(100);
  }
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(__dirname, `${prefixo}.webm`));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(path.join(__dirname, `${prefixo}-marcas.json`), JSON.stringify(marcas, null, 1));
  console.log(marcas.map((m) => `${m.ms} ${m.id}`).join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
